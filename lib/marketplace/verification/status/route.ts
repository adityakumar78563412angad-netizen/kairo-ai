import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(
  request: Request
) {
  try {
    const supabase =
      await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    const url = new URL(
      request.url
    );

    const templateId =
      url.searchParams
        .get("templateId")
        ?.trim() || "";

    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Template ID is required.",
        },
        { status: 400 }
      );
    }

    const {
      data: sellerProfile,
      error: sellerError,
    } = await supabase
      .from("seller_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (sellerError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify seller profile.",
        },
        { status: 500 }
      );
    }

    if (!sellerProfile) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Seller profile required.",
        },
        { status: 403 }
      );
    }

    const {
      data: template,
      error: templateError,
    } = await supabase
      .from("templates")
      .select("id")
      .eq("id", templateId)
      .eq(
        "seller_id",
        sellerProfile.id
      )
      .maybeSingle();

    if (templateError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify template ownership.",
        },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Template not found.",
        },
        { status: 404 }
      );
    }

    const {
      data: verification,
      error: verificationError,
    } = await supabase
      .from("template_verifications")
      .select("*")
      .eq(
        "template_id",
        templateId
      )
      .order(
        "created_at",
        { ascending: false }
      )
      .limit(1)
      .maybeSingle();

    if (verificationError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load verification status.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      verification:
        verification || null,
    });
  } catch (error) {
    console.error(
      "Marketplace verification status error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load verification status.",
      },
      { status: 500 }
    );
  }
}