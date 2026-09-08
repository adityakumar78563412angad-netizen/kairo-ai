import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 300;

// =========================================================
// CONFIG
// =========================================================

const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY;

const GENERATE_CREDIT_COST = 100;
const EDIT_CREDIT_COST = 50;

const MAX_GENERATE_PROMPT_LENGTH = 10000;
const MAX_EDIT_INSTRUCTION_LENGTH = 5000;
const MAX_HTML_LENGTH = 200000;

// Gemini fallback chain
const GEMINI_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
];

if (!apiKey) {
  console.error(
    "GEMINI_API_KEY / GOOGLE_API_KEY is missing."
  );
}

const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
    })
  : null;

// =========================================================
// WEBSITE GENERATION INSTRUCTIONS
// =========================================================

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
18. Do not include iframe elements.
19. Do not include object elements.
20. Do not include embed elements.
21. Do not generate malicious code.
22. Make the website feel like a real professional product.
23. Use excellent spacing, typography, hierarchy and responsive layouts.
24. Do not make the design look like a basic coding demo.
25. Include realistic content based on the user's request.
26. The final answer must be ONLY HTML.

Keep the generated website reasonably sized.
Do not unnecessarily generate extremely large HTML.
`;

// =========================================================
// WEBSITE EDIT INSTRUCTIONS
// =========================================================

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
14. Do not add iframe elements.
15. Do not add object elements.
16. Do not add embed elements.
17. If the user asks to add a feature, actually implement it.
18. If the user asks to change colors, typography, spacing, layout or content, actually change it.
19. Do not return partial HTML.
20. Always return the complete <!DOCTYPE html> document.

Keep the edited website reasonably sized.
`;

// =========================================================
// HELPERS
// =========================================================

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

  const doctypeIndex =
    html
      .toLowerCase()
      .indexOf("<!doctype html>");

  if (doctypeIndex > 0) {
    html = html.slice(doctypeIndex);
  }

  return html.trim();
}

// =========================================================
// HTML VALIDATION
// =========================================================

function isValidHtml(html: string) {
  const lower =
    html.toLowerCase();

  if (
    !lower.includes(
      "<!doctype html>"
    )
  ) {
    return false;
  }

  if (
    !lower.includes("<html")
  ) {
    return false;
  }

  if (
    !lower.includes("</html>")
  ) {
    return false;
  }

  if (
    !lower.includes("<head")
  ) {
    return false;
  }

  if (
    !lower.includes("<body")
  ) {
    return false;
  }

  if (
    lower.includes("<iframe")
  ) {
    return false;
  }

  if (
    lower.includes("<object")
  ) {
    return false;
  }

  if (
    lower.includes("<embed")
  ) {
    return false;
  }

  return true;
}

// =========================================================
// CREDIT RESPONSE
// =========================================================

function creditsResponse(
  response: NextResponse,
  balance: number
) {
  response.headers.set(
    "X-Zuqen-Credits-Remaining",
    String(balance)
  );

  response.headers.set(
    "Cache-Control",
    "no-store, max-age=0"
  );

  return response;
}

// =========================================================
// CREDIT BALANCE
// =========================================================

