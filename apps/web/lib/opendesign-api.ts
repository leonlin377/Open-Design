import "server-only";

import { cookies } from "next/headers";
import type {
  ArtifactComment,
  ArtifactGenerationPlan,
  ArtifactWorkspace,
  SceneTemplateKind,
  ArtifactVersionSnapshot
} from "@opendesign/contracts";

export type ApiSession = {
  session: {
    id: string;
  };
  user: {
    id: string;
    email?: string;
    name?: string | null;
  };
} | null;

export type ApiProject = {
  id: string;
  name: string;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiArtifact = {
  id: string;
  projectId: string;
  name: string;
  kind: "website" | "prototype" | "slides";
  createdAt: string;
  updatedAt: string;
};

export type ApiArtifactWorkspace = ArtifactWorkspace;
export type ApiArtifactVersion = ArtifactVersionSnapshot;
export type ApiArtifactComment = ArtifactComment;

export type ApiArtifactWorkspacePayload = {
  artifact: ApiArtifact;
  workspace: ApiArtifactWorkspace;
  versions: ApiArtifactVersion[];
  comments: ApiArtifactComment[];
};

export function getBrowserApiOrigin() {
  return process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:4000";
}

function getInternalApiOrigin() {
  return process.env.OPENDESIGN_API_INTERNAL_URL ?? getBrowserApiOrigin();
}

async function buildServerHeaders(init?: HeadersInit) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const headers = new Headers(init);

  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  return headers;
}

async function apiFetch(path: string, init?: RequestInit) {
  const headers = await buildServerHeaders(init?.headers);

  return fetch(`${getInternalApiOrigin()}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });
}

export async function getSession(): Promise<ApiSession> {
  const response = await apiFetch("/api/auth/session");

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { session: ApiSession };
  return payload.session;
}

export async function listProjects(): Promise<ApiProject[]> {
  const response = await apiFetch("/api/projects");

  if (!response.ok) {
    throw new Error(`Failed to load projects (${response.status})`);
  }

  return (await response.json()) as ApiProject[];
}

export async function getProject(projectId: string): Promise<ApiProject | null> {
  const response = await apiFetch(`/api/projects/${projectId}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load project (${response.status})`);
  }

  return (await response.json()) as ApiProject;
}

export async function createProject(input: { name: string }) {
  const response = await apiFetch("/api/projects", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Failed to create project (${response.status})`);
  }

  return (await response.json()) as ApiProject;
}

export async function listArtifacts(projectId: string): Promise<ApiArtifact[]> {
  const response = await apiFetch(`/api/projects/${projectId}/artifacts`);

  if (!response.ok) {
    throw new Error(`Failed to load artifacts (${response.status})`);
  }

  return (await response.json()) as ApiArtifact[];
}

export async function getArtifact(
  projectId: string,
  artifactId: string
): Promise<ApiArtifact | null> {
  const response = await apiFetch(`/api/projects/${projectId}/artifacts/${artifactId}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load artifact (${response.status})`);
  }

  return (await response.json()) as ApiArtifact;
}

export async function createArtifact(input: {
  projectId: string;
  name: string;
  kind: ApiArtifact["kind"];
}) {
  const response = await apiFetch(`/api/projects/${input.projectId}/artifacts`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      name: input.name,
      kind: input.kind
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create artifact (${response.status})`);
  }

  return (await response.json()) as ApiArtifact;
}

export async function getArtifactWorkspace(
  projectId: string,
  artifactId: string
): Promise<ApiArtifactWorkspacePayload | null> {
  const response = await apiFetch(`/api/projects/${projectId}/artifacts/${artifactId}/workspace`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load artifact workspace (${response.status})`);
  }

  return (await response.json()) as ApiArtifactWorkspacePayload;
}

export async function createArtifactVersion(input: {
  projectId: string;
  artifactId: string;
  label: string;
  summary?: string;
}) {
  const response = await apiFetch(
    `/api/projects/${input.projectId}/artifacts/${input.artifactId}/versions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        label: input.label,
        summary: input.summary
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create version (${response.status})`);
  }

  return (await response.json()) as ApiArtifactVersion;
}

