import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const text = body?.text;
    const voiceId = body?.voiceId;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        {
          error: "Text is required.",
        },
        { status: 400 }
      );
    }

    if (!voiceId || typeof voiceId !== "string") {
      return NextResponse.json(
        {
          error: "Voice ID is required.",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error("ELEVENLABS_API_KEY is missing.");

      return NextResponse.json(
        {
          error: "ElevenLabs API key is not configured.",
        },
        { status: 500 }
      );
    }

    console.log(
      `Generating voice: ${text.length} characters, voice: ${voiceId}`
    );

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
  } catch (error: any) {
    console.error("=================================");
    console.error("ELEVENLABS GENERATION ERROR");
    console.error("=================================");

    console.error("Error:", error);
    console.error("Message:", error?.message);
    console.error("Status:", error?.statusCode);
    console.error("Body:", error?.body);
    console.error("Response:", error?.response);

    let errorMessage = "Failed to generate voice.";

    if (error?.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        status: error?.statusCode || 500,
      },
      {
        status: error?.statusCode || 500,
      }
    );
  }
}