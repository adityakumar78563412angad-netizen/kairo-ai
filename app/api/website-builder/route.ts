import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { recordProviderUsage } from "@/lib/provider-usage";

const MODEL = "gemini-3.6-flash";

const FEATURE_KEY = "website_builder";

const TOKENS_PER_CREDIT = 20_000;

const MAX_GENERATE_PROMPT_LENGTH = 10_000;
const MAX_EDIT_HTML_LENGTH = 500_000;
const MAX_EDIT_INSTRUCTION_LENGTH = 5_000;

const MAX_OUTPUT_TOKENS = 32_000;

type GeminiUsage = {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  thoughtsTokens: number;
  cachedTokens: number;
};

type ReservationResult = {
  success?: boolean;
  code?: string;
  reservationId?: string;
  provider?: string;
  feature?: string;
  reserved?: number;
  previousBalance?: number;
  newBalance?: number;
  message?: string;
};

type SettlementResult = {
  success?: boolean;
  code?: string;
  reservationId?: string;
  reserved?: number;
  used?: number;
  refunded?: number;
  newBalance?: number;
  status?: string;
  message?: string;
};

type RefundResult = {
  success?: boolean;
  code?: string;
  reservationId?: string;
  refunded?: number;
  newBalance?: number;
  status?: string;
  message?: string;
};

const WEBSITE_BUILDER_SYSTEM_INSTRUCTION = `
You are ZUQEN AI Website Builder.

Your task is to generate or edit a complete production-quality website.

STRICT OUTPUT RULES:

1. Return ONLY complete standalone HTML.
2. Do NOT use Markdown.
3. Do NOT wrap the HTML in triple backticks.
4. The response MUST contain:
   <!DOCTYPE html>
   <html>
   <head>
   <body>
5. The response MUST end with:
   </html>
6. Never return explanations before or after the HTML.
7. Never return partial HTML.
8. Never intentionally truncate the website.
9. Include all CSS and JavaScript necessary for the generated website directly inside the HTML whenever practical.
10. The website should be responsive and work on desktop, tablet, and mobile.
11. Create polished, modern UI with good typography, spacing, hierarchy, interactions, hover states, responsive layouts, and accessible controls.
12. Do not reference unavailable local files.
13. Use external assets only when they are appropriate and publicly accessible.
14. Make the final HTML self-contained enough to preview directly inside an iframe.

When editing an existing website:
- Preserve useful existing functionality unless the user explicitly asks to remove it.
- Apply the requested change carefully.
- Return the ENTIRE updated HTML document.
- Never return only a fragment or changed section.
`;

function cleanHtml(value: string) {
  let html = value.trim();

  html = html.replace(/^```html\s*/i, "");
  html = html.replace(/^```HTML\s*/i, "");
  html = html.replace(/^```\s*/i, "");
  html = html.replace(/\s*```$/i, "");

  const doctypeIndex = html
    .toLowerCase()
    .indexOf("<!doctype html>");

  const htmlIndex = html
    .toLowerCase()
    .indexOf("<html");

  if (doctypeIndex >= 0) {
    html = html.slice(doctypeIndex);
  } else if (htmlIndex >= 0) {
    html = html.slice(htmlIndex);
  }

  const closingIndex = html
    .toLowerCase()
    .lastIndexOf("</html>");

  if (closingIndex >= 0) {
    html = html.slice(
      0,
      closingIndex + "</html>".length
    );
  }

  return html.trim();
}

function isValidHtml(value: string) {
  const html = cleanHtml(value).toLowerCase();

  return (
    html.length > 20 &&
    html.includes("<html") &&
    html.includes("</html>") &&
    html.includes("<head") &&
    html.includes("<body")
  );
}

