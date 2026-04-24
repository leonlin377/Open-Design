"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import type { SceneNode } from "@opendesign/contracts";
import { CanvasEmptyState } from "./canvas-empty-state";
import {
  CanvasPrototypeCta,
  CanvasPrototypeLink,
  CanvasPrototypeScreen
} from "./canvas-prototype-screen";
import { CanvasSlidesDeck } from "./canvas-slides-deck";
import { CanvasToolbar, type CanvasTool } from "./canvas-toolbar";
import type {
  CanvasCommitTextPayload,
  CanvasNodeCommit
} from "./canvas-website-section";
import { CanvasWebsiteSection } from "./canvas-website-section";
import { useCanvasViewport } from "./use-canvas-viewport";

export type CanvasStageArtifactKind = "website" | "prototype" | "slides";

export type CanvasStageProps = {
  projectId: string;
  artifactId: string;
  artifactKind: CanvasStageArtifactKind;
  sceneNodes: SceneNode[];
  updateSceneNodeAction: (formData: FormData) => Promise<void>;
  emptyStateTitle: string;
  emptyStateDescription: string;
  unitLabel: string;
  frameLabel: string;
  themeLabel: string;
  /**
   * Optional slot for the design-system agent's theme toggle. Kept as a
   * prop so we don't hard-couple the canvas to a specific theme UI shape.
   */
  themeSlot?: ReactNode;
};

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 420;
const SCREEN_GAP = 120;

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

/**
 * Build a FormData payload matching the existing `updateSceneNodeAction`
 * contract. The action treats empty strings as "leave unchanged", so we
 * only populate the field being edited (plus any required state the action
 * expects, like the full items array when editing feature-grid items).
 */
function buildUpdateFormData(params: {
  projectId: string;
  artifactId: string;
  node: SceneNode;
  payload: CanvasCommitTextPayload;
}): FormData {
  const { projectId, artifactId, node, payload } = params;
  const form = new FormData();
  form.set("projectId", projectId);
  form.set("artifactId", artifactId);
  form.set("nodeId", node.id);

  if (payload.kind === "text") {
    if (payload.field === "name") {
      form.set("name", payload.value);
    } else {
      form.set(payload.field, payload.value);
    }
    return form;
  }

  // feature-item — the server action rebuilds the items array from
  // item0/item1/item2 + itemsTailJson. Preserve existing values for the
  // items we aren't touching so they survive the round trip.
  const currentItems = readFeatureItems(node.props.items);
  const editableItems = [0, 1, 2].map((index) => {
    const base = currentItems[index] ?? { label: `Item ${index + 1}`, body: "" };
    if (payload.update.index === index) {
      return {
        ...base,
        [payload.update.field]: payload.update.value
      };
    }
    return base;
  });
  editableItems.forEach((item, index) => {
    form.set(`item${index}Label`, item.label);
    form.set(`item${index}Body`, item.body);
  });
  const tail = currentItems.slice(3);
  if (tail.length > 0) {
    form.set("itemsTailJson", JSON.stringify(tail));
  }
  return form;
}

type Bounds = { width: number; height: number };

function computeWebsiteBounds(nodes: SceneNode[]): Bounds {
  // Website sections are stacked, each roughly 520px tall with 32px gaps.
  return {
    width: 720,
    height: Math.max(480, nodes.length * 560)
  };
}

function computePrototypeBounds(nodes: SceneNode[]): Bounds {
  const screens = nodes.filter((node) => node.type === "screen");
  const width = Math.max(
    SCREEN_WIDTH,
    screens.length * (SCREEN_WIDTH + SCREEN_GAP) - SCREEN_GAP
  );
  return { width: width + 120, height: SCREEN_HEIGHT + 320 };
}

