import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

/**
 * Abstract provider surface for prompt-driven image generation. Implementations
 * fan out to either a LiteLLM/OpenAI-compatible HTTP endpoint (real provider)
 * or a pure-JS deterministic fallback that ships real PNG bytes. The route
 * layer owns lifecycle orchestration (streaming, persistence, asset records)
 * and only asks the provider for the bytes + metadata.
 */
export interface ImageProvider {
  readonly kind: "litellm" | "heuristic";
  generate(input: ImageProviderRequest): Promise<ImageProviderResult>;
}

export interface ImageProviderRequest {
  prompt: string;
  style?: string | undefined;
  size?: string | undefined;
  signal?: AbortSignal | undefined;
}

export interface ImageProviderResult {
  bytes: Buffer;
  contentType: "image/png";
  width: number;
  height: number;
  provider: "litellm" | "heuristic";
  warning: string | null;
}

export class ImageProviderError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "ImageProviderError";
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

const DEFAULT_SIZE = "1024x576" as const;

function parseSize(size: string | undefined): { width: number; height: number } {
  const value = size ?? DEFAULT_SIZE;
  const match = /^(\d{2,5})x(\d{2,5})$/u.exec(value);
  if (!match) {
    throw new ImageProviderError(
      `Invalid image size "${value}"; expected WIDTHxHEIGHT (e.g. 1024x576).`
    );
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ImageProviderError(`Invalid image size "${value}"; dimensions must be positive.`);
  }
  return { width, height };
}

// --- PNG encoding primitives --------------------------------------------------
//
// We roll a minimal but spec-compliant PNG writer (8-bit RGB, no filter) so the
// heuristic fallback can ship real decodable bytes without pulling a native
// dependency. The resulting file starts with the canonical PNG magic
// `89 50 4E 47 0D 0A 1A 0A` and contains IHDR, IDAT, IEND chunks.

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// CRC-32 table, computed lazily and cached — each chunk's CRC is mandatory for
// a standards-compliant PNG.
let crcTable: Uint32Array | null = null;
function getCrcTable(): Uint32Array {
  if (crcTable) {
    return crcTable;
  }
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Buffer): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = table[(crc ^ bytes[index]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePng(input: {
  width: number;
  height: number;
  pixels: Buffer; // RGB triples, row-major, length = width*height*3
}): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(input.width, 0);
  ihdr.writeUInt32BE(input.height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // color type 2 = truecolor (RGB)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const rowStride = input.width * 3;
  const rawScanlines = Buffer.alloc((rowStride + 1) * input.height);
  for (let y = 0; y < input.height; y += 1) {
    const destStart = y * (rowStride + 1);
    rawScanlines[destStart] = 0; // filter: none
    input.pixels.copy(rawScanlines, destStart + 1, y * rowStride, (y + 1) * rowStride);
  }

  const idat = deflateSync(rawScanlines);

  return Buffer.concat([
    PNG_SIGNATURE,
    writeChunk("IHDR", ihdr),
    writeChunk("IDAT", idat),
    writeChunk("IEND", Buffer.alloc(0))
  ]);
}

/**
 * Derive a small palette from a prompt hash so heuristic renders stay visually
 * distinct per-prompt. We pull three color stops for a vertical gradient —
 * enough variation for previews without attempting real illustration.
 */
function derivePalette(prompt: string): [number, number, number][] {
  const digest = createHash("sha256").update(prompt).digest();
  // Spread across the digest so the three stops aren't correlated.
  return [
    [digest[0]!, digest[1]!, digest[2]!],
    [digest[8]!, digest[9]!, digest[10]!],
    [digest[20]!, digest[21]!, digest[22]!]
  ];
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function buildHeuristicPixels(input: {
  width: number;
  height: number;
  prompt: string;
}): Buffer {
  const palette = derivePalette(input.prompt);
  const pixels = Buffer.alloc(input.width * input.height * 3);
  for (let y = 0; y < input.height; y += 1) {
    // Three-stop vertical gradient: top -> middle -> bottom.
    const normalized = y / Math.max(1, input.height - 1);
    const stopIndex = normalized < 0.5 ? 0 : 1;
    const localT = stopIndex === 0 ? normalized * 2 : (normalized - 0.5) * 2;
    const from = palette[stopIndex]!;
    const to = palette[stopIndex + 1]!;
    const r = lerp(from[0], to[0], localT);
    const g = lerp(from[1], to[1], localT);
    const b = lerp(from[2], to[2], localT);
    for (let x = 0; x < input.width; x += 1) {
      const offset = (y * input.width + x) * 3;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
    }
  }
  return pixels;
}

/**
 * Heuristic provider: deterministic prompt-seeded gradient PNG. Always
 * available — no network dependency — so the route layer can degrade
 * gracefully when `OPENDESIGN_IMAGE_PROVIDER_URL` is unset or the upstream
 * provider fails.
 */
export class HeuristicImageProvider implements ImageProvider {
  readonly kind = "heuristic" as const;

  async generate(input: ImageProviderRequest): Promise<ImageProviderResult> {
    const { width, height } = parseSize(input.size);
    const pixels = buildHeuristicPixels({ width, height, prompt: input.prompt });
    const bytes = encodePng({ width, height, pixels });
    return {
      bytes,
      contentType: "image/png",
      width,
      height,
      provider: "heuristic",
      warning: null
    };
  }
}

/**
 * LiteLLM/OpenAI-compatible provider. Honors `OPENDESIGN_IMAGE_PROVIDER_URL`
 * (e.g. a LiteLLM gateway base URL) and `OPENDESIGN_IMAGE_MODEL`. On any
 * structured failure the caller falls back to the heuristic provider so the
 * pipeline stays functional even without a configured backend.
 */
export class LiteLLMImageProvider implements ImageProvider {
  readonly kind = "litellm" as const;

  constructor(
    private readonly config: {
      baseURL: string;
      model: string;
      apiKey?: string | undefined;
      fetchImpl?: typeof fetch;
    }
  ) {}

  async generate(input: ImageProviderRequest): Promise<ImageProviderResult> {
    const { width, height } = parseSize(input.size);
    const endpoint = joinUrl(this.config.baseURL, "/images/generations");
    const body = {
      model: this.config.model,
      prompt: input.style ? `${input.prompt} — style: ${input.style}` : input.prompt,
      size: `${width}x${height}`,
      response_format: "b64_json",
      n: 1
    };

    const fetchImpl = this.config.fetchImpl ?? fetch;
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {})
        },
        body: JSON.stringify(body),
        ...(input.signal ? { signal: input.signal } : {})
      });
    } catch (error) {
      throw new ImageProviderError("Image provider request failed", { cause: error });
    }

    if (!response.ok) {
      const detail = await safeReadText(response);
      throw new ImageProviderError(
        `Image provider returned ${response.status}: ${detail.slice(0, 200)}`
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new ImageProviderError("Image provider returned invalid JSON", {
        cause: error
      });
    }

    const base64 = extractBase64Image(payload);
    if (!base64) {
      throw new ImageProviderError(
        "Image provider response did not include b64_json image data."
      );
    }

    const bytes = Buffer.from(base64, "base64");
    // Validate PNG magic — OpenAI-compatible providers sometimes return JPEG
    // when asked for PNG; we accept whatever we receive but tag the warning so
    // consumers know the content-type may differ from `image/png`.
    const hasPngMagic =
      bytes.length > 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;

    return {
      bytes,
      contentType: "image/png",
      width,
      height,
      provider: "litellm",
      warning: hasPngMagic ? null : "Upstream returned non-PNG bytes; served as-is."
    };
  }
}

