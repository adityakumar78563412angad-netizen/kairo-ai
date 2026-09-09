import { createClient } from "@supabase/supabase-js";

export const FEATURE_KEYS = [
  "chat",
  "website_builder",
  "image_generator",
  "video_generator",
  "voice_generator",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type CreditTransactionType =
  | "grant"
  | "usage"
  | "refund"
  | "adjustment"
  | "purchase";

export type FeatureCreditBalance = {
  id?: string;
  user_id: string;
  feature_key: FeatureKey;
  balance: number;
  total_granted: number;
  total_used: number;
  created_at?: string;
  updated_at?: string;
};

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get one feature's current credit balance.
 */
export async function getFeatureCreditBalance(
  userId: string,
  featureKey: FeatureKey
): Promise<number> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from("feature_credit_balances")
    .select("balance")
    .eq("user_id", userId)
    .eq("feature_key", featureKey)
    .maybeSingle();

  if (error) {
    console.error("GET FEATURE CREDIT BALANCE ERROR:", error);
    throw new Error(error.message);
  }

  return Number(data?.balance ?? 0);
}

/**
 * Get all feature credit balances for a user.
 */
export async function getAllFeatureCreditBalances(
  userId: string
): Promise<FeatureCreditBalance[]> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from("feature_credit_balances")
    .select(
      `
        id,
        user_id,
        feature_key,
        balance,
        total_granted,
        total_used,
        created_at,
        updated_at
      `
    )
    .eq("user_id", userId)
    .order("feature_key", {
      ascending: true,
    });

  if (error) {
    console.error("GET ALL FEATURE CREDIT BALANCES ERROR:", error);
    throw new Error(error.message);
  }

  return (data ?? []) as FeatureCreditBalance[];
}

/**
 * Grant feature credits.
 *
 * Used for:
 * - signup allocation
 * - premium refill
 * - admin adjustment
 * - refund
 */
export async function grantFeatureCredits(params: {
  userId: string;
  featureKey: FeatureKey;
  amount: number;
  transactionType?: CreditTransactionType;
  provider?: string | null;
  description?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    return {
      success: false,
      code: "INVALID_AMOUNT",
      message: "Credit amount must be greater than zero.",
    };
  }

  const supabase = getServiceRoleClient();

  const { data, error } = await supabase.rpc(
    "grant_feature_credits",
    {
      p_user_id: params.userId,
      p_feature_key: params.featureKey,
      p_amount: params.amount,
      p_transaction_type:
        params.transactionType ?? "grant",
      p_provider: params.provider ?? null,
      p_description:
        params.description ??
        "Feature credits granted",
      p_reference_id:
        params.referenceId ?? null,
      p_metadata: params.metadata ?? {},
    }
  );

  if (error) {
    console.error("GRANT FEATURE CREDITS ERROR:", error);

    return {
      success: false,
      code: "GRANT_FAILED",
      message: error.message,
      data: null,
    };
  }

  return {
    success: true,
    code: "CREDITS_GRANTED",
    message: "Feature credits granted successfully.",
    data,
  };
}

/**
 * Reserve provider-backed feature credits.
 *
 * Credits are temporarily held before a provider request.
 * The balance decreases immediately, but total_used and
 * provider consumed_credits are NOT increased yet.
 */
export async function reserveFeatureCredits(params: {
  userId: string;
  featureKey: FeatureKey;
  amount: number;
  providerRequestId?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    return {
      success: false,
      code: "INVALID_AMOUNT",
      message: "Reservation amount must be greater than zero.",
      data: null,
    };
  }

  const supabase = getServiceRoleClient();

  const { data, error } = await supabase.rpc(
    "reserve_feature_credits",
    {
      p_user_id: params.userId,
      p_feature_key: params.featureKey,
      p_amount: params.amount,
      p_provider_request_id:
        params.providerRequestId ?? null,
      p_reference_id:
        params.referenceId ?? null,
      p_metadata: params.metadata ?? {},
    }
  );

  if (error) {
    console.error(
      "RESERVE FEATURE CREDITS ERROR:",
      error
    );

    return {
      success: false,
      code: "RESERVE_FAILED",
      message: error.message,
      data: null,
    };
  }

  const result =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;

  if (result?.success === false) {
    return {
      success: false,
      code:
        typeof result.code === "string"
          ? result.code
          : "CREDIT_RESERVATION_FAILED",
      message:
        typeof result.message === "string"
          ? result.message
          : "Unable to reserve feature credits.",
      data: result,
    };
  }

  return {
    success: true,
    code: "CREDITS_RESERVED",
    message: "Feature credits reserved successfully.",
    data: result,
  };
}

/**
 * Settle a provider credit reservation.
 *
 * The actual provider usage is permanently consumed.
 * Any unused reserved credits are automatically refunded.
 */