export async function generateArtifact(input: {
  projectId: string;
  artifactId: string;
  prompt: string;
}) {
  const response = await apiFetch(
    `/api/projects/${input.projectId}/artifacts/${input.artifactId}/generate`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        prompt: input.prompt
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to generate artifact (${response.status})`);
  }

  return (await response.json()) as {
    plan: ArtifactGenerationPlan;
    appendedNodes: Array<{
      id: string;
      type: string;
      name: string;
    }>;
    version: ApiArtifactVersion;
    workspace: ApiArtifactWorkspace;
  };
}

export async function restoreArtifactVersion(input: {
  projectId: string;
  artifactId: string;
  versionId: string;
}) {
  const response = await apiFetch(
    `/api/projects/${input.projectId}/artifacts/${input.artifactId}/versions/${input.versionId}/restore`,
    {
      method: "POST"
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to restore version (${response.status})`);
  }

  return (await response.json()) as {
    workspace: ApiArtifactWorkspace;
    restoredVersion: ApiArtifactVersion;
  };
}

export async function createArtifactComment(input: {
  projectId: string;
  artifactId: string;
  body: string;
  anchor?: ArtifactComment["anchor"];
}) {
  const response = await apiFetch(
    `/api/projects/${input.projectId}/artifacts/${input.artifactId}/comments`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        body: input.body,
        anchor:
          input.anchor ?? {
            elementId: "artifact-canvas",
            selectionPath: ["artifact-canvas"]
          }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create comment (${response.status})`);
  }

  return (await response.json()) as ApiArtifactComment;
}

export async function resolveArtifactComment(input: {
  projectId: string;
  artifactId: string;
  commentId: string;
}) {
  const response = await apiFetch(
    `/api/projects/${input.projectId}/artifacts/${input.artifactId}/comments/${input.commentId}/resolve`,
    {
      method: "POST"
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to resolve comment (${response.status})`);
  }

  return (await response.json()) as ApiArtifactComment;
}

export async function appendSceneTemplate(input: {
  projectId: string;
  artifactId: string;
  template: SceneTemplateKind;
}) {
  const response = await apiFetch(
    `/api/projects/${input.projectId}/artifacts/${input.artifactId}/scene/nodes`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        template: input.template
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to append scene template (${response.status})`);
  }

  return (await response.json()) as {
    workspace: ApiArtifactWorkspace;
    appendedNode: {
      id: string;
      type: string;
      name: string;
    };
  };
}

export async function updateSceneNode(input: {
  projectId: string;
  artifactId: string;
  nodeId: string;
  name?: string;
  eyebrow?: string;
  headline?: string;
  body?: string;
  title?: string;
  items?: Array<{
    label: string;
    body: string;
  }>;
  primaryAction?: string;
  secondaryAction?: string;
}) {
  const response = await apiFetch(
    `/api/projects/${input.projectId}/artifacts/${input.artifactId}/scene/nodes/${input.nodeId}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(
        Object.fromEntries(
          Object.entries({
            name: input.name,
            eyebrow: input.eyebrow,
            headline: input.headline,
            body: input.body,
            title: input.title,
            items: input.items,
            primaryAction: input.primaryAction,
            secondaryAction: input.secondaryAction
          }).filter(([, value]) => {
            if (typeof value === "string") {
              return value.trim().length > 0;
            }

            if (Array.isArray(value)) {
              return value.length > 0;
            }

            return false;
          })
        )
      )
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update scene node (${response.status})`);
  }

  return (await response.json()) as {
    workspace: ApiArtifactWorkspace;
  };
}

export async function saveArtifactCodeWorkspace(input: {
  projectId: string;
  artifactId: string;
  files: Record<string, string>;
  expectedUpdatedAt: string | null;
}) {
  const response = await apiFetch(
    `/api/projects/${input.projectId}/artifacts/${input.artifactId}/code-workspace`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        files: input.files,
        expectedUpdatedAt: input.expectedUpdatedAt
      })
    }
  );

  if (response.status === 409) {
    const payload = (await response.json()) as {
      error: string;
      code: string;
      currentUpdatedAt: string | null;
    };

    return {
      status: "conflict" as const,
      message: payload.error,
      currentUpdatedAt: payload.currentUpdatedAt
    };
  }

  if (!response.ok) {
    throw new Error(`Failed to save code workspace (${response.status})`);
  }

  const payload = (await response.json()) as {
    workspace: ApiArtifactWorkspace;
    previousCodeWorkspaceUpdatedAt: string | null;
  };

  return {
    status: "saved" as const,
    workspace: payload.workspace,
    previousCodeWorkspaceUpdatedAt: payload.previousCodeWorkspaceUpdatedAt
  };
}
