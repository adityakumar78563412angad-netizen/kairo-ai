import { InferenceClient } from "@huggingface/inference";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const prompt =
      typeof body?.prompt === "string"
        ? body.prompt.trim()
        : "";

    if (!prompt) {
      return Response.json(
        {
          success: false,
          error: "Please enter a video prompt.",
        },
        { status: 400 }
      );
    }

    if (prompt.length > 1000) {
      return Response.json(
        {
          success: false,
          error: "Prompt must be 1000 characters or less.",
        },
        { status: 400 }
      );
    }

    const token = process.env.HF_TOKEN;

    if (!token) {
      return Response.json(
        {
          success: false,
          error:
            "Hugging Face token is not configured. Please add HF_TOKEN to your environment variables.",
        },
        { status: 500 }
      );
    }

    const client = new InferenceClient(token);

   const video = await client.textToVideo(
  {
    model: "Wan-AI/Wan2.2-TI2V-5B",
    inputs: prompt,
    provider: "fal-ai",
  }
);

    if (!video) {
      return Response.json(
        {
          success: false,
          error:
            "Hugging Face did not return a video.",
        },
        { status: 502 }
      );
    }

   return new Response(video, {
  status: 200,
  headers: {
    "Content-Type": "video/mp4",
    "Cache-Control": "no-store",
  },
});
  } catch (error: unknown) {
    console.error(
      "ZUQEN video generation error:",
      error
    );

    let message =
      "Video generation failed. Please try again.";

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
        "Hugging Face authentication failed. Please check your HF_TOKEN.";
    } else if (
      lowerMessage.includes("403") ||
      lowerMessage.includes("forbidden")
    ) {
      message =
        "Hugging Face denied the request. Please check your token permissions.";
    } else if (
      lowerMessage.includes("429") ||
      lowerMessage.includes("rate limit") ||
      lowerMessage.includes("quota") ||
      lowerMessage.includes("credit")
    ) {
      message =
        "Hugging Face free credits or rate limit have been reached. Please try again later.";
    } else if (
      lowerMessage.includes("model") &&
      lowerMessage.includes("not found")
    ) {
      message =
        "The selected video model is currently unavailable.";
    } else if (
      lowerMessage.includes("timeout") ||
      lowerMessage.includes("timed out")
    ) {
      message =
        "Video generation timed out. Please try again.";
    }

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}