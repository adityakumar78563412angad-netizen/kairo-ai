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

function isImageAttachment(
  attachment: Attachment
) {
  const type =
    typeof attachment.type === "string"
      ? attachment.type.toLowerCase()
      : "";

  const name =
    typeof attachment.name === "string"
      ? attachment.name.toLowerCase()
      : "";

  return (
    type.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(name)
  );
}

async function imageUrlToDataUrl(
  url: string,
  fallbackType?: string
) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Kairo could not download the uploaded image from storage. HTTP ${response.status}.`
    );
  }

  const contentType =
    response.headers.get("content-type") ||
    fallbackType ||
    "image/jpeg";

  if (!contentType.startsWith("image/")) {
    throw new Error(
      `The uploaded file is not being returned as an image. Storage returned: ${contentType}`
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  const maxSize = 20 * 1024 * 1024;

  if (arrayBuffer.byteLength > maxSize) {
    throw new Error(
      "The image is larger than Groq's 20 MB image limit."
    );
  }

  const base64 =
    Buffer.from(arrayBuffer).toString("base64");

  return `data:${contentType};base64,${base64}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const rawMessages = Array.isArray(
      body?.messages
    )
      ? body.messages
      : [];

    const messages: InputMessage[] =
      rawMessages
        .filter(
          (m: any) =>
            (m?.role === "user" ||
              m?.role === "assistant") &&
            typeof m?.content === "string" &&
            m.content.trim().length > 0
        )
        .map((m: any) => ({
          role: m.role,
          content: m.content.trim(),
        }));

    const attachments: Attachment[] =
      Array.isArray(body?.attachments)
        ? body.attachments.filter(
            (attachment: any) =>
              attachment &&
              typeof attachment === "object"
          )
        : [];

    if (
      messages.length === 0 &&
      attachments.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No messages or attachments provided.",
        },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GROQ_API_KEY?.trim();

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
     * -------------------------------------------------------
     * DETECT IMAGES
     * -------------------------------------------------------
     */

    const imageAttachments =
      attachments.filter(
        isImageAttachment
      );

    const hasImages =
      imageAttachments.length > 0;

    /*
     * Groq currently supports multimodal vision
     * models such as Qwen 3.6 27B.
     */

    const model = hasImages
      ? "qwen/qwen3.6-27b"
      : "openai/gpt-oss-120b";

    /*
     * -------------------------------------------------------
     * SYSTEM PROMPT
     * -------------------------------------------------------
     */

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

LANGUAGE:
- If the user speaks Hindi, respond in Hindi.
- If the user speaks Hinglish, respond in natural Hinglish.
- If the user speaks English, respond in English.
- Match the user's tone naturally.

IMAGE UNDERSTANDING:
- You can analyze images that are attached to the conversation.
- When an image is attached, use the actual visual information from the image.
- Never say that you cannot see the image when an image was successfully provided.
- If the user asks "ye picture kaisi hai", give a natural opinion based on the visible image.
- You may discuss subject, composition, lighting, colors, background, quality, mood and other visible details.
- Never invent details that are not visible.
- If a specific detail is unclear, say that it is unclear.
- If the user asks about text visible in an image, read and explain it when possible.

IMPORTANT:
Be concise by default, but never omit important information needed to correctly answer the question.
`;

    /*
     * -------------------------------------------------------
     * PREPARE GROQ MESSAGES
     * -------------------------------------------------------
     */

    let groqMessages: any[];

    if (hasImages) {
      /*
       * Download every image from B2/storage and convert
       * it into a base64 data URL.
       *
       * This means Groq receives the actual image bytes
       * instead of depending on Groq being able to access
       * the B2 URL itself.
       */

      const imageParts = [];

      for (const attachment of imageAttachments) {
        if (!attachment.url) {
          continue;
        }

        console.log(
          "KAIRO VISION IMAGE:",
          {
            name: attachment.name,
            type: attachment.type,
            url: attachment.url,
          }
        );

        const dataUrl =
          await imageUrlToDataUrl(
            attachment.url,
            attachment.type
          );

        imageParts.push({
          type: "image_url",
          image_url: {
            url: dataUrl,
          },
        });
      }

      if (imageParts.length === 0) {
        return NextResponse.json(
          {
            error:
              "Kairo received an image attachment, but could not prepare it for vision analysis.",
          },
          { status: 400 }
        );
      }

      const previousMessages =
        messages.slice(0, -1);

      const lastMessage =
        messages.length > 0
          ? messages[messages.length - 1]
          : null;

      const userText =
        lastMessage?.role === "user"
          ? lastMessage.content
          : "Please analyze the attached image.";

      groqMessages = [
        {
          role: "system",
          content: systemPrompt,
        },

        ...previousMessages.map(
          (message) => ({
            role: message.role,
            content: message.content,
          })
        ),

        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                userText ||
                "Please analyze the attached image.",
            },

            ...imageParts,
          ],
        },
      ];
    } else {
      /*
       * Normal text-only Kairo.
       */

      groqMessages = [
        {
          role: "system",
          content: systemPrompt,
        },

        ...messages.map(
          (message) => ({
            role: message.role,
            content: message.content,
          })
        ),
      ];
    }

    /*
     * -------------------------------------------------------
     * GROQ REQUEST
     * -------------------------------------------------------
     */

    console.log(
      "KAIRO MODEL:",
      model
    );

    console.log(
      "KAIRO HAS IMAGES:",
      hasImages
    );

    console.log(
      "KAIRO IMAGE COUNT:",
      imageAttachments.length
    );

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${apiKey}`,
        },

        body: JSON.stringify({
          model,

          messages: groqMessages,

          temperature: hasImages
            ? 0.4
            : 0.5,

          max_completion_tokens: 2048,

          stream: true,
        }),
      }
    );

    /*
     * -------------------------------------------------------
     * GROQ ERROR
     * -------------------------------------------------------
     */

    if (!groqResponse.ok) {
      const errorText =
        await groqResponse.text();

      console.error(
        "GROQ ERROR:",
        errorText
      );

      let message = errorText;

      try {
        const parsed =
          JSON.parse(errorText);

        message =
          parsed?.error?.message ||
          parsed?.error ||
          errorText;
      } catch {}

      return NextResponse.json(
        {
          error:
            `Groq request failed: ${message}`,
        },
        {
          status:
            groqResponse.status,
        }
      );
    }

    if (!groqResponse.body) {
      return NextResponse.json(
        {
          error:
            "Groq returned no response body.",
        },
        { status: 500 }
      );
    }

    /*
     * -------------------------------------------------------
     * STREAM RESPONSE
     * -------------------------------------------------------
     */

    const encoder =
      new TextEncoder();

    const decoder =
      new TextDecoder();

    const stream =
      new ReadableStream({
        async start(controller) {
          const reader =
            groqResponse.body!.getReader();

          let buffer = "";

          try {
            while (true) {
              const {
                value,
                done,
              } = await reader.read();

              if (done) {
                break;
              }

              buffer +=
                decoder.decode(
                  value,
                  {
                    stream: true,
                  }
                );

              const lines =
                buffer.split("\n");

              buffer =
                lines.pop() || "";

              for (const line of lines) {
                const trimmed =
                  line.trim();

                if (
                  !trimmed.startsWith(
                    "data:"
                  )
                ) {
                  continue;
                }

                const data =
                  trimmed
                    .slice(5)
                    .trim();

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
                    choice?.delta
                      ?.content;

                  if (
                    typeof text ===
                      "string" &&
                    text.length > 0
                  ) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify(
                          {
                            text,
                          }
                        )}\n\n`
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