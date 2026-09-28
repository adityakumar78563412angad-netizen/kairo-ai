export type DocumentFormat =
  | "markdown"
  | "html"
  | "text";

export type DocumentSection = {
  heading?: string;
  content: string;
};

export type DocumentInput = {
  title?: string;
  content?: string;
  sections?: DocumentSection[];
  format?: DocumentFormat;
  filename?: string;
  author?: string;
  description?: string;
};

export type DocumentOutput = {
  title: string;
  format: DocumentFormat;
  filename: string;
  mime_type: string;
  content: string;
  size_bytes: number;
};

const MAX_TITLE_LENGTH = 300;
const MAX_AUTHOR_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_CONTENT_LENGTH = 100000;
const MAX_SECTIONS = 100;
const MAX_SECTION_HEADING_LENGTH = 300;
const MAX_SECTION_CONTENT_LENGTH = 50000;

function normalizeString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function truncate(
  value: string,
  maxLength: number
): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function normalizeFormat(
  value: unknown
): DocumentFormat {
  if (value === "html") {
    return "html";
  }

  if (value === "text") {
    return "text";
  }

  return "markdown";
}

function sanitizeFilename(
  value: unknown,
  format: DocumentFormat
): string {
  const raw = normalizeString(value);

  const fallback =
    format === "html"
      ? "document.html"
      : format === "text"
        ? "document.txt"
        : "document.md";

  if (!raw) {
    return fallback;
  }

  let filename = raw
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .trim();

  if (!filename) {
    return fallback;
  }

  const expectedExtension =
    format === "html"
      ? ".html"
      : format === "text"
        ? ".txt"
        : ".md";

  const lowerFilename =
    filename.toLowerCase();

  if (
    lowerFilename.endsWith(".md") ||
    lowerFilename.endsWith(".html") ||
    lowerFilename.endsWith(".txt")
  ) {
    return filename;
  }

  filename += expectedExtension;

  return filename;
}

