import { NextRequest, NextResponse } from "next/server";

type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  description?: string | null;
  preview_url?: string | null;
  labels?: Record<string, string> | null;
  category?: string | null;
  voice_type?: string | null;

  verified_languages?: Array<{
    language?: string;
    model_id?: string;
    accent?: string;
    locale?: string;
    preview_url?: string;
  }> | null;
};

type ElevenLabsResponse = {
  voices?: ElevenLabsVoice[];
  has_more?: boolean;
  total_count?: number;
  next_page_token?: string | null;
};

export const runtime = "nodejs";

export async function GET(
  request: NextRequest
) {
  try {
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
          code:
            "api_key_missing",
        },
        {
          status: 500,
        }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const search =
      searchParams
        .get("search")
        ?.trim();

    const gender =
      searchParams.get("gender");

    const age =
      searchParams.get("age");

    const language =
      searchParams.get("language");

    const accent =
      searchParams.get("accent");

    const category =
      searchParams.get("category");

    const voiceType =
      searchParams.get(
        "voice_type"
      );

    const sort =
      searchParams.get("sort");

    const sortDirection =
      searchParams.get(
        "sort_direction"
      );

    const nextPageToken =
      searchParams.get(
        "next_page_token"
      );

    const pageSizeValue =
      Number(
        searchParams.get(
          "page_size"
        ) || "50"
      );

    const pageSize = Math.min(
      Math.max(
        Number.isFinite(
          pageSizeValue
        )
          ? pageSizeValue
          : 50,
        1
      ),
      100
    );

    const params =
      new URLSearchParams();

    params.set(
      "page_size",
      String(pageSize)
    );

    params.set(
      "include_total_count",
      "true"
    );

    if (search) {
      params.set(
        "search",
        search
      );
    }

    if (
      gender &&
      gender !== "all"
    ) {
      params.set(
        "gender",
        gender
      );
    }

    if (
      age &&
      age !== "all"
    ) {
      params.set(
        "age",
        age
      );
    }

    if (
      language &&
      language !== "all"
    ) {
      params.set(
        "language",
        language
      );
    }

    if (
      accent &&
      accent !== "all"
    ) {
      params.set(
        "accent",
        accent
      );
    }

    if (
      category &&
      category !== "all"
    ) {
      params.set(
        "category",
        category
      );
    }

    if (
      voiceType &&
      voiceType !== "all"
    ) {
      params.set(
        "voice_type",
        voiceType
      );
    }

    if (sort) {
      params.set(
        "sort",
        sort
      );
    }

    if (sortDirection) {
      params.set(
        "sort_direction",
        sortDirection
      );
    }

    if (nextPageToken) {
      params.set(
        "next_page_token",
        nextPageToken
      );
    }

    const response =
      await fetch(
        `https://api.elevenlabs.io/v2/voices?${params.toString()}`,
        {
          method: "GET",

          headers: {
            "xi-api-key":
              apiKey,
            Accept:
              "application/json",
          },

          cache: "no-store",
        }
      );

    const data: ElevenLabsResponse =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      console.error(
        "ElevenLabs voices error:",
        response.status,
        data
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to load voices from ElevenLabs.",
          code:
            "voices_request_failed",
        },
        {
          status:
            response.status,
        }
      );
    }

    const voices =
      (data.voices || []).map(
        (voice) => {
          const labels =
            voice.labels ||
            {};

          const firstLanguage =
            voice
              .verified_languages?.[0];

          return {
            id:
              voice.voice_id,

            name:
              voice.name ||
              "Unnamed Voice",

            description:
              voice.description ||
              labels.description ||
              "ElevenLabs AI voice",

            previewUrl:
              voice.preview_url ||
              firstLanguage?.preview_url ||
              null,

            gender:
              labels.gender ||
              null,

            age:
              labels.age ||
              null,

            accent:
              labels.accent ||
              firstLanguage?.accent ||
              null,

            language:
              firstLanguage?.language ||
              labels.language ||
              null,

            locale:
              firstLanguage?.locale ||
              null,

            category:
              voice.category ||
              null,

            voiceType:
              voice.voice_type ||
              null,
          };
        }
      );

    return NextResponse.json(
      {
        success: true,

        voices,

        hasMore:
          data.has_more ??
          false,

        totalCount:
          data.total_count ??
          voices.length,

        nextPageToken:
          data.next_page_token ??
          null,

        provider:
          "elevenlabs",

        feature:
          "voice-generator",
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",

          "X-Zuquen-Provider":
            "elevenlabs",

          "X-Zuquen-Feature":
            "voice-generator",
        },
      }
    );
  } catch (error) {
    console.error(
      "Failed to load ElevenLabs voices:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Something went wrong while loading voices from ElevenLabs.",
        code:
          "voices_load_failed",
      },
      {
        status: 500,
      }
    );
  }
}