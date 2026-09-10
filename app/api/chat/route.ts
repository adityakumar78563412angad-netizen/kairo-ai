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

  const signedUrl =
    await getB2SignedUrl(
      attachment.key
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

function estimateChatReservation(
  messages: InputMessage[],
  hasImages: boolean
) {
  const textLength =
    messages.reduce(
      (total, message) =>
        total +
        message.content.length,
      0
    );

  const estimatedInputTokens =
    Math.ceil(
      textLength / 3
    ) + 600;

  const maximumCompletionTokens =
    2048;

  const imageSafetyReserve =
    hasImages
      ? 6000
      : 0;

  const estimatedTotalTokens =
    estimatedInputTokens +
    maximumCompletionTokens +
    imageSafetyReserve;

  return Math.max(
    1,
    Math.ceil(
      estimatedTotalTokens /
        1000
    )
  );
}

function groqTokensToZuquenCredits(
  totalTokens: number
) {
  if (
    !Number.isFinite(
      totalTokens
    ) ||
    totalTokens <= 0
  ) {
    return 0;
  }

  return Math.ceil(
    totalTokens / 1000
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
  let reservationId:
    | string
    | null = null;

  let chatReferenceId:
    | string
    | null = null;

  let userId:
    | string
    | null = null;

  let reservationAmount =
    0;

  let reservationProcessed =
    false;

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

    console.log(
      "ZUQEN CHAT USER:",
      userId
    );

    // =====================================================
    // 2. CHECK CREDIT BALANCE
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

    console.log(
      "ZUQEN CHAT CREDIT BALANCE:",
      {
        userId,
        balance:
          currentChatCredits,
      }
    );

    if (
      currentChatCredits <=
      0
    ) {
      return jsonError(
        "Your ZUQEN Chat credits are 0. Please refresh your session or add Chat credits before sending a message.",
        "INSUFFICIENT_CREDITS",
        402,
        {
          feature:
            "chat",
          provider:
            "groq",
          creditBalance:
            0,
        }
      );
    }

    // =====================================================
    // 3. PARSE BODY
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

    const messages: InputMessage[] =
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
  (message: { content: string }) =>
    message.content.length > 0
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
    // 4. IMAGES
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

    // =====================================================
    // 6. RESERVE CREDITS
    // =====================================================

    reservationAmount =
      estimateChatReservation(
        messages,
        hasImages
      );

    chatReferenceId =
      `chat-${crypto.randomUUID()}`;

    console.log(
      "ZUQEN CHAT RESERVATION:",
      {
        userId,
        currentChatCredits,
        reservationAmount,
        hasImages,
        model,
      }
    );

    const reservation =
      await reserveFeatureCredits({
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
          conversionRate:
            "1000 Groq tokens = 1 ZUQEN Chat Credit",
        },
      });

    if (
      !reservation.success
    ) {
      return jsonError(
        reservation.message ||
          "Unable to reserve Chat credits.",
        reservation.code ||
          "CREDIT_RESERVATION_FAILED",
        reservation.code ===
          "INSUFFICIENT_CREDITS"
          ? 402
          : 500,
        {
          feature:
            "chat",
          provider:
            "groq",
          creditBalance:
            currentChatCredits,
          requestedReservation:
            reservationAmount,
        }
      );
    }

    const reservationData =
      reservation.data &&
      typeof reservation.data ===
        "object"
        ? (
            reservation.data as Record<
              string,
              unknown
            >
          )
        : null;

    reservationId =
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

      return jsonError(
        "Chat credit reservation could not be created.",
        "RESERVATION_ID_MISSING",
        500
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

    // =====================================================
    // 7. GROQ KEY
    // =====================================================

    const apiKey =
      process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      await refundFeatureCreditReservation({
        reservationId,
        referenceId:
          chatReferenceId,
        description:
          "Chat reservation refunded because GROQ_API_KEY is missing.",
      });

      reservationProcessed =
        true;

      return jsonError(
        "GROQ_API_KEY is missing from the server environment.",
        "GROQ_API_KEY_MISSING",
        500
      );
    }

    // =====================================================
    // 8. SYSTEM PROMPT
    // =====================================================

    const systemPrompt = `
You are ZUQEN, a helpful, intelligent, friendly and natural AI assistant.

RESPONSE LENGTH:
- Match the answer length to the user's question.
- Simple questions should receive short answers.
- Do not add unnecessary introductions or conclusions.
- Give detailed answers when the user asks for detail.
- Be clear and useful.

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
- You may discuss visible objects, text, colors, composition, lighting, quality and mood.

Be accurate, natural and concise.
`;

    // =====================================================
    // 9. BUILD GROQ MESSAGES
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
                messages.length -
                  1
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
            (
              message
            ) => ({
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
            (
              message
            ) => ({
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

      await refundFeatureCreditReservation({
        reservationId,
        referenceId:
          chatReferenceId,
        description:
          "Chat reservation refunded because message preparation failed.",
        metadata: {
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
      });

      reservationProcessed =
        true;

      return jsonError(
        error instanceof Error
          ? error.message
          : "Failed to prepare the Chat request.",
        "MESSAGE_BUILD_FAILED",
        500
      );
    }

    // =====================================================
    // 10. GROQ REQUEST
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

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unable to connect to Groq.";

      await refundFeatureCreditReservation({
        reservationId,
        referenceId:
          chatReferenceId,
        description:
          "Chat reservation refunded because Groq network request failed.",
        metadata: {
          error:
            errorMessage,
        },
      });

      reservationProcessed =
        true;

      return jsonError(
        `Unable to connect to the AI provider: ${errorMessage}`,
        "GROQ_NETWORK_ERROR",
        502,
        {
          provider:
            "groq",
          creditBalance:
            currentChatCredits,
          reservationRefunded:
            true,
        }
      );
    }

    // =====================================================
    // 11. GROQ QUOTA
    // =====================================================

    const groqQuotaHeaders =
      getGroqQuotaHeaders(
        groqResponse
      );

    try {
      const quotaSync =
        await syncGroqQuotaFromHeaders(
          groqResponse.headers
        );

      if (
        !quotaSync.success
      ) {
        console.warn(
          "ZUQEN GROQ QUOTA SYNC FAILED:",
          quotaSync.error
        );
      }
    } catch (error) {
      console.warn(
        "ZUQEN GROQ QUOTA SYNC ERROR:",
        error
      );
    }

    // =====================================================
    // 12. GROQ HTTP ERROR
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
        // Keep text.
      }

      let refundSuccess =
        false;

      try {
        const refundResult =
          await refundFeatureCreditReservation({
            reservationId,
            referenceId:
              chatReferenceId,
            description:
              "Chat reservation refunded because Groq returned an HTTP error.",
            metadata: {
              groqStatus:
                groqResponse.status,
              groqError:
                message,
              groqQuota:
                groqQuotaHeaders,
            },
          });

        refundSuccess =
          refundResult.success;

        if (
          !refundResult.success
        ) {
          console.error(
            "ZUQEN GROQ ERROR REFUND FAILED:",
            refundResult.message
          );
        }
      } catch (error) {
        console.error(
          "ZUQEN REFUND EXCEPTION:",
          error
        );
      }

      reservationProcessed =
        refundSuccess;

      return jsonError(
        `Groq request failed: ${message}`,
        "GROQ_REQUEST_FAILED",
        groqResponse.status,
        {
          feature:
            "chat",
          provider:
            "groq",
          groqQuota:
            groqQuotaHeaders,
          creditBalance:
            currentChatCredits,
          reservationRefunded:
            refundSuccess,
        }
      );
    }

    // =====================================================
    // 13. EMPTY BODY
    // =====================================================

    if (
      !groqResponse.body
    ) {
      let refundSuccess =
        false;

      try {
        const refundResult =
          await refundFeatureCreditReservation({
            reservationId,
            referenceId:
              chatReferenceId,
            description:
              "Chat reservation refunded because Groq returned an empty response body.",
          });

        refundSuccess =
          refundResult.success;
      } catch (error) {
        console.error(
          "ZUQEN EMPTY RESPONSE REFUND ERROR:",
          error
        );
      }

      reservationProcessed =
        refundSuccess;

      return jsonError(
        "The AI provider returned an empty response.",
        "GROQ_EMPTY_RESPONSE",
        502,
        {
          reservationRefunded:
            refundSuccess,
        }
      );
    }

    // =====================================================
    // 14. STREAM
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

          let streamCompleted =
            false;

          let streamClosed =
            false;

          async function safeRefund(
            reason: string,
            metadata: Record<
              string,
              unknown
            > = {}
          ) {
            if (
              reservationProcessed ||
              !reservationId
            ) {
              return;
            }

            try {
              const result =
                await refundFeatureCreditReservation({
                  reservationId,
                  providerRequestId:
                    groqRequestId,
                  referenceId:
                    chatReferenceId,
                  description:
                    reason,
                  metadata,
                });

              if (
                result.success
              ) {
                reservationProcessed =
                  true;
              } else {
                console.error(
                  "ZUQEN STREAM REFUND FAILED:",
                  result.message
                );
              }
            } catch (error) {
              console.error(
                "ZUQEN STREAM REFUND EXCEPTION:",
                error
              );
            }
          }

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

          function sendError(
            message: string,
            code: string
          ) {
            sendEvent({
              error:
                message,
              code,
            });
          }

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

                if (
                  !data
                ) {
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
                    sendEvent({
                      text,
                    });
                  }
                } catch (error) {
                  console.warn(
                    "ZUQEN STREAM JSON PARSE ERROR:",
                    error
                  );
                }
              }
            }

            // =================================================
            // 15. FINAL USAGE
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

            const zuqenChatCreditsUsed =
              groqTokensToZuquenCredits(
                totalTokens
              );

            console.log(
              "ZUQEN FINAL CHAT USAGE:",
              {
                userId,
                groqRequestId,
                inputTokens,
                outputTokens,
                totalTokens,
                zuqenChatCreditsUsed,
                reservationAmount,
              }
            );

            // =================================================
            // 16. RECORD USAGE
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
                    reservationId,
                    reservationAmount,
                    zuqenChatCreditsUsed,
                    conversionRate:
                      "1000 Groq tokens = 1 ZUQEN Chat Credit",
                  },
                });
            } catch (error) {
              console.error(
                "ZUQEN USAGE RECORD ERROR:",
                error
              );
            }

            // =================================================
            // 17. SETTLE
            // =================================================

            let settlement:
              any = null;

            try {
              settlement =
                await settleFeatureCreditReservation({
                  reservationId:
                    reservationId!,
                  actualAmount:
                    zuqenChatCreditsUsed,
                  providerRequestId:
                    groqRequestId,
                  description:
                    "Groq Chat usage converted to ZUQEN Chat Credits",
                  referenceId:
                    usageRecord?.id ??
                    chatReferenceId,
                  metadata: {
                    model,
                    inputTokens,
                    outputTokens,
                    totalTokens,
                    zuqenChatCreditsUsed,
                    conversionRate:
                      "1000 Groq tokens = 1 ZUQEN Chat Credit",
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
                });
            } catch (error) {
              console.error(
                "ZUQEN SETTLEMENT EXCEPTION:",
                error
              );
            }

            const settlementSuccess =
              Boolean(
                settlement?.success
              );

            reservationProcessed =
              settlementSuccess;

            if (
              !settlementSuccess
            ) {
              console.error(
                "ZUQEN CREDIT SETTLEMENT FAILED:",
                settlement?.message
              );

              await safeRefund(
                "Chat reservation refunded because credit settlement failed.",
                {
                  totalTokens,
                  zuqenChatCreditsUsed,
                  reservationAmount,
                }
              );

              sendError(
                "Your AI response was generated, but ZUQEN could not finalize the Chat credit transaction. Your reserved credits were refunded.",
                "CREDIT_SETTLEMENT_FAILED"
              );

              sendEvent({
                credits: {
                  feature:
                    "chat",
                  reserved:
                    reservationAmount,
                  used:
                    0,
                  providerTokens:
                    totalTokens,
                  refunded:
                    reservationAmount,
                  remaining:
                    currentChatCredits,
                  settled:
                    false,
                  conversionRate:
                    "1000 Groq tokens = 1 ZUQEN Chat Credit",
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

              return;
            }

            const settlementData =
              settlement.data &&
              typeof settlement.data ===
                "object"
                ? (
                    settlement.data as Record<
                      string,
                      unknown
                    >
                  )
                : null;

            const remainingCredits =
              Number(
                settlementData?.newBalance ??
                  Math.max(
                    0,
                    reservedBalance
                  )
              );

            const refundedCredits =
              Number(
                settlementData?.refunded ??
                  Math.max(
                    0,
                    reservationAmount -
                      zuqenChatCreditsUsed
                  )
              );

            streamCompleted =
              true;

            // =================================================
            // 18. SEND CREDIT RESULT
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

                reserved:
                  reservationAmount,

                used:
                  zuqenChatCreditsUsed,

                providerTokens:
                  totalTokens,

                refunded:
                  refundedCredits,

                remaining:
                  remainingCredits,

                settled:
                  true,

                conversionRate:
                  "1000 Groq tokens = 1 ZUQEN Chat Credit",
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
              error instanceof Error
                ? error.message
                : String(error);

            // ===============================================
            // Failed usage record
            // ===============================================

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
                  streamCompleted,
                  error:
                    errorMessage,
                  groqQuota:
                    groqQuotaHeaders,
                  reservationId,
                },
              });
            } catch (recordError) {
              console.error(
                "ZUQEN FAILED USAGE RECORD ERROR:",
                recordError
              );
            }

            // ===============================================
            // Refund
            // ===============================================

            await safeRefund(
              "Chat reservation refunded because the AI response stream failed.",
              {
                hasImages,
                imageCount:
                  imageAttachments.length,
                streamCompleted,
                error:
                  errorMessage,
                groqQuota:
                  groqQuotaHeaders,
              }
            );

            // ===============================================
            // IMPORTANT:
            // Do NOT call controller.error().
            //
            // controller.error() can make browser fetch()
            // report only:
            //
            // TypeError: Failed to fetch
            //
            // Instead send an SSE error event and close
            // normally.
            // ===============================================

            if (
              !streamClosed
            ) {
              try {
                sendError(
                  `ZUQEN Chat stream failed: ${errorMessage}`,
                  "STREAM_ERROR"
                );

                sendEvent({
                  credits: {
                    feature:
                      "chat",
                    reserved:
                      reservationAmount,
                    used:
                      0,
                    refunded:
                      reservationAmount,
                    remaining:
                      currentChatCredits,
                    settled:
                      false,
                  },
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
              } catch (closeError) {
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
              // Ignore release errors.
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
        reservedBalance
      )
    );

    responseHeaders.set(
      "X-Zuquen-Credit-Rate",
      "1000 Groq tokens = 1 ZUQEN Chat Credit"
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
    // 20. RETURN
    // =====================================================

    return new Response(
      stream,
      {
        status:
          200,
        headers:
          responseHeaders,
      }
    );
  } catch (error) {
    console.error(
      "ZUQEN CHAT ROUTE FATAL ERROR:",
      error
    );

    if (
      reservationId &&
      !reservationProcessed
    ) {
      try {
        await refundFeatureCreditReservation({
          reservationId,
          referenceId:
            chatReferenceId,
          description:
            "Chat reservation refunded because the ZUQEN Chat route failed.",
          metadata: {
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
        });
      } catch (refundError) {
        console.error(
          "ZUQEN FATAL REFUND ERROR:",
          refundError
        );
      }
    }

    return jsonError(
      error instanceof Error
        ? error.message
        : "ZUQEN Chat request failed.",
      "CHAT_ROUTE_ERROR",
      500
    );
  }
}