function joinUrl(baseURL: string, path: string): string {
  const normalizedBase = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function extractBase64Image(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }
  const first = data[0];
  if (!first || typeof first !== "object") {
    return null;
  }
  const b64 = (first as { b64_json?: unknown }).b64_json;
  return typeof b64 === "string" && b64.length > 0 ? b64 : null;
}

/**
 * Factory honoring the environment contract declared in CLAUDE/runbook docs:
 * `OPENDESIGN_IMAGE_PROVIDER_URL` + `OPENDESIGN_IMAGE_MODEL` select LiteLLM;
 * absence of either falls through to the always-available heuristic.
 */
export function createImageProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env
): ImageProvider {
  const baseURL = env.OPENDESIGN_IMAGE_PROVIDER_URL?.trim();
  const model = env.OPENDESIGN_IMAGE_MODEL?.trim();
  const apiKey = env.OPENDESIGN_IMAGE_PROVIDER_API_KEY?.trim();

  if (baseURL && model) {
    return new LiteLLMImageProvider({
      baseURL,
      model,
      ...(apiKey ? { apiKey } : {})
    });
  }
  return new HeuristicImageProvider();
}

/**
 * A provider that tries `primary` first and falls back to `fallback` if the
 * primary throws an `ImageProviderError`. Callers surface the resulting
 * `warning` to the UI so users know a downgrade occurred.
 */
export class FallbackImageProvider implements ImageProvider {
  get kind(): "litellm" | "heuristic" {
    return this.primary.kind;
  }

  constructor(
    private readonly primary: ImageProvider,
    private readonly fallback: ImageProvider
  ) {}

  async generate(input: ImageProviderRequest): Promise<ImageProviderResult> {
    try {
      return await this.primary.generate(input);
    } catch (error) {
      if (error instanceof ImageProviderError) {
        const downgraded = await this.fallback.generate(input);
        return {
          ...downgraded,
          warning:
            downgraded.warning ??
            `Primary image provider failed (${error.message}); served heuristic fallback.`
        };
      }
      throw error;
    }
  }
}
