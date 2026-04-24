"use client";

import type { SceneNode } from "@opendesign/contracts";
import { CanvasInlineEditable, CanvasNode } from "./canvas-node";
import type { CanvasNodeCommit } from "./canvas-website-section";

type CanvasPrototypeScreenProps = {
  node: SceneNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  onCommit: CanvasNodeCommit;
};

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function CanvasPrototypeScreen({
  node,
  selected,
  onSelect,
  onCommit
}: CanvasPrototypeScreenProps) {
  const eyebrow = readString(node.props.eyebrow);
  const headline = readString(node.props.headline);
  const body = readString(node.props.body);

  const commit = (field: "eyebrow" | "headline" | "body" | "name") => (value: string) =>
    onCommit(node, { kind: "text", field, value });

  return (
    <CanvasNode
      nodeId={node.id}
      label={`${node.name} — screen`}
      selected={selected}
      onSelect={onSelect}
      className="canvas-prototype-screen"
      role="region"
    >
      <header className="canvas-prototype-screen-bar">
        <span className="canvas-prototype-screen-dot" aria-hidden />
        <span className="canvas-prototype-screen-dot" aria-hidden />
        <span className="canvas-prototype-screen-dot" aria-hidden />
        <CanvasInlineEditable
          as="span"
          value={node.name}
          className="canvas-prototype-screen-name"
          ariaLabel="Screen name"
          onCommit={commit("name")}
        />
      </header>
      <div className="canvas-prototype-screen-body">
        {eyebrow ? (
          <CanvasInlineEditable
            as="span"
            value={eyebrow}
            className="canvas-prototype-screen-eyebrow"
            ariaLabel="Eyebrow"
            onCommit={commit("eyebrow")}
          />
        ) : null}
        <CanvasInlineEditable
          as="h3"
          value={headline || "Headline"}
          className="canvas-prototype-screen-headline"
          ariaLabel="Headline"
          onCommit={commit("headline")}
        />
        <CanvasInlineEditable
          as="p"
          multiline
          value={body || "Guidance for this screen"}
          className="canvas-prototype-screen-copy"
          ariaLabel="Body"
          onCommit={commit("body")}
        />
      </div>
    </CanvasNode>
  );
}

type CanvasPrototypeCtaProps = {
  node: SceneNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  onCommit: CanvasNodeCommit;
};

export function CanvasPrototypeCta({
  node,
  selected,
  onSelect,
  onCommit
}: CanvasPrototypeCtaProps) {
  const headline = readString(node.props.headline);
  const primaryAction = readString(node.props.primaryAction);
  const secondaryAction = readString(node.props.secondaryAction);

  return (
    <CanvasNode
      nodeId={node.id}
      label={`${node.name} — CTA`}
      selected={selected}
      onSelect={onSelect}
      className="canvas-prototype-cta"
      role="region"
    >
      <CanvasInlineEditable
        as="h4"
        value={headline || "Confirm next step"}
        className="canvas-prototype-cta-headline"
        ariaLabel="CTA headline"
        onCommit={(value) => onCommit(node, { kind: "text", field: "headline", value })}
      />
      <div className="canvas-prototype-cta-actions">
        <CanvasInlineEditable
          as="span"
          value={primaryAction || "Primary"}
          className="canvas-prototype-cta-action primary"
          ariaLabel="Primary action"
          onCommit={(value) => onCommit(node, { kind: "text", field: "primaryAction", value })}
        />
        <CanvasInlineEditable
          as="span"
          value={secondaryAction || "Secondary"}
          className="canvas-prototype-cta-action ghost"
          ariaLabel="Secondary action"
          onCommit={(value) => onCommit(node, { kind: "text", field: "secondaryAction", value })}
        />
      </div>
    </CanvasNode>
  );
}

export type CanvasPrototypeLinkProps = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  trigger: string;
  selected?: boolean;
};

/**
 * SVG arrow between two screen rects. Rendered as a sibling overlay inside
 * the prototype canvas. Coordinates are expressed in the un-transformed
 * world plane; the parent canvas applies zoom/pan.
 */
export function CanvasPrototypeLink({
  fromX,
  fromY,
  toX,
  toY,
  trigger,
  selected = false
}: CanvasPrototypeLinkProps) {
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const minX = Math.min(fromX, toX) - 40;
  const minY = Math.min(fromY, toY) - 20;
  const width = Math.abs(toX - fromX) + 80;
  const height = Math.abs(toY - fromY) + 40;

  return (
    <svg
      className={`canvas-prototype-link${selected ? " is-selected" : ""}`}
      style={{
        position: "absolute",
        left: minX,
        top: minY,
        width,
        height,
        pointerEvents: "none"
      }}
      viewBox={`${minX} ${minY} ${width} ${height}`}
      aria-hidden
    >
      <defs>
        <marker
          id={`canvas-arrow-${Math.round(midX)}-${Math.round(midY)}`}
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 Z" className="canvas-prototype-link-head" />
        </marker>
      </defs>
      <path
        d={`M${fromX},${fromY} C${fromX + 60},${fromY} ${toX - 60},${toY} ${toX},${toY}`}
        className="canvas-prototype-link-path"
        fill="none"
        markerEnd={`url(#canvas-arrow-${Math.round(midX)}-${Math.round(midY)})`}
      />
      <text x={midX} y={midY - 6} textAnchor="middle" className="canvas-prototype-link-label">
        {trigger}
      </text>
    </svg>
  );
}
