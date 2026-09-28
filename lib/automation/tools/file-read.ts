import { getB2Object } from "@/lib/storage/b2";

const MAX_READ_SIZE = 10 * 1024 * 1024;
const MAX_RETURNED_TEXT = 100_000;

const TEXT_MIME_TYPES = new Set([
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

type FileReadInput = {
  key?: unknown;
  file_id?: unknown;
};

type FileReadContext = {
  userId?: string;
};

function getString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function ensureUserOwnedKey(key: string, userId: string): string {
  const normalized = key
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  const expectedPrefix = `users/${userId}/files/`;

  if (!normalized.startsWith(expectedPrefix)) {
    throw new Error("You are not authorized to access this file");
  }

  if (normalized.includes("..")) {
    throw new Error("Invalid file path");
  }

  return normalized;
}

function isTextLike(contentType: string, key: string): boolean {
  if (contentType.startsWith("text/")) {
    return true;
  }

  if (TEXT_MIME_TYPES.has(contentType)) {
    return true;
  }

  const extension = key.split(".").pop()?.toLowerCase();

  return Boolean(
    extension &&
      [
        "txt",
        "md",
        "markdown",
        "csv",
        "json",
        "xml",
        "html",
        "htm",
        "js",
        "jsx",
        "ts",
        "tsx",
        "css",
        "sql",
        "yaml",
        "yml",
        "env",
        "py",
        "java",
        "c",
        "cpp",
        "h",
        "hpp",
        "go",
        "rs",
        "php",
        "rb",
        "sh",
      ].includes(extension)
  );
}

function truncateText(text: string): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= MAX_RETURNED_TEXT) {
    return {
      text,
      truncated: false,
    };
  }

  return {
    text: text.slice(0, MAX_RETURNED_TEXT),
    truncated: true,
  };
}

function extractFileInput(input: unknown): FileReadInput {
  if (!input || typeof input !== "object") {
    return {};
  }

  const value = input as Record<string, unknown>;

  return {
    key: value.key,
    file_id: value.file_id,
  };
}

export async function executeFileRead(
  planStep: {
    input?: unknown;
  },
  context: FileReadContext
) {
  const userId = getString(
    context.userId,
    "Authenticated user"
  );

  const input = extractFileInput(planStep.input);

  const keyInput =
    typeof input.key === "string"
      ? input.key
      : typeof input.file_id === "string"
        ? input.file_id
        : "";

  const suppliedValue = getString(keyInput, "key");

  const key = ensureUserOwnedKey(
    suppliedValue,
    userId
  );

  const object = await getB2Object(key);

  if (object.contentLength > MAX_READ_SIZE) {
    throw new Error(
      "File is too large to read through automation"
    );
  }

  if (!isTextLike(object.contentType, object.key)) {
    return {
      success: true,
      readable: false,
      key: object.key,
      content_type: object.contentType,
      size_bytes: object.contentLength,
      message:
        "This file is stored successfully but its format is not currently supported by file_read.",
    };
  }

  const decoded = object.body.toString("utf8");

  const result = truncateText(decoded);

  return {
    success: true,
    readable: true,
    key: object.key,
    content_type: object.contentType,
    size_bytes: object.contentLength,
    content: result.text,
    truncated: result.truncated,
  };
}