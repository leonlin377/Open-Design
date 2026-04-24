"use client";

import Link from "next/link";
import { Surface } from "@opendesign/ui";
import { useT } from "../lib/i18n";
import type { ApiArtifact, ApiExportJob } from "../lib/opendesign-api";

type StudioExportPanelProps = {
  projectId: string;
  artifactId: string;
  artifactKind: ApiArtifact["kind"];
  sourceBundleFiles: Record<string, string>;
  exportJobs: ApiExportJob[];
};

export function StudioExportPanel({
  projectId,
  artifactId,
  artifactKind,
  sourceBundleFiles,
  exportJobs
}: StudioExportPanelProps) {
  const t = useT();

  return (
    <>
      <Surface className="project-card" as="section">
        <div>
          <h3>{t("studio.export.title")}</h3>
          <p className="footer-note">
            {t("studio.export.description")}
          </p>
        </div>
        <div className="artifact-action-grid">
          <Link
            href={`/studio/${projectId}/${artifactId}/export/handoff-bundle`}
            className="button-link ghost"
          >
            {t("studio.export.handoff")}
          </Link>
          <Link
            href={`/studio/${projectId}/${artifactId}/export/source-bundle`}
            className="button-link ghost"
          >
            {t("studio.export.zip")}
          </Link>
          <Link
            href={`/studio/${projectId}/${artifactId}/export/html`}
            className="button-link primary"
          >
            {t("studio.export.html")}
          </Link>
          {artifactKind === "prototype" ? (
            <Link
              href={`/studio/${projectId}/${artifactId}/export/prototype-flow`}
              className="button-link ghost"
            >
              {t("studio.export.flow")}
            </Link>
          ) : null}
          {artifactKind === "slides" ? (
            <Link
              href={`/studio/${projectId}/${artifactId}/export/slides-deck`}
              className="button-link ghost"
            >
              {t("studio.export.deck")}
            </Link>
          ) : null}
        </div>
      </Surface>
      <Surface className="project-card" as="section">
        <div>
          <h3>{t("studio.export.jobs.title")}</h3>
          <p className="footer-note">
            {t("studio.export.jobs.description")}
          </p>
        </div>
        <div className="stack-form">
          {exportJobs.length === 0 ? (
            <div className="footer-note">{t("studio.export.jobs.empty")}</div>
          ) : null}
          {exportJobs.map((job) => (
            <Surface key={job.id} className="kv">
              <span>{job.exportKind} · {job.status}</span>
              {job.result
                ? `${job.result.filename} · ${new Date(job.requestedAt).toLocaleString("zh-CN")}`
                : job.error
                  ? `${job.error.code} · ${job.error.error}`
                  : `Requested ${new Date(job.requestedAt).toLocaleString("zh-CN")}`}
            </Surface>
          ))}
        </div>
      </Surface>
      <Surface className="project-card" as="section">
        <div>
          <h3>Bundle Manifest</h3>
          <p className="footer-note">
            Handoff ZIP packages workspace metadata, comments, versions, and exports;
            the source scaffold below is generated directly from the current workspace.
          </p>
        </div>
        <div className="stack-form">
          {Object.entries(sourceBundleFiles).map(([filePath, content]) => (
            <Surface key={filePath} className="kv">
              <span>{filePath}</span>
              {content.split("\n").length} lines
            </Surface>
          ))}
        </div>
      </Surface>
    </>
  );
}
