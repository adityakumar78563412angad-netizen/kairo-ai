
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { recordProviderUsage } from "@/lib/provider-usage";

const GEMINI_MODEL = "gemini-3.6-flash";

const FEATURE_KEY = "website_builder";
const PROVIDER = "gemini";

// 1.00 ZUQEN Website Builder Credit = 20,000 actual Gemini total tokens
const TOKENS_PER_CREDIT = 20_000;

// Gemini request limit used by this route.
const MAX_OUTPUT_TOKENS = 32_000;

// Conservative estimate used only for RESERVATION.
// Final billing always uses Gemini's real totalTokenCount.
const CHARS_PER_TOKEN_ESTIMATE = 3.5;
const RESERVATION_SAFETY_MULTIPLIER = 1.1;

type WebsiteOperation = "generate" | "edit";

type GeminiUsage = {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  thoughtsTokens: number;
  cachedTokens: number;
};

type CreditResult = {
  success?: boolean;
  code?: string;
  message?: string;
  reservationId?: string;
  reserved?: number;
  used?: number;
  refunded?: number;
  newBalance?: number;
  creditBalance?: number;
  requested?: number;
  [key: string]: unknown;
};

const GENERATE_SYSTEM_INSTRUCTION = `
You are ZUQEN AI Website Builder.

Generate a complete, production-quality standalone HTML website based on the user's request.

STRICT OUTPUT RULES:
- Return ONLY the complete HTML document.
- Do NOT use Markdown.
- Do NOT use code fences.
- Do NOT add explanations before or after the HTML.
- The response MUST begin with <!DOCTYPE html> or <html>.
- Include complete <html>, <head>, and <body> elements.
- End with </html>.
- CSS must be inside the HTML document.
- JavaScript must be inside the HTML document when needed.
- Make the website visually polished, modern, responsive and functional.
- Do not leave placeholder sections unless the user explicitly requests them.
- Use semantic HTML.
- Make the design responsive for desktop, tablet and mobile.
`;

const EDIT_SYSTEM_INSTRUCTION = `
You are ZUQEN AI Website Builder.

You are editing an existing standalone HTML website according to the user's instruction.

STRICT OUTPUT RULES:
- Return ONLY the complete updated HTML document.
- Do NOT use Markdown.
- Do NOT use code fences.
- Do NOT add explanations before or after the HTML.
- The response MUST begin with <!DOCTYPE html> or <html>.
- Include complete <html>, <head>, and <body> elements.
- End with </html>.
- Preserve existing functionality unless the user explicitly asks to change it.
- Apply the requested changes accurately.
- Return the entire final HTML document, not a partial snippet.
`;

