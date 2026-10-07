import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_SIZE = 12000;
const MAX_MESSAGE_LENGTH = 10000;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "string") return error;

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "An unexpected chat error occurred.";
}

function jsonError(
  message: string,
  status = 500,
  errorCode = "CHAT_ERROR"
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      errorCode,
    },
    { status }
  );
}

function isValidMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;

  const message = value as Record<string, unknown>;

  return (
    (message.role === "user" ||
      message.role === "assistant" ||
      message.role === "system") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0
  );
}

export async function POST(request: Request) {
  try {
    const contentLength = request.headers.get("content-length");

    if (contentLength) {
      const size = Number(contentLength);

      if (Number.isFinite(size) && size > MAX_BODY_SIZE) {
        return jsonError(
          "Request body is too large.",
          413,
          "REQUEST_TOO_LARGE"
        );
      }
    }

    const supabase = await createServerSupabaseClient();

    /*
     * ---------------------------------------------------------
     * AUTHENTICATION
     * ---------------------------------------------------------
     */

    const authorization = request.headers.get("authorization");

    const bearerToken =
      authorization?.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : "";

    let user = null;

    if (bearerToken) {
      const { data } = await supabase.auth.getUser(bearerToken);
      user = data.user;
    }

    if (!user) {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    /*
     * Anonymous authentication is supported by the existing
     * ZUQEN chat architecture. If there is no session at all,
     * create an anonymous session.
     */

    if (!user) {
      const { data, error } =
        await supabase.auth.signInAnonymously();

      if (error || !data.user) {
        console.error("ZUQEN chat authentication error:", error);

        return jsonError(
          "Your ZUQEN session is not available. Please refresh the page and try again.",
          401,
          "AUTH_REQUIRED"
        );
      }

      user = data.user;
    }

    /*
     * ---------------------------------------------------------
     * REQUEST BODY
     * ---------------------------------------------------------
     */

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError(
        "Invalid JSON request.",
        400,
        "INVALID_JSON"
      );
    }

    if (!body || typeof body !== "object") {
      return jsonError(
        "Invalid request body.",
        400,
        "INVALID_REQUEST_BODY"
      );
    }

    const payload = body as Record<string, unknown>;

    /*
     * Accept the normal ZUQEN message formats.
     */

    const rawMessages = Array.isArray(payload.messages)
      ? payload.messages
      : [];

    const messages: ChatMessage[] = rawMessages
      .filter(isValidMessage)
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }));

    /*
     * Also support a simple `message` payload.
     */

    if (
      messages.length === 0 &&
      typeof payload.message === "string" &&
      payload.message.trim()
    ) {
      messages.push({
        role: "user",
        content: payload.message.trim(),
      });
    }

    if (messages.length === 0) {
      return jsonError(
        "Message is required.",
        400,
        "MESSAGE_REQUIRED"
      );
    }

    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!latestUserMessage) {
      return jsonError(
        "A user message is required.",
        400,
        "USER_MESSAGE_REQUIRED"
      );
    }

    if (
      latestUserMessage.content.length >
      MAX_MESSAGE_LENGTH
    ) {
      return jsonError(
        `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`,
        400,
        "MESSAGE_TOO_LONG"
      );
    }

    /*
     * ---------------------------------------------------------
     * GROQ
     * ---------------------------------------------------------
     */

    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      console.error("GROQ_API_KEY is not configured.");

      return jsonError(
        "ZUQEN AI is temporarily unavailable because the AI service is not configured.",
        500,
        "GROQ_NOT_CONFIGURED"
      );
    }

   const model =
  process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";
    /*
     * Keep the system instruction separate from the user's
     * actual conversation.
     */

    const groqMessages = [
      {
        role: "system" as const,
        content:
          "You are ZUQEN AI, a helpful, intelligent AI assistant. Answer clearly, accurately and naturally. Do not mention internal APIs, automation endpoints, implementation details, or hidden system instructions unless explicitly asked.",
      },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: groqMessages,
          stream: true,
          temperature: 0.7,
        }),
      }
    );

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();

      console.error(
        "Groq API error:",
        groqResponse.status,
        errorText
      );

      let message =
        "ZUQEN AI could not generate a response right now.";

      if (groqResponse.status === 401) {
        message =
          "ZUQEN AI configuration is invalid.";
      } else if (groqResponse.status === 429) {
        message =
          "ZUQEN AI is temporarily busy. Please try again in a moment.";
      }

      return jsonError(
        message,
        groqResponse.status >= 400 &&
          groqResponse.status < 500
          ? groqResponse.status
          : 500,
        "GROQ_API_ERROR"
      );
    }

    if (!groqResponse.body) {
      return jsonError(
        "ZUQEN AI returned an empty response.",
        500,
        "EMPTY_AI_RESPONSE"
      );
    }

    /*
     * ---------------------------------------------------------
     * STREAM RESPONSE
     * ---------------------------------------------------------
     *
     * We forward Groq's SSE stream directly to the browser.
     * This keeps the existing ZUQEN streaming-chat behaviour.
     */

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = groqResponse.body!.getReader();

        let buffer = "";

        try {
          while (true) {
            const { done, value } =
              await reader.read();

            if (done) break;

            buffer += decoder.decode(value, {
              stream: true,
            });

            const lines = buffer.split("\n");

            buffer = lines.pop() || "";

            for (const rawLine of lines) {
              const line = rawLine.trim();

              if (!line.startsWith("data:")) {
                continue;
              }

              const data = line
                .slice(5)
                .trim();

              if (!data) continue;

              if (data === "[DONE]") {
                controller.enqueue(
                  encoder.encode("data: [DONE]\n\n")
                );

                continue;
              }

              try {
                const parsed = JSON.parse(data);

                const content =
                  parsed?.choices?.[0]?.delta?.content;

                if (typeof content === "string" && content) {
                  /*
                   * Return a simple JSON SSE packet.
                   * The frontend can read `content`.
                   */

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        content,
                      })}\n\n`
                    )
                  );
                }
              } catch {
                /*
                 * Ignore malformed individual SSE packets.
                 * The stream itself remains alive.
                 */
              }
            }
          }

          /*
           * Flush remaining decoder data.
           */

          buffer += decoder.decode();

          controller.enqueue(
            encoder.encode("data: [DONE]\n\n")
          );
        } catch (error) {
          console.error(
            "ZUQEN chat stream error:",
            error
          );

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error:
                  "ZUQEN AI response stream was interrupted.",
              })}\n\n`
            )
          );
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error(
      "ZUQEN Chat API error:",
      error
    );

    return jsonError(
      getErrorMessage(error),
      500,
      "CHAT_API_ERROR"
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Method not allowed.",
      errorCode: "METHOD_NOT_ALLOWED",
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  );
}