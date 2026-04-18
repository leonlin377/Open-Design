import {
  summarizePackEvidence,
  extractDesignSystemPackFromRepositoryFiles,
  extractDesignSystemPackFromSiteCapture
} from "@opendesign/design-ingest";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getRequestSession, type OpenDesignAuth } from "../auth/session";
import { sendApiError } from "../lib/api-errors";
import type { DesignSystemRepository } from "../repositories/design-systems";

const githubImportBodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  ref: z.string().min(1).optional(),
  path: z.string().min(1).optional()
});

const localDirectoryImportBodySchema = z.object({
  absolutePath: z.string().min(1),
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        content: z.string()
      })
    )
    .min(1)
});

const siteCaptureImportBodySchema = z.object({
  url: z.string().url()
});

type GithubRepoResponse = {
  default_branch?: string;
};

type GithubTreeResponse = {
  truncated?: boolean;
  tree?: Array<{
    path?: string;
    type?: string;
    size?: number;
  }>;
};

function buildGithubHeaders(env: NodeJS.ProcessEnv = process.env) {
  const headers = new Headers({
    accept: "application/vnd.github+json",
    "user-agent": "OpenDesign"
  });

  if (env.GITHUB_TOKEN) {
    headers.set("authorization", `Bearer ${env.GITHUB_TOKEN}`);
  }

  return headers;
}

function scoreRepositoryFile(path: string) {
  let score = 0;

  if (/(tokens?|theme|brand|colors?|typography|styles?)/i.test(path)) {
    score += 10;
  }

  if (/(components?|ui|blocks?)/i.test(path)) {
    score += 8;
  }

  if (/\.(css|scss|json)$/i.test(path)) {
    score += 6;
  }

  if (/\.(tsx|ts|jsx|js)$/i.test(path)) {
    score += 3;
  }

  return score;
}

function isSupportedRepositoryFile(path: string) {
  return /\.(css|scss|json|ts|tsx|js|jsx)$/i.test(path);
}

function extractStylesheetUrls(html: string, pageUrl: string) {
  const matches = [...html.matchAll(/<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi)];

  return matches
    .map((match) => match[1] ?? "")
    .filter((href) => href.length > 0)
    .map((href) => {
      try {
        return new URL(href, pageUrl).toString();
      } catch {
        return null;
      }
    })
    .filter((href): href is string => Boolean(href));
}

function extractDomNodesFromHtml(html: string) {
  const matches = [
    ...html.matchAll(
      /<(button|input|nav|header|footer|section|a)\b([^>]*)>([\s\S]*?)<\/\1>|<(input)\b([^>]*)\/?>/gi
    )
  ];

  return matches
    .map((match) => {
      const tag = (match[1] ?? match[4] ?? "").toLowerCase();
      const attributes = match[2] ?? match[5] ?? "";
      const classNameMatch = attributes.match(/class=["']([^"']+)["']/i);
      const textContent = (match[3] ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        tag,
        className: classNameMatch?.[1] ?? null,
        text: textContent || null
      };
    })
    .filter((node) => node.tag.length > 0);
}

async function fetchSiteCapture(input: { url: string }) {
  const pageResponse = await fetch(input.url, {
    headers: {
      "user-agent": "OpenDesign"
    }
  });

  if (!pageResponse.ok) {
    return {
      status: "failed" as const,
      message: `Site capture request failed with status ${pageResponse.status}.`
    };
  }

  const html = await pageResponse.text();
  const stylesheetUrls = extractStylesheetUrls(html, input.url).slice(0, 8);
  const stylesheets = await Promise.all(
    stylesheetUrls.map(async (stylesheetUrl) => {
      try {
        const stylesheetResponse = await fetch(stylesheetUrl, {
          headers: {
            "user-agent": "OpenDesign"
          }
        });

        if (!stylesheetResponse.ok) {
          return null;
        }

        return {
          sourceRef: stylesheetUrl,
          content: await stylesheetResponse.text()
        };
      } catch {
        return null;
      }
    })
  );

  return {
    status: "ok" as const,
    html,
    stylesheets: stylesheets.filter((item): item is NonNullable<typeof item> => Boolean(item)),
    domNodes: extractDomNodesFromHtml(html)
  };
}

