import type { ArtifactKind } from "@opendesign/contracts";

export type ExportArtifact = {
  id: string;
  kind: ArtifactKind;
  label: string;
  updatedAt: string;
  sizeBytes?: number;
};

export type ExportJob = {
  id: string;
  requestedAt: string;
  artifacts: ExportArtifact[];
  requestedBy?: string;
};

export type HandoffManifestSummary = {
  artifactCount: number;
  byKind: Record<ArtifactKind, number>;
  latestUpdatedAt: string | null;
  totalBytes: number;
};

export const buildHandoffManifestSummary = (
  artifacts: ExportArtifact[]
): HandoffManifestSummary => {
  const byKind: HandoffManifestSummary["byKind"] = {
    website: 0,
    prototype: 0,
    slides: 0
  };
  let latestUpdatedAt: string | null = null;
  let latestTimestamp = -Infinity;
  let totalBytes = 0;

  for (const artifact of artifacts) {
    byKind[artifact.kind] += 1;
    if (typeof artifact.sizeBytes === "number") {
      totalBytes += artifact.sizeBytes;
    }

    const timestamp = Date.parse(artifact.updatedAt);
    if (Number.isFinite(timestamp) && timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestUpdatedAt = artifact.updatedAt;
    }
  }

  return {
    artifactCount: artifacts.length,
    byKind,
    latestUpdatedAt,
    totalBytes
  };
};
