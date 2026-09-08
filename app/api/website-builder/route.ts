import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const maxDuration = 300;

const GEMINI_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
];

const GENERATE_COST = 100;
const EDIT_COST = 50;

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return new GoogleGenAI({
    apiKey,
  });
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getErrorStatus(error: unknown): number | null {
  if (!error) {
    return null;
  }

  if (
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }

  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const match = message.match(
    /\b(429|500|502|503|504)\b/
  );

  return match ? Number(match[1]) : null;
}

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
    return "Unknown Gemini error.";
  }
}

/* =========================================================
   CLEAN GEMINI HTML RESPONSE
   ========================================================= */

function cleanHtml(text: string): string {
  let html = text.trim();

  // Remove markdown code fences
  html = html.replace(
    /^```html\s*/i,
    ""
  );

  html = html.replace(
    /^```\s*/i,
    ""
  );

  html = html.replace(
    /\s*```$/i,
    ""
  );

  // Remove common AI introduction
  html = html.replace(
    /^(here(?:'s| is)\s+(?:the\s+)?(?:complete\s+)?html(?:\s+document)?[:\-]?\s*)/i,
    ""
  );

  // Find DOCTYPE
  const doctypeIndex = html
    .toLowerCase()
    .indexOf("<!doctype");

  // Find HTML tag
  const htmlIndex = html
    .toLowerCase()
    .indexOf("<html");

  if (doctypeIndex >= 0) {
    html = html.slice(doctypeIndex);
  } else if (htmlIndex >= 0) {
    html =
      "<!DOCTYPE html>\n" +
      html.slice(htmlIndex);
  }

  // Cut everything after closing HTML
  const closingHtmlIndex = html
    .toLowerCase()
    .lastIndexOf("</html>");

  if (closingHtmlIndex >= 0) {
    html = html.slice(
      0,
      closingHtmlIndex + "</html>".length
    );
  }

  return html.trim();
}

/* =========================================================
   HTML VALIDATION
   ========================================================= */

function isValidHtml(html: string): boolean {
  const trimmed = html.trim();

  if (!trimmed) {
    return false;
  }

  const lower = trimmed.toLowerCase();

  if (!lower.includes("<!doctype html>")) {
    return false;
  }

  if (!/<html[\s>]/i.test(trimmed)) {
    return false;
  }

  if (!/<\/html>/i.test(trimmed)) {
    return false;
  }

  if (!/<head[\s>]/i.test(trimmed)) {
    return false;
  }

  if (!/<\/head>/i.test(trimmed)) {
    return false;
  }

  if (!/<body[\s>]/i.test(trimmed)) {
    return false;
  }

  if (!/<\/body>/i.test(trimmed)) {
    return false;
  }

  // Prevent nested iframe/object/embed
  if (/<iframe\b/i.test(trimmed)) {
    return false;
  }

  if (/<object\b/i.test(trimmed)) {
    return false;
  }

  if (/<embed\b/i.test(trimmed)) {
    return false;
  }

  return true;
}

/* =========================================================
   GENERATION SYSTEM INSTRUCTION
   ========================================================= */

const GENERATE_SYSTEM_INSTRUCTION = `
You are ZUQEN AI Website Builder.

Generate a complete, production-quality website as ONE standalone HTML document.

IMPORTANT RULES:

1. Return ONLY the HTML document.
2. Start with <!DOCTYPE html>.
3. Include <html>, <head>, and <body>.
4. Include all CSS inside <style>.
5. Include JavaScript inside <script> when needed.
6. Do not use markdown.
7. Do not wrap the response in code fences.
8. Do not explain the code.
9. Do not add text before the HTML.
10. Do not add text after the HTML.
11. Do NOT create an iframe.
12. Do NOT create object elements.
13. Do NOT create embed elements.
14. The ZUQEN editor will render your HTML inside its own preview iframe using srcDoc.
15. Therefore return the actual website document.
16. Do not use npm packages.
17. Prefer vanilla HTML, CSS and JavaScript.
18. Make the website responsive.
19. Make the website visually polished and modern.
20. Make buttons and interactions work.
21. Use semantic HTML.
22. Make the website self-contained.
23. Return a complete HTML document.

Your response must contain nothing except the final HTML.
`;

/* =========================================================
   EDIT SYSTEM INSTRUCTION
   ========================================================= */

const EDIT_SYSTEM_INSTRUCTION = `
You are ZUQEN AI Website Editor.

You will receive an existing complete HTML website and an edit instruction.

Modify the existing website according to the user's instruction.

IMPORTANT RULES:

1. Return ONLY the complete updated HTML document.
2. Start with <!DOCTYPE html>.
3. Include <html>, <head>, and <body>.
4. Preserve existing functionality unless the user asks to change it.
5. Keep the website production-quality.
6. Keep responsive design.
7. Do not use markdown.
8. Do not wrap the response in code fences.
9. Do not explain anything.
10. Do NOT create an iframe.
11. Do NOT create object elements.
12. Do NOT create embed elements.
13. The ZUQEN editor itself displays this document inside an iframe using srcDoc.
14. Therefore return the website itself.
15. Keep CSS inside <style>.
16. Keep JavaScript inside <script>.
17. Do not use npm packages.
18. Return the complete HTML document.
19. Do not return an HTML fragment.
20. Do not add text before or after the HTML.

Your response must contain nothing except the complete updated HTML.
`;

/* =========================================================
   GEMINI GENERATION WITH FALLBACK
   ========================================================= */

async function generateWithFallback(prompt: string) {
  const ai = getGemini();

  let lastError: unknown = null;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(
          `Gemini request: ${model}, attempt ${attempt}`
        );

        const response =
          await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction:
                GENERATE_SYSTEM_INSTRUCTION,
              maxOutputTokens: 16000,
            },
          });

        const text =
          response.text?.trim() || "";

        console.log(
          `Gemini response received from ${model}, length: ${text.length}`
        );

        if (!text) {
          throw new Error(
            "Gemini returned an empty response."
          );
        }

        return text;
      } catch (error) {
        lastError = error;

        const status =
          getErrorStatus(error);

        console.error(
          `Gemini ${model} attempt ${attempt} failed:`,
          getErrorMessage(error)
        );

        const temporaryError =
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504;

        if (
          temporaryError &&
          attempt === 1
        ) {
          await wait(2000);
          continue;
        }

        break;
      }
    }
  }

  throw new Error(
    `Gemini generation failed: ${getErrorMessage(
      lastError
    )}`
  );
}

/* =========================================================
   GEMINI EDIT WITH FALLBACK
   ========================================================= */

async function editWithFallback(
  html: string,
  instruction: string
) {
  const ai = getGemini();

  let lastError: unknown = null;

  const prompt = `
EDIT INSTRUCTION:

${instruction}

EXISTING WEBSITE:

${html}

Return the COMPLETE updated HTML document.

Do not return a fragment.
Do not return markdown.
Do not return an iframe.
Do not return object.
Do not return embed.
`;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(
          `Gemini edit request: ${model}, attempt ${attempt}`
        );

        const response =
          await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction:
                EDIT_SYSTEM_INSTRUCTION,
              maxOutputTokens: 16000,
            },
          });

        const text =
          response.text?.trim() || "";

        console.log(
          `Gemini edit response received from ${model}, length: ${text.length}`
        );

        if (!text) {
          throw new Error(
            "Gemini returned an empty response."
          );
        }

        return text;
      } catch (error) {
        lastError = error;

        const status =
          getErrorStatus(error);

        console.error(
          `Gemini edit ${model} attempt ${attempt} failed:`,
          getErrorMessage(error)
        );

        const temporaryError =
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504;

        if (
          temporaryError &&
          attempt === 1
        ) {
          await wait(2000);
          continue;
        }

        break;
      }
    }
  }

  throw new Error(
    `Gemini edit failed: ${getErrorMessage(
      lastError
    )}`
  );
}

/* =========================================================
   CURRENT USER
   ========================================================= */

async function getCurrentUser() {
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
   GET CREDIT BALANCE
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
      "Credit balance error:",
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
      "Consume credits error:",
      error
    );

    throw new Error(
      "Unable to consume credits."
    );
  }

  return data;
}

/* =========================================================
   POST
   ========================================================= */

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const action =
      body?.action;

    /* -----------------------------------------------------
       VALIDATE ACTION
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

    const {
      supabase,
    } = await getCurrentUser();

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
       GENERATE WEBSITE
       ===================================================== */

    if (
      action === "generate"
    ) {
      const userPrompt =
        typeof body.prompt ===
        "string"
          ? body.prompt.trim()
          : "";

      if (!userPrompt) {
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

      if (
        userPrompt.length > 10000
      ) {
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

      /* Generate */
      const generatedText =
        await generateWithFallback(
          userPrompt
        );

      /* Clean */
      const html =
        cleanHtml(
          generatedText
        );

      /* Validate */
      if (
        !isValidHtml(html)
      ) {
        console.error(
          "Gemini returned invalid HTML. Preview:",
          generatedText.slice(
            0,
            1500
          )
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

      /* Consume credits only after successful HTML */
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

      return NextResponse.json(
        {
          success: true,
          html,
          credits: {
            used:
              GENERATE_COST,
            remaining:
              Number(
                creditResult.balance ??
                  0
              ),
          },
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
            "X-Zuqen-Credits-Remaining":
              String(
                creditResult.balance ??
                  0
              ),
          },
        }
      );
    }

    /* =====================================================
       EDIT WEBSITE
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
      typeof body.html ===
      "string"
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

    if (
      instruction.length > 5000
    ) {
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

    /* Edit */
    const generatedText =
      await editWithFallback(
        html,
        instruction
      );

    /* Clean */
    const updatedHtml =
      cleanHtml(
        generatedText
      );

    /* Validate */
    if (
      !isValidHtml(
        updatedHtml
      )
    ) {
      console.error(
        "Gemini edit returned invalid HTML. Preview:",
        generatedText.slice(
          0,
          1500
        )
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

    /* Consume credits */
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

    return NextResponse.json(
      {
        success: true,
        html: updatedHtml,
        credits: {
          used:
            EDIT_COST,
          remaining:
            Number(
              creditResult.balance ??
                0
            ),
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
          "X-Zuqen-Credits-Remaining":
            String(
              creditResult.balance ??
                0
            ),
        },
      }
    );
  } catch (error) {
    console.error(
      "Website Builder API error:",
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