export function CanvasStage({
  projectId,
  artifactId,
  artifactKind,
  sceneNodes,
  updateSceneNodeAction,
  emptyStateTitle,
  emptyStateDescription,
  unitLabel,
  frameLabel,
  themeLabel,
  themeSlot
}: CanvasStageProps) {
  const { zoom, pan, setZoom, setPan, fit, reset, zoomAt } = useCanvasViewport(artifactId);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isDraggingViewport, setIsDraggingViewport] = useState(false);
  const [, startTransition] = useTransition();

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    originPan: { x: number; y: number };
  } | null>(null);

  const isPanning = tool === "pan" || isSpaceDown;

  // Clear any stale selection when the scene changes underneath us.
  useEffect(() => {
    if (selectedNodeId && !sceneNodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [sceneNodes, selectedNodeId]);

  // Track space key for temporary pan.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && target.closest("input, textarea, [contenteditable='true']")) {
        return;
      }
      if (event.code === "Space") {
        setIsSpaceDown(true);
      } else if (event.key === "0") {
        event.preventDefault();
        reset();
      } else if (event.key === "v" || event.key === "V") {
        setTool("select");
      } else if (event.key === "h" || event.key === "H") {
        setTool("pan");
      } else if (event.key === "f" || event.key === "F") {
        handleFit();
      } else if (event.key === "Escape") {
        setSelectedNodeId(null);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setIsSpaceDown(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset]);

  const handleFit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const bounds =
      artifactKind === "website"
        ? computeWebsiteBounds(sceneNodes)
        : artifactKind === "prototype"
          ? computePrototypeBounds(sceneNodes)
          : { width: 960, height: 540 };
    fit({
      width: bounds.width,
      height: bounds.height,
      viewportWidth,
      viewportHeight
    });
  }, [artifactKind, fit, sceneNodes]);

  // Auto-fit once when first mounting to give a useful default view.
  const didInitialFitRef = useRef(false);
  useLayoutEffect(() => {
    if (didInitialFitRef.current) {
      return;
    }
    if (sceneNodes.length > 0 && viewportRef.current && viewportRef.current.clientWidth > 0) {
      didInitialFitRef.current = true;
      // Defer one frame so layout is final.
      requestAnimationFrame(() => handleFit());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneNodes.length]);

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      // Pinch-to-zoom trackpads report ctrlKey=true; desktop users press
      // ctrl/cmd + wheel for the same effect.
      if (!event.ctrlKey && !event.metaKey) {
        // Plain wheel scrolls-as-pan to keep the page feeling lightweight.
        if (Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) > 0) {
          event.preventDefault();
          setPan((prev) => ({ x: prev.x - event.deltaX, y: prev.y - event.deltaY }));
        }
        return;
      }
      event.preventDefault();
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const factor = Math.exp(-event.deltaY * 0.0015);
      zoomAt(zoom * factor, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        viewportWidth: rect.width,
        viewportHeight: rect.height
      });
    },
    [setPan, zoom, zoomAt]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const isMiddleButton = event.button === 1;
      const shouldPan = isPanning || isMiddleButton;
      if (!shouldPan) {
        // Clicking empty canvas clears selection.
        const target = event.target as HTMLElement;
        if (!target.closest("[data-canvas-node-id]") && event.button === 0) {
          setSelectedNodeId(null);
        }
        return;
      }
      event.preventDefault();
      (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
      dragStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originPan: { ...pan }
      };
      setIsDraggingViewport(true);
    },
    [isPanning, pan]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (!drag) {
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      setPan({ x: drag.originPan.x + dx, y: drag.originPan.y + dy });
    },
    [setPan]
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragStateRef.current) {
        try {
          (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
        } catch {
          /* already released */
        }
        dragStateRef.current = null;
        setIsDraggingViewport(false);
      }
    },
    []
  );

  const handleSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleCommit = useCallback<CanvasNodeCommit>(
    (node, payload) => {
      const formData = buildUpdateFormData({ projectId, artifactId, node, payload });
      startTransition(() => {
        // The server action revalidates the studio page, so we don't need
        // to manage local optimistic state — Next.js will push the new
        // scene props back through as props.
        updateSceneNodeAction(formData).catch((error: unknown) => {
          // Surface in the console — a richer toast path is CANVAS-002.
          // eslint-disable-next-line no-console
          console.error("[canvas] inline edit failed", error);
        });
      });
    },
    [artifactId, projectId, updateSceneNodeAction]
  );

  const screens = useMemo(
    () => sceneNodes.filter((node) => node.type === "screen"),
    [sceneNodes]
  );
  const screenCtas = useMemo(
    () => sceneNodes.filter((node) => node.type === "screen-cta"),
    [sceneNodes]
  );
  const screenLinks = useMemo(
    () => sceneNodes.filter((node) => node.type === "screen-link"),
    [sceneNodes]
  );
  const slideNodes = useMemo(
    () =>
      sceneNodes.filter(
        (node) =>
          node.type === "slide-title" ||
          node.type === "slide-content" ||
          node.type === "slide-closing"
      ),
    [sceneNodes]
  );
  const websiteSections = useMemo(
    () => sceneNodes.filter((node) => node.type === "section" || node.type === "hero"),
    [sceneNodes]
  );

  const screenIndexById = useMemo(() => {
    const map = new Map<string, number>();
    screens.forEach((node, index) => {
      map.set(node.id, index);
    });
    return map;
  }, [screens]);

  const worldStyle: CSSProperties = {
    transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "50% 50%"
  };

  const containerClass = [
    "canvas-surface",
    `canvas-surface-${artifactKind}`,
    isPanning ? "is-panning" : "",
    isDraggingViewport ? "is-dragging" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const isEmpty = sceneNodes.length === 0;

  return (
    <div className="canvas-frame">
      <div className="canvas-frame-head">
        <div className="canvas-frame-head-labels">
          <span className="canvas-frame-kind">{artifactKind}</span>
          <strong>{frameLabel}</strong>
          <span className="canvas-frame-theme">{themeLabel}</span>
        </div>
        <CanvasToolbar
          zoom={zoom}
          tool={tool}
          onToolChange={setTool}
          onZoomIn={() => setZoom((prev) => prev * 1.2)}
          onZoomOut={() => setZoom((prev) => prev / 1.2)}
          onZoomReset={reset}
          onFit={handleFit}
          themeSlot={themeSlot}
        />
      </div>
      <div
        ref={viewportRef}
        className={containerClass}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="canvas-grid-backdrop" aria-hidden />
        {isEmpty ? (
          <CanvasEmptyState
            title={emptyStateTitle}
            description={emptyStateDescription}
            unitLabel={unitLabel}
          />
        ) : (
          <div ref={worldRef} className="canvas-world" style={worldStyle}>
            {artifactKind === "website" ? (
              <div className="canvas-world-website">
                {websiteSections.map((node) => (
                  <CanvasWebsiteSection
                    key={node.id}
                    node={node}
                    selected={selectedNodeId === node.id}
                    onSelect={handleSelect}
                    onCommit={handleCommit}
                  />
                ))}
              </div>
            ) : null}

            {artifactKind === "prototype" ? (
              <div
                className="canvas-world-prototype"
                style={{
                  minWidth: Math.max(
                    SCREEN_WIDTH,
                    screens.length * (SCREEN_WIDTH + SCREEN_GAP) - SCREEN_GAP
                  ),
                  minHeight: SCREEN_HEIGHT + 200
                }}
              >
                <div className="canvas-world-prototype-row">
                  {screens.map((node, index) => {
                    const attachedCta = screenCtas.find(
                      (cta) => readString(cta.props.attachedScreenId) === node.id
                    );
                    return (
                      <div
                        key={node.id}
                        className="canvas-prototype-screen-slot"
                        style={{
                          width: SCREEN_WIDTH,
                          transform: `translateX(${
                            index * (SCREEN_WIDTH + SCREEN_GAP)
                          }px)`
                        }}
                        data-screen-id={node.id}
                      >
                        <CanvasPrototypeScreen
                          node={node}
                          selected={selectedNodeId === node.id}
                          onSelect={handleSelect}
                          onCommit={handleCommit}
                        />
                        {attachedCta ? (
                          <div className="canvas-prototype-attached-cta">
                            <CanvasPrototypeCta
                              node={attachedCta}
                              selected={selectedNodeId === attachedCta.id}
                              onSelect={handleSelect}
                              onCommit={handleCommit}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="canvas-prototype-link-layer">
                  {screenLinks.map((link) => {
                    const fromId = readString(link.props.from);
                    const toId = readString(link.props.to);
                    const fromIndex = screenIndexById.get(fromId);
                    const toIndex = screenIndexById.get(toId);
                    if (fromIndex === undefined || toIndex === undefined) {
                      return null;
                    }
                    const fromX = fromIndex * (SCREEN_WIDTH + SCREEN_GAP) + SCREEN_WIDTH;
                    const fromY = SCREEN_HEIGHT / 2;
                    const toX = toIndex * (SCREEN_WIDTH + SCREEN_GAP);
                    const toY = SCREEN_HEIGHT / 2;
                    return (
                      <CanvasPrototypeLink
                        key={link.id}
                        fromX={fromX}
                        fromY={fromY}
                        toX={toX}
                        toY={toY}
                        trigger={readString(link.props.trigger, "tap")}
                        selected={selectedNodeId === link.id}
                      />
                    );
                  })}
                </div>
                {(() => {
                  const loose = screenCtas.filter(
                    (cta) => !readString(cta.props.attachedScreenId)
                  );
                  if (loose.length === 0) {
                    return null;
                  }
                  return (
                    <div className="canvas-prototype-loose-ctas">
                      <span className="canvas-prototype-loose-label">Loose CTAs</span>
                      <div className="canvas-prototype-loose-row">
                        {loose.map((cta) => (
                          <CanvasPrototypeCta
                            key={cta.id}
                            node={cta}
                            selected={selectedNodeId === cta.id}
                            onSelect={handleSelect}
                            onCommit={handleCommit}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : null}

            {artifactKind === "slides" ? (
              <CanvasSlidesDeck
                nodes={slideNodes}
                selectedNodeId={selectedNodeId}
                onSelect={handleSelect}
                onCommit={handleCommit}
              />
            ) : null}
          </div>
        )}
      </div>
      <div className="canvas-frame-footer">
        <span>
          Double-click any text to edit. Enter commits, Esc cancels. Hold Space to pan,
          Ctrl/Cmd + wheel to zoom.
        </span>
      </div>
    </div>
  );
}
