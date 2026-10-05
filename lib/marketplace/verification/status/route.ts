import { NextResponse } from "next/server";

import {
  createServerSupabaseClient,
} from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(
  request: Request
) {
  try {
    const supabase =
      await createServerSupabaseClient();

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "You must be signed in.",
        },
        {
          status: 401,
        }
      );
    }

    const url =
      new URL(request.url);

    const templateId =
      url.searchParams.get(
        "templateId"
      )?.trim();

    if (!templateId) {
      return NextResponse.json(
        {
          error:
            "Template ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: seller,
    } = await supabase
      .from("seller_profiles")
      .select(
        "id,user_id"
      )
      .eq(
        "user_id",
        user.id
      )
      .single();

    if (!seller) {
      return NextResponse.json(
        {
          error:
            "Seller profile not found.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: template,
    } = await supabase
      .from("templates")
      .select(
        "id,seller_id"
      )
      .eq(
        "id",
        templateId
      )
      .single();

    if (
      !template ||
      template.seller_id !==
        seller.id
    ) {
      return NextResponse.json(
        {
          error:
            "You do not own this template.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: verification,
      error,
    } = await supabase
      .from("template_verifications")
      .select(
        `
        id,
        template_id,
        status,
        result,
        verification_score,
        checks,
        findings,
        evidence,
        ai_model,
        error_message,
        started_at,
        completed_at,
        created_at,
        updated_at
        `
      )
      .eq(
        "template_id",
        templateId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      verification:
        verification || null,
    });
  } catch (error) {
    console.error(
      "GET /api/marketplace/verification/status:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load verification status.",
      },
      {
        status: 500,
      }
    );
  }
}