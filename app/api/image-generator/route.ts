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

function extractErrorDetails(error: unknown) {
  const raw = error as any;

  const status =
    raw?.status ??
    raw?.statusCode ??
    raw?.response?.status ??
    raw?.response?.statusCode ??
    null;

  const message =
    raw?.message ??
    raw?.error?.message ??
    raw?.response?.data?.message ??
    raw?.response?.data?.error ??
    raw?.response?.error?.message ??
    null;

  const code =
    raw?.code ??
    raw?.error?.code ??
    raw?.response?.data?.code ??
    raw?.response?.data?.error?.code ??
    null;

  const type =
    raw?.type ??
    raw?.error?.type ??
    raw?.response?.data?.type ??
    raw?.response?.data?.error?.type ??
    null;

  let responseData = null;

  try {
    if (raw?.response?.data) {
      responseData = raw.response.data;
    } else if (raw?.response?.error) {
      responseData = raw.response.error;
    } else if (raw?.error) {
      responseData = raw.error;
    }
  } catch {
    responseData = null;
  }

  return {
    status,
    message:
      typeof message === "string"
        ? message
        : message
          ? JSON.stringify(message)
          : null,
    code,
    type,
    responseData,
  };
}

function getUserFriendlyFalError(details: {
  status: any;
  message: string | null;
  code: any;
  type: any;
}) {
  const status = Number(details.status);

  if (status === 401) {
    return "fal.ai rejected the API key. Please check that FAL_KEY is correct and active.";
  }

  if (status === 403) {
    return "fal.ai denied this request because the account or API key does not have permission to use this model.";
  }

  if (status === 402) {
    return "fal.ai requires billing or available account credits for this request.";
  }

  if (status === 429) {
    return "fal.ai rate limit was reached. Please wait a moment and try again.";
  }

  if (details.message) {
    return `fal.ai rejected the request: ${details.message}`;
  }

  if (details.code) {
    return `fal.ai rejected the request with code: ${details.code}`;
  }

  if (details.type) {
    return `fal.ai rejected the request with error type: ${details.type}`;
  }

  if (status) {
    return `fal.ai rejected the request with HTTP ${status}.`;
  }

  return "fal.ai rejected the request. Please check your API key and account permissions.";
}

