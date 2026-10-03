import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getB2Config() {
  const endpoint = process.env.B2_S3_ENDPOINT;
  const region = process.env.B2_S3_REGION;
  const bucket = process.env.B2_BUCKET_NAME;
  const accessKeyId = process.env.B2_APPLICATION_KEY_ID;
  const secretAccessKey = process.env.B2_APPLICATION_KEY;

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

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}

function getB2Client() {
  const config = getB2Config();

  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

export function getB2Bucket() {
  return getB2Config().bucket;
}

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
  const config = getB2Config();
  const client = getB2Client();

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  return getSignedUrl(client, command, {
    expiresIn: 15 * 60,
  });
}

export async function createB2DownloadUrl(
  key: string,
  expiresIn = 10 * 60
) {
  const config = getB2Config();
  const client = getB2Client();

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  return getSignedUrl(client, command, {
    expiresIn,
  });
}

export async function headB2Object(key: string) {
  const config = getB2Config();
  const client = getB2Client();

  return client.send(
    new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
}

export async function deleteB2Object(key: string) {
  const config = getB2Config();
  const client = getB2Client();

  return client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
}