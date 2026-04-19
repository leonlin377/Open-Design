import { defineConfig } from "@playwright/test";

const host = process.env.OPENDESIGN_DOCKER_HOST ?? "127.0.0.1";
const webPort = Number(process.env.WEB_PORT ?? 3100);

export default defineConfig({
  testDir: "./apps/web/e2e",
  timeout: 180_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  workers: 1,
  outputDir: "output/playwright-docker",
  use: {
    baseURL: `http://${host}:${webPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  }
});
