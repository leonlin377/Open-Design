import { createHash } from "node:crypto";
import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface AssetStorage {
  provider: "memory" | "s3";
  uploadObject(input: {
    objectKey: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<{
    objectKey: string;
    sizeBytes: number;
    contentType: string;
  }>;
  readObject(input: {
    objectKey: string;
  }): Promise<{
    bytes: Uint8Array;
    contentType: string;
  } | null>;
}

type StoredAsset = {
  bytes: Uint8Array;
  contentType: string;
};

async function readBodyToUint8Array(body: unknown): Promise<Uint8Array> {
  if (!body) {
    return new Uint8Array();
  }

  if (body instanceof Uint8Array) {
    return body;
  }

  if (typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray();
    return bytes;
  }

  if (Symbol.asyncIterator in Object(body)) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  }

  return new Uint8Array();
}

export class InMemoryAssetStorage implements AssetStorage {
  readonly provider = "memory" as const;
  private readonly objects = new Map<string, StoredAsset>();

  async uploadObject(input: {
    objectKey: string;
    bytes: Uint8Array;
    contentType: string;
  }) {
    this.objects.set(input.objectKey, {
      bytes: input.bytes,
      contentType: input.contentType
    });

    return {
      objectKey: input.objectKey,
      sizeBytes: input.bytes.byteLength,
      contentType: input.contentType
    };
  }

  async readObject(input: { objectKey: string }) {
    const stored = this.objects.get(input.objectKey) ?? null;

    if (!stored) {
      return null;
    }

    return {
      bytes: stored.bytes,
      contentType: stored.contentType
    };
  }
}

export class S3AssetStorage implements AssetStorage {
  readonly provider = "s3" as const;

  constructor(
    private readonly client: S3Client,
    private readonly bucket: string
  ) {}

  async uploadObject(input: {
    objectKey: string;
    bytes: Uint8Array;
    contentType: string;
  }) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.objectKey,
        Body: input.bytes,
        ContentType: input.contentType
      })
    );

    return {
      objectKey: input.objectKey,
      sizeBytes: input.bytes.byteLength,
      contentType: input.contentType
    };
  }

  async readObject(input: { objectKey: string }) {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: input.objectKey
        })
      );

      return {
        bytes: await readBodyToUint8Array(response.Body),
        contentType: response.ContentType ?? "application/octet-stream"
      };
    } catch {
      return null;
    }
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function buildAssetObjectKey(input: {
  scope: "design-systems";
  sourceRef: string;
  contentType: string;
}) {
  const digest = createHash("sha256").update(input.sourceRef).digest("hex").slice(0, 16);
  const extension =
    input.contentType === "image/png"
      ? "png"
      : input.contentType === "image/jpeg"
        ? "jpg"
        : "bin";

  return `${input.scope}/${digest}.${extension}`;
}

export function createS3AssetStorage(env: NodeJS.ProcessEnv = process.env) {
  const endpoint = env.S3_ENDPOINT;
  const bucket = env.S3_BUCKET;
  const region = env.S3_REGION ?? "us-east-1";
  const accessKeyId = env.S3_ACCESS_KEY;
  const secretAccessKey = env.S3_SECRET_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const client = new S3Client({
    region,
    endpoint: trimTrailingSlash(endpoint),
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    forcePathStyle: true
  });

  return new S3AssetStorage(client, bucket);
}
