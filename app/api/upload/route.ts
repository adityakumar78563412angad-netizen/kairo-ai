
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const applicationKeyId =
  process.env.B2_APPLICATION_KEY_ID;

const applicationKey =
  process.env.B2_APPLICATION_KEY;

const bucketName =
  process.env.B2_BUCKET_NAME;

const endpoint =
  process.env.B2_S3_ENDPOINT;

if (
  !applicationKeyId ||
  !applicationKey ||
  !bucketName ||
  !endpoint
) {
  throw new Error(
    "Backblaze B2 environment variables are missing."
  );
}

const s3 = new S3Client({
  region: "us-east-005",
  endpoint,
  credentials: {
    accessKeyId: applicationKeyId,
    secretAccessKey: applicationKey,
  },
});

export async function POST(
  request: Request
) {
  try {
    const formData =
      await request.formData();

    const file =
      formData.get("file");

    const userId =
      formData.get("userId");

    const relativePath =
      formData.get("relativePath");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "No file was received.",
        },
        { status: 400 }
      );
    }

    if (
      typeof userId !== "string" ||
      !userId
    ) {
      return NextResponse.json(
        {
          error:
            "User ID is missing.",
        },
        { status: 400 }
      );
    }

    const safeRelativePath =
      typeof relativePath ===
        "string" &&
      relativePath.trim()
        ? relativePath.trim()
        : file.name;

    const cleanPath =
      safeRelativePath
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\.\./g, "");

    const key =
      `users/${userId}/${Date.now()}-${crypto.randomUUID()}-${cleanPath}`;

    const buffer =
      Buffer.from(
        await file.arrayBuffer()
      );

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType:
          file.type ||
          "application/octet-stream",
        ContentLength: buffer.length,
      })
    );

    const url =
      `${endpoint}/${bucketName}/${key}`;

    return NextResponse.json({
      success: true,
      key,
      url,
      name: file.name,
      type:
        file.type ||
        "application/octet-stream",
      size: file.size,
      relativePath:
        safeRelativePath,
    });
  } catch (error: any) {
    console.error(
      "Backblaze B2 upload error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Backblaze B2 upload failed.",
        details:
          error?.message ||
          "Unknown upload error.",
      },
      { status: 500 }
    );
  }
}

