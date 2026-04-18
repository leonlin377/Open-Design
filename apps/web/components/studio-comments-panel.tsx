import { Button, Surface } from "@opendesign/ui";
import type { ApiArtifactComment } from "../lib/opendesign-api";

type StudioCommentsPanelProps = {
  projectId: string;
  artifactId: string;
  workspaceIntent: string;
  frameLabel: string;
  syncStrategy: string;
  comments: ApiArtifactComment[];
  createArtifactCommentAction: (formData: FormData) => Promise<void>;
  resolveArtifactCommentAction: (formData: FormData) => Promise<void>;
};

export function StudioCommentsPanel({
  projectId,
  artifactId,
  workspaceIntent,
  frameLabel,
  syncStrategy,
  comments,
  createArtifactCommentAction,
  resolveArtifactCommentAction
}: StudioCommentsPanelProps) {
  return (
    <>
      <Surface className="kv">
        <span>Artifact Intent</span>
        {workspaceIntent}
      </Surface>
      <Surface className="kv">
        <span>Active Frame</span>
        {frameLabel}
      </Surface>
      <Surface className="kv">
        <span>Sync Strategy</span>
        {syncStrategy}
      </Surface>
      <Surface className="project-card" as="section">
        <div>
          <h3>Add Comment</h3>
          <p className="footer-note">
            Comments are anchored to the current canvas until direct element selection
            lands.
          </p>
        </div>
        <form action={createArtifactCommentAction} className="stack-form">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="artifactId" value={artifactId} />
          <label className="field">
            <span>Comment</span>
            <textarea
              name="body"
              placeholder="Tighten the left rail spacing and raise the eyebrow."
              rows={3}
              required
            />
          </label>
          <Button variant="outline" type="submit">
            Add Comment
          </Button>
        </form>
      </Surface>
      <Surface className="project-card" as="section">
        <div>
          <h3>Comment Threads</h3>
          <p className="footer-note">Resolve feedback as the artifact converges.</p>
        </div>
        <div className="stack-form">
          {comments.length === 0 ? <div className="footer-note">No comments yet.</div> : null}
          {comments.map((comment) => (
            <Surface key={comment.id} className="kv">
              <span>{comment.status} · {comment.anchor.elementId ?? "artifact-canvas"}</span>
              {comment.body}
              {comment.status === "open" ? (
                <form action={resolveArtifactCommentAction}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="artifactId" value={artifactId} />
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
    </>
  );
}
