"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Surface } from "@opendesign/ui";
import {
  acceptVariation,
  fetchVariations,
  type ArtifactGenerationVariation
} from "../lib/opendesign-generation-extras";

type StudioVariationsPanelProps = {
  projectId: string;
  artifactId: string;
  initialPrompt: string;
};

/**
 * Triggers the variations endpoint and renders a 3-up preview grid with a
 * per-variation accept button. Accept reuses the same commit semantics as
 * `/generate` so a refresh picks up the new active version.
 */
export function StudioVariationsPanel({
  projectId,
  artifactId,
  initialPrompt
}: StudioVariationsPanelProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [variations, setVariations] = useState<ArtifactGenerationVariation[]>([]);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const runVariations = useCallback(() => {
    startTransition(async () => {
      setFeedback(null);
      try {
        const response = await fetchVariations({
          projectId,
          artifactId,
          prompt,
          count: 3
        });
        setVariations(response.variations);
        setFeedback(`Generated ${response.variations.length} variations.`);
      } catch (error) {
        setFeedback(
          error instanceof Error ? error.message : "Failed to generate variations."
        );
      }
    });
  }, [artifactId, projectId, prompt]);

  async function handleAccept(variation: ArtifactGenerationVariation) {
    setAcceptingId(variation.variationId);
    try {
      await acceptVariation({
        projectId,
        artifactId,
        variationId: variation.variationId
      });
      setFeedback(`Accepted variation "${variation.label}".`);
      setVariations([]);
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Failed to accept variation."
      );
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <Surface className="project-card" as="section">
      <div>
        <h3>Variations</h3>
        <p className="footer-note">
          Run three parallel passes and pick the proposal that resonates. Accept
          commits the chosen scene patch atomically via the same pipeline as a
          full prompt generation.
        </p>
      </div>
      <div className="stack-form">
        <label className="field">
          <span>Prompt</span>
          <textarea
            rows={3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>
        <div className="studio-generate-actions">
          <Button
            variant="primary"
            type="button"
            onClick={runVariations}
            disabled={pending || prompt.trim().length === 0}
          >
            {pending ? "Generating variations..." : "Generate 3 variations"}
          </Button>
        </div>
      </div>
      {feedback ? <div className="studio-feedback">{feedback}</div> : null}
      {variations.length > 0 ? (
        <div className="studio-variations-grid">
          {variations.map((variation) => (
            <Surface key={variation.variationId} className="studio-variation-card">
              <header>
                <strong>{variation.label}</strong>
                <span className="status-pill">{variation.plan.provider}</span>
              </header>
              <p className="footer-note">{variation.plan.rationale}</p>
              <ul>
                {variation.plan.sections.map((section, index) => (
                  <li key={`${variation.variationId}-${section}-${index}`}>
                    {section}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                type="button"
                onClick={() => handleAccept(variation)}
                disabled={acceptingId !== null}
              >
                {acceptingId === variation.variationId
                  ? "Accepting..."
                  : "Accept this variation"}
              </Button>
            </Surface>
          ))}
        </div>
      ) : null}
    </Surface>
  );
}
