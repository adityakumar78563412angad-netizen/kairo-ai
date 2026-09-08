
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

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error("ELEVENLABS_API_KEY is missing.");

      return NextResponse.json(
        {
          error: "ElevenLabs API key is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const pageSizeParam = Number(
      searchParams.get("page_size") || "100"
    );

    // ElevenLabs allows a maximum of 100 voices per request.
    const pageSize = Math.min(
      Math.max(pageSizeParam, 1),
      100
    );

    const params = new URLSearchParams();

    params.set("page_size", String(pageSize));

    // Ask ElevenLabs for the total count because
    // the UI can use it to show how many voices are available.
    params.set("include_total_count", "true");

    if (search.trim()) {
      params.set("search", search.trim());
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v2/voices?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const data: ElevenLabsResponse = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      console.error(
        "ElevenLabs voices API error:",
        response.status,
        data
      );

      return NextResponse.json(
        {
          error:
            "Failed to load voices from ElevenLabs.",
          details:
            typeof data === "object"
              ? data
              : undefined,
        },
        {
          status: response.status,
        }
      );
    }

    const voices = (data.voices || []).map(
      (voice) => {
        const labels = voice.labels || {};

        const firstVerifiedLanguage =
          voice.verified_languages?.[0];

        return {
          id: voice.voice_id,
          name: voice.name || "Unnamed Voice",

          description:
            voice.description ||
            labels.description ||
            `${labels.gender || ""}${
              labels.accent
                ? ` • ${labels.accent}`
                : ""
            }`.trim() ||
            "ElevenLabs AI voice",

          previewUrl:
            voice.preview_url ||
            firstVerifiedLanguage?.preview_url ||
            null,

          gender:
            labels.gender || null,

          age:
            labels.age || null,

          accent:
            labels.accent ||
            firstVerifiedLanguage?.accent ||
            null,

          language:
            firstVerifiedLanguage?.language ||
            null,

          locale:
            firstVerifiedLanguage?.locale ||
            null,

          category:
            voice.category || null,

          voiceType:
            voice.voice_type || null,
        };
      }
    );

    return NextResponse.json(
      {
        voices,

        hasMore: data.has_more ?? false,

        totalCount:
          data.total_count ?? voices.length,

        nextPageToken:
          data.next_page_token ?? null,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",
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
        error:
          "Something went wrong while loading ElevenLabs voices.",
      },
      {
        status: 500,
      }
    );
  }
}