function isTruncatedHtml(value: string) {
  const html = cleanHtml(value).toLowerCase();

  if (!html) {
    return true;
  }

  if (!html.includes("<html")) {
    return true;
  }

  if (!html.includes("</html>")) {
    return true;
  }

  if (
    html.includes("<body") &&
    !html.includes("</body>")
  ) {
    return true;
  }

  if (
    html.includes("<head") &&
    !html.includes("</head>")
  ) {
    return true;
  }

  return false;
}

function readGeminiUsage(response: any): GeminiUsage {
  const metadata =
    response?.usageMetadata || {};

  const promptTokens =
    Number(
      metadata.promptTokenCount
    ) || 0;

  const outputTokens =
    Number(
      metadata.candidatesTokenCount
    ) || 0;

  const thoughtsTokens =
    Number(
      metadata.thoughtsTokenCount
    ) || 0;

  const cachedTokens =
    Number(
      metadata.cachedContentTokenCount
    ) || 0;

  const explicitTotal =
    Number(
      metadata.totalTokenCount
    ) || 0;

  const totalTokens =
    explicitTotal > 0
      ? explicitTotal
      : promptTokens +
        outputTokens +
        thoughtsTokens;

  return {
    promptTokens,
    outputTokens,
    totalTokens,
    thoughtsTokens,
    cachedTokens,
  };
}

function getResponseText(response: any) {
  if (
    typeof response?.text === "string"
  ) {
    return response.text;
  }

  if (
    typeof response?.text === "function"
  ) {
    try {
      return response.text();
    } catch {
      return "";
    }
  }

  const candidates =
    response?.candidates || [];

  const parts =
    candidates?.[0]?.content?.parts || [];

  return parts
    .map((part: any) =>
      typeof part?.text === "string"
        ? part.text
        : ""
    )
    .join("");
}

/**
 * Estimate the maximum possible credit reservation
 * before calling Gemini.
 *
 * This is intentionally a temporary hold.
 * Final billing always uses Gemini's actual
 * usageMetadata.totalTokenCount.
 */
function estimateReservationCredits(
  inputTextLength: number
) {
  /*
   * Gemini tokenization is not based on a fixed
   * characters/token ratio. We therefore use a
   * conservative reservation estimate only to make
   * sure the final actual usage can be settled.
   *
   * The reservation is returned/refunded according
   * to the settlement result.
   */

  const estimatedInputTokens =
    Math.ceil(
      inputTextLength / 3.5
    );

  const estimatedTotalTokens =
    Math.ceil(
      (estimatedInputTokens +
        MAX_OUTPUT_TOKENS) *
        1.15
    );

  const credits =
    estimatedTotalTokens /
    TOKENS_PER_CREDIT;

  return Math.max(
    0.01,
    Number(credits.toFixed(4))
  );
}

function getProviderRequestId() {
  return crypto.randomUUID();
}

async function reserveCredits({
  supabase,
  userId,
  amount,
  providerRequestId,
  referenceId,
  operation,
}: {
  supabase: any;
  userId: string;
  amount: number;
  providerRequestId: string;
  referenceId: string;
  operation: string;
}) {
  const { data, error } =
    await supabase.rpc(
      "reserve_feature_credits",
      {
        p_user_id: userId,
        p_feature_key: FEATURE_KEY,
        p_amount: amount,
        p_provider_request_id:
          providerRequestId,
        p_reference_id: referenceId,
        p_metadata: {
          operation,
          billing_basis:
            "gemini_total_tokens",
          tokens_per_credit:
            TOKENS_PER_CREDIT,
          reservation_amount:
            amount,
        },
      }
    );

  if (error) {
    console.error(
      "Credit reservation RPC error:",
      error
    );

    return {
      success: false,
      error: error.message,
      result: null as ReservationResult | null,
    };
  }

  const result =
    (data || {}) as ReservationResult;

  if (!result.success) {
    return {
      success: false,
      error:
        result.message ||
        result.code ||
        "Unable to reserve Website Builder credits.",
      result,
    };
  }

  return {
    success: true,
    error: null,
    result,
  };
}

