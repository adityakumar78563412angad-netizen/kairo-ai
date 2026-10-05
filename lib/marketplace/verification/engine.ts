import "server-only";

import {
  createB2DownloadUrl,
} from "@/lib/marketplace/b2";

import {
  createServerSupabaseClient,
} from "@/lib/supabase-server";

import {
  normalizeAIResult,
} from "./rules";

import {
  verifyTemplateWithGemini,
} from "./gemini";

import type {
  TemplateVerificationAIResult,
} from "./types";

type TemplateRecord = {
  id: string;
  seller_id: string;
  name: string;
  category: string | null;
  short_description: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  features: string[] | null;
  requirements: string[] | null;
  tech_stack: string[] | null;
  license: string | null;
};

type TemplateFileRecord = {
  id: string;
  file_name: string;
  file_size: number | null;
  content_type: string | null;
  file_role: string | null;
  storage_object_key: string | null;
};

export async function runTemplateVerification(
  templateId: string,
  verificationId: string
) {
  const supabase =
    await createServerSupabaseClient();

  const { data: verification, error: verificationError } =
    await supabase
      .from("template_verifications")
      .select("*")
      .eq("id", verificationId)
      .eq("template_id", templateId)
      .single();

  if (
    verificationError ||
    !verification
  ) {
    throw new Error(
      "Verification record was not found."
    );
  }

  const { data: template, error: templateError } =
    await supabase
      .from("templates")
      .select(
        `
        id,
        seller_id,
        name,
        category,
        short_description,
        description,
        price,
        currency,
        features,
        requirements,
        tech_stack,
        license
        `
      )
      .eq("id", templateId)
      .single<TemplateRecord>();

  if (
    templateError ||
    !template
  ) {
    throw new Error(
      "Template was not found."
    );
  }

  const { data: files, error: filesError } =
    await supabase
      .from("template_files")
      .select(
        `
        id,
        file_name,
        file_size,
        content_type,
        file_role,
        storage_object_key
        `
      )
      .eq("template_id", templateId);

  if (filesError) {
    throw new Error(
      "Unable to load template files."
    );
  }

  const templateFiles =
    (files || []) as TemplateFileRecord[];

  const mediaFiles =
    templateFiles.filter(
      (file) =>
        (
          file.file_role === "thumbnail" ||
          file.file_role === "screenshot" ||
          file.file_role === "demo_video"
        ) &&
        file.storage_object_key
    );

  if (
    !mediaFiles.some(
      (file) =>
        file.file_role === "thumbnail"
    )
  ) {
    throw new Error(
      "Template thumbnail is missing."
    );
  }

  if (
    !mediaFiles.some(
      (file) =>
        file.file_role === "screenshot"
    )
  ) {
    throw new Error(
      "Template screenshot is missing."
    );
  }

  if (
    !mediaFiles.some(
      (file) =>
        file.file_role === "demo_video"
    )
  ) {
    throw new Error(
      "Template demo video is missing."
    );
  }

  await supabase
    .from("template_verifications")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", verificationId);

  try {
    const media = [];

    for (const file of mediaFiles) {
      if (!file.storage_object_key) {
        continue;
      }

      const signedUrl =
        await createB2DownloadUrl(
          file.storage_object_key,
          30 * 60
        );

      if (
        !signedUrl ||
        !file.content_type
      ) {
        continue;
      }

      if (
        file.file_role === "thumbnail" ||
        file.file_role === "screenshot"
      ) {
        media.push({
          role:
            file.file_role as
              | "thumbnail"
              | "screenshot",

          mimeType:
            file.content_type,

          uri: signedUrl,
        });
      }

      if (
        file.file_role === "demo_video"
      ) {
        media.push({
          role: "demo_video" as const,

          mimeType:
            file.content_type,

          uri: signedUrl,
        });
      }
    }

    const aiResponse =
      await verifyTemplateWithGemini({
        metadata: {
          name: template.name,

          category:
            template.category || "",

          short_description:
            template.short_description || "",

          description:
            template.description || "",

          features:
            template.features || [],

          requirements:
            template.requirements || [],

          tech_stack:
            template.tech_stack || [],

          license:
            template.license || "",

          price:
            Number(template.price || 0),

          currency:
            template.currency || "INR",
        },

        media,
      });

    const normalized =
      normalizeAIResult(
        aiResponse.result
      );

    await supabase
      .from("template_verifications")
      .update({
        status: "completed",

        result:
          normalized.result,

        verification_score:
          normalized.overall_score,

        checks:
          normalized.checks,

        findings:
          normalized.findings,

        evidence:
          normalized.evidence,

        ai_model:
          aiResponse.model,

        ai_response:
          normalized,

        completed_at:
          new Date().toISOString(),

        error_message:
          null,
      })
      .eq("id", verificationId);

    return normalized;
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
      })
      .eq("id", verificationId);

    throw error;
  }
}