import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.warn(
    "Gemini API key is missing. Add GEMINI_API_KEY or GOOGLE_API_KEY to .env.local."
  );
}

const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
    })
  : null;

/*
|--------------------------------------------------------------------------
| ZUQEN WEBSITE BUILDER CREDIT CONFIG
|--------------------------------------------------------------------------
|
| IMPORTANT:
| Actual credit deduction should happen server-side.
|
| Generate = base cost
| Edit     = base cost
|
| Later we will connect these constants to your central
| Supabase credit system.
|--------------------------------------------------------------------------
*/

const GENERATE_CREDIT_COST = 100;
const EDIT_CREDIT_COST = 50;

const MAX_GENERATE_PROMPT_LENGTH = 10000;
const MAX_EDIT_INSTRUCTION_LENGTH = 5000;
const MAX_HTML_LENGTH = 200000;

const GENERATE_SYSTEM_INSTRUCTION = `
You are ZUQEN AI Website Builder.

Your job is to generate complete, beautiful, production-quality websites from a user's description.

IMPORTANT RULES:

1. Return ONLY the complete HTML document.
2. Do not use Markdown code fences.
3. Do not write explanations before or after the HTML.
4. The result must start with <!DOCTYPE html>.
5. The result must contain:
   - HTML
   - CSS inside <style>
   - JavaScript inside <script> when needed
6. Everything must work inside a single HTML file.
7. Do not depend on npm packages.
8. Do not depend on external JavaScript frameworks.
9. Make the website fully responsive.
10. Make the design modern, premium and professional.
11. Use semantic HTML.
12. Add polished hover effects, transitions and animations where appropriate.
13. Buttons and navigation should have sensible behavior.
14. Use accessible labels where appropriate.
15. Use CSS variables for reusable colors.
16. Do not expose API keys or secrets.
17. If images are needed, use safe remote images from images.unsplash.com or images.pexels.com.
18. The generated HTML must render directly inside an iframe using srcDoc.
19. Do not include iframe, object or embed elements that attempt to escape the preview.
20. Do not generate malicious code.
21. Make the website feel like a real professional product.
22. Use excellent spacing, typography, hierarchy and responsive layouts.
23. Do not make the design look like a basic coding demo.
24. Include realistic content based on the user's request.
25. The final answer must be ONLY HTML.
`;

const EDIT_SYSTEM_INSTRUCTION = `
You are ZUQEN AI, an expert website editor.

You will receive an existing complete HTML website and a user's requested change.

Your job is to modify the existing website according to the request.

IMPORTANT RULES:

1. Return ONLY the complete modified HTML document.
2. Do not use Markdown code fences.
3. Do not explain what you changed.
4. Preserve the existing website unless the user explicitly asks to change something.
5. Never unnecessarily remove existing sections.
6. Keep all existing functionality that is unrelated to the requested change.
7. Keep the website responsive.
8. Keep the design professional and polished.
9. HTML, CSS and JavaScript must remain inside the same HTML document.
10. Do not use npm packages.
11. Do not use external JavaScript frameworks.
12. Do not expose API keys or secrets.
13. Do not add malicious code.
14. The result must work directly inside an iframe using srcDoc.
15. Do not add iframe, object or embed elements that attempt to escape the preview.
16. If the user asks to add a feature, actually implement it.
17. If the user asks to change colors, typography, spacing, layout or content, actually change it.
18. Do not return partial HTML.
19. Always return the complete <!DOCTYPE html> document.
20. The final answer must be ONLY HTML.
`;

function cleanHtml(text: string) {
  let html = text.trim();

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

  const doctypeIndex = html
    .toLowerCase()
    .indexOf("<!doctype html>");

  if (doctypeIndex > 0) {
    html = html.slice(doctypeIndex);
  }

  return html.trim();
}

function isValidHtml(html: string) {
  const lower = html.toLowerCase();

  return (
    lower.includes("<!doctype html>") &&
    lower.includes("<html") &&
    lower.includes("</html>") &&
    lower.includes("<head") &&
    lower.includes("</head>") &&
    lower.includes("<body") &&
    lower.includes("</body>")
  );
}

