
import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  getFeatureCreditBalance,
  consumeFeatureCredits,
} from "@/lib/feature-credits";
import { recordProviderUsage } from "@/lib/provider-usage";
import { syncGroqQuotaFromHeaders } from "@/lib/provider-quota";

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

type GroqUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_time?: number;
  completion_time?: number;
  queue_time?: number;
  total_time?: number;
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

async function getB2SignedUrl(
  key: string
) {
  const applicationKeyId =
    process.env.B2_APPLICATION_KEY_ID?.trim();

  const applicationKey =
    process.env.B2_APPLICATION_KEY?.trim();

  const bucketName =
    process.env.B2_BUCKET_NAME?.trim();

  const endpoint =
    process.env.B2_S3_ENDPOINT?.trim();

  if (
    !applicationKeyId ||
    !applicationKey ||
    !bucketName ||
    !endpoint
  ) {
    throw new Error(
      "Backblaze B2 environment variables are missing."
    );
  }

  const regionMatch =
    endpoint.match(
      /s3\.([a-z0-9-]+)\.backblazeb2\.com/i
    );

  const region =
    regionMatch?.[1] ||
    "us-east-005";

  const s3 =
    new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId:
          applicationKeyId,
        secretAccessKey:
          applicationKey,
      },
    });

  const command =
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

  return await getSignedUrl(
    s3,
    command,
    {
      expiresIn: 600,
    }
  );
}

async function imageToDataUrl(
  attachment: Attachment
) {
  if (!attachment.key) {
    throw new Error(
      `No storage key was found for "${
        attachment.name || "image"
      }".`
    );
  }

  const signedUrl =
    await getB2SignedUrl(
      attachment.key
    );

  const response =
    await fetch(
      signedUrl,
      {
        method: "GET",
        cache: "no-store",
      }
    );

  if (!response.ok) {
    throw new Error(
      `ZUQEN could not download the image from Backblaze B2. HTTP ${response.status}.`
    );
  }

  const contentType =
    response.headers.get(
      "content-type"
    ) ||
    attachment.type ||
    "image/jpeg";

  if (
    !contentType
      .toLowerCase()
      .startsWith("image/")
  ) {
    throw new Error(
      `Backblaze returned "${contentType}" instead of an image.`
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  const maxSize =
    20 * 1024 * 1024;

  if (
    arrayBuffer.byteLength >
    maxSize
  ) {
    throw new Error(
      "The image is larger than 20 MB."
    );
  }

  const base64 =
    Buffer.from(
      arrayBuffer
    ).toString("base64");

  return `data:${contentType};base64,${base64}`;
}

function getGroqQuotaHeaders(
  groqResponse: Response
) {
  const quotaHeaders: Record<
    string,
    string
  > = {};

  const headersToRead = [
    "x-ratelimit-limit-requests",
    "x-ratelimit-remaining-requests",
    "x-ratelimit-reset-requests",
    "x-ratelimit-limit-tokens",
    "x-ratelimit-remaining-tokens",
    "x-ratelimit-reset-tokens",
    "retry-after",
  ];

  for (
    const headerName of headersToRead
  ) {
    const value =
      groqResponse.headers.get(
        headerName
      );

    if (value) {
      quotaHeaders[
        `X-Zuquen-Groq-${headerName}`
      ] = value;
    }
  }

  return quotaHeaders;
}

function toSafeNumber(
  value: unknown
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(value)
  );
}

function jsonError(
  error: string,
  code: string,
  status: number,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    {
      success: false,
      error,
      code,
      ...extra,
    },
    {
      status,
    }
  );
}

