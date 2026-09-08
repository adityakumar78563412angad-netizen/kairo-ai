import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { createServerSupabaseClient } from "@/lib/supabase-server";

export const maxDuration = 300;

const GEMINI_MODEL = "gemini-3.6-flash";

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

function getErrorStatus(
  error: unknown
): number | null {
  const message =
    getErrorMessage(error);

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
    const status =
      (error as {
        status?: unknown;
      }).status;

    if (
      typeof status === "number"
    ) {
      return status;
    }
  }

  return null;
}

/* =========================================================
   GEMINI USAGE
   ========================================================= */

type GeminiUsage = {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  thoughtsTokens: number;
  cachedTokens: number;
};

function readGeminiUsage(
  response: any
): GeminiUsage {
  const usage =
    response?.usageMetadata;

  const promptTokens =
    Number(
      usage?.promptTokenCount ?? 0
    );

  const outputTokens =
    Number(
      usage?.candidatesTokenCount ?? 0
    );

  const thoughtsTokens =
    Number(
      usage?.thoughtsTokenCount ?? 0
    );

  const cachedTokens =
    Number(
      usage?.cachedContentTokenCount ?? 0
    );

  const totalTokens =
    Number(
      usage?.totalTokenCount ??
        promptTokens +
          outputTokens +
          thoughtsTokens
    );

  return {
    promptTokens,
    outputTokens,
    totalTokens,
    thoughtsTokens,
    cachedTokens,
  };
}

/* =========================================================
   HTML CLEANER
   ========================================================= */

function cleanHtml(
  text: string
): string {
  let html = text.trim();

  if (!html) {
    return "";
  }

  // Remove markdown code fences.
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

  // Remove accidental text before HTML.
  const doctypeIndex =
    html.search(
      /<!doctype\s+html>/i
    );

  const htmlIndex =
    html.search(
      /<html[\s>]/i
    );

  if (doctypeIndex !== -1) {
    html =
      html.slice(
        doctypeIndex
      );
  } else if (
    htmlIndex !== -1
  ) {
    html =
      `<!DOCTYPE html>\n${html.slice(
        htmlIndex
      )}`;
  }

  // Remove anything after </html>.
  const closingHtmlIndex =
    html
      .toLowerCase()
      .lastIndexOf(
        "</html>"
      );

  if (
    closingHtmlIndex !== -1
  ) {
    html =
      html.slice(
        0,
        closingHtmlIndex +
          "</html>".length
      );
  }

  return html.trim();
}

/* =========================================================
   HTML VALIDATOR
   ========================================================= */

