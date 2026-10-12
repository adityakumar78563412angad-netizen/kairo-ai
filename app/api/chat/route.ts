import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL =
  process.env.GROQ_CHAT_MODEL || "qwen/qwen3.8-27b";

const PRO_MODEL =
  process.env.GROQ_PRO_MODEL || "openai/gpt-oss-120b";

const MAX_MESSAGES = 60;
const MAX_TEXT_LENGTH = 100_000;
const MAX_IMAGES_PER_MESSAGE = 3;
const MAX_IMAGE_DATA_URL_LENGTH = 18 * 1024 * 1024;

type ChatPart =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: {
        url: string;
        detail?: "auto" | "low" | "high";
      };
    };

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string | ChatPart[];
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function jsonError(
  message: string,
  status = 400,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    { success: false, error: message, ...extra },
    { status }
  );
}

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function validImageUrl(value: string) {
  if (
    /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/i.test(
      value
    )
  ) {
    return value.length <= MAX_IMAGE_DATA_URL_LENGTH;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function normalizeMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null;

  const role = value.role;

  if (
    role !== "user" &&
    role !== "assistant" &&
    role !== "system"
  ) {
    return null;
  }

  const content = value.content;

  if (typeof content === "string") {
    if (
      !content.trim() ||
      content.length > MAX_TEXT_LENGTH
    ) {
      return null;
    }

    return { role, content };
  }

  if (!Array.isArray(content) || !content.length) {
    return null;
  }

  const parts: ChatPart[] = [];
  let textLength = 0;
  let imageCount = 0;

  for (const part of content) {
    if (!isRecord(part)) return null;

    if (part.type === "text") {
      if (typeof part.text !== "string") {
        return null;
      }

      textLength += part.text.length;

      if (textLength > MAX_TEXT_LENGTH) {
        return null;
      }

      parts.push({
        type: "text",
        text: part.text,
      });

      continue;
    }

    if (part.type === "image_url") {
      if (
        role !== "user" ||
        !isRecord(part.image_url) ||
        typeof part.image_url.url !== "string"
      ) {
        return null;
      }

      const url = part.image_url.url.trim();

      if (
        !validImageUrl(url) ||
        ++imageCount > MAX_IMAGES_PER_MESSAGE
      ) {
        return null;
      }

      const detail = part.image_url.detail;

      parts.push({
        type: "image_url",
        image_url: {
          url,
          detail:
            detail === "low" ||
            detail === "high"
              ? detail
              : "auto",
        },
      });

      continue;
    }

    return null;
  }

  if (
    !parts.some(
      (part) =>
        part.type === "image_url" ||
        (part.type === "text" && part.text.trim())
    )
  ) {
    return null;
  }

  return {
    role,
    content: parts,
  };
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
      const { data, error } =
        await supabase.auth.getUser(token);

      if (data.user) {
        return data.user;
      }

      if (error) {
        console.error(
          "Chat bearer auth error:",
          error.message
        );
      }
    }
  }

  const { data, error } =
    await supabase.auth.getUser();

  if (error) {
    console.error(
      "Chat cookie auth error:",
      error.message
    );
  }

  return data.user ?? null;
}

async function ensureGuestCredits(
  supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  >,
  anonymous: boolean
) {
  if (!anonymous) return;

  const { data, error } =
    await supabase.rpc(
      "setup_guest_chat_credits"
    );

  if (
    error ||
    (isRecord(data) && data.success === false)
  ) {
    console.error(
      "Guest credit initialization failed:",
      error?.message ?? data
    );

    throw new Error(
      "Chat credits could not be initialized."
    );
  }
}

async function consumeChatCredit(
  supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  >
) {
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
      "Chat credit consumption failed:",
      error.message
    );

    throw new Error(
      "Unable to use Chat Credit right now."
    );
  }

  if (
    !isRecord(data) ||
    data.success !== true
  ) {
    if (
      isRecord(data) &&
      data.error === "INSUFFICIENT_CREDITS"
    ) {
      throw new Error(
        "You don't have enough Chat Credits."
      );
    }

    throw new Error(
      "Unable to use Chat Credit right now."
    );
  }

  return data as {
    success: true;
    balance: number;
    total_used: number;
  };
}

