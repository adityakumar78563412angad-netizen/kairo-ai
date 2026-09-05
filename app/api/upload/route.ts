import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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
      return NextResponse.json(
        {
          success: false,
          error:
            "Backblaze B2 environment variables are missing.",
        },
        { status: 500 }
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
          success: false,
          error: "No file was received.",
        },
        { status: 400 }
      );
    }

    if (
      typeof userId !== "string" ||
      !userId.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "User ID is missing.",
        },
        { status: 400 }
      );
    }

    const rawRelativePath =
      typeof relativePath === "string" &&
      relativePath.trim()
        ? relativePath.trim()
        : file.name;

    const cleanPath =
      rawRelativePath
        .replace(/\\/g, "/")
        .split("/")
        .filter(
          (part) =>
            part &&
            part !== "." &&
            part !== ".."
        )
        .join("/");

    const finalPath =
      cleanPath || file.name;

    const key =
      `users/${userId.trim()}/` +
      `${Date.now()}-${crypto.randomUUID()}-${finalPath}`;

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

    const cleanEndpoint =
      endpoint.replace(/\/+$/, "");

    const url =
      `${cleanEndpoint}/${bucketName}/${key}`;

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
        rawRelativePath,
    });
  } catch (error) {
    console.error(
      "Backblaze B2 upload error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Backblaze B2 upload failed.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown upload error.",
      },
      { status: 500 }
    );
  }
}