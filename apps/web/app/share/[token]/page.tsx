import Link from "next/link";
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Container,
  EmptyState,
  FormField,
  Heading,
  Inline,
  Select,
  Stack,
  Surface,
  Text,
  Textarea
} from "@opendesign/ui";
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
      <Container width="lg" as="main" className="page">
        <section className="hero">
          <Badge tone="outline">Shared Review</Badge>
          <Heading level={1} variant="display">Share link not found.</Heading>
          <Text as="p" variant="body-l" tone="secondary">
            This share token is missing or has expired. Ask the project owner to create a
            fresh review link.
          </Text>
          <Inline gap={3} className="hero-actions">
            <Link href="/" className="button-link ghost">
              Back to Landing
            </Link>
          </Inline>
        </section>
      </Container>
    );
  }

  const roleDescription =
    payload.share.role === "editor"
      ? "This link can comment, resolve threads, and edit supported scene fields."
      : payload.share.role === "commenter"
        ? "This link can add comments but cannot modify the artifact."
        : "This link is view-only.";

  const breadcrumbItems =
    payload.resourceType === "project"
      ? [{ label: payload.project.name, current: true }]
      : [
          { label: payload.project.name },
          { label: payload.artifact.name, current: true }
        ];

  return (
    <Container width="lg" as="main" className="page">
      <Breadcrumb items={breadcrumbItems} ariaLabel="Shared review breadcrumb" />
      <section className="hero">
        <Badge tone="accent">Shared Review</Badge>
        <Heading level={1} variant="display">
          {payload.resourceType === "project"
            ? `${payload.project.name} Project Review`
            : `${payload.artifact.name} Artifact Review`}
        </Heading>
        <Text as="p" variant="body-l" tone="secondary">
          Shared review surface generated from an OpenDesign share token with explicit
          role-based permissions.
        </Text>
        <Inline gap={2} wrap className="hero-actions">
          <Badge tone="outline">{payload.resourceType}</Badge>
          <Badge tone="outline">{payload.share.role}</Badge>
          <Badge tone="outline">Token {payload.share.token.slice(0, 8)}</Badge>
          <Link href="/" className="button-link ghost">
            OpenDesign
          </Link>
        </Inline>
      </section>

      <div className="projects-grid">
        <Surface className="project-card" as="section">
          <Stack gap={3}>
            <Stack gap={2}>
              <Heading level={3} variant="title-m">{payload.project.name}</Heading>
              <Text as="p" variant="body-s" tone="muted" className="footer-note">
                Project created {new Date(payload.project.createdAt).toLocaleString("zh-CN")}
              </Text>
            </Stack>
            <Inline gap={3} wrap className="project-meta">
              <Text as="span" variant="body-s" tone="muted">Project ID: {payload.project.id}</Text>
              <Text as="span" variant="body-s" tone="muted">Owner: {payload.project.ownerUserId ?? "local"}</Text>
              <Text as="span" variant="body-s" tone="muted">Permission: {payload.share.role}</Text>
            </Inline>
            <Text as="p" variant="body-s" tone="muted" className="footer-note">{roleDescription}</Text>
          </Stack>
        </Surface>

        {payload.resourceType === "project" ? (
          <Surface className="project-card" as="section">
            <Stack gap={3}>
              <Stack gap={2}>
                <Heading level={3} variant="title-m">Artifacts</Heading>
                <Text as="p" variant="body-s" tone="muted" className="footer-note">
                  {payload.artifacts.length} artifact
                  {payload.artifacts.length === 1 ? "" : "s"} ready for review.
                </Text>
              </Stack>
              <Inline gap={2} wrap className="project-meta">
                {payload.artifacts.map((artifact) => (
                  <Badge key={artifact.id} tone="outline">
                    {artifact.kind}
                  </Badge>
                ))}
              </Inline>
              <Stack gap={3} className="stack-form">
                {payload.artifacts.map((artifact) => (
                  <Surface key={artifact.id} className="project-card" as="article">
                    <Stack gap={2}>
                      <Heading level={3} variant="title-s">{artifact.name}</Heading>
                      <Text as="p" variant="body-s" tone="muted" className="footer-note">
                        {artifact.kind} · updated{" "}
                        {new Date(artifact.updatedAt).toLocaleString("zh-CN")}
                      </Text>
                    </Stack>
                  </Surface>
                ))}
              </Stack>
            </Stack>
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
              <Stack gap={3}>
                <Stack gap={2}>
                  <Heading level={3} variant="title-m">{payload.artifact.name}</Heading>
                  <Text as="p" variant="body-s" tone="muted" className="footer-note">
                    {payload.artifact.kind} · updated{" "}
                    {new Date(payload.artifact.updatedAt).toLocaleString("zh-CN")}
                  </Text>
                </Stack>
                <Inline gap={3} wrap className="project-meta">
                  <Text as="span" variant="body-s" tone="muted">Scene v{payload.workspace.sceneVersion}</Text>
                  <Text as="span" variant="body-s" tone="muted">{payload.workspace.rootNodeCount} root nodes</Text>
                  <Text as="span" variant="body-s" tone="muted">{payload.workspace.versionCount} snapshots</Text>
                  <Text as="span" variant="body-s" tone="muted">{payload.workspace.openCommentCount} open comments</Text>
                  <Text as="span" variant="body-s" tone="muted">{payload.share.role} access</Text>
                </Inline>
                <Text as="p" variant="body-s" tone="muted" className="footer-note">{payload.workspace.intent}</Text>
                <Text as="p" variant="body-s" tone="muted" className="footer-note">{roleDescription}</Text>
              </Stack>
            </Surface>

            <Surface className="project-card" as="section">
              <Stack gap={3}>
                <Stack gap={2}>
                  <Heading level={3} variant="title-m">Latest Snapshot</Heading>
                  <Text as="p" variant="body-s" tone="muted" className="footer-note">
                    {payload.latestVersion
                      ? `${payload.latestVersion.label} · ${payload.latestVersion.summary}`
                      : "No snapshots yet"}
                  </Text>
                </Stack>
                {payload.latestVersion ? (
                  <Inline gap={3} wrap className="project-meta">
                    <Text as="span" variant="body-s" tone="muted">Source: {payload.latestVersion.source}</Text>
                    <Text as="span" variant="body-s" tone="muted">Scene v{payload.latestVersion.sceneVersion}</Text>
                    <Text as="span" variant="body-s" tone="muted">
                      {payload.latestVersion.hasCodeWorkspaceSnapshot
                        ? "Includes code workspace"
                        : "Scene only"}
                    </Text>
                  </Inline>
                ) : null}
              </Stack>
            </Surface>

            {canComment ? (
              <Surface className="project-card" as="section">
                <Stack gap={3}>
                  <Stack gap={2}>
                    <Heading level={3} variant="title-m">Add Comment</Heading>
                    <Text as="p" variant="body-s" tone="muted" className="footer-note">
                      Shared review comments can target the canvas or a specific scene node.
                    </Text>
                  </Stack>
                  <form action={createSharedArtifactCommentAction} className="stack-form">
                    <Stack gap={3}>
                      <input type="hidden" name="shareToken" value={payload.share.token} />
                      <FormField label="Anchor Target">
                        <Select
                          name="anchorTarget"
                          defaultValue={anchorOptions[0]?.value}
                          required
                          options={anchorOptions.map((option) => ({
                            value: option.value,
                            label: option.label
                          }))}
                        />
                      </FormField>
                      <FormField label="Comment">
                        <Textarea
                          name="body"
                          placeholder="Flag copy changes, layout concerns, or export feedback."
                          rows={3}
                          required
                        />
                      </FormField>
                      <Button variant="outline" type="submit">
                        Add Comment
                      </Button>
                    </Stack>
                  </form>
                </Stack>
              </Surface>
            ) : null}

            <Surface className="project-card" as="section">
              <Stack gap={3}>
                <Stack gap={2}>
                  <Heading level={3} variant="title-m">Comment Threads</Heading>
                  <Text as="p" variant="body-s" tone="muted" className="footer-note">
                    {canEdit
                      ? "Editors can resolve open feedback from the shared review page."
                      : "Review threads stay visible on shared links."}
                  </Text>
                </Stack>
                <Stack gap={3} className="stack-form">
                  {payload.comments.length === 0 ? (
                    <EmptyState
                      title="No comments yet."
                      body="Comments added through this shared link will appear here."
                    />
                  ) : null}
                  {payload.comments.map((comment) => {
                    const anchorLabel = comment.anchor.elementId ?? "artifact-canvas";
                    return (
                      <Surface key={comment.id} as="article">
                        <Inline gap={3} align="start">
                          <Avatar size="sm" name={anchorLabel} />
                          <Stack gap={2} style={{ flex: "1 1 auto", minWidth: 0 }}>
                            <Inline gap={2} align="center" wrap>
                              <Text as="span" variant="body-s">
                                {comment.status} · {anchorLabel}
                              </Text>
                              <Text as="span" variant="caption" tone="muted">
                                {new Date(comment.createdAt).toLocaleString("zh-CN")}
                              </Text>
                            </Inline>
                            <Text as="p" variant="body-s">{comment.body}</Text>
                            {canEdit && comment.status === "open" ? (
                              <form action={resolveSharedArtifactCommentAction}>
                                <input type="hidden" name="shareToken" value={payload.share.token} />
                                <input type="hidden" name="commentId" value={comment.id} />
                                <Button variant="ghost" size="sm" type="submit">
                                  Resolve
                                </Button>
                              </form>
                            ) : null}
                          </Stack>
                        </Inline>
                      </Surface>
                    );
                  })}
                </Stack>
              </Stack>
            </Surface>

            {canEdit ? (
              <StudioSceneSectionsPanel
                projectId={payload.project.id}
                artifactId={payload.artifact.id}
                shareToken={payload.share.token}
                artifactKind={payload.artifact.kind}
                assets={[]}
                sceneNodes={payload.sceneNodes}
                appendSceneTemplateAction={appendSharedSceneTemplateAction}
                updateSceneNodeAction={updateSharedSceneNodeAction}
                uploadArtifactAssetAction={async () => {
                  throw new Error("Shared artifact uploads are not supported.");
                }}
              />
            ) : (
              <Surface className="project-card" as="section">
                <Stack gap={2}>
                  <Heading level={3} variant="title-m">{affordance.panelTitle}</Heading>
                  <Text as="p" variant="body-s" tone="muted" className="footer-note">
                    Scene editing is restricted to editor links. This review shows{" "}
                    {payload.sceneNodes.length} {affordance.unitLabel}
                    {payload.sceneNodes.length === 1 ? "" : "s"} in the current artifact.
                  </Text>
                </Stack>
              </Surface>
            )}
                </>
              );
            })()}
          </>
        )}
      </div>
    </Container>
  );
}