/*
|--------------------------------------------------------------------------
| BASIC SECURITY CHECK
|--------------------------------------------------------------------------
|
| We don't allow the AI output to create an iframe/object/embed that could
| attempt to escape the preview sandbox.
|--------------------------------------------------------------------------
*/

function containsUnsafeEmbed(html: string) {
  const lower = html.toLowerCase();

  return (
    lower.includes("<iframe") ||
    lower.includes("<object") ||
    lower.includes("<embed")
  );
}

async function generateWebsite(
  prompt: string
) {
  if (!ai) {
    throw new Error(
      "Gemini API key is not configured."
    );
  }

  const response =
    await ai.models.generateContent({
      model: "gemini-3.6-flash",

      contents: `
Create a complete professional website based on this request:

${prompt}
      `,

      config: {
        systemInstruction:
          GENERATE_SYSTEM_INSTRUCTION,

        temperature: 0.7,

        maxOutputTokens: 30000,
      },
    });

  const generatedText =
    response.text || "";

  if (!generatedText.trim()) {
    throw new Error(
      "Gemini returned an empty website."
    );
  }

  const html =
    cleanHtml(generatedText);

  if (!isValidHtml(html)) {
    throw new Error(
      "Gemini did not return valid HTML."
    );
  }

  if (containsUnsafeEmbed(html)) {
    throw new Error(
      "Generated website contains an unsupported embedded element."
    );
  }

  return html;
}

async function editWebsite(
  html: string,
  instruction: string
) {
  if (!ai) {
    throw new Error(
      "Gemini API key is not configured."
    );
  }

  const response =
    await ai.models.generateContent({
      model: "gemini-3.6-flash",

      contents: `
Here is the existing website:

---------------- EXISTING WEBSITE ----------------

${html}

---------------- END WEBSITE ----------------

Now apply this user's requested change:

${instruction}

Return the complete modified website.
      `,

      config: {
        systemInstruction:
          EDIT_SYSTEM_INSTRUCTION,

        temperature: 0.6,

        maxOutputTokens: 30000,
      },
    });

  const generatedText =
    response.text || "";

  if (!generatedText.trim()) {
    throw new Error(
      "Gemini returned an empty edited website."
    );
  }

  const updatedHtml =
    cleanHtml(generatedText);

  if (!isValidHtml(updatedHtml)) {
    throw new Error(
      "Gemini did not return valid HTML."
    );
  }

  if (
    containsUnsafeEmbed(updatedHtml)
  ) {
    throw new Error(
      "Edited website contains an unsupported embedded element."
    );
  }

  return updatedHtml;
}

/*
|--------------------------------------------------------------------------
| CREDIT RESPONSE HELPER
|--------------------------------------------------------------------------
*/

function creditResponse(
  response: NextResponse,
  remaining: number | null
) {
  if (
    remaining !== null &&
    Number.isFinite(remaining)
  ) {
    response.headers.set(
      "X-Zuqen-Credits-Remaining",
      String(remaining)
    );
  }

  return response;
}

/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
*/

