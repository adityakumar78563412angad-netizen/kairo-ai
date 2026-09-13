import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { recordProviderUsage } from "@/lib/provider-usage";

const GEMINI_MODEL = "gemini-3.6-flash";

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

Generate a complete, production-quality responsive website as a SINGLE HTML DOCUMENT.

IMPORTANT:
- Return ONLY the complete HTML document.
- Do not return Markdown.
- Do not wrap the HTML in code fences.
- Do not add explanations before or after the HTML.
- Start with <!DOCTYPE html>.
- Include <html>, <head>, and <body>.
- End with </html>.
- Put all CSS inside <style> tags.
- Put all JavaScript inside <script> tags.
- Do not require a build step.
- The final HTML must work when opened directly in a browser.
- Make the design modern, polished, professional and responsive.
- Use semantic HTML.
- Make desktop, tablet and mobile layouts work properly.
`;

const EDIT_SYSTEM_INSTRUCTION = `
You are an expert frontend developer editing an existing website.

You will receive an existing complete HTML document and an edit instruction.

Your task is to modify the existing website according to the instruction.

CRITICAL OUTPUT RULES:
- Return ONLY the COMPLETE updated HTML document.
- Do not return Markdown.
- Do not use code fences.
- Do not provide explanations.
- Start with <!DOCTYPE html>.
- Include the complete <html> element.
- Include the complete <head>.
- Include the complete <body>.
- End with </html>.
- Preserve all existing website content unless the requested change requires modifying it.
- Do not return only the changed section.
- Do not return a diff.
- Do not omit CSS or JavaScript from the original website.
- Keep the existing design and functionality wherever possible.
- Make the requested change fully functional.
- Ensure the final HTML is valid and can be opened directly in a browser.
- Make sure the response is NOT truncated.
`;

function cleanHtml(rawHtml: string): string {
  let html = String(rawHtml || "").trim();

  if (!html) {
    return "";
  }

  // Remove accidental Markdown code fences.
  html = html.replace(/^```html\s*/i, "");
  html = html.replace(/^```HTML\s*/i, "");
  html = html.replace(/^```\s*/i, "");
  html = html.replace(/\s*```$/i, "");

  html = html.trim();

  // Find the actual HTML document start.
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

  // Only trim content after </html> when a complete
  // closing tag actually exists.
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

  const hasDoctype = /<!doctype\s+html/i.test(html);
  const hasHtmlOpen = /<html\b/i.test(html);
  const hasHtmlClose = /<\/html\s*>/i.test(html);
  const hasHeadOpen = /<head\b/i.test(html);
  const hasBodyOpen = /<body\b/i.test(html);
  const hasBodyClose = /<\/body\s*>/i.test(html);

  return (
    hasDoctype &&
    hasHtmlOpen &&
    hasHtmlClose &&
    hasHeadOpen &&
    hasBodyOpen &&
    hasBodyClose
  );
}

function readGeminiUsage(response: any): GeminiUsage {
  const usage = response?.usageMetadata || {};

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

function getResponseText(response: any): string {
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
      // Continue to candidates.
    }
  }

  const candidates = response?.candidates;

  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const parts = candidate?.content?.parts;

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

function isLikelyTruncated(
  rawHtml: string,
  cleanedHtml: string
): boolean {
  if (!rawHtml.trim()) {
    return true;
  }

  if (!/<\/html\s*>/i.test(cleanedHtml)) {
    return true;
  }

  if (
    rawHtml.trim().length > 100 &&
    !cleanedHtml
      .trim()
      .toLowerCase()
      .endsWith("</html>")
  ) {
    return true;
  }

  return false;
}

async function saveProviderUsage(params: {
  userId: string;
  operation: WebsiteOperation;
  usage: GeminiUsage;
  status: "success";
  outputValid: boolean;
}) {
  try {
    return await recordProviderUsage({
      userId: params.userId,
      featureKey: "website_builder",
      provider: "gemini",
      model: GEMINI_MODEL,
      requestId: null,

      // provider-usage.ts does not allow "error".
      // We therefore use the supported "success" status
      // for measurement records as well.
      status: params.status,

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

export async function POST(request: Request) {
  let operation: WebsiteOperation = "generate";
  let userId = "";

  try {
    const body = await request.json();

    operation =
      body?.action === "edit"
        ? "edit"
        : "generate";

    const supabase =
      await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

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

    // Website Builder is permanently available
    // only to permanent signed-in users.
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

    const ai = new GoogleGenAI({
      apiKey,
    });

    // ========================================================
    // GENERATE
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
          promptLength: prompt.length,
          model: GEMINI_MODEL,
        }
      );

      const response =
        await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction:
              GENERATE_SYSTEM_INSTRUCTION,

            maxOutputTokens: 16000,

            temperature: 0.7,
          },
        });

      const usage =
        readGeminiUsage(response);

      const rawHtml =
        getResponseText(response);

      const html =
        cleanHtml(rawHtml);

      console.log(
        "[Website Builder] Generation result:",
        {
          rawLength: rawHtml.length,
          cleanedLength: html.length,
          promptTokens:
            usage.promptTokens,
          outputTokens:
            usage.outputTokens,
          totalTokens:
            usage.totalTokens,
        }
      );

      const outputValid =
        isValidHtml(html);

      if (!outputValid) {
        // Keep usage record for measurement,
        // but mark the metadata as invalid.
        await saveProviderUsage({
          userId,
          operation,
          usage,
          status: "success",
          outputValid: false,
        });

        console.error(
          "[Website Builder] Invalid generated HTML.",
          {
            rawLength: rawHtml.length,
            cleanedLength: html.length,
            usage,
            preview:
              rawHtml.slice(0, 500),
          }
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "Gemini returned invalid website HTML.",
            errorCode:
              "INVALID_HTML",
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
          status: "success",
          outputValid: true,
        });

      return NextResponse.json({
        success: true,
        html,
        provider: "gemini",
        feature: "website-builder",
        usage,
        providerUsageSaved:
          usageSave.success,

        // Measurement mode:
        // no ZUQEN credits are deducted.
        creditsConsumed: 0,
      });
    }

    // ========================================================
    // EDIT
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
--------------------------------------------------
${htmlInput}
--------------------------------------------------

EDIT INSTRUCTION:
--------------------------------------------------
${instruction}
--------------------------------------------------

Return the COMPLETE updated HTML document.

Do not return only the changed part.
Do not return a diff.
Do not return Markdown.
Do not use code fences.
Start with <!DOCTYPE html>.
End with </html>.
`;

    console.log(
      "[Website Builder] Starting edit:",
      {
        userId,
        htmlLength:
          htmlInput.length,
        instructionLength:
          instruction.length,
        model: GEMINI_MODEL,
      }
    );

    const response =
      await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: editPrompt,
        config: {
          systemInstruction:
            EDIT_SYSTEM_INSTRUCTION,

          // Increased from 16,000 to 32,000
          // to reduce HTML truncation.
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
      isLikelyTruncated(
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
        totalTokens:
          usage.totalTokens,
      }
    );

    if (!outputValid || truncated) {
      // We still record the Gemini usage because
      // tokens were actually consumed.
      await saveProviderUsage({
        userId,
        operation,
        usage,
        status: "success",
        outputValid: false,
      });

      console.error(
        "[Website Builder] Invalid or truncated edited HTML.",
        {
          rawLength:
            rawHtml.length,
          cleanedLength:
            html.length,
          truncated,
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
            ? "Gemini edit output was truncated. The generated website is too large for the current edit output limit."
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
        status: "success",
        outputValid: true,
      });

    return NextResponse.json({
      success: true,
      html,
      provider: "gemini",
      feature: "website-builder",
      usage,
      providerUsageSaved:
        usageSave.success,

      // Measurement mode:
      // no ZUQEN credits are deducted.
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