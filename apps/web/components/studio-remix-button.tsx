"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Button, Surface } from "@opendesign/ui";
import type { ApiArtifact, ApiProject } from "../lib/opendesign-api";
import {
  buildForkedArtifactStudioPath,
  remixArtifact
} from "../lib/opendesign-remix";

type StudioRemixButtonProps = {
  projectId: string;
  artifactId: string;
  artifactName: string;
  /**
   * Projects the current user can write to. When omitted or empty the modal
   * offers a single "same project" option so the button still functions in
   * standalone / anonymous-demo contexts.
   */
  availableProjects?: Pick<ApiProject, "id" | "name">[];
  /**
   * Emitted after a successful fork so parent pages can refresh their
   * artifact list without a full reload.
   */
  onRemixed?: (artifact: ApiArtifact) => void;
};

export function StudioRemixButton({
  projectId,
  artifactId,
  artifactName,
  availableProjects,
  onRemixed
}: StudioRemixButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState(projectId);
  const [nameOverride, setNameOverride] = useState(`${artifactName} (fork)`);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const projectOptions = useMemo(() => {
    if (availableProjects && availableProjects.length > 0) {
      return availableProjects;
    }
    // Fallback ensures the combobox always has at least the current project.
    return [{ id: projectId, name: "This project" }];
  }, [availableProjects, projectId]);

  const openDialog = useCallback(() => {
    setTargetProjectId(projectId);
    setNameOverride(`${artifactName} (fork)`);
    setError(null);
    setIsOpen(true);
  }, [artifactName, projectId]);

  const closeDialog = useCallback(() => {
    if (isPending) {
      return;
    }
    setIsOpen(false);
    setError(null);
  }, [isPending]);

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      startTransition(async () => {
        try {
          const result = await remixArtifact({
            projectId,
            artifactId,
            targetProjectId:
              targetProjectId && targetProjectId !== projectId
                ? targetProjectId
                : undefined,
            nameOverride: nameOverride.trim() ? nameOverride.trim() : undefined
          });

          onRemixed?.(result.artifact);
          // Next.js typed routes infer dynamic segments at build time;
          // since forked studio URLs are data-driven, cast through the
          // public `string` contract to keep this helper reusable.
          const nextPath = buildForkedArtifactStudioPath({
            projectId: result.artifact.projectId,
            artifactId: result.artifact.id
          });
          router.push(nextPath as unknown as Parameters<typeof router.push>[0]);
        } catch (failure) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Failed to fork this artifact. Retry in a moment."
          );
        }
      });
    },
    [artifactId, nameOverride, onRemixed, projectId, router, targetProjectId]
  );

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        onClick={openDialog}
        data-testid="studio-remix-button"
      >
        Fork artifact
      </Button>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fork artifact"
          data-testid="studio-remix-dialog"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "grid",
            placeItems: "center",
            background: "color-mix(in oklab, var(--bg-surface), transparent 40%)"
          }}
          onClick={(event) => {
            // Click-outside closes, but only when the target is the backdrop
            // itself — not when a click inside the surface bubbles up.
            if (event.target === event.currentTarget) {
              closeDialog();
            }
          }}
        >
          <form
            onSubmit={submit}
            style={{
              maxWidth: 420,
              width: "100%"
            }}
          >
          <Surface
            className="project-card"
            style={{
              display: "grid",
              gap: 12
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Fork artifact</h3>
              <p className="footer-note" style={{ marginTop: 4 }}>
                Create an independent copy with its own scene, versions and
                comments. Assets are linked by reference, so no bytes are
                duplicated.
              </p>
            </div>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: "0.8125rem" }}>Target project</span>
              <select
                value={targetProjectId}
                onChange={(event) => setTargetProjectId(event.target.value)}
                disabled={isPending}
                data-testid="studio-remix-target-project"
              >
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.id === projectId ? `${project.name} (same)` : project.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: "0.8125rem" }}>Name override</span>
              <input
                type="text"
                value={nameOverride}
                onChange={(event) => setNameOverride(event.target.value)}
                disabled={isPending}
                placeholder={artifactName}
                data-testid="studio-remix-name-override"
              />
            </label>

            {error ? (
              <div
                role="alert"
                style={{ color: "var(--danger)", fontSize: "0.8125rem" }}
              >
                {error}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button
                type="button"
                variant="ghost"
                onClick={closeDialog}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isPending}
                data-testid="studio-remix-submit"
              >
                {isPending ? "Forking…" : "Fork"}
              </Button>
            </div>
          </Surface>
          </form>
        </div>
      ) : null}
    </>
  );
}
