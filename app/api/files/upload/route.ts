import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase";
import { uploadToB2 } from "@/lib/storage/b2";

export const runtime = "nodejs";

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

function sanitizeFilename(filename: string): string {
  const cleaned = filename
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "file";
}

function extensionFromFilename(filename: string): string {
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

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No file was provided",
        },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Empty files are not allowed",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "File exceeds the 10 MB limit",
        },
        { status: 413 }
      );
    }

    const filename = sanitizeFilename(file.name);
    const mimeType = file.type || "application/octet-stream";

    if (
      mimeType !== "application/octet-stream" &&
      !ALLOWED_MIME_TYPES.has(mimeType)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${mimeType}`,
        },
        { status: 415 }
      );
    }

    const fileId = randomUUID();
    const extension = extensionFromFilename(filename);

    const objectName = extension
      ? `${fileId}.${extension}`
      : fileId;

    const key = [
      "users",
      user.id,
      "files",
      fileId,
      objectName,
    ].join("/");

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploaded = await uploadToB2({
      key,
      body: buffer,
      contentType: mimeType,
      contentLength: buffer.length,
      metadata: {
        user_id: user.id,
        file_id: fileId,
        original_name: filename,
      },
    });

    return NextResponse.json({
      success: true,
      file: {
        id: fileId,
        name: filename,
        type: mimeType,
        size: buffer.length,
        storage: "backblaze_b2",
        bucket: uploaded.bucket,
        key: uploaded.key,
      },
    });
  } catch (error) {
    console.error("File upload error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "File upload failed",
      },
      { status: 500 }
    );
  }
}