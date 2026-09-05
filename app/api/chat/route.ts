import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Attachment = {
  name?: string;
  type?: string;
  size?: number;
  url?: string;
  key?: string;
  relativePath?: string;
};

type InputMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const rawMessages = Array.isArray(body?.messages)
      ? body.messages
      : [];

    const messages: InputMessage[] = rawMessages
      .filter(
        (m: any) =>
          (m?.role === "user" || m?.role === "assistant") &&
          typeof m?.content === "string" &&
          m.content.trim().length > 0
      )
      .map((m: any) => ({
        role: m.role,
        content: m.content.trim(),
      }));

    const attachments: Attachment[] = Array.isArray(
      body?.attachments
    )
      ? body.attachments.filter(
          (attachment: any) =>
            attachment &&
            typeof attachment === "object" &&
            typeof attachment.url === "string" &&
            attachment.url.trim().length > 0
        )
      : [];

    if (messages.length === 0 && attachments.length === 0) {
      return NextResponse.json(
        {
          error: "No messages or attachments provided.",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GROQ_API_KEY is missing. Check your environment variables.",
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * MODEL SELECTION
     * ---------------------------------------------------------
     *
     * Normal chat:
     *   openai/gpt-oss-120b
     *
     * Image chat:
     *   meta-llama/llama-4-scout-17b-16e-instruct
     *
     * The vision model is selected automatically whenever
     * an image attachment is present.
     */

    const imageAttachments = attachments.filter(
      (attachment) =>
        typeof attachment.type === "string" &&
        attachment.type.startsWith("image/") &&
        typeof attachment.url === "string" &&
        attachment.url.trim().length > 0
    );

    const hasImages = imageAttachments.length > 0;

    const model = hasImages
      ? "meta-llama/llama-4-scout-17b-16e-instruct"
      : "openai/gpt-oss-120b";

    const systemPrompt = `
You are KAIRO, a helpful, intelligent, friendly and natural AI assistant.

RESPONSE LENGTH RULES:
- Always match the length of your answer to the user's question.
- For simple or short questions, give a short and direct answer.
- Do not give long explanations unless the user asks for detail.
- If the user asks a yes/no question, answer directly first.
- If the user asks for a simple fact, answer in 1-3 sentences when possible.
- For casual conversation, respond naturally and briefly.
- For normal questions, provide a clear and reasonably detailed answer.
- Only give long, comprehensive answers when the user explicitly asks for detailed, complete, deep, step-by-step, or extensive information.
- Never add unnecessary introductions, conclusions, repetition, or filler.
- Do not repeat information the user already knows.
- Do not create unnecessary headings or bullet points for very simple questions.

LANGUAGE:
- If the user speaks Hindi, respond in Hindi.
- If the user speaks Hinglish, respond in natural Hinglish.
- If the user speaks English, respond in English.
- Match the user's tone naturally.

IMAGE UNDERSTANDING:
- When an image is attached, actually analyze the image and answer based on what you can see.
- Never claim that you cannot see an attached image if a valid image has been provided to you.
- If the user asks how an image looks, describe the visible subject, composition, lighting, colors, quality, mood and other relevant visual details.
- Do not invent details that are not visible.
- If something in the image is unclear, honestly say that it is unclear.
- When the user asks for an opinion about an image, give a natural and useful opinion.
- Treat the attached image as part of the user's question.

IMPORTANT:
Be concise by default, but never omit important information needed to correctly answer the question.
`;

    /*
     * ---------------------------------------------------------
     * BUILD GROQ MESSAGES
     * ---------------------------------------------------------
     */

    let groqMessages: any[];

    if (hasImages) {
      /*
       * Vision request.
       *
       * We keep the conversation history, but the latest user
       * message becomes a multimodal message containing:
       *
       *   1. text
       *   2. image_url
       */

      const previousMessages = messages.slice(0, -1);

      const lastUserMessage =
        messages.length > 0
          ? messages[messages.length - 1]
          : null;

      const latestText =
        lastUserMessage?.role === "user"
          ? lastUserMessage.content
          : "Please analyze the attached image.";

      groqMessages = [
        {
          role: "system",
          content: systemPrompt,
        },

        ...previousMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),

        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                latestText ||
                "Please analyze the attached image.",
            },

            ...imageAttachments.map((attachment) => ({
              type: "image_url",
              image_url: {
                url: attachment.url,
              },
            })),
          ],
        },
      ];
    } else {
      /*
       * Normal text-only request.
       */

      groqMessages = [
        {
          role: "system",
          content: systemPrompt,
        },

        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ];
    }

    /*
     * ---------------------------------------------------------
     * GROQ REQUEST
     * ---------------------------------------------------------
     */

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },

        body: JSON.stringify({
          model,

          messages: groqMessages,

          temperature: hasImages ? 0.4 : 0.5,

          max_completion_tokens: 2048,

          ...(model === "openai/gpt-oss-120b"
            ? {
                reasoning_effort: "low",
                reasoning_format: "hidden",
              }
            : {}),

          stream: true,
        }),
      }
    );

    /*
     * ---------------------------------------------------------
     * GROQ ERROR
     * ---------------------------------------------------------
     */

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();

      console.error("GROQ ERROR:", errorText);

      let message = errorText;

      try {
        const parsed = JSON.parse(errorText);

        message =
          parsed?.error?.message ||
          parsed?.error ||
          errorText;
      } catch {}

      return NextResponse.json(
        {
          error: `Groq request failed: ${message}`,
        },
        {
          status: groqResponse.status,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * STREAM RESPONSE
     * ---------------------------------------------------------
     */

    if (!groqResponse.body) {
      return NextResponse.json(
        {
          error: "Groq returned no response body.",
        },
        { status: 500 }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader =
          groqResponse.body!.getReader();

        let buffer = "";

        try {
          while (true) {
            const { value, done } =
              await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, {
              stream: true,
            });

            const lines =
              buffer.split("\n");

            buffer =
              lines.pop() || "";

            for (const line of lines) {
              const trimmed =
                line.trim();

              if (
                !trimmed.startsWith("data:")
              ) {
                continue;
              }

              const data =
                trimmed.slice(5).trim();

              if (
                !data ||
                data === "[DONE]"
              ) {
                continue;
              }

              try {
                const parsed =
                  JSON.parse(data);

                const choice =
                  parsed?.choices?.[0];

                const text =
                  choice?.delta?.content;

                if (
                  typeof text === "string" &&
                  text.length > 0
                ) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        text,
                      })}\n\n`
                    )
                  );
                }
              } catch (error) {
                console.error(
                  "STREAM PARSE ERROR:",
                  error
                );
              }
            }
          }

          controller.enqueue(
            encoder.encode(
              "data: [DONE]\n\n"
            )
          );

          controller.close();
        } catch (error) {
          console.error(
            "STREAM ERROR:",
            error
          );

          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      status: 200,

      headers: {
        "Content-Type":
          "text/event-stream; charset=utf-8",

        "Cache-Control":
          "no-cache, no-transform",

        Connection: "keep-alive",

        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error(
      "KAIRO ROUTE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "KAIRO request failed.",
      },
      { status: 500 }
    );
  }
}