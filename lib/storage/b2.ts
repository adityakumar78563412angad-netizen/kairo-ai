import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const B2_APPLICATION_KEY_ID = process.env.B2_APPLICATION_KEY_ID;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME;
const B2_S3_ENDPOINT = process.env.B2_S3_ENDPOINT;

function requireConfig() {
  const missing: string[] = [];

  if (!B2_APPLICATION_KEY_ID) {
    missing.push("B2_APPLICATION_KEY_ID");
  }

  if (!B2_APPLICATION_KEY) {
    missing.push("B2_APPLICATION_KEY");
  }

  if (!B2_BUCKET_NAME) {
    missing.push("B2_BUCKET_NAME");
  }

  if (!B2_S3_ENDPOINT) {
    missing.push("B2_S3_ENDPOINT");
  }

  if (missing.length > 0) {
    throw new Error(
      `B2 storage is not configured. Missing: ${missing.join(", ")}`
    );
  }
}

function getRegionFromEndpoint(endpoint: string): string {
  try {
    const hostname = new URL(endpoint).hostname;

    const match = hostname.match(
      /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/i
    );

    if (!match?.[1]) {
      throw new Error(
        "B2_S3_ENDPOINT must look like https://s3.<region>.backblazeb2.com"
      );
    }

    return match[1];
  } catch {
    throw new Error(
      "Invalid B2_S3_ENDPOINT. Expected https://s3.<region>.backblazeb2.com"
    );
  }
}

function getB2Client(): S3Client {
  requireConfig();

  const endpoint = B2_S3_ENDPOINT as string;
  const region = getRegionFromEndpoint(endpoint);

  return new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: B2_APPLICATION_KEY_ID as string,
      secretAccessKey: B2_APPLICATION_KEY as string,
    },
  });
}

export type B2UploadInput = {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  contentLength?: number;
  metadata?: Record<string, string>;
};

export type B2Object = {
  key: string;
  contentType: string;
  contentLength: number;
  body: Buffer;
  metadata: Record<string, string>;
};

function normalizeKey(key: string): string {
  return key
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");
}

function validateKey(key: string): string {
  const normalized = normalizeKey(key);

  if (!normalized) {
    throw new Error("B2 object key is required");
  }

  if (normalized.includes("..")) {
    throw new Error("Invalid B2 object key");
  }

  if (normalized.length > 1024) {
    throw new Error("B2 object key is too long");
  }

  return normalized;
}

export async function uploadToB2(
  input: B2UploadInput
): Promise<{
  key: string;
  bucket: string;
  contentType: string;
  contentLength: number;
}> {
  const client = getB2Client();

  const key = validateKey(input.key);

  const body =
    typeof input.body === "string"
      ? Buffer.from(input.body)
      : Buffer.from(input.body);

  await client.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET_NAME as string,
      Key: key,
      Body: body,
      ContentType: input.contentType,
      ...(input.contentLength !== undefined
        ? {
            ContentLength: input.contentLength,
          }
        : {}),
      Metadata: input.metadata,
    })
  );

  return {
    key,
    bucket: B2_BUCKET_NAME as string,
    contentType: input.contentType,
    contentLength: body.length,
  };
}

export async function getB2Object(key: string): Promise<B2Object> {
  const client = getB2Client();

  const normalizedKey = validateKey(key);

  const response = await client.send(
    new GetObjectCommand({
      Bucket: B2_BUCKET_NAME as string,
      Key: normalizedKey,
    })
  );

  if (!response.Body) {
    throw new Error("B2 object returned an empty body");
  }

  const bytes = await response.Body.transformToByteArray();

  return {
    key: normalizedKey,
    contentType:
      response.ContentType || "application/octet-stream",
    contentLength: bytes.length,
    body: Buffer.from(bytes),
    metadata: response.Metadata ?? {},
  };
}

export async function headB2Object(key: string) {
  const client = getB2Client();

  const normalizedKey = validateKey(key);

  const response = await client.send(
    new HeadObjectCommand({
      Bucket: B2_BUCKET_NAME as string,
      Key: normalizedKey,
    })
  );

  return {
    key: normalizedKey,
    contentType:
      response.ContentType || "application/octet-stream",
    contentLength: response.ContentLength ?? 0,
    metadata: response.Metadata ?? {},
    lastModified: response.LastModified ?? null,
    etag: response.ETag ?? null,
  };
}

export async function deleteFromB2(key: string): Promise<void> {
  const client = getB2Client();

  const normalizedKey = validateKey(key);

  await client.send(
    new DeleteObjectCommand({
      Bucket: B2_BUCKET_NAME as string,
      Key: normalizedKey,
    })
  );
}