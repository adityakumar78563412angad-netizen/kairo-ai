import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 300;

const FEATURE_KEY = "image_generator";
const PROVIDER = "fal";
const MODEL = "black-forest-labs/FLUX.1-schnell";
const FAL_MODEL = "fal-ai/flux/schnell";
const IMAGE_CREDIT_COST = 1.0;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null
  ) {
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error.";
    }
  }

  return String(error);
}

function getErrorStatus(message: string): number {
  const lower = message.toLowerCase();

  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key") ||
    lower.includes("invalid key") ||
    lower.includes("authentication")
  ) {
    return 401;
  }

  if (
    lower.includes("403") ||
    lower.includes("forbidden") ||
    lower.includes("permission")
  ) {
    return 403;
  }

  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  ) {
    return 429;
  }

  if (
    lower.includes("402") ||
    lower.includes("payment required") ||
    lower.includes("insufficient balance") ||
    lower.includes("insufficient funds") ||
    lower.includes("billing")
  ) {
    return 402;
  }

  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("time out")
  ) {
    return 504;
  }

  return 500;
}

export async function POST(request: Request) {
  let reservationId: string | null = null;

  try {
    const supabase = await createServerSupabaseClient();

    /*
     * ---------------------------------------------------------
     * 1. AUTHENTICATION
     * ---------------------------------------------------------
     */

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

    /*
     * Guests / anonymous users cannot generate images.
     */

    if (user.is_anonymous) {
      return NextResponse.json(
        {
          success: false,
          code: "SIGN_IN_REQUIRED",
          error: "Please sign in to generate images.",
        },
        { status: 403 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. VALIDATE PROMPT
     * ---------------------------------------------------------
     */

    const body = await request.json();

    const prompt =
      typeof body?.prompt === "string"
        ? body.prompt.trim()
        : "";

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          code: "PROMPT_REQUIRED",
          error: "Please enter an image prompt.",
        },
        { status: 400 }
      );
    }

    if (prompt.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          code: "PROMPT_TOO_LONG",
          error:
            "Prompt must be 1000 characters or less.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 3. CHECK FAL KEY
     * ---------------------------------------------------------
     */

    const falKey = process.env.FAL_KEY;

    if (!falKey) {
      console.error(
        "ZUQEN image generator: FAL_KEY is missing."
      );

      return NextResponse.json(
        {
          success: false,
          code: "PROVIDER_NOT_CONFIGURED",
          error:
            "Image generation provider is not configured. Please add FAL_KEY to the environment variables.",
        },
        { status: 500 }
      );
    }

    /*
     * The official fal client reads FAL_KEY from the
     * server environment.
     */

    fal.config({
      credentials: falKey,
    });

    /*
     * ---------------------------------------------------------
     * 4. READ CURRENT ZUQEN IMAGE CREDIT BALANCE
     * ---------------------------------------------------------
     */

    const { data: balanceRow, error: balanceError } =
      await supabase
        .from("feature_credit_balances")
        .select("balance")
        .eq("user_id", user.id)
        .eq("feature_key", FEATURE_KEY)
        .maybeSingle();

    if (balanceError) {
      console.error(
        "ZUQEN image generator balance error:",
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

    /*
     * ---------------------------------------------------------
     * 5. CHECK ZUQEN CREDIT
     * ---------------------------------------------------------
     */

    if (currentBalance < IMAGE_CREDIT_COST) {
      return NextResponse.json(
        {
          success: false,
          code: "INSUFFICIENT_CREDITS",
          error:
            "You don't have enough Image Generator credits.",
          creditsRemaining: currentBalance,
        },
        { status: 402 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. RESERVE 1.00 ZUQEN IMAGE CREDIT
     * ---------------------------------------------------------
     */

    const providerRequestId =
      `fal_${user.id}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;

    const { data: reservation, error: reserveError } =
      await supabase.rpc(
        "reserve_feature_credits",
        {
          p_user_id: user.id,
          p_feature_key: FEATURE_KEY,
          p_amount: IMAGE_CREDIT_COST,
          p_provider_request_id:
            providerRequestId,
          p_reference_id: providerRequestId,
          p_metadata: {
            source: "image_generator",
            provider: PROVIDER,
            model: MODEL,
            fal_model: FAL_MODEL,
            credits_reserved: IMAGE_CREDIT_COST,
            prompt_length: prompt.length,
          },
        }
      );

    if (reserveError) {
      console.error(
        "ZUQEN image credit reservation error:",
        reserveError
      );

      return NextResponse.json(
        {
          success: false,
          code: "CREDIT_RESERVATION_ERROR",
          error:
            "Unable to reserve your Image Generator credit. Please try again.",
        },
        { status: 500 }
      );
    }

    if (
      !reservation ||
      reservation.success !== true
    ) {
      const reservationCode =
        reservation?.code;

      if (
        reservationCode ===
        "INSUFFICIENT_CREDITS"
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "INSUFFICIENT_CREDITS",
            error:
              "You don't have enough Image Generator credits.",
          },
          { status: 402 }
        );
      }

      console.error(
        "Unexpected credit reservation response:",
        reservation
      );

      return NextResponse.json(
        {
          success: false,
          code: "CREDIT_RESERVATION_ERROR",
          error:
            "Unable to reserve your Image Generator credit. Please try again.",
        },
        { status: 500 }
      );
    }

    reservationId =
      reservation.reservationId;

    /*
     * ---------------------------------------------------------
     * 7. GENERATE IMAGE THROUGH FAL
     * ---------------------------------------------------------
     */

    let falResult: Awaited<
      ReturnType<typeof fal.subscribe>
    >;

    try {
      falResult = await fal.subscribe(
        FAL_MODEL,
        {
          input: {
            prompt,
          },
        }
      );
    } catch (providerError) {
      /*
       * Provider failed.
       * The reservation MUST be refunded.
       */

      const providerMessage =
        getErrorMessage(providerError);

      console.error(
        "ZUQEN fal image generation error:",
        providerMessage
      );

      try {
        await supabase.rpc(
          "refund_feature_credit_reservation",
          {
            p_reservation_id:
              reservationId,
            p_provider_request_id:
              providerRequestId,
            p_description:
              "Image Generator credit refunded after fal generation failure",
            p_reference_id:
              providerRequestId,
            p_metadata: {
              provider: PROVIDER,
              model: MODEL,
              fal_model: FAL_MODEL,
              reason: "provider_error",
              error: providerMessage,
            },
          }
        );
      } catch (refundError) {
        console.error(
          "CRITICAL: failed to refund Image Generator credit:",
          refundError
        );
      }

      let userMessage =
        "Image generation failed. Your Image Credit was refunded.";

      const lower =
        providerMessage.toLowerCase();

      if (
        lower.includes("401") ||
        lower.includes("unauthorized") ||
        lower.includes("invalid api key") ||
        lower.includes("invalid key") ||
        lower.includes("authentication")
      ) {
        userMessage =
          "fal.ai authentication failed. Please check your FAL_KEY.";
      } else if (
        lower.includes("403") ||
        lower.includes("forbidden") ||
        lower.includes("permission")
      ) {
        userMessage =
          "fal.ai denied the request. Please check your API key and account permissions.";
      } else if (
        lower.includes("402") ||
        lower.includes("payment required") ||
        lower.includes("insufficient balance") ||
        lower.includes("insufficient funds") ||
        lower.includes("billing")
      ) {
        userMessage =
          "The fal.ai account does not have enough available balance to generate this image. Your ZUQEN Image Credit was refunded.";
      } else if (
        lower.includes("429") ||
        lower.includes("rate limit") ||
        lower.includes("too many requests")
      ) {
        userMessage =
          "fal.ai rate limit was reached. Your ZUQEN Image Credit was refunded. Please try again later.";
      } else if (
        lower.includes("timeout") ||
        lower.includes("timed out") ||
        lower.includes("time out")
      ) {
        userMessage =
          "Image generation timed out. Your ZUQEN Image Credit was refunded.";
      }

      return NextResponse.json(
        {
          success: false,
          code: "IMAGE_GENERATION_FAILED",
          provider: PROVIDER,
          model: MODEL,
          error: userMessage,
        },
        {
          status:
            getErrorStatus(providerMessage),
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. EXTRACT IMAGE
     * ---------------------------------------------------------
     */

    const imageUrl =
      falResult?.data?.images?.[0]?.url;

    if (!imageUrl) {
      console.error(
        "ZUQEN fal response did not contain an image:",
        falResult?.data
      );

      /*
       * Refund because generation did not
       * produce a usable image.
       */

      try {
        await supabase.rpc(
          "refund_feature_credit_reservation",
          {
            p_reservation_id:
              reservationId,
            p_provider_request_id:
              providerRequestId,
            p_description:
              "Image Generator credit refunded because fal returned no image",
            p_reference_id:
              providerRequestId,
            p_metadata: {
              provider: PROVIDER,
              model: MODEL,
              fal_model: FAL_MODEL,
              reason: "missing_image",
            },
          }
        );
      } catch (refundError) {
        console.error(
          "CRITICAL: failed to refund missing-image reservation:",
          refundError
        );
      }

      return NextResponse.json(
        {
          success: false,
          code: "IMAGE_NOT_RETURNED",
          provider: PROVIDER,
          model: MODEL,
          error:
            "fal.ai completed the request but did not return an image. Your Image Credit was refunded.",
        },
        { status: 502 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 9. SETTLE EXACTLY 1.00 ZUQEN IMAGE CREDIT
     * ---------------------------------------------------------
     */

    const {
      data: settlement,
      error: settlementError,
    } = await supabase.rpc(
      "settle_feature_credit_reservation",
      {
        p_reservation_id:
          reservationId,
        p_actual_amount:
          IMAGE_CREDIT_COST,
        p_provider_request_id:
          providerRequestId,
        p_description:
          "Successful FLUX.1-schnell image generation",
        p_reference_id:
          providerRequestId,
        p_metadata: {
          provider: PROVIDER,
          model: MODEL,
          fal_model: FAL_MODEL,
          credits_consumed:
            IMAGE_CREDIT_COST,
          images_generated: 1,
          prompt_length: prompt.length,
        },
      }
    );

    if (
      settlementError ||
      !settlement ||
      settlement.success !== true
    ) {
      console.error(
        "ZUQEN image credit settlement failed:",
        settlementError,
        settlement
      );

      /*
       * Emergency refund attempt.
       */
      try {
        await supabase.rpc(
          "refund_feature_credit_reservation",
          {
            p_reservation_id:
              reservationId,
            p_provider_request_id:
              providerRequestId,
            p_description:
              "Emergency Image Generator credit refund after settlement failure",
            p_reference_id:
              providerRequestId,
            p_metadata: {
              provider: PROVIDER,
              model: MODEL,
              fal_model: FAL_MODEL,
              reason:
                "settlement_failed",
            },
          }
        );
      } catch (refundError) {
        console.error(
          "CRITICAL: emergency Image Generator refund failed:",
          refundError
        );
      }

      return NextResponse.json(
        {
          success: false,
          code: "CREDIT_SETTLEMENT_ERROR",
          provider: PROVIDER,
          model: MODEL,
          error:
            "The image was generated, but ZUQEN could not safely finalize the credit transaction. Your credit was protected and the request needs to be retried.",
        },
        { status: 500 }
      );
    }

    const creditsRemaining = Number(
      settlement.newBalance ?? 0
    );

    /*
     * ---------------------------------------------------------
     * 10. SUCCESS
     * ---------------------------------------------------------
     */

    return NextResponse.json(
      {
        success: true,
        image: imageUrl,
        provider: PROVIDER,
        feature: FEATURE_KEY,
        model: MODEL,
        falModel: FAL_MODEL,

        usage: {
          tracked: true,
          imagesGenerated: 1,
        },

        billing: {
          creditsConsumed:
            IMAGE_CREDIT_COST,
          creditsRemaining,
        },

        creditsConsumed:
          IMAGE_CREDIT_COST,
        creditsRemaining,

        text:
          "Image generated successfully by ZUQEN.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
          "X-Zuquen-Provider":
            PROVIDER,
          "X-Zuquen-Feature":
            FEATURE_KEY,
          "X-Zuquen-Model":
            MODEL,
          "X-Zuquen-Usage-Tracked":
            "true",
        },
      }
    );
  } catch (error: unknown) {
    /*
     * ---------------------------------------------------------
     * UNEXPECTED ERROR
     * ---------------------------------------------------------
     */

    const message =
      getErrorMessage(error);

    console.error(
      "ZUQEN image generator unexpected error:",
      error
    );

    /*
     * If a reservation exists, attempt to refund it.
     */

    if (reservationId) {
      try {
        const supabase =
          await createServerSupabaseClient();

        await supabase.rpc(
          "refund_feature_credit_reservation",
          {
            p_reservation_id:
              reservationId,
            p_provider_request_id:
              null,
            p_description:
              "Image Generator credit refunded after unexpected error",
            p_reference_id:
              reservationId,
            p_metadata: {
              provider: PROVIDER,
              model: MODEL,
              fal_model: FAL_MODEL,
              reason:
                "unexpected_server_error",
              error: message,
            },
          }
        );
      } catch (refundError) {
        console.error(
          "CRITICAL: unexpected-error refund failed:",
          refundError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        code: "IMAGE_GENERATION_ERROR",
        provider: PROVIDER,
        feature: FEATURE_KEY,
        error:
          "Image generation failed. Your Image Credit was protected.",
      },
      {
        status: 500,
      }
    );
  }
}