async function settleCredits({
  supabase,
  reservationId,
  actualCredits,
  providerRequestId,
  referenceId,
  operation,
  usage,
}: {
  supabase: any;
  reservationId: string;
  actualCredits: number;
  providerRequestId: string;
  referenceId: string;
  operation: string;
  usage: GeminiUsage;
}) {
  const { data, error } =
    await supabase.rpc(
      "settle_feature_credit_reservation",
      {
        p_reservation_id:
          reservationId,
        p_actual_amount:
          actualCredits,
        p_provider_request_id:
          providerRequestId,
        p_description:
          `Website Builder ${operation} - Gemini actual token usage`,
        p_reference_id:
          referenceId,
        p_metadata: {
          operation,
          billing_basis:
            "gemini_total_tokens",
          tokens_per_credit:
            TOKENS_PER_CREDIT,
          prompt_tokens:
            usage.promptTokens,
          output_tokens:
            usage.outputTokens,
          thoughts_tokens:
            usage.thoughtsTokens,
          cached_tokens:
            usage.cachedTokens,
          total_tokens:
            usage.totalTokens,
          actual_credits:
            actualCredits,
        },
      }
    );

  if (error) {
    console.error(
      "Credit settlement RPC error:",
      error
    );

    return {
      success: false,
      error: error.message,
      result: null as SettlementResult | null,
    };
  }

  const result =
    (data || {}) as SettlementResult;

  if (!result.success) {
    return {
      success: false,
      error:
        result.message ||
        result.code ||
        "Unable to settle Website Builder credits.",
      result,
    };
  }

  return {
    success: true,
    error: null,
    result,
  };
}

async function refundCredits({
  supabase,
  reservationId,
  providerRequestId,
  referenceId,
  operation,
  reason,
}: {
  supabase: any;
  reservationId: string;
  providerRequestId: string;
  referenceId: string;
  operation: string;
  reason: string;
}) {
  const { data, error } =
    await supabase.rpc(
      "refund_feature_credit_reservation",
      {
        p_reservation_id:
          reservationId,
        p_provider_request_id:
          providerRequestId,
        p_description:
          `Website Builder ${operation} - reservation refunded`,
        p_reference_id:
          referenceId,
        p_metadata: {
          operation,
          reason,
          billing_basis:
            "gemini_total_tokens",
          tokens_per_credit:
            TOKENS_PER_CREDIT,
        },
      }
    );

  if (error) {
    console.error(
      "Credit refund RPC error:",
      error
    );

    return {
      success: false,
      error: error.message,
      result: null as RefundResult | null,
    };
  }

  const result =
    (data || {}) as RefundResult;

  if (!result.success) {
    return {
      success: false,
      error:
        result.message ||
        result.code ||
        "Unable to refund Website Builder credits.",
      result,
    };
  }

  return {
    success: true,
    error: null,
    result,
  };
}

async function saveProviderUsage({
  userId,
  operation,
  usage,
  outputValid,
}: {
  userId: string;
  operation: string;
  usage: GeminiUsage;
  outputValid: boolean;
}) {
  try {
    await recordProviderUsage({
      userId,
      provider: "gemini",
      feature: FEATURE_KEY,
      operation,
      model: MODEL,
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
      status: outputValid
        ? "success"
        : "failed",
      metadata: {
        billingBasis:
          "gemini_total_tokens",
        tokensPerCredit:
          TOKENS_PER_CREDIT,
        outputValid,
      },
    });
  } catch (error) {
    console.error(
      "Provider usage recording failed:",
      error
    );
  }
}

/**
 * GET current Website Builder credit balance.
 */
