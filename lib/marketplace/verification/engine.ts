
import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createB2DownloadUrl } from "@/lib/marketplace/b2";

import {
  normalizeVerificationResult,
} from "./rule";

import {
  verifyTemplateWithGemini,
} from "./gemini";

import {
  inspectTemplatePackage,
} from "./package-inspector";

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

const MAX_PACKAGE_SIZE =
  2 * 1024 * 1024 * 1024;

const PACKAGE_DOWNLOAD_TIMEOUT_MS =
  5 * 60 * 1000;

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
    fileName.endsWith(".zip")
  ) {
    return "application/zip";
  }

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

/**
 * Downloads a marketplace package from B2
 * into a temporary server-side file.
 *
 * The package is never executed.
 */
async function downloadPackageToTempFile(
  file: TemplateFileRow
): Promise<string> {
  if (!file.storage_object_key) {
    throw new Error(
      `Storage object key is missing for package ${file.id}.`
    );
  }

  const expectedSize = Number(
    file.file_size || 0
  );

  if (
    expectedSize <= 0 ||
    expectedSize > MAX_PACKAGE_SIZE
  ) {
    throw new Error(
      "Template package size is invalid or exceeds the allowed limit."
    );
  }

  const signedUrl =
    await createB2DownloadUrl(
      file.storage_object_key
    );

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    PACKAGE_DOWNLOAD_TIMEOUT_MS
  );

  const tempFile = path.join(
    os.tmpdir(),
    `zuqen-marketplace-package-${crypto.randomUUID()}.zip`
  );

  try {
    const response = await fetch(
      signedUrl,
      {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(
        `Unable to download template package from storage. HTTP ${response.status}.`
      );
    }

    const contentLength =
      response.headers.get(
        "content-length"
      );

    if (
      contentLength &&
      Number(contentLength) >
        MAX_PACKAGE_SIZE
    ) {
      throw new Error(
        "Template package exceeds the maximum supported size."
      );
    }

    if (!response.body) {
      throw new Error(
        "Template package download returned an empty response body."
      );
    }

    const output =
      fs.createWriteStream(
        tempFile,
        {
          flags: "wx",
        }
      );

    let totalBytes = 0;

    try {
      for await (
        const chunk of response.body as AsyncIterable<Uint8Array>
      ) {
        totalBytes += chunk.byteLength;

        if (
          totalBytes >
          MAX_PACKAGE_SIZE
        ) {
          throw new Error(
            "Template package exceeds the maximum supported size."
          );
        }

        if (
          expectedSize > 0 &&
          totalBytes > expectedSize
        ) {
          throw new Error(
            "Downloaded package is larger than its stored metadata."
          );
        }

        if (
          !output.write(
            Buffer.from(chunk)
          )
        ) {
          await new Promise<void>(
            (resolve, reject) => {
              output.once(
                "drain",
                resolve
              );
              output.once(
                "error",
                reject
              );
            }
          );
        }
      }

      await new Promise<void>(
        (resolve, reject) => {
          output.end(() => resolve());
          output.once(
            "error",
            reject
          );
        }
      );
    } catch (error) {
      output.destroy();

      throw error;
    }

    const downloadedStat =
      await fs.promises.stat(
        tempFile
      );

    if (
      downloadedStat.size <= 0
    ) {
      throw new Error(
        "Downloaded template package is empty."
      );
    }

    if (
      expectedSize > 0 &&
      downloadedStat.size !==
        expectedSize
    ) {
      throw new Error(
        "Downloaded package size does not match stored file metadata."
      );
    }

    return tempFile;
  } finally {
    clearTimeout(timeout);
  }
}

async function safelyRemoveTempFile(
  filePath: string | null
) {
  if (!filePath) return;

  try {
    await fs.promises.rm(
      filePath,
      {
        force: true,
      }
    );
  } catch {
    // Cleanup failure must not hide the actual verification result.
  }
}

function packageInspectionToChecks(
  packageInspection: Awaited<
    ReturnType<typeof inspectTemplatePackage>
  >
) {
  return {
    status:
      packageInspection.status,

    package_type:
      packageInspection.packageType,

    archive_size:
      packageInspection.archiveSize,

    entry_count:
      packageInspection.entryCount,

    total_uncompressed_size:
      packageInspection.totalUncompressedSize,

    compression_ratio:
      packageInspection.compressionRatio,

    framework_hints:
      packageInspection.frameworkHints,

    important_files:
      packageInspection.importantFiles,

    suspicious_files:
      packageInspection.suspiciousFiles,

    findings:
      packageInspection.findings,
  };
}

function determineFinalResult(
  aiResult:
    | "verified"
    | "review_required"
    | "rejected",
  packageStatus:
    | "pass"
    | "warning"
    | "fail"
):
  | "verified"
  | "review_required"
  | "rejected" {
  if (
    packageStatus === "fail"
  ) {
    return "rejected";
  }

  if (
    packageStatus === "warning"
  ) {
    if (
      aiResult === "rejected"
    ) {
      return "rejected";
    }

    return "review_required";
  }

  return aiResult;
}

