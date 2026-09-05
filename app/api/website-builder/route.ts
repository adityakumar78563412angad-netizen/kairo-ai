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

const GENERATE_SYSTEM_INSTRUCTION = `
You are Kairo AI Website Builder.

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
You are Kairo AI, an expert website editor.

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
    lower.includes("</html>")
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

  return updatedHtml;
}

export async function POST(
  request: NextRequest
) {
  try {
    if (!ai) {
      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured. Add GEMINI_API_KEY to your environment variables.",
        },
        { status: 500 }
      );
    }

    const body =
      await request.json();

    const action =
      typeof body?.action === "string"
        ? body.action
        : "generate";

    /*
     * -------------------------------------------------------
     * GENERATE WEBSITE
     * -------------------------------------------------------
     */

    if (action === "generate") {
      const prompt =
        typeof body?.prompt === "string"
          ? body.prompt.trim()
          : "";

      if (!prompt) {
        return NextResponse.json(
          {
            error:
              "Website prompt is required.",
          },
          { status: 400 }
        );
      }

      if (prompt.length > 10000) {
        return NextResponse.json(
          {
            error:
              "Prompt is too long. Please keep it under 10,000 characters.",
          },
          { status: 400 }
        );
      }

      const html =
        await generateWebsite(
          prompt
        );

      return NextResponse.json({
        success: true,
        action: "generate",
        html,
      });
    }

    /*
     * -------------------------------------------------------
     * EDIT EXISTING WEBSITE
     * -------------------------------------------------------
     */

    if (action === "edit") {
      const html =
        typeof body?.html === "string"
          ? body.html.trim()
          : "";

      const instruction =
        typeof body?.instruction ===
        "string"
          ? body.instruction.trim()
          : "";

      if (!html) {
        return NextResponse.json(
          {
            error:
              "Existing website HTML is required.",
          },
          { status: 400 }
        );
      }

      if (!instruction) {
        return NextResponse.json(
          {
            error:
              "Website change instruction is required.",
          },
          { status: 400 }
        );
      }

      if (html.length > 200000) {
        return NextResponse.json(
          {
            error:
              "Website code is too large to edit.",
          },
          { status: 400 }
        );
      }

      if (instruction.length > 5000) {
        return NextResponse.json(
          {
            error:
              "Edit instruction is too long.",
          },
          { status: 400 }
        );
      }

      const updatedHtml =
        await editWebsite(
          html,
          instruction
        );

      return NextResponse.json({
        success: true,
        action: "edit",
        html: updatedHtml,
      });
    }

    return NextResponse.json(
      {
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
        error:
          `Website Builder failed: ${message}`,
      },
      { status: 500 }
    );
  }
}