
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { checkFeatureAccess } from "@/lib/feature-access";
import { recordProviderUsage } from "@/lib/provider-usage";

export const maxDuration = 300;

const GEMINI_MODEL = "gemini-3.6-flash";

/**
 * TEMPORARY MEASUREMENT MODE
 *
 * Set this environment variable to:
 *
 * ZUQEN_WEBSITE_BUILDER_MEASUREMENT_MODE=true
 *
 * while we measure actual Gemini usage.
 *
 * When false/missing:
 * normal Website Builder credit/access rules apply.
 */
const MEASUREMENT_MODE =
  process.env.ZUQEN_WEBSITE_BUILDER_MEASUREMENT_MODE ===
  "true";

type WebsiteOperation = "generate" | "edit";

type GeminiUsage = {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  thoughtsTokens: number;
  cachedTokens: number;
};

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  return new GoogleGenAI({
    apiKey,
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function getErrorStatus(error: unknown) {
  const message =
    getErrorMessage(error).toLowerCase();

  if (
    message.includes("api key") ||
    message.includes("authentication") ||
    message.includes("unauthorized") ||
    message.includes("permission")
  ) {
    return 401;
  }

  if (
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("resource exhausted")
  ) {
    return 429;
  }

  if (
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return 504;
  }

  return 500;
}

/**
 * Read actual Gemini usage metadata.
 */
function readGeminiUsage(
  response: any
): GeminiUsage {
  const usage = response?.usageMetadata;

  const promptTokens = Math.max(
    0,
    Math.floor(
      Number(
        usage?.promptTokenCount ?? 0
      )
    )
  );

  const outputTokens = Math.max(
    0,
    Math.floor(
      Number(
        usage?.candidatesTokenCount ?? 0
      )
    )
  );

  const thoughtsTokens = Math.max(
    0,
    Math.floor(
      Number(
        usage?.thoughtsTokenCount ?? 0
      )
    )
  );

  const cachedTokens = Math.max(
    0,
    Math.floor(
      Number(
        usage?.cachedContentTokenCount ?? 0
      )
    )
  );

  const totalTokens = Math.max(
    0,
    Math.floor(
      Number(
        usage?.totalTokenCount ??
          promptTokens +
            outputTokens +
            thoughtsTokens
      )
    )
  );

  return {
    promptTokens,
    outputTokens,
    totalTokens,
    thoughtsTokens,
    cachedTokens,
  };
}

function cleanHtml(html: string) {
  return html
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function isValidHtml(html: string) {
  if (!html || html.length < 20) {
    return false;
  }

  const lower = html.toLowerCase();

  return (
    lower.includes("<html") &&
    lower.includes("</html>") &&
    lower.includes("<body") &&
    lower.includes("</body>")
  );
}

const GENERATE_SYSTEM_INSTRUCTION = `
You are ZUQEN AI Website Builder.

Generate a complete, modern and production-quality HTML website.

Rules:

1. Return ONLY HTML.
2. Do not use markdown code fences.
3. Include <!DOCTYPE html>.
4. Include <html>, <head> and <body>.
5. Use a <style> block or inline CSS.
6. Make the website responsive.
7. Make the design modern and professional.
8. Use JavaScript only when necessary.
9. Do not write explanations outside the HTML.
10. Do not leave TODO or incomplete placeholders.
11. Generate the complete website requested by the user.
`;

const EDIT_SYSTEM_INSTRUCTION = `
You are ZUQEN AI Website Editor.

You will receive an existing HTML website and an edit instruction.

Modify the existing website according to the instruction.

Rules:

1. Return ONLY the complete updated HTML.
2. Do not use markdown code fences.
3. Preserve existing functionality unless requested otherwise.
4. Preserve existing design where possible.
5. Make only the requested changes.
6. Keep the result responsive.
7. Ensure the result is valid HTML.
8. Include <!DOCTYPE html>.
9. Include <html>, <head> and <body>.
`;

async function generateWebsite(
  prompt: string
) {
  const ai = getGemini();

  const response =
    await ai.models.generateContent({
      model: GEMINI_MODEL,

      contents: `
WEBSITE REQUEST:

${prompt}
`,

      config: {
        systemInstruction:
          GENERATE_SYSTEM_INSTRUCTION,

        maxOutputTokens: 16000,
      },
    });

  const html = cleanHtml(
    response.text ?? ""
  );

  const usage =
    readGeminiUsage(response);

  return {
    html,
    usage,
  };
}

async function editWebsite(
  html: string,
  instruction: string
) {
  const ai = getGemini();

  const response =
    await ai.models.generateContent({
      model: GEMINI_MODEL,

      contents: `
EXISTING WEBSITE:

${html}

EDIT INSTRUCTION:

${instruction}
`,

      config: {
        systemInstruction:
          EDIT_SYSTEM_INSTRUCTION,

        maxOutputTokens: 16000,
      },
    });

  const updatedHtml =
    cleanHtml(
      response.text ?? ""
    );

  const usage =
    readGeminiUsage(response);

  return {
    html: updatedHtml,
    usage,
  };
}

/**
 * Save ONLY actual provider usage.
 *
 * IMPORTANT:
 * We intentionally DO NOT write raw Gemini tokens
 * into feature_credit_transactions.
 *
 * Gemini tokens are provider units.
 * ZUQEN credits are a separate unit.
 *
 * We will determine the token -> credit conversion
 * only after collecting real measurement data.
 */
async function saveWebsiteUsage({
  userId,
  operation,
  usage,
  status,
  outputValid,
}: {
  userId: string;
  operation: WebsiteOperation;
  usage: GeminiUsage;
  status: "success" | "failed";
  outputValid: boolean;
}) {
  try {
    const providerResult =
      await recordProviderUsage({
        userId,

        featureKey:
          "website_builder",

        provider: "gemini",

        model:
          GEMINI_MODEL,

        requestId: null,

        status,

        inputUnits:
          usage.promptTokens,

        outputUnits:
          usage.outputTokens,

        totalUnits:
          usage.totalTokens,

        unitType:
          "tokens",

        metadata: {
          operation,
          outputValid,

          promptTokens:
            usage.promptTokens,

          outputTokens:
            usage.outputTokens,

          totalTokens:
            usage.totalTokens,

          thoughtsTokens:
            usage.thoughtsTokens,

          cachedTokens:
            usage.cachedTokens,

          usageAvailable:
            usage.totalTokens > 0,

          measurementMode:
            MEASUREMENT_MODE,
        },
      });

    if (!providerResult.success) {
      console.error(
        "PROVIDER USAGE SAVE FAILED:",
        providerResult
      );

      return {
        success: false,
        providerUsageId: null,
        error:
          providerResult.error ??
          "Failed to save provider usage.",
      };
    }

    console.log(
      "WEBSITE BUILDER PROVIDER USAGE SAVED:",
      {
        providerUsageId:
          providerResult.id,

        operation,

        inputTokens:
          usage.promptTokens,

        outputTokens:
          usage.outputTokens,

        thoughtsTokens:
          usage.thoughtsTokens,

        cachedTokens:
          usage.cachedTokens,

        totalTokens:
          usage.totalTokens,
      }
    );

    return {
      success: true,
      providerUsageId:
        providerResult.id,

      error: null,
    };
  } catch (error) {
    console.error(
      "PROVIDER USAGE SAVE ERROR:",
      error
    );

    return {
      success: false,
      providerUsageId: null,
      error:
        getErrorMessage(error),
    };
  }
}

async function getUser() {
  const supabase =
    await createServerSupabaseClient();

  const {
    data: { user },
    error,
  } =
    await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const action =
      body?.action;

    /**
     * ---------------------------------------------
     * Validate action
     * ---------------------------------------------
     */
    if (
      action !== "generate" &&
      action !== "edit"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Invalid action. Use generate or edit.",
        },
        {
          status: 400,
        }
      );
    }

    /**
     * ---------------------------------------------
     * Authentication
     * ---------------------------------------------
     */
    const user =
      await getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Authentication required.",

          code:
            "UNAUTHENTICATED",
        },
        {
          status: 401,
        }
      );
    }

    /**
     * ---------------------------------------------
     * Website Builder is permanent-user only
     * ---------------------------------------------
     *
     * Even measurement mode does NOT allow guests.
     */
    if (user.is_anonymous) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Please sign in to use Website Builder.",

          code:
            "SIGN_IN_REQUIRED",
        },
        {
          status: 403,
        }
      );
    }

    /**
     * ---------------------------------------------
     * Website Builder feature access
     * ---------------------------------------------
     */
    const access =
      await checkFeatureAccess(
        "website_builder"
      );

    if (!access.allowed) {
      return NextResponse.json(
        {
          success: false,

          error:
            access.message,

          code:
            "FEATURE_ACCESS_DENIED",

          feature:
            "website_builder",
        },
        {
          status: 403,
        }
      );
    }

    /**
     * ---------------------------------------------
     * TEMPORARY MEASUREMENT BYPASS
     * ---------------------------------------------
     *
     * When MEASUREMENT_MODE=true:
     *
     * - Do NOT check Website Builder credit balance.
     * - Do NOT consume ZUQEN credits.
     * - Do NOT settle any credits.
     * - Only measure actual Gemini usage.
     *
     * When false:
     * the current route still does not perform
     * final dynamic credit billing yet.
     *
     * This mode exists only so we can collect data.
     */
    if (MEASUREMENT_MODE) {
      console.log(
        "WEBSITE BUILDER MEASUREMENT MODE ENABLED:",
        {
          userId: user.id,
          action,
        }
      );
    }

    /**
     * =============================================
     * GENERATE WEBSITE
     * =============================================
     */
    if (action === "generate") {
      const prompt =
        typeof body.prompt === "string"
          ? body.prompt.trim()
          : "";

      if (!prompt) {
        return NextResponse.json(
          {
            success: false,

            error:
              "Website prompt is required.",
          },
          {
            status: 400,
          }
        );
      }

      if (prompt.length > 10000) {
        return NextResponse.json(
          {
            success: false,

            error:
              "Website prompt is too long. Maximum 10,000 characters.",
          },
          {
            status: 400,
          }
        );
      }

      let result;

      try {
        result =
          await generateWebsite(
            prompt
          );
      } catch (error) {
        await saveWebsiteUsage({
          userId: user.id,

          operation:
            "generate",

          usage: {
            promptTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            thoughtsTokens: 0,
            cachedTokens: 0,
          },

          status:
            "failed",

          outputValid:
            false,
        });

        throw error;
      }

      const valid =
        isValidHtml(
          result.html
        );

      /**
       * Save actual Gemini usage.
       */
      const usageSave =
        await saveWebsiteUsage({
          userId: user.id,

          operation:
            "generate",

          usage:
            result.usage,

          status:
            "success",

          outputValid:
            valid,
        });

      if (!valid) {
        return NextResponse.json(
          {
            success: false,

            error:
              "Gemini returned invalid website HTML.",

            provider:
              "gemini",

            feature:
              "website-builder",

            usage:
              result.usage,

            providerUsageSaved:
              usageSave.success,
          },
          {
            status: 502,

            headers: {
              "X-Zuquen-Gemini-Model":
                GEMINI_MODEL,

              "X-Zuquen-Gemini-Input-Tokens":
                String(
                  result.usage
                    .promptTokens
                ),

              "X-Zuquen-Gemini-Output-Tokens":
                String(
                  result.usage
                    .outputTokens
                ),

              "X-Zuquen-Gemini-Total-Tokens":
                String(
                  result.usage
                    .totalTokens
                ),

              "X-Zuquen-Measurement-Mode":
                String(
                  MEASUREMENT_MODE
                ),
            },
          }
        );
      }

      return NextResponse.json(
        {
          success: true,

          html:
            result.html,

          provider:
            "gemini",

          feature:
            "website-builder",

          usage:
            result.usage,

          providerUsageSaved:
            usageSave.success,

          measurementMode:
            MEASUREMENT_MODE,

          /**
           * No ZUQEN credits are consumed
           * during measurement mode.
           */
          creditsConsumed:
            0,
        },
        {
          status: 200,

          headers: {
            "X-Zuquen-Gemini-Model":
              GEMINI_MODEL,

            "X-Zuquen-Gemini-Input-Tokens":
              String(
                result.usage
                  .promptTokens
              ),

            "X-Zuquen-Gemini-Output-Tokens":
              String(
                result.usage
                  .outputTokens
              ),

            "X-Zuquen-Gemini-Total-Tokens":
              String(
                result.usage
                  .totalTokens
              ),

            "X-Zuquen-Measurement-Mode":
              String(
                MEASUREMENT_MODE
              ),
          },
        }
      );
    }

    /**
     * =============================================
     * EDIT WEBSITE
     * =============================================
     */

    const html =
      typeof body.html === "string"
        ? body.html.trim()
        : "";

    const instruction =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : typeof body.instruction === "string"
          ? body.instruction.trim()
          : "";

    if (!html) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Existing HTML is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!instruction) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Edit instruction is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (instruction.length > 5000) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Edit instruction is too long. Maximum 5,000 characters.",
        },
        {
          status: 400,
        }
      );
    }

    if (html.length > 500000) {
      return NextResponse.json(
        {
          success: false,

          error:
            "HTML is too large. Maximum 500,000 characters.",
        },
        {
          status: 400,
        }
      );
    }

    let result;

    try {
      result =
        await editWebsite(
          html,
          instruction
        );
    } catch (error) {
      await saveWebsiteUsage({
        userId: user.id,

        operation:
          "edit",

        usage: {
          promptTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          thoughtsTokens: 0,
          cachedTokens: 0,
        },

        status:
          "failed",

        outputValid:
          false,
      });

      throw error;
    }

    const valid =
      isValidHtml(
        result.html
      );

    /**
     * Save actual Gemini usage.
     */
    const usageSave =
      await saveWebsiteUsage({
        userId: user.id,

        operation:
          "edit",

        usage:
          result.usage,

        status:
          "success",

        outputValid:
          valid,
      });

    if (!valid) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Gemini returned invalid edited HTML.",

          provider:
            "gemini",

          feature:
            "website-builder",

          usage:
            result.usage,

          providerUsageSaved:
            usageSave.success,
        },
        {
          status: 502,

          headers: {
            "X-Zuquen-Gemini-Model":
              GEMINI_MODEL,

            "X-Zuquen-Gemini-Input-Tokens":
              String(
                result.usage
                  .promptTokens
              ),

            "X-Zuquen-Gemini-Output-Tokens":
              String(
                result.usage
                  .outputTokens
              ),

            "X-Zuquen-Gemini-Total-Tokens":
              String(
                result.usage
                  .totalTokens
              ),

            "X-Zuquen-Measurement-Mode":
              String(
                MEASUREMENT_MODE
              ),
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,

        html:
          result.html,

        provider:
          "gemini",

        feature:
          "website-builder",

        usage:
          result.usage,

        providerUsageSaved:
          usageSave.success,

        measurementMode:
          MEASUREMENT_MODE,

        creditsConsumed:
          0,
      },
      {
        status: 200,

        headers: {
          "X-Zuquen-Gemini-Model":
            GEMINI_MODEL,

          "X-Zuquen-Gemini-Input-Tokens":
            String(
              result.usage
                .promptTokens
            ),

          "X-Zuquen-Gemini-Output-Tokens":
            String(
              result.usage
                .outputTokens
            ),

          "X-Zuquen-Gemini-Total-Tokens":
            String(
              result.usage
                .totalTokens
            ),

          "X-Zuquen-Measurement-Mode":
            String(
              MEASUREMENT_MODE
            ),
        },
      }
    );
  } catch (error) {
    console.error(
      "WEBSITE BUILDER API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          getErrorMessage(error),

        provider:
          "gemini",

        feature:
          "website-builder",
      },
      {
        status:
          getErrorStatus(error),
      }
    );
  }
}

