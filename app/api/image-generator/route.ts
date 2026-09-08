import { NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = "black-forest-labs/FLUX.1-schnell";
const PROVIDER = "auto";

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
          error: "Prompt must be 1000 characters or less.",
        },
        { status: 400 }
      );
    }

    const token = process.env.HF_TOKEN;

    if (!token) {
      console.error(
        "ZUQEN image generator: HF_TOKEN is missing."
      );

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

    /*
     * Hugging Face routed request.
     *
     * We intentionally do NOT create an artificial
     * ZUQEN credit cost here.
     *
     * Hugging Face manages the provider billing/credits
     * for this routed request.
     */
    const image = await client.textToImage(
      {
        model: MODEL,
        inputs: prompt,
        provider: PROVIDER,
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

    /*
     * IMPORTANT:
     * This response means the generation succeeded.
     *
     * We do not deduct a fake fixed number of ZUQEN
     * credits such as 100/500/etc.
     *
     * The actual provider usage is handled by the
     * Hugging Face routed inference account.
     */
    return NextResponse.json(
      {
        success: true,
        image,
        provider: "huggingface",
        feature: "image-generator",
        model: MODEL,
        routedProvider: PROVIDER,
        usage: {
          tracked: false,
          reason:
            "Hugging Face does not expose the account's exact remaining credit balance through this generation response.",
        },
        text: "Image generated successfully by ZUQEN.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Zuquen-Provider": "huggingface",
          "X-Zuquen-Feature": "image-generator",
          "X-Zuquen-Model": MODEL,
          "X-Zuquen-Usage-Tracked": "false",
        },
      }
    );
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
      lowerMessage.includes("invalid token") ||
      lowerMessage.includes("authentication")
    ) {
      message =
        "Hugging Face authentication failed. Please check your HF_TOKEN and make sure it has the required Inference permission.";
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
      lowerMessage.includes("quota")
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
        "The selected image model is currently unavailable.";
    } else if (
      lowerMessage.includes("timeout") ||
      lowerMessage.includes("timed out") ||
      lowerMessage.includes("time out")
    ) {
      message =
        "Image generation timed out. Please try again.";
    }

    /*
     * No ZUQEN credit deduction happens here.
     *
     * If the provider request failed, we simply return
     * the provider error to the frontend.
     */
    return NextResponse.json(
      {
        success: false,
        provider: "huggingface",
        feature: "image-generator",
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