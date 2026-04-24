"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type CanvasPan = { x: number; y: number };

export type CanvasViewportState = {
  zoom: number;
  pan: CanvasPan;
};

export type UseCanvasViewportResult = {
  zoom: number;
  pan: CanvasPan;
  setZoom: (next: number | ((previous: number) => number)) => void;
  setPan: (next: CanvasPan | ((previous: CanvasPan) => CanvasPan)) => void;
  fit: (bounds: { width: number; height: number; viewportWidth: number; viewportHeight: number }) => void;
  reset: () => void;
  zoomAt: (
    nextZoom: number,
    anchor: { x: number; y: number; viewportWidth: number; viewportHeight: number }
  ) => void;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const DEFAULT_STATE: CanvasViewportState = { zoom: 1, pan: { x: 0, y: 0 } };

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function storageKey(artifactId: string): string {
  return `opendesign:canvas-viewport:${artifactId}`;
}

function readPersisted(artifactId: string): CanvasViewportState {
  if (typeof window === "undefined") {
    return DEFAULT_STATE;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(artifactId));
    if (!raw) {
      return DEFAULT_STATE;
    }
    const parsed = JSON.parse(raw) as Partial<CanvasViewportState>;
    const zoom = clampZoom(typeof parsed.zoom === "number" ? parsed.zoom : 1);
    const pan =
      parsed.pan && typeof parsed.pan.x === "number" && typeof parsed.pan.y === "number"
        ? { x: parsed.pan.x, y: parsed.pan.y }
        : { x: 0, y: 0 };
    return { zoom, pan };
  } catch {
    return DEFAULT_STATE;
  }
}

export function useCanvasViewport(artifactId: string): UseCanvasViewportResult {
  const [state, setState] = useState<CanvasViewportState>(DEFAULT_STATE);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setState(readPersisted(artifactId));
    hydratedRef.current = true;
  }, [artifactId]);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(storageKey(artifactId), JSON.stringify(state));
    } catch {
      /* quota / privacy modes — ignore */
    }
  }, [artifactId, state]);

  const setZoom = useCallback(
    (next: number | ((previous: number) => number)) => {
      setState((prev) => {
        const raw = typeof next === "function" ? next(prev.zoom) : next;
        return { ...prev, zoom: clampZoom(raw) };
      });
    },
    []
  );

  const setPan = useCallback(
    (next: CanvasPan | ((previous: CanvasPan) => CanvasPan)) => {
      setState((prev) => {
        const raw = typeof next === "function" ? next(prev.pan) : next;
        return { ...prev, pan: { x: raw.x, y: raw.y } };
      });
    },
    []
  );

  const zoomAt = useCallback<UseCanvasViewportResult["zoomAt"]>(
    (nextZoom, anchor) => {
      setState((prev) => {
        const clamped = clampZoom(nextZoom);
        if (clamped === prev.zoom) {
          return prev;
        }
        // Keep the point under the cursor stable by anchoring the transform:
        // the world-space point under the cursor before and after the zoom
        // must stay aligned, which means pan must absorb the scale delta.
        const centerX = anchor.viewportWidth / 2;
        const centerY = anchor.viewportHeight / 2;
        const worldX = (anchor.x - centerX - prev.pan.x) / prev.zoom;
        const worldY = (anchor.y - centerY - prev.pan.y) / prev.zoom;
        const nextPan = {
          x: prev.pan.x + (anchor.x - centerX - prev.pan.x) - worldX * clamped,
          y: prev.pan.y + (anchor.y - centerY - prev.pan.y) - worldY * clamped
        };
        // Round slightly to avoid floating drift during repeated wheel events.
        return {
          zoom: Math.round(clamped * 1000) / 1000,
          pan: {
            x: Math.round(nextPan.x * 100) / 100,
            y: Math.round(nextPan.y * 100) / 100
          }
        };
      });
    },
    []
  );

  const fit = useCallback<UseCanvasViewportResult["fit"]>((bounds) => {
    if (
      bounds.width <= 0 ||
      bounds.height <= 0 ||
      bounds.viewportWidth <= 0 ||
      bounds.viewportHeight <= 0
    ) {
      return;
    }
    const padding = 48;
    const scaleX = (bounds.viewportWidth - padding * 2) / bounds.width;
    const scaleY = (bounds.viewportHeight - padding * 2) / bounds.height;
    const zoom = clampZoom(Math.min(scaleX, scaleY, 1));
    setState({ zoom, pan: { x: 0, y: 0 } });
  }, []);

  const reset = useCallback(() => {
    setState({ zoom: 1, pan: { x: 0, y: 0 } });
  }, []);

  return useMemo(
    () => ({
      zoom: state.zoom,
      pan: state.pan,
      setZoom,
      setPan,
      fit,
      reset,
      zoomAt
    }),
    [state.zoom, state.pan, setZoom, setPan, fit, reset, zoomAt]
  );
}

export const CANVAS_ZOOM_LIMITS = { min: MIN_ZOOM, max: MAX_ZOOM } as const;
