import { uploadToB2 } from "@/lib/storage/b2";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
  "text/html",
  "application/javascript",
  "text/javascript",
  "application/typescript",
  "text/typescript",
  "text/css",
  "application/sql",
  "text/sql",
]);

type FileWriteContext = {
  userId?: string;
};

function getString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function sanitizeFilename(filename: string): string {
  const cleaned = filename
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "automation-file.txt";
}

function getExtension(filename: string): string {
  const index = filename.lastIndexOf(".");

  if (index === -1) {
    return "";
  }

  return filename
    .slice(index + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);
}

function getMimeType(
  filename: string,
  suppliedType: unknown
): string {
  if (
    typeof suppliedType === "string" &&
    suppliedType.trim()
  ) {
    return suppliedType.trim();
  }

  const extension = getExtension(filename);

  switch (extension) {
    case "json":
      return "application/json";

    case "csv":
      return "text/csv";

    case "md":
    case "markdown":
      return "text/markdown";

    case "html":
    case "htm":
      return "text/html";

    case "xml":
      return "application/xml";

    case "js":
      return "application/javascript";

    case "ts":
      return "application/typescript";

    case "css":
      return "text/css";

    case "sql":
      return "application/sql";

    default:
      return "text/plain";
  }
}

function validateMimeType(mimeType: string): void {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Unsupported file type: ${mimeType}`
    );
  }
}

function extractInput(input: unknown): {
  filename: string;
  content: string;
  contentType?: unknown;
} {
  if (!input || typeof input !== "object") {
    throw new Error("file_write input is required");
  }

  const value = input as Record<string, unknown>;

  const filename = getString(
    value.filename ?? value.name,
    "filename"
  );

  const content = getString(
    value.content,
    "content"
  );

  return {
    filename,
    content,
    contentType: value.content_type ?? value.mime_type,
  };
}

export async function executeFileWrite(
  planStep: {
    input?: unknown;
  },
  context: FileWriteContext
) {
  const userId = getString(
    context.userId,
    "Authenticated user"
  );

  const input = extractInput(planStep.input);

  const filename = sanitizeFilename(
    input.filename
  );

  const contentType = getMimeType(
    filename,
    input.contentType
  );

  validateMimeType(contentType);

  const buffer = Buffer.from(
    input.content,
    "utf8"
  );

  if (buffer.length === 0) {
    throw new Error("Cannot write an empty file");
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(
      "File exceeds the 10 MB limit"
    );
  }

  const fileId = crypto.randomUUID();

  const extension = getExtension(filename);

  const objectName = extension
    ? `${fileId}.${extension}`
    : fileId;

  const key = [
    "users",
    userId,
    "automation",
    "files",
    fileId,
    objectName,
  ].join("/");

  const uploaded = await uploadToB2({
    key,
    body: buffer,
    contentType,
    contentLength: buffer.length,
    metadata: {
      user_id: userId,
      file_id: fileId,
      original_name: filename,
      source: "automation",
    },
  });

  return {
    success: true,
    file_id: fileId,
    filename,
    content_type: contentType,
    size_bytes: buffer.length,
    storage: "backblaze_b2",
    bucket: uploaded.bucket,
    key: uploaded.key,
    message: "File written successfully to Backblaze B2.",
  };
}