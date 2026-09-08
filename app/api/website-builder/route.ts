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

const MODEL = "gemini-3.7-flash";

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
// GENERATE SYSTEM INSTRUCTION
// =========================================================

const GENERATE_SYSTEM_INSTRUCTION = `
You are ZUQEN AI Website Builder.

Generate a complete, beautiful and professional website from the user's request.

RULES:

1. Return ONLY the complete HTML document.
2. Do not use Markdown code fences.
3. Do not explain anything outside the HTML.
4. The output must start with <!DOCTYPE html>.
5. Include HTML, CSS and JavaScript in the same document.
6. Do not use npm packages.
7. Do not use external JavaScript frameworks.
8. Make the website fully responsive.
9. Make it modern, premium and professional.
10. Use semantic HTML.
11. Add polished hover effects and transitions.
12. Buttons should have sensible behavior.
13. Use accessible labels where appropriate.
14. Use CSS variables.
15. Never expose API keys or secrets.
16. Images may use images.unsplash.com or images.pexels.com.
17. Do not include iframe elements.
18. Do not include object elements.
19. Do not include embed elements.
20. Do not generate malicious code.
21. Make the result feel like a real production website.
22. Use excellent spacing, typography and hierarchy.
23. Include realistic content based on the request.
24. The final response must contain ONLY HTML.

Keep the generated website reasonably sized.
Do not unnecessarily generate extremely large HTML.
`;

// =========================================================
// EDIT SYSTEM INSTRUCTION
// =========================================================

const EDIT_SYSTEM_INSTRUCTION = `
You are ZUQEN AI, an expert website editor.

You will receive an existing complete HTML website and a requested change.

Modify the existing website according to the request.

RULES:

1. Return ONLY the complete modified HTML document.
2. Do not use Markdown code fences.
3. Do not explain anything outside the HTML.
4. Preserve the existing website unless the user requests a change.
5. Do not unnecessarily remove existing sections.
6. Preserve unrelated functionality.
7. Keep the website responsive.
8. Keep the design professional.
9. Keep HTML, CSS and JavaScript inside one HTML document.
10. Do not use npm packages.
11. Do not use external JavaScript frameworks.
12. Never expose API keys or secrets.
13. Do not generate malicious code.
14. Do not add iframe elements.
15. Do not add object elements.
16. Do not add embed elements.
17. Actually implement the requested change.
18. Return the COMPLETE HTML document.
19. The result must start with <!DOCTYPE html>.

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
// CREDIT RESPONSE HEADER
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
// GET CREDIT BALANCE
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
// CONSUME CREDITS
// =========================================================

type CreditResult = {
  success: boolean;
  code: string;
  balance: number | null;
  required?: number;
  amount?: number;
  error?: string;
};

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
// GEMINI GENERATE
// =========================================================

async function generateWebsite(
  prompt: string
) {
  if (!ai) {
    throw new Error(
      "Gemini API key is not configured."
    );
  }

  try {
    const response =
      await ai.models.generateContent({
        model: MODEL,

        contents: `
Create a complete professional website based on this request:

${prompt}
        `,

        config: {
          systemInstruction:
            GENERATE_SYSTEM_INSTRUCTION,

          temperature: 0.7,

          maxOutputTokens: 16000,
        },
      });

    const generatedText =
      response.text || "";

    if (
      !generatedText.trim()
    ) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

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
  } catch (error) {
    console.error(
      "Gemini generation error:",
      error
    );

    if (
      error instanceof Error
    ) {
      throw new Error(
        `Gemini generation failed: ${error.message}`
      );
    }

    throw new Error(
      "Gemini generation failed."
    );
  }
}

// =========================================================
// GEMINI EDIT
// =========================================================

async function editWebsite(
  html: string,
  instruction: string
) {
  if (!ai) {
    throw new Error(
      "Gemini API key is not configured."
    );
  }

  try {
    const response =
      await ai.models.generateContent({
        model: MODEL,

        contents: `
Here is the existing website:

---------------- EXISTING WEBSITE ----------------

${html}

---------------- END WEBSITE ----------------

Apply this requested change:

${instruction}

Return the complete modified website.
        `,

        config: {
          systemInstruction:
            EDIT_SYSTEM_INSTRUCTION,

          temperature: 0.6,

          maxOutputTokens: 16000,
        },
      });

    const generatedText =
      response.text || "";

    if (
      !generatedText.trim()
    ) {
      throw new Error(
        "Gemini returned an empty edited website."
      );
    }

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
  } catch (error) {
    console.error(
      "Gemini edit error:",
      error
    );

    if (
      error instanceof Error
    ) {
      throw new Error(
        `Gemini edit failed: ${error.message}`
      );
    }

    throw new Error(
      "Gemini edit failed."
    );
  }
}

// =========================================================
// POST
// =========================================================

export async function POST(
  request: NextRequest
) {
  try {
    // -----------------------------------------------------
    // API KEY
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
    // AUTH
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
    // GENERATE
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
      // CHECK CREDITS BEFORE GEMINI
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
      // GENERATE
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
          action: "generate",
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
    // EDIT
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
      // EDIT
      // ---------------------------------------------------

      const updatedHtml =
        await editWebsite(
          html,
          instruction
        );

      // ---------------------------------------------------
      // DEDUCT
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
          action: "edit",
          html: updatedHtml,
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