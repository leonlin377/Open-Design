import { expect, test } from "@playwright/test";

test.describe("studio core flow", () => {
  test("signs up and completes the core studio workflow", async ({ page }) => {
    const runId = Date.now();
    const accountName = `E2E ${runId}`;
    const accountEmail = `e2e-${runId}@example.com`;
    const projectName = `Atlas ${runId}`;
    const snapshotLabel = `Snapshot ${runId}`;
    const revisedSnapshotLabel = `Snapshot Revised ${runId}`;
    const initialHeadline = `Launch system ${runId}`;
    const updatedHeadline = `Changed ${runId}`;

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
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

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
    await expect(heroCard).toBeVisible();
    await heroCard.getByLabel("Headline").fill(initialHeadline);
    await heroCard.getByLabel("Body").fill("Initial hero copy for the Playwright flow.");
    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/studio\/.+/.test(response.url()) &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      heroCard.getByRole("button", { name: "Update Section" }).click()
    ]);
    await expect(heroCard.getByLabel("Headline")).toHaveValue(initialHeadline);

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
    await page.getByLabel("Summary").fill("Core flow regression snapshot.");
    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/studio\/.+/.test(response.url()) &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      page.getByRole("button", { name: "Save Snapshot" }).click()
    ]);
    await expect(
      page.locator(".kv").filter({
        has: page.getByText(new RegExp(`${snapshotLabel} · active`))
      })
    ).toBeVisible();

    await page.getByRole("button", { name: "Inspector" }).click();
    const heroCardAfterSnapshot = page.locator(".scene-node-list .project-card").filter({
      has: page.getByRole("heading", { name: "Hero Section" })
    });
    await heroCardAfterSnapshot.getByLabel("Headline").fill(updatedHeadline);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/studio\/.+/.test(response.url()) &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      heroCardAfterSnapshot.getByRole("button", { name: "Update Section" }).click()
    ]);
    await expect(heroCardAfterSnapshot.getByLabel("Headline")).toHaveValue(updatedHeadline);

    await page.getByRole("button", { name: "Versions" }).click();
    await page.getByLabel("Label").fill(revisedSnapshotLabel);
    await page.getByLabel("Summary").fill("Changed headline snapshot.");
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
      has: page.getByText(new RegExp(`${snapshotLabel}(?: · active)?`))
    });
    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/studio\/.+/.test(response.url()) &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      snapshotCard.getByRole("button", { name: "Restore Version" }).click()
    ]);

    await page.getByRole("button", { name: "Inspector" }).click();
    const restoredHeroCard = page.locator(".scene-node-list .project-card").filter({
      has: page.getByRole("heading", { name: "Hero Section" })
    });
    await expect(restoredHeroCard.getByLabel("Headline")).toHaveValue(initialHeadline);

    await page.getByRole("button", { name: "Export" }).click();
    const htmlDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download HTML" }).click();
    expect((await htmlDownload).suggestedFilename()).toMatch(/\.html$/);

    const zipDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download ZIP" }).click();
    expect((await zipDownload).suggestedFilename()).toMatch(/\.zip$/);
  });
});
