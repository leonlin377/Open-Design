"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SceneNode } from "@opendesign/contracts";
import { CanvasInlineEditable, CanvasNode } from "./canvas-node";
import type { CanvasNodeCommit } from "./canvas-website-section";

type CanvasSlidesDeckProps = {
  nodes: SceneNode[];
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  onCommit: CanvasNodeCommit;
};

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readBullets(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

export function CanvasSlidesDeck({
  nodes,
  selectedNodeId,
  onSelect,
  onCommit
}: CanvasSlidesDeckProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const clampedIndex = useMemo(() => {
    if (nodes.length === 0) {
      return 0;
    }
    return Math.min(Math.max(activeIndex, 0), nodes.length - 1);
  }, [activeIndex, nodes.length]);

  // Sync the active slide to the selected node (inspector can drive it, too).
  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }
    const idx = nodes.findIndex((node) => node.id === selectedNodeId);
    if (idx >= 0) {
      setActiveIndex(idx);
    }
  }, [selectedNodeId, nodes]);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => Math.max(0, prev - 1));
  }, []);
  const handleNext = useCallback(() => {
    setActiveIndex((prev) => Math.min(nodes.length - 1, prev + 1));
  }, [nodes.length]);

  // Arrow key navigation scoped to the deck container (not document-wide, to
  // avoid fighting with text fields and the inspector).
  const handleKey = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("[contenteditable='true']")) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      }
    },
    [handleNext, handlePrev]
  );

  if (nodes.length === 0) {
    return null;
  }

  const activeNode = nodes[clampedIndex]!;
  const activeRole = activeNode.type;
  const headline = readString(activeNode.props.headline);
  const body = readString(activeNode.props.body);
  const bullets = readBullets(activeNode.props.bullets);

  return (
    <div className="canvas-slides-deck" onKeyDown={handleKey} tabIndex={0}>
      <div className="canvas-slides-stage">
        <button
          type="button"
          className="canvas-slides-nav prev"
          onClick={handlePrev}
          disabled={clampedIndex === 0}
          aria-label="Previous slide"
        >
          ‹
        </button>
        <CanvasNode
          nodeId={activeNode.id}
          label={`${activeNode.name} — ${activeRole}`}
          selected={selectedNodeId === activeNode.id}
          onSelect={onSelect}
          className={`canvas-slide canvas-slide-${activeRole}`}
          role="region"
        >
          <div className="canvas-slide-eyebrow">
            {activeRole === "slide-title"
              ? "Title"
              : activeRole === "slide-closing"
                ? "Closing"
                : `Slide ${clampedIndex + 1}`}
          </div>
          <CanvasInlineEditable
            as="h1"
            value={headline || activeNode.name}
            className="canvas-slide-headline"
            ariaLabel="Slide headline"
            onCommit={(value) => onCommit(activeNode, { kind: "text", field: "headline", value })}
          />
          {body ? (
            <CanvasInlineEditable
              as="p"
              multiline
              value={body}
              className="canvas-slide-body"
              ariaLabel="Slide body"
              onCommit={(value) => onCommit(activeNode, { kind: "text", field: "body", value })}
            />
          ) : null}
          {bullets.length > 0 ? (
            <ul className="canvas-slide-bullets">
              {bullets.map((bullet, i) => (
                <li key={`${activeNode.id}-bullet-${i}`}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </CanvasNode>
        <button
          type="button"
          className="canvas-slides-nav next"
          onClick={handleNext}
          disabled={clampedIndex >= nodes.length - 1}
          aria-label="Next slide"
        >
          ›
        </button>
      </div>
      <div className="canvas-slides-filmstrip" role="tablist" aria-label="Slide thumbnails">
        {nodes.map((node, index) => {
          const isActive = index === clampedIndex;
          const thumbHeadline = readString(node.props.headline, node.name);
          return (
            <button
              key={node.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`canvas-slides-thumb${isActive ? " is-active" : ""}${
                selectedNodeId === node.id ? " is-selected" : ""
              }`}
              onClick={() => {
                setActiveIndex(index);
                onSelect(node.id);
              }}
            >
              <span className="canvas-slides-thumb-index">{index + 1}</span>
              <span className="canvas-slides-thumb-headline">{thumbHeadline}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
