import "server-only";

import { GoogleGenAI } from "@google/genai";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import type {
  TemplateVerificationAIResult,
  VerificationMediaInput,
  VerificationTemplateMetadata,
} from "./type";

const MODEL =
  process.env.GEMINI_TEMPLATE_VERIFICATION_MODEL ||
  "gemini-3.8-flash";

const MAX_MEDIA_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return new GoogleGenAI({
    apiKey,
  });
}

const verificationSchema = {
  type: "object",
  properties: {
    result: {
      type: "string",
      enum: ["verified", "review_required", "rejected"],
    },

    overall_score: {
      type: "number",
      minimum: 0,
      maximum: 100,
    },

    summary: {
      type: "string",
    },

    checks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: {
            type: "string",
          },
          label: {
            type: "string",
          },
          status: {
            type: "string",
            enum: ["pass", "warning", "fail", "not_checked"],
          },
          score: {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
          explanation: {
            type: "string",
          },
        },
        required: [
          "key",
          "label",
          "status",
          "score",
          "explanation",
        ],
      },
    },

    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
          },
          category: {
            type: "string",
            enum: [
              "metadata",
              "visual",
              "video",
              "package",
              "consistency",
              "security",
              "claim",
            ],
          },
          title: {
            type: "string",
          },
          description: {
            type: "string",
          },
        },
        required: [
          "severity",
          "category",
          "title",
          "description",
        ],
      },
    },

    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: {
            type: "string",
            enum: [
              "metadata",
              "thumbnail",
              "screenshot",
              "demo_video",
              "package",
            ],
          },
          description: {
            type: "string",
          },
          timestamp: {
            type: "string",
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
        },
        required: [
          "source",
          "description",
          "confidence",
        ],
      },
    },

    claimed_features_supported: {
      type: "array",
      items: {
        type: "string",
      },
    },

    unsupported_claims: {
      type: "array",
      items: {
        type: "string",
      },
    },

    suspicious_signals: {
      type: "array",
      items: {
        type: "string",
      },
    },

    recommendations: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },

  required: [
    "result",
    "overall_score",
    "summary",
    "checks",
    "findings",
    "evidence",
    "claimed_features_supported",
    "unsupported_claims",
    "suspicious_signals",
    "recommendations",
  ],
} as const;

function buildMetadataText(
  template: VerificationTemplateMetadata
): string {
  return JSON.stringify(
    {
      id: template.id,
      name: template.name,
      category: template.category,
      description: template.description,
      price: template.price,
      currency: template.currency,
      features: template.features || [],
      requirements: template.requirements || [],
      tech_stack: template.tech_stack || [],
      license: template.license,
    },
    null,
    2
  );
}

function cleanJsonText(text: string): string {
  const trimmed = text.trim();

  if (
    trimmed.startsWith("```json") &&
    trimmed.endsWith("```")
  ) {
    return trimmed.slice(7, -3).trim();
  }

  if (
    trimmed.startsWith("```") &&
    trimmed.endsWith("```")
  ) {
    return trimmed.slice(3, -3).trim();
  }

  return trimmed;
}

function sanitizeFileName(value: string): string {
  const cleaned = value
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);

  return cleaned || "marketplace-media";
}

function getExtensionFromMimeType(
  mimeType: string
): string {
  const normalized = mimeType.toLowerCase();

  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/markdown": ".md",
  };

  return map[normalized] || "";
}

