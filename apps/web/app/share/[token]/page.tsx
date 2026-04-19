import Link from "next/link";
import { Badge, Surface } from "@opendesign/ui";
import { getSharedReview } from "../../../lib/opendesign-api";

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
          Read-only review surface generated from an OpenDesign share token. Use it for
          review handoff before adding roles and edit permissions.
        </p>
        <div className="hero-actions">
          <Badge tone="outline">{payload.resourceType}</Badge>
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
          </div>
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
              </div>
              <p className="footer-note">{payload.workspace.intent}</p>
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
          </>
        )}
      </div>
    </main>
  );
}
