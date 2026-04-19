import "server-only";

import { cookies } from "next/headers";
import type {
  ApiError,
  ArtifactGenerateResponse,
  ArtifactComment,
  CommentAnchor,
  ArtifactVersionDiffSummary,
  ArtifactWorkspace,
  SceneTemplateKind,
  ArtifactVersionSnapshot,
  DesignSystemPack,
  ShareRole,
  ShareReviewPayload,
  ShareToken
} from "@opendesign/contracts";
import {
  buildApiRequestError,
  parseApiErrorPayload,
  readApiErrorMessage
} from "./api-errors";

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
export type ApiArtifactGenerateResponse = ArtifactGenerateResponse;
export type ApiErrorPayload = ApiError;
export type ApiDesignSystemPack = DesignSystemPack & {
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiShareToken = ShareToken;
export type ApiShareReviewPayload = ShareReviewPayload;
export type ApiShareTokenCreateResponse = {
  share: ApiShareToken;
  sharePath: string;
};

export type ApiArtifactWorkspacePayload = {
  artifact: ApiArtifact;
  workspace: ApiArtifactWorkspace;
  versions: ApiArtifactVersion[];
  comments: ApiArtifactComment[];
};

export type ApiArtifactVersionDiff = ArtifactVersionDiffSummary;

export function getDesignSystemAssetUrl(assetId: string) {
  return `/api/design-systems/assets/${assetId}`;
}

export function getBrowserApiOrigin() {
  return process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:4000";
}

export function getInternalApiOrigin() {
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

async function throwApiResponseError(response: Response, fallback: string): Promise<never> {
  throw await buildApiRequestError(response, fallback);
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
    await throwApiResponseError(response, `Failed to load projects (${response.status})`);
  }

  return (await response.json()) as ApiProject[];
}

export async function listDesignSystems(): Promise<ApiDesignSystemPack[]> {
  const response = await apiFetch("/api/design-systems");

  if (!response.ok) {
    await throwApiResponseError(
      response,
      `Failed to load design systems (${response.status})`
    );
  }

  return (await response.json()) as ApiDesignSystemPack[];
}

export async function getProject(projectId: string): Promise<ApiProject | null> {
  const response = await apiFetch(`/api/projects/${projectId}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    await throwApiResponseError(response, `Failed to load project (${response.status})`);
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
    await throwApiResponseError(response, `Failed to create project (${response.status})`);
  }

  return (await response.json()) as ApiProject;
}

export async function createProjectShareToken(input: {
  projectId: string;
  role: ShareRole;
}) {
  const response = await apiFetch(`/api/projects/${input.projectId}/share-tokens`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      role: input.role
    })
  });

  if (!response.ok) {
    await throwApiResponseError(
      response,
      `Failed to create project share token (${response.status})`
    );
  }

  return (await response.json()) as ApiShareTokenCreateResponse;
}

export async function listArtifacts(projectId: string): Promise<ApiArtifact[]> {
  const response = await apiFetch(`/api/projects/${projectId}/artifacts`);

  if (!response.ok) {
    await throwApiResponseError(response, `Failed to load artifacts (${response.status})`);
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
    await throwApiResponseError(response, `Failed to load artifact (${response.status})`);
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
    await throwApiResponseError(response, `Failed to create artifact (${response.status})`);
  }

  return (await response.json()) as ApiArtifact;
}

export async function createArtifactShareToken(input: {
  projectId: string;
  artifactId: string;
  role: ShareRole;
}) {
  const response = await apiFetch(
    `/api/projects/${input.projectId}/artifacts/${input.artifactId}/share-tokens`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        role: input.role
      })
    }
  );

  if (!response.ok) {
    await throwApiResponseError(
      response,
      `Failed to create artifact share token (${response.status})`
    );
  }

  return (await response.json()) as ApiShareTokenCreateResponse;
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
    await throwApiResponseError(
      response,
      `Failed to load artifact workspace (${response.status})`
    );
  }

  return (await response.json()) as ApiArtifactWorkspacePayload;
}

export async function getSharedReview(token: string): Promise<ApiShareReviewPayload | null> {
  const response = await apiFetch(`/api/share/${token}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    await throwApiResponseError(response, `Failed to load shared review (${response.status})`);
  }

  return (await response.json()) as ApiShareReviewPayload;
}

export async function createSharedArtifactComment(input: {
  token: string;
  body: string;
  anchor: CommentAnchor;
}) {
  const response = await apiFetch(`/api/share/${input.token}/comments`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      body: input.body,
      anchor: input.anchor
    })
  });

  if (!response.ok) {
    await throwApiResponseError(
      response,
      `Failed to create shared artifact comment (${response.status})`
    );
  }

  return (await response.json()) as ApiArtifactComment;
}

