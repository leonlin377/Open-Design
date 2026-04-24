import {
  ArtifactSummarySchema,
  type ArtifactVersionSnapshot,
  type SceneDocument
} from "@opendesign/contracts";
import {
  ArtifactLineageSchema,
  ArtifactRemixRequestSchema,
  ArtifactRemixResponseSchema
} from "@opendesign/contracts/src/remix";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendApiError } from "../lib/api-errors";
import { getRequestSession, type OpenDesignAuth } from "../auth/session";
import type { ArtifactCommentRepository } from "../repositories/artifact-comments";
import type { ArtifactVersionRepository } from "../repositories/artifact-versions";
import type { ArtifactWorkspaceRepository } from "../repositories/artifact-workspaces";
import type { ArtifactRepository } from "../repositories/artifacts";
import type { AssetRepository } from "../repositories/assets";
import type { ProjectRepository } from "../repositories/projects";

export interface ArtifactRemixRouteOptions {
  artifacts: ArtifactRepository;
  workspaces: ArtifactWorkspaceRepository;
  versions: ArtifactVersionRepository;
  comments: ArtifactCommentRepository;
  assets: AssetRepository;
  projects: ProjectRepository;
  auth: OpenDesignAuth;
}

const remixParamsSchema = z.object({
  projectId: z.string().min(1),
  artifactId: z.string().min(1)
});

export const registerArtifactRemixRoutes: FastifyPluginAsync<
  ArtifactRemixRouteOptions
