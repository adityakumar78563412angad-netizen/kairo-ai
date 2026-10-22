
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const FEATURE_KEY = "image_generator";
const IMAGE_CREDIT_COST = 1;
const IMAGE_CREDIT_AMOUNT = 10;

const CLOUDFLARE_MODEL =
  process.env.CLOUDFLARE_IMAGE_MODEL ||
  "@cf/black-forest-labs/flux-1-schnell";

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function fail(
  error: string,
  status: number,
  extra: AnyRecord = {}
) {
  return NextResponse.json(
    { success: false, error, ...extra },
    { status }
  );
}

async function refundReservation(
  supabase: any,
  reservationId: string | null,
  requestId: string,
  description: string,
  metadata: AnyRecord = {}
) {
  if (!reservationId) return;

  const { error } = await supabase.rpc(
    "refund_feature_credit_reservation",
    {
      p_reservation_id: reservationId,
      p_provider_request_id: requestId,
      p_description: description,
      p_reference_id: requestId,
      p_metadata: {
        provider: "cloudflare-workers-ai",
        model: CLOUDFLARE_MODEL,
        ...metadata,
      },
    }
  );

  if (error) {
    console.error(
      "Cloudflare image credit refund failed:",
      error.message
    );
  }
}

export async function POST(request: Request) {
  let supabase: any = null;
  let reservationId: string | null = null;
  const requestId = crypto.randomUUID();

  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return fail(
        "Cloudflare Workers AI is not configured. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Vercel Environment Variables.",
        500,
        { code: "CLOUDFLARE_NOT_CONFIGURED" }
      );
    }

    supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return fail(
        "Please sign in to generate images.",
        401,
        { code: "AUTH_REQUIRED" }
      );
    }

    if (user.is_anonymous) {
      return fail(
        "Please sign in to generate images.",
        403,
        { code: "SIGN_IN_REQUIRED" }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return fail(
        "Invalid JSON request.",
        400,
        { code: "INVALID_REQUEST" }
      );
    }

    if (!isRecord(body)) {
      return fail(
        "Invalid JSON request.",
        400,
        { code: "INVALID_REQUEST" }
      );
    }

    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

    if (!prompt) {
      return fail(
        "Please enter an image prompt.",
        400,
        { code: "PROMPT_REQUIRED" }
      );
    }

    if (prompt.length > 1000) {
      return fail(
        "Prompt must be 1000 characters or less.",
        400,
        { code: "PROMPT_TOO_LONG" }
      );
    }

   const {
  data: preparedCredits,
  error: balanceError,
} = await supabase.rpc(
  "prepare_image_generator_credits",
  {
    p_user_id: user.id,
    p_default_credits: IMAGE_CREDIT_AMOUNT,
  }
);

if (balanceError) {
  console.error(
    "Image credit preparation failed:",
    balanceError.message
  );

  return fail(
    "Could not load your Image Generator credits.",
    500,
    { code: "CREDIT_BALANCE_ERROR" }
  );
}

const creditRow = Array.isArray(preparedCredits)
  ? preparedCredits[0]
  : preparedCredits;

const currentBalance = Number(
  creditRow?.balance ?? 0
);

    if (balanceError) {
      console.error(
        "Image credit balance lookup failed:",
        balanceError.message
      );

      return fail(
        "Could not load your Image Generator credits.",
        500,
        { code: "CREDIT_BALANCE_ERROR" }
      );
    }

    const currentBalance = Number(
      balanceRow?.balance ?? 0
    );

    if (currentBalance < IMAGE_CREDIT_COST) {
      return fail(
        "You do not have enough ZUQEN Image Credits.",
        402,
        {
          code: "INSUFFICIENT_CREDITS",
          creditsRemaining: currentBalance,
        }
      );
    }

    const {
      data: reservation,
      error: reservationError,
    } = await supabase.rpc("reserve_feature_credits", {
      p_user_id: user.id,
      p_feature_key: FEATURE_KEY,
      p_amount: IMAGE_CREDIT_COST,
      p_provider_request_id: requestId,
      p_reference_id: requestId,
      p_metadata: {
        provider: "cloudflare-workers-ai",
        model: CLOUDFLARE_MODEL,
        prompt_length: prompt.length,
        credits_reserved: IMAGE_CREDIT_COST,
      },
    });

    if (reservationError) {
      console.error(
        "Image credit reservation failed:",
        reservationError.message
      );

      return fail(
        "Could not reserve your Image Credit.",
        500,
        { code: "CREDIT_RESERVATION_ERROR" }
      );
    }

    if (
      !reservation?.success ||
      !reservation?.reservationId
    ) {
      return fail(
        reservation?.message ||
          "Could not reserve your Image Credit.",
        500,
        {
          code:
            reservation?.code ||
            "CREDIT_RESERVATION_FAILED",
        }
      );
    }

    reservationId = String(reservation.reservationId);

    const modelPath = CLOUDFLARE_MODEL
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    const endpoint =
      `https://api.cloudflare.com/client/v4/accounts/` +
      `${encodeURIComponent(accountId)}/ai/run/${modelPath}`;

    let providerResponse: Response;

    try {
      providerResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
        signal: AbortSignal.timeout(100_000),
      });
    } catch (error) {
      console.error(
        "Cloudflare Workers AI connection error:",
        error
      );

      await refundReservation(
        supabase,
        reservationId,
        requestId,
        "Cloudflare image request failed",
        { reason: "NETWORK_ERROR" }
      );

      return fail(
        "Could not connect to Cloudflare image generation. Your Image Credit refund was requested.",
        502,
        {
          code: "CLOUDFLARE_CONNECTION_FAILED",
          creditRefunded: true,
        }
      );
    }

    const providerPayload: unknown =
      await providerResponse.json().catch(() => null);

    if (
      !providerResponse.ok ||
      !isRecord(providerPayload) ||
      providerPayload.success !== true ||
      !isRecord(providerPayload.result)
    ) {
      const providerMessage =
        isRecord(providerPayload) &&
        Array.isArray(providerPayload.errors) &&
        isRecord(providerPayload.errors[0]) &&
        typeof providerPayload.errors[0].message === "string"
          ? providerPayload.errors[0].message
          : `Cloudflare returned HTTP ${providerResponse.status}.`;

      console.error("Cloudflare Workers AI image error:", {
        status: providerResponse.status,
        model: CLOUDFLARE_MODEL,
        message: providerMessage,
      });

      await refundReservation(
        supabase,
        reservationId,
        requestId,
        "Cloudflare image generation failed",
        {
          status: providerResponse.status,
          error: providerMessage,
        }
      );

      return fail(
        `Cloudflare image generation failed: ${providerMessage}`,
        providerResponse.status >= 400 &&
          providerResponse.status < 500
          ? providerResponse.status
          : 502,
        {
          code: "CLOUDFLARE_GENERATION_FAILED",
          creditRefunded: true,
        }
      );
    }

    const result = providerPayload.result;

    const base64Image =
      typeof result.image === "string"
        ? result.image
        : null;

    if (!base64Image) {
      console.error(
        "Cloudflare returned no base64 image."
      );

      await refundReservation(
        supabase,
        reservationId,
        requestId,
        "Cloudflare returned no image",
        { reason: "NO_IMAGE_RETURNED" }
      );

      return fail(
        "Cloudflare completed the request but returned no image. Your Image Credit refund was requested.",
        502,
        {
          code: "NO_IMAGE_RETURNED",
          creditRefunded: true,
        }
      );
    }

    const imageDataUrl = base64Image.startsWith(
      "data:image/"
    )
      ? base64Image
      : `data:image/png;base64,${base64Image}`;

    const {
      data: settlement,
      error: settlementError,
    } = await supabase.rpc(
      "settle_feature_credit_reservation",
      {
        p_reservation_id: reservationId,
        p_actual_amount: IMAGE_CREDIT_COST,
        p_provider_request_id: requestId,
        p_description:
          "Successful Cloudflare Workers AI image generation",
        p_reference_id: requestId,
        p_metadata: {
          provider: "cloudflare-workers-ai",
          model: CLOUDFLARE_MODEL,
          images_generated: 1,
          credits_consumed: IMAGE_CREDIT_COST,
        },
      }
    );

    if (settlementError) {
      console.error(
        "Image credit settlement failed:",
        settlementError.message
      );

      return fail(
        "Image was generated, but credit usage could not be recorded. Please contact support before generating again.",
        500,
        {
          code: "CREDIT_SETTLEMENT_ERROR",
          reservationId,
        }
      );
    }

    const creditsRemaining = Number(
      settlement?.newBalance ??
        Math.max(0, currentBalance - IMAGE_CREDIT_COST)
    );
