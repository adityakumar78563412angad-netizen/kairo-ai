import { NextResponse } from "next/server";

import {
  createServerSupabaseClient,
} from "@/lib/supabase-server";

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

    const body =
      await request.json();

    const templateId =
      typeof body?.templateId === "string"
        ? body.templateId.trim()
        : "";

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
      .single();

    if (
      templateError ||
      !template
    ) {
      return NextResponse.json(
        {
          error:
            "Template not found.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data: seller,
      error: sellerError,
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

    if (
      sellerError ||
      !seller ||
      seller.id !== template.seller_id
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

    if (
      template.status !==
        "under_review" ||
      template.review_status !==
        "under_review"
    ) {
      return NextResponse.json(
        {
          error:
            "Template must be submitted for review before AI verification starts.",
        },
        {
          status: 409,
        }
      );
    }

    const {
      data: existing,
    } = await supabase
      .from("template_verifications")
      .select(
        "id,status,result"
      )
      .eq(
        "template_id",
        templateId
      )
      .in(
        "status",
        [
          "queued",
          "processing",
        ]
      )
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        verificationId:
          existing.id,
        status:
          existing.status,
        alreadyRunning:
          true,
      });
    }

    const {
      data: verification,
      error: createError,
    } = await supabase
      .from("template_verifications")
      .insert({
        template_id:
          templateId,

        status:
          "queued",
      })
      .select(
        "id,status"
      )
      .single();

    if (
      createError ||
      !verification
    ) {
      return NextResponse.json(
        {
          error:
            createError?.message ||
            "Unable to create verification.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Phase 1 executes immediately.
     *
     * Later we can move this exact engine call
     * into a durable background worker/queue.
     */
    try {
      await runTemplateVerification(
        templateId,
        verification.id
      );
    } catch (error) {
      console.error(
        "Template verification failed:",
        error
      );
    }

    const {
      data: finalVerification,
    } = await supabase
      .from("template_verifications")
      .select(
        "id,status,result,verification_score,findings,evidence,checks,error_message,completed_at"
      )
      .eq(
        "id",
        verification.id
      )
      .single();

    return NextResponse.json({
      success: true,

      verification:
        finalVerification || {
          id:
            verification.id,

          status:
            "processing",
        },
    });
  } catch (error) {
    console.error(
      "POST /api/marketplace/verification/start:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Verification could not be started.",
      },
      {
        status: 500,
      }
    );
  }
}