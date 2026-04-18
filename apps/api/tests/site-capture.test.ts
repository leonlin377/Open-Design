import { describe, expect, it, vi } from "vitest";
import { captureSite } from "../src/site-capture";

describe("captureSite", () => {
  it("captures a site through Playwright and returns browser-derived data", async () => {
    let evaluateCallCount = 0;
    const fetcher = vi.fn(async (input) => {
      const url = String(input);

      if (url === "https://atlas.example.com/styles.css") {
        return new Response(".hero { font-family: Avenir Next; }", {
          status: 200,
          headers: {
            "content-type": "text/css"
          }
        });
      }

      return new Response("unexpected", { status: 404 });
    }) as typeof fetch;

    const result = await captureSite(
      {
        url: "https://atlas.example.com"
      },
      {
        fetcher,
        loadPlaywright: async () => ({
          chromium: {
            launch: async () => ({
              newPage: async () => ({
                goto: async () => undefined,
                content: async () =>
                  `
                    <html>
                      <head>
                        <link rel="stylesheet" href="/styles.css" />
                      </head>
                      <body>
                        <header class="masthead"></header>
                        <button class="cta-button">Launch</button>
                      </body>
                    </html>
                  `,
                screenshot: async () => Buffer.from("png"),
                evaluate: async () => {
                  evaluateCallCount += 1;

                  if (evaluateCallCount === 1) {
                    return ["/styles.css"];
                  }

                  return [
                    { tag: "header", className: "masthead", text: null },
                    { tag: "button", className: "cta-button", text: "Launch" }
                  ];
                },
                close: async () => undefined
              }),
              close: async () => undefined
            })
          }
        })
      }
    );

    expect(result).toMatchObject({
      status: "ok",
      mode: "playwright",
      screenshots: [
        {
          sourceRef: "https://atlas.example.com#primary-viewport"
        }
      ],
      domNodes: [
        {
          tag: "header",
          className: "masthead"
        },
        {
          tag: "button",
          className: "cta-button",
          text: "Launch"
        }
      ],
      stylesheets: [
        {
          sourceRef: "https://atlas.example.com/styles.css"
        }
      ]
    });
  });

  it("falls back to fetch capture when Playwright launch fails", async () => {
    const fetcher = vi.fn(async (input) => {
      const url = String(input);

      if (url === "https://atlas.example.com") {
        return new Response(
          `
            <html>
              <head>
                <style>:root { --color-primary: #0f172a; }</style>
              </head>
              <body>
                <button class="cta-button">Launch</button>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: {
              "content-type": "text/html"
            }
          }
        );
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const result = await captureSite(
      {
        url: "https://atlas.example.com"
      },
      {
        fetcher,
        loadPlaywright: async () => {
          throw new Error("chromium unavailable");
        }
      }
    );

    expect(result).toMatchObject({
      status: "ok",
      mode: "fetch",
      screenshots: [
        {
          sourceRef: "https://atlas.example.com#primary-viewport"
        }
      ]
    });

    if (result.status === "ok") {
      expect(result.warnings[0]).toMatch(/browser capture fallback activated/i);
    }
  });
});
