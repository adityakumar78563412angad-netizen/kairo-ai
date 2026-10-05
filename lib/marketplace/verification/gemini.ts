import "server-only";

import { GoogleGenAI } from "@google/genai";

import type {
  TemplateVerificationAIResult,
} from "./types";

const DEFAULT_MODEL =
  process.env.GEMINI_TEMPLATE_VERIFICATION_MODEL ||
  "gemini-3.8-flash";

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
  }

  return new GoogleGenAI({
    apiKey,
  });
}

const VERIFICATION_SCHEMA = {
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
};

export type GeminiVerificationInput = {
  metadata: {
    name: string;
    category: string;
    short_description: string;
    description: string;
    features: string[];
    requirements: string[];
    tech_stack: string[];
    license: string;
    price: number;
    currency: string;
  };

  media: Array<{
    role:
      | "thumbnail"
      | "screenshot"
      | "demo_video";

    mimeType: string;

    uri: string;
  }>;
};

export async function verifyTemplateWithGemini(
  input: GeminiVerificationInput
): Promise<{
  result: TemplateVerificationAIResult;
  model: string;
}> {
  const ai = getGeminiClient();

  const mediaInputs = input.media.map((media) => ({
    type:
      media.role === "demo_video"
        ? "video"
        : "image",

    uri: media.uri,

    mime_type: media.mimeType,
  }));

  const prompt = `
You are the ZUQEN AI Template Verification Engine.

Your job is to independently verify a marketplace template before
it can be published.

IMPORTANT RULES:

1. Do NOT assume the seller is truthful.
2. Do NOT automatically reject a template merely because something
   cannot be visually confirmed.
3. Only claim that a feature is present when there is reasonable
   evidence.
4. Distinguish "not demonstrated" from "false".
5. Look for contradictions between:
   - template description
   - claimed features
   - screenshots
   - thumbnail
   - demo video
6. Look for evidence that the uploaded media belongs to a different
   product/template.
7. Look for misleading marketing claims.
8. Look for suspicious visual inconsistencies.
9. Do not make legal conclusions.
10. Do not claim malware detection from visual/media analysis.
11. The application performs technical/security validation separately.
12. Use "review_required" when evidence is ambiguous.
13. Use "rejected" only when there is strong evidence of a serious
    contradiction, deception, or unacceptable submission.
14. Use "verified" only when the supplied evidence is reasonably
    consistent.
15. Never modify the template.
16. Return ONLY valid JSON matching the requested schema.

TEMPLATE METADATA:

Name:
${input.metadata.name}

Category:
${input.metadata.category}

Short description:
${input.metadata.short_description}

Description:
${input.metadata.description}

Features:
${input.metadata.features.join("\n")}

Requirements:
${input.metadata.requirements.join("\n")}

Tech stack:
${input.metadata.tech_stack.join("\n")}

License:
${input.metadata.license}

Price:
${input.metadata.price} ${input.metadata.currency}

ANALYSIS REQUIREMENTS:

Check:

- visual identity consistency
- screenshot/template consistency
- demo/template consistency
- claimed feature evidence
- description accuracy based on available evidence
- category consistency
- obvious misleading content
- suspicious media mismatch
- repeated stock/demo-looking content
- suspicious edits or cuts in the demo
- whether the supplied evidence is sufficient

For demo video evidence, mention timestamps whenever possible.

Produce a score from 0 to 100.

Do not invent evidence that is not present.
`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,

    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },

          ...mediaInputs.map((media) => ({
            fileData: {
              fileUri: media.uri,
              mimeType: media.mime_type,
            },
          })),
        ],
      },
    ],

    config: {
      responseMimeType: "application/json",

      responseSchema: VERIFICATION_SCHEMA,

      temperature: 0.1,
    },
  });

  const rawText = response.text?.trim();

  if (!rawText) {
    throw new Error(
      "Gemini returned an empty verification response."
    );
  }

  let parsed: TemplateVerificationAIResult;

  try {
    parsed =
      JSON.parse(rawText) as TemplateVerificationAIResult;
  } catch {
    throw new Error(
      "Gemini returned invalid verification JSON."
    );
  }

  return {
    result: parsed,
    model: DEFAULT_MODEL,
  };
}