function escapeHtml(
  value: string
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeMarkdownText(
  value: string
): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function normalizeSections(
  input: DocumentInput
): DocumentSection[] {
  const sections: DocumentSection[] = [];

  if (Array.isArray(input.sections)) {
    for (
      const rawSection of input.sections
        .slice(0, MAX_SECTIONS)
    ) {
      if (
        !rawSection ||
        typeof rawSection !== "object"
      ) {
        continue;
      }

      const section =
        rawSection as Record<
          string,
          unknown
        >;

      const heading =
        truncate(
          normalizeString(
            section.heading
          ),
          MAX_SECTION_HEADING_LENGTH
        );

      const content =
        truncate(
          normalizeString(
            section.content
          ),
          MAX_SECTION_CONTENT_LENGTH
        );

      if (!content) {
        continue;
      }

      sections.push({
        heading:
          heading || undefined,
        content,
      });
    }
  }

  const directContent =
    normalizeString(input.content);

  if (
    directContent &&
    sections.length === 0
  ) {
    sections.push({
      content: truncate(
        directContent,
        MAX_CONTENT_LENGTH
      ),
    });
  }

  return sections;
}

function buildMarkdown(
  title: string,
  sections: DocumentSection[],
  author: string,
  description: string
): string {
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push("");

  if (description) {
    lines.push(description);
    lines.push("");
  }

  if (author) {
    lines.push(`**Author:** ${author}`);
    lines.push("");
  }

  for (
    const section of sections
  ) {
    if (section.heading) {
      lines.push(
        `## ${section.heading}`
      );
      lines.push("");
    }

    lines.push(
      escapeMarkdownText(
        section.content
      )
    );

    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function buildText(
  title: string,
  sections: DocumentSection[],
  author: string,
  description: string
): string {
  const lines: string[] = [];

  lines.push(title);
  lines.push("=".repeat(
    Math.min(title.length, 120)
  ));
  lines.push("");

  if (description) {
    lines.push(description);
    lines.push("");
  }

  if (author) {
    lines.push(`Author: ${author}`);
    lines.push("");
  }

  for (
    const section of sections
  ) {
    if (section.heading) {
      lines.push(section.heading);
      lines.push("-".repeat(
        Math.min(
          section.heading.length,
          120
        )
      ));
      lines.push("");
    }

    lines.push(
      escapeMarkdownText(
        section.content
      )
    );

    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function buildHtml(
  title: string,
  sections: DocumentSection[],
  author: string,
  description: string
): string {
  const sectionHtml =
    sections
      .map((section) => {
        const heading =
          section.heading
            ? `<h2>${escapeHtml(
                section.heading
              )}</h2>`
            : "";

        const paragraphs =
          escapeHtml(
            section.content
          )
            .split(/\n{2,}/)
            .map(
              (paragraph) =>
                `<p>${paragraph
                  .replace(
                    /\n/g,
                    "<br />"
                  )
                  .trim()}</p>`
            )
            .join("\n");

        return `${heading}\n${paragraphs}`;
      })
      .join("\n");

  const metadata =
    author || description
      ? `
        <div class="metadata">
          ${
            author
              ? `<p><strong>Author:</strong> ${escapeHtml(
                  author
                )}</p>`
              : ""
          }
          ${
            description
              ? `<p>${escapeHtml(
                  description
                )}</p>`
              : ""
          }
        </div>
      `
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
    }

    body {
      margin: 0;
      padding: 48px;
      background: #ffffff;
      color: #111827;
      font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
      line-height: 1.7;
    }

    main {
      max-width: 900px;
      margin: 0 auto;
    }

    h1 {
      margin-bottom: 12px;
      font-size: 36px;
      line-height: 1.2;
    }

    h2 {
      margin-top: 36px;
      margin-bottom: 12px;
      font-size: 24px;
      line-height: 1.3;
    }

    p {
      margin: 0 0 16px;
      white-space: normal;
    }

    .metadata {
      margin: 24px 0 32px;
      padding: 16px 20px;
      border-left: 4px solid #d1d5db;
      background: #f9fafb;
    }

    .metadata p {
      margin-bottom: 6px;
    }

    .metadata p:last-child {
      margin-bottom: 0;
    }

    @media print {
      body {
        padding: 24px;
      }
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    ${metadata}
    ${sectionHtml}
  </main>
</body>
</html>
`;
}

export async function executeDocument(
  input: DocumentInput
): Promise<{
  success: boolean;
  output?: DocumentOutput;
  error?: string;
  errorCode?: string;
}> {
  try {
    if (
      !input ||
      typeof input !== "object"
    ) {
      return {
        success: false,
        error:
          "Document input is required.",
        errorCode:
          "DOCUMENT_INPUT_REQUIRED",
      };
    }

    const title =
      truncate(
        normalizeString(input.title) ||
          "ZUQEN Automation Document",
        MAX_TITLE_LENGTH
      );

    const author =
      truncate(
        normalizeString(input.author),
        MAX_AUTHOR_LENGTH
      );

    const description =
      truncate(
        normalizeString(
          input.description
        ),
        MAX_DESCRIPTION_LENGTH
      );

    const format =
      normalizeFormat(input.format);

    const sections =
      normalizeSections(input);

    if (sections.length === 0) {
      return {
        success: false,
        error:
          "Document content or sections are required.",
        errorCode:
          "DOCUMENT_CONTENT_REQUIRED",
      };
    }

    const totalContentLength =
      sections.reduce(
        (total, section) =>
          total +
          section.content.length +
          (section.heading?.length ??
            0),
        0
      );

    if (
      totalContentLength >
      MAX_CONTENT_LENGTH
    ) {
      return {
        success: false,
        error:
          "Document content is too large.",
        errorCode:
          "DOCUMENT_CONTENT_TOO_LARGE",
      };
    }

    let content: string;
    let mimeType: string;

    if (format === "html") {
      content = buildHtml(
        title,
        sections,
        author,
        description
      );

      mimeType = "text/html";
    } else if (format === "text") {
      content = buildText(
        title,
        sections,
        author,
        description
      );

      mimeType = "text/plain";
    } else {
      content = buildMarkdown(
        title,
        sections,
        author,
        description
      );

      mimeType = "text/markdown";
    }

    const filename =
      sanitizeFilename(
        input.filename,
        format
      );

    const sizeBytes =
      Buffer.byteLength(
        content,
        "utf8"
      );

    return {
      success: true,
      output: {
        title,
        format,
        filename,
        mime_type: mimeType,
        content,
        size_bytes: sizeBytes,
      },
    };
  } catch (error) {
    console.error(
      "Document generation error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to generate document.",
      errorCode:
        "DOCUMENT_GENERATION_FAILED",
    };
  }
}