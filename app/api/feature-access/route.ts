import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const VALID_FEATURES = [
  "chat",
  "website_builder",
  "image_generator",
  "video_generator",
  "voice_generator",
] as const;

type FeatureKey = (typeof VALID_FEATURES)[number];

function isValidFeature(value: string): value is FeatureKey {
  return VALID_FEATURES.includes(value as FeatureKey);
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // -------------------------------------------------------
    // Check authentication
    // -------------------------------------------------------
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          code: "unauthorized",
          message: "Please sign in to continue.",
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const requestedFeature = url.searchParams.get("feature");

    // -------------------------------------------------------
    // Get provider feature definitions
    // -------------------------------------------------------
    const { data: providerFeatures, error: providerFeaturesError } =
      await supabase
        .from("provider_features")
        .select("feature_key, feature_name, provider")
        .order("feature_key");

    if (providerFeaturesError) {
      console.error(
        "Provider features lookup error:",
        providerFeaturesError
      );

      return NextResponse.json(
        {
          success: false,
          code: "database_error",
          message: "Unable to load provider features.",
        },
        { status: 500 }
      );
    }

    // Create a simple lookup map.
    const featureMap = new Map<
      string,
      {
        featureName: string;
        provider: string;
      }
    >();

    for (const feature of providerFeatures ?? []) {
      featureMap.set(feature.feature_key, {
        featureName: feature.feature_name,
        provider: feature.provider,
      });
    }

    // -------------------------------------------------------
    // Single feature check
    // Example:
    // /api/feature-access?feature=chat
    // -------------------------------------------------------
    if (requestedFeature) {
      if (!isValidFeature(requestedFeature)) {
        return NextResponse.json(
          {
            success: false,
            code: "invalid_feature",
            message: "Invalid feature.",
            validFeatures: VALID_FEATURES,
          },
          { status: 400 }
        );
      }

      const { data: access, error: accessError } = await supabase
        .from("user_feature_access")
        .select(
          "feature_key, enabled, package_type, activated_at, expires_at"
        )
        .eq("user_id", user.id)
        .eq("feature_key", requestedFeature)
        .maybeSingle();

      if (accessError) {
        console.error(
          "Feature access lookup error:",
          accessError
        );

        return NextResponse.json(
          {
            success: false,
            code: "database_error",
            message: "Unable to check feature access.",
          },
          { status: 500 }
        );
      }

      const providerInfo = featureMap.get(requestedFeature);

      // No access row means feature is not enabled.
      if (!access) {
        return NextResponse.json({
          success: true,
          userId: user.id,

          feature: {
            featureKey: requestedFeature,
            featureName: providerInfo?.featureName ?? requestedFeature,
            provider: providerInfo?.provider ?? null,

            enabled: false,
            packageType: "none",

            activatedAt: null,
            expiresAt: null,
            expired: false,
          },
        });
      }

      // -----------------------------------------------------
      // Check expiration
      // -----------------------------------------------------
      let expired = false;

      if (access.expires_at) {
        const expirationTime = new Date(
          access.expires_at
        ).getTime();

        if (
          Number.isFinite(expirationTime) &&
          expirationTime <= Date.now()
        ) {
          expired = true;
        }
      }

      const enabled = Boolean(access.enabled) && !expired;

      return NextResponse.json({
        success: true,
        userId: user.id,

        feature: {
          featureKey: access.feature_key,
          featureName:
            providerInfo?.featureName ?? access.feature_key,
          provider: providerInfo?.provider ?? null,

          enabled,

          packageType: access.package_type,

          activatedAt: access.activated_at,
          expiresAt: access.expires_at,

          expired,
        },
      });
    }

    // -------------------------------------------------------
    // Get all feature access
    // -------------------------------------------------------
    const { data: accessRows, error: accessRowsError } =
      await supabase
        .from("user_feature_access")
        .select(
          "feature_key, enabled, package_type, activated_at, expires_at"
        )
        .eq("user_id", user.id)
        .order("feature_key");

    if (accessRowsError) {
      console.error(
        "Feature access list error:",
        accessRowsError
      );

      return NextResponse.json(
        {
          success: false,
          code: "database_error",
          message: "Unable to load feature access.",
        },
        { status: 500 }
      );
    }

    // -------------------------------------------------------
    // Build feature response
    // -------------------------------------------------------
    const features = (accessRows ?? []).map((access) => {
      let expired = false;

      if (access.expires_at) {
        const expirationTime = new Date(
          access.expires_at
        ).getTime();

        if (
          Number.isFinite(expirationTime) &&
          expirationTime <= Date.now()
        ) {
          expired = true;
        }
      }

      const providerInfo = featureMap.get(access.feature_key);

      return {
        featureKey: access.feature_key,

        featureName:
          providerInfo?.featureName ?? access.feature_key,

        provider: providerInfo?.provider ?? null,

        enabled: Boolean(access.enabled) && !expired,

        packageType: access.package_type,

        activatedAt: access.activated_at,
        expiresAt: access.expires_at,

        expired,
      };
    });

    // -------------------------------------------------------
    // Make sure all five ZUQEN features are represented
    // -------------------------------------------------------
    for (const featureKey of VALID_FEATURES) {
      const alreadyExists = features.some(
        (feature) => feature.featureKey === featureKey
      );

      if (!alreadyExists) {
        const providerInfo = featureMap.get(featureKey);

        features.push({
          featureKey,
          featureName: providerInfo?.featureName ?? featureKey,
          provider: providerInfo?.provider ?? null,

          enabled: false,

          packageType: "none",

          activatedAt: null,
          expiresAt: null,

          expired: false,
        });
      }
    }

    // Keep a consistent order.
    features.sort((a, b) =>
      a.featureKey.localeCompare(b.featureKey)
    );

    return NextResponse.json({
      success: true,
      userId: user.id,
      features,
    });
  } catch (error) {
    console.error("Feature access API error:", error);

    return NextResponse.json(
      {
        success: false,
        code: "internal_error",
        message: "Something went wrong.",
      },
      { status: 500 }
    );
  }
}