let resetAt: string | null =
  creditRow?.credit_reset_at ?? null;

if (creditsRemaining <= 0) {
  const {
    data: resetData,
    error: resetError,
  } = await supabase.rpc(
    "schedule_image_credit_reset",
    {
      p_user_id: user.id,
      p_reset_amount: IMAGE_CREDIT_AMOUNT,
    }
  );

  if (resetError) {
    console.error(
      "Image credit reset scheduling failed:",
      resetError.message
    );
  } else {
    const resetRow = Array.isArray(resetData)
      ? resetData[0]
      : resetData;

    resetAt =
      resetRow?.credit_reset_at ?? null;
  }
}
    return NextResponse.json({
      success: true,
      image: imageDataUrl,
      provider: "cloudflare-workers-ai",
      feature: FEATURE_KEY,
      model: CLOUDFLARE_MODEL,
      usage: {
        tracked: true,
        imagesGenerated: 1,
      },
      billing: {
        creditsConsumed: IMAGE_CREDIT_COST,
        creditsRemaining,
         resetAt,
      },
      creditsConsumed: IMAGE_CREDIT_COST,
      creditsRemaining,
       resetAt,
    });
  } catch (error) {
    console.error(
      "Unexpected Cloudflare Image Generator error:",
      error
    );

    if (supabase && reservationId) {
      await refundReservation(
        supabase,
        reservationId,
        requestId,
        "Unexpected Cloudflare image generation error",
        {
          error:
            error instanceof Error
              ? error.message
              : "Unknown error",
        }
      ).catch(() => undefined);
    }

    return fail(
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while generating the image.",
      500,
      {
        code: "IMAGE_GENERATOR_UNEXPECTED_ERROR",
        creditRefunded: Boolean(reservationId),
      }
    );
  }
}
