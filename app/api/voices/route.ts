import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export async function GET() {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs API key is not configured." },
        { status: 500 }
      );
    }

    const elevenlabs = new ElevenLabsClient({
      apiKey,
    });

    const response = await elevenlabs.voices.getAll();

    const voices = response.voices.map((voice) => ({
      id: voice.voiceId,
      name: voice.name,
      description: voice.description ?? "",
      previewUrl: voice.previewUrl ?? null,
    }));

    return NextResponse.json({
      voices,
    });
  } catch (error) {
    console.error("Failed to load ElevenLabs voices:", error);

    return NextResponse.json(
      { error: "Failed to load ElevenLabs voices." },
      { status: 500 }
    );
  }
}