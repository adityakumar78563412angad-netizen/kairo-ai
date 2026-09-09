
import { createClient } from "@supabase/supabase-js";

export const FEATURE_KEYS = [
  "chat",
  "website_builder",
  "image_generator",
  "video_generator",
  "voice_generator",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureCreditBalance = {
  feature_key: FeatureKey;
  balance: number;
  total_granted: number;
  total_used: number;
};

export type CreditTransactionType =
  | "grant"
  | "usage"
  | "refund"
  | "adjustment"
  | "purchase";

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

function isValidFeatureKey(value: string): value is FeatureKey {
  return FEATURE_KEYS.includes(value as FeatureKey);
}

/**
 * Get one user's feature-specific credit balance.
 *
 * Example:
 * const result = await getFeatureCreditBalance(userId, "chat");
 */
export async function getFeatureCreditBalance(
  userId: string,
  featureKey: FeatureKey
) {
  if (!userId) {
    return {
      success: false,
      balance: null,
      error: "User ID is required.",
    };
  }

  if (!isValidFeatureKey(featureKey)) {
    return {
      success: false,
      balance: null,
      error: "Invalid feature key.",
    };
  }

  try {
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
      .from("feature_credit_balances")
      .select("feature_key, balance, total_granted, total_used")
      .eq("user_id", userId)
      .eq("feature_key", featureKey)
      .maybeSingle();

    if (error) {
      console.error("GET FEATURE CREDIT BALANCE ERROR:", error);

      return {
        success: false,
        balance: null,
        error: error.message,
      };
    }

    return {
      success: true,
      balance: data
        ? {
            feature_key: data.feature_key as FeatureKey,
            balance: Number(data.balance ?? 0),
            total_granted: Number(data.total_granted ?? 0),
            total_used: Number(data.total_used ?? 0),
          }
        : {
            feature_key: featureKey,
            balance: 0,
            total_granted: 0,
            total_used: 0,
          },
      error: null,
    };
  } catch (error: any) {
    console.error("GET FEATURE CREDIT BALANCE HELPER ERROR:", error);

    return {
      success: false,
      balance: null,
      error:
        error?.message || "Failed to get feature credit balance.",
    };
  }
}

/**
 * Get all feature balances for a user.
 */
export async function getAllFeatureCreditBalances(userId: string) {
  if (!userId) {
    return {
      success: false,
      balances: [],
      error: "User ID is required.",
    };
  }

  try {
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
      .from("feature_credit_balances")
      .select("feature_key, balance, total_granted, total_used")
      .eq("user_id", userId);

    if (error) {
      console.error("GET ALL FEATURE CREDIT BALANCES ERROR:", error);

      return {
        success: false,
        balances: [],
        error: error.message,
      };
    }

    const balanceMap = new Map<
      FeatureKey,
      FeatureCreditBalance
    >();

    for (const row of data ?? []) {
      if (!isValidFeatureKey(row.feature_key)) {
        continue;
      }

      balanceMap.set(row.feature_key, {
        feature_key: row.feature_key,
        balance: Number(row.balance ?? 0),
        total_granted: Number(row.total_granted ?? 0),
        total_used: Number(row.total_used ?? 0),
      });
    }

    const balances = FEATURE_KEYS.map((featureKey) => {
      return (
        balanceMap.get(featureKey) ?? {
          feature_key: featureKey,
          balance: 0,
          total_granted: 0,
          total_used: 0,
        }
      );
    });

    return {
      success: true,
      balances,
      error: null,
    };
  } catch (error: any) {
    console.error(
      "GET ALL FEATURE CREDIT BALANCES HELPER ERROR:",
      error
    );

    return {
      success: false,
      balances: [],
      error:
        error?.message ||
        "Failed to get all feature credit balances.",
    };
  }
}

/**
 * Grant credits to one feature.
 *
 * IMPORTANT:
 * This function is intended for trusted server-side code only.
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
  const {
    userId,
    featureKey,
    amount,
    transactionType = "grant",
    provider = null,
    description = null,
    referenceId = null,
    metadata = {},
  } = params;

  if (!userId) {
    return {
      success: false,
      balance: null,
      error: "User ID is required.",
    };
  }

  if (!isValidFeatureKey(featureKey)) {
    return {
      success: false,
      balance: null,
      error: "Invalid feature key.",
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      success: false,
      balance: null,
      error: "Credit amount must be greater than zero.",
    };
  }

  try {
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase.rpc(
      "grant_feature_credits",
      {
        p_user_id: userId,
        p_feature_key: featureKey,
        p_amount: amount,
        p_transaction_type: transactionType,
        p_provider: provider,
        p_description: description,
        p_reference_id: referenceId,
        p_metadata: metadata,
      }
    );

    if (error) {
      console.error("GRANT FEATURE CREDITS ERROR:", error);

      return {
        success: false,
        balance: null,
        error: error.message,
      };
    }

    return {
      success: true,
      balance:
        typeof data === "number"
          ? data
          : Number(data ?? 0),
      error: null,
    };
  } catch (error: any) {
    console.error("GRANT FEATURE CREDITS HELPER ERROR:", error);

    return {
      success: false,
      balance: null,
      error:
        error?.message || "Failed to grant feature credits.",
    };
  }
}

/**
 * Consume feature credits.
 *
 * Credits should normally be consumed only after
 * the provider request succeeds and actual usage is known.
 */
export async function consumeFeatureCredits(params: {
  userId: string;
  featureKey: FeatureKey;
  amount: number;
  provider?: string | null;
  providerRequestId?: string | null;
  description?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const {
    userId,
    featureKey,
    amount,
    provider = null,
    providerRequestId = null,
    description = null,
    referenceId = null,
    metadata = {},
  } = params;

  if (!userId) {
    return {
      success: false,
      balance: null,
      error: "User ID is required.",
      code: "INVALID_USER",
    };
  }

  if (!isValidFeatureKey(featureKey)) {
    return {
      success: false,
      balance: null,
      error: "Invalid feature key.",
      code: "INVALID_FEATURE",
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      success: false,
      balance: null,
      error: "Credit amount must be greater than zero.",
      code: "INVALID_AMOUNT",
    };
  }

  try {
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase.rpc(
      "consume_feature_credits",
      {
        p_user_id: userId,
        p_feature_key: featureKey,
        p_amount: amount,
        p_provider: provider,
        p_provider_request_id: providerRequestId,
        p_description: description,
        p_reference_id: referenceId,
        p_metadata: metadata,
      }
    );

    if (error) {
      console.error("CONSUME FEATURE CREDITS ERROR:", error);

      return {
        success: false,
        balance: null,
        error: error.message,
        code: "CREDIT_CONSUME_ERROR",
      };
    }

    /**
     * Our RPC returns INSUFFICIENT_CREDITS when
     * the user's feature balance is not enough.
     */
    if (data?.code === "INSUFFICIENT_CREDITS") {
      return {
        success: false,
        balance:
          data?.balance !== undefined
            ? Number(data.balance)
            : 0,
        error: "Insufficient feature credits.",
        code: "INSUFFICIENT_CREDITS",
      };
    }

    return {
      success: true,
      balance:
        data?.balance !== undefined
          ? Number(data.balance)
          : typeof data === "number"
            ? data
            : null,
      transactionId: data?.transaction_id ?? null,
      error: null,
      code: null,
    };
  } catch (error: any) {
    console.error(
      "CONSUME FEATURE CREDITS HELPER ERROR:",
      error
    );

    return {
      success: false,
      balance: null,
      error:
        error?.message ||
        "Failed to consume feature credits.",
      code: "CREDIT_CONSUME_ERROR",
    };
  }
}

/**
 * Refund feature credits.
 *
 * Intended for trusted server-side code only.
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
  const {
    userId,
    featureKey,
    amount,
    provider = null,
    providerRequestId = null,
    description = null,
    referenceId = null,
    metadata = {},
  } = params;

  if (!userId) {
    return {
      success: false,
      balance: null,
      error: "User ID is required.",
    };
  }

  if (!isValidFeatureKey(featureKey)) {
    return {
      success: false,
      balance: null,
      error: "Invalid feature key.",
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      success: false,
      balance: null,
      error: "Refund amount must be greater than zero.",
    };
  }

  try {
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase.rpc(
      "refund_feature_credits",
      {
        p_user_id: userId,
        p_feature_key: featureKey,
        p_amount: amount,
        p_provider: provider,
        p_provider_request_id: providerRequestId,
        p_description: description,
        p_reference_id: referenceId,
        p_metadata: metadata,
      }
    );

    if (error) {
      console.error("REFUND FEATURE CREDITS ERROR:", error);

      return {
        success: false,
        balance: null,
        error: error.message,
      };
    }

    return {
      success: true,
      balance:
        data?.balance !== undefined
          ? Number(data.balance)
          : typeof data === "number"
            ? data
            : null,
      error: null,
    };
  } catch (error: any) {
    console.error(
      "REFUND FEATURE CREDITS HELPER ERROR:",
      error
    );

    return {
      success: false,
      balance: null,
      error:
        error?.message ||
        "Failed to refund feature credits.",
    };
  }
}