/* =========================================================
   IMAGE INTENT HELPERS
   ========================================================= */

function getLastUserText(
  messages: ChatMessage[]
) {
  const lastUserMessage = [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === "user"
    );

  if (!lastUserMessage) {
    return "";
  }

  if (
    typeof lastUserMessage.content ===
    "string"
  ) {
    return lastUserMessage.content;
  }

  return lastUserMessage.content
    .filter(
      (
        part
      ): part is {
        type: "text";
        text: string;
      } => part.type === "text"
    )
    .map(
      (part) => part.text
    )
    .join(" ");
}

function hasAttachedImage(
  messages: ChatMessage[]
) {
  const lastUserMessage = [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === "user"
    );

  if (!lastUserMessage) {
    return false;
  }

  if (
    typeof lastUserMessage.content ===
    "string"
  ) {
    return false;
  }

  return lastUserMessage.content.some(
    (part) =>
      part.type === "image_url"
  );
}

/* =========================================================
   GROQ IMAGE INTENT DETECTION
   ========================================================= */

async function detectImageGenerationIntent(
  text: string,
  apiKey: string
): Promise<boolean> {
  if (!text.trim()) {
    return false;
  }

  try {
    const response = await fetch(
      GROQ_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model:
            process.env.GROQ_CHAT_MODEL ||
            "qwen/qwen3.8-27b",
          messages: [
            {
              role: "system",
              content:
                "You are ZUQEN AI's image-generation intent detector. " +
                "Return ONLY YES or NO. " +
                "Return YES when the user wants you to CREATE, GENERATE, DRAW, MAKE, PAINT, DESIGN or PRODUCE an actual new image, picture, photo, illustration, wallpaper, poster, logo or other visual. " +
                "Return NO when the user is only asking about an existing image, analyzing an image, describing an image, asking what an image looks like, or asking a normal text question. " +
                "If the user asks to make something visual in any language, return YES.",
            },
            {
              role: "user",
              content: text.slice(0, 4000),
            },
          ],
          temperature: 0,
          max_tokens: 3,
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      console.error(
        "Groq image intent detection failed:",
        response.status
      );

      return false;
    }

    const data: unknown =
      await response.json().catch(
        () => null
      );

    if (
      !isRecord(data) ||
      !Array.isArray(data.choices) ||
      !data.choices.length
    ) {
      return false;
    }

    const firstChoice =
      data.choices[0];

    if (!isRecord(firstChoice)) {
      return false;
    }

    const message =
      firstChoice.message;

    if (!isRecord(message)) {
      return false;
    }

    const content =
      typeof message.content ===
      "string"
        ? message.content
            .trim()
            .toUpperCase()
        : "";

    return content === "YES";
  } catch (error) {
    console.error(
      "Groq image intent detection error:",
      error
    );

    return false;
  }
}

/* =========================================================
   CLOUDFLARE IMAGE GENERATION
   ========================================================= */

