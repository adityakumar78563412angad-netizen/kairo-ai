import { createServerSupabaseClient } from "@/lib/supabase-server";

export const VALID_FEATURES = [
  "chat",
  "website_builder",
  "image_generator",
  "video_generator",
  "voice_generator",
] as const;

export type FeatureKey = (typeof VALID_FEATURES)[number];

export type FeatureAccessResult =
  | {
      allowed: true;
      userId: string;
      featureKey: FeatureKey;
      featureName: string;
      provider: string;
      packageType: "none" | "single" | "all";
      activatedAt: string | null;
      expiresAt: string | null;
    }
  | {
      allowed: false;
      code:
        | "unauthorized"
        | "invalid_feature"
        | "feature_not_found"
        | "feature_disabled"
        | "feature_expired"
        | "database_error";
      message: string;
      status: 401 | 400 | 404 | 403 | 500;
    };

function isValidFeature(
  value: string
): value is FeatureKey {
  return VALID_FEATURES.includes(value as FeatureKey);
}

/**
 * Checks whether the currently authenticated user
 * is allowed to use a specific ZUQEN feature.
 *
 * IMPORTANT:
 * This function only checks ZUQEN feature access.
 * It does NOT consume provider quota or credits.
 */
export async function checkFeatureAccess(
  feature: string
): Promise<FeatureAccessResult> {
  try {
    // -------------------------------------------------------
    // Validate feature
    // -------------------------------------------------------
    if (!isValidFeature(feature)) {
      return {
        allowed: false,
        code: "invalid_feature",
        message: "Invalid ZUQEN feature.",
        status: 400,
      };
    }

    // -------------------------------------------------------
    // Create server Supabase client
    // -------------------------------------------------------
    const supabase = await createServerSupabaseClient();

    // -------------------------------------------------------
    // Get authenticated user
    // -------------------------------------------------------
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        allowed: false,
        code: "unauthorized",
        message: "Please sign in to use this feature.",
        status: 401,
      };
    }

    // -------------------------------------------------------
    // Get feature definition
    // -------------------------------------------------------
    const { data: providerFeature, error: providerError } =
      await supabase
        .from("provider_features")
        .select(
          "feature_key, feature_name, provider, enabled"
        )
        .eq("feature_key", feature)
        .maybeSingle();

    if (providerError) {
      console.error(
        "Provider feature lookup error:",
        providerError
      );

      return {
        allowed: false,
        code: "database_error",
        message: "Unable to verify feature.",
        status: 500,
      };
    }

    if (!providerFeature) {
      return {
        allowed: false,
        code: "feature_not_found",
        message: "This feature is not configured.",
        status: 404,
      };
    }

    // -------------------------------------------------------
    // Global feature switch
    // -------------------------------------------------------
    if (!providerFeature.enabled) {
      return {
        allowed: false,
        code: "feature_disabled",
        message: "This feature is currently unavailable.",
        status: 403,
      };
    }

    // -------------------------------------------------------
    // Get user's feature access
    // -------------------------------------------------------
    const { data: access, error: accessError } =
      await supabase
        .from("user_feature_access")
        .select(
          "feature_key, enabled, package_type, activated_at, expires_at"
        )
        .eq("user_id", user.id)
        .eq("feature_key", feature)
        .maybeSingle();

    if (accessError) {
      console.error(
        "User feature access lookup error:",
        accessError
      );

      return {
        allowed: false,
        code: "database_error",
        message: "Unable to verify your feature access.",
        status: 500,
      };
    }

    // -------------------------------------------------------
    // No access row
    // -------------------------------------------------------
    if (!access) {
      return {
        allowed: false,
        code: "feature_not_found",
        message: "You do not have access to this feature.",
        status: 403,
      };
    }

    // -------------------------------------------------------
    // Check enabled state
    // -------------------------------------------------------
    if (!access.enabled) {
      return {
        allowed: false,
        code: "feature_disabled",
        message:
          "You do not currently have access to this feature.",
        status: 403,
      };
    }

    // -------------------------------------------------------
    // Check expiration
    // -------------------------------------------------------
    if (access.expires_at) {
      const expiresAt = new Date(
        access.expires_at
      ).getTime();

      if (
        Number.isFinite(expiresAt) &&
        expiresAt <= Date.now()
      ) {
        return {
          allowed: false,
          code: "feature_expired",
          message:
            "Your access to this feature has expired.",
          status: 403,
        };
      }
    }

    // -------------------------------------------------------
    // Access granted
    // -------------------------------------------------------
    return {
      allowed: true,

      userId: user.id,

      featureKey: feature,

      featureName: providerFeature.feature_name,

      provider: providerFeature.provider,

      packageType: access.package_type as
        | "none"
        | "single"
        | "all",

      activatedAt: access.activated_at,

      expiresAt: access.expires_at,
    };
  } catch (error) {
    console.error(
      "checkFeatureAccess error:",
      error
    );

    return {
      allowed: false,
      code: "database_error",
      message: "Unable to verify feature access.",
      status: 500,
    };
  }
}