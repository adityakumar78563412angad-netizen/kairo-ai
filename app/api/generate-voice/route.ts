import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const MODEL_ID = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";

const MAX_CHARS_PER_REQUEST = 40000;

// Flash v2.5 approximate pricing:
// 1 credit ≈ 2 characters
const ESTIMATED_CREDITS_PER_CHARACTER = 0.5;

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

  const sentences =
    cleanText.split(
      /(?<=[.!?।])\s+/
    );

  const chunks: string[] = [];

  let current = "";

  for (const sentence of sentences) {
    const trimmedSentence =
      sentence.trim();

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

    if (
      trimmedSentence.length >
      maxChars
    ) {
      if (current) {
        chunks.push(
          current.trim()
        );

        current = "";
      }

      for (
        let i = 0;
        i < trimmedSentence.length;
        i += maxChars
      ) {
        chunks.push(
          trimmedSentence
            .slice(
              i,
              i + maxChars
            )
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
    chunks.push(
      current.trim()
    );
  }

  return chunks;
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

  const response =
    await fetch(url, {
      method: "POST",

      headers: {
        "xi-api-key": apiKey,
        "Content-Type":
          "application/json",
        Accept: "audio/mpeg",
      },

      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
      }),
    });

  if (!response.ok) {
    let errorData: ElevenLabsError =
      {};

    try {
      errorData =
        await response.json();
    } catch {
      // Ignore invalid JSON.
    }

    const detail =
      errorData?.detail;

    const error = new Error(
      detail?.message ||
        errorData?.message ||
        `ElevenLabs request failed with status ${response.status}.`
    );

    const typedError =
      error as Error & {
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
   * ElevenLabs can return the actual
   * character cost in this response
   * header.
   */
  const characterCostHeader =
    response.headers.get(
      "character-cost"
    );

  const characterCost =
    characterCostHeader
      ? Number(characterCostHeader)
      : text.length;

  return {
    audio,
    characterCost:
      Number.isFinite(
        characterCost
      )
        ? characterCost
        : text.length,
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
      typeof body?.text ===
      "string"
        ? body.text.trim()
        : "";

    const voiceId =
      typeof body?.voiceId ===
      "string"
        ? body.voiceId.trim()
        : "";

    if (!text) {
      return NextResponse.json(
        {
          error:
            "Text is required.",
          code:
            "text_required",
        },
        {
          status: 400,
        }
      );
    }

    if (!voiceId) {
      return NextResponse.json(
        {
          error:
            "Voice ID is required.",
          code:
            "voice_required",
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
      process.env
        .ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error(
        "ELEVENLABS_API_KEY is missing."
      );

      return NextResponse.json(
        {
          error:
            "ElevenLabs API key is not configured.",
          code:
            "api_key_missing",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * --------------------------------------------------
     * 4. SUPABASE SERVER CLIENT
     * --------------------------------------------------
     */

    const supabase =
      await createServerSupabaseClient();

    /*
     * --------------------------------------------------
     * 5. CHECK AUTHENTICATION
     * --------------------------------------------------
     */

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
     * 6. CALCULATE ESTIMATED ZUQEN CREDITS
     * --------------------------------------------------
     */

    const estimatedCredits =
      Math.ceil(
        text.length *
          ESTIMATED_CREDITS_PER_CHARACTER
      );

    console.log(
      `[Voice Credits] User: ${user.id}`
    );

    console.log(
      `[Voice Credits] Characters: ${text.length}`
    );

    console.log(
      `[Voice Credits] Estimated cost: ${estimatedCredits}`
    );

    /*
     * --------------------------------------------------
     * 7. GET CURRENT CREDIT BALANCE
     * --------------------------------------------------
     */

    const {
      data: currentBalanceData,
      error:
        balanceError,
    } =
      await supabase.rpc(
        "get_credit_balance"
      );

    if (balanceError) {
      console.error(
        "Credit balance error:",
        balanceError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check your ZUQEN credit balance.",
          code:
            "credit_balance_error",
        },
        {
          status: 500,
        }
      );
    }

    const currentBalance =
      Number(
        currentBalanceData ?? 0
      );

    console.log(
      `[Voice Credits] Current balance: ${currentBalance}`
    );

    /*
     * --------------------------------------------------
     * 8. CHECK ENOUGH CREDITS
     * --------------------------------------------------
     */

    if (
      currentBalance <
      estimatedCredits
    ) {
      return NextResponse.json(
        {
          error:
            "Not enough ZUQEN credits for this voice generation.",
          code:
            "insufficient_credits",

          required:
            estimatedCredits,

          balance:
            currentBalance,

          missing:
            estimatedCredits -
            currentBalance,
        },
        {
          status: 402,
        }
      );
    }

    /*
     * --------------------------------------------------
     * 9. SPLIT TEXT
     * --------------------------------------------------
     */

    const chunks =
      splitText(
        text,
        MAX_CHARS_PER_REQUEST
      );

    console.log(
      `[Voice] Chunks: ${chunks.length}`
    );

    /*
     * --------------------------------------------------
     * 10. GENERATE AUDIO
     * --------------------------------------------------
     */

    const audioChunks: ArrayBuffer[] =
      [];

    let actualCharacterCost = 0;

    for (
      let i = 0;
      i < chunks.length;
      i++
    ) {
      console.log(
        `[Voice] Generating chunk ${i + 1}/${chunks.length}...`
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

      console.log(
        `[Voice] Chunk ${i + 1} character cost: ${result.characterCost}`
      );
    }

    /*
     * --------------------------------------------------
     * 11. CALCULATE ACTUAL ZUQEN COST
     * --------------------------------------------------
     */

    const actualCredits =
      Math.ceil(
        actualCharacterCost *
          ESTIMATED_CREDITS_PER_CHARACTER
      );

    console.log(
      `[Voice Credits] Actual characters: ${actualCharacterCost}`
    );

    console.log(
      `[Voice Credits] Actual ZUQEN cost: ${actualCredits}`
    );

    /*
     * --------------------------------------------------
     * 12. SAFETY CHECK AGAINST BALANCE
     * --------------------------------------------------
     */

    if (
      currentBalance <
      actualCredits
    ) {
      console.error(
        `[Voice Credits] Actual cost exceeds balance. Balance=${currentBalance}, Cost=${actualCredits}`
      );

      return NextResponse.json(
        {
          error:
            "Your ZUQEN credit balance is not enough for the completed voice generation.",
          code:
            "insufficient_credits",

          required:
            actualCredits,

          balance:
            currentBalance,
        },
        {
          status: 402,
        }
      );
    }

    /*
     * --------------------------------------------------
     * 13. CONSUME ZUQEN CREDITS
     * --------------------------------------------------
     */

    const {
      data: consumeResult,
      error:
        consumeError,
    } =
      await supabase.rpc(
        "consume_credits",
        {
          p_amount:
            actualCredits,

          p_agent:
            "voice-generator",

          p_description:
            `Voice generation using ${MODEL_ID}`,

          p_reference_id:
            crypto.randomUUID(),
        }
      );

    if (consumeError) {
      console.error(
        "Credit consumption error:",
        consumeError
      );

      return NextResponse.json(
        {
          error:
            "Voice was generated, but we could not process your ZUQEN credits. Please contact support.",
          code:
            "credit_processing_error",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * --------------------------------------------------
     * 14. CHECK CONSUMPTION RESULT
     * --------------------------------------------------
     */

    if (
      !consumeResult?.success
    ) {
      console.error(
        "Credit consumption rejected:",
        consumeResult
      );

      return NextResponse.json(
        {
          error:
            "Not enough ZUQEN credits.",
          code:
            "insufficient_credits",

          required:
            actualCredits,

          balance:
            consumeResult?.balance ??
            currentBalance,
        },
        {
          status: 402,
        }
      );
    }

    const newBalance =
      Number(
        consumeResult.balance ??
          currentBalance -
            actualCredits
      );

    /*
     * --------------------------------------------------
     * 15. COMBINE AUDIO
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
     * 16. SUCCESS
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
      `Characters: ${actualCharacterCost}`
    );

    console.log(
      `Credits used: ${actualCredits}`
    );

    console.log(
      `Credits remaining: ${newBalance}`
    );

    console.log(
      `Audio bytes: ${totalLength}`
    );

    /*
     * --------------------------------------------------
     * 17. RETURN AUDIO
     * --------------------------------------------------
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

          "X-Zuqen-Credits-Used":
            String(
              actualCredits
            ),

          "X-Zuqen-Credits-Remaining":
            String(
              newBalance
            ),
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
      "quota_exceeded"
    ) {
      return NextResponse.json(
        {
          error:
            "The ElevenLabs account does not have enough credits for this generation.",
          code:
            "elevenlabs_quota_exceeded",
          message:
            typedError.message,
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
          error:
            "The selected voice could not be found.",
          code:
            "voice_not_found",
          message:
            typedError.message,
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Generic error
     */

    return NextResponse.json(
      {
        error:
          typedError?.message ||
          "Failed to generate voice.",

        code:
          typedError?.errorCode ||
          "generation_failed",

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