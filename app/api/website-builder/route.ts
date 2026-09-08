import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const maxDuration = 300;

const GENERATE_COST = 100;
const EDIT_COST = 50;

const GEMINI_MODELS = [
  "gemini-3.6-flash",
];

/* =========================================================
   GEMINI
   ========================================================= */

function getGemini() {
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
    const status = (error as {
      status?: unknown;
    }).status;

    if (typeof status === "number") {
      return status;
    }
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/* =========================================================
   HTML CLEANER
   ========================================================= */
function cleanHtml(text: string): string {
  let html = text.trim();

  if (!html) {
    return "";
  }

  // Remove markdown code fences
  html = html.replace(/^```(?:html|HTML)?\s*/i, "");
  html = html.replace(/\s*```$/i, "");

  // Remove common AI prefixes
  html = html.replace(
    /^(here(?:'s| is)?\s+(?:the\s+)?(?:complete\s+)?html(?:\s+document)?[:\-]?\s*)/i,
    ""
  );

  html = html.trim();

  // Find the beginning of the actual HTML document
  const doctypeMatch = html.match(/<!doctype\s+html>/i);
  const htmlStart = html.search(/<html[\s>]/i);

  if (doctypeMatch?.index !== undefined) {
    html = html.slice(doctypeMatch.index);
  } else if (htmlStart !== -1) {
    html =
      "<!DOCTYPE html>\n" +
      html.slice(htmlStart);
  }

  // Find the end of the actual HTML document
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

function isValidHtml(html: string): boolean {
  const value = html.trim();

  if (!value) {
    return false;
  }

  // Accept either an explicit doctype or a complete HTML document.
  const hasHtml =
    /<html[\s>]/i.test(value) &&
    /<\/html>/i.test(value);

  if (!hasHtml) {
    return false;
  }

  // Head/body are required for Website Builder output.
  const hasHead =
    /<head[\s>]/i.test(value) &&
    /<\/head>/i.test(value);

  const hasBody =
    /<body[\s>]/i.test(value) &&
    /<\/body>/i.test(value);

  if (!hasHead || !hasBody) {
    return false;
  }

  // Never allow the generated site to embed another page.
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

OUTPUT RULES:

- Return ONLY HTML.
- Return one complete HTML document.
- Start with <!DOCTYPE html>.
- Include <html>.
- Include <head>.
- Include <body>.
- Put CSS inside <style>.
- Put JavaScript inside <script>.
- Do not use markdown.
- Do not use code fences.
- Do not explain anything.
- Do not write anything before <!DOCTYPE html>.
- Do not write anything after </html>.
- Do not create an iframe.
- Do not create object elements.
- Do not create embed elements.
- The ZUQEN editor itself will display this HTML inside an iframe.
- Therefore generate the actual website, not an iframe.
- Do not use npm packages.
- Prefer vanilla HTML, CSS and JavaScript.
- Make the website responsive.
- Make buttons and interactions functional.
- Make the design modern and polished.
- Use semantic HTML.
- Make the website self-contained.

IMPORTANT:
The final response must be ONLY the complete HTML document.
`;

/* =========================================================
   EDIT SYSTEM PROMPT
   ========================================================= */

const EDIT_SYSTEM_INSTRUCTION = `
You are ZUQEN AI Website Editor.

You will receive an existing HTML website and an edit instruction.

Modify the existing website according to the instruction.

OUTPUT RULES:

- Return ONLY the complete updated HTML.
- Start with <!DOCTYPE html>.
- Include <html>.
- Include <head>.
- Include <body>.
- Preserve existing functionality unless instructed otherwise.
- Keep existing useful content unless the user asks to remove it.
- Keep the design responsive.
- Keep CSS inside <style>.
- Keep JavaScript inside <script>.
- Do not use markdown.
- Do not use code fences.
- Do not explain anything.
- Do not create an iframe.
- Do not create object elements.
- Do not create embed elements.
- Do not return an HTML fragment.
- Return the entire HTML document.
- The ZUQEN editor itself will display this document inside an iframe.

The final response must contain ONLY the complete HTML document.
`;

/* =========================================================
   GENERATE WEBSITE
   ========================================================= */

async function generateWebsite(
  prompt: string
): Promise<string> {
  const ai = getGemini();

  let lastError: unknown = null;

  for (
    let i = 0;
    i < GEMINI_MODELS.length;
    i++
  ) {
    const model =
      GEMINI_MODELS[i];

    try {
      console.log(
        `ZUQEN Website Builder: trying ${model}`
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
  response.text || "";

const cleaned =
  cleanHtml(text);

if (!cleaned) {
  throw new Error(
    "Gemini returned an empty response."
  );
}

return cleaned;

      console.log(
        `ZUQEN Gemini response length: ${text.length}`
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
        `Gemini ${model} failed:`,
        getErrorMessage(error)
      );

      /*
       * Only retry another model for temporary
       * Gemini/server errors.
       */

      const temporary =
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504;

      if (
        temporary &&
        i < GEMINI_MODELS.length - 1
      ) {
        await sleep(1200);
        continue;
      }

      /*
       * Don't keep retrying bad requests.
       */

      if (!temporary) {
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
   EDIT WEBSITE
   ========================================================= */

async function editWebsite(
  html: string,
  instruction: string
): Promise<string> {
  const ai = getGemini();

  let lastError: unknown = null;

  const prompt = `
EDIT INSTRUCTION:

${instruction}

CURRENT WEBSITE:

${html}

Now return the COMPLETE updated HTML document.

Remember:
- Start with <!DOCTYPE html>
- Return the complete document
- Do not return markdown
- Do not return code fences
- Do not return an iframe
- Do not return object
- Do not return embed
`;

  for (
    let i = 0;
    i < GEMINI_MODELS.length;
    i++
  ) {
    const model =
      GEMINI_MODELS[i];

    try {
      console.log(
        `ZUQEN Website Editor: trying ${model}`
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
  response.text || "";

const cleaned =
  cleanHtml(text);

if (!cleaned) {
  throw new Error(
    "Gemini returned an empty response."
  );
}

return cleaned;

      console.log(
        `ZUQEN Gemini edit response length: ${text.length}`
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
        `Gemini edit ${model} failed:`,
        getErrorMessage(error)
      );

      const temporary =
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504;

      if (
        temporary &&
        i < GEMINI_MODELS.length - 1
      ) {
        await sleep(1200);
        continue;
      }

      if (!temporary) {
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
    ReturnType<
      typeof createServerSupabaseClient
    >
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
    ReturnType<
      typeof createServerSupabaseClient
    >
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
    const body =
      await request.json();

    const action =
      body?.action;

    /* -----------------------------------------------------
       ACTION VALIDATION
       ----------------------------------------------------- */

    if (
      action !== "generate" &&
      action !== "edit"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid action.",
          code:
            "invalid_action",
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
    } =
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

    if (
      action === "generate"
    ) {
      const prompt =
        typeof body.prompt ===
        "string"
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

      if (
        prompt.length > 10000
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

      console.log(
        "ZUQEN Website Builder: generating website..."
      );

      const rawHtml =
        await generateWebsite(
          prompt
        );

      const html =
        cleanHtml(rawHtml);

      if (
        !isValidHtml(html)
      ) {
        console.error(
          "Invalid Gemini HTML preview:",
          rawHtml.slice(
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

      const remaining =
        Number(
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
            used:
              GENERATE_COST,
            remaining,
          },
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
            "X-Zuqen-Credits-Remaining":
              String(
                remaining
              ),
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

    console.log(
      "ZUQEN Website Editor: editing website..."
    );

    const rawHtml =
      await editWebsite(
        html,
        instruction
      );

    const updatedHtml =
      cleanHtml(rawHtml);

    if (
      !isValidHtml(
        updatedHtml
      )
    ) {
      console.error(
        "Invalid Gemini edit HTML preview:",
        rawHtml.slice(
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

    const remaining =
      Number(
        creditResult.balance ?? 0
      );

    return NextResponse.json(
      {
        success: true,
        html: updatedHtml,
        credits: {
          used:
            EDIT_COST,
          remaining,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
          "X-Zuqen-Credits-Remaining":
            String(
              remaining
            ),
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