import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  runTemplateVerification,
} from "@/lib/marketplace/verification/engine";

export const runtime = "nodejs";

export async function POST(
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

    const body =
      await request.json().catch(
        () => null
      );

    const templateId =
      typeof body?.templateId === "string"
        ? body.templateId.trim()
        : "";

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
      .select(
        `
          id,
          seller_id,
          status,
          review_status
        `
      )
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
            "Unable to load template.",
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

    if (
      template.status !==
        "under_review" ||
      template.review_status !==
        "under_review"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Template must be under marketplace review before verification starts.",
        },
        { status: 409 }
      );
    }

    const {
      data: activeVerification,
      error: activeError,
    } = await supabase
      .from("template_verifications")
      .select("*")
      .eq(
        "template_id",
        templateId
      )
      .in("status", [
        "queued",
        "processing",
      ])
      .maybeSingle();

    if (activeError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to check verification status.",
        },
        { status: 500 }
      );
    }

    if (activeVerification) {
      return NextResponse.json({
        success: true,
        verification:
          activeVerification,
        message:
          "Template verification is already running.",
      });
    }

    const {
      data: verification,
      error: insertError,
    } = await supabase
      .from("template_verifications")
      .insert({
        template_id:
          templateId,
        status: "queued",
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to create verification job.",
        },
        { status: 500 }
      );
    }

    /*
     * Run verification.
     *
     * This is intentionally kept separate from the submission
     * endpoint. A future durable queue can call the same engine.
     */

    const result =
      await runTemplateVerification(
        verification.id
      );

    return NextResponse.json({
      success: true,
      verification: result,
    });
  } catch (error) {
    console.error(
      "Marketplace verification start error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to start template verification.",
      },
      { status: 500 }
    );
  }
}