function isValidHtml(
  html: string
): boolean {
  const value =
    html.trim();

  if (!value) {
    return false;
  }

  const hasHtmlOpen =
    /<html[\s>]/i.test(
      value
    );

  const hasHtmlClose =
    /<\/html>/i.test(
      value
    );

  if (
    !hasHtmlOpen ||
    !hasHtmlClose
  ) {
    return false;
  }

  const hasHeadOpen =
    /<head[\s>]/i.test(
      value
    );

  const hasHeadClose =
    /<\/head>/i.test(
      value
    );

  if (
    !hasHeadOpen ||
    !hasHeadClose
  ) {
    return false;
  }

  const hasBodyOpen =
    /<body[\s>]/i.test(
      value
    );

  const hasBodyClose =
    /<\/body>/i.test(
      value
    );

  if (
    !hasBodyOpen ||
    !hasBodyClose
  ) {
    return false;
  }

  if (
    /<iframe\b/i.test(
      value
    )
  ) {
    return false;
  }

  if (
    /<object\b/i.test(
      value
    )
  ) {
    return false;
  }

  if (
    /<embed\b/i.test(
      value
    )
  ) {
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
   GENERATE WEBSITE
   ========================================================= */

async function generateWebsite(
  prompt: string
): Promise<{
  html: string;
  usage: GeminiUsage;
}> {
  const ai = getGemini();

  try {
    console.log(
      `ZUQEN Website Builder: using ${GEMINI_MODEL}`
    );

    const response =
      await ai.models.generateContent({
        model: GEMINI_MODEL,

        contents: `
WEBSITE REQUEST:

${prompt}

Generate the complete website now.

Return ONLY the complete HTML document.
`,

        config: {
          systemInstruction:
            GENERATE_SYSTEM_INSTRUCTION,

          maxOutputTokens: 16000,
        },
      });

    const text =
      response.text || "";

    console.log(
      `ZUQEN Gemini response length: ${text.length}`
    );

    if (!text.trim()) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    const cleaned =
      cleanHtml(text);

    console.log(
      `ZUQEN cleaned HTML length: ${cleaned.length}`
    );

    const usage =
      readGeminiUsage(
        response
      );

    console.log(
      "ZUQEN GEMINI USAGE:",
      usage
    );

    return {
      html: cleaned,
      usage,
    };
  } catch (error) {
    console.error(
      "Gemini generation error:",
      getErrorMessage(error)
    );

    const status =
      getErrorStatus(error);

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
      `Gemini generation failed: ${getErrorMessage(
        error
      )}`
    );
  }
}

/* =========================================================
   EDIT WEBSITE
   ========================================================= */

async function editWebsite(
  html: string,
  instruction: string
): Promise<{
  html: string;
  usage: GeminiUsage;
}> {
  const ai = getGemini();

  try {
    console.log(
      `ZUQEN Website Editor: using ${GEMINI_MODEL}`
    );

    const response =
      await ai.models.generateContent({
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
          systemInstruction:
            EDIT_SYSTEM_INSTRUCTION,

          maxOutputTokens: 16000,
        },
      });

    const text =
      response.text || "";

    console.log(
      `ZUQEN Gemini edit response length: ${text.length}`
    );

    if (!text.trim()) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    const cleaned =
      cleanHtml(text);

    console.log(
      `ZUQEN cleaned edit HTML length: ${cleaned.length}`
    );

    const usage =
      readGeminiUsage(
        response
      );

    console.log(
      "ZUQEN GEMINI EDIT USAGE:",
      usage
    );

    return {
      html: cleaned,
      usage,
    };
  } catch (error) {
    console.error(
      "Gemini edit error:",
      getErrorMessage(error)
    );

    const status =
      getErrorStatus(error);

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
      `Gemini edit failed: ${getErrorMessage(
        error
      )}`
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

  if (
    error ||
    !user
  ) {
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
      user,
    } =
      await getAuthenticatedSupabase();

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

      const result =
        await generateWebsite(
          prompt
        );

      /* ---------------------------------------------------
         VALIDATE GENERATED HTML
         --------------------------------------------------- */

      if (
        !isValidHtml(
          result.html
        )
      ) {
        console.error(
          "Invalid Gemini HTML preview:",
          result.html.slice(
            0,
            3000
          )
        );

        return NextResponse.json(
          {
            error:
              "Gemini did not return valid HTML.",

            code:
              "invalid_html",

            geminiUsage:
              result.usage,
          },
          {
            status: 502,
          }
        );
      }

      console.log(
        "ZUQEN WEBSITE GENERATED",
        {
          userId:
            user.id,

          geminiModel:
            GEMINI_MODEL,

          geminiUsage:
            result.usage,
        }
      );

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
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "no-store, max-age=0",

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

    const result =
      await editWebsite(
        html,
        instruction
      );

    /* ---------------------------------------------------
       VALIDATE EDITED HTML
       --------------------------------------------------- */

    if (
      !isValidHtml(
        result.html
      )
    ) {
      console.error(
        "Invalid Gemini edit HTML preview:",
        result.html.slice(
          0,
          3000
        )
      );

      return NextResponse.json(
        {
          error:
            "Gemini did not return valid HTML.",

          code:
            "invalid_html",

          geminiUsage:
            result.usage,
        },
        {
          status: 502,
        }
      );
    }

    console.log(
      "ZUQEN WEBSITE EDITED",
      {
        userId:
          user.id,

        geminiModel:
          GEMINI_MODEL,

        geminiUsage:
          result.usage,
      }
    );

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
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",

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
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "ZUQEN Website Builder API error:",
      error
    );

    const message =
      getErrorMessage(
        error
      );

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
        error:
          message,

        code:
          "website_builder_error",
      },
      {
        status: 500,
      }
    );
  }
}