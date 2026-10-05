import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

function jsonError(message: string, status = 400, details?: unknown) {
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
  return Array.isArray(value) && value.some(
    (item) => typeof item === "string" && item.trim().length > 0
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    /*
     * Always resolve the authenticated user on the server.
     * Never trust seller_id or user_id sent by the browser.
     */
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Marketplace submit auth error:", authError);
      return jsonError("Unable to verify your account.", 401);
    }

    if (!user) {
      return jsonError("You must be signed in to submit a template.", 401);
    }

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
      return jsonError("Template ID is required.");
    }

    /*
     * Find the seller profile belonging to the authenticated user.
     */
    const { data: sellerProfile, error: sellerError } =
      await supabase
        .from("seller_profiles")
        .select("id, user_id, seller_status, is_verified")
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
     * IMPORTANT:
     *
     * The existing templates table uses seller_id.
     * The value is the seller_profiles.id, not auth.users.id.
     *
     * Therefore ownership is verified against sellerProfile.id.
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

    const currentTemplate = template as TemplateRow;

    /*
     * Prevent invalid state transitions.
     */
    if (
      currentTemplate.status === "published" ||
      currentTemplate.review_status === "approved"
    ) {
      return jsonError(
        "This template is already published.",
        409
      );
    }

    if (
      currentTemplate.status === "under_review" ||
      currentTemplate.review_status === "under_review"
    ) {
      return jsonError(
        "This template is already under marketplace review.",
        409
      );
    }

    /*
     * Rejected templates may be edited and submitted again.
     * Draft/review-required states can also be submitted again after
     * the seller fixes the required issues.
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
      missingFields.push("At least one technology / tech stack item");
    }

    if (!hasText(currentTemplate.license)) {
      missingFields.push("License");
    }

    /*
     * Load every file belonging to this template.
     *
     * We deliberately validate the DB records rather than trusting
     * the browser uploader state.
     */
    const { data: files, error: filesError } = await supabase
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

    const templateFiles = (files || []) as TemplateFileRow[];

    const validFiles = templateFiles.filter(
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
      validFiles.some((file) => file.file_role === role);

    /*
     * Required marketplace assets.
     */
    if (!hasRole("template")) {
      missingFields.push("Template package");
    }

    if (!hasRole("thumbnail")) {
      missingFields.push("Thumbnail");
    }

    if (!hasRole("screenshot")) {
      missingFields.push("At least one screenshot");
    }

    if (!hasRole("demo_video")) {
      missingFields.push("Demo video");
    }

    if (missingFields.length > 0) {
      return jsonError(
        "Your template is not ready for submission.",
        422,
        {
          code: "SUBMISSION_REQUIREMENTS_NOT_MET",
          missing: missingFields,
        }
      );
    }

    /*
     * Final state transition.
     *
     * AI verification is intentionally NOT executed here.
     * This endpoint only moves a valid seller draft into review.
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
        .in("status", ["draft", "rejected", "review_required"])
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

    return NextResponse.json({
      success: true,
      message:
        "Template submitted successfully. It is now under marketplace review.",
      template: updatedTemplate,
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