"use client";

/**
 * Studio selection context — STUDIO-SELECTION-001.
 *
 * Owns the single source of truth for "what element is currently selected
 * inside the Sandpack preview iframe". Listens to postMessage events
 * emitted by the injected iframe shim (see `selection-iframe-shim.ts`) and
 * exposes a React hook so consumers (chat column, inline refine bubble,
 * refine trigger inside the composer) can react without prop-drilling.
 *
 * Coordinates: the shim reports `rect` in the iframe's own viewport. The
 * provider accepts an `iframeRef` callback so consumers can translate
 * iframe-viewport coords into the parent viewport's coordinate space. The
 * transform is just the iframe's own `getBoundingClientRect()` top-left
 * added to the reported `rect.top` / `rect.left`:
 *
 *   parentTop  = iframeRect.top  + rect.top
 *   parentLeft = iframeRect.left + rect.left
 *
 * We re-probe the iframe position on every `useViewportRect` call (cheap,
 * and it stays correct when the user scrolls the canvas surface or resizes
 * the window).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  SELECTION_MESSAGE_SOURCE,
  type StudioSelectionMessage
} from "./selection-protocol";

export type SelectedNode = {
  /** `data-scene-node-id` of the selected element. May be "" for raw DOM. */
  nodeId: string;
  /** Lower-cased HTML tag name (e.g. `"button"`). */
  elementTag: string;
  /** Short innerText snippet, trimmed to 80 chars. */
  textPreview: string;
  /** Rect in the iframe's own viewport. */
  rect: { top: number; left: number; width: number; height: number };
};

type SelectionContextValue = {
  selected: SelectedNode | null;
  /** Manually clear the selection (used by Escape / dismiss flows). */
  clear: () => void;
  /**
   * Register the canvas preview iframe so we can transform iframe-local
   * rects into parent-viewport rects. Pass `null` to unregister.
   */
  registerIframe: (el: HTMLIFrameElement | null) => void;
  /**
   * Resolve the selected element's rect in the parent viewport coord space.
   * Returns null when no selection or iframe registered yet.
   */
  getViewportRect: () => {
    top: number;
    left: number;
    width: number;
    height: number;
  } | null;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as StudioSelectionMessage | undefined;
      if (!data || typeof data !== "object") return;
      if (data.source !== SELECTION_MESSAGE_SOURCE) return;
      if (data.type === "selected") {
        setSelected({
          nodeId: data.nodeId,
          elementTag: data.elementTag,
          textPreview: data.textPreview,
          rect: data.rect
        });
      } else if (data.type === "deselected") {
        setSelected(null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const clear = useCallback(() => setSelected(null), []);

  const registerIframe = useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el;
  }, []);

  const getViewportRect = useCallback(() => {
    if (!selected) return null;
    const iframe = iframeRef.current;
    // Probe live so scroll / resize don't desync the offset.
    const offset = iframe ? iframe.getBoundingClientRect() : { top: 0, left: 0 };
    return {
      top: offset.top + selected.rect.top,
      left: offset.left + selected.rect.left,
      width: selected.rect.width,
      height: selected.rect.height
    };
  }, [selected]);

  const value = useMemo<SelectionContextValue>(
    () => ({ selected, clear, registerIframe, getViewportRect }),
    [selected, clear, registerIframe, getViewportRect]
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

/**
 * Canvas-facing hook — returns everything including `registerIframe`.
 * Consumers that only read selection should use `useSelection()`.
 */
export function useSelectionInternals(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    // Fail soft in non-studio contexts: return a static empty shape.
    return {
      selected: null,
      clear: () => undefined,
      registerIframe: () => undefined,
      getViewportRect: () => null
    };
  }
  return ctx;
}

/**
 * Public consumer hook. Consumers outside the studio shell get a stable
 * null selection without throwing, which keeps the studio composable in
 * isolated component tests.
 */
export function useSelection(): {
  selected: SelectedNode | null;
  clear: () => void;
  getViewportRect: () => {
    top: number;
    left: number;
    width: number;
    height: number;
  } | null;
} {
  const { selected, clear, getViewportRect } = useSelectionInternals();
  return { selected, clear, getViewportRect };
}
