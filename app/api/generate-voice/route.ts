import { NextRequest, NextResponse } from "next/server";

const MODEL_ID = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";

// Flash v2.5 supports up to 40,000 characters per request.
const MAX_CHARS_PER_REQUEST = 40000;

type ElevenLabsError = {
  detail?: {
    type?: string;
    code?: string;
    message?: string;
    status?: string;
    request_id?: string;
  };
  message?: string;
};

function splitText(text: string, maxChars: number): string[] {
  const cleanText = text.trim();

  if (!cleanText) {
    return [];
  }

  if (cleanText.length <= maxChars) {
    return [cleanText];
  }

  const sentences = cleanText.split(/(?<=[.!?।])\s+/);

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();

    if (!trimmedSentence) {
      continue;
    }

    if (
      current.length > 0 &&
      current.length + trimmedSentence.length + 1 > maxChars
    ) {
      chunks.push(current.trim());
      current = "";
    }

    if (trimmedSentence.length > maxChars) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }

      for (let i = 0; i < trimmedSentence.length; i += maxChars) {
        chunks.push(
          trimmedSentence.slice(i, i + maxChars).trim()
        );
      }

      continue;
    }

    current +=
      current.length > 0
        ? ` ${trimmedSentence}`
        : trimmedSentence;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

async function generateChunk(
  apiKey: string,
  voiceId: string,
  text: string
): Promise<ArrayBuffer> {
  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/` +
    `${encodeURIComponent(voiceId)}` +
    `?output_format=${OUTPUT_FORMAT}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
    }),
  });

  if (!response.ok) {
    let errorData: ElevenLabsError = {};

    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parsing failure.
    }

    const detail = errorData?.detail;

    const error = new Error(
      detail?.message ||
        errorData?.message ||
        `ElevenLabs request failed with status ${response.status}.`
    );

    (
      error as Error & {
        statusCode?: number;
        errorCode?: string;
        requestId?: string;
      }
    ).statusCode = response.status;

    (
      error as Error & {
        statusCode?: number;
        errorCode?: string;
        requestId?: string;
      }
    ).errorCode = detail?.code || detail?.status;

    (
      error as Error & {
        statusCode?: number;
        errorCode?: string;
        requestId?: string;
      }
    ).requestId = detail?.request_id;

    throw error;
  }

  return response.arrayBuffer();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const text =
      typeof body?.text === "string"
        ? body.text.trim()
        : "";

    const voiceId =
      typeof body?.voiceId === "string"
        ? body.voiceId.trim()
        : "";

    if (!text) {
      return NextResponse.json(
        {
          error: "Text is required.",
        },
        { status: 400 }
      );
    }

    if (!voiceId) {
      return NextResponse.json(
        {
          error: "Voice ID is required.",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error(
        "ELEVENLABS_API_KEY is missing."
      );

      return NextResponse.json(
        {
          error:
            "ElevenLabs API key is not configured.",
        },
        { status: 500 }
      );
    }

    console.log(
      `[Voice] Text length: ${text.length}`
    );

    console.log(
      `[Voice] Model: ${MODEL_ID}`
    );

    const chunks = splitText(
      text,
      MAX_CHARS_PER_REQUEST
    );

    console.log(
      `[Voice] Chunks: ${chunks.length}`
    );

    const audioChunks: ArrayBuffer[] = [];

    for (let i = 0; i < chunks.length; i++) {
      console.log(
        `[Voice] Generating chunk ${i + 1}/${chunks.length}...`
      );

      const audio = await generateChunk(
        apiKey,
        voiceId,
        chunks[i]
      );

      audioChunks.push(audio);
    }

    const totalLength = audioChunks.reduce(
      (total, chunk) =>
        total + chunk.byteLength,
      0
    );

    const combinedAudio = new Uint8Array(
      totalLength
    );

    let offset = 0;

    for (const chunk of audioChunks) {
      combinedAudio.set(
        new Uint8Array(chunk),
        offset
      );

      offset += chunk.byteLength;
    }

    console.log(
      `[Voice] Generation successful. Audio bytes: ${totalLength}`
    );

    return new NextResponse(
      combinedAudio.buffer,
      {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(
            combinedAudio.byteLength
          ),
          "Cache-Control":
            "no-store, max-age=0",
          "X-Voice-Model": MODEL_ID,
          "X-Voice-Chunks": String(
            chunks.length
          ),
        },
      }
    );
  } catch (error) {
    const typedError = error as Error & {
      statusCode?: number;
      errorCode?: string;
      requestId?: string;
    };

    console.error(
      "===================================="
    );

    console.error(
      "ELEVENLABS VOICE GENERATION ERROR"
    );

    console.error(
      "===================================="
    );

    console.error(
      "Message:",
      typedError?.message
    );

    console.error(
      "Status:",
      typedError?.statusCode
    );

    console.error(
      "Code:",
      typedError?.errorCode
    );

    console.error(
      "Request ID:",
      typedError?.requestId
    );

    if (
      typedError?.errorCode ===
      "quota_exceeded"
    ) {
      return NextResponse.json(
        {
          error:
            "You don't have enough ElevenLabs credits for this text.",
          code: "quota_exceeded",
          message:
            typedError.message ||
            "Your ElevenLabs quota has been exceeded.",
          requestId:
            typedError.requestId || null,
        },
        { status: 402 }
      );
    }

    if (
      typedError?.errorCode ===
      "max_character_limit_exceeded"
    ) {
      return NextResponse.json(
        {
          error:
            "The text is too long for this voice generation request.",
          code:
            "max_character_limit_exceeded",
          message: typedError.message,
        },
        { status: 400 }
      );
    }

    if (
      typedError?.errorCode ===
      "voice_not_found"
    ) {
      return NextResponse.json(
        {
          error:
            "The selected voice could not be found.",
          code: "voice_not_found",
          message: typedError.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error:
          typedError?.message ||
          "Failed to generate voice.",
        code:
          typedError?.errorCode ||
          "generation_failed",
        requestId:
          typedError?.requestId || null,
      },
      {
        status:
          typedError?.statusCode || 500,
      }
    );
  }
}