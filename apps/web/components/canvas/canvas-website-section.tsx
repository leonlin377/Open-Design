"use client";

import type { SceneNode } from "@opendesign/contracts";
import { CanvasInlineEditable, CanvasNode } from "./canvas-node";

export type CanvasCommitTextField =
  | "headline"
  | "body"
  | "title"
  | "eyebrow"
  | "primaryAction"
  | "secondaryAction"
  | "name";

export type CanvasCommitFeatureItem = {
  index: number;
  field: "label" | "body";
  value: string;
};

export type CanvasCommitTextPayload =
  | { kind: "text"; field: CanvasCommitTextField; value: string }
  | { kind: "feature-item"; update: CanvasCommitFeatureItem };

export type CanvasNodeCommit = (
  node: SceneNode,
  payload: CanvasCommitTextPayload
) => void;

type CanvasWebsiteSectionProps = {
  node: SceneNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  onCommit: CanvasNodeCommit;
};

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readFeatureItems(
  value: unknown
): Array<{ label: string; body: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is { label: string; body: string } =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { label?: unknown }).label === "string" &&
      typeof (item as { body?: unknown }).body === "string"
  );
}

export function CanvasWebsiteSection({
  node,
  selected,
  onSelect,
  onCommit
}: CanvasWebsiteSectionProps) {
  const template = readString(node.props.template, node.type);
  const headline = readString(node.props.headline, "");
  const title = readString(node.props.title, "");
  const body = readString(node.props.body, "");
  const eyebrow = readString(node.props.eyebrow, "");
  const primaryAction = readString(node.props.primaryAction, "");
  const secondaryAction = readString(node.props.secondaryAction, "");
  const items = readFeatureItems(node.props.items);

  const commit = (field: CanvasCommitTextField) => (value: string) =>
    onCommit(node, { kind: "text", field, value });

  return (
    <CanvasNode
      nodeId={node.id}
      label={`${node.name} — ${template}`}
      selected={selected}
      onSelect={onSelect}
      className={`canvas-website-section canvas-website-section-${template}`}
      role="region"
    >
      <header className="canvas-website-section-head">
        <span className="canvas-website-section-kind">{template}</span>
        <CanvasInlineEditable
          as="span"
          value={node.name}
          className="canvas-website-section-name"
          ariaLabel="Section name"
          onCommit={commit("name")}
        />
      </header>

      {template === "hero" ? (
        <div className="canvas-website-section-hero">
          {eyebrow ? (
            <CanvasInlineEditable
              as="span"
              value={eyebrow}
              className="canvas-website-section-eyebrow"
              ariaLabel="Eyebrow"
              onCommit={commit("eyebrow")}
            />
          ) : null}
          <CanvasInlineEditable
            as="h1"
            value={headline || "Double-click to add a headline"}
            className="canvas-website-section-headline"
            ariaLabel="Headline"
            onCommit={commit("headline")}
          />
          <CanvasInlineEditable
            as="p"
            value={body || "Double-click to add a supporting paragraph."}
            multiline
            className="canvas-website-section-body"
            ariaLabel="Body"
            onCommit={commit("body")}
          />
          {(primaryAction || secondaryAction) && (
            <div className="canvas-website-section-actions">
              {primaryAction ? (
                <CanvasInlineEditable
                  as="span"
                  value={primaryAction}
                  className="canvas-website-section-action primary"
                  ariaLabel="Primary action"
                  onCommit={commit("primaryAction")}
                />
              ) : null}
              {secondaryAction ? (
                <CanvasInlineEditable
                  as="span"
                  value={secondaryAction}
                  className="canvas-website-section-action ghost"
                  ariaLabel="Secondary action"
                  onCommit={commit("secondaryAction")}
                />
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {template === "feature-grid" ? (
        <div className="canvas-website-section-features">
          {(title || headline) && (
            <CanvasInlineEditable
              as="h2"
              value={title || headline}
              className="canvas-website-section-title"
              ariaLabel="Section title"
              onCommit={commit(title ? "title" : "headline")}
            />
          )}
          <div className="canvas-website-section-feature-grid">
            {[0, 1, 2].map((index) => {
              const item = items[index] ?? { label: `Item ${index + 1}`, body: "" };
              return (
                <div key={index} className="canvas-website-section-feature-item">
                  <CanvasInlineEditable
                    as="strong"
                    value={item.label}
                    className="canvas-website-section-feature-label"
                    ariaLabel={`Feature ${index + 1} label`}
                    onCommit={(value) =>
                      onCommit(node, {
                        kind: "feature-item",
                        update: { index, field: "label", value }
                      })
                    }
                  />
                  <CanvasInlineEditable
                    as="p"
                    multiline
                    value={item.body || "Describe this feature"}
                    className="canvas-website-section-feature-body"
                    ariaLabel={`Feature ${index + 1} body`}
                    onCommit={(value) =>
                      onCommit(node, {
                        kind: "feature-item",
                        update: { index, field: "body", value }
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {template === "cta" ? (
        <div className="canvas-website-section-cta">
          <CanvasInlineEditable
            as="h2"
            value={headline || "Call to action"}
            className="canvas-website-section-headline"
            ariaLabel="CTA headline"
            onCommit={commit("headline")}
          />
          {body ? (
            <CanvasInlineEditable
              as="p"
              multiline
              value={body}
              className="canvas-website-section-body"
              ariaLabel="CTA body"
              onCommit={commit("body")}
            />
          ) : null}
          <div className="canvas-website-section-actions">
            <CanvasInlineEditable
              as="span"
              value={primaryAction || "Primary action"}
              className="canvas-website-section-action primary"
              ariaLabel="Primary action"
              onCommit={commit("primaryAction")}
            />
            {secondaryAction ? (
              <CanvasInlineEditable
                as="span"
                value={secondaryAction}
                className="canvas-website-section-action ghost"
                ariaLabel="Secondary action"
                onCommit={commit("secondaryAction")}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {template !== "hero" && template !== "feature-grid" && template !== "cta" ? (
        <div className="canvas-website-section-fallback">
          <CanvasInlineEditable
            as="h2"
            value={headline || title || node.name}
            className="canvas-website-section-headline"
            ariaLabel="Headline"
            onCommit={commit(headline ? "headline" : title ? "title" : "name")}
          />
          {body ? (
            <CanvasInlineEditable
              as="p"
              multiline
              value={body}
              className="canvas-website-section-body"
              ariaLabel="Body"
              onCommit={commit("body")}
            />
          ) : null}
        </div>
      ) : null}
    </CanvasNode>
  );
}