export async function POST(
  req: Request
) {
  let userId:
    | string
    | null = null;

  let chatReferenceId:
    | string
    | null = null;

  try {
    // =====================================================
    // 1. AUTH
    // =====================================================

    const supabase =
      await createServerSupabaseClient();

    const {
      data: {
        user,
      },
      error: authError,
    } =
      await supabase.auth.getUser();

    if (
      authError ||
      !user
    ) {
      console.error(
        "ZUQEN AUTH ERROR:",
        authError
      );

      return jsonError(
        "Your ZUQEN session is not available. Please refresh the page and try again.",
        "UNAUTHENTICATED",
        401
      );
    }

    userId =
      user.id;

    // =====================================================
    // 2. CHECK CHAT CREDIT BALANCE
    // =====================================================

    let currentChatCredits =
      0;

    try {
      currentChatCredits =
        await getFeatureCreditBalance(
          userId,
          "chat"
        );
    } catch (error) {
      console.error(
        "ZUQEN CREDIT BALANCE ERROR:",
        error
      );

      return jsonError(
        "Unable to check your Chat credits.",
        "CREDIT_BALANCE_ERROR",
        500
      );
    }

    // One message always requires exactly 1 credit.
    if (
      currentChatCredits < 1
    ) {
      return jsonError(
        "Your ZUQEN Chat credits are 0. Please add Chat credits before sending a message.",
        "INSUFFICIENT_CREDITS",
        402,
        {
          feature: "chat",
          creditBalance: 0,
          creditPerMessage: 1,
        }
      );
    }

    // =====================================================
    // 3. PARSE REQUEST
    // =====================================================

    let body: any;

    try {
      body =
        await req.json();
    } catch {
      return jsonError(
        "Invalid request body.",
        "INVALID_JSON",
        400
      );
    }

    const rawMessages =
      Array.isArray(
        body?.messages
      )
        ? body.messages
        : [];

    const messages:
      InputMessage[] =
      rawMessages
        .filter(
          (message: any) =>
            (
              message?.role ===
                "user" ||
              message?.role ===
                "assistant"
            ) &&
            typeof message?.content ===
              "string"
        )
        .map(
          (message: any) => ({
            role:
              message.role,
            content:
              message.content.trim(),
          })
        )
        .filter(
          (
            message: InputMessage
          ) =>
            message.content
              .length > 0
        );

    const attachments:
      Attachment[] =
      Array.isArray(
        body?.attachments
      )
        ? body.attachments.filter(
            (attachment: any) =>
              attachment &&
              typeof attachment ===
                "object"
          )
        : [];

    if (
      messages.length === 0 &&
      attachments.length === 0
    ) {
      return jsonError(
        "No message or attachment was provided.",
        "EMPTY_REQUEST",
        400
      );
    }

    // =====================================================
    // 4. IMAGE CHECK
    // =====================================================

    const imageAttachments =
      attachments.filter(
        isImageAttachment
      );

    const hasImages =
      imageAttachments.length >
      0;

    // =====================================================
    // 5. MODEL
    // =====================================================

    const model =
      hasImages
        ? "qwen/qwen3.6-27b"
        : "openai/gpt-oss-120b";

    chatReferenceId =
      `chat-${crypto.randomUUID()}`;

    // =====================================================
    // 6. GROQ API KEY
    // =====================================================

    const apiKey =
      process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      return jsonError(
        "GROQ_API_KEY is missing from the server environment.",
        "GROQ_API_KEY_MISSING",
        500
      );
    }

    // =====================================================
    // 7. SYSTEM PROMPT
    // =====================================================

    const systemPrompt = `
You are ZUQEN, a helpful, intelligent, friendly and natural AI assistant.

RESPONSE LENGTH:
- Match the answer length to the user's question.
- Simple questions should receive short answers.
- Do not add unnecessary introductions or conclusions.
- Give detailed answers when the user asks for detail.

LANGUAGE:
- Hindi user -> Hindi.
- Hinglish user -> natural Hinglish.
- English user -> English.
- Match the user's tone.

IMAGE UNDERSTANDING:
- When an image is attached, analyze the actual image.
- Never claim that you cannot see a valid attached image.
- Do not invent details that are not visible.
- If something is unclear, say that it is unclear.

Be accurate, natural and concise.
`;

    // =====================================================
    // 8. BUILD GROQ MESSAGES
    // =====================================================

    let groqMessages:
      any[] = [];

    try {
      if (hasImages) {
        const imageParts:
          any[] = [];

        for (
          const attachment of imageAttachments
        ) {
          const dataUrl =
            await imageToDataUrl(
              attachment
            );

          imageParts.push({
            type:
              "image_url",

            image_url: {
              url:
                dataUrl,
            },
          });
        }

        const previousMessages =
          messages.slice(
            0,
            -1
          );

        const lastMessage =
          messages.length > 0
            ? messages[
                messages.length - 1
              ]
            : null;

        const userText =
          lastMessage?.role ===
          "user"
            ? lastMessage.content
            : "Please analyze the attached image.";

        groqMessages = [
          {
            role:
              "system",
            content:
              systemPrompt,
          },

          ...previousMessages.map(
            (message) => ({
              role:
                message.role,
              content:
                message.content,
            })
          ),

          {
            role:
              "user",

            content: [
              {
                type:
                  "text",

                text:
                  userText ||
                  "Please analyze the attached image.",
              },

              ...imageParts,
            ],
          },
        ];
      } else {
        groqMessages = [
          {
            role:
              "system",
            content:
              systemPrompt,
          },

          ...messages.map(
            (message) => ({
              role:
                message.role,
              content:
                message.content,
            })
          ),
        ];
      }
    } catch (error) {
      console.error(
        "ZUQEN MESSAGE PREPARATION ERROR:",
        error
      );

      return jsonError(
        error instanceof Error
          ? error.message
          : "Failed to prepare the Chat request.",
        "MESSAGE_BUILD_FAILED",
        500
      );
    }

    // =====================================================
    // 9. CALL GROQ
    // =====================================================

    let groqResponse:
      Response;

    try {
      groqResponse =
        await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${apiKey}`,
            },

            body:
              JSON.stringify({
                model,

                messages:
                  groqMessages,

                temperature:
                  hasImages
                    ? 0.4
                    : 0.5,

                max_completion_tokens:
                  2048,

                stream:
                  true,

                stream_options: {
                  include_usage:
                    true,
                },
              }),

            cache:
              "no-store",
          }
        );
    } catch (error) {
      console.error(
        "ZUQEN GROQ NETWORK ERROR:",
        error
      );

      return jsonError(
        error instanceof Error
          ? error.message
          : "Unable to connect to Groq.",
        "GROQ_NETWORK_ERROR",
        502,
        {
          provider:
            "groq",
          creditBalance:
            currentChatCredits,
        }
      );
    }

    // =====================================================
    // 10. GROQ QUOTA
    // =====================================================

    const groqQuotaHeaders =
      getGroqQuotaHeaders(
        groqResponse
      );

    try {
      await syncGroqQuotaFromHeaders(
        groqResponse.headers
      );
    } catch (error) {
      console.warn(
        "ZUQEN GROQ QUOTA SYNC ERROR:",
        error
      );
    }

    // =====================================================
    // 11. GROQ ERROR
    // =====================================================

    if (
      !groqResponse.ok
    ) {
      const errorText =
        await groqResponse.text();

      console.error(
        "ZUQEN GROQ HTTP ERROR:",
        {
          status:
            groqResponse.status,
          body:
            errorText,
        }
      );

      let message =
        errorText ||
        "Groq request failed.";

      try {
        const parsed =
          JSON.parse(
            errorText
          );

        message =
          parsed?.error?.message ||
          parsed?.error ||
          message;
      } catch {
        // Keep original message.
      }

      return jsonError(
        `Groq request failed: ${message}`,
        "GROQ_REQUEST_FAILED",
        groqResponse.status,
        {
          provider:
            "groq",
          creditBalance:
            currentChatCredits,
          groqQuota:
            groqQuotaHeaders,
        }
      );
    }

    if (
      !groqResponse.body
    ) {
      return jsonError(
        "The AI provider returned an empty response.",
        "GROQ_EMPTY_RESPONSE",
        502,
        {
          provider:
            "groq",
          creditBalance:
            currentChatCredits,
        }
      );
    }

    // =====================================================
    // 12. STREAM RESPONSE
    // =====================================================

    const encoder =
      new TextEncoder();

    const decoder =
      new TextDecoder();

    const stream =
      new ReadableStream({
        async start(
          controller
        ) {
          const reader =
            groqResponse.body!.getReader();

          let buffer =
            "";

          let groqUsage:
            GroqUsage | null =
            null;

          let groqRequestId:
            string | null =
            null;

          let streamClosed =
            false;

          let responseText =
            "";

          function sendEvent(
            payload: unknown
          ) {
            if (
              streamClosed
            ) {
              return;
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify(
                  payload
                )}\n\n`
              )
            );
          }

          try {
            // =================================================
            // READ STREAM
            // =================================================

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
                    stream:
                      true,
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

                if (!data) {
                  continue;
                }

                if (
                  data ===
                  "[DONE]"
                ) {
                  continue;
                }

                try {
                  const parsed =
                    JSON.parse(
                      data
                    );

                  if (
                    typeof parsed?.id ===
                    "string"
                  ) {
                    groqRequestId =
                      parsed.id;
                  }

                  if (
                    parsed?.usage
                  ) {
                    groqUsage =
                      parsed.usage;
                  }

                  const text =
                    parsed
                      ?.choices?.[0]
                      ?.delta
                      ?.content;

                  if (
                    typeof text ===
                      "string" &&
                    text.length >
                      0
                  ) {
                    responseText +=
                      text;

                    sendEvent({
                      text,
                    });
                  }
                } catch (
                  parseError
                ) {
                  console.warn(
                    "ZUQEN STREAM JSON PARSE ERROR:",
                    parseError
                  );
                }
              }
            }

            // =================================================
            // 13. ACTUAL GROQ USAGE
            // =================================================

            const inputTokens =
              toSafeNumber(
                groqUsage?.prompt_tokens
              );

            const outputTokens =
              toSafeNumber(
                groqUsage?.completion_tokens
              );

            let totalTokens =
              toSafeNumber(
                groqUsage?.total_tokens
              );

            if (
              totalTokens <= 0 &&
              (
                inputTokens > 0 ||
                outputTokens > 0
              )
            ) {
              totalTokens =
                inputTokens +
                outputTokens;
            }

            // =================================================
            // IMPORTANT:
            //
            // GROQ TOKENS DO NOT DECIDE CHAT CREDITS.
            //
            // ONE SUCCESSFUL MESSAGE = ONE CREDIT.
            // =================================================

            const zuqenChatCreditsUsed =
              1;

            console.log(
              "ZUQEN CHAT USAGE:",
              {
                userId,
                groqRequestId,
                inputTokens,
                outputTokens,
                totalTokens,

                zuqenChatCreditsUsed:
                  1,

                creditRule:
                  "1 Chat Message = 1 ZUQEN Chat Credit",
              }
            );

            // =================================================
            // 14. RECORD PROVIDER USAGE
            // =================================================

            let usageRecord:
              any = null;

            try {
              usageRecord =
                await recordProviderUsage({
                  userId:
                    userId!,

                  featureKey:
                    "chat",

                  provider:
                    "groq",

                  model,

                  requestId:
                    groqRequestId,

                  status:
                    "success",

                  inputUnits:
                    inputTokens,

                  outputUnits:
                    outputTokens,

                  totalUnits:
                    totalTokens,

                  unitType:
                    "tokens",

                  metadata: {
                    hasImages,

                    imageCount:
                      imageAttachments.length,

                    groqUsage:
                      groqUsage ??
                      null,

                    groqQuota:
                      groqQuotaHeaders,

                    zuqenChatCreditsUsed:
                      1,

                    creditRule:
                      "1 Chat Message = 1 ZUQEN Chat Credit",
                  },
                });
            } catch (error) {
              console.error(
                "ZUQEN USAGE RECORD ERROR:",
                error
              );
            }

            // =================================================
            // 15. CONSUME EXACTLY 1 CREDIT
            // =================================================

            let creditConsumption:
              any = null;

            try {
              creditConsumption =
                await consumeFeatureCredits(
                  {
                    userId:
                      userId!,

                    featureKey:
                      "chat",

                    amount:
                      1,

                    providerRequestId:
                      groqRequestId,

                    description:
                      "ZUQEN Chat message",

                    referenceId:
                      usageRecord?.id ??
                      chatReferenceId,

                    metadata: {
                      model,

                      inputTokens,

                      outputTokens,

                      totalTokens,

                      messageCredit:
                        1,

                      creditRule:
                        "1 Chat Message = 1 ZUQEN Chat Credit",

                      hasImages,

                      imageCount:
                        imageAttachments.length,

                      groqUsage:
                        groqUsage ??
                        null,

                      groqQuota:
                        groqQuotaHeaders,
                    },
                  }
                );
            } catch (error) {
              console.error(
                "ZUQEN CREDIT CONSUMPTION ERROR:",
                error
              );

              creditConsumption =
                {
                  success:
                    false,

                  code:
                    "CONSUME_EXCEPTION",

                  message:
                    error instanceof
                    Error
                      ? error.message
                      : String(
                          error
                        ),
                };
            }

            // =================================================
            // 16. CREDIT RESULT
            // =================================================

            if (
              !creditConsumption?.success
            ) {
              console.error(
                "ZUQEN CREDIT CONSUMPTION FAILED:",
                creditConsumption
              );

              sendEvent({
                credits: {
                  feature:
                    "chat",

                  used:
                    0,

                  remaining:
                    currentChatCredits,

                  settled:
                    false,

                  creditRule:
                    "1 Chat Message = 1 ZUQEN Chat Credit",

                  error:
                    creditConsumption?.message ??
                    "Unable to consume Chat credit.",
                },

                usage: {
                  inputTokens,
                  outputTokens,
                  totalTokens,
                },

                provider:
                  "groq",

                groqQuota:
                  groqQuotaHeaders,
              });

              sendEvent({
                error:
                  "Your AI response was generated, but ZUQEN could not finalize the Chat credit usage.",
                code:
                  "CREDIT_CONSUMPTION_FAILED",
              });

              sendEvent({
                done:
                  true,
              });

              sendEvent(
                "[DONE]"
              );

              streamClosed =
                true;

              controller.close();

              return;
            }

            // =================================================
            // 17. GET LATEST BALANCE
            // =================================================

            let remainingCredits =
              Math.max(
                0,
                currentChatCredits -
                  1
              );

            try {
              const latestBalance =
                await getFeatureCreditBalance(
                  userId!,
                  "chat"
                );

              remainingCredits =
                Math.max(
                  0,
                  latestBalance
                );
            } catch (error) {
              console.warn(
                "ZUQEN FINAL BALANCE READ ERROR:",
                error
              );
            }

            // =================================================
            // 18. SEND CREDIT INFORMATION
            // =================================================

            sendEvent({
              usage: {
                inputTokens,
                outputTokens,
                totalTokens,
              },

              credits: {
                feature:
                  "chat",

                used:
                  1,

                remaining:
                  remainingCredits,

                settled:
                  true,

                creditRule:
                  "1 Chat Message = 1 ZUQEN Chat Credit",

                messagesRemaining:
                  remainingCredits,
              },

              provider:
                "groq",

              groqQuota:
                groqQuotaHeaders,
            });

            sendEvent({
              done:
                true,
            });

            sendEvent(
              "[DONE]"
            );

            streamClosed =
              true;

            controller.close();
          } catch (error) {
            console.error(
              "ZUQEN STREAM ERROR:",
              error
            );

            const errorMessage =
              error instanceof
              Error
                ? error.message
                : String(
                    error
                  );

            try {
              await recordProviderUsage({
                userId:
                  userId!,

                featureKey:
                  "chat",

                provider:
                  "groq",

                model,

                requestId:
                  groqRequestId,

                status:
                  "failed",

                inputUnits:
                  0,

                outputUnits:
                  0,

                totalUnits:
                  0,

                unitType:
                  "tokens",

                metadata: {
                  hasImages,

                  imageCount:
                    imageAttachments.length,

                  error:
                    errorMessage,

                  groqQuota:
                    groqQuotaHeaders,
                },
              });
            } catch (
              recordError
            ) {
              console.error(
                "ZUQEN FAILED USAGE RECORD ERROR:",
                recordError
              );
            }

            if (
              !streamClosed
            ) {
              try {
                sendEvent({
                  error:
                    `ZUQEN Chat stream failed: ${errorMessage}`,

                  code:
                    "STREAM_ERROR",
                });

                sendEvent({
                  credits: {
                    feature:
                      "chat",

                    used:
                      0,

                    remaining:
                      currentChatCredits,

                    settled:
                      false,
                  },

                  provider:
                    "groq",

                  groqQuota:
                    groqQuotaHeaders,
                });

                sendEvent({
                  done:
                    true,
                });

                sendEvent(
                  "[DONE]"
                );

                streamClosed =
                  true;

                controller.close();
              } catch (
                closeError
              ) {
                console.error(
                  "ZUQEN STREAM CLOSE ERROR:",
                  closeError
                );
              }
            }
          } finally {
            try {
              reader.releaseLock();
            } catch {
              // Ignore.
            }
          }
        },
      });

    // =====================================================
    // 19. RESPONSE HEADERS
    // =====================================================

    const responseHeaders =
      new Headers();

    responseHeaders.set(
      "Content-Type",
      "text/event-stream; charset=utf-8"
    );

    responseHeaders.set(
      "Cache-Control",
      "no-cache, no-transform"
    );

    responseHeaders.set(
      "Connection",
      "keep-alive"
    );

    responseHeaders.set(
      "X-Accel-Buffering",
      "no"
    );

    responseHeaders.set(
      "X-Zuquen-Provider",
      "groq"
    );

    responseHeaders.set(
      "X-Zuquen-Feature",
      "chat"
    );

    responseHeaders.set(
      "X-Zuquen-Feature-Credits",
      String(
        currentChatCredits
      )
    );

    responseHeaders.set(
      "X-Zuquen-Credit-Rate",
      "1 Chat Message = 1 ZUQEN Chat Credit"
    );

    responseHeaders.set(
      "X-Zuquen-Credit-Calculation",
      "1 successful Chat message = 1 credit"
    );

    for (
      const [
        headerName,
        headerValue,
      ] of Object.entries(
        groqQuotaHeaders
      )
    ) {
      responseHeaders.set(
        headerName,
        headerValue
      );
    }

    // =====================================================
    // 20. RETURN STREAM
    // =====================================================

    return new Response(
      stream,
      {
        status: 200,
        headers:
          responseHeaders,
      }
    );
  } catch (error) {
    console.error(
      "ZUQEN CHAT ROUTE FATAL ERROR:",
      error
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "ZUQEN Chat request failed.",
      "CHAT_ROUTE_ERROR",
      500
    );
  }
}