function cleanHtml(rawHtml: string): string {
  let html = rawHtml.trim();

  // Remove accidental Markdown fences.
  html = html.replace(/^```html\s*/i, "");
  html = html.replace(/^```\s*/i, "");
  html = html.replace(/\s*```$/i, "");

  html = html.trim();

  // If Gemini added text before the document, start from DOCTYPE/html.
  const doctypeIndex = html.search(/<!doctype\s+html>/i);
  const htmlIndex = html.search(/<html\b/i);

  if (doctypeIndex >= 0) {
    html = html.slice(doctypeIndex);
  } else if (htmlIndex >= 0) {
    html = html.slice(htmlIndex);
  }

  // Remove anything after the final </html>.
  const closingHtmlIndex = html.toLowerCase().lastIndexOf("</html>");

  if (closingHtmlIndex >= 0) {
    html = html.slice(0, closingHtmlIndex + "</html>".length);
  }

  return html.trim();
}

function isValidHtml(html: string): boolean {
  if (!html) return false;

  const hasDoctype = /<!doctype\s+html>/i.test(html);
  const hasHtmlOpen = /<html\b[^>]*>/i.test(html);
  const hasHtmlClose = /<\/html>/i.test(html);

  const hasHeadOpen = /<head\b[^>]*>/i.test(html);
  const hasHeadClose = /<\/head>/i.test(html);

  const hasBodyOpen = /<body\b[^>]*>/i.test(html);
  const hasBodyClose = /<\/body>/i.test(html);

  return (
    hasDoctype &&
    hasHtmlOpen &&
    hasHtmlClose &&
    hasHeadOpen &&
    hasHeadClose &&
    hasBodyOpen &&
    hasBodyClose
  );
}

function isTruncatedHtml(rawHtml: string, cleanedHtml: string): boolean {
  if (!rawHtml.trim()) return true;

  if (!/<\/html>\s*$/i.test(cleanedHtml)) {
    return true;
  }

  if (!/<\/body>\s*<\/html>\s*$/i.test(cleanedHtml)) {
    return true;
  }

  return false;
}

function readGeminiUsage(response: any): GeminiUsage {
  const metadata = response?.usageMetadata ?? {};

  const promptTokens = Number(metadata.promptTokenCount ?? 0);
  const outputTokens = Number(metadata.candidatesTokenCount ?? 0);
  const thoughtsTokens = Number(metadata.thoughtsTokenCount ?? 0);
  const cachedTokens = Number(metadata.cachedContentTokenCount ?? 0);

  const reportedTotalTokens = Number(metadata.totalTokenCount ?? 0);

  const totalTokens =
    reportedTotalTokens > 0
      ? reportedTotalTokens
      : promptTokens + outputTokens + thoughtsTokens;

  return {
    promptTokens,
    outputTokens,
    totalTokens,
    thoughtsTokens,
    cachedTokens,
  };
}

function getResponseText(response: any): string {
  if (typeof response?.text === "string") {
    return response.text;
  }

  if (typeof response?.text === "function") {
    const value = response.text();

    if (typeof value === "string") {
      return value;
    }
  }

  const parts =
    response?.candidates?.[0]?.content?.parts ??
    [];

  return parts
    .map((part: any) => {
      if (typeof part?.text === "string") {
        return part.text;
      }

      return "";
    })
    .join("");
}

function calculateCreditsFromTokens(totalTokens: number): number {
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) {
    return 0;
  }

  return totalTokens / TOKENS_PER_CREDIT;
}

function calculateReservationCredits(inputCharacterCount: number): number {
  const estimatedInputTokens =
    Math.ceil(inputCharacterCount / CHARS_PER_TOKEN_ESTIMATE);

  const estimatedMaximumTokens =
    estimatedInputTokens + MAX_OUTPUT_TOKENS;

  const conservativeMaximumTokens = Math.ceil(
    estimatedMaximumTokens * RESERVATION_SAFETY_MULTIPLIER
  );

  const reservationCredits =
    conservativeMaximumTokens / TOKENS_PER_CREDIT;

  // Reservation must be greater than zero.
  return Math.max(0.01, Math.ceil(reservationCredits * 100) / 100);
}

function toNumber(value: unknown): number {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}


async function saveProviderUsage(params: {
  userId: string;
  operation: WebsiteOperation;
  usage: GeminiUsage;
  outputValid: boolean;
}) {
  try {
    await recordProviderUsage({
      userId: params.userId,
      featureKey: FEATURE_KEY,
      provider: PROVIDER,
      model: GEMINI_MODEL,
      requestId: null,

      // provider-usage.ts currently accepts "success" here.
      status: "success",

      inputUnits: params.usage.promptTokens,
      outputUnits: params.usage.outputTokens,
      totalUnits: params.usage.totalTokens,
      unitType: "tokens",

      metadata: {
        operation: params.operation,
        outputValid: params.outputValid,
        promptTokens: params.usage.promptTokens,
        outputTokens: params.usage.outputTokens,
        totalTokens: params.usage.totalTokens,
        thoughtsTokens: params.usage.thoughtsTokens,
        cachedTokens: params.usage.cachedTokens,
        usageAvailable: params.usage.totalTokens > 0,
        billingBasis: "gemini_total_tokens",
        tokensPerCredit: TOKENS_PER_CREDIT,
      },
    });

    return true;
  } catch (error) {
    console.error("Failed to save provider usage:", error);
    return false;
  }
}



   

async function refundReservation(
  supabase: any,
  reservationId: string,
  providerRequestId: string,
  referenceId: string,
  metadata: Record<string, unknown>
): Promise<CreditResult | null> {
  try {
    const { data, error } = await supabase.rpc(
      "refund_feature_credit_reservation",
      {
        p_reservation_id: reservationId,
        p_provider_request_id: providerRequestId,
        p_description:
          "Website Builder Gemini request failed; reserved credits refunded",
        p_reference_id: referenceId,
        p_metadata: metadata,
      }
    );

    if (error) {
      console.error("Credit refund RPC error:", error);
      return null;
    }

    return (data ?? null) as CreditResult | null;
  } catch (error) {
    console.error("Credit refund exception:", error);
    return null;
  }
}

async function settleReservation(
  supabase: any,
  reservationId: string,
  actualCredits: number,
  providerRequestId: string,
  referenceId: string,
  metadata: Record<string, unknown>
): Promise<CreditResult | null> {
  try {
    const { data, error } = await supabase.rpc(
      "settle_feature_credit_reservation",
      {
        p_reservation_id: reservationId,
        p_actual_amount: actualCredits,
        p_provider_request_id: providerRequestId,
        p_description:
          "Website Builder Gemini actual token usage settlement",
        p_reference_id: referenceId,
        p_metadata: metadata,
      }
    );

    if (error) {
      console.error("Credit settlement RPC error:", error);
      return null;
    }

    return (data ?? null) as CreditResult | null;
  } catch (error) {
    console.error("Credit settlement exception:", error);
    return null;
  }
}

export async function POST(request: Request) {
  let supabase: any = null;
  let reservationId: string | null = null;
  let providerRequestId = "";
  let referenceId = "";

  try {
    const body = await request.json();

    const operation: WebsiteOperation =
      body?.action === "edit" ? "edit" : "generate";

    supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Please sign in to use Website Builder.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // Website Builder is permanently unavailable to anonymous users.
    if (user.is_anonymous === true) {
      return NextResponse.json(
        {
          success: false,
          error: "Please sign in to use Website Builder.",
          code: "SIGN_IN_REQUIRED",
        },
        { status: 403 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Gemini API is not configured.",
          code: "GEMINI_API_KEY_MISSING",
        },
        { status: 500 }
      );
    }

    let inputCharacterCount = 0;

    if (operation === "generate") {
      const prompt =
        typeof body?.prompt === "string"
          ? body.prompt.trim()
          : "";

      if (!prompt) {
        return NextResponse.json(
          {
            success: false,
            error: "Please enter a website prompt.",
            code: "PROMPT_REQUIRED",
          },
          { status: 400 }
        );
      }

      if (prompt.length > 10_000) {
        return NextResponse.json(
          {
            success: false,
            error: "Website prompt is too long.",
            code: "PROMPT_TOO_LONG",
          },
          { status: 400 }
        );
      }

      inputCharacterCount = prompt.length;
    } else {
      const htmlInput =
        typeof body?.htmlInput === "string"
          ? body.htmlInput
          : "";

      const instruction =
        typeof body?.instruction === "string"
          ? body.instruction.trim()
          : "";

      if (!htmlInput.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: "Existing website HTML is required.",
            code: "HTML_REQUIRED",
          },
          { status: 400 }
        );
      }

      if (!instruction) {
        return NextResponse.json(
          {
            success: false,
            error: "Please enter an edit instruction.",
            code: "INSTRUCTION_REQUIRED",
          },
          { status: 400 }
        );
      }

      if (htmlInput.length > 500_000) {
        return NextResponse.json(
          {
            success: false,
            error: "Website HTML is too large.",
            code: "HTML_TOO_LONG",
          },
          { status: 400 }
        );
      }

      if (instruction.length > 5_000) {
        return NextResponse.json(
          {
            success: false,
            error: "Edit instruction is too long.",
            code: "INSTRUCTION_TOO_LONG",
          },
          { status: 400 }
        );
      }

      inputCharacterCount = htmlInput.length + instruction.length;
    }

    /*
     * IMPORTANT:
     *
     * We do NOT charge the user this reservation amount.
     *
     * It is only temporarily held from their balance.
     * After Gemini responds:
     *
     * actualCredits = Gemini totalTokenCount / 20,000
     *
     * The settlement function keeps only the actual amount
     * and automatically returns the unused reservation.
     */

    const reservationCredits =
      calculateReservationCredits(inputCharacterCount);

    providerRequestId = crypto.randomUUID();
    referenceId = `website-builder:${providerRequestId}`;

    const reservationMetadata = {
      operation,
      reservationType: "pre_provider_max_estimate",
      reservationCredits,
      billingBasis: "gemini_total_tokens",
      tokensPerCredit: TOKENS_PER_CREDIT,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      inputCharacterCount,
      reservationEstimate: {
        charsPerToken: CHARS_PER_TOKEN_ESTIMATE,
        safetyMultiplier: RESERVATION_SAFETY_MULTIPLIER,
      },
    };

    const {
      data: reservationData,
      error: reservationError,
    } = await supabase.rpc("reserve_feature_credits", {
      p_user_id: user.id,
      p_feature_key: FEATURE_KEY,
      p_amount: reservationCredits,
      p_provider_request_id: providerRequestId,
      p_reference_id: referenceId,
      p_metadata: reservationMetadata,
    });

    if (reservationError) {
      console.error("Credit reservation RPC error:", reservationError);

      return NextResponse.json(
        {
          success: false,
          error: "Unable to reserve Website Builder credits.",
          code: "CREDIT_RESERVATION_ERROR",
        },
        { status: 500 }
      );
    }

    const reservation =
      (reservationData ?? null) as CreditResult | null;

    if (!reservation?.success) {
      const code = reservation?.code ?? "CREDIT_RESERVATION_FAILED";

      const status =
        code === "INSUFFICIENT_CREDITS"
          ? 402
          : code === "NO_CREDIT_BALANCE"
            ? 403
            : 400;

      return NextResponse.json(
        {
          success: false,
          error:
            reservation?.message ??
            "Unable to reserve Website Builder credits.",
          code,
          creditBalance: toNumber(
            reservation?.creditBalance ??
              reservation?.newBalance
          ),
          requested: reservation?.requested ?? reservationCredits,
        },
        { status }
      );
    }

    reservationId =
      typeof reservation.reservationId === "string"
        ? reservation.reservationId
        : null;

    if (!reservationId) {
      return NextResponse.json(
        {
          success: false,
          error: "Credit reservation failed.",
          code: "RESERVATION_ID_MISSING",
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    let response: any;

    if (operation === "generate") {
      const prompt = body.prompt.trim();

      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction: GENERATE_SYSTEM_INSTRUCTION,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0.7,
        },
      });
    } else {
      const htmlInput = body.htmlInput;
      const instruction = body.instruction.trim();

      const editPrompt = `
EXISTING WEBSITE HTML:

${htmlInput}

USER'S EDIT INSTRUCTION:

${instruction}

Return the complete updated HTML document.
`;

      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: editPrompt,
        config: {
          systemInstruction: EDIT_SYSTEM_INSTRUCTION,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0.4,
        },
      });
    }

    const usage = readGeminiUsage(response);

    const rawHtml = getResponseText(response);
    const cleanedHtml = cleanHtml(rawHtml);

    const truncated = isTruncatedHtml(
      rawHtml,
      cleanedHtml
    );

    const valid = isValidHtml(cleanedHtml);

    const actualCredits = calculateCreditsFromTokens(
      usage.totalTokens
    );

   const providerUsageSaved =
  await saveProviderUsage({
    userId: user.id,
    operation,
    usage,
    outputValid: valid && !truncated,
  });
    /*
     * Gemini returned an invalid/truncated website.
     *
     * Do NOT permanently charge the user.
     * Refund the entire reservation.
     */
    if (!valid || truncated) {
      const refundResult = await refundReservation(
        supabase,
        reservationId,
        providerRequestId,
        referenceId,
        {
          operation,
          reason: truncated
            ? "gemini_output_truncated"
            : "gemini_output_invalid",
          billingBasis: "gemini_total_tokens",
          tokensPerCredit: TOKENS_PER_CREDIT,
          usage,
          actualCredits,
          providerUsageSaved,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error: truncated
            ? "Gemini returned an incomplete website. No Website Builder credits were charged."
            : "Gemini returned invalid website HTML. No Website Builder credits were charged.",
          code: truncated
            ? "TRUNCATED_HTML"
            : "INVALID_HTML",
          provider: PROVIDER,
          feature: "website-builder",
          usage,
          creditsConsumed: 0,
          creditsRefunded: reservationCredits,
          creditsRemaining:
            refundResult?.newBalance ??
            null,
          providerUsageSaved,
          creditSettlement: refundResult,
        },
        { status: 502 }
      );
    }

    /*
     * SUCCESS:
     *
     * Actual billing is based ONLY on Gemini's real
     * usageMetadata.totalTokenCount.
     */
    const settlementResult = await settleReservation(
      supabase,
      reservationId,
      actualCredits,
      providerRequestId,
      referenceId,
      {
        operation,
        billingBasis: "gemini_total_tokens",
        tokensPerCredit: TOKENS_PER_CREDIT,
        usage,
        actualCredits,
        reservationCredits,
        providerUsageSaved,
      }
    );

    if (!settlementResult?.success) {
      /*
       * We cannot safely tell the user that billing was completed
       * if settlement failed.
       *
       * Do NOT attempt a second settlement automatically because
       * the reservation RPC already protects against double processing.
       */
      console.error(
        "Website Builder credit settlement failed:",
        settlementResult
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Website generation completed, but credit settlement could not be completed safely. Please retry.",
          code: "CREDIT_SETTLEMENT_FAILED",
          provider: PROVIDER,
          feature: "website-builder",
          usage,
          creditsConsumed: 0,
          providerUsageSaved,
        },
        { status: 500 }
      );
    }

    const creditsConsumed = toNumber(
      settlementResult.used
    );

    const creditsRefunded = toNumber(
      settlementResult.refunded
    );

    const creditsRemaining = toNumber(
      settlementResult.newBalance
    );

    return NextResponse.json({
      success: true,
      html: cleanedHtml,
      provider: PROVIDER,
      feature: "website-builder",
      operation,
      model: GEMINI_MODEL,

      usage: {
        promptTokens: usage.promptTokens,
        outputTokens: usage.outputTokens,
        thoughtsTokens: usage.thoughtsTokens,
        cachedTokens: usage.cachedTokens,
        totalTokens: usage.totalTokens,
      },

      billing: {
        billingBasis: "gemini_total_tokens",
        tokensPerCredit: TOKENS_PER_CREDIT,
        reservationCredits,
        creditsConsumed,
        creditsRefunded,
        creditsRemaining,
      },

      // Kept for compatibility with the existing frontend.
      creditsConsumed,

      providerUsageSaved,

      creditSettlement: {
        success: true,
        reservationId,
        status: settlementResult.status,
      },
    });
  } catch (error: any) {
    console.error("Website Builder API error:", error);

    /*
     * If Gemini/API failed AFTER reservation,
     * return the entire reservation to the user.
     */
    if (supabase && reservationId) {
      const refundResult = await refundReservation(
        supabase,
        reservationId,
        providerRequestId,
        referenceId,
        {
          operation: "unknown",
          reason: "provider_request_failed",
          error:
            error?.message ??
            "Unknown Website Builder provider error",
          billingBasis: "gemini_total_tokens",
          tokensPerCredit: TOKENS_PER_CREDIT,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Website generation failed. No Website Builder credits were charged.",
          code: "GEMINI_REQUEST_FAILED",
          creditsConsumed: 0,
          creditsRefunded:
            toNumber(refundResult?.refunded),
          creditsRemaining:
            refundResult?.newBalance ??
            null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ??
          "Something went wrong while generating the website.",
        code: "WEBSITE_BUILDER_ERROR",
      },
      { status: 500 }
    );
  }
}

