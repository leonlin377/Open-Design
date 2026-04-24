import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("studio prototype artifact flow", () => {
  test("signs up, creates prototype artifact, appends screens, saves version, and exports flow", async ({
    page
  }) => {
    const runId = Date.now();
    const accountName = `Proto ${runId}`;
    const accountEmail = `e2e-proto-${runId}@example.com`;
    const projectName = `Proto Atlas ${runId}`;
    const snapshotLabel = `Proto Snapshot ${runId}`;

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
      projectCard.getByRole("button", { name: "Create prototype" }).click()
    ]);

    await page.waitForURL(/\/studio\//);
    const studioUrl = page.url();
    const artifactPathMatch = studioUrl.match(/\/studio\/([^/?#]+)\/([^/?#]+)/);
    expect(artifactPathMatch).not.toBeNull();
    const projectId = artifactPathMatch![1]!;
    const artifactId = artifactPathMatch![2]!;

    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Prototype Screens" })).toBeVisible();

    // Append hero template — surfaces as "Hero Screen"
    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/studio\/.+/.test(response.url()) &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      page.getByRole("button", { name: "Add Hero Screen" }).click()
    ]);

    const heroScreenCard = page.locator(".scene-node-list .project-card").filter({
      has: page.getByRole("heading", { name: "Hero Screen" })
    });
    await expect(heroScreenCard).toBeVisible();
    await expect(heroScreenCard.getByLabel("Screen Name")).toBeVisible();

    // Append cta template — surfaces as action screen "Action Screen"
    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/studio\/.+/.test(response.url()) &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      page.getByRole("button", { name: "Add Action Screen" }).click()
    ]);

    const actionScreenCard = page.locator(".scene-node-list .project-card").filter({
      has: page.getByRole("heading", { name: "Action Screen" })
    });
    await expect(actionScreenCard).toBeVisible();
    await expect(
      actionScreenCard.getByLabel("Primary Action Label")
    ).toBeVisible();

    // Save a version snapshot
    await page.getByRole("button", { name: "Versions" }).click();
    await page.getByLabel("Label").fill(snapshotLabel);
    await page.getByLabel("Summary").fill("Prototype flow regression snapshot.");
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

    // Navigate to Export panel and trigger prototype-flow export via page.request
    // to bypass the browser download handling while reusing the session cookies.
    await page.getByRole("button", { name: "Export" }).click();
    const exportLink = page.getByRole("link", { name: "Download Flow JSON" });
    await expect(exportLink).toBeVisible();

    const flowUrl = `/studio/${projectId}/${artifactId}/export/prototype-flow`;
    const flowResponse = await page.request.get(flowUrl);
    expect(flowResponse.status()).toBe(200);
    const flowPayload = (await flowResponse.json()) as {
      artifactKind: string;
      screens: Array<{ id: string; name: string }>;
      startScreenId: string | null;
    };
    expect(flowPayload.artifactKind).toBe("prototype");
    expect(Array.isArray(flowPayload.screens)).toBe(true);
    expect(flowPayload.screens.length).toBeGreaterThan(0);
    // Start screen is the first appended node (the hero screen).
    expect(flowPayload.startScreenId).toBe(flowPayload.screens[0]!.id);
    expect(flowPayload.screens[0]!.name).toBe("Hero Screen");

    // Trigger handoff-bundle export and verify download resolves.
    const handoffDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download Handoff ZIP" }).click();
    const downloaded = await handoffDownload;
    expect(downloaded.suggestedFilename()).toMatch(/\.zip$/);
  });
});