> = async (app, options) => {
  // Resolve a project the caller is authorised to read OR write to. Mirrors
  // the `project.ownerUserId` gate used by the rest of the API: unowned
  // projects are visible to everyone (in-memory fixture mode), owned ones
  // only to their owner.
  async function resolveAuthorizedProject(
    request: FastifyRequest,
    projectId: string
  ) {
    const session = await getRequestSession(options.auth, request);
    const project = await options.projects.getById(projectId);

    if (!project) {
      return { session, project: null };
    }

    if (project.ownerUserId && project.ownerUserId !== session?.user.id) {
      return { session, project: null };
    }

    return { session, project };
  }

  app.post(
    "/projects/:projectId/artifacts/:artifactId/remix",
    async (request, reply) => {
      const params = remixParamsSchema.parse(request.params);
      const body = ArtifactRemixRequestSchema.parse(request.body ?? {});

      // --- Authorise source read access ----------------------------------
      const source = await resolveAuthorizedProject(request, params.projectId);
      if (!source.project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }

      const sourceArtifact = await options.artifacts.getById(
        params.projectId,
        params.artifactId
      );
      if (!sourceArtifact) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      // --- Authorise target project write access -------------------------
      // When the caller omits `targetProjectId` we fork into the same
      // project, which they already proved read+write access to above. When
      // they provide a different project id we re-run the auth gate.
      const targetProjectId = body.targetProjectId ?? params.projectId;
      const targetAuth =
        targetProjectId === params.projectId
          ? source
          : await resolveAuthorizedProject(request, targetProjectId);

      if (!targetAuth.project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }

      // --- Load the source workspace / versions / comments / assets ------
      const sourceWorkspace = await options.workspaces.getByArtifactId(
        sourceArtifact.id
      );
      const sourceVersions = await options.versions.listByArtifactId(
        sourceArtifact.id
      );
      const sourceComments = await options.comments.listByArtifactId(
        sourceArtifact.id
      );
      const sourceAssets = await options.assets.listByArtifactId(
        sourceArtifact.id
      );

      // --- Create the new artifact and deep-copy the workspace -----------
      const forkedAt = new Date().toISOString();
      const newArtifact = await options.artifacts.create({
        projectId: targetProjectId,
        name: body.nameOverride ?? sourceArtifact.name,
        kind: sourceArtifact.kind
      });

      // Best-effort rollback tracker. On any failure after `newArtifact` is
      // created we do not have a native delete primitive, but we can at
      // least surface the partial state to callers via an error. The
      // repository layer treats missing parents as a no-op on subsequent
      // reads, so a failed remix leaves an orphan summary row rather than a
      // half-wired workspace.
      try {
        if (sourceWorkspace) {
          // Rebind the scene document onto the new artifact id but preserve
          // `sceneDocument.metadata.designSystemPackId` so grounding
          // continues on the fork.
          const clonedSceneDocument: SceneDocument = {
            ...sourceWorkspace.sceneDocument,
            artifactId: newArtifact.id
          };

          await options.workspaces.create({
            artifactId: newArtifact.id,
            intent: sourceWorkspace.intent,
            activeVersionId: null,
            sceneDocument: clonedSceneDocument
          });

          // Seed a "Forked from …" version first so it can sort at the top.
          const seedLabel = `Forked from ${sourceArtifact.name}`;
          const seedVersion = await options.versions.create({
            artifactId: newArtifact.id,
            label: seedLabel,
            summary: `Forked ${sourceArtifact.kind} from project ${params.projectId} at ${forkedAt}.`,
            source: "seed",
            sceneVersion: clonedSceneDocument.version,
            sceneDocument: clonedSceneDocument,
            codeWorkspace: sourceWorkspace.codeWorkspace
          });

          // Mirror the prior version stack, re-stamped with new ids and
          // pointing at the new artifact. Order preserved newest-first by
          // walking the source list in reverse and inserting oldest-first.
          const remappedVersions: ArtifactVersionSnapshot[] = [];
          const orderedSourceVersions = [...sourceVersions].reverse();
          for (const priorVersion of orderedSourceVersions) {
            const priorState = await options.versions.getStateById(
              sourceArtifact.id,
              priorVersion.id
            );
            if (!priorState) {
              continue;
            }

            const reboundSceneDocument: SceneDocument = {
              ...priorState.sceneDocument,
              artifactId: newArtifact.id
            };

            const created = await options.versions.create({
              artifactId: newArtifact.id,
              label: priorVersion.label,
              summary: priorVersion.summary,
              source: priorVersion.source,
              sceneVersion: priorState.sceneDocument.version,
              sceneDocument: reboundSceneDocument,
              codeWorkspace: priorState.codeWorkspace
            });
            remappedVersions.push(created);
          }

          // Persist the code workspace alongside the scene so the fork opens
          // straight into the last-saved editor state.
          if (sourceWorkspace.codeWorkspace) {
            await options.workspaces.updateCodeWorkspace(newArtifact.id, {
              files: sourceWorkspace.codeWorkspace.files,
              baseSceneVersion: sourceWorkspace.codeWorkspace.baseSceneVersion
            });
          }

          await options.workspaces.updateActiveVersion(
            newArtifact.id,
            seedVersion.id
          );
        }

        // Copy comments as resolved-at-fork — the conversation context
        // remains visible on the fork without re-opening live review
        // threads against the new artifact.
        for (const comment of sourceComments) {
          const created = await options.comments.create({
            artifactId: newArtifact.id,
            body: comment.body,
            anchor: comment.anchor,
            status: "resolved"
          });
          // Some comment repositories default to `open` even when
          // `status: "resolved"` is supplied (older impls predate the
          // parameter). Force-resolve to match the contract either way.
          if (created.status !== "resolved") {
            await options.comments.resolve(newArtifact.id, created.id);
          }
        }

        // Link assets by reference — a new asset *record* is created that
        // points at the *same* underlying objectKey. No bytes are copied,
        // so storage remains O(1) regardless of fork fan-out.
        for (const asset of sourceAssets) {
          await options.assets.create({
            ownerUserId: asset.ownerUserId,
            artifactId: newArtifact.id,
            kind: asset.kind,
            filename: asset.filename,
            storageProvider: asset.storageProvider,
            objectKey: asset.objectKey,
            contentType: asset.contentType,
            sizeBytes: asset.sizeBytes
          });
        }
      } catch (error) {
        // Best-effort cleanup. Neither the artifact nor the workspace/version
        // repositories expose a delete primitive today, so the orphan stays
        // visible but unreachable from its target project only in edge cases
        // where subsequent lookups find no workspace. Surface the failure
        // clearly to the caller.
        request.log?.error?.(
          { err: error, newArtifactId: newArtifact.id },
          "artifact remix failed mid-copy; partial artifact may be present"
        );
        return sendApiError(reply, 500, {
          error: "Artifact remix failed",
          code: "WORKSPACE_UPDATE_FAILED",
          recoverable: true,
          details: {
            stage: "remix",
            newArtifactId: newArtifact.id
          }
        });
      }

      const lineage = ArtifactLineageSchema.parse({
        sourceArtifactId: sourceArtifact.id,
        sourceProjectId: params.projectId,
        forkedAt
      });

      const payload = ArtifactRemixResponseSchema.parse({
        artifact: ArtifactSummarySchema.parse(newArtifact),
        lineage
      });

      return reply.code(201).send(payload);
    }
  );
};
