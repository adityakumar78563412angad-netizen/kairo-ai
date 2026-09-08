import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const MODEL_ID = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";

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

type GeneratedChunk = {
  audio: ArrayBuffer;
  characterCost: number;
  requestId: string | null;
};

type ElevenLabsSubscription = {
  tier?: string;
  character_count?: number;
  character_limit?: number;
  max_credit_limit_extension?: number | "unlimited" | null;
  can_extend_character_limit?: boolean;
  next_character_count_reset_unix?: number | null;
  current_overage?: {
    amount?: string;
    currency?: string;
  } | null;
  status?: string;
  currency?: string | null;
  billing_period?: string | null;
  character_refresh_period?: string | null;
};

function splitText(
  text: string,
  maxChars: number
): string[] {
  const cleanText = text.trim();

  if (!cleanText) {
    return [];
  }

  if (cleanText.length <= maxChars) {
    return [cleanText];
  }

  const sentences = cleanText.split(
    /(?<=[.!?।])\s+/
  );

  const chunks: string[] = [];

  let current = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();

    if (!trimmedSentence) {
      continue;
    }

    if (
      current.length > 0 &&
      current.length +
        trimmedSentence.length +
        1 >
        maxChars
    ) {
      chunks.push(current.trim());
      current = "";
    }

    if (trimmedSentence.length > maxChars) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }

      for (
        let i = 0;
        i < trimmedSentence.length;
        i += maxChars
      ) {
        chunks.push(
          trimmedSentence
            .slice(i, i + maxChars)
            .trim()
        );
      }

      continue;
    }

    current =
      current.length > 0
        ? `${current} ${trimmedSentence}`
        : trimmedSentence;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Reads the current ElevenLabs subscription/quota.
 *
 * This is the real provider-side usage information.
 */
