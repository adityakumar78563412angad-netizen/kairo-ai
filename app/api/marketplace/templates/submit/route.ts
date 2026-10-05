import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type SubmitBody = {
  templateId?: string;
};

type TemplateRow = {
  id: string;
  seller_id: string;
  name: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  features: string[] | null;
  requirements: string[] | null;
  tech_stack: string[] | null;
  license: string | null;
  status: string | null;
  review_status: string | null;
};

type TemplateFileRow = {
  id: string;
  file_role: string | null;
  file_name: string | null;
  file_size: number | null;
  storage_provider: string | null;
  storage_object_key: string | null;
};

function jsonError(
  message: string,
  status = 400,
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasItems(value: string[] | null | undefined) {
  return (
    Array.isArray(value) &&
    value.some(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0
    )
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    /*
     * -------------------------------------------------------
     * AUTHENTICATION
     * -------------------------------------------------------
     *
     * The authenticated user always comes from the server-side
     * Supabase session. Never trust seller_id/user_id sent by
     * the browser.
     */

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error(
        "Marketplace submit auth error:",
        authError
      );

      return jsonError(
        "Unable to verify your account.",
        401
      );
    }

    if (!user) {
      return jsonError(
        "You must be signed in to submit a template.",
        401
      );
    }

    /*
     * -------------------------------------------------------
     * REQUEST BODY
     * -------------------------------------------------------
     */

    let body: SubmitBody;

    try {
      body = (await request.json()) as SubmitBody;
    } catch {
      return jsonError("Invalid request body.");
    }

    const templateId =
      typeof body.templateId === "string"
        ? body.templateId.trim()
        : "";

    if (!templateId) {
      return jsonError(
        "Template ID is required.",
        400
      );
    }

    /*
     * -------------------------------------------------------
     * SELLER PROFILE
     * -------------------------------------------------------
     */

    const { data: sellerProfile, error: sellerError } =
      await supabase
        .from("seller_profiles")
        .select(
          `
            id,
            user_id,
            seller_status,
            is_verified
          `
        )
        .eq("user_id", user.id)
        .maybeSingle();

    if (sellerError) {
      console.error(
        "Marketplace submit seller profile error:",
        sellerError
      );

      return jsonError(
        "Unable to verify your seller profile.",
        500
      );
    }

    if (!sellerProfile) {
      return jsonError(
        "You need a seller profile before submitting a template.",
        403
      );
    }

    /*
     * -------------------------------------------------------
     * SELLER STATUS
     * -------------------------------------------------------
     *
     * A seller profile must exist before a template can enter
     * marketplace review.
     *
     * We do not require is_verified here because seller
     * verification can be handled separately by the platform
     * moderation system.
     */

    const sellerStatus = String(
      sellerProfile.seller_status || ""
    ).toLowerCase();

    if (
      sellerStatus === "suspended" ||
      sellerStatus === "blocked" ||
      sellerStatus === "banned"
    ) {
      return jsonError(
        "Your seller account is not allowed to submit templates.",
        403
      );
    }

    /*
     * -------------------------------------------------------
     * TEMPLATE OWNERSHIP
     * -------------------------------------------------------
     *
     * templates.seller_id references seller_profiles.id.
     * Therefore ownership is checked against sellerProfile.id.
     */

    const { data: template, error: templateError } =
      await supabase
        .from("templates")
        .select(
          `
            id,
            seller_id,
            name,
            category,
            description,
            price,
            currency,
            features,
            requirements,
            tech_stack,
            license,
            status,
            review_status
          `
        )
        .eq("id", templateId)
        .eq("seller_id", sellerProfile.id)
        .maybeSingle();

    if (templateError) {
      console.error(
        "Marketplace submit template error:",
        templateError
      );

      return jsonError(
        "Unable to load the template.",
        500
      );
    }

    if (!template) {
      return jsonError(
        "Template not found or you do not have permission to submit it.",
        404
      );
    }

    const currentTemplate =
      template as TemplateRow;

    /*
     * -------------------------------------------------------
     * CURRENT STATE
     * -------------------------------------------------------
     */

    const currentStatus = String(
      currentTemplate.status || ""
    ).toLowerCase();

    const currentReviewStatus = String(
      currentTemplate.review_status || ""
    ).toLowerCase();

    /*
     * Already under review.
     */

    if (
      currentStatus === "under_review" ||
      currentReviewStatus === "under_review"
    ) {
      return jsonError(
        "This template is already under marketplace review.",
        409
      );
    }

    /*
     * Published templates cannot be submitted again through
     * the seller submission endpoint.
     */

    if (
      currentStatus === "published" ||
      currentReviewStatus === "approved"
    ) {
      return jsonError(
        "This template is already published.",
        409
      );
    }

    /*
     * Only editable states can enter review.
     *
     * Rejected and review_required templates may be corrected
     * and submitted again.
     */

    const allowedSubmissionStates = new Set([
      "draft",
      "rejected",
      "review_required",
    ]);

    if (!allowedSubmissionStates.has(currentStatus)) {
      return jsonError(
        "This template is not currently eligible for submission.",
        409,
        {
          currentStatus,
          currentReviewStatus,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * REQUIRED TEMPLATE INFORMATION
     * -------------------------------------------------------
     */

    const missingFields: string[] = [];

    if (!hasText(currentTemplate.name)) {
      missingFields.push("Template name");
    }

    if (!hasText(currentTemplate.category)) {
      missingFields.push("Category");
    }

    if (!hasText(currentTemplate.description)) {
      missingFields.push("Full description");
    }

    /*
     * Price 0 is valid because free templates are supported.
     */

    if (
      currentTemplate.price === null ||
      currentTemplate.price === undefined ||
      !Number.isFinite(Number(currentTemplate.price)) ||
      Number(currentTemplate.price) < 0
    ) {
      missingFields.push("Valid price");
    }

    if (!hasText(currentTemplate.currency)) {
      missingFields.push("Currency");
    }

    if (!hasItems(currentTemplate.features)) {
      missingFields.push("At least one feature");
    }

    if (!hasItems(currentTemplate.requirements)) {
      missingFields.push("At least one requirement");
    }

    if (!hasItems(currentTemplate.tech_stack)) {
      missingFields.push(
        "At least one technology / tech stack item"
      );
    }

    if (!hasText(currentTemplate.license)) {
      missingFields.push("License");
    }

    /*
     * -------------------------------------------------------
     * REQUIRED FILES
     * -------------------------------------------------------
     *
     * Validation is performed against database records,
     * not browser state.
     */

    const { data: files, error: filesError } =
      await supabase
        .from("template_files")
        .select(
          `
            id,
            file_role,
            file_name,
            file_size,
            storage_provider,
            storage_object_key
          `
        )
        .eq("template_id", templateId);

    if (filesError) {
      console.error(
        "Marketplace submit files error:",
        filesError
      );

      return jsonError(
        "Unable to verify uploaded template files.",
        500
      );
    }

    const templateFiles =
      (files || []) as TemplateFileRow[];

    /*
     * Only accept files that are actually backed by a private
     * Backblaze B2 object.
     */

    const validFiles =
      templateFiles.filter(
        (file) =>
          typeof file.id === "string" &&
          typeof file.file_role === "string" &&
          file.file_role.trim().length > 0 &&
          Number(file.file_size || 0) > 0 &&
          file.storage_provider === "backblaze_b2" &&
          typeof file.storage_object_key === "string" &&
          file.storage_object_key.trim().length > 0
      );

    const hasRole = (role: string) =>
      validFiles.some(
        (file) => file.file_role === role
      );

    /*
     * Template package.
     */

    if (!hasRole("template")) {
      missingFields.push(
        "Template package"
      );
    }

    /*
     * Thumbnail.
     */

    if (!hasRole("thumbnail")) {
      missingFields.push("Thumbnail");
    }

    /*
     * At least one screenshot.
     */

    const screenshotCount =
      validFiles.filter(
        (file) =>
          file.file_role === "screenshot"
      ).length;

    if (screenshotCount < 1) {
      missingFields.push(
        "At least one screenshot"
      );
    }

    /*
     * Demo video.
     */

    if (!hasRole("demo_video")) {
      missingFields.push("Demo video");
    }

    /*
     * -------------------------------------------------------
     * FINAL VALIDATION
     * -------------------------------------------------------
     */

    if (missingFields.length > 0) {
      return jsonError(
        "Your template is not ready for submission.",
        422,
        {
          code:
            "SUBMISSION_REQUIREMENTS_NOT_MET",
          missing: missingFields,
          validation: {
            templatePackage:
              hasRole("template"),
            thumbnail:
              hasRole("thumbnail"),
            screenshots:
              screenshotCount,
            demoVideo:
              hasRole("demo_video"),
          },
        }
      );
    }

    /*
     * -------------------------------------------------------
     * FINAL STATE TRANSITION
     * -------------------------------------------------------
     *
     * draft/rejected/review_required
     *                 ↓
     *            under_review
     *
     * AI verification is intentionally NOT executed inside
     * this request. The verification engine can run separately
     * after submission.
     */

    const { data: updatedTemplate, error: updateError } =
      await supabase
        .from("templates")
        .update({
          status: "under_review",
          review_status: "under_review",
        })
        .eq("id", templateId)
        .eq("seller_id", sellerProfile.id)
        .in("status", [
          "draft",
          "rejected",
          "review_required",
        ])
        .select(
          `
            id,
            seller_id,
            name,
            slug,
            category,
            status,
            review_status,
            published_at,
            updated_at
          `
        )
        .single();

    if (updateError) {
      console.error(
        "Marketplace submit update error:",
        updateError
      );

      return jsonError(
        "Unable to submit the template for review.",
        500
      );
    }

    /*
     * -------------------------------------------------------
     * SUCCESS
     * -------------------------------------------------------
     */

    return NextResponse.json({
      success: true,
      message:
        "Template submitted successfully. It is now under marketplace review.",
      template: updatedTemplate,
      validation: {
        templatePackage: true,
        thumbnail: true,
        screenshots: screenshotCount,
        demoVideo: true,
      },
    });
  } catch (error) {
    console.error(
      "Marketplace template submission unexpected error:",
      error
    );

    return jsonError(
      "An unexpected error occurred while submitting the template.",
      500
    );
  }
}