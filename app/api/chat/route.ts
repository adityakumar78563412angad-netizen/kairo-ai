import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const messages = Array.isArray(body?.messages)
      ? body.messages
          .filter(
            (m: any) =>
              (m?.role === "user" || m?.role === "assistant") &&
              typeof m?.content === "string" &&
              m.content.trim().length > 0
          )
          .map((m: any) => ({
            role: m.role,
            content: m.content.trim(),
          }))
      : [];

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GROQ_API_KEY is missing. Check your .env.local file.",
        },
        { status: 500 }
      );
    }

    const model = "openai/gpt-oss-120b";

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

          messages: [
            {
              role: "system",
              content:
                "You are KAIRO, a helpful, intelligent and friendly AI assistant. Answer the user's question clearly and naturally. If the user speaks Hindi or Hinglish, respond in Hindi or Hinglish.",
            },
            ...messages,
          ],

          temperature: 0.7,

          max_completion_tokens: 4096,

          reasoning_effort: "low",

          reasoning_format: "hidden",

          stream: true,
        }),
      }
    );

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
        const reader = groqResponse.body!.getReader();

        let buffer = "";

        try {
          while (true) {
            const { value, done } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, {
              stream: true,
            });

            const lines = buffer.split("\n");

            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();

              if (!trimmed.startsWith("data:")) {
                continue;
              }

              const data = trimmed
                .slice(5)
                .trim();

              if (!data || data === "[DONE]") {
                continue;
              }

              try {
                const parsed = JSON.parse(data);

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
            encoder.encode("data: [DONE]\n\n")
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