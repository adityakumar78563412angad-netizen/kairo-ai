import "server-only";

import { GoogleGenAI } from "@google/genai";

import type {
  TemplateVerificationAIResult,
  TemplateVerificationAIResult as VerificationAIResult,
  TemplateVerificationAIResult as AIResult,
  TemplateVerificationAIResult as Result,
  VerificationMediaInput,
  VerificationTemplateMetadata,
} from "./type";

const MODEL =
  process.env.GEMINI_TEMPLATE_VERIFICATION_MODEL ||
  "gemini-3.8-flash";

function getGeminiClient() {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
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
      enum: [
        "verified",
        "review_required",
        "rejected",
      ],
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
            enum: [
              "pass",
              "warning",
              "fail",
              "not_checked",
            ],
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
            enum: [
              "low",
              "medium",
              "high",
              "critical",
            ],
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
) {
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

function cleanJsonText(
  text: string
): string {
  const trimmed = text.trim();

  if (
    trimmed.startsWith("```json") &&
    trimmed.endsWith("```")
  ) {
    return trimmed
      .slice(7, -3)
      .trim();
  }

  if (
    trimmed.startsWith("```") &&
    trimmed.endsWith("```")
  ) {
    return trimmed
      .slice(3, -3)
      .trim();
  }

  return trimmed;
}

export async function verifyTemplateWithGemini(
  template: VerificationTemplateMetadata,
  media: VerificationMediaInput[]
): Promise<{
  result: VerificationAIResult;
  model: string;
}> {
  const ai = getGeminiClient();

  const mediaParts = media.map(
    (item) => ({
      fileData: {
        fileUri: item.fileUri,
        mimeType: item.mimeType,
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
12. The final result must be valid JSON matching the requested schema.

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

Return only structured JSON.
`;

  const response = await ai.models.generateContent({
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
      responseMimeType: "application/json",
      responseSchema: verificationSchema,
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
      parsed as VerificationAIResult,
    model: MODEL,
  };
}