export async function resolveSharedArtifactComment(input: {
  token: string;
  commentId: string;
}) {
  const response = await apiFetch(`/api/share/${input.token}/comments/${input.commentId}/resolve`, {
    method: "POST"
  });

  if (!response.ok) {
    await throwApiResponseError(
      response,
      `Failed to resolve shared artifact comment (${response.status})`
    );
  }

  return (await response.json()) as ApiArtifactComment;
}

export async function appendSharedSceneTemplate(input: {
  token: string;
  template: SceneTemplateKind;
}) {
  const response = await apiFetch(`/api/share/${input.token}/scene/nodes`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      template: input.template
    })
  });

  if (!response.ok) {
    await throwApiResponseError(
      response,
      `Failed to append shared scene template (${response.status})`
    );
  }

  return (await response.json()) as {
    appendedNodeId: string;
  };
}

export async function updateSharedSceneNode(input: {
  token: string;
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
  const response = await apiFetch(`/api/share/${input.token}/scene/nodes/${input.nodeId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      name: input.name,
      eyebrow: input.eyebrow,
      headline: input.headline,
      body: input.body,
      title: input.title,
      items: input.items,
      primaryAction: input.primaryAction,
      secondaryAction: input.secondaryAction
    })
  });

  if (!response.ok) {
    await throwApiResponseError(
      response,
      `Failed to update shared scene node (${response.status})`
    );
  }

  return (await response.json()) as {
    ok: true;
  };
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
    await throwApiResponseError(response, `Failed to create version (${response.status})`);
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
    await throwApiResponseError(response, `Failed to generate artifact (${response.status})`);
  }

  return (await response.json()) as ApiArtifactGenerateResponse;
}

export async function attachArtifactDesignSystem(input: {
  projectId: string;
  artifactId: string;
  designSystemPackId: string | null;
}) {
  const response = await apiFetch(
    `/api/projects/${input.projectId}/artifacts/${input.artifactId}/design-system`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        designSystemPackId: input.designSystemPackId
      })
    }
  );

  if (!response.ok) {
    await throwApiResponseError(
      response,
      `Failed to attach design system (${response.status})`
    );
  }

  return (await response.json()) as {
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
    await throwApiResponseError(response, `Failed to restore version (${response.status})`);
  }

  return (await response.json()) as {
    workspace: ApiArtifactWorkspace;
    restoredVersion: ApiArtifactVersion;
  };
}

export async function getArtifactVersionDiff(input: {
  projectId: string;
  artifactId: string;
  versionId: string;
}) {
  const response = await apiFetch(
    `/api/projects/${input.projectId}/artifacts/${input.artifactId}/versions/${input.versionId}/diff`
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    await throwApiResponseError(response, `Failed to load version diff (${response.status})`);
  }

  return (await response.json()) as {
    diff: ApiArtifactVersionDiff;
  };
}

export async function createArtifactComment(input: {
  projectId: string;
  artifactId: string;
  body: string;
  anchor: ArtifactComment["anchor"];
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
        anchor: input.anchor
      })
    }
  );

  if (!response.ok) {
    await throwApiResponseError(response, `Failed to create comment (${response.status})`);
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
    await throwApiResponseError(response, `Failed to resolve comment (${response.status})`);
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
    await throwApiResponseError(
      response,
      `Failed to append scene template (${response.status})`
    );
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
    await throwApiResponseError(response, `Failed to update scene node (${response.status})`);
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
    let parsed: unknown = null;

    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }

    const payload = parseApiErrorPayload(parsed);
    const currentUpdatedAt =
      payload?.details &&
      typeof payload.details.currentUpdatedAt === "string"
        ? payload.details.currentUpdatedAt
        : payload?.details?.currentUpdatedAt === null
          ? null
          : null;

    return {
      status: "conflict" as const,
      message: readApiErrorMessage(parsed, "Code workspace save conflicted with newer state."),
      currentUpdatedAt
    };
  }

  if (!response.ok) {
    await throwApiResponseError(
      response,
      `Failed to save code workspace (${response.status})`
    );
  }

  const payload = (await response.json()) as {
    workspace: ApiArtifactWorkspace;
    previousCodeWorkspaceUpdatedAt: string | null;
    sceneSync: {
      status: "synced" | "unchanged";
      reason: string;
    };
  };

  return {
    status: "saved" as const,
    workspace: payload.workspace,
    previousCodeWorkspaceUpdatedAt: payload.previousCodeWorkspaceUpdatedAt,
    sceneSync: payload.sceneSync
  };
}
