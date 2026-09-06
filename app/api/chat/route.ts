import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
    regionMatch?.[1] || "us-east-005";

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: applicationKeyId,
      secretAccessKey: applicationKey,
    },
  });

  const command =
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

  /*
   * The URL is temporary.
   * 10 minutes is enough for ZUQEN to read
   * the image while keeping the object private.
   */
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
      `No storage key was found for "${attachment.name || "image"}".`
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

export async function POST(
  req: Request
) {
  try {
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
            (a: any) =>
              a &&
              typeof a === "object"
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
            "GROQ_API_KEY is missing.",
        },
        { status: 500 }
      );
    }

    const imageAttachments =
      attachments.filter(
        isImageAttachment
      );

    const hasImages =
      imageAttachments.length > 0;

    const model = hasImages
      ? "qwen/qwen3.6-27b"
      : "openai/gpt-oss-120b";

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

    let groqMessages: any[];

    if (hasImages) {
      const imageParts = [];

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
          }),
        }
      );

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
                buffer.split("\n");

              buffer =
                lines.pop() || "";

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
                    JSON.parse(data);

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

            controller.error(
              error
            );
          } finally {
            reader.releaseLock();
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

          "X-Accel-Buffering":
            "no",
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "ZUQEN ROUTE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ZUQEN request failed.",
      },
      { status: 500 }
    );
  }
}