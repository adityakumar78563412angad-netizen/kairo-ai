import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { checkFeatureAccess } from "@/lib/feature-access";
import { recordProviderUsage } from "@/lib/provider-usage";

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

export async function POST(
  req: Request
) {
  try {
    // =======================================================
    // 1. ZUQEN FEATURE ACCESS CHECK
    // =======================================================

    const featureAccess =
      await checkFeatureAccess("chat");

    if (!featureAccess.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: featureAccess.message,
          code: featureAccess.code,
          feature: "chat",
        },
        {
          status:
            featureAccess.status,
        }
      );
    }

    console.log(
      "ZUQEN CHAT ACCESS:",
      {
        userId:
          featureAccess.userId,
        feature:
          featureAccess.featureKey,
        provider:
          featureAccess.provider,
        packageType:
          featureAccess.packageType,
      }
    );

    // =======================================================
    // 2. READ REQUEST BODY
    // =======================================================

    const body =
      await req.json();

    const rawMessages =
      Array.isArray(body?.messages)
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
            m.content.trim().length >
              0
        )
        .map(
          (m: any) => ({
            role: m.role,
            content:
              m.content.trim(),
          })
        );

    const attachments: Attachment[] =
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
    // 3. GROQ API KEY
    // =======================================================

    const apiKey =
      process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GROQ_API_KEY is missing.",
        },
        {
          status: 500,
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
    // 6. SYSTEM PROMPT
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
    // 7. BUILD GROQ MESSAGES
    // =======================================================

    let groqMessages: any[];

    if (hasImages) {
      const imageParts: any[] = [];

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
        lastMessage?.role === "user"
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
    // 8. CALL GROQ
    // =======================================================

    const groqResponse =
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

          body: JSON.stringify({
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

            // IMPORTANT:
            // Ask Groq to include final usage
            // information in the streaming response.
            stream_options: {
              include_usage: true,
            },
          }),
        }
      );

    // =======================================================
    // 9. READ REAL GROQ QUOTA
    // =======================================================

    const groqQuotaHeaders =
      getGroqQuotaHeaders(
        groqResponse
      );

    // =======================================================
    // 10. HANDLE GROQ ERROR
    // =======================================================

    if (!groqResponse.ok) {
      const errorText =
        await groqResponse.text();

      console.error(
        "GROQ ERROR:",
        errorText
      );

      console.error(
        "GROQ QUOTA:",
        groqQuotaHeaders
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

      return NextResponse.json(
        {
          success: false,
          error:
            `Groq request failed: ${message}`,
          feature:
            "chat",
          provider:
            "groq",
          groqQuota:
            groqQuotaHeaders,
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
    // 11. CHECK RESPONSE BODY
    // =======================================================

    if (!groqResponse.body) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Groq returned no response body.",
        },
        {
          status: 500,

          headers:
            groqQuotaHeaders,
        }
      );
    }

    console.log(
      "GROQ QUOTA:",
      groqQuotaHeaders
    );

    // =======================================================
    // 12. STREAM GROQ RESPONSE
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

                  // -----------------------------------------
                  // Capture Groq completion/request ID
                  // -----------------------------------------

                  if (
                    typeof parsed?.id ===
                    "string"
                  ) {
                    groqRequestId =
                      parsed.id;
                  }

                  // -----------------------------------------
                  // Capture actual usage
                  // -----------------------------------------

                  if (
                    parsed?.usage
                  ) {
                    groqUsage =
                      parsed.usage;
                  }

                  // -----------------------------------------
                  // Send generated text to frontend
                  // -----------------------------------------

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
            // 13. RECORD ACTUAL GROQ USAGE
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
              }
            );

            const usageRecord =
              await recordProviderUsage(
                {
                  userId:
                    featureAccess.userId,

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

            streamCompleted =
              true;

            // =================================================
            // 14. FINISH STREAM
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
                  userId:
                    featureAccess.userId,

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

            controller.error(
              error
            );
          } finally {
            reader.releaseLock();
          }
        },
      });

    // =======================================================
    // 15. RESPONSE HEADERS
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

        "X-Zuquen-Feature-Access":
          "granted",
      });

    // Forward Groq's REAL quota
    // information to frontend.

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
    // 16. RETURN STREAM
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