async function getElevenLabsSubscription(
  apiKey: string
): Promise<ElevenLabsSubscription> {
  const response = await fetch(
    "https://api.elevenlabs.io/v1/user/subscription",
    {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.detail?.message ||
      data?.message ||
      `ElevenLabs subscription request failed with status ${response.status}.`;

    const error = new Error(message) as Error & {
      statusCode?: number;
      errorCode?: string;
      requestId?: string;
    };

    error.statusCode = response.status;
    error.errorCode =
      data?.detail?.code ||
      data?.detail?.status;

    error.requestId =
      data?.detail?.request_id;

    throw error;
  }

  return data as ElevenLabsSubscription;
}

async function generateChunk(
  apiKey: string,
  voiceId: string,
  text: string
): Promise<GeneratedChunk> {
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
      // Ignore invalid JSON.
    }

    const detail = errorData?.detail;

    const error = new Error(
      detail?.message ||
        errorData?.message ||
        `ElevenLabs request failed with status ${response.status}.`
    );

    const typedError = error as Error & {
      statusCode?: number;
      errorCode?: string;
      requestId?: string;
    };

    typedError.statusCode =
      response.status;

    typedError.errorCode =
      detail?.code ||
      detail?.status;

    typedError.requestId =
      detail?.request_id;

    throw typedError;
  }

  const audio =
    await response.arrayBuffer();

  /*
   * ElevenLabs exposes the actual
   * character cost in the response.
   */
  const characterCostHeader =
    response.headers.get(
      "character-cost"
    );

  const parsedCharacterCost =
    characterCostHeader
      ? Number(characterCostHeader)
      : NaN;

  /*
   * If ElevenLabs doesn't return the
   * header, text length is the safest
   * usage fallback.
   */
  const characterCost =
    Number.isFinite(
      parsedCharacterCost
    )
      ? parsedCharacterCost
      : text.length;

  const requestId =
    response.headers.get(
      "request-id"
    ) ||
    response.headers.get(
      "x-request-id"
    ) ||
    null;

  return {
    audio,
    characterCost,
    requestId,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    /*
     * --------------------------------------------------
     * 1. READ REQUEST
     * --------------------------------------------------
     */

    const body =
      await request.json();

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
          success: false,
          error: "Text is required.",
          code: "text_required",
        },
        {
          status: 400,
        }
      );
    }

    if (!voiceId) {
      return NextResponse.json(
        {
          success: false,
          error: "Voice ID is required.",
          code: "voice_required",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * --------------------------------------------------
     * 2. TEXT LIMIT
     * --------------------------------------------------
     */

    if (
      text.length >
      MAX_CHARS_PER_REQUEST
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Text is too long. Maximum supported length is ${MAX_CHARS_PER_REQUEST.toLocaleString()} characters.`,
          code:
            "max_character_limit_exceeded",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * --------------------------------------------------
     * 3. API KEY
     * --------------------------------------------------
     */

    const apiKey =
      process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error(
        "ELEVENLABS_API_KEY is missing."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "ElevenLabs API key is not configured.",
          code: "api_key_missing",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * --------------------------------------------------
     * 4. AUTHENTICATION
     * --------------------------------------------------
     *
     * We keep ZUQEN authentication.
     *
     * The old ZUQEN credit wallet is NOT used.
     */

    const supabase =
      await createServerSupabaseClient();

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must be signed in to generate voice.",
          code:
            "authentication_required",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * --------------------------------------------------
     * 5. READ REAL ELEVENLABS QUOTA
     * --------------------------------------------------
     */

    let subscription:
      ElevenLabsSubscription;

    try {
      subscription =
        await getElevenLabsSubscription(
          apiKey
        );
    } catch (quotaError) {
      const typedError =
        quotaError as Error & {
          statusCode?: number;
          errorCode?: string;
          requestId?: string;
        };

      console.error(
        "ElevenLabs subscription error:",
        typedError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to read the current ElevenLabs usage.",
          code:
            "elevenlabs_usage_check_failed",
        },
        {
          status:
            typedError.statusCode &&
            typedError.statusCode >= 400 &&
            typedError.statusCode < 600
              ? typedError.statusCode
              : 502,
        }
      );
    }

    const characterCount =
      Number(
        subscription.character_count ??
          0
      );

    const characterLimit =
      Number(
        subscription.character_limit ??
          0
      );

    const remainingCharacters =
      Math.max(
        0,
        characterLimit -
          characterCount
      );

    console.log(
      `[Voice Provider] User: ${user.id}`
    );

    console.log(
      `[Voice Provider] ElevenLabs tier: ${subscription.tier ?? "unknown"}`
    );

    console.log(
      `[Voice Provider] Used characters: ${characterCount}`
    );

    console.log(
      `[Voice Provider] Character limit: ${characterLimit}`
    );

    console.log(
      `[Voice Provider] Remaining characters: ${remainingCharacters}`
    );

    /*
     * --------------------------------------------------
     * 6. PROVIDER-SIDE PRECHECK
     * --------------------------------------------------
     *
     * This prevents obviously impossible requests
     * before sending them to ElevenLabs.
     *
     * We do NOT create an artificial ZUQEN price.
     */

    if (
      characterLimit > 0 &&
      remainingCharacters < text.length &&
      subscription.max_credit_limit_extension !==
        "unlimited"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your ElevenLabs character quota is not enough for this voice generation.",
          code:
            "elevenlabs_quota_exceeded",

          provider: "elevenlabs",
          feature: "voice-generator",

          usage: {
            characterCount,
            characterLimit,
            remainingCharacters,
          },
        },
        {
          status: 402,
        }
      );
    }

    /*
     * --------------------------------------------------
     * 7. SPLIT TEXT
     * --------------------------------------------------
     */

    const chunks =
      splitText(
        text,
        MAX_CHARS_PER_REQUEST
      );

    console.log(
      `[Voice Provider] Chunks: ${chunks.length}`
    );

    /*
     * --------------------------------------------------
     * 8. GENERATE AUDIO
     * --------------------------------------------------
     */

    const audioChunks:
      ArrayBuffer[] = [];

    let actualCharacterCost = 0;

    const requestIds:
      string[] = [];

    for (
      let i = 0;
      i < chunks.length;
      i++
    ) {
      console.log(
        `[Voice Provider] Generating chunk ${i + 1}/${chunks.length}...`
      );

      const result =
        await generateChunk(
          apiKey,
          voiceId,
          chunks[i]
        );

      audioChunks.push(
        result.audio
      );

      actualCharacterCost +=
        result.characterCost;

      if (result.requestId) {
        requestIds.push(
          result.requestId
        );
      }

      console.log(
        `[Voice Provider] Chunk ${i + 1} character cost: ${result.characterCost}`
      );
    }

    /*
     * --------------------------------------------------
     * 9. REFRESH PROVIDER QUOTA
     * --------------------------------------------------
     *
     * The generation has succeeded.
     *
     * Read subscription again so ZUQEN receives the
     * latest provider-side usage.
     */

    let finalSubscription:
      ElevenLabsSubscription =
        subscription;

    try {
      finalSubscription =
        await getElevenLabsSubscription(
          apiKey
        );
    } catch (refreshError) {
      console.warn(
        "Unable to refresh ElevenLabs usage after generation:",
        refreshError
      );
    }

    const finalCharacterCount =
      Number(
        finalSubscription.character_count ??
          characterCount +
            actualCharacterCost
      );

    const finalCharacterLimit =
      Number(
        finalSubscription.character_limit ??
          characterLimit
      );

    const finalRemainingCharacters =
      Math.max(
        0,
        finalCharacterLimit -
          finalCharacterCount
      );

    /*
     * --------------------------------------------------
     * 10. COMBINE AUDIO
     * --------------------------------------------------
     */

    const totalLength =
      audioChunks.reduce(
        (
          total,
          chunk
        ) =>
          total +
          chunk.byteLength,
        0
      );

    const combinedAudio =
      new Uint8Array(
        totalLength
      );

    let offset = 0;

    for (
      const chunk of audioChunks
    ) {
      combinedAudio.set(
        new Uint8Array(
          chunk
        ),
        offset
      );

      offset +=
        chunk.byteLength;
    }

    /*
     * --------------------------------------------------
     * 11. SUCCESS
     * --------------------------------------------------
     */

    console.log(
      "===================================="
    );

    console.log(
      "ZUQEN VOICE GENERATION SUCCESS"
    );

    console.log(
      "===================================="
    );

    console.log(
      `User: ${user.id}`
    );

    console.log(
      `Provider: ElevenLabs`
    );

    console.log(
      `Model: ${MODEL_ID}`
    );

    console.log(
      `Actual character cost: ${actualCharacterCost}`
    );

    console.log(
      `Provider characters used: ${finalCharacterCount}`
    );

    console.log(
      `Provider characters remaining: ${finalRemainingCharacters}`
    );

    console.log(
      `Audio bytes: ${totalLength}`
    );

    /*
     * --------------------------------------------------
     * 12. RETURN AUDIO
     * --------------------------------------------------
     *
     * IMPORTANT:
     *
     * No get_credit_balance()
     * No consume_credits()
     * No fake ZUQEN cost.
     */

    return new NextResponse(
      combinedAudio.buffer,
      {
        status: 200,

        headers: {
          "Content-Type":
            "audio/mpeg",

          "Content-Length":
            String(
              combinedAudio.byteLength
            ),

          "Cache-Control":
            "no-store, max-age=0",

          "X-Voice-Model":
            MODEL_ID,

          "X-Voice-Chunks":
            String(
              chunks.length
            ),

          "X-Zuquen-Provider":
            "elevenlabs",

          "X-Zuquen-Feature":
            "voice-generator",

          "X-ElevenLabs-Character-Cost":
            String(
              actualCharacterCost
            ),

          "X-ElevenLabs-Character-Count":
            String(
              finalCharacterCount
            ),

          "X-ElevenLabs-Character-Limit":
            String(
              finalCharacterLimit
            ),

          "X-ElevenLabs-Characters-Remaining":
            String(
              finalRemainingCharacters
            ),

          "X-ElevenLabs-Usage-Tracked":
            "true",

          "X-ElevenLabs-Tier":
            finalSubscription.tier ??
            "unknown",
        },
      }
    );
  } catch (error) {
    const typedError =
      error as Error & {
        statusCode?: number;
        errorCode?: string;
        requestId?: string;
      };

    console.error(
      "===================================="
    );

    console.error(
      "ZUQEN VOICE GENERATION ERROR"
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

    /*
     * ElevenLabs quota error
     */

    if (
      typedError?.errorCode ===
        "quota_exceeded" ||
      typedError?.statusCode === 402
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The ElevenLabs account does not have enough available credits for this generation.",
          code:
            "elevenlabs_quota_exceeded",
          provider:
            "elevenlabs",
          feature:
            "voice-generator",
          requestId:
            typedError.requestId ??
            null,
        },
        {
          status: 402,
        }
      );
    }

    /*
     * Voice not found
     */

    if (
      typedError?.errorCode ===
      "voice_not_found"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected voice could not be found.",
          code:
            "voice_not_found",
          provider:
            "elevenlabs",
          feature:
            "voice-generator",
          requestId:
            typedError.requestId ??
            null,
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Authentication
     */

    if (
      typedError?.statusCode === 401
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ElevenLabs authentication failed. Please check your API key.",
          code:
            "elevenlabs_authentication_failed",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * Permission
     */

    if (
      typedError?.statusCode === 403
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ElevenLabs denied this request. Please check the API key permissions.",
          code:
            "elevenlabs_permission_denied",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Rate limit
     */

    if (
      typedError?.statusCode === 429
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ElevenLabs rate limit was reached. Please try again later.",
          code:
            "elevenlabs_rate_limited",
        },
        {
          status: 429,
        }
      );
    }

    /*
     * Generic error
     */

    return NextResponse.json(
      {
        success: false,
        error:
          typedError?.message ||
          "Failed to generate voice.",
        code:
          typedError?.errorCode ||
          "generation_failed",
        provider:
          "elevenlabs",
        feature:
          "voice-generator",
        requestId:
          typedError?.requestId ??
          null,
      },
      {
        status:
          typedError?.statusCode ||
          500,
      }
    );
  }
}