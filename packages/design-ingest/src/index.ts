import type { DesignSystemPack } from "@opendesign/contracts";

export type GithubImportSource = {
  type: "github";
  owner: string;
  repo: string;
  ref?: string;
  path?: string;
};

export type LocalDirectoryImportSource = {
  type: "local-directory";
  absolutePath: string;
};

export type SiteCaptureImportSource = {
  type: "site-capture";
  url: string;
};

export type DesignImportSource =
  | GithubImportSource
  | LocalDirectoryImportSource
  | SiteCaptureImportSource;

export type PackProvenance = DesignSystemPack["provenance"][number];

export type ExtractedEvidence = {
  label: string;
  kind: PackProvenance["type"];
  sourceRef: string;
};

export type ExtractedPackResult = {
  source: DesignImportSource;
  pack: DesignSystemPack;
  evidence: ExtractedEvidence[];
  warnings: string[];
};

export type PackEvidenceSummary = {
  evidenceCount: number;
  provenanceCount: number;
  targetCount: number;
  sourceKinds: ExtractedEvidence["kind"][];
};

export const summarizePackEvidence = (
  result: ExtractedPackResult
): PackEvidenceSummary => {
  const sourceKinds = Array.from(new Set(result.evidence.map((item) => item.kind))).sort();
  const targetCount = result.pack.provenance.reduce(
    (count, provenance) => count + provenance.targets.length,
    0
  );

  return {
    evidenceCount: result.evidence.length,
    provenanceCount: result.pack.provenance.length,
    targetCount,
    sourceKinds
  };
};
