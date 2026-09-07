import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt =
      typeof body?.prompt === "string"
        ? body.prompt.trim()
        : "";

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter an image prompt.",
        },
        { status: 400 }
      );
    }

    if (prompt.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Prompt must be 1000 characters or less.",
        },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini API key is not configured.",
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];

    const textParts: string[] = [];

    for (const part of parts) {
      if (part.text) {
        textParts.push(part.text);
      }

      const inlineData = part.inlineData;

      if (
        inlineData?.data &&
        inlineData?.mimeType
      ) {
        const imageUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`;

        return NextResponse.json({
          success: true,
          image: imageUrl,
          text: textParts.join("\n").trim(),
        });
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "The AI did not return an image. Please try another prompt.",
      },
      { status: 502 }
    );
  } catch (error) {
    console.error(
      "Image generation failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Image generation failed.",
      },
      { status: 500 }
    );
  }
}