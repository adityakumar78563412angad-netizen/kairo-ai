import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const FEATURE_KEY = "website_builder";
const PROVIDER = "gemini";
const MODEL = "gemini-3.6-flash";

const TOKENS_PER_CREDIT = 20_000;
const MAX_OUTPUT_TOKENS = 32_000;
const MAX_INPUT_CHARS = 500_000;

type JsonObject = Record<string, unknown>;

type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

type GeminiCandidate = {
  content?: {
    parts?: Array<{
      text?: string;
    }>;
  };
  finishReason?: string;
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsage;
  error?: {
    message?: string;
    code?: number;
    status?: string;
  };
};

function response(body: JsonObject, status = 200) {
  return NextResponse.json(body, { status });
}

function cleanHtml(value: string): string {
  let html = value.trim();

  if (html.startsWith("```html")) {
    html = html.slice(7);
  } else if (html.startsWith("```")) {
    html = html.slice(3);
  }

  if (html.endsWith("```")) {
    html = html.slice(0, -3);
  }

  return html.trim();
}

function isValidWebsiteHtml(html: string): boolean {
  if (!html || html.length < 100) {
    return false;
  }

  const lower = html.toLowerCase();

  const hasHtmlStructure =
    lower.includes("<html") ||
    lower.includes("<!doctype") ||
    lower.includes("<body") ||
    lower.includes("<main") ||
    lower.includes("<section");

  const hasUsefulContent =
    lower.includes("<div") ||
    lower.includes("<section") ||
    lower.includes("<header") ||
    lower.includes("<nav") ||
    lower.includes("<main");

  const looksLikeError =
    lower.includes("i'm sorry") ||
    lower.includes("i cannot") ||
    lower.includes("i can't generate") ||
    lower.includes("unable to generate");

  return hasHtmlStructure && hasUsefulContent && !looksLikeError;
}

function getUsage(data: GeminiResponse): GeminiUsage {
  return data.usageMetadata ?? {};
}

function getTotalTokens(usage: GeminiUsage): number {
  const total = Number(usage.totalTokenCount ?? 0);

  if (!Number.isFinite(total) || total < 0) {
    return 0;
  }

  return Math.ceil(total);
}

function creditsFromTokens(tokens: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return 0;
  }

  return tokens / TOKENS_PER_CREDIT;
}