export async function POST(
  request: NextRequest
) {
  try {
    if (!ai) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini API key is not configured. Add GEMINI_API_KEY to your environment variables.",
        },
        { status: 500 }
      );
    }

    let body: Record<
      string,
      unknown
    >;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid JSON request.",
        },
        { status: 400 }
      );
    }

    const action =
      typeof body.action === "string"
        ? body.action
        : "generate";

    /*
    |--------------------------------------------------------------------------
    | GENERATE
    |--------------------------------------------------------------------------
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
          { status: 400 }
        );
      }

      if (
        prompt.length >
        MAX_GENERATE_PROMPT_LENGTH
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Prompt is too long. Please keep it under 10,000 characters.",
          },
          { status: 400 }
        );
      }

      /*
       * ---------------------------------------------------------------
       * CREDIT CHECK
       * ---------------------------------------------------------------
       *
       * IMPORTANT:
       * Your central Supabase credit system will be connected here.
       *
       * We intentionally DO NOT fake a deduction.
       * The server must deduct credits atomically before/after generation.
       * The exact RPC name depends on the SQL you already created.
       *
       * Current cost:
       */

      const requiredCredits =
        GENERATE_CREDIT_COST;

      /*
       * TODO:
       *
       * const creditResult =
       *   await deductCredits({
       *     request,
       *     amount: requiredCredits,
       *     agent: "website-builder",
       *     action: "generate",
       *   });
       *
       * if (!creditResult.success) {
       *   return NextResponse.json(
       *     {
       *       success: false,
       *       code: "insufficient_credits",
       *       error: "Not enough ZUQEN credits.",
       *       balance: creditResult.balance,
       *       required: requiredCredits,
       *       missing: creditResult.missing,
       *     },
       *     { status: 402 }
       *   );
       * }
       */

      const html =
        await generateWebsite(
          prompt
        );

      /*
       * ---------------------------------------------------------------
       * SUCCESS
       * ---------------------------------------------------------------
       *
       * Actual balance will be returned once the central credit
       * function is connected.
       */

      const response =
        NextResponse.json({
          success: true,
          action: "generate",
          html,
          credits: {
            cost: requiredCredits,
          },
        });

      return creditResponse(
        response,
        null
      );
    }

    /*
    |--------------------------------------------------------------------------
    | EDIT
    |--------------------------------------------------------------------------
    */

    if (action === "edit") {
      const html =
        typeof body.html === "string"
          ? body.html.trim()
          : "";

      /*
       * Frontend editor currently sends `prompt`.
       * To make the API backward compatible, we accept BOTH:
       *
       * prompt
       * instruction
       */

      const instruction =
        typeof body.instruction ===
        "string"
          ? body.instruction.trim()
          : typeof body.prompt ===
            "string"
          ? body.prompt.trim()
          : "";

      if (!html) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Existing website HTML is required.",
          },
          { status: 400 }
        );
      }

      if (!instruction) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Website change instruction is required.",
          },
          { status: 400 }
        );
      }

      if (
        html.length >
        MAX_HTML_LENGTH
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Website code is too large to edit.",
          },
          { status: 400 }
        );
      }

      if (
        instruction.length >
        MAX_EDIT_INSTRUCTION_LENGTH
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Edit instruction is too long.",
          },
          { status: 400 }
        );
      }

      /*
       * ---------------------------------------------------------------
       * CREDIT CHECK
       * ---------------------------------------------------------------
       */

      const requiredCredits =
        EDIT_CREDIT_COST;

      /*
       * TODO:
       *
       * const creditResult =
       *   await deductCredits({
       *     request,
       *     amount: requiredCredits,
       *     agent: "website-builder",
       *     action: "edit",
       *   });
       *
       * if (!creditResult.success) {
       *   return NextResponse.json(
       *     {
       *       success: false,
       *       code: "insufficient_credits",
       *       error: "Not enough ZUQEN credits.",
       *       balance: creditResult.balance,
       *       required: requiredCredits,
       *       missing: creditResult.missing,
       *     },
       *     { status: 402 }
       *   );
       * }
       */

      const updatedHtml =
        await editWebsite(
          html,
          instruction
        );

      const response =
        NextResponse.json({
          success: true,
          action: "edit",
          html: updatedHtml,
          credits: {
            cost: requiredCredits,
          },
        });

      return creditResponse(
        response,
        null
      );
    }

    /*
    |--------------------------------------------------------------------------
    | INVALID ACTION
    |--------------------------------------------------------------------------
    */

    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid website builder action.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "Website Builder Gemini error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unknown Gemini API error.";

    return NextResponse.json(
      {
        success: false,
        error:
          `Website Builder failed: ${message}`,
      },
      { status: 500 }
    );
  }
}