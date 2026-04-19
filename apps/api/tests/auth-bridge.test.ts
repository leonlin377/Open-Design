import Fastify from "fastify";
import { afterEach, describe, expect, test } from "vitest";

import {
  getAuthRuntimeConfig,
  resolveAuthRequestUrl,
  sendAuthResponse
} from "../src/auth/session";

const apps: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(apps.map((app) => app.close()));
  apps.length = 0;
});

describe("resolveAuthRequestUrl", () => {
  test("prefers forwarded proto and host headers", () => {
    const url = resolveAuthRequestUrl(
      {
        url: "/api/auth/callback",
        headers: {
          host: "internal:4000",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "design.example.com"
        }
      } as never,
      "http://127.0.0.1:4000"
    );

    expect(url.toString()).toBe("https://design.example.com/api/auth/callback");
  });
});

describe("sendAuthResponse", () => {
  test("preserves multiple set-cookie headers", async () => {
    const app = Fastify();
    apps.push(app);

    app.get("/probe", async (_request, reply) => {
      const response = new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });

      response.headers.append("set-cookie", "session=abc; Path=/; HttpOnly");
      response.headers.append("set-cookie", "refresh=def; Path=/; HttpOnly");

      return sendAuthResponse(reply, response);
    });

    const response = await app.inject({
      method: "GET",
      url: "/probe"
    });

    const setCookie = response.headers["set-cookie"];
    expect(Array.isArray(setCookie)).toBe(true);
    expect(setCookie).toEqual([
      "session=abc; Path=/; HttpOnly",
      "refresh=def; Path=/; HttpOnly"
    ]);
  });
});

describe("getAuthRuntimeConfig", () => {
  test("includes the configured web origin in trusted origins", () => {
    expect(
      getAuthRuntimeConfig({
        API_PORT: "4100",
        WEB_BASE_URL: "http://127.0.0.1:3100"
      })
    ).toMatchObject({
      baseURL: "http://127.0.0.1:4100",
      trustedOrigins: ["http://127.0.0.1:3100"]
    });
  });

  test("throws without a secret in production", () => {
    expect(() =>
      getAuthRuntimeConfig({
        NODE_ENV: "production",
        API_PORT: "4000"
      })
    ).toThrowError(/BETTER_AUTH_SECRET/);
  });
});
