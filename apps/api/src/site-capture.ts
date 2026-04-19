import fs from "node:fs";

export type SiteCaptureStylesheet = {
  sourceRef: string;
  content: string;
};

export type SiteCaptureDomNode = {
  tag: string;
  className?: string | null;
  text?: string | null;
};

export type SiteCaptureScreenshot = {
  label: string;
  sourceRef: string;
  contentType?: string;
  bytes?: Uint8Array;
};

export type SiteCaptureSuccess = {
  status: "ok";
  mode: "playwright" | "fetch";
  html: string;
  stylesheets: SiteCaptureStylesheet[];
  domNodes: SiteCaptureDomNode[];
  screenshots: SiteCaptureScreenshot[];
  warnings: string[];
};

export type SiteCaptureFailure = {
  status: "failed";
  message: string;
};

export type SiteCaptureResult = SiteCaptureSuccess | SiteCaptureFailure;

type PlaywrightPage = {
  goto(url: string, options?: { waitUntil?: "networkidle" | "load"; timeout?: number }): Promise<unknown>;
  content(): Promise<string>;
  screenshot(options?: { type?: "png" | "jpeg"; fullPage?: boolean }): Promise<Uint8Array | Buffer>;
  evaluate(pageFunction: () => unknown | Promise<unknown>): Promise<unknown>;
  close(): Promise<void>;
};

type PlaywrightBrowser = {
  newPage(options?: { viewport?: { width: number; height: number } }): Promise<PlaywrightPage>;
  close(): Promise<void>;
};

type PlaywrightModule = {
  chromium: {
    launch(options?: {
      headless?: boolean;
      executablePath?: string;
      args?: string[];
    }): Promise<PlaywrightBrowser>;
  };
};

export interface SiteCaptureOptions {
  env?: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
  loadPlaywright?: () => Promise<PlaywrightModule>;
}

const CAPTURE_USER_AGENT =
  "Mozilla/5.0 (compatible; OpenDesign/0.1; +https://github.com/leonlin377/Open-Design)";

const SUPPORTED_TAGS = ["button", "input", "nav", "header", "footer", "section", "a"];
const DEFAULT_BROWSER_TIMEOUT_MS = 15000;

