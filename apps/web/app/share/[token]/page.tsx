import Link from "next/link";
import { Badge, Button, Surface } from "@opendesign/ui";
import { buildCommentAnchorOptions } from "../../../components/comment-anchor-options";
import { getArtifactEditorAffordance } from "../../../components/studio-artifact-affordances";
import { StudioSceneSectionsPanel } from "../../../components/studio-scene-sections-panel";
import { getSharedReview } from "../../../lib/opendesign-api";
import {
  appendSharedSceneTemplateAction,
  createSharedArtifactCommentAction,
  resolveSharedArtifactCommentAction,
  updateSharedSceneNodeAction
} from "./actions";

type SharedReviewPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function SharedReviewPage({ params }: SharedReviewPageProps) {
  const { token } = await params;
  const payload = await getSharedReview(token);

  if (!payload) {
    return (
      <main className="page">
        <section className="hero">
          <Badge tone="outline">Shared Review</Badge>
          <h1>Share link not found.</h1>
          <p>
            This share token is missing or has expired. Ask the project owner to create a
            fresh review link.
          </p>
          <div className="hero-actions">
            <Link href="/" className="button-link ghost">
              Back to Landing
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const roleDescription =
    payload.share.role === "editor"
      ? "This link can comment, resolve threads, and edit supported scene fields."
      : payload.share.role === "commenter"
        ? "This link can add comments but cannot modify the artifact."
        : "This link is view-only.";

  return (
    <main className="page">
      <section className="hero">
        <Badge tone="accent">Shared Review</Badge>
        <h1>
          {payload.resourceType === "project"
            ? `${payload.project.name} Project Review`
            : `${payload.artifact.name} Artifact Review`}
        </h1>
        <p>
          Shared review surface generated from an OpenDesign share token with explicit
          role-based permissions.
        </p>
        <div className="hero-actions">
          <Badge tone="outline">{payload.resourceType}</Badge>
          <Badge tone="outline">{payload.share.role}</Badge>
          <Badge tone="outline">Token {payload.share.token.slice(0, 8)}</Badge>
          <Link href="/" className="button-link ghost">
            OpenDesign
          </Link>
        </div>
      </section>

      <div className="projects-grid">
        <Surface className="project-card" as="section">
          <div>
            <h3>{payload.project.name}</h3>
            <p className="footer-note">
              Project created {new Date(payload.project.createdAt).toLocaleString("zh-CN")}
            </p>
          </div>
          <div className="project-meta">
            <span>Project ID: {payload.project.id}</span>
            <span>Owner: {payload.project.ownerUserId ?? "local"}</span>
            <span>Permission: {payload.share.role}</span>
          </div>
          <p className="footer-note">{roleDescription}</p>
        </Surface>

        {payload.resourceType === "project" ? (
          <Surface className="project-card" as="section">
            <div>
              <h3>Artifacts</h3>
              <p className="footer-note">
                {payload.artifacts.length} artifact
                {payload.artifacts.length === 1 ? "" : "s"} ready for review.
              </p>
            </div>
            <div className="project-meta">
              {payload.artifacts.map((artifact) => (
                <Badge key={artifact.id} tone="outline">
                  {artifact.kind}
                </Badge>
              ))}
            </div>
            <div className="stack-form">
              {payload.artifacts.map((artifact) => (
                <Surface key={artifact.id} className="project-card" as="article">
                  <div>
                    <h3>{artifact.name}</h3>
                    <p className="footer-note">
                      {artifact.kind} · updated{" "}
                      {new Date(artifact.updatedAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                </Surface>
              ))}
            </div>
          </Surface>
        ) : (
          <>
            {(() => {
              const affordance = getArtifactEditorAffordance(payload.artifact.kind);
              const canComment =
                payload.share.role === "commenter" || payload.share.role === "editor";
              const canEdit = payload.share.role === "editor";
              const anchorOptions = buildCommentAnchorOptions(
                payload.sceneNodes,
                "Shared Artifact Canvas"
              );

              return (
                <>
            <Surface className="project-card" as="section">
              <div>
                <h3>{payload.artifact.name}</h3>
                <p className="footer-note">
                  {payload.artifact.kind} · updated{" "}
                  {new Date(payload.artifact.updatedAt).toLocaleString("zh-CN")}
                </p>
              </div>
              <div className="project-meta">
                <span>Scene v{payload.workspace.sceneVersion}</span>
                <span>{payload.workspace.rootNodeCount} root nodes</span>
                <span>{payload.workspace.versionCount} snapshots</span>
                <span>{payload.workspace.openCommentCount} open comments</span>
                <span>{payload.share.role} access</span>
              </div>
              <p className="footer-note">{payload.workspace.intent}</p>
              <p className="footer-note">{roleDescription}</p>
            </Surface>

            <Surface className="project-card" as="section">
              <div>
                <h3>Latest Snapshot</h3>
                <p className="footer-note">
                  {payload.latestVersion
                    ? `${payload.latestVersion.label} · ${payload.latestVersion.summary}`
                    : "No snapshots yet"}
                </p>
              </div>
              {payload.latestVersion ? (
                <div className="project-meta">
                  <span>Source: {payload.latestVersion.source}</span>
                  <span>Scene v{payload.latestVersion.sceneVersion}</span>
                  <span>
                    {payload.latestVersion.hasCodeWorkspaceSnapshot
                      ? "Includes code workspace"
                      : "Scene only"}
                  </span>
                </div>
              ) : null}
            </Surface>

            {canComment ? (
              <Surface className="project-card" as="section">
                <div>
                  <h3>Add Comment</h3>
                  <p className="footer-note">
                    Shared review comments can target the canvas or a specific scene node.
                  </p>
                </div>
                <form action={createSharedArtifactCommentAction} className="stack-form">
                  <input type="hidden" name="shareToken" value={payload.share.token} />
                  <label className="field">
                    <span>Anchor Target</span>
                    <select name="anchorTarget" defaultValue={anchorOptions[0]?.value} required>
                      {anchorOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Comment</span>
                    <textarea
                      name="body"
                      placeholder="Flag copy changes, layout concerns, or export feedback."
                      rows={3}
                      required
                    />
                  </label>
                  <Button variant="outline" type="submit">
                    Add Comment
                  </Button>
                </form>
              </Surface>
            ) : null}

            <Surface className="project-card" as="section">
              <div>
                <h3>Comment Threads</h3>
                <p className="footer-note">
                  {canEdit
                    ? "Editors can resolve open feedback from the shared review page."
                    : "Review threads stay visible on shared links."}
                </p>
              </div>
              <div className="stack-form">
                {payload.comments.length === 0 ? (
                  <div className="footer-note">No comments yet.</div>
                ) : null}
                {payload.comments.map((comment) => (
                  <Surface key={comment.id} className="kv">
                    <span>{comment.status} · {comment.anchor.elementId ?? "artifact-canvas"}</span>
                    {comment.body}
                    {canEdit && comment.status === "open" ? (
                      <form action={resolveSharedArtifactCommentAction}>
                        <input type="hidden" name="shareToken" value={payload.share.token} />
                        <input type="hidden" name="commentId" value={comment.id} />
                        <Button variant="ghost" size="sm" type="submit">
                          Resolve
                        </Button>
                      </form>
                    ) : null}
                  </Surface>
                ))}
              </div>
            </Surface>

            {canEdit ? (
              <StudioSceneSectionsPanel
                projectId={payload.project.id}
                artifactId={payload.artifact.id}
                shareToken={payload.share.token}
                artifactKind={payload.artifact.kind}
                sceneNodes={payload.sceneNodes}
                appendSceneTemplateAction={appendSharedSceneTemplateAction}
                updateSceneNodeAction={updateSharedSceneNodeAction}
              />
            ) : (
              <Surface className="project-card" as="section">
                <div>
                  <h3>{affordance.panelTitle}</h3>
                  <p className="footer-note">
                    Scene editing is restricted to editor links. This review shows{" "}
                    {payload.sceneNodes.length} {affordance.unitLabel}
                    {payload.sceneNodes.length === 1 ? "" : "s"} in the current artifact.
                  </p>
                </div>
              </Surface>
            )}
                </>
              );
            })()}
          </>
        )}
      </div>
    </main>
  );
}
