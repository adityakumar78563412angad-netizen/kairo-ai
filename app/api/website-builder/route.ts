
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

const SYSTEM_INSTRUCTION = `
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
9. Make the website responsive.
10. Make the design modern and professional.
11. Use semantic HTML.
12. Add hover effects, animations and polished UI where appropriate.
13. Buttons and navigation should have sensible behavior.
14. Use accessible labels where appropriate.
15. Use CSS variables for reusable colors.
16. Do not expose API keys or secrets.
17. If images are needed, use safe remote placeholder images such as images.unsplash.com or images.pexels.com.
18. Make sure the generated HTML can be rendered directly inside an iframe using srcDoc.
19. Do not include iframe, object or embed elements that attempt to escape the preview.
20. Do not generate malicious code.
21. The final answer must be ONLY HTML.

The website should feel like a real professional website, not a basic demo.
`;

function cleanHtml(text: string) {
  let html = text.trim();

  if (html.startsWith("```html")) {
    html = html.replace(/^```html\s*/i, "");
  }

  if (html.startsWith("```")) {
    html = html.replace(/^```\s*/i, "");
  }

  if (html.endsWith("```")) {
    html = html.replace(/\s*```$/i, "");
  }

  const doctypeIndex = html
    .toLowerCase()
    .indexOf("<!doctype html>");

  if (doctypeIndex > 0) {
    html = html.slice(doctypeIndex);
  }

  return html.trim();
}

export async function POST(
  request: NextRequest
) {
  try {
    if (!ai) {
      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured. Add GEMINI_API_KEY to .env.local and restart the development server.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

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

    const response =
      await ai.models.generateContent({
        model:
          "gemini-2.5-flash",
        contents: `
Create a complete website based on this user request:

${prompt}
        `,
        config: {
          systemInstruction:
            SYSTEM_INSTRUCTION,

          temperature: 0.7,

          maxOutputTokens: 30000,
        },
      });

    const generatedText =
      response.text || "";

    if (!generatedText.trim()) {
      return NextResponse.json(
        {
          error:
            "Gemini returned an empty website.",
        },
        { status: 502 }
      );
    }

    const html =
      cleanHtml(generatedText);

    if (
      !html
        .toLowerCase()
        .includes("<html")
    ) {
      return NextResponse.json(
        {
          error:
            "Gemini did not return valid HTML.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      html,
    });
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
          `Website generation failed: ${message}`,
      },
      { status: 500 }
    );
  }
}