async function generateImageThroughCloudflare(
  request: NextRequest,
  prompt: string
) {
  const cookie =
    request.headers.get("cookie");

  let imageResponse: Response;

  try {
    imageResponse =
      await fetch(
        new URL(
          "/api/image-generator",
          request.url
        ),
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            ...(cookie
              ? { cookie }
              : {}),
          },
          body: JSON.stringify({
            prompt:
              prompt.slice(0, 1000),
          }),
          cache: "no-store",
        }
      );
  } catch (error) {
    console.error(
      "Cloudflare image route connection failed:",
      error
    );

    return jsonError(
      "Could not connect to the image-generation service.",
      502
    );
  }

  const imageData: unknown =
    await imageResponse
      .json()
      .catch(() => null);

  if (
    !imageResponse.ok ||
    !isRecord(imageData) ||
    imageData.success !== true ||
    typeof imageData.image !==
      "string"
  ) {
    const errorMessage =
      isRecord(imageData) &&
      typeof imageData.error ===
        "string"
        ? imageData.error
        : `Image generation failed (${imageResponse.status}).`;

    return jsonError(
      errorMessage,
      imageResponse.ok
        ? 502
        : imageResponse.status
    );
  }

  const encoder =
    new TextEncoder();

  const stream =
    new ReadableStream<
      Uint8Array
    >({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            sse({
              content:
                "![Image generated by ZUQEN AI](" +
                imageData.image +
                ")",
            })
          )
        );

        controller.enqueue(
          encoder.encode(
            "data: [DONE]\n\n"
          )
        );

        controller.close();
      },
    });

  return new Response(
    stream,
    {
      status: 200,
      headers: {
        "Content-Type":
          "text/event-stream; charset=utf-8",
        "Cache-Control":
          "no-cache, no-transform",
        Connection:
          "keep-alive",
      },
    }
  );
}

/* =========================================================
   MAIN CHAT ROUTE
   ========================================================= */

