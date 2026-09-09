import { createClient } from "@supabase/supabase-js";

type ProviderQuotaUpdate = {
  provider: string;
  featureKey: string;
  quotaLimit: number | null;
  quotaRemaining: number | null;
  unit: string;
  resetAt?: string | null;
  metadata?: Record<string, unknown>;
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

export async function saveProviderQuota(
  params: ProviderQuotaUpdate
) {
  try {
    const supabase = getServiceRoleClient();

    const { error } = await supabase
      .from("provider_credit_pools")
      .upsert(
        {
          provider: params.provider,
          feature_key: params.featureKey,

          quota_limit: Math.max(
            0,
            Number(params.quotaLimit ?? 0)
          ),

          quota_remaining: Math.max(
            0,
            Number(params.quotaRemaining ?? 0)
          ),

          unit_type: params.unit,
          source: "provider_api",

          reset_at: params.resetAt ?? null,

          synced_at: new Date().toISOString(),

          metadata: params.metadata ?? {},

          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "provider,feature_key",
        }
      );

    if (error) {
      console.error(
        "PROVIDER QUOTA SAVE ERROR:",
        error
      );

      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error: any) {
    console.error(
      "PROVIDER QUOTA HELPER ERROR:",
      error
    );

    return {
      success: false,
      error:
        error?.message ||
        "Failed to save provider quota.",
    };
  }
}


/**
 * Save Groq token quota from response headers.
 *
 * Groq exposes token limits through:
 * x-ratelimit-limit-tokens
 * x-ratelimit-remaining-tokens
 * x-ratelimit-reset-tokens
 */
export async function syncGroqQuotaFromHeaders(
  headers: Headers
) {
  const quotaLimitHeader =
    headers.get("x-ratelimit-limit-tokens");

  const quotaRemainingHeader =
    headers.get("x-ratelimit-remaining-tokens");

  const quotaResetHeader =
    headers.get("x-ratelimit-reset-tokens");

  const quotaLimit = quotaLimitHeader
    ? Number(quotaLimitHeader)
    : null;

  const quotaRemaining = quotaRemainingHeader
    ? Number(quotaRemainingHeader)
    : null;

  let resetAt: string | null = null;

  if (quotaResetHeader) {
    const resetText = quotaResetHeader.trim();

    const secondsMatch =
      resetText.match(/^([\d.]+)s$/);

    if (secondsMatch) {
      const seconds = Number(
        secondsMatch[1]
      );

      if (Number.isFinite(seconds)) {
        resetAt = new Date(
          Date.now() + seconds * 1000
        ).toISOString();
      }
    }
  }

  if (
    quotaLimit === null &&
    quotaRemaining === null
  ) {
    return {
      success: false,
      synced: false,
      error:
        "Groq quota headers were not available.",
    };
  }

  const result = await saveProviderQuota({
    provider: "groq",
    featureKey: "chat",
    quotaLimit,
    quotaRemaining,
    unit: "tokens",

    resetAt,

    metadata: {
      source: "groq_response_headers",
      quotaLimitHeader,
      quotaRemainingHeader,
      quotaResetHeader,
    },
  });

  return {
    ...result,
    synced: result.success,
  };
}