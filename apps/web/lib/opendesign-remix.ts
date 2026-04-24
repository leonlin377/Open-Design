import type {
  ArtifactLineage,
  ArtifactRemixRequest
} from "@opendesign/contracts/src/remix";
import type { ApiArtifact } from "./opendesign-api";
import { buildApiRequestError } from "./api-errors";

export type ApiArtifactRemixRequest = ArtifactRemixRequest;
export type ApiArtifactRemixResponse = {
  artifact: ApiArtifact;
  lineage: ArtifactLineage;
};

/**
 * Browser-side helper: forks an artifact via the API. The same origin that
 * serves the Studio page proxies `/api/**` through to the backend, so we can
 * use a relative URL without knowing the API origin. Callers typically
 * redirect to the returned artifact on success.
 */
export async function remixArtifact(input: {
  projectId: string;
  artifactId: string;
  targetProjectId?: string;
  nameOverride?: string;
}): Promise<ApiArtifactRemixResponse> {
  const body: ApiArtifactRemixRequest = {};
  if (input.targetProjectId) {
    body.targetProjectId = input.targetProjectId;
  }
  if (input.nameOverride) {
    body.nameOverride = input.nameOverride;
  }

  const response = await fetch(
    `/api/projects/${input.projectId}/artifacts/${input.artifactId}/remix`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    throw await buildApiRequestError(
      response,
      `Failed to fork artifact (${response.status})`
    );
  }

  return (await response.json()) as ApiArtifactRemixResponse;
}

/**
 * Build the Studio URL for a freshly-forked artifact. Kept here alongside
 * the API helper so callers don't reinvent the path on every consumer.
 */
export function buildForkedArtifactStudioPath(input: {
  projectId: string;
  artifactId: string;
}): string {
  return `/studio/${input.projectId}/${input.artifactId}`;
}
