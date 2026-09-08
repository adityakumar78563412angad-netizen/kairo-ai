import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const text = body?.text;
    const voiceId = body?.voiceId;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required." },
        { status: 400 }
      );
    }

    if (!voiceId || typeof voiceId !== "string") {
      return NextResponse.json(
        { error: "Voice ID is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error("ELEVENLABS_API_KEY is missing.");

      return NextResponse.json(
        { error: "ElevenLabs API key is not configured." },
        { status: 500 }
      );
    }

    const elevenlabs = new ElevenLabsClient({
      apiKey,
    });

    const audio = await elevenlabs.textToSpeech.convert(voiceId, {
      text,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
    });

    return new NextResponse(audio as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ElevenLabs generation error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate voice.",
      },
      { status: 500 }
    );
  }
}