import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const maxDuration = 300;

const GENERATE_COST = 100;
const EDIT_COST = 50;

const GEMINI_MODEL = "gemini-3.6-flash";

/* =========================================================
   GEMINI
   ========================================================= */

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return new GoogleGenAI({
    apiKey,
  });
}

/* =========================================================
   ERROR HELPERS
   ========================================================= */

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error.";
  }
}

function getErrorStatus(error: unknown): number | null {
  const message = getErrorMessage(error);

  const match = message.match(
    /\b(400|401|403|404|429|500|502|503|504)\b/
  );

  if (match) {
    return Number(match[1]);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error
  ) {
    const status = (error as { status?: unknown }).status;

    if (typeof status === "number") {
      return status;
    }
  }

  return null;
}

/* =========================================================
   HTML CLEANER
   ========================================================= */

function cleanHtml(text: string): string {
  let html = text.trim();

  if (!html) {
    return "";
  }

  // Remove markdown code fences.
  html = html.replace(/^```html\s*/i, "");
  html = html.replace(/^```\s*/i, "");
  html = html.replace(/\s*```$/i, "");

  // Remove accidental text before the HTML document.
  const doctypeIndex = html.search(/<!doctype\s+html>/i);
  const htmlIndex = html.search(/<html[\s>]/i);

  if (doctypeIndex !== -1) {
    html = html.slice(doctypeIndex);
  } else if (htmlIndex !== -1) {
    html = `<!DOCTYPE html>\n${html.slice(htmlIndex)}`;
  }

  // Remove anything after </html>.
  const closingHtmlIndex = html
    .toLowerCase()
    .lastIndexOf("</html>");

  if (closingHtmlIndex !== -1) {
    html = html.slice(
      0,
      closingHtmlIndex + "</html>".length
    );
  }

  return html.trim();
}

/* =========================================================
   HTML VALIDATOR
   ========================================================= */

function isValidHtml(html: string): boolean {
  const value = html.trim();

  if (!value) {
    return false;
  }

  // Complete HTML document.
  const hasHtmlOpen = /<html[\s>]/i.test(value);
  const hasHtmlClose = /<\/html>/i.test(value);

  if (!hasHtmlOpen || !hasHtmlClose) {
    return false;
  }

  // Head.
  const hasHeadOpen = /<head[\s>]/i.test(value);
  const hasHeadClose = /<\/head>/i.test(value);

  if (!hasHeadOpen || !hasHeadClose) {
    return false;
  }

  // Body.
  const hasBodyOpen = /<body[\s>]/i.test(value);
  const hasBodyClose = /<\/body>/i.test(value);

  if (!hasBodyOpen || !hasBodyClose) {
    return false;
  }

  // Do not allow nested external pages.
  if (/<iframe\b/i.test(value)) {
    return false;
  }

  if (/<object\b/i.test(value)) {
    return false;
  }

  if (/<embed\b/i.test(value)) {
    return false;
  }

  return true;
}

/* =========================================================
   GENERATE SYSTEM PROMPT
   ========================================================= */

const GENERATE_SYSTEM_INSTRUCTION = `
You are ZUQEN AI Website Builder.

Generate a complete, beautiful and production-quality website.

STRICT OUTPUT RULES:

1. Return ONLY the HTML document.
2. Start with <!DOCTYPE html>.
3. Include <html>.
4. Include <head>.
5. Include <body>.
6. End with </html>.
7. Put CSS inside <style>.
8. Put JavaScript inside <script>.
9. Do not use Markdown.
10. Do not use code fences.
11. Do not explain anything.
12. Do not write anything before <!DOCTYPE html>.
13. Do not write anything after </html>.
14. Do not use iframe.
15. Do not use object.
16. Do not use embed.
17. Do not use npm packages.
18. Prefer vanilla HTML, CSS and JavaScript.
19. Make the website fully responsive.
20. Make buttons and interactions functional.
21. Make the design modern, polished and professional.
22. Use semantic HTML.
23. Make the website self-contained.

The final response MUST be a complete HTML document.
`;

/* =========================================================
   EDIT SYSTEM PROMPT
   ========================================================= */

const EDIT_SYSTEM_INSTRUCTION = `
You are ZUQEN AI Website Editor.

You will receive an existing HTML website and an edit instruction.

Modify the existing website according to the instruction.

STRICT OUTPUT RULES:

1. Return ONLY the complete updated HTML document.
2. Start with <!DOCTYPE html>.
3. Include <html>.
4. Include <head>.
5. Include <body>.
6. End with </html>.
7. Preserve existing useful content.
8. Preserve existing functionality unless instructed otherwise.
9. Keep the website responsive.
10. Keep CSS inside <style>.
11. Keep JavaScript inside <script>.
12. Do not use Markdown.
13. Do not use code fences.
14. Do not explain anything.
15. Do not use iframe.
16. Do not use object.
17. Do not use embed.
18. Do not return an HTML fragment.

The final response MUST be a complete HTML document.
`;

/* =========================================================
   GEMINI GENERATION
   ========================================================= */

async function generateWebsite(prompt: string): Promise<string> {
  const ai = getGemini();

  try {
    console.log(
      `ZUQEN Website Builder: using ${GEMINI_MODEL}`
    );

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `
WEBSITE REQUEST:

${prompt}

Generate the complete website now.
Return ONLY the complete HTML document.
`,
      config: {
        systemInstruction: GENERATE_SYSTEM_INSTRUCTION,
        maxOutputTokens: 16000,
      },
    });

    const text = response.text || "";

    console.log(
      `ZUQEN Gemini response length: ${text.length}`
    );

    if (!text.trim()) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    const cleaned = cleanHtml(text);

    console.log(
      `ZUQEN cleaned HTML length: ${cleaned.length}`
    );

    return cleaned;
  } catch (error) {
    console.error(
      "Gemini generation error:",
      getErrorMessage(error)
    );

    const status = getErrorStatus(error);

    if (status === 429) {
      throw new Error(
        "Gemini API rate limit or quota reached. Please try again shortly."
      );
    }

    if (
      status === 503 ||
      status === 504
    ) {
      throw new Error(
        "Gemini service is temporarily unavailable. Please try again."
      );
    }

    throw new Error(
      `Gemini generation failed: ${getErrorMessage(error)}`
    );
  }
}

/* =========================================================
   GEMINI EDIT
   ========================================================= */

async function editWebsite(
  html: string,
  instruction: string
): Promise<string> {
  const ai = getGemini();

  try {
    console.log(
      `ZUQEN Website Editor: using ${GEMINI_MODEL}`
    );

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `
EDIT INSTRUCTION:

${instruction}

CURRENT WEBSITE:

${html}

Modify the website according to the instruction.

Return ONLY the complete updated HTML document.
`,
      config: {
        systemInstruction: EDIT_SYSTEM_INSTRUCTION,
        maxOutputTokens: 16000,
      },
    });

    const text = response.text || "";

    console.log(
      `ZUQEN Gemini edit response length: ${text.length}`
    );

    if (!text.trim()) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    const cleaned = cleanHtml(text);

    console.log(
      `ZUQEN cleaned edit HTML length: ${cleaned.length}`
    );

    return cleaned;
  } catch (error) {
    console.error(
      "Gemini edit error:",
      getErrorMessage(error)
    );

    const status = getErrorStatus(error);

    if (status === 429) {
      throw new Error(
        "Gemini API rate limit or quota reached. Please try again shortly."
      );
    }

    if (
      status === 503 ||
      status === 504
    ) {
      throw new Error(
        "Gemini service is temporarily unavailable. Please try again."
      );
    }

    throw new Error(
      `Gemini edit failed: ${getErrorMessage(error)}`
    );
  }
}

/* =========================================================
   AUTHENTICATION
   ========================================================= */

async function getAuthenticatedSupabase() {
  const supabase =
    await createServerSupabaseClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error(
      "Authentication required."
    );
  }

  return {
    supabase,
    user,
  };
}

/* =========================================================
   CREDIT BALANCE
   ========================================================= */

async function getCreditBalance(
  supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  >
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "get_credit_balance"
  );

  if (error) {
    console.error(
      "get_credit_balance error:",
      error
    );

    throw new Error(
      "Unable to load credit balance."
    );
  }

  return Number(data ?? 0);
}

/* =========================================================
   CONSUME CREDITS
   ========================================================= */

async function consumeCredits(
  supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  >,
  amount: number,
  agent: string,
  description: string
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "consume_credits",
    {
      p_amount: amount,
      p_agent: agent,
      p_description: description,
      p_reference_id: null,
    }
  );

  if (error) {
    console.error(
      "consume_credits error:",
      error
    );

    throw new Error(
      "Unable to consume credits."
    );
  }

  return data;
}

/* =========================================================
   POST API
   ========================================================= */

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const action = body?.action;

    /* -----------------------------------------------------
       ACTION VALIDATION
       ----------------------------------------------------- */

    if (
      action !== "generate" &&
      action !== "edit"
    ) {
      return NextResponse.json(
        {
          error: "Invalid action.",
          code: "invalid_action",
        },
        {
          status: 400,
        }
      );
    }

    /* -----------------------------------------------------
       AUTH
       ----------------------------------------------------- */

    const { supabase } =
      await getAuthenticatedSupabase();

    /* -----------------------------------------------------
       CREDIT CHECK
       ----------------------------------------------------- */

    const balance =
      await getCreditBalance(
        supabase
      );

    const requiredCredits =
      action === "generate"
        ? GENERATE_COST
        : EDIT_COST;

    if (
      balance < requiredCredits
    ) {
      return NextResponse.json(
        {
          error:
            "Insufficient credits.",
          code:
            "insufficient_credits",
          required:
            requiredCredits,
          balance,
        },
        {
          status: 402,
        }
      );
    }

    /* =====================================================
       GENERATE
       ===================================================== */

    if (action === "generate") {
      const prompt =
        typeof body.prompt === "string"
          ? body.prompt.trim()
          : "";

      if (!prompt) {
        return NextResponse.json(
          {
            error:
              "Website prompt is required.",
            code:
              "missing_prompt",
          },
          {
            status: 400,
          }
        );
      }

      if (prompt.length > 10000) {
        return NextResponse.json(
          {
            error:
              "Prompt is too long.",
            code:
              "prompt_too_long",
          },
          {
            status: 400,
          }
        );
      }

      console.log(
        "ZUQEN Website Builder: generating website..."
      );

      const html =
        await generateWebsite(
          prompt
        );

      /* ---------------------------------------------------
         VALIDATE GENERATED HTML
         --------------------------------------------------- */

      if (!isValidHtml(html)) {
        console.error(
          "Invalid Gemini HTML preview:",
          html.slice(0, 3000)
        );

        return NextResponse.json(
          {
            error:
              "Gemini did not return valid HTML.",
            code:
              "invalid_html",
          },
          {
            status: 502,
          }
        );
      }

      /* ---------------------------------------------------
         CONSUME CREDIT AFTER SUCCESS
         --------------------------------------------------- */

      const creditResult =
        await consumeCredits(
          supabase,
          GENERATE_COST,
          "Website Builder",
          "Website generation"
        );

      if (
        !creditResult ||
        creditResult.success !== true
      ) {
        return NextResponse.json(
          {
            error:
              "Unable to consume credits.",
            code:
              "credit_consumption_failed",
          },
          {
            status: 500,
          }
        );
      }

      const remaining = Number(
        creditResult.balance ?? 0
      );

      console.log(
        `Website generated successfully. Credits remaining: ${remaining}`
      );

      return NextResponse.json(
        {
          success: true,
          html,
          credits: {
            used: GENERATE_COST,
            remaining,
          },
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
            "X-Zuqen-Credits-Remaining":
              String(remaining),
          },
        }
      );
    }

    /* =====================================================
       EDIT
       ===================================================== */

    const instruction =
      typeof body.instruction ===
      "string"
        ? body.instruction.trim()
        : typeof body.prompt ===
          "string"
        ? body.prompt.trim()
        : "";

    const html =
      typeof body.html === "string"
        ? body.html.trim()
        : "";

    if (!instruction) {
      return NextResponse.json(
        {
          error:
            "Edit instruction is required.",
          code:
            "missing_instruction",
        },
        {
          status: 400,
        }
      );
    }

    if (!html) {
      return NextResponse.json(
        {
          error:
            "Existing HTML is required.",
          code:
            "missing_html",
        },
        {
          status: 400,
        }
      );
    }

    if (instruction.length > 5000) {
      return NextResponse.json(
        {
          error:
            "Edit instruction is too long.",
          code:
            "instruction_too_long",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      "ZUQEN Website Editor: editing website..."
    );

    const updatedHtml =
      await editWebsite(
        html,
        instruction
      );

    /* ---------------------------------------------------
       VALIDATE EDITED HTML
       --------------------------------------------------- */

    if (!isValidHtml(updatedHtml)) {
      console.error(
        "Invalid Gemini edit HTML preview:",
        updatedHtml.slice(0, 3000)
      );

      return NextResponse.json(
        {
          error:
            "Gemini did not return valid HTML.",
          code:
            "invalid_html",
        },
        {
          status: 502,
        }
      );
    }

    /* ---------------------------------------------------
       CONSUME CREDIT AFTER SUCCESS
       --------------------------------------------------- */

    const creditResult =
      await consumeCredits(
        supabase,
        EDIT_COST,
        "Website Builder",
        "Website AI edit"
      );

    if (
      !creditResult ||
      creditResult.success !== true
    ) {
      return NextResponse.json(
        {
          error:
            "Unable to consume credits.",
          code:
            "credit_consumption_failed",
        },
        {
          status: 500,
        }
      );
    }

    const remaining = Number(
      creditResult.balance ?? 0
    );

    return NextResponse.json(
      {
        success: true,
        html: updatedHtml,
        credits: {
          used: EDIT_COST,
          remaining,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
          "X-Zuqen-Credits-Remaining":
            String(remaining),
        },
      }
    );
  } catch (error) {
    console.error(
      "ZUQEN Website Builder API error:",
      error
    );

    const message =
      getErrorMessage(error);

    if (
      message.includes(
        "Authentication required"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
          code:
            "authentication_required",
        },
        {
          status: 401,
        }
      );
    }

    if (
      message.includes(
        "Insufficient credits"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Insufficient credits.",
          code:
            "insufficient_credits",
        },
        {
          status: 402,
        }
      );
    }

    return NextResponse.json(
      {
        error: message,
        code:
          "website_builder_error",
      },
      {
        status: 500,
      }
    );
  }
}