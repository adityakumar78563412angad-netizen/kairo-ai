import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL = "qwen/qwen3.8-27b";

const MAX_MESSAGES = 60;
const MAX_TEXT_LENGTH = 100_000;
const MAX_IMAGES_PER_MESSAGE = 3;
const MAX_IMAGE_DATA_URL_LENGTH = 18 * 1024 * 1024;

type TextPart = {
  type: "text";
  text: string;
};

type ImagePart = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

type MessageContent = string | Array<TextPart | ImagePart>;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: MessageContent;
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

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isImageDataUrl(value: string) {
  return /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/i.test(
    value
  );
}

function isValidImageUrl(value: string) {
  if (isImageDataUrl(value)) {
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

function normalizeMessage(
  value: unknown
): ChatMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const role = value.role;

  if (
    role !== "user" &&
    role !== "assistant" &&
    role !== "system"
  ) {
    return null;
  }

  const content = value.content;

  // Backward compatibility with the existing text chat.
  if (typeof content === "string") {
    if (
      content.length > MAX_TEXT_LENGTH ||
      !content.trim()
    ) {
      return null;
    }

    return {
      role,
      content,
    };
  }

  // Multimodal content: text and image_url parts.
  if (!Array.isArray(content) || content.length === 0) {
    return null;
  }

  const parts: Array<TextPart | ImagePart> = [];
  let imageCount = 0;
  let textLength = 0;

  for (const item of content) {
    if (!isRecord(item) || typeof item.type !== "string") {
      return null;
    }

    if (item.type === "text") {
      if (typeof item.text !== "string") {
        return null;
      }

      textLength += item.text.length;

      if (textLength > MAX_TEXT_LENGTH) {
        return null;
      }

      parts.push({
        type: "text",
        text: item.text,
      });

      continue;
    }

    if (item.type === "image_url") {
      if (
        role !== "user" ||
        !isRecord(item.image_url) ||
        typeof item.image_url.url !== "string"
      ) {
        return null;
      }

      const url = item.image_url.url.trim();

      if (!isValidImageUrl(url)) {
        return null;
      }

      imageCount += 1;

      if (imageCount > MAX_IMAGES_PER_MESSAGE) {
        return null;
      }

      const detail = item.image_url.detail;

      parts.push({
        type: "image_url",
        image_url: {
          url,
          ...(detail === "low" || detail === "high"
            ? { detail }
            : { detail: "auto" }),
        },
      });

      continue;
    }

    // Reject unknown multimodal parts.
    return null;
  }

  const hasUsefulContent = parts.some((part) =>
    part.type === "text"
      ? part.text.trim().length > 0
      : true
  );

  if (!hasUsefulContent) {
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

  const { data, error } = await supabase.rpc(
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
    isRecord(data) &&
    data.success === false
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
  const { data, error } = await supabase.rpc(
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

  return data as unknown as CreditResult;
}

export async function POST(
  request: NextRequest
) {
  let groqResponse: Response | null = null;

  try {
    const supabase =
      await createServerSupabaseClient();

    const user = await getAuthenticatedUser(
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
      body = await request.json();
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

    let rawMessages: unknown[] = [];

    if (Array.isArray(body.messages)) {
      rawMessages = body.messages;
    } else if (
      typeof body.message === "string" &&
      body.message.trim()
    ) {
      rawMessages = [
        {
          role: "user",
          content: body.message.trim(),
        },
      ];
    }

    if (
      rawMessages.length === 0 ||
      rawMessages.length > MAX_MESSAGES
    ) {
      return jsonError(
        `Send between 1 and ${MAX_MESSAGES} messages.`,
        400
      );
    }

    const messages = rawMessages
      .map(normalizeMessage)
      .filter(
        (message): message is ChatMessage =>
          message !== null
      );

    if (messages.length !== rawMessages.length) {
      return jsonError(
        "One or more messages are invalid. Check text and image inputs.",
        400
      );
    }

    if (
      !messages.some(
        (message) => message.role === "user"
      )
    ) {
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

    // The Qwen vision model is the default.
    // GROQ_CHAT_MODEL can override it in server environment settings.
    const model =
      process.env.GROQ_CHAT_MODEL ||
      DEFAULT_MODEL;

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
          errorCode: "INSUFFICIENT_CREDITS",
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

    try {
      groqResponse = await fetch(
        GROQ_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqApiKey}`,
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

    if (!groqResponse.ok) {
      clearTimeout(timeout);

      let providerMessage =
        "ZUQEN AI could not generate a response right now.";

      try {
        const errorBody =
          await groqResponse.json();

        const message =
          errorBody?.error?.message;

        if (typeof message === "string") {
          // Log provider details for debugging.
          console.error(
            "Groq API error:",
            message
          );

          // Avoid exposing internal provider details
          // or account information to the browser.
          if (groqResponse.status === 429) {
            providerMessage =
              "Groq rate limit reached. Please wait and try again.";
          } else if (
            groqResponse.status === 401 ||
            groqResponse.status === 403
          ) {
            providerMessage =
              "Groq rejected the API credentials or model access.";
          } else if (
            groqResponse.status === 400
          ) {
            providerMessage =
              "Groq rejected this request. Check the model and image format.";
          }
        }
      } catch {
        console.error(
          "Groq API error status:",
          groqResponse.status
        );
      }

      return jsonError(
        providerMessage,
        groqResponse.status === 429
          ? 429
          : groqResponse.status >= 500
          ? 502
          : groqResponse.status
      );
    }

    if (!groqResponse.body) {
      clearTimeout(timeout);

      return jsonError(
        "ZUQEN AI response stream is unavailable.",
        502
      );
    }

    /*
     * Preserve the existing rule:
     * one accepted AI response consumes one Chat Credit.
     */
    let creditResult: CreditResult;

    try {
      creditResult =
        await consumeOneChatCredit(supabase);
    } catch (error) {
      clearTimeout(timeout);

      try {
        await groqResponse.body.cancel();
      } catch {
        // Nothing else to do if the upstream stream is closed.
      }

      return jsonError(
        error instanceof Error
          ? error.message
          : "Unable to use Chat Credit right now.",
        402
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = groqResponse.body.getReader();

    const stream = new ReadableStream<Uint8Array>({
      async start(streamController) {
        let buffer = "";
        let closed = false;

        const send = (data: unknown) => {
          if (closed) return;

          streamController.enqueue(
            encoder.encode(sse(data))
          );
        };

        const close = () => {
          if (closed) return;

          closed = true;
          clearTimeout(timeout);
          streamController.close();
        };

        const processLine = (rawLine: string) => {
          const line = rawLine.trim();

          if (!line || !line.startsWith("data:")) {
            return;
          }

          const data = line.slice(5).trim();

          if (!data || data === "[DONE]") {
            return;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed?.error) {
              send({
                error:
                  "ZUQEN AI could not finish the response.",
              });
              return;
            }

            const delta =
              parsed?.choices?.[0]?.delta;

            const content = delta?.content;

            if (
              typeof content === "string" &&
              content.length > 0
            ) {
              send({ content });
            }

            /*
             * Some model/provider chunks may include
             * non-text reasoning metadata. We intentionally
             * forward only user-visible text content.
             */
          } catch {
            // Ignore incomplete or malformed provider chunks.
          }
        };

        try {
          while (true) {
            const { value, done } =
              await reader.read();

            if (done) break;

            buffer += decoder.decode(
              value,
              { stream: true }
            );

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              processLine(line);
            }
          }

          buffer += decoder.decode();

          if (buffer.trim()) {
            processLine(buffer);
          }

          close();
        } catch (error) {
          console.error(
            "Chat stream error:",
            error
          );

          send({
            error:
              "ZUQEN AI response stream failed.",
          });

          close();
        } finally {
          clearTimeout(timeout);

          try {
            reader.releaseLock();
          } catch {
            // The stream may already have released its reader.
          }
        }
      },

      async cancel() {
        clearTimeout(timeout);

        try {
          await reader.cancel();
        } catch {
          // The client may already have disconnected.
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
          String(creditResult.balance),
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
      error: "Method not allowed. Use POST.",
    },
    { status: 405 }
  );
}