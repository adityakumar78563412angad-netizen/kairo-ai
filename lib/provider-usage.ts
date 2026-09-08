import { createClient } from "@supabase/supabase-js";

export type ProviderUsageStatus = "success" | "failed";

export type RecordProviderUsageParams = {
  userId: string;
  featureKey:
    | "chat"
    | "website_builder"
    | "image_generator"
    | "video_generator"
    | "voice_generator";

  provider: string;
  model?: string | null;
  requestId?: string | null;

  status: ProviderUsageStatus;

  inputUnits?: number;
  outputUnits?: number;
  totalUnits?: number;

  unitType?: string;

  metadata?: Record<string, unknown>;
};

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function recordProviderUsage(
  params: RecordProviderUsageParams
) {
  try {
    const supabase = getServiceRoleClient();

    const {
      data,
      error,
    } = await supabase
      .from("provider_usage")
      .insert({
        user_id: params.userId,
        feature_key: params.featureKey,
        provider: params.provider,
        model: params.model ?? null,
        request_id: params.requestId ?? null,
        status: params.status,

        input_units: Math.max(
          0,
          Math.floor(params.inputUnits ?? 0)
        ),

        output_units: Math.max(
          0,
          Math.floor(params.outputUnits ?? 0)
        ),

        total_units: Math.max(
          0,
          Math.floor(params.totalUnits ?? 0)
        ),

        unit_type:
          params.unitType ?? "unknown",

        metadata:
          params.metadata ?? {},
      })
      .select("id")
      .single();

    if (error) {
      console.error(
        "PROVIDER USAGE INSERT ERROR:",
        error
      );

      return {
        success: false,
        id: null,
        error: error.message,
      };
    }

    return {
      success: true,
      id: data?.id ?? null,
      error: null,
    };
  } catch (error: any) {
    console.error(
      "PROVIDER USAGE HELPER ERROR:",
      error
    );

    return {
      success: false,
      id: null,
      error:
        error?.message ||
        "Failed to record provider usage.",
    };
  }
}