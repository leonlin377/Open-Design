import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("studio slides artifact flow", () => {
  test("signs up, creates slides artifact, appends slides, edits headline, saves version, and exports deck", async ({
    page
  }) => {
    const runId = Date.now();
    const accountName = `Slides ${runId}`;
    const accountEmail = `e2e-slides-${runId}@example.com`;
    const projectName = `Slides Atlas ${runId}`;
    const snapshotLabel = `Slides Snapshot ${runId}`;
    const updatedSlideHeadline = `Launch Thesis ${runId}`;

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
      projectCard.getByRole("button", { name: "Create slides" }).click()
    ]);

    await page.waitForURL(/\/studio\//);
    const studioUrl = page.url();
    const artifactPathMatch = studioUrl.match(/\/studio\/([^/?#]+)\/([^/?#]+)/);
    expect(artifactPathMatch).not.toBeNull();
    const projectId = artifactPathMatch![1]!;
    const artifactId = artifactPathMatch![2]!;

    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
    await expect(
      page.locator(".canvas-stage").getByRole("heading", { name: "Slides Deck" })
    ).toBeVisible();

    // Append hero template — surfaces as "Title Slide"
    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/studio\/.+/.test(response.url()) &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      page.getByRole("button", { name: "Add Title Slide" }).click()
    ]);

    const titleSlideCard = page.locator(".scene-node-list .project-card").filter({
      has: page.getByRole("heading", { name: "Title Slide" })
    });
    await expect(titleSlideCard).toBeVisible();
    await expect(titleSlideCard.getByLabel("Slide Name")).toBeVisible();

    // Append feature-grid template — surfaces as content slide ("Content Slide")
    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/studio\/.+/.test(response.url()) &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      page.getByRole("button", { name: "Add System Slide" }).click()
    ]);

    const contentSlideCard = page.locator(".scene-node-list .project-card").filter({
      has: page.getByRole("heading", { name: "Content Slide" })
    });
    await expect(contentSlideCard).toBeVisible();

    // Edit the second slide's headline via the scene inspector. The slide-content
    // node exposes a "Slide Headline" field (props.headline is always populated).
    await contentSlideCard.getByLabel("Slide Headline").fill(updatedSlideHeadline);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/studio\/.+/.test(response.url()) &&
          response.request().method() === "POST" &&
          response.status() === 200
      ),
      contentSlideCard.getByRole("button", { name: "Update Slide" }).click()
    ]);
    await expect(contentSlideCard.getByLabel("Slide Headline")).toHaveValue(
      updatedSlideHeadline
    );

    // Save a version snapshot
    await page.getByRole("button", { name: "Versions" }).click();
    await page.getByLabel("Label").fill(snapshotLabel);
    await page.getByLabel("Summary").fill("Slides deck regression snapshot.");
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

    // Navigate to Export panel and trigger slides-deck export via page.request
    // to bypass the browser download handling while reusing the session cookies.
    await page.getByRole("button", { name: "Export" }).click();
    const exportLink = page.getByRole("link", { name: "Download Deck JSON" });
    await expect(exportLink).toBeVisible();

    const deckUrl = `/studio/${projectId}/${artifactId}/export/slides-deck`;
    const deckResponse = await page.request.get(deckUrl);
    expect(deckResponse.status()).toBe(200);
    const deckPayload = (await deckResponse.json()) as {
      artifactKind: string;
      aspectRatio: string;
      slides: Array<{ id: string; role: string; headline?: string }>;
    };
    expect(deckPayload.artifactKind).toBe("slides");
    expect(deckPayload.aspectRatio).toBe("16:9");
    expect(Array.isArray(deckPayload.slides)).toBe(true);
    expect(deckPayload.slides.length).toBeGreaterThanOrEqual(2);

    // Trigger handoff-bundle export and verify download resolves.
    const handoffDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download Handoff ZIP" }).click();
    const downloaded = await handoffDownload;
    expect(downloaded.suggestedFilename()).toMatch(/\.zip$/);
  });
});