export async function POST(request: Request) {
  let reservationId: string | null = null;
  let supabase: any = null;

  try {
    // ---------------------------------------------------------
    // 1. Validate FAL_KEY
    // ---------------------------------------------------------
    const falKey = process.env.FAL_KEY;

    if (!falKey) {
      return NextResponse.json(
        {
          success: false,
          error: "FAL_KEY is not configured on the server.",
          diagnostic: {
            provider: PROVIDER,
            model: FAL_MODEL,
            environmentVariable: "FAL_KEY",
            configured: false,
          },
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 2. Authenticate Supabase user
    // ---------------------------------------------------------
    supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Please sign in to generate images.",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // 3. Block guest / anonymous users
    // ---------------------------------------------------------
    if (user.is_anonymous) {
      return NextResponse.json(
        {
          success: false,
          error: "Please sign in to generate images.",
          code: "SIGN_IN_REQUIRED",
        },
        { status: 403 }
      );
    }

    // ---------------------------------------------------------
    // 4. Read request
    // ---------------------------------------------------------
    let body: any;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request.",
          code: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    const prompt =
      typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter an image prompt.",
          code: "PROMPT_REQUIRED",
        },
        { status: 400 }
      );
    }

    if (prompt.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          error: "Prompt must be 1000 characters or less.",
          code: "PROMPT_TOO_LONG",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 5. Check current ZUQEN Image Credit balance
    // ---------------------------------------------------------
    const { data: balanceRow, error: balanceError } = await supabase
      .from("feature_credit_balances")
      .select("balance,total_granted,total_used")
      .eq("user_id", user.id)
      .eq("feature_key", FEATURE_KEY)
      .maybeSingle();

    if (balanceError) {
      console.error("Image credit balance lookup failed:", balanceError);

      return NextResponse.json(
        {
          success: false,
          error: "Could not load your Image Generator credits.",
          code: "CREDIT_BALANCE_ERROR",
        },
        { status: 500 }
      );
    }

    const currentBalance = Number(balanceRow?.balance ?? 0);

    if (currentBalance < IMAGE_CREDIT_COST) {
      return NextResponse.json(
        {
          success: false,
          error: "You do not have enough ZUQEN Image Credits.",
          code: "INSUFFICIENT_CREDITS",
          creditsRemaining: currentBalance,
        },
        { status: 402 }
      );
    }

    // ---------------------------------------------------------
    // 6. Reserve 1.00 ZUQEN Image Credit
    // ---------------------------------------------------------
    const providerRequestId = crypto.randomUUID();

    const { data: reservation, error: reservationError } =
      await supabase.rpc("reserve_feature_credits", {
        p_user_id: user.id,
        p_feature_key: FEATURE_KEY,
        p_amount: IMAGE_CREDIT_COST,
        p_provider_request_id: providerRequestId,
        p_reference_id: providerRequestId,
        p_metadata: {
          provider: PROVIDER,
          model: MODEL,
          fal_model: FAL_MODEL,
          prompt_length: prompt.length,
          credits_reserved: IMAGE_CREDIT_COST,
        },
      });

    if (reservationError) {
      console.error(
        "Image credit reservation failed:",
        reservationError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Could not reserve your Image Credit.",
          code: "CREDIT_RESERVATION_ERROR",
          diagnostic: {
            message: reservationError.message,
            details: reservationError.details ?? null,
            hint: reservationError.hint ?? null,
          },
        },
        { status: 500 }
      );
    }

    if (!reservation?.success || !reservation?.reservationId) {
      console.error(
        "Unexpected credit reservation response:",
        reservation
      );

      return NextResponse.json(
        {
          success: false,
          error:
            reservation?.message ??
            "Could not reserve your Image Credit.",
          code:
            reservation?.code ??
            "CREDIT_RESERVATION_FAILED",
        },
        { status: 500 }
      );
    }

    reservationId = reservation.reservationId;

    // ---------------------------------------------------------
    // 7. Configure fal.ai
    // ---------------------------------------------------------
    fal.config({
      credentials: falKey,
    });

    console.log("ZUQEN Image Generator → fal.ai request", {
      userId: user.id,
      provider: PROVIDER,
      model: FAL_MODEL,
      reservationId,
      providerRequestId,
      promptLength: prompt.length,
    });

    // ---------------------------------------------------------
    // 8. Generate image with fal.ai
    // ---------------------------------------------------------
    let falResult: any;

    try {
      falResult = await fal.subscribe(FAL_MODEL, {
        input: {
          prompt,
        },
      });
    } catch (falError) {
      const details = extractErrorDetails(falError);

      console.error("fal.ai generation failed:", {
        status: details.status,
        message: details.message,
        code: details.code,
        type: details.type,
        responseData: details.responseData,
        provider: PROVIDER,
        model: FAL_MODEL,
        reservationId,
        providerRequestId,
      });

      // -------------------------------------------------------
      // 9. Refund ZUQEN credit because provider failed
      // -------------------------------------------------------
      try {
        const { data: refundResult, error: refundError } =
          await supabase.rpc("refund_feature_credit_reservation", {
            p_reservation_id: reservationId,
            p_provider_request_id: providerRequestId,
            p_description: "fal.ai image generation failed",
            p_reference_id: providerRequestId,
            p_metadata: {
              provider: PROVIDER,
              model: MODEL,
              fal_model: FAL_MODEL,
              error_status: details.status,
              error_code: details.code,
              error_type: details.type,
              error_message: details.message,
            },
          });

        if (refundError) {
          console.error(
            "Credit refund failed after fal.ai error:",
            refundError
          );
        } else {
          console.log(
            "ZUQEN Image Credit refunded after fal.ai failure:",
            refundResult
          );
        }
      } catch (refundException) {
        console.error(
          "Unexpected credit refund exception:",
          refundException
        );
      }

      const status =
        Number(details.status) >= 400 &&
        Number(details.status) <= 599
          ? Number(details.status)
          : 502;

      return NextResponse.json(
        {
          success: false,
          error: getUserFriendlyFalError(details),
          code: "FAL_GENERATION_FAILED",

          diagnostic: {
            provider: PROVIDER,
            model: MODEL,
            falModel: FAL_MODEL,
            httpStatus: details.status,
            errorCode: details.code,
            errorType: details.type,
            providerMessage: details.message,
            creditRefunded: true,
          },
        },
        { status }
      );
    }

    // ---------------------------------------------------------
    // 10. Extract generated image URL
    // ---------------------------------------------------------
    const imageUrl = falResult?.data?.images?.[0]?.url;

    if (!imageUrl) {
      console.error(
        "fal.ai returned no image:",
        JSON.stringify(falResult, null, 2)
      );

      // Refund because no usable image was returned
      try {
        const { data: refundResult, error: refundError } =
          await supabase.rpc("refund_feature_credit_reservation", {
            p_reservation_id: reservationId,
            p_provider_request_id: providerRequestId,
            p_description: "fal.ai returned no usable image",
            p_reference_id: providerRequestId,
            p_metadata: {
              provider: PROVIDER,
              model: MODEL,
              fal_model: FAL_MODEL,
              reason: "NO_IMAGE_RETURNED",
            },
          });

        if (refundError) {
          console.error(
            "Credit refund failed after empty fal.ai response:",
            refundError
          );
        } else {
          console.log(
            "ZUQEN Image Credit refunded because fal.ai returned no image:",
            refundResult
          );
        }
      } catch (refundException) {
        console.error(
          "Unexpected refund exception:",
          refundException
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "fal.ai completed the request but returned no image.",
          code: "NO_IMAGE_RETURNED",
          diagnostic: {
            provider: PROVIDER,
            model: MODEL,
            falModel: FAL_MODEL,
            creditRefunded: true,
          },
        },
        { status: 502 }
      );
    }

    // ---------------------------------------------------------
    // 11. Settle exactly 1.00 ZUQEN Image Credit
    // ---------------------------------------------------------
    const { data: settlement, error: settlementError } =
      await supabase.rpc("settle_feature_credit_reservation", {
        p_reservation_id: reservationId,
        p_actual_amount: IMAGE_CREDIT_COST,
        p_provider_request_id: providerRequestId,
        p_description: "Successful fal.ai FLUX image generation",
        p_reference_id: providerRequestId,
        p_metadata: {
          provider: PROVIDER,
          model: MODEL,
          fal_model: FAL_MODEL,
          images_generated: 1,
          credits_consumed: IMAGE_CREDIT_COST,
        },
      });

    if (settlementError) {
      console.error(
        "Image credit settlement failed:",
        settlementError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Image was generated, but credit usage could not be recorded. Please contact support before generating again.",
          code: "CREDIT_SETTLEMENT_ERROR",
          diagnostic: {
            provider: PROVIDER,
            model: MODEL,
            falModel: FAL_MODEL,
            reservationId,
            message: settlementError.message,
          },
        },
        { status: 500 }
      );
    }

    const creditsRemaining = Number(
      settlement?.newBalance ??
        Math.max(0, currentBalance - IMAGE_CREDIT_COST)
    );

    console.log("ZUQEN Image Generator success:", {
      userId: user.id,
      provider: PROVIDER,
      model: FAL_MODEL,
      creditsConsumed: IMAGE_CREDIT_COST,
      creditsRemaining,
    });

    // ---------------------------------------------------------
    // 12. Success response
    // ---------------------------------------------------------
    return NextResponse.json({
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
        creditsConsumed: IMAGE_CREDIT_COST,
        creditsRemaining,
      },

      creditsConsumed: IMAGE_CREDIT_COST,
      creditsRemaining,
    });
  } catch (error) {
    // ---------------------------------------------------------
    // Unexpected error
    // ---------------------------------------------------------
    const details = extractErrorDetails(error);

    console.error("Unexpected Image Generator error:", {
      status: details.status,
      message: details.message,
      code: details.code,
      type: details.type,
      responseData: details.responseData,
      reservationId,
    });

    // Refund any active reservation
    if (reservationId && supabase) {
      try {
        const { data: refundResult, error: refundError } =
          await supabase.rpc("refund_feature_credit_reservation", {
            p_reservation_id: reservationId,
            p_provider_request_id: null,
            p_description: "Unexpected Image Generator error",
            p_reference_id: reservationId,
            p_metadata: {
              provider: PROVIDER,
              model: MODEL,
              fal_model: FAL_MODEL,
              error_status: details.status,
              error_code: details.code,
              error_type: details.type,
              error_message: details.message,
            },
          });

        if (refundError) {
          console.error(
            "Unexpected-error credit refund failed:",
            refundError
          );
        } else {
          console.log(
            "ZUQEN Image Credit refunded after unexpected error:",
            refundResult
          );
        }
      } catch (refundException) {
        console.error(
          "Unexpected refund exception:",
          refundException
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          details.message ??
          "An unexpected error occurred while generating the image.",
        code: "IMAGE_GENERATOR_UNEXPECTED_ERROR",

        diagnostic: {
          provider: PROVIDER,
          model: MODEL,
          falModel: FAL_MODEL,
          httpStatus: details.status,
          errorCode: details.code,
          errorType: details.type,
          creditRefunded: Boolean(reservationId),
        },
      },
      { status: 500 }
    );
  }
}