function adjustScore(
  score: number,
  packageStatus:
    | "pass"
    | "warning"
    | "fail"
): number {
  if (
    packageStatus === "fail"
  ) {
    return Math.min(
      score,
      59
    );
  }

  if (
    packageStatus === "warning"
  ) {
    return Math.min(
      score,
      81
    );
  }

  return score;
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
    .eq(
      "id",
      verificationId
    )
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
    verification.status ===
    "completed"
  ) {
    return verification;
  }

  /*
   * Mark as processing.
   */

  const {
    error: processingError,
  } = await supabase
    .from("template_verifications")
    .update({
      status: "processing",
      started_at:
        new Date().toISOString(),
      error_message: null,
    })
    .eq(
      "id",
      verificationId
    );

  if (processingError) {
    throw new Error(
      `Unable to start verification: ${processingError.message}`
    );
  }

  let packageTempFile:
    | string
    | null = null;

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

    if (
      templateError ||
      !template
    ) {
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
      (
        (files || []) as TemplateFileRow[]
      ).filter(
        isValidStorageFile
      );

    /*
     * Find required verification assets.
     */

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

    /*
     * Template package.
     *
     * We accept the explicit "template" role.
     * ZIP content type / filename is used as a
     * safe fallback for older marketplace records.
     */

    const templatePackage =
      validFiles.find(
        (file) =>
          file.file_role ===
          "template"
      ) ??
      validFiles.find(
        (file) => {
          const name =
            file.file_name
              ?.toLowerCase() || "";

          const mime =
            file.content_type
              ?.toLowerCase() || "";

          return (
            name.endsWith(".zip") ||
            mime ===
              "application/zip" ||
            mime ===
              "application/x-zip-compressed"
          );
        }
      );

    if (!templatePackage) {
      throw new Error(
        "Template verification requires the uploaded template package."
      );
    }

    if (!thumbnail) {
      throw new Error(
        "Template verification requires a thumbnail."
      );
    }

    if (
      screenshots.length === 0
    ) {
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
     * ---------------------------------------------------------
     * STEP 1 — Secure package inspection
     * ---------------------------------------------------------
     *
     * The package is downloaded to a temporary file.
     *
     * It is NEVER executed.
     */

    packageTempFile =
      await downloadPackageToTempFile(
        templatePackage
      );

    const packageInspection =
      await inspectTemplatePackage(
        packageTempFile,
        Number(
          templatePackage.file_size || 0
        )
      );

    /*
     * ---------------------------------------------------------
     * STEP 2 — Build media inputs
     * ---------------------------------------------------------
     */

    const media:
      VerificationMediaInput[] =
      [];

    const thumbnailUrl =
      await createMediaUrl(
        thumbnail
      );

    media.push({
      source: "thumbnail",
      mimeType:
        getMimeType(
          thumbnail
        ),
      fileUri:
        thumbnailUrl,
    });

    /*
     * Limit screenshots to eight.
     */

    const selectedScreenshots =
      screenshots.slice(
        0,
        8
      );

    for (
      const screenshot of
        selectedScreenshots
    ) {
      const screenshotUrl =
        await createMediaUrl(
          screenshot
        );

      media.push({
        source: "screenshot",
        mimeType:
          getMimeType(
            screenshot
          ),
        fileUri:
          screenshotUrl,
      });
    }

    const demoVideoUrl =
      await createMediaUrl(
        demoVideo
      );

    media.push({
      source: "demo_video",
      mimeType:
        getMimeType(
          demoVideo
        ),
      fileUri:
        demoVideoUrl,
    });

    /*
     * ---------------------------------------------------------
     * STEP 3 — Template metadata
     * ---------------------------------------------------------
     */

    const metadata:
      VerificationTemplateMetadata =
      {
        id: template.id,
        name: template.name,
        category:
          template.category,
        description:
          template.description,
        price:
          template.price,
        currency:
          template.currency,
        features:
          template.features,
        requirements:
          template.requirements,
        tech_stack:
          template.tech_stack,
        license:
          template.license,
      };

    /*
     * ---------------------------------------------------------
     * STEP 4 — Gemini multimodal verification
     * ---------------------------------------------------------
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
     * ---------------------------------------------------------
     * STEP 5 — Combine package inspection + AI result
     * ---------------------------------------------------------
     */

    const finalResult =
      determineFinalResult(
        normalized.result,
        packageInspection.status
      );

    const finalScore =
      adjustScore(
        normalized.overall_score,
        packageInspection.status
      );

    /*
     * Store package inspection inside checks.
     *
     * Existing Gemini checks remain untouched.
     */

    const combinedChecks = {
      ...normalized.checks,

      package_inspection:
        packageInspectionToChecks(
          packageInspection
        ),
    };

    /*
     * Keep the complete package inspection
     * inside AI response as well, so the
     * verification record remains auditable.
     */

    const combinedAIResponse = {
      ...aiResponse.result,

      zuqen_package_inspection:
        packageInspection,
    };

    /*
     * ---------------------------------------------------------
     * STEP 6 — Store completed verification
     * ---------------------------------------------------------
     */

    const {
      data: completed,
      error: completeError,
    } = await supabase
      .from(
        "template_verifications"
      )
      .update({
        status: "completed",

        result:
          finalResult,

        verification_score:
          finalScore,

        checks:
          combinedChecks,

        findings:
          normalized.findings,

        evidence:
          normalized.evidence,

        ai_model:
          aiResponse.model,

        ai_response:
          combinedAIResponse,

        completed_at:
          new Date().toISOString(),

        error_message: null,
      })
      .eq(
        "id",
        verificationId
      )
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
      .from(
        "template_verifications"
      )
      .update({
        status: "failed",
        error_message:
          message,
        completed_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        verificationId
      );

    throw error;
  } finally {
    /*
     * Always remove the temporary
     * downloaded package.
     */
    await safelyRemoveTempFile(
      packageTempFile
    );
  }
}
