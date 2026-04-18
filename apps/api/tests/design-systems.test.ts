import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Design systems", () => {
  it("imports a GitHub repository into a persisted design system pack and lists it", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);

      if (url === "https://api.github.com/repos/acme/design-system") {
        return new Response(
          JSON.stringify({
            default_branch: "main"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (
        url ===
        "https://api.github.com/repos/acme/design-system/git/trees/main?recursive=1"
      ) {
        return new Response(
          JSON.stringify({
            truncated: false,
            tree: [
              {
                path: "packages/tokens/colors.css",
                type: "blob",
                size: 120
              },
              {
                path: "src/components/button.tsx",
                type: "blob",
                size: 80
              }
            ]
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (
        url ===
        "https://raw.githubusercontent.com/acme/design-system/main/packages/tokens/colors.css"
      ) {
        return new Response(
          ":root { --color-primary: #0f172a; --font-size-display: 64px; }",
          {
            status: 200,
            headers: {
              "content-type": "text/plain"
            }
          }
        );
      }

      if (
        url ===
        "https://raw.githubusercontent.com/acme/design-system/main/src/components/button.tsx"
      ) {
        return new Response("export function Button() { return <button />; }", {
          status: 200,
          headers: {
            "content-type": "text/plain"
          }
        });
      }

      return new Response("not found", { status: 404 });
    }) as typeof globalThis.fetch;

    const app = await buildApp();

    try {
      const importResponse = await app.inject({
        method: "POST",
        url: "/api/design-systems/import/github",
        payload: {
          owner: "acme",
          repo: "design-system"
        }
      });

      expect(importResponse.statusCode).toBe(201);
      expect(importResponse.json()).toMatchObject({
        pack: {
          name: "acme/design-system",
          source: "github",
          tokens: {
            colors: {
              "color.primary": "#0f172a"
            },
            typography: {
              "font.size.display": "64px"
            }
          }
        },
        summary: {
          evidenceCount: 2
        }
      });
      expect(importResponse.json().pack.components).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Button"
          })
        ])
      );

      const listResponse = await app.inject({
        method: "GET",
        url: "/api/design-systems"
      });

      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "acme/design-system",
            source: "github"
          })
        ])
      );
    } finally {
      await app.close();
    }
  });

  it("returns a structured error when the GitHub repository is missing", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);

      if (url === "https://api.github.com/repos/acme/missing") {
        return new Response("missing", { status: 404 });
      }

      return new Response("unexpected", { status: 500 });
    }) as typeof globalThis.fetch;

    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/design-systems/import/github",
        payload: {
          owner: "acme",
          repo: "missing"
        }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        code: "DESIGN_SYSTEM_IMPORT_FAILED",
        recoverable: true
      });
    } finally {
      await app.close();
    }
  });

  it("imports a local directory payload into a persisted design system pack", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/design-systems/import/local",
        payload: {
          absolutePath: "/Users/leon/design-systems/atlas-ui",
          files: [
            {
              path: "tokens/theme.json",
              content: JSON.stringify({
                colors: {
                  primary: "#111827"
                },
                typography: {
                  display: {
                    fontSize: "72px"
                  }
                }
              })
            },
            {
              path: "components/button.tsx",
              content: "export function Button() { return <button />; }"
            }
          ]
        }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        pack: {
          name: "atlas-ui",
          source: "local-directory",
          tokens: {
            colors: {
              "colors.primary": "#111827"
            },
            typography: {
              "typography.display.fontsize": "72px"
            }
          }
        },
        summary: {
          evidenceCount: 2
        }
      });

      const listResponse = await app.inject({
        method: "GET",
        url: "/api/design-systems"
      });

      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "atlas-ui",
            source: "local-directory"
          })
        ])
      );
    } finally {
      await app.close();
    }
  });

  it("rejects local directory imports that contain no supported files", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/design-systems/import/local",
        payload: {
          absolutePath: "/Users/leon/design-systems/notes",
          files: [
            {
              path: "README.md",
              content: "# Notes"
            }
          ]
        }
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({
        code: "DESIGN_SYSTEM_IMPORT_FAILED",
        recoverable: true
      });
    } finally {
      await app.close();
    }
  });
});