export async function POST(
  request: NextRequest
) {
  let timeout:
    | ReturnType<typeof setTimeout>
    | undefined;

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

    let body: unknown;

    try {
      body =
        await request.json();
    } catch {
      return jsonError(
        "Invalid request body.",
        400
      );
    }

    if (!isRecord(body)) {
      return jsonError(
        "Invalid request body.",
        400
      );
    }

    let rawMessages: unknown[] =
      [];

    if (
      Array.isArray(body.messages)
    ) {
      rawMessages =
        body.messages;
    } else if (
      typeof body.message ===
        "string" &&
      body.message.trim()
    ) {
      rawMessages = [
        {
          role: "user",
          content:
            body.message.trim(),
        },
      ];
    }

    if (
      !rawMessages.length ||
      rawMessages.length >
        MAX_MESSAGES
    ) {
      return jsonError(
        `Send between 1 and ${MAX_MESSAGES} messages.`,
        400
      );
    }

    const messages =
      rawMessages.map(
        normalizeMessage
      );

    const validMessages =
      messages.filter(
        (
          message
        ): message is ChatMessage =>
          message !== null
      );

    if (
      validMessages.length !==
      rawMessages.length
    ) {
      return jsonError(
        "One or more messages are invalid. Check text and image inputs.",
        400
      );
    }

    if (
      !validMessages.some(
        (message) =>
          message.role === "user"
      )
    ) {
      return jsonError(
        "A user message is required.",
        400
      );
    }

    /* =====================================================
       GROQ API KEY
       ===================================================== */

    const apiKey =
      process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error(
        "GROQ_API_KEY is missing."
      );

      return jsonError(
        "ZUQEN AI is not configured correctly.",
        500
      );
    }

    /* =====================================================
       IMAGE REQUEST DETECTION
       ===================================================== */

    const lastUserText =
      getLastUserText(
        validMessages
      );

    const attachedImage =
      hasAttachedImage(
        validMessages
      );

    /*
     * If the user attached an image,
     * this is an image-understanding
     * request and must stay on Groq chat.
     */
    const wantsImage =
      !attachedImage &&
      (await detectImageGenerationIntent(
        lastUserText,
        apiKey
      ));

    /*
     * User wants an actual NEW image.
     * Groq detected the intent.
     * Cloudflare FLUX performs the generation.
     */
    if (wantsImage) {
      return generateImageThroughCloudflare(
        request,
        lastUserText
      );
    }

    /* =====================================================
       MODEL SELECTION
       ===================================================== */

    const requestedModel =
      body.model;

    if (
      requestedModel !== undefined &&
      typeof requestedModel !==
        "string"
    ) {
      return jsonError(
        "Invalid model selection.",
        400
      );
    }

    /*
     * Existing ZUQEN model selector is preserved.
     *
     * qwen/qwen3.8-27b
     *      ↓
     * GROQ_CHAT_MODEL
     *
     * openai/gpt-oss-120b
     *      ↓
     * GROQ_PRO_MODEL
     */
    const isPro =
      requestedModel ===
        "openai/gpt-oss-120b" ||
      requestedModel ===
        "zuqen-pro";

    const providerModel =
      isPro
        ? PRO_MODEL
        : DEFAULT_MODEL;

    /* =====================================================
       CHAT CREDIT CHECK
       ===================================================== */

    const {
      data: wallet,
      error: walletError,
    } = await supabase
      .from(
        "feature_credit_balances"
      )
      .select(
        "user_id,feature_key,balance,total_granted,total_used"
      )
      .eq(
        "user_id",
        user.id
      )
      .eq(
        "feature_key",
        "chat"
      )
      .maybeSingle();

    if (walletError) {
      console.error(
        "Chat credit lookup failed:",
        walletError.message
      );

      return jsonError(
        "Unable to check your Chat Credits.",
        500
      );
    }

    if (!wallet) {
      return jsonError(
        "Your Chat Credit wallet is not available.",
        403
      );
    }

    if (
      Number(wallet.balance) <
      1
    ) {
      return jsonError(
        "You don't have enough Chat Credits.",
        402,
        {
          errorCode:
            "INSUFFICIENT_CREDITS",
          balance:
            Number(wallet.balance),
        }
      );
    }

    /* =====================================================
       GROQ REQUEST
       ===================================================== */

    const abortController =
      new AbortController();

    timeout =
      setTimeout(
        () =>
          abortController.abort(),
        110_000
      );

    let upstream: Response;

    try {
      upstream =
        await fetch(
          GROQ_URL,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model:
                providerModel,
              messages: [
                {
                  role: "system",
                  content:
                    "You are ZUQEN AI, an integrated AI assistant. " +
                    "Identify yourself as ZUQEN AI, not as an underlying provider. " +
                    "Respond in the user's language. " +
                    "Be helpful, accurate, and honest. " +
                    "When a user supplies an image, inspect it and answer their question about it. " +
                    "Never claim an image or video was generated unless it actually succeeded.",
                },
                ...validMessages.filter(
                  (message) =>
                    message.role !==
                    "system"
                ),
              ],
              stream: true,
              temperature: 0.7,
            }),
            signal:
              abortController.signal,
          }
        );
    } catch (error) {
      clearTimeout(timeout);

      console.error(
        "Groq connection error:",
        error
      );

      return jsonError(
        "ZUQEN AI could not connect to its AI provider.",
        502
      );
    }

    /* =====================================================
       GROQ ERROR HANDLING
       ===================================================== */

    if (!upstream.ok) {
      const status =
        upstream.status;

      let detail = "";

      try {
        const data: unknown =
          await upstream.json();

        if (
          isRecord(data) &&
          isRecord(data.error) &&
          typeof data.error.message ===
            "string"
        ) {
          detail =
            data.error.message;
        }
      } catch {
        // Provider did not return JSON.
      }

      console.error(
        "Groq upstream failure:",
        {
          status,
          model:
            providerModel,
          detail,
        }
      );

      clearTimeout(timeout);

      return jsonError(
        status === 404
          ? `Groq model '${providerModel}' was not found or is unavailable.`
          : status === 429
            ? "ZUQEN AI is busy right now. Please try again shortly."
            : status === 401 ||
                status === 403
              ? "ZUQEN AI could not authenticate with its AI provider. Check GROQ_API_KEY."
              : "ZUQEN AI could not generate a response. Check Vercel Runtime Logs for the Groq provider error.",
        502,
        {
          errorCode:
            "GROQ_UPSTREAM_ERROR",
        }
      );
    }

    if (!upstream.body) {
      clearTimeout(timeout);

      return jsonError(
        "ZUQEN AI response stream is unavailable.",
        502
      );
    }

    /* =====================================================
       CONSUME CHAT CREDIT
       ===================================================== */

    let creditResult: {
      success: true;
      balance: number;
      total_used: number;
    };

    try {
      creditResult =
        await consumeChatCredit(
          supabase
        );
    } catch (error) {
      clearTimeout(timeout);

      try {
        await upstream.body.cancel();
      } catch {
        // Stream may already be closed.
      }

      return jsonError(
        error instanceof Error
          ? error.message
          : "Unable to use Chat Credit right now.",
        402
      );
    }

    /* =====================================================
       GROQ STREAM
       ===================================================== */

    const reader =
      upstream.body.getReader();

    const encoder =
      new TextEncoder();

    const decoder =
      new TextDecoder();

    const stream =
      new ReadableStream<
        Uint8Array
      >({
        async start(
          controller
        ) {
          let buffer = "";
          let closed = false;

          const send = (
            data: unknown
          ) => {
            if (!closed) {
              controller.enqueue(
                encoder.encode(
                  sse(data)
                )
              );
            }
          };

          const close = () => {
            if (closed) {
              return;
            }

            closed = true;

            if (timeout) {
              clearTimeout(
                timeout
              );
            }

            controller.close();
          };

          const processLine = (
            rawLine: string
          ) => {
            const line =
              rawLine.trim();

            if (
              !line.startsWith(
                "data:"
              )
            ) {
              return;
            }

            const data =
              line
                .slice(5)
                .trim();

            if (
              !data ||
              data === "[DONE]"
            ) {
              return;
            }

            try {
              const parsed: unknown =
                JSON.parse(data);

              if (
                !isRecord(
                  parsed
                )
              ) {
                return;
              }

              if (
                parsed.error
              ) {
                send({
                  error:
                    "ZUQEN AI could not finish the response.",
                });

                return;
              }

              if (
                !Array.isArray(
                  parsed.choices
                ) ||
                !parsed.choices.length ||
                !isRecord(
                  parsed.choices[0]
                ) ||
                !isRecord(
                  parsed
                    .choices[0]
                    .delta
                )
              ) {
                return;
              }

              const content =
                parsed
                  .choices[0]
                  .delta
                  .content;

              if (
                typeof content ===
                  "string" &&
                content.length
              ) {
                send({
                  content,
                });
              }
            } catch {
              /*
               * Ignore malformed partial
               * SSE frames.
               */
            }
          };

          try {
            while (true) {
              const {
                value,
                done,
              } =
                await reader.read();

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
                buffer.split(
                  "\n"
                );

              buffer =
                lines.pop() ||
                "";

              for (
                const line of lines
              ) {
                processLine(line);
              }
            }

            buffer +=
              decoder.decode();

            if (
              buffer.trim()
            ) {
              processLine(
                buffer
              );
            }

            close();
          } catch (error) {
            console.error(
              "Groq chat stream error:",
              error
            );

            send({
              error:
                "ZUQEN AI response stream failed.",
            });

            close();
          } finally {
            if (timeout) {
              clearTimeout(
                timeout
              );
            }

            try {
              reader.releaseLock();
            } catch {
              // Stream already closed.
            }
          }
        },

        async cancel() {
          if (timeout) {
            clearTimeout(
              timeout
            );
          }

          try {
            await reader.cancel();
          } catch {
            // Browser may have disconnected.
          }
        },
      });

    return new Response(
      stream,
      {
        status: 200,
        headers: {
          "Content-Type":
            "text/event-stream; charset=utf-8",
          "Cache-Control":
            "no-cache, no-transform",
          Connection:
            "keep-alive",
          "X-ZUQEN-Chat-Credit-Balance":
            String(
              creditResult.balance
            ),
        },
      }
    );
  } catch (error) {
    if (timeout) {
      clearTimeout(timeout);
    }

    console.error(
      "POST /api/chat failed:",
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