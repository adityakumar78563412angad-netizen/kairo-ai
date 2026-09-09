import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase-server";

import {
  getFeatureCreditBalance,
  reserveFeatureCredits,
  settleFeatureCreditReservation,
  refundFeatureCreditReservation,
} from "@/lib/feature-credits";

import { recordProviderUsage } from "@/lib/provider-usage";

import {
  syncGroqQuotaFromHeaders,
} from "@/lib/provider-quota";

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

async function getB2SignedUrl(key: string) {
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

  const regionMatch = endpoint.match(
    /s3\.([a-z0-9-]+)\.backblazeb2\.com/i
  );

  const region =
    regionMatch?.[1] || "us-east-005";

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: applicationKeyId,
      secretAccessKey: applicationKey,
    },
  });

  const command = new GetObjectCommand({
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

  console.log(
    "ZUQEN B2 KEY:",
    attachment.key
  );

  const signedUrl =
    await getB2SignedUrl(
      attachment.key
    );

  console.log(
    "ZUQEN B2 SIGNED URL CREATED"
  );

  const response = await fetch(
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

/**
 * Reads Groq's real rate-limit information
 * from the API response headers.
 */
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

/**
 * Estimate a safe maximum credit reservation.
 *
 * This is only a temporary upper-bound reservation.
 * The final charge always comes from Groq's real usage.
 */
function estimateChatReservation(
  messages: InputMessage[],
  hasImages: boolean
) {
  const textLength =
    messages.reduce(
      (total, message) =>
        total + message.content.length,
      0
    );

  /*
   * Roughly reserve enough credits for:
   * - conversation input
   * - system prompt
   * - maximum completion
   *
   * Image requests receive a larger safety reserve because
   * vision input can consume substantially more provider tokens.
   */
  const estimatedInputTokens =
    Math.ceil(textLength / 3) +
    600;

  const maximumCompletionTokens =
    2048;

  const imageSafetyReserve =
    hasImages ? 6000 : 0;

  return Math.max(
    1,
    estimatedInputTokens +
      maximumCompletionTokens +
      imageSafetyReserve
  );
}

export async function POST(
  req: Request
) {
  try {
    // =======================================================
    // 1. AUTHENTICATE USER
    // =======================================================

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
      return NextResponse.json(
        {
          success: false,
          error:
            "You must be logged in to use ZUQEN Chat.",
          code: "UNAUTHENTICATED",
        },
        {
          status: 401,
        }
      );
    }

    const userId =
      user.id;

    // =======================================================
    // 2. CHECK CHAT FEATURE CREDITS
    // =======================================================

    let currentChatCredits = 0;

    try {
      currentChatCredits =
        await getFeatureCreditBalance(
          userId,
          "chat"
        );
    } catch (error) {
      console.error(
        "ZUQEN CHAT CREDIT BALANCE ERROR:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to check Chat credits.",
          code:
            "CREDIT_BALANCE_ERROR",
          feature:
            "chat",
        },
        {
          status: 500,
        }
      );
    }

    console.log(
      "ZUQEN CHAT CREDITS:",
      currentChatCredits
    );

    if (
      currentChatCredits <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your ZUQEN Chat credits are exhausted. Please refill your Chat credits to continue.",
          code:
            "INSUFFICIENT_CREDITS",
          feature:
            "chat",
          provider:
            "groq",
          creditBalance:
            0,
        },
        {
          status: 402,
        }
      );
    }

    // =======================================================
    // 3. READ REQUEST BODY
    // =======================================================

    const body =
      await req.json();

    const rawMessages =
      Array.isArray(
        body?.messages
      )
        ? body.messages
        : [];

    const messages: InputMessage[] =
      rawMessages
        .filter(
          (m: any) =>
            (
              m?.role === "user" ||
              m?.role === "assistant"
            ) &&
            typeof m?.content ===
              "string" &&
            m.content.trim()
              .length > 0
        )
        .map(
          (m: any) => ({
            role:
              m.role,
            content:
              m.content.trim(),
          })
        );

    const attachments:
      Attachment[] =
      Array.isArray(
        body?.attachments
      )
        ? body.attachments.filter(
            (a: any) =>
              a &&
              typeof a ===
                "object"
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
        {
          status: 400,
        }
      );
    }

    // =======================================================
    // 4. DETECT IMAGE ATTACHMENTS
    // =======================================================

    const imageAttachments =
      attachments.filter(
        isImageAttachment
      );

    const hasImages =
      imageAttachments.length >
      0;

    // =======================================================
    // 5. SELECT GROQ MODEL
    // =======================================================

    const model = hasImages
      ? "qwen/qwen3.6-27b"
      : "openai/gpt-oss-120b";

    // =======================================================
    // 6. RESERVE CHAT CREDITS
    // =======================================================

    const reservationAmount =
      estimateChatReservation(
        messages,
        hasImages
      );

    const chatReferenceId =
      `chat-${crypto.randomUUID()}`;

    console.log(
      "ZUQEN CHAT CREDIT RESERVATION:",
      {
        requested:
          reservationAmount,
        currentBalance:
          currentChatCredits,
        hasImages,
      }
    );

    const reservation =
      await reserveFeatureCredits(
        {
          userId,
          featureKey:
            "chat",
          amount:
            reservationAmount,
          providerRequestId:
            null,
          referenceId:
            chatReferenceId,
          metadata: {
            model,
            hasImages,
            imageCount:
              imageAttachments.length,
            reservationType:
              "chat_request",
          },
        }
      );

    if (
      !reservation.success
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            reservation.message ||
            "Unable to reserve Chat credits.",
          code:
            reservation.code,
          feature:
            "chat",
          provider:
            "groq",
          creditBalance:
            currentChatCredits,
          requestedReservation:
            reservationAmount,
        },
        {
          status:
            reservation.code ===
            "INSUFFICIENT_CREDITS"
              ? 402
              : 500,
        }
      );
    }

    const reservationData =
      reservation.data &&
      typeof reservation.data ===
        "object"
        ? (reservation.data as Record<
            string,
            unknown
          >)
        : null;

    const reservationId =
      typeof reservationData
        ?.reservationId ===
      "string"
        ? reservationData.reservationId
        : null;

    if (!reservationId) {
      console.error(
        "ZUQEN RESERVATION ID MISSING:",
        reservation
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Chat credit reservation could not be created.",
          code:
            "RESERVATION_ID_MISSING",
        },
        {
          status: 500,
        }
      );
    }

    const reservedBalance =
      Number(
        reservationData?.newBalance ??
          Math.max(
            0,
            currentChatCredits -
              reservationAmount
          )
      );

    // =======================================================
    // 7. GROQ API KEY
    // =======================================================

    const apiKey =
      process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      await refundFeatureCreditReservation(
        {
          reservationId,
          referenceId:
            chatReferenceId,
          description:
            "Chat reservation refunded because Groq API key is missing.",
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "GROQ_API_KEY is missing.",
          code:
            "GROQ_API_KEY_MISSING",
        },
        {
          status: 500,
        }
      );
    }

    // =======================================================
    // 8. SYSTEM PROMPT
    // =======================================================

    const systemPrompt = `
You are ZUQEN, a helpful, intelligent, friendly and natural AI assistant.

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

- When an image is attached, analyze the actual visual content of the image.
- Do not say that you cannot see the image when a valid image has been provided.
- If the user asks how a picture looks, give a natural opinion based on what is actually visible.
- You can discuss composition, lighting, colors, subject, background, quality and mood.
- Never invent details that are not visible.
- If something is unclear, say that it is unclear.
- If the user asks about text in an image, read it when possible.

IMPORTANT:

Be concise by default, but never omit important information needed to correctly answer the question.
`;

    // =======================================================
    // 9. BUILD GROQ MESSAGES
    // =======================================================

    let groqMessages: any[];

    if (hasImages) {
      const imageParts: any[] =
        [];

      for (
        const attachment of imageAttachments
      ) {
        const dataUrl =
          await imageToDataUrl(
            attachment
          );

        imageParts.push({
          type: "image_url",
          image_url: {
            url: dataUrl,
          },
        });
      }

      const previousMessages =
        messages.slice(0, -1);

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
          role: "system",
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
      groqMessages = [
        {
          role: "system",
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

    console.log(
      "ZUQEN MODEL:",
      model
    );

    console.log(
      "ZUQEN HAS IMAGES:",
      hasImages
    );

    console.log(
      "ZUQEN IMAGE COUNT:",
      imageAttachments.length
    );

    // =======================================================
    // 10. CALL GROQ
    // =======================================================

    let groqResponse: Response;

    try {
      groqResponse =
        await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
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
                stream: true,
                stream_options: {
                  include_usage:
                    true,
                },
              }),
          }
        );
    } catch (error) {
      console.error(
        "ZUQEN GROQ FETCH ERROR:",
        error
      );

      await refundFeatureCreditReservation(
        {
          reservationId,
          referenceId:
            chatReferenceId,
          description:
            "Chat reservation refunded because Groq request failed.",
          metadata: {
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Groq request failed.",
          code:
            "GROQ_REQUEST_FAILED",
        },
        {
          status: 502,
        }
      );
    }

    // =======================================================
    // 11. READ REAL GROQ QUOTA
    // =======================================================

    const groqQuotaHeaders =
      getGroqQuotaHeaders(
        groqResponse
      );

    console.log(
      "GROQ QUOTA HEADERS:",
      groqQuotaHeaders
    );

    // =======================================================
    // 12. SYNC REAL GROQ QUOTA
    // =======================================================

    const quotaSync =
      await syncGroqQuotaFromHeaders(
        groqResponse.headers
      );

    if (!quotaSync.success) {
      console.warn(
        "ZUQEN GROQ QUOTA SYNC FAILED:",
        quotaSync.error
      );
    } else {
      console.log(
        "ZUQEN GROQ QUOTA SYNCED SUCCESSFULLY"
      );
    }

    // =======================================================
    // 13. HANDLE GROQ ERROR
    // =======================================================

    if (!groqResponse.ok) {
      const errorText =
        await groqResponse.text();

      console.error(
        "GROQ ERROR:",
        errorText
      );

      let message =
        errorText;

      try {
        const parsed =
          JSON.parse(
            errorText
          );

        message =
          parsed?.error?.message ||
          parsed?.error ||
          errorText;
      } catch {
        // Keep original error text.
      }

      const refundResult =
        await refundFeatureCreditReservation(
          {
            reservationId,
            referenceId:
              chatReferenceId,
            description:
              "Chat reservation refunded because Groq returned an error.",
            metadata: {
              groqStatus:
                groqResponse.status,
              groqError:
                message,
              groqQuota:
                groqQuotaHeaders,
            },
          }
        );

      if (
        !refundResult.success
      ) {
        console.error(
          "ZUQEN GROQ ERROR REFUND FAILED:",
          refundResult.message
        );
      }

      return NextResponse.json(
        {
          success: false,
          error:
            `Groq request failed: ${message}`,
          code:
            "GROQ_REQUEST_FAILED",
          feature:
            "chat",
          provider:
            "groq",
          groqQuota:
            groqQuotaHeaders,
          creditBalance:
            currentChatCredits,
          reservationRefunded:
            refundResult.success,
        },
        {
          status:
            groqResponse.status,
          headers:
            groqQuotaHeaders,
        }
      );
    }

    // =======================================================
    // 14. CHECK RESPONSE BODY
    // =======================================================

    if (!groqResponse.body) {
      const refundResult =
        await refundFeatureCreditReservation(
          {
            reservationId,
            referenceId:
              chatReferenceId,
            description:
              "Chat reservation refunded because Groq returned no response body.",
          }
        );

      return NextResponse.json(
        {
          success: false,
          error:
            "Groq returned no response body.",
          code:
            "GROQ_EMPTY_RESPONSE",
          reservationRefunded:
            refundResult.success,
        },
        {
          status: 500,
          headers:
            groqQuotaHeaders,
        }
      );
    }

    // =======================================================
    // 15. STREAM GROQ RESPONSE
    // =======================================================

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

          let buffer = "";

          let groqUsage:
            GroqUsage | null =
            null;

          let groqRequestId:
            string | null =
            null;

          let streamCompleted =
            false;

          let reservationProcessed =
            false;

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
                    JSON.parse(
                      data
                    );

                  // Capture Groq request ID.
                  if (
                    typeof parsed?.id ===
                    "string"
                  ) {
                    groqRequestId =
                      parsed.id;
                  }

                  // Capture actual usage.
                  if (
                    parsed?.usage
                  ) {
                    groqUsage =
                      parsed.usage;
                  }

                  // Send generated text.
                  const text =
                    parsed
                      ?.choices?.[0]
                      ?.delta
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
                } catch (
                  error
                ) {
                  console.error(
                    "STREAM PARSE ERROR:",
                    error
                  );
                }
              }
            }

            // =================================================
            // 16. ACTUAL GROQ USAGE
            // =================================================

            const inputTokens =
              toSafeNumber(
                groqUsage?.prompt_tokens
              );

            const outputTokens =
              toSafeNumber(
                groqUsage?.completion_tokens
              );

            const totalTokens =
              toSafeNumber(
                groqUsage?.total_tokens
              );

            console.log(
              "ZUQEN GROQ USAGE:",
              {
                requestId:
                  groqRequestId,
                inputTokens,
                outputTokens,
                totalTokens,
                reserved:
                  reservationAmount,
              }
            );

            // =================================================
            // 17. RECORD PROVIDER USAGE
            // =================================================

            const usageRecord =
              await recordProviderUsage(
                {
                  userId,
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
                    usageAvailable:
                      Boolean(
                        groqUsage
                      ),
                    reservationId,
                    reservationAmount,
                  },
                }
              );

            if (
              !usageRecord.success
            ) {
              console.error(
                "ZUQEN PROVIDER USAGE RECORD FAILED:",
                usageRecord.error
              );
            }

            // =================================================
            // 18. SETTLE CREDIT RESERVATION
            // =================================================

            const settlement =
              await settleFeatureCreditReservation(
                {
                  reservationId,
                  actualAmount:
                    totalTokens,
                  providerRequestId:
                    groqRequestId,
                  description:
                    "Groq Chat actual token usage",
                  referenceId:
                    usageRecord.id ??
                    chatReferenceId,
                  metadata: {
                    model,
                    inputTokens,
                    outputTokens,
                    totalTokens,
                    hasImages,
                    imageCount:
                      imageAttachments.length,
                    groqUsage:
                      groqUsage ??
                      null,
                    groqQuota:
                      groqQuotaHeaders,
                    reservationAmount,
                  },
                }
              );

            reservationProcessed =
              settlement.success;

            if (
              !settlement.success
            ) {
              console.error(
                "ZUQEN CREDIT SETTLEMENT FAILED:",
                settlement.message
              );
            }

            const settlementData =
              settlement.data &&
              typeof settlement.data ===
                "object"
                ? (settlement.data as Record<
                    string,
                    unknown
                  >)
                : null;

            const remainingCredits =
              Number(
                settlementData?.newBalance ??
                  reservedBalance
              );

            const refundedCredits =
              Number(
                settlementData?.refunded ??
                  0
              );

            console.log(
              "ZUQEN CHAT CREDIT RESULT:",
              {
                reserved:
                  reservationAmount,
                used:
                  totalTokens,
                refunded:
                  refundedCredits,
                remaining:
                  remainingCredits,
                settlement:
                  settlement.code,
              }
            );

            streamCompleted =
              true;

            // =================================================
            // 19. SEND FINAL INFORMATION
            // =================================================

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify(
                  {
                    usage: {
                      inputTokens,
                      outputTokens,
                      totalTokens,
                    },

                    credits: {
                      feature:
                        "chat",

                      reserved:
                        reservationAmount,

                      used:
                        totalTokens,

                      refunded:
                        refundedCredits,

                      remaining:
                        remainingCredits,

                      settled:
                        settlement.success,
                    },

                    provider:
                      "groq",

                    groqQuota:
                      groqQuotaHeaders,
                  }
                )}\n\n`
              )
            );

            // =================================================
            // 20. FINISH STREAM
            // =================================================

            controller.enqueue(
              encoder.encode(
                "data: [DONE]\n\n"
              )
            );

            controller.close();
          } catch (
            error
          ) {
            console.error(
              "STREAM ERROR:",
              error
            );

            // ===============================================
            // Record failed provider request
            // ===============================================

            const failedRecord =
              await recordProviderUsage(
                {
                  userId,
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
                    streamCompleted,
                    error:
                      error instanceof
                      Error
                        ? error.message
                        : String(
                            error
                          ),
                    groqQuota:
                      groqQuotaHeaders,
                    reservationId,
                  },
                }
              );

            if (
              !failedRecord.success
            ) {
              console.error(
                "ZUQEN FAILED USAGE RECORD FAILED:",
                failedRecord.error
              );
            }

            // ===============================================
            // Refund reservation if not already settled
            // ===============================================

            if (
              !reservationProcessed
            ) {
              const refundResult =
                await refundFeatureCreditReservation(
                  {
                    reservationId,
                    providerRequestId:
                      groqRequestId,
                    referenceId:
                      failedRecord.id ??
                      chatReferenceId,
                    description:
                      "Chat reservation refunded because the stream failed.",
                    metadata: {
                      hasImages,
                      imageCount:
                        imageAttachments.length,
                      streamCompleted,
                      error:
                        error instanceof
                        Error
                          ? error.message
                          : String(
                              error
                            ),
                      groqQuota:
                        groqQuotaHeaders,
                    },
                  }
                );

              if (
                !refundResult.success
              ) {
                console.error(
                  "ZUQEN STREAM REFUND FAILED:",
                  refundResult.message
                );
              }
            }

            controller.error(
              error
            );
          } finally {
            reader.releaseLock();
          }
        },
      });

    // =======================================================
    // 21. RESPONSE HEADERS
    // =======================================================

    const responseHeaders =
      new Headers({
        "Content-Type":
          "text/event-stream; charset=utf-8",

        "Cache-Control":
          "no-cache, no-transform",

        Connection:
          "keep-alive",

        "X-Accel-Buffering":
          "no",

        "X-Zuquen-Provider":
          "groq",

        "X-Zuquen-Feature":
          "chat",

        "X-Zuquen-Feature-Credits":
          String(
            reservedBalance
          ),
      });

    // Forward Groq real quota information.
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

    // =======================================================
    // 22. RETURN STREAM
    // =======================================================

    return new Response(
      stream,
      {
        status: 200,
        headers:
          responseHeaders,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "ZUQEN CHAT ROUTE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "ZUQEN request failed.",
      },
      {
        status: 500,
      }
    );
  }
}