function roundCredits(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Temporary reservation only.
 *
 * This is NOT the final charge.
 * Final billing always comes from Gemini's actual
 * usageMetadata.totalTokenCount.
 */
function estimateReservationCredits(prompt: string): number {
  const estimatedInputTokens = Math.ceil(prompt.length / 3.5);

  const estimatedTotalTokens =
    estimatedInputTokens + MAX_OUTPUT_TOKENS;

  const safetyFactor = 1.2;

  const estimatedWithSafety =
    Math.ceil(estimatedTotalTokens * safetyFactor);

  const credits =
    estimatedWithSafety / TOKENS_PER_CREDIT;

  return Math.max(0.01, roundCredits(credits));
}

async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

async function getCurrentBalance(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("feature_credit_balances")
    .select("balance")
    .eq("user_id", userId)
    .eq("feature_key", FEATURE_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const balance = Number(data?.balance ?? 0);

  if (!Number.isFinite(balance)) {
    return 0;
  }

  return balance;
}

async function reserveCredits(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  amount: number,
  providerRequestId: string,
  referenceId: string,
  metadata: JsonObject
) {
  const { data, error } = await supabase.rpc(
    "reserve_feature_credits",
    {
      p_user_id: userId,
      p_feature_key: FEATURE_KEY,
      p_amount: amount,
      p_provider_request_id: providerRequestId,
      p_reference_id: referenceId,
      p_metadata: metadata,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return data as {
    success?: boolean;
    code?: string;
    reservationId?: string;
    reservation_id?: string;
    provider?: string;
    feature?: string;
    reserved?: number;
    previousBalance?: number;
    newBalance?: number;
    message?: string;
  };
}

async function settleCredits(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  reservationId: string,
  actualAmount: number,
  providerRequestId: string,
  description: string,
  referenceId: string,
  metadata: JsonObject
) {
  const { data, error } = await supabase.rpc(
    "settle_feature_credit_reservation",
    {
      p_reservation_id: reservationId,
      p_actual_amount: actualAmount,
      p_provider_request_id: providerRequestId,
      p_description: description,
      p_reference_id: referenceId,
      p_metadata: metadata,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return data as {
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
}

async function refundCredits(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  reservationId: string,
  providerRequestId: string,
  description: string,
  referenceId: string,
  metadata: JsonObject
) {
  const { data, error } = await supabase.rpc(
    "refund_feature_credit_reservation",
    {
      p_reservation_id: reservationId,
      p_provider_request_id: providerRequestId,
      p_description: description,
      p_reference_id: referenceId,
      p_metadata: metadata,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return data as {
    success?: boolean;
    code?: string;
    reservationId?: string;
    refunded?: number;
    newBalance?: number;
    status?: string;
    message?: string;
  };
}

function createProviderRequestId(): string {
  return `website-builder-${crypto.randomUUID()}`;
}

function createReferenceId(): string {
  return `website-builder-${crypto.randomUUID()}`;
}

function buildGeminiPrompt(
  action: string,
  prompt: string,
  existingHtml?: string
): string {
  const baseInstructions = `
You are the website generation engine for ZUQEN AI.

Generate a complete, polished, production-quality website as a SINGLE HTML document.

Requirements:
- Return ONLY the HTML document.
- Do not use Markdown.
- Do not wrap the answer in triple backticks.
- Include <!DOCTYPE html>.
- Include <html>, <head>, and <body>.
- Include responsive CSS inside <style>.
- Use modern, professional UI design.
- Make the website fully responsive on desktop, tablet and mobile.
- Use semantic HTML.
- Include accessible buttons, links, labels and navigation.
- Do not explain the code.
- Do not mention Gemini.
- Do not mention token usage.
- Do not mention ZUQEN credits.
- Do not return JSON.
- Do not return commentary outside the HTML document.

You may use:
- HTML
- CSS
- Vanilla JavaScript
- Google Fonts through normal <link> tags
- Public image URLs when genuinely useful

Do NOT depend on a build system, npm package, React, Next.js, Tailwind, or external JavaScript libraries.

All important visual styling must be contained in this HTML document.
`;

  if (action === "edit" && existingHtml) {
    return `
${baseInstructions}

The user wants to EDIT an existing website.

User request:
${prompt}

Existing website HTML:
${existingHtml}

Modify the existing website according to the user's request.

Preserve existing useful content and structure unless the user explicitly asks to remove or replace it.

Return the COMPLETE updated HTML document.
`;
  }

  return `
${baseInstructions}

Create a new website based on this user request:

${prompt}

Return the COMPLETE HTML document.
`;
}

async function generateWithGemini(
  prompt: string,
  apiKey: string
): Promise<{
  html: string;
  usage: GeminiUsage;
  finishReason: string | null;
}> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  };

  const providerResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    cache: "no-store",
  });

  let data: GeminiResponse;

  try {
    data = (await providerResponse.json()) as GeminiResponse;
  } catch {
    throw new Error(
      `Gemini returned an invalid response (${providerResponse.status}).`
    );
  }

  if (!providerResponse.ok) {
    const providerMessage =
      data.error?.message ||
      `Gemini request failed with status ${providerResponse.status}.`;

    throw new Error(providerMessage);
  }

  const usage = getUsage(data);

  const candidate = data.candidates?.[0];

  const finishReason =
    typeof candidate?.finishReason === "string"
      ? candidate.finishReason
      : null;

  const parts = candidate?.content?.parts ?? [];

  const text = parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  const html = cleanHtml(text);

  return {
    html,
    usage,
    finishReason,
  };
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return response(
        {
          success: false,
          code: "UNAUTHENTICATED",
          message: "Please sign in to use Website Builder.",
        },
        401
      );
    }

    if (user.is_anonymous) {
      return response(
        {
          success: false,
          code: "SIGN_IN_REQUIRED",
          message:
            "Website Builder is available only for permanent accounts. Please create an account or sign in.",
          balance: 0,
        },
        403
      );
    }

    const balance = await getCurrentBalance(
      supabase,
      user.id
    );

    return response({
      success: true,
      feature: FEATURE_KEY,
      provider: PROVIDER,
      balance: roundCredits(balance),
      tokensPerCredit: TOKENS_PER_CREDIT,
      creditUnit: "ZUQEN Website Builder Credit",
    });
  } catch (error) {
    console.error(
      "Website Builder GET error:",
      error
    );

    return response(
      {
        success: false,
        code: "BALANCE_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load Website Builder credits.",
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

  let reservationId: string | null = null;

  let providerRequestId = "";
  let referenceId = "";

  try {
    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return response(
        {
          success: false,
          code: "UNAUTHENTICATED",
          message: "Please sign in to use Website Builder.",
        },
        401
      );
    }

    if (user.is_anonymous) {
      return response(
        {
          success: false,
          code: "SIGN_IN_REQUIRED",
          message:
            "Website Builder requires a permanent account. Please create an account or sign in.",
        },
        403
      );
    }

    const body = (await request.json()) as {
      action?: string;
      prompt?: string;
      existingHtml?: string;
      projectId?: string;
    };

    const action =
      body.action === "edit"
        ? "edit"
        : "generate";

    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

    const existingHtml =
      typeof body.existingHtml === "string"
        ? body.existingHtml.trim()
        : "";

    const projectId =
      typeof body.projectId === "string" &&
      body.projectId.trim().length > 0
        ? body.projectId.trim()
        : createReferenceId();

    if (!prompt) {
      return response(
        {
          success: false,
          code: "INVALID_PROMPT",
          message:
            "Please enter a website description or edit instruction.",
        },
        400
      );
    }

    if (prompt.length > MAX_INPUT_CHARS) {
      return response(
        {
          success: false,
          code: "PROMPT_TOO_LARGE",
          message:
            "Your request is too large. Please shorten the prompt.",
        },
        400
      );
    }

    if (
      action === "edit" &&
      existingHtml.length > MAX_INPUT_CHARS
    ) {
      return response(
        {
          success: false,
          code: "WEBSITE_TOO_LARGE",
          message:
            "The existing website is too large to edit in one request.",
        },
        400
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return response(
        {
          success: false,
          code: "GEMINI_API_KEY_MISSING",
          message:
            "Gemini API key is not configured on the server.",
        },
        500
      );
    }

    const geminiPrompt = buildGeminiPrompt(
      action,
      prompt,
      existingHtml || undefined
    );

    /*
     * Reserve enough credits before calling Gemini.
     *
     * The reservation is only a temporary hold.
     * The final charge is calculated from the real
     * Gemini usageMetadata.totalTokenCount.
     */
    const estimatedCredits =
      estimateReservationCredits(geminiPrompt);

    const currentBalance =
      await getCurrentBalance(
        supabase,
        user.id
      );

    if (currentBalance <= 0) {
      return response(
        {
          success: false,
          code: "INSUFFICIENT_CREDITS",
          message:
            "You do not have enough Website Builder credits.",
          balance: roundCredits(currentBalance),
          required: roundCredits(estimatedCredits),
        },
        402
      );
    }

    /*
     * Never request more than the user's current
     * available balance for the temporary reservation.
     */
    const reservationAmount = Math.min(
      estimatedCredits,
      currentBalance
    );

    providerRequestId =
      createProviderRequestId();

    referenceId = projectId;

    const reservation =
      await reserveCredits(
        supabase,
        user.id,
        roundCredits(reservationAmount),
        providerRequestId,
        referenceId,
        {
          action,
          model: MODEL,
          estimatedCredits:
            roundCredits(estimatedCredits),
          tokensPerCredit:
            TOKENS_PER_CREDIT,
        }
      );

    if (
      !reservation ||
      reservation.success !== true
    ) {
      const code =
        reservation?.code ||
        "CREDIT_RESERVATION_FAILED";

      if (code === "INSUFFICIENT_CREDITS") {
        const latestBalance =
          await getCurrentBalance(
            supabase,
            user.id
          );

        return response(
          {
            success: false,
            code: "INSUFFICIENT_CREDITS",
            message:
              "You do not have enough Website Builder credits.",
            balance:
              roundCredits(latestBalance),
            required:
              roundCredits(reservationAmount),
          },
          402
        );
      }

      return response(
        {
          success: false,
          code,
          message:
            reservation?.message ||
            "Unable to reserve Website Builder credits.",
        },
        500
      );
    }

    /*
     * IMPORTANT:
     *
     * Create a guaranteed string value immediately after
     * the reservation succeeds.
     *
     * This avoids the TypeScript string | null problem.
     */
    const reservedId =
      reservation.reservationId ??
      reservation.reservation_id;

    if (typeof reservedId !== "string") {
      return response(
        {
          success: false,
          code: "RESERVATION_ERROR",
          message:
            "Credit reservation was created but its ID was not returned.",
        },
        500
      );
    }

    reservationId = reservedId;

    let generated: {
      html: string;
      usage: GeminiUsage;
      finishReason: string | null;
    };

    try {
      generated =
        await generateWithGemini(
          geminiPrompt,
          apiKey
        );
    } catch (error) {
      if (reservationId) {
        try {
          await refundCredits(
            supabase,
            reservationId,
            providerRequestId,
            "Website Builder Gemini request failed - reservation refunded",
            referenceId,
            {
              action,
              model: MODEL,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown Gemini error",
            }
          );
        } catch (refundError) {
          console.error(
            "Website Builder refund error after Gemini failure:",
            refundError
          );
        }

        reservationId = null;
      }

      return response(
        {
          success: false,
          code: "GEMINI_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Gemini website generation failed.",
        },
        502
      );
    }

    const usage = generated.usage;

    const totalTokens =
      getTotalTokens(usage);

    const html = generated.html;

    /*
     * Gemini can return incomplete output when the
     * output-token limit is reached.
     */
    const wasTruncated =
      generated.finishReason === "MAX_TOKENS" ||
      generated.finishReason === "LENGTH";

    if (
      wasTruncated ||
      !isValidWebsiteHtml(html)
    ) {
      if (reservationId) {
        try {
          await refundCredits(
            supabase,
            reservationId,
            providerRequestId,
            "Website Builder invalid or incomplete output - reservation refunded",
            referenceId,
            {
              action,
              model: MODEL,
              finishReason:
                generated.finishReason,
              totalTokenCount:
                totalTokens,
            }
          );
        } catch (refundError) {
          console.error(
            "Website Builder refund error after invalid output:",
            refundError
          );
        }

        reservationId = null;
      }

      return response(
        {
          success: false,
          code: "INVALID_PROVIDER_OUTPUT",
          message:
            "Gemini returned incomplete or invalid website code. No credits were charged.",
          usage: {
            promptTokenCount:
              usage.promptTokenCount ?? 0,
            candidatesTokenCount:
              usage.candidatesTokenCount ?? 0,
            totalTokenCount:
              totalTokens,
          },
          billing: {
            creditsConsumed: 0,
          },
        },
        502
      );
    }

    /*
     * REAL BILLING
     *
     * 1.00 ZUQEN Website Builder Credit
     * = 20,000 actual Gemini total tokens.
     */
    const actualCredits =
      roundCredits(
        creditsFromTokens(totalTokens)
      );

    /*
     * There should always be a reservation at this point.
     * Use the guaranteed string variable rather than the
     * mutable string | null variable.
     */
    if (typeof reservationId !== "string") {
      return response(
        {
          success: false,
          code: "RESERVATION_ERROR",
          message:
            "Credit reservation was lost before settlement.",
        },
        500
      );
    }

    const settlementReservationId: string =
      reservationId;

    /*
     * IMPORTANT:
     *
     * The DB settlement function requires:
     *
     * actual_amount <= reserved_amount
     *
     * If Gemini somehow used more than our temporary
     * reservation, do not silently create incorrect billing.
     */
    const reservedAmount =
      Number(reservation.reserved ?? reservationAmount);

    if (
      !Number.isFinite(reservedAmount) ||
      actualCredits > reservedAmount
    ) {
      try {
        await refundCredits(
          supabase,
          settlementReservationId,
          providerRequestId,
          "Website Builder reservation insufficient for actual usage - reservation refunded",
          referenceId,
          {
            action,
            model: MODEL,
            reservedCredits:
              reservedAmount,
            actualCredits,
            totalTokenCount:
              totalTokens,
          }
        );
      } catch (refundError) {
        console.error(
          "Website Builder refund error after reservation mismatch:",
          refundError
        );
      }

      reservationId = null;

      return response(
        {
          success: false,
          code: "RESERVATION_TOO_SMALL",
          message:
            "The request used more Gemini tokens than the temporary credit reservation allowed. No credits were permanently charged.",
          usage: {
            promptTokenCount:
              usage.promptTokenCount ?? 0,
            candidatesTokenCount:
              usage.candidatesTokenCount ?? 0,
            totalTokenCount:
              totalTokens,
          },
          billing: {
            creditsConsumed: 0,
            reservedCredits:
              roundCredits(reservedAmount),
            actualCredits,
          },
        },
        500
      );
    }

    /*
     * SETTLE THE RESERVATION
     *
     * This permanently charges only the actual
     * Gemini token usage and automatically refunds
     * the unused reserved amount.
     */
    let settlement: Awaited<
      ReturnType<typeof settleCredits>
    >;

    try {
      settlement =
        await settleCredits(
          supabase,
          settlementReservationId,
          actualCredits,
          providerRequestId,
          "Website Builder Gemini usage settlement",
          referenceId,
          {
            action,
            model: MODEL,
            totalTokenCount:
              totalTokens,
            promptTokenCount:
              usage.promptTokenCount ?? 0,
            candidatesTokenCount:
              usage.candidatesTokenCount ?? 0,
            tokensPerCredit:
              TOKENS_PER_CREDIT,
          }
        );
    } catch (settlementError) {
      console.error(
        "Website Builder settlement error:",
        settlementError
      );

      return response(
        {
          success: false,
          code: "CREDIT_SETTLEMENT_FAILED",
          message:
            "Website was generated, but credit settlement failed. Please do not retry repeatedly; check your credit balance first.",
          usage: {
            promptTokenCount:
              usage.promptTokenCount ?? 0,
            candidatesTokenCount:
              usage.candidatesTokenCount ?? 0,
            totalTokenCount:
              totalTokens,
          },
          billing: {
            creditsConsumed: 0,
            actualCredits,
          },
        },
        500
      );
    }

    reservationId = null;

    if (
      !settlement ||
      settlement.success !== true
    ) {
      return response(
        {
          success: false,
          code:
            settlement?.code ||
            "CREDIT_SETTLEMENT_FAILED",
          message:
            settlement?.message ||
            "Website Builder credit settlement failed.",
          usage: {
            promptTokenCount:
              usage.promptTokenCount ?? 0,
            candidatesTokenCount:
              usage.candidatesTokenCount ?? 0,
            totalTokenCount:
              totalTokens,
          },
          billing: {
            creditsConsumed: 0,
            actualCredits,
          },
        },
        500
      );
    }

    const creditsConsumed =
      roundCredits(
        Number(
          settlement.used ??
            actualCredits
        )
      );

    const creditsRemaining =
      roundCredits(
        Number(
          settlement.newBalance ??
            0
        )
      );

    return response({
      success: true,
      action,
      feature: FEATURE_KEY,
      provider: PROVIDER,
      model: MODEL,

      html,

      usage: {
        promptTokenCount:
          usage.promptTokenCount ?? 0,
        candidatesTokenCount:
          usage.candidatesTokenCount ?? 0,
        totalTokenCount:
          totalTokens,
      },

      billing: {
        tokensPerCredit:
          TOKENS_PER_CREDIT,
        creditsConsumed,
        creditsRemaining,
        reservedCredits:
          roundCredits(reservedAmount),
        refundedCredits:
          roundCredits(
            Math.max(
              0,
              reservedAmount -
                creditsConsumed
            )
          ),
      },

      creditsConsumed,
      creditsRemaining,
      projectId,
    });
  } catch (error) {
    console.error(
      "Website Builder POST error:",
      error
    );

    /*
     * Safety refund if an unexpected server error
     * occurs after reservation.
     */
    if (reservationId) {
      try {
        await refundCredits(
          supabase,
          reservationId,
          providerRequestId ||
            createProviderRequestId(),
          "Website Builder unexpected server error - reservation refunded",
          referenceId ||
            createReferenceId(),
          {
            model: MODEL,
            error:
              error instanceof Error
                ? error.message
                : "Unknown server error",
          }
        );
      } catch (refundError) {
        console.error(
          "Website Builder emergency refund error:",
          refundError
        );
      }

      reservationId = null;
    }

    return response(
      {
        success: false,
        code: "WEBSITE_BUILDER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Website Builder request failed.",
      },
      500
    );
  }
}