async function fetchGithubRepositoryFiles(input: {
  owner: string;
  repo: string;
  ref?: string;
  path?: string;
  env?: NodeJS.ProcessEnv;
}) {
  const headers = buildGithubHeaders(input.env);
  const repoResponse = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`,
    { headers }
  );

  if (repoResponse.status === 404) {
    return {
      status: "not-found" as const
    };
  }

  if (!repoResponse.ok) {
    return {
      status: "failed" as const,
      message: `GitHub repository lookup failed with status ${repoResponse.status}.`
    };
  }

  const repoPayload = (await repoResponse.json()) as GithubRepoResponse;
  const ref = input.ref ?? repoPayload.default_branch;

  if (!ref) {
    return {
      status: "failed" as const,
      message: "GitHub repository did not expose a usable default branch."
    };
  }

  const treeResponse = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    { headers }
  );

  if (!treeResponse.ok) {
    return {
      status: "failed" as const,
      message: `GitHub repository tree lookup failed with status ${treeResponse.status}.`
    };
  }

  const treePayload = (await treeResponse.json()) as GithubTreeResponse;
  const requestedPrefix = input.path?.replace(/^\/+|\/+$/g, "");
  const files = (treePayload.tree ?? [])
    .filter((entry) => entry.type === "blob" && typeof entry.path === "string")
    .map((entry) => ({
      path: entry.path!,
      size: entry.size ?? 0
    }))
    .filter((entry) =>
      requestedPrefix ? entry.path === requestedPrefix || entry.path.startsWith(`${requestedPrefix}/`) : true
    )
    .filter((entry) => isSupportedRepositoryFile(entry.path))
    .filter((entry) => entry.size > 0 && entry.size <= 150_000)
    .sort((left, right) => scoreRepositoryFile(right.path) - scoreRepositoryFile(left.path))
    .slice(0, 24);

  if (files.length === 0) {
    return {
      status: "failed" as const,
      message: "No supported repository files were found for design-system extraction."
    };
  }

  const contents = await Promise.all(
    files.map(async (file) => {
      const rawResponse = await fetch(
        `https://raw.githubusercontent.com/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/${encodeURIComponent(ref)}/${file.path}`,
        {
          headers: new Headers({
            "user-agent": "OpenDesign",
            ...(input.env?.GITHUB_TOKEN
              ? {
                  authorization: `Bearer ${input.env.GITHUB_TOKEN}`
                }
              : {})
          })
        }
      );

      if (!rawResponse.ok) {
        return null;
      }

      return {
        path: file.path,
        content: await rawResponse.text()
      };
    })
  );

  return {
    status: "ok" as const,
    ref,
    files: contents.filter((item): item is NonNullable<typeof item> => Boolean(item)),
    truncated: Boolean(treePayload.truncated)
  };
}

export interface DesignSystemRouteOptions {
  designSystems: DesignSystemRepository;
  auth: OpenDesignAuth;
}

export const registerDesignSystemRoutes: FastifyPluginAsync<DesignSystemRouteOptions> =
  async (app, options) => {
    app.get("/design-systems", async (request) => {
      const session = await getRequestSession(options.auth, request);

      return options.designSystems.list({
        ownerUserId: session?.user.id ?? undefined
      });
    });

    app.post("/design-systems/import/github", async (request, reply) => {
      const body = githubImportBodySchema.parse(request.body);
      const session = await getRequestSession(options.auth, request);
      const githubResult = await fetchGithubRepositoryFiles({
        owner: body.owner,
        repo: body.repo,
        ref: body.ref,
        path: body.path,
        env: process.env
      });

      if (githubResult.status === "not-found") {
        return sendApiError(reply, 404, {
          error: "GitHub repository not found",
          code: "DESIGN_SYSTEM_IMPORT_FAILED",
          recoverable: true,
          details: {
            owner: body.owner,
            repo: body.repo
          }
        });
      }

      if (githubResult.status === "failed") {
        return sendApiError(reply, 422, {
          error: githubResult.message,
          code: "DESIGN_SYSTEM_IMPORT_FAILED",
          recoverable: true
        });
      }

      const extraction = extractDesignSystemPackFromRepositoryFiles({
        source: {
          type: "github",
          owner: body.owner,
          repo: body.repo,
          ref: githubResult.ref,
          path: body.path
        },
        files: githubResult.files
      });
      const record = await options.designSystems.create({
        ownerUserId: session?.user.id ?? null,
        pack: extraction.pack
      });

      return reply.code(201).send({
        pack: record,
        warnings: [
          ...extraction.warnings,
          ...(githubResult.truncated
            ? ["GitHub returned a truncated tree; extraction used the highest-priority files only."]
            : [])
        ],
        summary: summarizePackEvidence(extraction)
      });
    });

    app.post("/design-systems/import/local", async (request, reply) => {
      const body = localDirectoryImportBodySchema.parse(request.body);
      const session = await getRequestSession(options.auth, request);
      const supportedFiles = body.files.filter((file) => isSupportedRepositoryFile(file.path));

      if (supportedFiles.length === 0) {
        return sendApiError(reply, 422, {
          error: "No supported local directory files were provided for design-system extraction.",
          code: "DESIGN_SYSTEM_IMPORT_FAILED",
          recoverable: true
        });
      }

      const extraction = extractDesignSystemPackFromRepositoryFiles({
        source: {
          type: "local-directory",
          absolutePath: body.absolutePath
        },
        files: supportedFiles.slice(0, 48)
      });
      const record = await options.designSystems.create({
        ownerUserId: session?.user.id ?? null,
        pack: extraction.pack
      });

      return reply.code(201).send({
        pack: record,
        warnings: extraction.warnings,
        summary: summarizePackEvidence(extraction)
      });
    });

    app.post("/design-systems/import/site-capture", async (request, reply) => {
      const body = siteCaptureImportBodySchema.parse(request.body);
      const session = await getRequestSession(options.auth, request);
      const siteCapture = await fetchSiteCapture({
        url: body.url
      });

      if (siteCapture.status === "failed") {
        return sendApiError(reply, 422, {
          error: siteCapture.message,
          code: "DESIGN_SYSTEM_IMPORT_FAILED",
          recoverable: true
        });
      }

      const extraction = extractDesignSystemPackFromSiteCapture({
        source: {
          type: "site-capture",
          url: body.url
        },
        html: siteCapture.html,
        stylesheets: siteCapture.stylesheets,
        domNodes: siteCapture.domNodes
      });
      const record = await options.designSystems.create({
        ownerUserId: session?.user.id ?? null,
        pack: extraction.pack
      });

      return reply.code(201).send({
        pack: record,
        warnings: extraction.warnings,
        summary: summarizePackEvidence(extraction)
      });
    });
  };
