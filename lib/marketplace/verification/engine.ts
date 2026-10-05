import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createB2DownloadUrl } from "@/lib/marketplace/b2";

import {
  normalizeVerificationResult,
} from "./rule";

import {
  verifyTemplateWithGemini,
} from "./gemini";

import type {
  VerificationMediaInput,
  VerificationTemplateMetadata,
} from "./type";

type TemplateRow = {
  id: string;
  name: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  features: string[] | null;
  requirements: string[] | null;
  tech_stack: string[] | null;
  license: string | null;
};

type TemplateFileRow = {
  id: string;
  file_name: string | null;
  file_size: number | null;
  content_type: string | null;
  file_role: string | null;
  storage_provider: string | null;
  storage_bucket: string | null;
  storage_object_key: string | null;
  storage_region: string | null;
};

function isValidStorageFile(
  file: TemplateFileRow
) {
  return (
    file.storage_provider ===
      "backblaze_b2" &&
    Boolean(
      file.storage_object_key?.trim()
    ) &&
    Number(file.file_size || 0) > 0
  );
}

function getMimeType(
  file: TemplateFileRow
): string {
  if (
    typeof file.content_type === "string" &&
    file.content_type.trim()
  ) {
    return file.content_type;
  }

  const fileName =
    file.file_name?.toLowerCase() || "";

  if (
    fileName.endsWith(".mp4")
  ) {
    return "video/mp4";
  }

  if (
    fileName.endsWith(".webm")
  ) {
    return "video/webm";
  }

  if (
    fileName.endsWith(".png")
  ) {
    return "image/png";
  }

  if (
    fileName.endsWith(".webp")
  ) {
    return "image/webp";
  }

  if (
    fileName.endsWith(".gif")
  ) {
    return "image/gif";
  }

  return "image/jpeg";
}

async function createMediaUrl(
  file: TemplateFileRow
): Promise<string> {
  if (!file.storage_object_key) {
    throw new Error(
      `Storage object key is missing for file ${file.id}.`
    );
  }

  return createB2DownloadUrl(
    file.storage_object_key
  );
}

export async function runTemplateVerification(
  verificationId: string
) {
  const supabase =
    await createServerSupabaseClient();

  /*
   * Load verification record.
   */

  const {
    data: verification,
    error: verificationError,
  } = await supabase
    .from("template_verifications")
    .select(
      `
        id,
        template_id,
        version_id,
        status,
        result
      `
    )
    .eq("id", verificationId)
    .single();

  if (verificationError) {
    throw new Error(
      `Unable to load verification: ${verificationError.message}`
    );
  }

  /*
   * Prevent duplicate processing.
   */

  if (
    verification.status === "completed"
  ) {
    return verification;
  }

  /*
   * Mark as processing.
   */

  const { error: processingError } =
    await supabase
      .from("template_verifications")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", verificationId);

  if (processingError) {
    throw new Error(
      `Unable to start verification: ${processingError.message}`
    );
  }

  try {
    /*
     * Load template metadata.
     */

    const {
      data: template,
      error: templateError,
    } = await supabase
      .from("templates")
      .select(
        `
          id,
          name,
          category,
          description,
          price,
          currency,
          features,
          requirements,
          tech_stack,
          license
        `
      )
      .eq(
        "id",
        verification.template_id
      )
      .single();

    if (templateError || !template) {
      throw new Error(
        templateError?.message ||
          "Template not found."
      );
    }

    /*
     * Load marketplace files.
     */

    const {
      data: files,
      error: filesError,
    } = await supabase
      .from("template_files")
      .select(
        `
          id,
          file_name,
          file_size,
          content_type,
          file_role,
          storage_provider,
          storage_bucket,
          storage_object_key,
          storage_region
        `
      )
      .eq(
        "template_id",
        verification.template_id
      );

    if (filesError) {
      throw new Error(
        `Unable to load template files: ${filesError.message}`
      );
    }

    const validFiles =
      ((files || []) as TemplateFileRow[])
        .filter(isValidStorageFile);

    const thumbnail =
      validFiles.find(
        (file) =>
          file.file_role ===
          "thumbnail"
      );

    const screenshots =
      validFiles.filter(
        (file) =>
          file.file_role ===
          "screenshot"
      );

    const demoVideo =
      validFiles.find(
        (file) =>
          file.file_role ===
          "demo_video"
      );

    if (!thumbnail) {
      throw new Error(
        "Template verification requires a thumbnail."
      );
    }

    if (screenshots.length === 0) {
      throw new Error(
        "Template verification requires at least one screenshot."
      );
    }

    if (!demoVideo) {
      throw new Error(
        "Template verification requires a demo video."
      );
    }

    /*
     * Build media inputs.
     *
     * NOTE:
     * The current implementation generates B2 signed URLs.
     * Gemini File API upload should be added for production video
     * processing if the selected Gemini API/model requires a
     * Gemini-hosted file URI.
     */

    const media: VerificationMediaInput[] = [];

    const thumbnailUrl =
      await createMediaUrl(
        thumbnail
      );

    media.push({
      source: "thumbnail",
      mimeType: getMimeType(
        thumbnail
      ),
      fileUri: thumbnailUrl,
    });

    /*
     * Limit the initial multimodal request to a reasonable
     * number of screenshots.
     */

    const selectedScreenshots =
      screenshots.slice(0, 8);

    for (const screenshot of selectedScreenshots) {
      const screenshotUrl =
        await createMediaUrl(
          screenshot
        );

      media.push({
        source: "screenshot",
        mimeType: getMimeType(
          screenshot
        ),
        fileUri: screenshotUrl,
      });
    }

    const demoVideoUrl =
      await createMediaUrl(
        demoVideo
      );

    media.push({
      source: "demo_video",
      mimeType: getMimeType(
        demoVideo
      ),
      fileUri: demoVideoUrl,
    });

    const metadata: VerificationTemplateMetadata =
      {
        id: template.id,
        name: template.name,
        category: template.category,
        description: template.description,
        price: template.price,
        currency: template.currency,
        features: template.features,
        requirements:
          template.requirements,
        tech_stack:
          template.tech_stack,
        license: template.license,
      };

    /*
     * Gemini verification.
     */

    const aiResponse =
      await verifyTemplateWithGemini(
        metadata,
        media
      );

    const normalized =
      normalizeVerificationResult(
        aiResponse.result
      );

    /*
     * Store completed verification.
     */

    const { data: completed, error: completeError } =
      await supabase
        .from("template_verifications")
        .update({
          status: "completed",
          result: normalized.result,
          verification_score:
            normalized.overall_score,
          checks: normalized.checks,
          findings:
            normalized.findings,
          evidence:
            normalized.evidence,
          ai_model:
            aiResponse.model,
          ai_response:
            aiResponse.result,
          completed_at:
            new Date().toISOString(),
          error_message: null,
        })
        .eq("id", verificationId)
        .select()
        .single();

    if (completeError) {
      throw new Error(
        `Unable to save verification result: ${completeError.message}`
      );
    }

    return completed;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Template verification failed.";

    await supabase
      .from("template_verifications")
      .update({
        status: "failed",
        error_message: message,
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", verificationId);

    throw error;
  }
}