import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { recordProviderUsage } from "@/lib/provider-usage";

const GEMINI_MODEL = "gemini-3.6-flash";

// Measurement/testing mode:
// Website Builder credits are NOT deducted yet.
// We only record actual Gemini token usage.

type WebsiteOperation = "generate" | "edit";

type GeminiUsage = {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  thoughtsTokens: number;
  cachedTokens: number;
};

const GENERATE_SYSTEM_INSTRUCTION = `
You are an expert professional web designer and frontend developer.

Generate a complete, production-quality, responsive website as ONE SINGLE HTML DOCUMENT.

CRITICAL OUTPUT REQUIREMENTS:
- Return ONLY the complete HTML document.
- Do NOT return Markdown.
- Do NOT use code fences.
- Do NOT add explanations before or after the HTML.
- Start the response with <!DOCTYPE html>.
- Include a complete <html> element.
- Include a complete <head> element.
- Include a complete <body> element.
- End the response with </html>.
- Put CSS inside <style> tags.
- Put JavaScript inside <script> tags.
- The website must work directly when opened in a browser.
- Do not require React, Next.js, npm, a build process, or external compilation.
- Use semantic HTML.
- Make the website modern, polished, professional and visually attractive.
- Make it fully responsive for desktop, tablet and mobile.
- Implement all requested sections and functionality.
- Do not stop early.
- Do not summarize the website.
- Do not provide commentary.
- Before finishing your response, ensure that the complete document ends with </html>.
`;

const EDIT_SYSTEM_INSTRUCTION = `
You are an expert professional frontend developer.

You will receive an existing complete HTML website and an edit instruction.

Modify the existing website according to the instruction.

CRITICAL OUTPUT REQUIREMENTS:
- Return ONLY the COMPLETE updated HTML document.
- Do NOT return Markdown.
- Do NOT use code fences.
- Do NOT provide explanations.
- Do NOT return a diff.
- Do NOT return only the changed section.
- Do NOT omit the existing CSS.
- Do NOT omit the existing JavaScript.
- Preserve the existing website content and functionality unless the requested change requires modification.
- Start with <!DOCTYPE html>.
- Include the complete <html> element.
- Include the complete <head> element.
- Include the complete <body> element.
- End with </html>.
- Ensure the final response is complete and NOT truncated.
- The resulting HTML must work directly in a browser.
`;

function cleanHtml(rawHtml: string): string {
  let html = String(rawHtml || "").trim();

  if (!html) {
    return "";
  }

  // Remove accidental Markdown fences.
  html = html.replace(/^```html\s*/i, "");
  html = html.replace(/^```HTML\s*/i, "");
  html = html.replace(/^```\s*/i, "");
  html = html.replace(/\s*```$/i, "");

  html = html.trim();

  // Find the beginning of the actual HTML document.
  const doctypeIndex = html.search(/<!doctype\s+html/i);
  const htmlTagIndex = html.search(/<html\b/i);

  let startIndex = -1;

  if (doctypeIndex >= 0) {
    startIndex = doctypeIndex;
  } else if (htmlTagIndex >= 0) {
    startIndex = htmlTagIndex;
  }

  if (startIndex >= 0) {
    html = html.slice(startIndex);
  }

  // If a complete closing </html> exists, remove anything after it.
  const closingHtmlMatch = html.match(/<\/html\s*>/i);

  if (
    closingHtmlMatch &&
    closingHtmlMatch.index !== undefined
  ) {
    const endIndex =
      closingHtmlMatch.index +
      closingHtmlMatch[0].length;

    html = html.slice(0, endIndex);
  }

  return html.trim();
}

function isValidHtml(html: string): boolean {
  if (!html || html.length < 20) {
    return false;
  }

  const hasDoctype =
    /<!doctype\s+html/i.test(html);

  const hasHtmlOpen =
    /<html\b/i.test(html);

  const hasHtmlClose =
    /<\/html\s*>/i.test(html);

  const hasHeadOpen =
    /<head\b/i.test(html);

  const hasBodyOpen =
    /<body\b/i.test(html);

  const hasBodyClose =
    /<\/body\s*>/i.test(html);

  return (
    hasDoctype &&
    hasHtmlOpen &&
    hasHtmlClose &&
    hasHeadOpen &&
    hasBodyOpen &&
    hasBodyClose
  );
}

function isTruncatedHtml(
  rawHtml: string,
  cleanedHtml: string
): boolean {
  if (!rawHtml.trim()) {
    return true;
  }

  // Missing </html> is the strongest indication
  // that Gemini stopped before completing the document.
  if (!/<\/html\s*>/i.test(cleanedHtml)) {
    return true;
  }

  // Also check whether the cleaned document actually
  // ends with the closing HTML tag.
  if (
    !cleanedHtml
      .trim()
      .toLowerCase()
      .endsWith("</html>")
  ) {
    return true;
  }

  return false;
}