export async function GET() {
  try {
    const supabase =
      await createServerSupabaseClient();

    const {
      data: {
        user,
      },
      error: userError,
    } = await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "AUTH_REQUIRED",
          message:
            "Please sign in to use Website Builder.",
        },
        {
          status: 401,
        }
      );
    }

    if (user.is_anonymous) {
      return NextResponse.json(
        {
          success: false,
          code: "SIGN_IN_REQUIRED",
          message:
            "Website Builder requires a permanent account.",
          balance: 0,
          totalGranted: 0,
          totalUsed: 0,
        },
        {
          status: 403,
        }
      );
    }

    const { data, error } =
      await supabase
        .from(
          "feature_credit_balances"
        )
        .select(
          "balance,total_granted,total_used"
        )
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "feature_key",
          FEATURE_KEY
        )
        .maybeSingle();

    if (error) {
      console.error(
        "Failed to load Website Builder credits:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          code: "CREDIT_BALANCE_ERROR",
          message:
            "Unable to load Website Builder credits.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      feature: FEATURE_KEY,
      provider: "gemini",
      tokensPerCredit:
        TOKENS_PER_CREDIT,
      balance:
        Number(data?.balance) || 0,
      totalGranted:
        Number(
          data?.total_granted
        ) || 0,
      totalUsed:
        Number(
          data?.total_used
        ) || 0,
    });
  } catch (error) {
    console.error(
      "Website Builder GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        code: "SERVER_ERROR",
        message:
          "Unable to load Website Builder credits.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: Request
) {
  const providerRequestId =
    getProviderRequestId();

  const referenceId =
    `website-builder:${providerRequestId}`;

  let reservationId:
    | string
    | null = null;

  try {
    const body =
      await request.json();

    const action =
      body?.action;

    if (
      action !== "generate" &&
      action !== "edit"
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_ACTION",
          message:
            "Invalid Website Builder action.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createServerSupabaseClient();

    const {
      data: {
        user,
      },
      error: userError,
    } = await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "AUTH_REQUIRED",
          message:
            "Please sign in to use Website Builder.",
        },
        {
          status: 401,
        }
      );
    }

    if (user.is_anonymous) {
      return NextResponse.json(
        {
          success: false,
          code: "SIGN_IN_REQUIRED",
          message:
            "Website Builder requires a permanent account.",
        },
        {
          status: 403,
        }
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error(
        "GEMINI_API_KEY is missing."
      );

      return NextResponse.json(
        {
          success: false,
          code: "GEMINI_API_KEY_MISSING",
          message:
            "Gemini API is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const ai =
      new GoogleGenAI({
        apiKey,
      });

    let operation = action;
    let inputLength = 0;

    let prompt = "";

    if (action === "generate") {
      const userPrompt =
        typeof body?.prompt ===
        "string"
          ? body.prompt.trim()
          : "";

      if (!userPrompt) {
        return NextResponse.json(
          {
            success: false,
            code: "PROMPT_REQUIRED",
            message:
              "Please describe the website you want to build.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        userPrompt.length >
        MAX_GENERATE_PROMPT_LENGTH
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "PROMPT_TOO_LONG",
            message: `Website prompt must be ${MAX_GENERATE_PROMPT_LENGTH.toLocaleString()} characters or less.`,
          },
          {
            status: 400,
          }
        );
      }

      inputLength =
        userPrompt.length;

      prompt = `
${WEBSITE_BUILDER_SYSTEM_INSTRUCTION}

USER WEBSITE REQUEST:

${userPrompt}

Generate the complete website now.
Return ONLY the final standalone HTML document.
`;
    }

    if (action === "edit") {
      const htmlInput =
        typeof body?.html ===
        "string"
          ? body.html.trim()
          : "";

      const instruction =
        typeof body?.instruction ===
        "string"
          ? body.instruction.trim()
          : "";

      if (!htmlInput) {
        return NextResponse.json(
          {
            success: false,
            code: "HTML_REQUIRED",
            message:
              "Website HTML is required.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !isValidHtml(htmlInput)
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_HTML",
            message:
              "The supplied website HTML is invalid or incomplete.",
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
            code: "INSTRUCTION_REQUIRED",
            message:
              "Please describe what you want to change.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        htmlInput.length >
        MAX_EDIT_HTML_LENGTH
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "HTML_TOO_LONG",
            message: `Website HTML must be ${MAX_EDIT_HTML_LENGTH.toLocaleString()} characters or less.`,
          },
          {
            status: 400,
          }
        );
      }

      if (
        instruction.length >
        MAX_EDIT_INSTRUCTION_LENGTH
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "INSTRUCTION_TOO_LONG",
            message: `Edit instruction must be ${MAX_EDIT_INSTRUCTION_LENGTH.toLocaleString()} characters or less.`,
          },
          {
            status: 400,
          }
        );
      }

      inputLength =
        htmlInput.length +
        instruction.length;

      prompt = `
${WEBSITE_BUILDER_SYSTEM_INSTRUCTION}

EXISTING WEBSITE HTML:

${htmlInput}

USER EDIT REQUEST:

${instruction}

Apply the requested changes.

Return ONLY the complete updated standalone HTML document.
`;
    }

    /*
     * Reserve enough temporary credits before the
     * Gemini request.
     *
     * Final charge is NOT this amount.
     * Final charge is actual Gemini totalTokenCount.
     */
    const reservationAmount =
      estimateReservationCredits(
        inputLength
      );

    const reservation =
      await reserveCredits({
        supabase,
        userId: user.id,
        amount: reservationAmount,
        providerRequestId,
        referenceId,
        operation,
      });

    if (
      !reservation.success ||
      !reservation.result
    ) {
      const reservationResult =
        reservation.result;

      if (
        reservationResult?.code ===
        "INSUFFICIENT_CREDITS"
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "INSUFFICIENT_CREDITS",
            message:
              "Not enough Website Builder credits for this request.",
            balance:
              Number(
                reservationResult?.newBalance ??
                  reservationResult?.previousBalance
              ) || 0,
            requestedReservation:
              reservationAmount,
          },
          {
            status: 402,
          }
        );
      }

      return NextResponse.json(
        {
          success: false,
          code: "CREDIT_RESERVATION_FAILED",
          message:
            reservation.error ||
            "Unable to reserve Website Builder credits.",
        },
        {
          status: 500,
        }
      );
    }

    reservationId =
      reservation.result
        .reservationId || null;

    if (!reservationId) {
      return NextResponse.json(
        {
          success: false,
          code: "CREDIT_RESERVATION_FAILED",
          message:
            "Credit reservation did not return a reservation ID.",
        },
        {
          status: 500,
        }
      );
    }

    let geminiResponse: any;

    let usage: GeminiUsage = {
      promptTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      thoughtsTokens: 0,
      cachedTokens: 0,
    };

    try {
      geminiResponse =
        await ai.models.generateContent(
          {
            model: MODEL,
            contents: prompt,
            config: {
              maxOutputTokens:
                MAX_OUTPUT_TOKENS,
              temperature:
                action === "generate"
                  ? 0.7
                  : 0.4,
            },
          }
        );

      usage =
        readGeminiUsage(
          geminiResponse
        );
    } catch (geminiError) {
      console.error(
        "Gemini Website Builder error:",
        geminiError
      );

      const refund =
        await refundCredits({
          supabase,
          reservationId,
          providerRequestId,
          referenceId,
          operation,
          reason:
            "Gemini provider request failed.",
        });

      if (!refund.success) {
        console.error(
          "CRITICAL: Gemini failed and credit refund also failed:",
          refund.error
        );
      }

      return NextResponse.json(
        {
          success: false,
          code: "GEMINI_REQUEST_FAILED",
          message:
            "Gemini could not complete this website request. Your reserved credits were returned.",
        },
        {
          status: 502,
        }
      );
    }

    const rawHtml =
      getResponseText(
        geminiResponse
      );

    const finalHtml =
      cleanHtml(rawHtml);

    const outputValid =
      isValidHtml(finalHtml) &&
      !isTruncatedHtml(
        finalHtml
      );

    await saveProviderUsage({
      userId: user.id,
      operation,
      usage,
      outputValid,
    });

    if (!outputValid) {
      const refund =
        await refundCredits({
          supabase,
          reservationId,
          providerRequestId,
          referenceId,
          operation,
          reason:
            "Gemini returned invalid or truncated HTML.",
        });

      if (!refund.success) {
        console.error(
          "CRITICAL: Invalid Gemini output and credit refund also failed:",
          refund.error
        );
      }

      return NextResponse.json(
        {
          success: false,
          code: "INVALID_GEMINI_OUTPUT",
          message:
            "Gemini returned invalid or incomplete website HTML. Your reserved credits were returned.",
          usage,
        },
        {
          status: 502,
        }
      );
    }

    /*
     * REAL BILLING:
     *
     * Actual ZUQEN credits =
     * Gemini total tokens / 20,000
     *
     * Fractional credits are intentionally preserved.
     */
    const actualCredits =
      usage.totalTokens /
      TOKENS_PER_CREDIT;

    const roundedActualCredits =
      Number(
        actualCredits.toFixed(6)
      );

    const settlement =
      await settleCredits({
        supabase,
        reservationId,
        actualCredits:
          roundedActualCredits,
        providerRequestId,
        referenceId,
        operation,
        usage,
      });

    if (
      !settlement.success ||
      !settlement.result
    ) {
      console.error(
        "Credit settlement failed:",
        settlement.error
      );

      /*
       * Try to refund the active reservation.
       * This prevents a permanent deduction if
       * settlement itself fails.
       */
      const refund =
        await refundCredits({
          supabase,
          reservationId,
          providerRequestId,
          referenceId,
          operation,
          reason:
            "Credit settlement failed after successful Gemini request.",
        });

      if (!refund.success) {
        console.error(
          "CRITICAL: Settlement failed and refund also failed:",
          refund.error
        );
      }

      return NextResponse.json(
        {
          success: false,
          code: "CREDIT_SETTLEMENT_FAILED",
          message:
            "Website generation completed, but credit billing could not be finalized safely. No permanent credit deduction was intended.",
        },
        {
          status: 500,
        }
      );
    }

    const creditsConsumed =
      Number(
        settlement.result.used ??
          roundedActualCredits
      ) || 0;

    const creditsRemaining =
      Number(
        settlement.result.newBalance
      ) || 0;

    return NextResponse.json({
      success: true,
      html: finalHtml,
      operation,

      usage: {
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
      },

      billing: {
        provider: "gemini",
        model: MODEL,
        billingBasis:
          "gemini_total_tokens",
        tokensPerCredit:
          TOKENS_PER_CREDIT,
        reservation:
          reservationAmount,
        actualGeminiTokens:
          usage.totalTokens,
        creditsConsumed,
        creditsRemaining,
      },

      creditsConsumed,
      creditsRemaining,
    });
  } catch (error) {
    console.error(
      "Website Builder API error:",
      error
    );

    /*
     * If an unexpected error happens after a
     * reservation was created, try to refund it.
     */
    if (reservationId) {
      try {
        const supabase =
          await createServerSupabaseClient();

        const refund =
          await refundCredits({
            supabase,
            reservationId,
            providerRequestId,
            referenceId,
            operation:
              "unknown",
            reason:
              "Unexpected Website Builder server error.",
          });

        if (!refund.success) {
          console.error(
            "CRITICAL: Unexpected error and reservation refund failed:",
            refund.error
          );
        }
      } catch (refundError) {
        console.error(
          "CRITICAL: Unable to attempt credit refund:",
          refundError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        code: "SERVER_ERROR",
        message:
          "Something went wrong while processing the Website Builder request.",
      },
      {
        status: 500,
      }
    );
  }
}