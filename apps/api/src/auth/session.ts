import { betterAuth } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const DEVELOPMENT_SECRET = "opendesign-local-development-secret";

type RuntimeEnv = NodeJS.ProcessEnv;
type AuthDatabase = object | undefined;

function normalizeOrigin(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getAuthRuntimeConfig(env: RuntimeEnv = process.env) {
  const port = env.API_PORT ?? env.PORT ?? "4000";
  const baseURL = env.BETTER_AUTH_URL ?? `http://127.0.0.1:${port}`;
  const secret = env.BETTER_AUTH_SECRET;
  const trustedOrigins = [normalizeOrigin(env.WEB_BASE_URL)].filter(
    (origin): origin is string => Boolean(origin)
  );

  if (secret) {
    return { baseURL, secret, trustedOrigins };
  }

  if (env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET must be set in production.");
  }

  return {
    baseURL,
    secret: DEVELOPMENT_SECRET,
    trustedOrigins
  };
}

export interface CreateAuthOptions {
  env?: RuntimeEnv;
  database?: AuthDatabase;
}

export interface OpenDesignAuth {
  handler(request: Request): Promise<Response>;
  api: {
    getSession(input: { headers: Headers }): Promise<unknown>;
  };
  options: unknown;
}

const openDesignSessionSchema = z
  .object({
    session: z.object({
      id: z.string()
    }),
    user: z.object({
      id: z.string(),
      email: z.string().optional(),
      name: z.string().nullable().optional()
    })
  })
  .passthrough();

export type OpenDesignSession = z.infer<typeof openDesignSessionSchema>;

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  if (typeof value === "string") {
    return value.split(",")[0]?.trim();
  }

  return undefined;
}

export function resolveAuthRequestUrl(
  request: Pick<FastifyRequest, "url" | "headers">,
  baseURL: string
) {
  const fallback = new URL(baseURL);
  const protocol =
    firstHeaderValue(request.headers["x-forwarded-proto"]) ??
    firstHeaderValue(request.headers["x-forwarded-protocol"]) ??
    fallback.protocol.replace(":", "");
  const host =
    firstHeaderValue(request.headers["x-forwarded-host"]) ??
    firstHeaderValue(request.headers.host) ??
    fallback.host;

  return new URL(request.url, `${protocol}://${host}`);
}

function normalizeRequestBody(request: FastifyRequest): string | ArrayBuffer | undefined {
  const hasBody =
    request.method !== "GET" && request.method !== "HEAD" && request.body !== undefined;

  if (!hasBody) {
    return undefined;
  }

  if (typeof request.body === "string" || request.body instanceof ArrayBuffer) {
    return request.body;
  }

  if (request.body instanceof Uint8Array) {
    return new TextDecoder().decode(request.body);
  }

  return JSON.stringify(request.body);
}

export function createAuth(options: CreateAuthOptions = {}) {
  const { baseURL, secret, trustedOrigins } = getAuthRuntimeConfig(options.env);
  const auth = betterAuth({
    baseURL,
    secret,
    ...(trustedOrigins.length > 0 ? { trustedOrigins } : {}),
    ...(options.database ? { database: options.database } : {}),
    emailAndPassword: {
      enabled: true
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 7 * 24 * 60 * 60,
        strategy: "jwe",
        refreshCache: true
      }
    },
    account: {
      storeStateStrategy: "cookie",
      storeAccountCookie: true
    }
  });

  return {
    auth: auth as OpenDesignAuth,
    baseURL
  };
}

export async function sessionGuard(auth: OpenDesignAuth, request: FastifyRequest) {
  return auth.api.getSession({
    headers: fromNodeHeaders(request.headers)
  });
}

export async function getRequestSession(
  auth: OpenDesignAuth,
  request: FastifyRequest
): Promise<OpenDesignSession | null> {
  const session = await sessionGuard(auth, request);
  const parsed = openDesignSessionSchema.safeParse(session);

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function buildAuthRequest(request: FastifyRequest, authBaseUrl: string) {
  const url = resolveAuthRequestUrl(request, authBaseUrl);
  const headers = fromNodeHeaders(request.headers);
  const body = normalizeRequestBody(request);

  return new Request(url.toString(), {
    method: request.method,
    headers,
    ...(body !== undefined ? { body } : {})
  });
}

export function applyAuthResponseHeaders(reply: FastifyReply, response: Response) {
  const setCookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];

  if (setCookies.length > 0) {
    reply.raw.setHeader("set-cookie", setCookies);
  }

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      return;
    }

    reply.header(key, value);
  });
}

export async function sendAuthResponse(reply: FastifyReply, response: Response) {
  reply.status(response.status);
  applyAuthResponseHeaders(reply, response);

  if (!response.body) {
    return reply.send();
  }

  const body = Buffer.from(await response.arrayBuffer());
  return reply.send(body);
}