function readGeminiUsage(
  response: any
): GeminiUsage {
  const usage =
    response?.usageMetadata || {};

  const promptTokens = Number(
    usage.promptTokenCount || 0
  );

  const outputTokens = Number(
    usage.candidatesTokenCount || 0
  );

  const thoughtsTokens = Number(
    usage.thoughtsTokenCount || 0
  );

  const cachedTokens = Number(
    usage.cachedContentTokenCount || 0
  );

  const totalTokens = Number(
    usage.totalTokenCount ||
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

function getResponseText(
  response: any
): string {
  if (typeof response?.text === "string") {
    return response.text;
  }

  if (typeof response?.text === "function") {
    try {
      const text = response.text();

      if (typeof text === "string") {
        return text;
      }
    } catch {
      // Continue with candidates.
    }
  }

  const candidates =
    response?.candidates;

  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const parts =
        candidate?.content?.parts;

      if (!Array.isArray(parts)) {
        continue;
      }

      const text = parts
        .map((part: any) =>
          typeof part?.text === "string"
            ? part.text
            : ""
        )
        .join("");

      if (text.trim()) {
        return text;
      }
    }
  }

  return "";
}

async function saveProviderUsage(params: {
  userId: string;
  operation: WebsiteOperation;
  usage: GeminiUsage;
  outputValid: boolean;
}) {
  try {
    return await recordProviderUsage({
      userId: params.userId,
      featureKey: "website_builder",
      provider: "gemini",
      model: GEMINI_MODEL,
      requestId: null,

      // provider-usage.ts currently supports
      // "success" here, so we keep the record compatible.
      status: "success",

      inputUnits:
        params.usage.promptTokens,

      outputUnits:
        params.usage.outputTokens,

      totalUnits:
        params.usage.totalTokens,

      unitType: "tokens",

      metadata: {
        operation: params.operation,
        outputValid:
          params.outputValid,

        promptTokens:
          params.usage.promptTokens,

        outputTokens:
          params.usage.outputTokens,

        totalTokens:
          params.usage.totalTokens,

        thoughtsTokens:
          params.usage.thoughtsTokens,

        cachedTokens:
          params.usage.cachedTokens,

        usageAvailable:
          params.usage.totalTokens > 0,
      },
    });
  } catch (error) {
    console.error(
      "[Website Builder] Failed to save provider usage:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save provider usage",
    };
  }
}

