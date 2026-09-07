
import { NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";

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

    const token = process.env.HF_TOKEN;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Hugging Face token is not configured. Please add HF_TOKEN to your environment variables.",
        },
        { status: 500 }
      );
    }

    const client = new InferenceClient(token);

    const image = await client.textToImage(
      {
        model: "black-forest-labs/FLUX.1-schnell",
        inputs: prompt,
        provider: "auto",
      },
      {
        outputType: "dataUrl",
      }
    );

    if (!image) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Hugging Face did not return an image.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      image,
      text: "Image generated successfully by ZUQEN.",
    });
  } catch (error: unknown) {
    console.error(
      "ZUQEN image generation error:",
      error
    );

    let message =
      "Image generation failed. Please try again.";

    if (error instanceof Error) {
      message = error.message;
    }

    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes("401") ||
      lowerMessage.includes("unauthorized") ||
      lowerMessage.includes("invalid token")
    ) {
      message =
        "Hugging Face authentication failed. Please check your HF_TOKEN and make sure it has Inference permission.";
    } else if (
      lowerMessage.includes("403") ||
      lowerMessage.includes("forbidden")
    ) {
      message =
        "Hugging Face denied the request. Please check your token permissions.";
    } else if (
      lowerMessage.includes("429") ||
      lowerMessage.includes("rate limit") ||
      lowerMessage.includes("quota")
    ) {
      message =
        "Hugging Face rate limit or available credits were reached. Please try again later.";
    } else if (
      lowerMessage.includes("model") &&
      lowerMessage.includes("not found")
    ) {
      message =
        "The selected image model is currently unavailable.";
    } else if (
      lowerMessage.includes("timeout") ||
      lowerMessage.includes("timed out")
    ) {
      message =
        "Image generation timed out. Please try again.";
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

