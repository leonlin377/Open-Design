import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { buildCodeSandboxExport } from "@opendesign/exporters/src/codesandbox";
import { buildFigmaImportExport } from "@opendesign/exporters/src/figma";
import { getRequestSession, type OpenDesignAuth } from "../auth/session";
import { buildApiError, sendApiError } from "../lib/api-errors";
import type { ArtifactWorkspaceRepository } from "../repositories/artifact-workspaces";
import type { ArtifactRepository } from "../repositories/artifacts";
import type { ExportJobRepository } from "../repositories/export-jobs";
import type { ProjectRepository } from "../repositories/projects";

/**
 * Export-extras routes ship additional "import-ready" payload formats that
 * Claude Design offers out of the box: Figma plugin JSON and a
 * CodeSandbox-ready ZIP.
 *
 * These intentionally live in their own plugin so that the primary
 * artifacts route file stays unchanged. Authorization reuses the project
 * ownership check inline (a tiny duplicate of `resolveAuthorizedProject`
 * from the artifacts plugin) because helper functions on that plugin are
 * not exported.
 */

const paramsSchema = z.object({
  projectId: z.string().min(1),
  artifactId: z.string().min(1)
});

const figmaThemeBodySchema = z
  .object({
    theme: z
      .object({
        surface: z.string().min(1).optional(),
        accent: z.string().min(1).optional(),
        text: z.string().min(1).optional()
      })
      .optional()
  })
  .optional();

export interface ExportExtrasRouteOptions {
  artifacts: ArtifactRepository;
  projects: ProjectRepository;
  workspaces: ArtifactWorkspaceRepository;
  exportJobs: ExportJobRepository;
  auth: OpenDesignAuth;
}

export const registerExportExtrasRoutes: FastifyPluginAsync<
  ExportExtrasRouteOptions
> = async (app, options) => {
  async function resolveAuthorizedArtifact(
    request: FastifyRequest,
    input: { projectId: string; artifactId: string }
  ) {
    const session = await getRequestSession(options.auth, request);
    const project = await options.projects.getById(input.projectId);
    if (!project) {
      return { session, project: null, artifact: null };
    }
    if (project.ownerUserId && project.ownerUserId !== session?.user.id) {
      return { session, project: null, artifact: null };
    }
    const artifact = await options.artifacts.getById(
      input.projectId,
      input.artifactId
    );
    return { session, project, artifact };
  }

  async function createExportJob(input: {
    artifactId: string;
    // We reuse an existing ExportKind enum member so the export-jobs table
    // semantics do not need schema changes. The job is still traceable via
    // `request_id` / `completed_at`.
    exportKind: "handoff-bundle" | "source-bundle";
    requestId?: string | null;
  }) {
    const created = await options.exportJobs.create({
      artifactId: input.artifactId,
      exportKind: input.exportKind,
      requestId: input.requestId ?? null
    });
    await options.exportJobs.markRunning(created.id);
    return created.id;
  }

  app.post(
    "/projects/:projectId/artifacts/:artifactId/exports/figma-import",
    async (request, reply) => {
      const params = paramsSchema.parse(request.params);
      const body = figmaThemeBodySchema.parse(request.body ?? {});
      const { project, artifact } = await resolveAuthorizedArtifact(request, params);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }
      if (!artifact) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      const workspace = await options.workspaces.getByArtifactId(artifact.id);
      if (!workspace) {
        return sendApiError(reply, 404, {
          error: "Artifact workspace not initialized",
          code: "WORKSPACE_UPDATE_FAILED",
          recoverable: true
        });
      }

      const jobId = await createExportJob({
        artifactId: artifact.id,
        // Figma JSON is a single downloadable bundle — sits closest to
        // "handoff-bundle" in the existing enum.
        exportKind: "handoff-bundle",
        requestId: request.requestId
      });

      try {
        const payload = buildFigmaImportExport({
          artifact: {
            id: artifact.id,
            name: artifact.name,
            kind: artifact.kind
          },
          sceneDocument: workspace.sceneDocument,
          prompt: workspace.intent,
          theme: body?.theme
        });

        await options.exportJobs.markCompleted(jobId, {
          filename: `${artifact.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "artifact"}-figma.json`,
          contentType: "application/json; charset=utf-8"
        });

        reply.header("content-type", "application/json; charset=utf-8");
        reply.header(
          "content-disposition",
          `attachment; filename="${artifact.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "artifact"}-figma.json"`
        );
        return reply.send(payload);
      } catch (error) {
        await options.exportJobs.markFailed(
          jobId,
          buildApiError({
            error:
              error instanceof Error
                ? error.message
                : "Figma import export failed",
            code: "WORKSPACE_UPDATE_FAILED",
            recoverable: true
          })
        );
        throw error;
      }
    }
  );

  app.post(
    "/projects/:projectId/artifacts/:artifactId/exports/codesandbox",
    async (request, reply) => {
      const params = paramsSchema.parse(request.params);
      const { project, artifact } = await resolveAuthorizedArtifact(request, params);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }
      if (!artifact) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      const workspace = await options.workspaces.getByArtifactId(artifact.id);
      if (!workspace) {
        return sendApiError(reply, 404, {
          error: "Artifact workspace not initialized",
          code: "WORKSPACE_UPDATE_FAILED",
          recoverable: true
        });
      }

      const jobId = await createExportJob({
        artifactId: artifact.id,
        // CodeSandbox ZIP is a source-shaped bundle, reuse that enum slot.
        exportKind: "source-bundle",
        requestId: request.requestId
      });

      try {
        const bundle = buildCodeSandboxExport({
          artifact: {
            id: artifact.id,
            name: artifact.name,
            kind: artifact.kind
          },
          workspace: {
            intent: workspace.intent,
            sceneDocument: workspace.sceneDocument,
            codeWorkspace: workspace.codeWorkspace
          }
        });

        await options.exportJobs.markCompleted(jobId, {
          filename: bundle.filename,
          contentType: bundle.contentType
        });

        reply.header("content-type", bundle.contentType);
        reply.header(
          "content-disposition",
          `attachment; filename="${bundle.filename}"`
        );
        // Buffer.from gives Fastify a Node Buffer it knows how to stream.
        return reply.send(Buffer.from(bundle.bytes));
      } catch (error) {
        await options.exportJobs.markFailed(
          jobId,
          buildApiError({
            error:
              error instanceof Error
                ? error.message
                : "CodeSandbox export failed",
            code: "WORKSPACE_UPDATE_FAILED",
            recoverable: true
          })
        );
        throw error;
      }
    }
  );
};