async function getCreditBalance() {
  const supabase =
    await createServerSupabaseClient();

  const {
    data: {
      user,
    },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (
    userError ||
    !user
  ) {
    return {
      success: false,
      code:
        "authentication_required",
      balance: 0,
    };
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_credit_balance"
    );

  if (error) {
    console.error(
      "Credit balance error:",
      error
    );

    return {
      success: false,
      code:
        "credit_balance_error",
      balance: 0,
      error:
        error.message,
    };
  }

  return {
    success: true,
    code:
      "credit_balance_loaded",
    balance: Number(
      data ?? 0
    ),
  };
}

// =========================================================
// CREDIT RESULT
// =========================================================

type CreditResult = {
  success: boolean;
  code: string;
  balance: number | null;
  required?: number;
  amount?: number;
  error?: string;
};

// =========================================================
// CONSUME CREDITS
// =========================================================

async function consumeCredits(
  amount: number,
  agent: string,
  description: string,
  referenceId: string
): Promise<CreditResult> {
  const supabase =
    await createServerSupabaseClient();

  const {
    data: {
      user,
    },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (
    userError ||
    !user
  ) {
    return {
      success: false,
      code:
        "authentication_required",
      balance: 0,
    };
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "consume_credits",
      {
        p_amount: amount,
        p_agent: agent,
        p_description:
          description,
        p_reference_id:
          referenceId,
      }
    );

  if (error) {
    console.error(
      "Credit consumption error:",
      error
    );

    return {
      success: false,
      code:
        "credit_consumption_error",
      balance: null,
      error:
        error.message,
    };
  }

  let result: any;

  try {
    result =
      typeof data === "string"
        ? JSON.parse(data)
        : data;
  } catch {
    return {
      success: false,
      code:
        "credit_consumption_error",
      balance: null,
      error:
        "Invalid credit system response.",
    };
  }

  return {
    success:
      Boolean(
        result?.success
      ),

    code:
      result?.code ??
      "credit_consumption_error",

    balance:
      result?.balance !==
        undefined &&
      result?.balance !== null
        ? Number(
            result.balance
          )
        : null,

    required:
      result?.required !==
        undefined
        ? Number(
            result.required
          )
        : undefined,

    amount:
      result?.amount !==
        undefined
        ? Number(
            result.amount
          )
        : undefined,
  };
}

// =========================================================
// GEMINI ERROR HELPERS
// =========================================================

function getErrorStatus(
  error: unknown
) {
  if (
    typeof error === "object" &&
    error !== null
  ) {
    const e =
      error as Record<
        string,
        unknown
      >;

    if (
      typeof e.status ===
      "number"
    ) {
      return e.status;
    }

    if (
      typeof e.code ===
      "number"
    ) {
      return e.code;
    }

    if (
      typeof e.error ===
        "object" &&
      e.error !== null
    ) {
      const nested =
        e.error as Record<
          string,
          unknown
        >;

      if (
        typeof nested.code ===
        "number"
      ) {
        return nested.code;
      }
    }
  }

  const message =
    error instanceof Error
      ? error.message
      : String(error);

  if (
    message.includes(
      "503"
    ) ||
    message.includes(
      "UNAVAILABLE"
    ) ||
    message.includes(
      "high demand"
    )
  ) {
    return 503;
  }

  if (
    message.includes(
      "429"
    ) ||
    message.includes(
      "RESOURCE_EXHAUSTED"
    )
  ) {
    return 429;
  }

  return 0;
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    typeof error ===
      "string"
  ) {
    return error;
  }

  try {
    return JSON.stringify(
      error
    );
  } catch {
    return "Unknown Gemini error.";
  }
}

// =========================================================
// WAIT / RETRY
// =========================================================

function wait(
  ms: number
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

// =========================================================
// GEMINI GENERATION WITH FALLBACK
// =========================================================

async function generateWithFallback(
  contents: string,
  systemInstruction: string,
  temperature: number
) {
  if (!ai) {
    throw new Error(
      "Gemini API key is not configured."
    );
  }

  let lastError: unknown =
    null;

  for (
    let modelIndex = 0;
    modelIndex <
    GEMINI_MODELS.length;
    modelIndex++
  ) {
    const model =
      GEMINI_MODELS[
        modelIndex
      ];

    // Each model gets up to 2 attempts.
    for (
      let attempt = 1;
      attempt <= 2;
      attempt++
    ) {
      try {
        console.log(
          `ZUQEN Gemini: trying ${model}, attempt ${attempt}/2`
        );

        const response =
          await ai.models.generateContent(
            {
              model,

              contents,

              config: {
                systemInstruction,

                temperature,

                maxOutputTokens:
                  16000,
              },
            }
          );

        const text =
          response.text || "";

        if (
          !text.trim()
        ) {
          throw new Error(
            `${model} returned an empty response.`
          );
        }

        console.log(
          `ZUQEN Gemini: success with ${model}`
        );

        return text;
      } catch (error) {
        lastError =
          error;

        const status =
          getErrorStatus(
            error
          );

        const message =
          getErrorMessage(
            error
          );

        console.error(
          `ZUQEN Gemini error [${model}] attempt ${attempt}:`,
          message
        );

        // Retry temporary errors.
        if (
          status === 503 ||
          status === 429
        ) {
          if (
            attempt === 1
          ) {
            // Wait 2 seconds before retry.
            await wait(
              2000
            );

            continue;
          }

          // After 2 failed attempts,
          // move to next model.
          break;
        }

        // Other errors are not
        // useful to retry with
        // the same model.
        throw new Error(
          `Gemini request failed: ${message}`
        );
      }
    }

    console.warn(
      `ZUQEN Gemini: ${model} unavailable. Trying next model...`
    );
  }

  throw new Error(
    `All Gemini models are currently unavailable. Last error: ${getErrorMessage(
      lastError
    )}`
  );
}

// =========================================================
// GENERATE WEBSITE
// =========================================================

async function generateWebsite(
  prompt: string
) {
  const generatedText =
    await generateWithFallback(
      `
Create a complete professional website based on this request:

${prompt}
      `,
      GENERATE_SYSTEM_INSTRUCTION,
      0.7
    );

  const html =
    cleanHtml(
      generatedText
    );

  if (
    !isValidHtml(html)
  ) {
    throw new Error(
      "Gemini did not return valid HTML."
    );
  }

  if (
    html.length >
    MAX_HTML_LENGTH
  ) {
    throw new Error(
      "Generated website is too large."
    );
  }

  return html;
}

// =========================================================
// EDIT WEBSITE
// =========================================================

async function editWebsite(
  html: string,
  instruction: string
) {
  const generatedText =
    await generateWithFallback(
      `
Here is the existing website:

---------------- EXISTING WEBSITE ----------------

${html}

---------------- END WEBSITE ----------------

Now apply this user's requested change:

${instruction}

Return the complete modified website.
      `,
      EDIT_SYSTEM_INSTRUCTION,
      0.6
    );

  const updatedHtml =
    cleanHtml(
      generatedText
    );

  if (
    !isValidHtml(
      updatedHtml
    )
  ) {
    throw new Error(
      "Gemini did not return valid HTML."
    );
  }

  if (
    updatedHtml.length >
    MAX_HTML_LENGTH
  ) {
    throw new Error(
      "Edited website is too large."
    );
  }

  return updatedHtml;
}

// =========================================================
// POST API
// =========================================================

export async function POST(
  request: NextRequest
) {
  try {
    // -----------------------------------------------------
    // GEMINI API KEY
    // -----------------------------------------------------

    if (!ai) {
      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured.",
          code:
            "gemini_api_key_missing",
        },
        {
          status: 500,
        }
      );
    }

    // -----------------------------------------------------
    // AUTHENTICATION
    // -----------------------------------------------------

    const supabase =
      await createServerSupabaseClient();

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
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

    // -----------------------------------------------------
    // BODY
    // -----------------------------------------------------

    const body =
      await request.json();

    const action =
      typeof body?.action ===
      "string"
        ? body.action
        : "generate";

    // =====================================================
    // GENERATE WEBSITE
    // =====================================================

    if (
      action === "generate"
    ) {
      const prompt =
        typeof body?.prompt ===
        "string"
          ? body.prompt.trim()
          : "";

      if (!prompt) {
        return NextResponse.json(
          {
            error:
              "Website prompt is required.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        prompt.length >
        MAX_GENERATE_PROMPT_LENGTH
      ) {
        return NextResponse.json(
          {
            error:
              "Prompt is too long. Please keep it under 10,000 characters.",
          },
          {
            status: 400,
          }
        );
      }

      // ---------------------------------------------------
      // CHECK CREDIT BALANCE
      // ---------------------------------------------------

      const balanceResult =
        await getCreditBalance();

      if (
        !balanceResult.success
      ) {
        return NextResponse.json(
          {
            error:
              balanceResult.error ??
              "Unable to check credits.",
            code:
              balanceResult.code,
          },
          {
            status:
              balanceResult.code ===
              "authentication_required"
                ? 401
                : 500,
          }
        );
      }

      if (
        balanceResult.balance <
        GENERATE_CREDIT_COST
      ) {
        return NextResponse.json(
          {
            error:
              "Insufficient credits.",
            code:
              "insufficient_credits",
            required:
              GENERATE_CREDIT_COST,
            balance:
              balanceResult.balance,
          },
          {
            status: 402,
          }
        );
      }

      // ---------------------------------------------------
      // GEMINI GENERATION
      // ---------------------------------------------------

      const html =
        await generateWebsite(
          prompt
        );

      // ---------------------------------------------------
      // DEDUCT CREDITS
      // ---------------------------------------------------

      const creditResult =
        await consumeCredits(
          GENERATE_CREDIT_COST,
          "website_builder",
          "Website generation",
          crypto.randomUUID()
        );

      if (
        !creditResult.success
      ) {
        return NextResponse.json(
          {
            error:
              "Website was generated, but credits could not be deducted.",
            code:
              creditResult.code,
          },
          {
            status: 500,
          }
        );
      }

      const remaining =
        Number(
          creditResult.balance ??
            0
        );

      const response =
        NextResponse.json({
          success: true,

          action:
            "generate",

          html,

          credits: {
            cost:
              GENERATE_CREDIT_COST,

            remaining,
          },
        });

      return creditsResponse(
        response,
        remaining
      );
    }

    // =====================================================
    // EDIT WEBSITE
    // =====================================================

    if (
      action === "edit"
    ) {
      const html =
        typeof body?.html ===
        "string"
          ? body.html.trim()
          : "";

      const instruction =
        typeof body?.instruction ===
        "string"
          ? body.instruction.trim()
          : typeof body?.prompt ===
              "string"
            ? body.prompt.trim()
            : "";

      if (!html) {
        return NextResponse.json(
          {
            error:
              "Existing website HTML is required.",
          },
          {
            status: 400,
          }
        );
      }

      if (!instruction) {
        return NextResponse.json(
          {
            error:
              "Website change instruction is required.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        html.length >
        MAX_HTML_LENGTH
      ) {
        return NextResponse.json(
          {
            error:
              "Website code is too large to edit.",
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
            error:
              "Edit instruction is too long.",
          },
          {
            status: 400,
          }
        );
      }

      // ---------------------------------------------------
      // CHECK CREDITS
      // ---------------------------------------------------

      const balanceResult =
        await getCreditBalance();

      if (
        !balanceResult.success
      ) {
        return NextResponse.json(
          {
            error:
              balanceResult.error ??
              "Unable to check credits.",
            code:
              balanceResult.code,
          },
          {
            status:
              balanceResult.code ===
              "authentication_required"
                ? 401
                : 500,
          }
        );
      }

      if (
        balanceResult.balance <
        EDIT_CREDIT_COST
      ) {
        return NextResponse.json(
          {
            error:
              "Insufficient credits.",
            code:
              "insufficient_credits",
            required:
              EDIT_CREDIT_COST,
            balance:
              balanceResult.balance,
          },
          {
            status: 402,
          }
        );
      }

      // ---------------------------------------------------
      // GEMINI EDIT
      // ---------------------------------------------------

      const updatedHtml =
        await editWebsite(
          html,
          instruction
        );

      // ---------------------------------------------------
      // DEDUCT CREDITS
      // ---------------------------------------------------

      const creditResult =
        await consumeCredits(
          EDIT_CREDIT_COST,
          "website_builder",
          "Website AI edit",
          crypto.randomUUID()
        );

      if (
        !creditResult.success
      ) {
        return NextResponse.json(
          {
            error:
              "Website was edited, but credits could not be deducted.",
            code:
              creditResult.code,
          },
          {
            status: 500,
          }
        );
      }

      const remaining =
        Number(
          creditResult.balance ??
            0
        );

      const response =
        NextResponse.json({
          success: true,

          action:
            "edit",

          html:
            updatedHtml,

          credits: {
            cost:
              EDIT_CREDIT_COST,

            remaining,
          },
        });

      return creditsResponse(
        response,
        remaining
      );
    }

    // =====================================================
    // INVALID ACTION
    // =====================================================

    return NextResponse.json(
      {
        error:
          "Invalid website builder action.",
        code:
          "invalid_action",
      },
      {
        status: 400,
      }
    );
  } catch (error) {
    console.error(
      "Website Builder API error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unknown server error.";

    return NextResponse.json(
      {
        success: false,

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