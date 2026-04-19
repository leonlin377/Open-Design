import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const host = process.env.OPENDESIGN_DOCKER_HOST ?? "127.0.0.1";
const webPort = Number(process.env.WEB_PORT ?? 3100);
const apiPort = Number(process.env.API_PORT ?? 4100);
const composeProjectName = process.env.OPENDESIGN_DOCKER_PROJECT ?? "opendesign-ops003";
const repoRoot = process.cwd();

function runDockerCompose(args: string[]) {
  execFileSync("docker", ["compose", "-p", composeProjectName, "--profile", "studio", ...args], {
    cwd: repoRoot,
    stdio: "inherit"
  });
}

async function waitForHttp(
  fetcher: () => Promise<{ ok: boolean }>,
  timeoutMs = 60_000,
  intervalMs = 1_000
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetcher();
      if (response.ok) {
        return;
      }
    } catch {
      // Service is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Timed out waiting for Docker smoke endpoint to become healthy.");
}

test.describe("studio docker smoke", () => {
  test("persists the core website workflow across api/web restarts", async ({
    page,
    request
  }) => {
    const runId = Date.now();
    const accountName = `Docker ${runId}`;
    const accountEmail = `docker-${runId}@example.com`;
    const projectName = `Docker Atlas ${runId}`;
    const snapshotLabel = `Docker Snapshot ${runId}`;
    const initialHeadline = `Docker hero ${runId}`;

    await page.goto("/projects");

    const authPanel = page.locator(".auth-panel");
    await authPanel.getByRole("button", { name: "Create Account" }).first().click();
    await authPanel.getByLabel("Name").fill(accountName);
    await authPanel.getByLabel("Email").fill(accountEmail);
    await authPanel.getByLabel("Password").fill("password123");
    await authPanel.getByRole("button", { name: "Create Account" }).last().click();

    await expect(authPanel.getByText("Session Active")).toBeVisible();
    await expect(authPanel.getByText(accountEmail)).toBeVisible();

    const createProjectCard = page.locator(".project-card").filter({
      has: page.getByRole("heading", { name: "Create Project" })
    });
    await createProjectCard.getByLabel("Project Name").fill(projectName);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/projects") &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      createProjectCard.getByRole("button", { name: "Create Project" }).click()
    ]);

    const projectCard = page.locator(".project-card").filter({
      has: page.getByRole("heading", { name: projectName })
    });
    await expect(projectCard).toBeVisible();
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/projects") &&
          response.request().method() === "POST" &&
          response.status() === 303
      ),
      projectCard.getByRole("button", { name: "Create website" }).click()
    ]);

    await page.waitForURL(/\/studio\//);
    const artifactUrl = page.url();

    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/studio\/.+/.test(response.url()) &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      page.getByRole("button", { name: "Add Hero" }).click()
    ]);

    const heroCard = page.locator(".scene-node-list .project-card").filter({
      has: page.getByRole("heading", { name: "Hero Section" })
    });
    await heroCard.getByLabel("Headline").fill(initialHeadline);
    await heroCard.getByLabel("Body").fill("Docker smoke hero copy.");
    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/studio\/.+/.test(response.url()) &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      heroCard.getByRole("button", { name: "Update Section" }).click()
    ]);

    await page.getByRole("button", { name: "Code" }).click();
    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/studio\/.+/.test(response.url()) &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      page.getByRole("button", { name: "Save Code Workspace" }).click()
    ]);
    await expect(page.locator(".studio-feedback")).toContainText(/saved code workspace/i);

    await page.getByRole("button", { name: "Versions" }).click();
    await page.getByLabel("Label").fill(snapshotLabel);
    await page.getByLabel("Summary").fill("Docker persistence smoke snapshot.");
    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/studio\/.+/.test(response.url()) &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      page.getByRole("button", { name: "Save Snapshot" }).click()
    ]);
    const snapshotCard = page.locator(".kv").filter({
      has: page.getByText(new RegExp(`${snapshotLabel} · active`))
    });
    await expect(snapshotCard).toBeVisible();

    runDockerCompose(["restart", "api", "web"]);

    await waitForHttp(async () => request.get(`http://${host}:${apiPort}/api/health`), 60_000);
    await waitForHttp(async () => request.get(`http://${host}:${webPort}/projects`), 60_000);

    await page.goto("/projects");
    await expect(authPanel.getByText("Session Active")).toBeVisible();
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

    await page.goto(artifactUrl);
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
    await page.getByRole("button", { name: "Inspector" }).click();
    const restoredHeroCard = page.locator(".scene-node-list .project-card").filter({
      has: page.getByRole("heading", { name: "Hero Section" })
    });
    await expect(restoredHeroCard.getByLabel("Headline")).toHaveValue(initialHeadline);

    await page.getByRole("button", { name: "Versions" }).click();
    await expect(snapshotCard).toBeVisible();

    await page.getByRole("button", { name: "Export" }).click();
    const htmlDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download HTML" }).click();
    expect((await htmlDownload).suggestedFilename()).toMatch(/\.html$/);

    const zipDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download ZIP" }).click();
    expect((await zipDownload).suggestedFilename()).toMatch(/\.zip$/);
  });
});