export async function POST(
  request: Request
) {
  let operation: WebsiteOperation =
    "generate";

  let userId = "";

  try {
    const body =
      await request.json();

    operation =
      body?.action === "edit"
        ? "edit"
        : "generate";

    const supabase =
      await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Please sign in to use Website Builder.",
        },
        { status: 401 }
      );
    }

    userId = user.id;

    // Website Builder is permanently restricted
    // to permanent signed-in accounts.
    if (user.is_anonymous) {
      return NextResponse.json(
        {
          success: false,
          code: "SIGN_IN_REQUIRED",
          message:
            "Please sign in to use Website Builder.",
        },
        { status: 403 }
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Gemini API key is not configured.",
        },
        { status: 500 }
      );
    }

    const ai =
      new GoogleGenAI({
        apiKey,
      });

    // ========================================================
    // GENERATE WEBSITE
    // ========================================================

    if (operation === "generate") {
      const prompt =
        typeof body?.prompt === "string"
          ? body.prompt.trim()
          : "";

      if (!prompt) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Website prompt is required.",
          },
          { status: 400 }
        );
      }

      if (prompt.length > 10000) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Website prompt is too long. Please keep it under 10,000 characters.",
          },
          { status: 400 }
        );
      }

      console.log(
        "[Website Builder] Starting generation:",
        {
          userId,
          promptLength:
            prompt.length,
          model:
            GEMINI_MODEL,
        }
      );

      const response =
        await ai.models.generateContent({
          model: GEMINI_MODEL,

          contents: prompt,

          config: {
            systemInstruction:
              GENERATE_SYSTEM_INSTRUCTION,

            // Increased from 16,000 to 32,000.
            // This gives Gemini much more room to
            // finish a complete website.
            maxOutputTokens: 32000,

            temperature: 0.7,
          },
        });

      const usage =
        readGeminiUsage(response);

      const rawHtml =
        getResponseText(response);

      const html =
        cleanHtml(rawHtml);

      const truncated =
        isTruncatedHtml(
          rawHtml,
          html
        );

      const outputValid =
        isValidHtml(html);

      console.log(
        "[Website Builder] Generation result:",
        {
          rawLength:
            rawHtml.length,

          cleanedLength:
            html.length,

          truncated,

          outputValid,

          promptTokens:
            usage.promptTokens,

          outputTokens:
            usage.outputTokens,

          thoughtsTokens:
            usage.thoughtsTokens,

          totalTokens:
            usage.totalTokens,
        }
      );

      if (!outputValid || truncated) {
        await saveProviderUsage({
          userId,
          operation,
          usage,
          outputValid: false,
        });

        console.error(
          "[Website Builder] Generation output invalid or truncated:",
          {
            rawLength:
              rawHtml.length,

            cleanedLength:
              html.length,

            truncated,

            outputValid,

            usage,

            preview:
              rawHtml.slice(0, 500),

            ending:
              rawHtml.slice(-500),
          }
        );

        return NextResponse.json(
          {
            success: false,

            message: truncated
              ? "Gemini generation output was truncated before the complete HTML document was finished. Please try generating again."
              : "Gemini returned invalid website HTML.",

            errorCode: truncated
              ? "GENERATE_OUTPUT_TRUNCATED"
              : "INVALID_HTML",

            usage,
          },
          { status: 502 }
        );
      }

      const usageSave =
        await saveProviderUsage({
          userId,
          operation,
          usage,
          outputValid: true,
        });

      return NextResponse.json({
        success: true,

        html,

        provider: "gemini",

        feature:
          "website-builder",

        usage,

        providerUsageSaved:
          usageSave.success,

        // Measurement mode:
        // No ZUQEN credits are deducted.
        creditsConsumed: 0,
      });
    }

    // ========================================================
    // EDIT WEBSITE
    // ========================================================

    const htmlInput =
      typeof body?.html === "string"
        ? body.html.trim()
        : "";

    const instruction =
      typeof body?.instruction === "string"
        ? body.instruction.trim()
        : "";

    if (!htmlInput) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Existing website HTML is required.",
        },
        { status: 400 }
      );
    }

    if (!instruction) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Edit instruction is required.",
        },
        { status: 400 }
      );
    }

    if (htmlInput.length > 500000) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Website HTML is too large to edit.",
        },
        { status: 400 }
      );
    }

    if (instruction.length > 5000) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Edit instruction is too long. Please keep it under 5,000 characters.",
        },
        { status: 400 }
      );
    }

    const editPrompt = `
EXISTING WEBSITE HTML:
==================================================
${htmlInput}
==================================================

EDIT INSTRUCTION:
==================================================
${instruction}
==================================================

Now modify the existing website.

Return the COMPLETE updated HTML document.

Do not return a diff.
Do not return only the changed section.
Do not return Markdown.
Do not use code fences.

Start with:
<!DOCTYPE html>

Finish with:
</html>

Preserve all existing content, styling and functionality that is not related to the requested edit.
`;

    console.log(
      "[Website Builder] Starting edit:",
      {
        userId,

        htmlLength:
          htmlInput.length,

        instructionLength:
          instruction.length,

        model:
          GEMINI_MODEL,
      }
    );

    const response =
      await ai.models.generateContent({
        model: GEMINI_MODEL,

        contents: editPrompt,

        config: {
          systemInstruction:
            EDIT_SYSTEM_INSTRUCTION,

          // Keep the increased edit limit as well.
          maxOutputTokens: 32000,

          temperature: 0.4,
        },
      });

    const usage =
      readGeminiUsage(response);

    const rawHtml =
      getResponseText(response);

    const html =
      cleanHtml(rawHtml);

    const truncated =
      isTruncatedHtml(
        rawHtml,
        html
      );

    const outputValid =
      isValidHtml(html);

    console.log(
      "[Website Builder] Edit result:",
      {
        rawLength:
          rawHtml.length,

        cleanedLength:
          html.length,

        truncated,

        outputValid,

        promptTokens:
          usage.promptTokens,

        outputTokens:
          usage.outputTokens,

        thoughtsTokens:
          usage.thoughtsTokens,

        totalTokens:
          usage.totalTokens,
      }
    );

    if (!outputValid || truncated) {
      await saveProviderUsage({
        userId,
        operation,
        usage,
        outputValid: false,
      });

      console.error(
        "[Website Builder] Edit output invalid or truncated:",
        {
          rawLength:
            rawHtml.length,

          cleanedLength:
            html.length,

          truncated,

          outputValid,

          usage,

          preview:
            rawHtml.slice(0, 500),

          ending:
            rawHtml.slice(-500),
        }
      );

      return NextResponse.json(
        {
          success: false,

          message: truncated
            ? "Gemini edit output was truncated before the complete HTML document was finished. Please try the edit again."
            : "Gemini returned invalid edited HTML.",

          errorCode: truncated
            ? "EDIT_OUTPUT_TRUNCATED"
            : "INVALID_EDITED_HTML",

          usage,
        },
        { status: 502 }
      );
    }

    const usageSave =
      await saveProviderUsage({
        userId,
        operation,
        usage,
        outputValid: true,
      });

    return NextResponse.json({
      success: true,

      html,

      provider: "gemini",

      feature:
        "website-builder",

      usage,

      providerUsageSaved:
        usageSave.success,

      // Measurement mode:
      // No ZUQEN credits are deducted.
      creditsConsumed: 0,
    });
  } catch (error: any) {
    console.error(
      "[Website Builder] API error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Website Builder request failed.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}