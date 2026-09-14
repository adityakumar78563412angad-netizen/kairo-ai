
import { NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 300;

const FEATURE_KEY = "image_generator";
const PROVIDER = "huggingface";
const MODEL = "black-forest-labs/FLUX.1-schnell";
const ROUTED_PROVIDER = "auto";

const IMAGE_CREDIT_COST = 1.00;

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  let reservationId: string | null = null;

  try {
    // ---------------------------------------------------------
    // 1. Authenticate user
    // ---------------------------------------------------------

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          code: "AUTH_REQUIRED",
          error: "Please sign in to generate images.",
        },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // 2. Guest / anonymous users cannot generate images
    // ---------------------------------------------------------

    if (user.is_anonymous === true) {
      return NextResponse.json(
        {
          success: false,
          code: "SIGN_IN_REQUIRED",
          error: "Please sign in to generate images.",
        },
        { status: 403 }
      );
    }

    // ---------------------------------------------------------
    // 3. Validate prompt
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // 4. Check current Image Generator balance
    // ---------------------------------------------------------

    const { data: balanceRow, error: balanceError } =
      await supabase
        .from("feature_credit_balances")
        .select(
          "balance,total_granted,total_used"
        )
        .eq("user_id", user.id)
        .eq("feature_key", FEATURE_KEY)
        .maybeSingle();

    if (balanceError) {
      console.error(
        "ZUQEN image credit balance error:",
        balanceError
      );

      return NextResponse.json(
        {
          success: false,
          code: "CREDIT_BALANCE_ERROR",
          error:
            "Unable to check your Image Generator credits. Please try again.",
        },
        { status: 500 }
      );
    }

    const currentBalance = Number(
      balanceRow?.balance ?? 0
    );

    if (currentBalance < IMAGE_CREDIT_COST) {
      return NextResponse.json(
        {
          success: false,
          code: "INSUFFICIENT_CREDITS",
          error:
            "You don't have enough Image Generator credits. Please add more credits to continue.",
          credits: {
            balance: currentBalance,
            required: IMAGE_CREDIT_COST,
          },
        },
        { status: 402 }
      );
    }

    // ---------------------------------------------------------
    // 5. Check Hugging Face token
    // ---------------------------------------------------------

    const token = process.env.HF_TOKEN;

    if (!token) {
      console.error(
        "ZUQEN image generator: HF_TOKEN is missing."
      );

      return NextResponse.json(
        {
          success: false,
          code: "HF_TOKEN_MISSING",
          error:
            "Hugging Face token is not configured. Please add HF_TOKEN to your environment variables.",
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 6. Reserve exactly 1.00 ZUQEN Image Credit
    // ---------------------------------------------------------

    const providerRequestId =
      `image-${user.id}-${Date.now()}`;

    const { data: reservation, error: reservationError } =
      await supabase.rpc(
        "reserve_feature_credits",
        {
          p_user_id: user.id,
          p_feature_key: FEATURE_KEY,
          p_amount: IMAGE_CREDIT_COST,
          p_provider_request_id: providerRequestId,
          p_reference_id: providerRequestId,
          p_metadata: {
            source: "image_generator",
            model: MODEL,
            provider: PROVIDER,
            routed_provider: ROUTED_PROVIDER,
            credits_per_image: IMAGE_CREDIT_COST,
          },
        }
      );

    if (reservationError) {
      console.error(
        "ZUQEN image credit reservation error:",
        reservationError
      );

      return NextResponse.json(
        {
          success: false,
          code: "CREDIT_RESERVATION_ERROR",
          error:
            "Unable to reserve Image Generator credits. Please try again.",
        },
        { status: 500 }
      );
    }

    if (!reservation?.success) {
      console.error(
        "ZUQEN image credit reservation failed:",
        reservation
      );

      if (
        reservation?.code ===
        "INSUFFICIENT_CREDITS"
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "INSUFFICIENT_CREDITS",
            error:
              "You don't have enough Image Generator credits. Please add more credits to continue.",
            credits: {
              balance: Number(
                reservation?.newBalance ??
                  currentBalance
              ),
              required: IMAGE_CREDIT_COST,
            },
          },
          { status: 402 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          code: "CREDIT_RESERVATION_ERROR",
          error:
            "Unable to reserve Image Generator credits. Please try again.",
        },
        { status: 500 }
      );
    }

    const reservedId =
      reservation.reservationId ??
      reservation.reservation_id;

    if (typeof reservedId !== "string") {
      console.error(
        "ZUQEN image generator: reservation ID missing:",
        reservation
      );

      return NextResponse.json(
        {
          success: false,
          code: "CREDIT_RESERVATION_ERROR",
          error:
            "Image Generator credit reservation could not be created.",
        },
        { status: 500 }
      );
    }

    reservationId = reservedId;

    // ---------------------------------------------------------
    // 7. Generate image with Hugging Face
    // ---------------------------------------------------------

    const client = new InferenceClient(token);

    const image = await client.textToImage(
      {
        model: MODEL,
        inputs: prompt,
        provider: ROUTED_PROVIDER,
      },
      {
        outputType: "dataUrl",
      }
    );

    if (!image) {
      throw new Error(
        "Hugging Face did not return an image."
      );
    }

    // ---------------------------------------------------------
    // 8. Successful generation = exactly 1.00 credit
    // ---------------------------------------------------------

    const settlementReservationId: string =
      reservationId;

    const {
      data: settlement,
      error: settlementError,
    } = await supabase.rpc(
      "settle_feature_credit_reservation",
      {
        p_reservation_id:
          settlementReservationId,
        p_actual_amount: IMAGE_CREDIT_COST,
        p_provider_request_id:
          providerRequestId,
        p_description:
          "FLUX.1-schnell image generation",
        p_reference_id: providerRequestId,
        p_metadata: {
          source: "image_generator",
          model: MODEL,
          provider: PROVIDER,
          routed_provider: ROUTED_PROVIDER,
          prompt_length: prompt.length,
          credits_consumed: IMAGE_CREDIT_COST,
        },
      }
    );

    if (settlementError) {
      console.error(
        "ZUQEN image credit settlement error:",
        settlementError
      );

      // Try to refund if settlement failed.
      try {
        await supabase.rpc(
          "refund_feature_credit_reservation",
          {
            p_reservation_id:
              settlementReservationId,
            p_provider_request_id:
              providerRequestId,
            p_description:
              "Image Generator settlement failed - reservation refunded",
            p_reference_id: providerRequestId,
            p_metadata: {
              source: "image_generator",
              reason:
                "settlement_failed",
              model: MODEL,
            },
          }
        );
      } catch (refundError) {
        console.error(
          "ZUQEN image credit emergency refund error:",
          refundError
        );
      }

      return NextResponse.json(
        {
          success: false,
          code: "CREDIT_SETTLEMENT_ERROR",
          error:
            "The image was generated, but the credit transaction could not be completed. Please contact support before generating again.",
        },
        { status: 500 }
      );
    }

    if (!settlement?.success) {
      console.error(
        "ZUQEN image credit settlement failed:",
        settlement
      );

      return NextResponse.json(
        {
          success: false,
          code: "CREDIT_SETTLEMENT_ERROR",
          error:
            "The image was generated, but the credit transaction could not be completed.",
        },
        { status: 500 }
      );
    }

    // Reservation is now settled.
    reservationId = null;

    const creditsRemaining = Number(
      settlement?.newBalance ?? 0
    );

    // ---------------------------------------------------------
    // 9. Return successful response
    // ---------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        image,
        provider: PROVIDER,
        feature: FEATURE_KEY,
        model: MODEL,
        routedProvider: ROUTED_PROVIDER,

        usage: {
          tracked: true,
          imagesGenerated: 1,
        },

        billing: {
          creditsConsumed: IMAGE_CREDIT_COST,
          creditsRemaining,
        },

        creditsConsumed: IMAGE_CREDIT_COST,
        creditsRemaining,

        text: "Image generated successfully by ZUQEN.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Zuquen-Provider": PROVIDER,
          "X-Zuquen-Feature": FEATURE_KEY,
          "X-Zuquen-Model": MODEL,
          "X-Zuquen-Credits-Consumed":
            IMAGE_CREDIT_COST.toFixed(2),
          "X-Zuquen-Credits-Remaining":
            creditsRemaining.toFixed(2),
        },
      }
    );
  } catch (error: unknown) {
    console.error(
      "ZUQEN image generation error:",
      error
    );

    // ---------------------------------------------------------
    // 10. Refund reserved credit after any generation failure
    // ---------------------------------------------------------

    if (typeof reservationId === "string") {
      try {
        const {
          data: refund,
          error: refundError,
        } = await supabase.rpc(
          "refund_feature_credit_reservation",
          {
            p_reservation_id:
              reservationId,
            p_provider_request_id:
              `image-refund-${Date.now()}`,
            p_description:
              "Failed Image Generator request - credit refunded",
            p_reference_id: reservationId,
            p_metadata: {
              source: "image_generator",
              model: MODEL,
              reason:
                "image_generation_failed",
            },
          }
        );

        if (refundError) {
          console.error(
            "ZUQEN image credit refund error:",
            refundError
          );
        } else {
          console.log(
            "ZUQEN image credit reservation refunded:",
            refund
          );
        }
      } catch (refundError) {
        console.error(
          "ZUQEN image credit refund exception:",
          refundError
        );
      }
    }

    let message =
      "Image generation failed. Please try again.";

    if (error instanceof Error) {
      message = error.message;
    }

    const lowerMessage =
      message.toLowerCase();

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
      (lowerMessage.includes("not found") ||
        lowerMessage.includes("unavailable"))
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

    let status = 500;

    if (
      lowerMessage.includes("401") ||
      lowerMessage.includes("unauthorized")
    ) {
      status = 401;
    } else if (
      lowerMessage.includes("403") ||
      lowerMessage.includes("forbidden")
    ) {
      status = 403;
    } else if (
      lowerMessage.includes("429") ||
      lowerMessage.includes("rate limit") ||
      lowerMessage.includes("quota")
    ) {
      status = 429;
    } else if (
      lowerMessage.includes("402") ||
      lowerMessage.includes("payment required") ||
      lowerMessage.includes("insufficient credit")
    ) {
      status = 402;
    }

    return NextResponse.json(
      {
        success: false,
        provider: PROVIDER,
        feature: FEATURE_KEY,
        model: MODEL,
        error: message,
        creditRefunded:
          typeof reservationId === "string"
            ? "attempted"
            : "not_required",
      },
      { status }
    );
  }
}

