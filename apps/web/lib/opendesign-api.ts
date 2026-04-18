import "server-only";

import { cookies } from "next/headers";

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
