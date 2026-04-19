import Link from "next/link";
import { Badge, Button, Surface } from "@opendesign/ui";
import { AuthPanel } from "../../components/auth-panel";
import { getSession, listArtifacts, listProjects } from "../../lib/opendesign-api";
import {
  createArtifactAction,
  createProjectAction,
  createProjectShareTokenAction
} from "./actions";

const artifactKinds = ["website", "prototype", "slides"] as const;

export default async function ProjectsPage() {
  const [session, projects] = await Promise.all([getSession(), listProjects()]);
  const projectsWithArtifacts = await Promise.all(
    projects.map(async (project) => ({
      project,
      artifacts: await listArtifacts(project.id)
    }))
  );

  return (
    <main className="page">
      <section className="hero">
        <Badge tone={session ? "accent" : "outline"}>Projects</Badge>
        <h1>
          {session
            ? `Workspace for ${session.user.name || session.user.email || "your account"}.`
            : "OpenDesign projects and artifacts."}
        </h1>
        <p>
          {session
            ? "Projects created from this browser session are scoped to your account. Spin up artifacts and jump straight into the studio."
            : "You can still create local projects without signing in, but an authenticated session keeps projects scoped to your account and portable across restarts."}
        </p>
        <div className="hero-actions">
          <Link href="/" className="button-link ghost">
            Back to Landing
          </Link>
        </div>
      </section>

      <section className="projects-dashboard">
        <AuthPanel session={session} />
        <Surface className="project-card" as="section">
          <div>
            <h3>Create Project</h3>
            <p className="footer-note">
              Start a new workspace. If you are signed in, it will be owned by your
              current account.
            </p>
          </div>
          <form action={createProjectAction} className="stack-form">
            <label className="field">
              <span>Project Name</span>
              <input name="name" placeholder="Atlas Commerce" required />
            </label>
            <Button variant="primary" type="submit">
              Create Project
            </Button>
          </form>
        </Surface>
      </section>

      <h2 className="section-title">Active Projects</h2>
      <div className="projects-grid">
        {projectsWithArtifacts.length === 0 ? (
          <Surface className="project-card" as="article">
            <div>
              <h3>No projects yet</h3>
              <p className="footer-note">
                Create the first workspace above, then add a website, prototype, or
                slides artifact.
              </p>
            </div>
          </Surface>
        ) : null}

        {projectsWithArtifacts.map(({ project, artifacts }) => (
          <Surface key={project.id} className="project-card" as="article">
            <div>
              <h3>{project.name}</h3>
              <p className="footer-note">
                {project.ownerUserId
                  ? "Owned workspace with session-scoped artifacts."
                  : "Local unowned workspace from the lightweight flow."}
              </p>
            </div>
            <div className="project-meta">
              {artifacts.map((artifact) => (
                <Badge key={artifact.id} tone="outline">
                  {artifact.kind}
                </Badge>
              ))}
              {artifacts.length === 0 ? <span>No artifacts yet</span> : null}
            </div>
            <div className="hero-actions">
              <form action={createProjectShareTokenAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <select name="role" defaultValue="viewer">
                  <option value="viewer">Viewer Link</option>
                  <option value="commenter">Commenter Link</option>
                  <option value="editor">Editor Link</option>
                </select>
                <Button variant="outline" size="sm" type="submit">
                  Share Project
                </Button>
              </form>
              {artifacts.map((artifact) => (
                <Link
                  key={artifact.id}
                  href={`/studio/${project.id}/${artifact.id}`}
                  className="button-link ghost"
                >
                  Open {artifact.kind}
                </Link>
              ))}
            </div>
            <div className="artifact-action-grid">
              {artifactKinds.map((kind) => (
                <form key={kind} action={createArtifactAction}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="projectName" value={project.name} />
                  <input type="hidden" name="kind" value={kind} />
                  <Button variant="outline" size="sm" type="submit">
                    Create {kind}
                  </Button>
                </form>
              ))}
            </div>
          </Surface>
        ))}
      </div>
    </main>
  );
}