function extractStylesheetUrls(html: string, pageUrl: string) {
  const matches = [
    ...html.matchAll(
      /<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi
    )
  ];

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

function resolveChromiumExecutablePath(env: NodeJS.ProcessEnv = process.env) {
  const explicitPath = env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

  if (explicitPath && fs.existsSync(explicitPath)) {
    return explicitPath;
  }

  const candidates = [
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function captureSiteWithFetch(
  input: { url: string },
  fetcher: typeof fetch
): Promise<SiteCaptureResult> {
  const pageResponse = await fetcher(input.url, {
    headers: {
      "user-agent": CAPTURE_USER_AGENT
    }
  });

  if (!pageResponse.ok) {
    return {
      status: "failed",
      message: `Site capture request failed with status ${pageResponse.status}.`
    };
  }

  const html = await pageResponse.text();
  const stylesheetUrls = extractStylesheetUrls(html, input.url).slice(0, 8);
  const stylesheetWarnings: string[] = [];
  const stylesheets = await Promise.all(
    stylesheetUrls.map(async (stylesheetUrl) => {
      try {
        const stylesheetResponse = await fetcher(stylesheetUrl, {
          headers: {
            "user-agent": CAPTURE_USER_AGENT
          }
        });

        if (!stylesheetResponse.ok) {
          stylesheetWarnings.push(
            `Skipped stylesheet capture for ${stylesheetUrl} with status ${stylesheetResponse.status}.`
          );
          return null;
        }

        return {
          sourceRef: stylesheetUrl,
          content: await stylesheetResponse.text()
        };
      } catch {
        stylesheetWarnings.push(`Skipped stylesheet capture for ${stylesheetUrl}.`);
        return null;
      }
    })
  );

  return {
    status: "ok",
    mode: "fetch",
    html,
    stylesheets: stylesheets.filter((item): item is NonNullable<typeof item> => Boolean(item)),
    domNodes: extractDomNodesFromHtml(html),
    screenshots: [
      {
        label: "Primary viewport capture",
        sourceRef: `${input.url}#primary-viewport`
      }
    ],
    warnings: stylesheetWarnings
  };
}

async function captureSiteWithPlaywright(
  input: { url: string },
  options: {
    env?: NodeJS.ProcessEnv;
    fetcher: typeof fetch;
    loadPlaywright: () => Promise<PlaywrightModule>;
  }
): Promise<SiteCaptureResult> {
  const executablePath = resolveChromiumExecutablePath(options.env);
  const playwright = await options.loadPlaywright();
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath,
    args: ["--disable-dev-shm-usage", "--no-sandbox"]
  });
  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 900
    }
  });

  try {
    await page.goto(input.url, {
      waitUntil: "networkidle",
      timeout: DEFAULT_BROWSER_TIMEOUT_MS
    });

    const html = await page.content();
    await page.screenshot({
      type: "png",
      fullPage: false
    });

    const [rawStylesheetUrls, rawDomNodes] = await Promise.all([
      page.evaluate(() => {
        const doc = (globalThis as any).document;

        return Array.from(doc.querySelectorAll('link[rel*="stylesheet"]'))
          .map((node: any) => node.getAttribute("href"))
          .filter((href): href is string => Boolean(href))
      }),
      page.evaluate(() => {
        const doc = (globalThis as any).document;

        return Array.from(doc.querySelectorAll("button,input,nav,header,footer,section,a")).map(
          (node: any) => ({
            tag: node.tagName.toLowerCase(),
            className: node.getAttribute("class"),
            text: node.textContent?.replace(/\s+/g, " ").trim() || null
          })
        );
      })
    ]);
    const stylesheetUrls = rawStylesheetUrls as string[];
    const domNodes = rawDomNodes as SiteCaptureDomNode[];

    const warnings: string[] = [];
    const stylesheets: SiteCaptureStylesheet[] = [];

    for (const stylesheetHref of stylesheetUrls.slice(0, 8)) {
      try {
        const stylesheetUrl = new URL(stylesheetHref, input.url).toString();
        const stylesheetResponse = await options.fetcher(stylesheetUrl, {
          headers: {
            "user-agent": CAPTURE_USER_AGENT
          }
        });

        if (!stylesheetResponse.ok) {
          warnings.push(
            `Skipped stylesheet capture for ${stylesheetUrl} with status ${stylesheetResponse.status}.`
          );
          continue;
        }

        stylesheets.push({
          sourceRef: stylesheetUrl,
          content: await stylesheetResponse.text()
        });
      } catch {
        warnings.push(`Skipped stylesheet capture for ${stylesheetHref}.`);
      }
    }

    return {
      status: "ok",
      mode: "playwright",
      html,
      stylesheets,
      domNodes: domNodes
        .filter((node) => SUPPORTED_TAGS.includes(node.tag))
        .map((node) => ({
          tag: node.tag,
          className: node.className ?? null,
          text: node.text ?? null
        })),
      screenshots: [
        {
          label: "Primary viewport capture",
          sourceRef: `${input.url}#primary-viewport`
        }
      ],
      warnings
    };
  } finally {
    await page.close();
    await browser.close();
  }
}

export async function captureSite(
  input: { url: string },
  options: SiteCaptureOptions = {}
): Promise<SiteCaptureResult> {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const loadPlaywright =
    options.loadPlaywright ?? (async () => import("playwright-core"));

  if (env.PLAYWRIGHT_SITE_CAPTURE_DISABLED === "1") {
    return captureSiteWithFetch(input, fetcher);
  }

  try {
    const browserCapture = await captureSiteWithPlaywright(input, {
      env,
      fetcher,
      loadPlaywright
    });

    if (browserCapture.status === "ok") {
      return browserCapture;
    }
  } catch (error) {
    const fallbackCapture = await captureSiteWithFetch(input, fetcher);

    if (fallbackCapture.status === "ok") {
      return {
        ...fallbackCapture,
        warnings: [
          `Browser capture fallback activated: ${
            error instanceof Error ? error.message : "Unknown Playwright failure."
          }`,
          ...fallbackCapture.warnings
        ]
      };
    }

    return fallbackCapture;
  }

  return captureSiteWithFetch(input, fetcher);
}