async function downloadB2Media(
  item: VerificationMediaInput
): Promise<string> {
  if (!item.fileUri) {
    throw new Error("Verification media is missing its file URI.");
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(item.fileUri, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Unable to download verification media from storage. HTTP ${response.status}.`
      );
    }

    const contentLengthHeader =
      response.headers.get("content-length");

    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);

      if (
        Number.isFinite(contentLength) &&
        contentLength > MAX_MEDIA_FILE_SIZE
      ) {
        throw new Error(
          `Verification media exceeds the 2 GB maximum supported size.`
        );
      }
    }

    if (!response.body) {
      throw new Error(
        "Verification media response did not contain a readable body."
      );
    }

    const fileName =
      sanitizeFileName(
        `zuqen-verification-${crypto.randomUUID()}`
      ) +
      getExtensionFromMimeType(item.mimeType);

    const filePath = path.join(
      os.tmpdir(),
      fileName
    );

    const fileHandle = await fs.open(
      filePath,
      "w"
    );

    let totalBytes = 0;

    try {
      const reader = response.body.getReader();

      while (true) {
        const { done, value } =
          await reader.read();

        if (done) {
          break;
        }

        if (!value) {
          continue;
        }

        totalBytes += value.byteLength;

        if (totalBytes > MAX_MEDIA_FILE_SIZE) {
          throw new Error(
            "Verification media exceeds the 2 GB maximum supported size."
          );
        }

        await fileHandle.write(value);
      }
    } finally {
      await fileHandle.close();
    }

    if (totalBytes === 0) {
      await fs.rm(filePath, {
        force: true,
      });

      throw new Error(
        "Verification media is empty."
      );
    }

    return filePath;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "Verification media download timed out."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadMediaToGemini(
  ai: GoogleGenAI,
  item: VerificationMediaInput
) {
  const localPath =
    await downloadB2Media(item);

  try {
    const uploaded =
      await ai.files.upload({
        file: localPath,
        config: {
          mimeType: item.mimeType,
          displayName:
            sanitizeFileName(
              item.fileName ||
                "ZUQEN marketplace verification media"
            ),
        },
      });

    if (!uploaded.uri) {
      throw new Error(
        "Gemini File API did not return a file URI."
      );
    }

    return uploaded;
  } finally {
    await fs.rm(localPath, {
      force: true,
    });
  }
}

async function deleteGeminiFile(
  ai: GoogleGenAI,
  fileName: string | undefined
): Promise<void> {
  if (!fileName) {
    return;
  }

  try {
    await ai.files.delete({
      name: fileName,
    });
  } catch (error) {
    console.error(
      "Failed to delete temporary Gemini verification file:",
      {
        fileName,
        error,
      }
    );
  }
}

export async function verifyTemplateWithGemini(
  template: VerificationTemplateMetadata,
  media: VerificationMediaInput[]
): Promise<{
  result: TemplateVerificationAIResult;
  model: string;
}> {
  const ai = getGeminiClient();

  if (!media.length) {
    throw new Error(
      "At least one verification media file is required."
    );
  }

  const uploadedFiles: Array<{
    name?: string;
    uri?: string;
    mimeType?: string;
  }> = [];

  try {
    /*
     * Marketplace files live privately in Backblaze B2.
     *
     * We intentionally do not pass the B2 signed URL directly to Gemini.
     * Instead:
     *
     * B2 signed URL
     *      ↓
     * temporary server file
     *      ↓
     * Gemini File API
     *      ↓
     * Gemini file URI
     *
     * This supports large media and avoids relying on external URL
     * request-size limits.
     */
    for (const item of media) {
      const uploaded =
        await uploadMediaToGemini(
          ai,
          item
        );

      uploadedFiles.push(uploaded);
    }

    const mediaParts = uploadedFiles.map(
      (file) => ({
        fileData: {
          fileUri: file.uri,
          mimeType: file.mimeType,
        },
      })
    );

    const prompt = `
You are the independent AI verification layer for the ZUQEN marketplace.

Your job is to analyze whether a seller's marketplace template listing is
consistent with the evidence provided.

IMPORTANT RULES:

1. Do not assume that seller claims are true.
2. Compare the written metadata against the thumbnail, screenshots and demo video.
3. Identify contradictions or strong evidence that the media does not represent
   the advertised template.
4. Distinguish "not demonstrated" from "false".
5. Missing evidence should normally produce a warning or review_required result,
   not an automatic rejection.
6. Strong deception or serious contradictions may produce rejected.
7. Do not make legal conclusions.
8. Do not claim that visual analysis proves a package is malware-free.
9. Security/malware scanning is handled by a separate technical inspection layer.
10. Never modify the template.
11. If evidence is ambiguous, prefer review_required.
12. Do not invent evidence that is not visible in the supplied media.
13. Do not claim that a feature exists merely because the seller listed it.
14. If a feature is not demonstrated, mark it as not demonstrated rather than
    automatically calling it false.
15. If a media item cannot be meaningfully analyzed, explain that limitation.
16. The final result must be valid JSON matching the requested schema.

Template metadata:

${buildMetadataText(template)}

Analyze the supplied media and determine:

- whether the visual identity matches the template description;
- whether screenshots appear to show the claimed product;
- whether the demo video appears to demonstrate the same product;
- whether important claimed features are actually demonstrated;
- whether there are suspicious inconsistencies;
- whether the listing appears misleading;
- what evidence supports your conclusions.

For evidence, identify the source accurately:

- metadata
- thumbnail
- screenshot
- demo_video
- package

Do not say "package" unless package evidence was actually supplied.

Return only structured JSON.
`;

    const response =
      await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
              ...mediaParts,
            ],
          },
        ],
        config: {
          responseMimeType:
            "application/json",
          responseSchema:
            verificationSchema,
          temperature: 0.1,
        },
      });

    const rawText =
      typeof response.text === "string"
        ? response.text
        : "";

    if (!rawText.trim()) {
      throw new Error(
        "Gemini returned an empty verification response."
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(
        cleanJsonText(rawText)
      );
    } catch {
      throw new Error(
        "Gemini returned invalid verification JSON."
      );
    }

    if (
      typeof parsed !== "object" ||
      parsed === null
    ) {
      throw new Error(
        "Gemini verification response has an invalid structure."
      );
    }

    return {
      result:
        parsed as TemplateVerificationAIResult,
      model: MODEL,
    };
  } finally {
    /*
     * Gemini stores uploaded files temporarily.
     * We delete them immediately after verification instead of waiting
     * for the automatic 48-hour expiration.
     */
    await Promise.all(
      uploadedFiles.map((file) =>
        deleteGeminiFile(
          ai,
          file.name
        )
      )
    );
  }
}