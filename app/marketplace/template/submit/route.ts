import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const REQUIRED_ROLES = {
  template: "template",
  thumbnail: "thumbnail",
  screenshot: "screenshot",
  demoVideo: "demo_video",
} as const;

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
  template_id: string;
  file_name: string;
  file_size: number | null;
  content_type: string | null;
  file_role: string | null;
  storage_provider: string | null;
  storage_object_key: string | null;
  is_private: boolean | null;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasArrayItems(value: string[] | null | undefined) {
  return Array.isArray(value) && value.some((item) => item?.trim());
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Marketplace submit auth error:", authError);
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);

    const templateId =
      typeof body?.templateId === "string"
        ? body.templateId.trim()
        : "";

    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          error: "Template ID is required.",
        },
        { status: 400 }
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
        "Marketplace seller profile error:",
        sellerError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify your seller profile.",
        },
        { status: 500 }
      );
    }

    if (!sellerProfile) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Create your seller profile before submitting a template.",
        },
        { status: 403 }
      );
    }

    /*
     * -------------------------------------------------------
     * TEMPLATE OWNERSHIP
     * -------------------------------------------------------
     */

    const { data: templateData, error: templateError } =
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
        "Marketplace template load error:",
        templateError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify template ownership.",
        },
        { status: 500 }
      );
    }

    if (!templateData) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Template not found or you do not have permission to submit it.",
        },
        { status: 404 }
      );
    }

    const template = templateData as TemplateRow;

    /*
     * -------------------------------------------------------
     * STATE PROTECTION
     * -------------------------------------------------------
     */

    const currentStatus = String(template.status || "").toLowerCase();
    const currentReviewStatus = String(
      template.review_status || ""
    ).toLowerCase();

    if (
      currentStatus === "under_review" ||
      currentReviewStatus === "under_review"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This template is already under marketplace review.",
        },
        { status: 409 }
      );
    }

    if (
      currentStatus === "published" ||
      currentReviewStatus === "approved"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This template is already published.",
        },
        { status: 409 }
      );
    }

    /*
     * Rejected templates are allowed to be corrected and
     * submitted again.
     *
     * Draft is the normal state.
     */

    if (
      currentStatus !== "draft" &&
      currentStatus !== "rejected"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This template is not currently eligible for submission.",
        },
        { status: 409 }
      );
    }

    /*
     * -------------------------------------------------------
     * REQUIRED TEMPLATE INFORMATION
     * -------------------------------------------------------
     */

    const missingInformation: string[] = [];

    if (!hasText(template.name)) {
      missingInformation.push("Template name");
    }

    if (!hasText(template.category)) {
      missingInformation.push("Category");
    }

    if (!hasText(template.description)) {
      missingInformation.push("Full description");
    }

    if (
      template.price === null ||
      template.price === undefined ||
      !Number.isFinite(Number(template.price)) ||
      Number(template.price) < 0
    ) {
      missingInformation.push("Valid price");
    }

    if (!hasText(template.currency)) {
      missingInformation.push("Currency");
    }

    if (!hasArrayItems(template.features)) {
      missingInformation.push("At least one feature");
    }

    if (!hasArrayItems(template.requirements)) {
      missingInformation.push("At least one requirement");
    }

    if (!hasArrayItems(template.tech_stack)) {
      missingInformation.push("At least one technology / tech stack item");
    }

    if (!hasText(template.license)) {
      missingInformation.push("License");
    }

    /*
     * -------------------------------------------------------
     * REQUIRED FILES
     * -------------------------------------------------------
     */

    const { data: files, error: filesError } = await supabase
      .from("template_files")
      .select(
        `
          id,
          template_id,
          file_name,
          file_size,
          content_type,
          file_role,
          storage_provider,
          storage_object_key,
          is_private
        `
      )
      .eq("template_id", templateId);

    if (filesError) {
      console.error(
        "Marketplace template files error:",
        filesError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify uploaded template files.",
        },
        { status: 500 }
      );
    }

    const templateFiles = (files || []) as TemplateFileRow[];

    const validFiles = templateFiles.filter(
      (file) =>
        file.storage_provider === "backblaze_b2" &&
        Boolean(file.storage_object_key) &&
        Number(file.file_size || 0) > 0
    );

    const hasTemplatePackage = validFiles.some(
      (file) =>
        file.file_role === REQUIRED_ROLES.template
    );

    const hasThumbnail = validFiles.some(
      (file) =>
        file.file_role === REQUIRED_ROLES.thumbnail
    );

    const screenshotCount = validFiles.filter(
      (file) =>
        file.file_role === REQUIRED_ROLES.screenshot
    ).length;

    const hasDemoVideo = validFiles.some(
      (file) =>
        file.file_role === REQUIRED_ROLES.demoVideo
    );

    const missingFiles: string[] = [];

    if (!hasTemplatePackage) {
      missingFiles.push("Template package");
    }

    if (!hasThumbnail) {
      missingFiles.push("Thumbnail");
    }

    if (screenshotCount < 1) {
      missingFiles.push("At least one screenshot");
    }

    if (!hasDemoVideo) {
      missingFiles.push("Demo video");
    }

    /*
     * -------------------------------------------------------
     * FINAL VALIDATION
     * -------------------------------------------------------
     */

    if (
      missingInformation.length > 0 ||
      missingFiles.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "SUBMISSION_REQUIREMENTS_NOT_MET",
          error:
            "Your template is not ready for marketplace review.",
          missingInformation,
          missingFiles,
        },
        { status: 422 }
      );
    }

    /*
     * -------------------------------------------------------
     * SUBMIT
     * -------------------------------------------------------
     *
     * The actual state transition happens only here.
     *
     * draft/rejected
     *      ↓
     * under_review
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
        .in("status", ["draft", "rejected"])
        .select(
          `
            id,
            seller_id,
            name,
            status,
            review_status
          `
        )
        .single();

    if (updateError) {
      console.error(
        "Marketplace template submission update error:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to submit the template for review.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Template submitted successfully for marketplace review.",
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
      "Marketplace template submission error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to submit template for review.",
      },
      { status: 500 }
    );
  }
}