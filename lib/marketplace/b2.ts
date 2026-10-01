import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.B2_S3_ENDPOINT;
const region = process.env.B2_S3_REGION;
const bucket = process.env.B2_S3_BUCKET;
const accessKeyId = process.env.B2_S3_KEY_ID;
const secretAccessKey = process.env.B2_S3_APPLICATION_KEY;

if (
  !endpoint ||
  !region ||
  !bucket ||
  !accessKeyId ||
  !secretAccessKey
) {
  throw new Error(
    "Backblaze B2 environment variables are not configured correctly."
  );
}

export const b2Bucket = bucket;

export const b2Client = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true,
});

export type B2UploadInput = {
  key: string;
  contentType: string;
  contentLength: number;
};

export async function createB2UploadUrl({
  key,
  contentType,
  contentLength,
}: B2UploadInput) {
  const command = new PutObjectCommand({
    Bucket: b2Bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  return getSignedUrl(b2Client, command, {
    expiresIn: 15 * 60,
  });
}

export async function createB2DownloadUrl(
  key: string,
  expiresIn = 10 * 60
) {
  const command = new GetObjectCommand({
    Bucket: b2Bucket,
    Key: key,
  });

  return getSignedUrl(b2Client, command, {
    expiresIn,
  });
}

export async function headB2Object(key: string) {
  return b2Client.send(
    new HeadObjectCommand({
      Bucket: b2Bucket,
      Key: key,
    })
  );
}

export async function deleteB2Object(key: string) {
  return b2Client.send(
    new DeleteObjectCommand({
      Bucket: b2Bucket,
      Key: key,
    })
  );
}