export async function settleFeatureCreditReservation(params: {
  reservationId: string;
  actualAmount: number;
  providerRequestId?: string | null;
  description?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (
    !Number.isFinite(params.actualAmount) ||
    params.actualAmount < 0
  ) {
    return {
      success: false,
      code: "INVALID_AMOUNT",
      message: "Actual usage amount cannot be negative.",
      data: null,
    };
  }

  const supabase = getServiceRoleClient();

  const { data, error } = await supabase.rpc(
    "settle_feature_credit_reservation",
    {
      p_reservation_id: params.reservationId,
      p_actual_amount: params.actualAmount,
      p_provider_request_id:
        params.providerRequestId ?? null,
      p_description:
        params.description ??
        "Provider feature usage settlement",
      p_reference_id:
        params.referenceId ?? null,
      p_metadata: params.metadata ?? {},
    }
  );

  if (error) {
    console.error(
      "SETTLE FEATURE CREDIT RESERVATION ERROR:",
      error
    );

    return {
      success: false,
      code: "SETTLE_FAILED",
      message: error.message,
      data: null,
    };
  }

  const result =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;

  if (result?.success === false) {
    return {
      success: false,
      code:
        typeof result.code === "string"
          ? result.code
          : "CREDIT_SETTLEMENT_FAILED",
      message:
        typeof result.message === "string"
          ? result.message
          : "Unable to settle feature credit reservation.",
      data: result,
    };
  }

  return {
    success: true,
    code: "RESERVATION_SETTLED",
    message: "Feature credit reservation settled successfully.",
    data: result,
  };
}

/**
 * Refund a provider credit reservation.
 *
 * Used when the provider request fails or is cancelled.
 * The entire unused reservation is returned to the user's balance.
 */
export async function refundFeatureCreditReservation(params: {
  reservationId: string;
  providerRequestId?: string | null;
  description?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase.rpc(
    "refund_feature_credit_reservation",
    {
      p_reservation_id: params.reservationId,
      p_provider_request_id:
        params.providerRequestId ?? null,
      p_description:
        params.description ??
        "Provider feature credit reservation refunded",
      p_reference_id:
        params.referenceId ?? null,
      p_metadata: params.metadata ?? {},
    }
  );

  if (error) {
    console.error(
      "REFUND FEATURE CREDIT RESERVATION ERROR:",
      error
    );

    return {
      success: false,
      code: "RESERVATION_REFUND_FAILED",
      message: error.message,
      data: null,
    };
  }

  const result =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;

  if (result?.success === false) {
    return {
      success: false,
      code:
        typeof result.code === "string"
          ? result.code
          : "CREDIT_RESERVATION_REFUND_FAILED",
      message:
        typeof result.message === "string"
          ? result.message
          : "Unable to refund feature credit reservation.",
      data: result,
    };
  }

  return {
    success: true,
    code: "RESERVATION_REFUNDED",
    message: "Feature credit reservation refunded successfully.",
    data: result,
  };
}

/**
 * Legacy direct consumption.
 *
 * Keep this temporarily while existing routes are migrated
 * to the reservation → settlement/refund architecture.
 */
export async function consumeFeatureCredits(params: {
  userId: string;
  featureKey: FeatureKey;
  amount: number;
  providerRequestId?: string | null;
  description?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    return {
      success: false,
      code: "INVALID_AMOUNT",
      message: "Credit amount must be greater than zero.",
      data: null,
    };
  }

  const supabase = getServiceRoleClient();

  const { data, error } = await supabase.rpc(
    "consume_provider_feature_credits",
    {
      p_user_id: params.userId,
      p_feature_key: params.featureKey,
      p_amount: params.amount,
      p_provider_request_id:
        params.providerRequestId ?? null,
      p_description:
        params.description ??
        "Provider feature usage",
      p_reference_id:
        params.referenceId ?? null,
      p_metadata: params.metadata ?? {},
    }
  );

  if (error) {
    console.error(
      "CONSUME PROVIDER FEATURE CREDITS ERROR:",
      error
    );

    return {
      success: false,
      code: "CONSUME_FAILED",
      message: error.message,
      data: null,
    };
  }

  const result =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;

  if (result?.success === false) {
    return {
      success: false,
      code:
        typeof result.code === "string"
          ? result.code
          : "CREDIT_CONSUMPTION_FAILED",
      message:
        typeof result.message === "string"
          ? result.message
          : "Unable to consume feature credits.",
      data: result,
    };
  }

  return {
    success: true,
    code: "CREDITS_CONSUMED",
    message: "Feature credits consumed successfully.",
    data: result,
  };
}

/**
 * Legacy direct refund.
 *
 * Keep this temporarily while existing routes are migrated.
 */
export async function refundFeatureCredits(params: {
  userId: string;
  featureKey: FeatureKey;
  amount: number;
  provider?: string | null;
  providerRequestId?: string | null;
  description?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    return {
      success: false,
      code: "INVALID_AMOUNT",
      message: "Refund amount must be greater than zero.",
      data: null,
    };
  }

  const supabase = getServiceRoleClient();

  const { data, error } = await supabase.rpc(
    "refund_feature_credits",
    {
      p_user_id: params.userId,
      p_feature_key: params.featureKey,
      p_amount: params.amount,
      p_provider: params.provider ?? null,
      p_provider_request_id:
        params.providerRequestId ?? null,
      p_description:
        params.description ??
        "Feature credits refunded",
      p_reference_id:
        params.referenceId ?? null,
      p_metadata: params.metadata ?? {},
    }
  );

  if (error) {
    console.error("REFUND FEATURE CREDITS ERROR:", error);

    return {
      success: false,
      code: "REFUND_FAILED",
      message: error.message,
      data: null,
    };
  }

  return {
    success: true,
    code: "CREDITS_REFUNDED",
    message: "Feature credits refunded successfully.",
    data,
  };
}