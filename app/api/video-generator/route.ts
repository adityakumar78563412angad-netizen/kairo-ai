import { InferenceClient } from "@huggingface/inference";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = "Wan-AI/Wan2.2-TI2V-5B";
const PROVIDER = "fal-ai";

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
      console.error(
        "ZUQEN video generator: HF_TOKEN is missing."
      );

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

    /*
     * Hugging Face routed inference request.
     *
     * We keep the existing model and Fal AI provider.
     */
    const video = await client.textToVideo({
      model: MODEL,
      inputs: prompt,
      provider: PROVIDER,
    });

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

    /*
     * The SDK returns a Blob for text-to-video.
     *
     * We return the actual video bytes to the frontend.
     *
     * No artificial ZUQEN credit amount is deducted.
     */
    return new Response(video, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store",

        "X-Zuquen-Provider": "huggingface",
        "X-Zuquen-Feature": "video-generator",
        "X-Zuquen-Model": MODEL,
        "X-Zuquen-Routed-Provider": PROVIDER,
        "X-Zuquen-Usage-Tracked": "false",
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
      lowerMessage.includes("invalid token") ||
      lowerMessage.includes("authentication")
    ) {
      message =
        "Hugging Face authentication failed. Please check your HF_TOKEN.";
    } else if (
      lowerMessage.includes("403") ||
      lowerMessage.includes("forbidden") ||
      lowerMessage.includes("permission")
    ) {
      message =
        "Hugging Face denied the request. Please check your token permissions.";
    } else if (
      lowerMessage.includes("402") ||
      lowerMessage.includes("payment required") ||
      lowerMessage.includes("insufficient credit") ||
      lowerMessage.includes("insufficient credits")
    ) {
      message =
        "Hugging Face credits are unavailable for this request. Please check your Hugging Face billing or available credits.";
    } else if (
      lowerMessage.includes("429") ||
      lowerMessage.includes("rate limit") ||
      lowerMessage.includes("too many requests") ||
      lowerMessage.includes("quota") ||
      lowerMessage.includes("credit")
    ) {
      message =
        "Hugging Face rate limit or available credits were reached. Please try again later.";
    } else if (
      lowerMessage.includes("model") &&
      (
        lowerMessage.includes("not found") ||
        lowerMessage.includes("unavailable")
      )
    ) {
      message =
        "The selected video model is currently unavailable.";
    } else if (
      lowerMessage.includes("timeout") ||
      lowerMessage.includes("timed out") ||
      lowerMessage.includes("time out")
    ) {
      message =
        "Video generation timed out. Please try again.";
    }

    /*
     * IMPORTANT:
     *
     * Failed requests do NOT trigger any artificial
     * ZUQEN credit deduction.
     */
    return Response.json(
      {
        success: false,
        provider: "huggingface",
        feature: "video-generator",
        error: message,
      },
      {
        status:
          lowerMessage.includes("401") ||
          lowerMessage.includes("unauthorized")
            ? 401
            : lowerMessage.includes("403") ||
                lowerMessage.includes("forbidden")
              ? 403
              : lowerMessage.includes("429") ||
                  lowerMessage.includes("rate limit") ||
                  lowerMessage.includes("quota")
                ? 429
                : lowerMessage.includes("402") ||
                    lowerMessage.includes("payment required") ||
                    lowerMessage.includes("insufficient credit")
                  ? 402
                  : 500,
      }
    );
  }
}