import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL = "openai/gpt-oss-120b";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CreditRow = {
  user_id: string;
  feature_key: string;
  balance: number;
  total_granted: number;
  total_used: number;
};

type CreditResult = {
  success: true;
  balance: number;
  total_used: number;
};

function jsonError(
  message: string,
  status = 400,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...extra,
    },
    { status }
  );
}

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function getAuthenticatedUser(
  request: NextRequest,
  supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  >
) {
  const authorization =
    request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();

    if (token) {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (user) {
        return user;
      }

      if (error) {
        console.error(
          "Chat bearer authentication error:",
          error
        );
      }
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error(
      "Chat cookie authentication error:",
      error
    );
  }

  return user ?? null;
}

async function ensureGuestCredits(
  supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  >,
  isAnonymous: boolean
) {
  if (!isAnonymous) {
    return;
  }

  const { data, error } =
    await supabase.rpc(
      "setup_guest_chat_credits"
    );

  if (error) {
    console.error(
      "Guest chat credit setup error:",
      error
    );

    throw new Error(
      "Chat credits could not be initialized."
    );
  }

  if (
    data &&
    typeof data === "object" &&
    "success" in data &&
    (data as { success?: boolean }).success === false
  ) {
    throw new Error(
      "Chat credits could not be initialized."
    );
  }
}

