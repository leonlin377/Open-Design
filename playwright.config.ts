import { defineConfig } from "@playwright/test";

const host = "127.0.0.1";
const webPort = 3100;
const apiPort = 4100;

export default defineConfig({
  testDir: "./apps/web/e2e",
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  workers: 1,
  outputDir: "output/playwright",
  use: {
    baseURL: `http://${host}:${webPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: [
    {
      command: "pnpm --filter @opendesign/api dev",
      url: `http://${host}:${apiPort}/api/health`,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        HOST: host,
        PORT: String(apiPort),
        NODE_ENV: "test",
        BETTER_AUTH_SECRET: "opendesign-playwright-secret",
        BETTER_AUTH_URL: `http://${host}:${apiPort}`,
        WEB_BASE_URL: `http://${host}:${webPort}`,
        PLAYWRIGHT_SITE_CAPTURE_DISABLED: "1"
      }
    },
    {
      command: `pnpm --filter @opendesign/web exec next dev --hostname ${host} --port ${webPort}`,
      url: `http://${host}:${webPort}/projects`,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        HOST: host,
        PORT: String(webPort),
        NODE_ENV: "test",
        NEXT_TELEMETRY_DISABLED: "1",
        OPENDESIGN_API_INTERNAL_URL: `http://${host}:${apiPort}`,
        NEXT_PUBLIC_API_ORIGIN: `http://${host}:${apiPort}`,
        NEXTAUTH_URL: `http://${host}:${apiPort}`
      }
    }
  ]
});