async function consumeOneChatCredit(
  supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  >
): Promise<CreditResult> {
  const { data, error } =
    await supabase.rpc(
      "consume_feature_credit",
      {
        p_feature_key: "chat",
        p_amount: 1,
      }
    );

  if (error) {
    console.error(
      "Chat credit consumption error:",
      error
    );

    throw new Error(
      "Unable to use Chat Credit right now."
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    !("success" in data) ||
    (data as { success?: boolean }).success !== true
  ) {
    const result = data as
      | {
          success?: boolean;
          error?: string;
          balance?: number;
        }
      | null;

    if (
      result?.error ===
      "INSUFFICIENT_CREDITS"
    ) {
      throw new Error(
        "You don't have enough Chat Credits."
      );
    }

    throw new Error(
      "Unable to use Chat Credit right now."
    );
  }

  return data as CreditResult;
}

export async function POST(
  request: NextRequest
) {
  try {
    const supabase =
      await createServerSupabaseClient();

    const user =
      await getAuthenticatedUser(
        request,
        supabase
      );

    if (!user) {
      return jsonError(
        "Authentication required.",
        401
      );
    }

    await ensureGuestCredits(
      supabase,
      Boolean(user.is_anonymous)
    );

    const body = await request.json();

    const rawMessages = Array.isArray(
      body?.messages
    )
      ? body.messages
      : null;

    let messages: ChatMessage[] = [];

    if (rawMessages) {
      messages = rawMessages
        .filter(
          (
            message: unknown
          ): message is ChatMessage =>
            Boolean(
              message &&
                typeof message === "object" &&
                "role" in message &&
                "content" in message
            )
        )
        .map(
          (
            message: ChatMessage
          ): ChatMessage => ({
            role:
              message.role === "assistant"
                ? "assistant"
                : message.role === "system"
                ? "system"
                : "user",

            content:
              typeof message.content ===
              "string"
                ? message.content
                : String(
                    message.content ?? ""
                  ),
          })
        )
        .filter(
          (
            message: ChatMessage
          ): boolean =>
            message.content.trim().length > 0
        );
    } else if (
      typeof body?.message === "string" &&
      body.message.trim()
    ) {
      messages = [
        {
          role: "user",
          content: body.message.trim(),
        },
      ];
    }

    if (messages.length === 0) {
      return jsonError(
        "A chat message is required.",
        400
      );
    }

    const hasUserMessage =
      messages.some(
        (
          message: ChatMessage
        ): boolean =>
          message.role === "user" &&
          message.content.trim().length > 0
      );

    if (!hasUserMessage) {
      return jsonError(
        "A user message is required.",
        400
      );
    }

    const groqApiKey =
      process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      console.error(
        "GROQ_API_KEY is missing."
      );

      return jsonError(
        "ZUQEN AI is not configured correctly.",
        500
      );
    }

    const model =
      process.env.GROQ_CHAT_MODEL ||
      DEFAULT_MODEL;

    /*
     * Check credit balance before sending
     * the request to Groq.
     */
    const {
      data: creditRow,
      error: creditReadError,
    } = await supabase
      .from("feature_credit_balances")
      .select(
        "user_id,feature_key,balance,total_granted,total_used"
      )
      .eq("user_id", user.id)
      .eq("feature_key", "chat")
      .maybeSingle();

    if (creditReadError) {
      console.error(
        "Chat credit lookup error:",
        creditReadError
      );

      return jsonError(
        "Unable to check your Chat Credits.",
        500
      );
    }

    const wallet =
      creditRow as CreditRow | null;

    if (!wallet) {
      return jsonError(
        "Your Chat Credit wallet is not available.",
        403
      );
    }

    if (Number(wallet.balance) < 1) {
      return jsonError(
        "You don't have enough Chat Credits.",
        402,
        {
          errorCode:
            "INSUFFICIENT_CREDITS",
          balance: Number(wallet.balance),
        }
      );
    }

    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      120_000
    );

    let groqResponse: Response;

    try {
      groqResponse = await fetch(
        GROQ_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${groqApiKey}`,
          },

          body: JSON.stringify({
            model,
            messages,
            stream: true,
            temperature: 0.7,
          }),

          signal: controller.signal,
        }
      );
    } catch (error) {
      clearTimeout(timeout);

      console.error(
        "Groq request error:",
        error
      );

      return jsonError(
        "ZUQEN AI could not generate a response right now.",
        502
      );
    }

    clearTimeout(timeout);

    if (!groqResponse.ok) {
      let groqError =
        "ZUQEN AI could not generate a response right now.";

      try {
        const errorBody =
          await groqResponse.json();

        const providerMessage =
          errorBody?.error?.message;

        if (
          typeof providerMessage ===
          "string"
        ) {
          groqError =
            providerMessage;
        }

        console.error(
          "Groq API error:",
          errorBody
        );
      } catch {
        console.error(
          "Groq API error status:",
          groqResponse.status
        );
      }

      return jsonError(
        groqError,
        groqResponse.status >= 500
          ? 502
          : groqResponse.status
      );
    }

    if (!groqResponse.body) {
      return jsonError(
        "ZUQEN AI response stream is unavailable.",
        502
      );
    }

    /*
     * Groq successfully accepted the request.
     * Consume exactly ONE Chat Credit.
     *
     * 1 message = 1 credit.
     */
    let creditResult: CreditResult;

    try {
      creditResult =
        await consumeOneChatCredit(
          supabase
        );
    } catch (error) {
      console.error(
        "Could not consume Chat Credit:",
        error
      );

      return jsonError(
        error instanceof Error
          ? error.message
          : "Unable to use Chat Credit right now.",
        402
      );
    }

    const encoder =
      new TextEncoder();

    const decoder =
      new TextDecoder();

    const reader =
      groqResponse.body.getReader();

    const stream =
      new ReadableStream<Uint8Array>({
        async start(
          controller
        ) {
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

              for (
                const rawLine of lines
              ) {
                const line =
                  rawLine.trim();

                if (
                  !line ||
                  !line.startsWith(
                    "data:"
                  )
                ) {
                  continue;
                }

                const data =
                  line
                    .slice(5)
                    .trim();

                /*
                 * Groq sends [DONE] internally.
                 * Do NOT forward it to the frontend.
                 */
                if (
                  data === "[DONE]"
                ) {
                  continue;
                }

                try {
                  const parsed =
                    JSON.parse(data);

                  const content =
                    parsed?.choices?.[0]
                      ?.delta?.content;

                  if (
                    typeof content ===
                      "string" &&
                    content.length > 0
                  ) {
                    controller.enqueue(
                      encoder.encode(
                        sse({
                          content,
                        })
                      )
                    );
                  }
                } catch {
                  /*
                   * Ignore malformed provider
                   * chunks.
                   */
                }
              }
            }

            /*
             * Process the final buffered line.
             */
            const finalLine =
              buffer.trim();

            if (
              finalLine.startsWith(
                "data:"
              )
            ) {
              const data =
                finalLine
                  .slice(5)
                  .trim();

              /*
               * Never send [DONE] to the frontend.
               */
              if (
                data &&
                data !== "[DONE]"
              ) {
                try {
                  const parsed =
                    JSON.parse(data);

                  const content =
                    parsed?.choices?.[0]
                      ?.delta?.content;

                  if (
                    typeof content ===
                      "string" &&
                    content.length > 0
                  ) {
                    controller.enqueue(
                      encoder.encode(
                        sse({
                          content,
                        })
                      )
                    );
                  }
                } catch {
                  // Ignore malformed final chunk.
                }
              }
            }

            /*
             * Close the stream without sending
             * a visible [DONE] message.
             */
            controller.close();
          } catch (error) {
            console.error(
              "Chat stream error:",
              error
            );

            controller.enqueue(
              encoder.encode(
                sse({
                  error:
                    "ZUQEN AI response stream failed.",
                })
              )
            );

            controller.close();
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

        "X-ZUQEN-Chat-Credit-Balance":
          String(
            creditResult.balance
          ),
      },
    });
  } catch (error) {
    console.error(
      "POST /api/chat error:",
      error
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "ZUQEN AI could not generate a response right now.",
      500
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Method not allowed. Use POST.",
    },
    { status: 405 }
  );
}