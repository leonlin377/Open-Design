/**
 * Studio selection iframe shim — STUDIO-SELECTION-001.
 *
 * Generates a self-contained JS snippet that runs inside the Sandpack
 * preview iframe. The snippet installs click + Escape listeners that post
 * selection messages to the parent window using the protocol defined in
 * `selection-protocol.ts`.
 *
 * The shim is idempotent (`__openDesignSelectionInstalled` guard) so that
 * Sandpack refreshes — which re-run the entry module — don't double-bind.
 * When the iframe reloads and Sandpack re-evaluates `/main.tsx`, this file
 * is re-imported; the guard makes the second pass a no-op.
 */
import { SELECTION_MESSAGE_SOURCE } from "./selection-protocol";

/**
 * Path inside the Sandpack virtual filesystem where the shim is written.
 * `/main.tsx` imports it so the handlers register before React mounts.
 */
export const SELECTION_SHIM_PATH = "/opendesign-selection.ts";

/**
 * Import specifier injected at the top of the Sandpack entry module.
 * Matches `SELECTION_SHIM_PATH` without the extension, per Vite rules.
 */
export const SELECTION_SHIM_IMPORT = 'import "./opendesign-selection";';

/**
 * Raw JS/TS source for the shim. Kept as a string so it ships intact into
 * the Sandpack filesystem — we don't want our bundler to transform it.
 */
export const SELECTION_SHIM_SOURCE = `/* eslint-disable */
// Auto-injected by opendesign studio — forwards canvas selection events to
// the parent window via postMessage. See selection-protocol.ts.
(function () {
  if (typeof window === "undefined") return;
  if ((window as any).__openDesignSelectionInstalled) return;
  (window as any).__openDesignSelectionInstalled = true;

  const SRC = ${JSON.stringify(SELECTION_MESSAGE_SOURCE)};
  // Rust-terracotta accent — matches parent-side --rust selection stroke.
  const OUTLINE_COLOR = "#C87E4F";
  const OUTLINE_ID = "__opendesign-selection-outline";

  function post(msg: any) {
    try {
      window.parent?.postMessage({ source: SRC, ...msg }, "*");
    } catch {
      /* parent may be cross-origin but postMessage still works; swallow */
    }
  }

  // -- Outline draw (inside the iframe, document-scoped) -----------------
  // We render a single <div> fixed to the viewport and reposition it via
  // requestAnimationFrame when the selection target changes, when the page
  // scrolls, or when the iframe is resized. Pointer-events: none so clicks
  // pass through to the underlying DOM.
  let currentTarget: HTMLElement | null = null;
  let rafHandle: number | null = null;

  function ensureOutlineEl(): HTMLDivElement | null {
    if (!document || !document.body) return null;
    let el = document.getElementById(OUTLINE_ID) as HTMLDivElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = OUTLINE_ID;
      el.setAttribute("aria-hidden", "true");
      el.style.position = "fixed";
      el.style.pointerEvents = "none";
      el.style.zIndex = "2147483646";
      el.style.border = "2px solid " + OUTLINE_COLOR;
      el.style.borderRadius = "2px";
      el.style.boxSizing = "border-box";
      el.style.transition = "none";
      el.style.display = "none";
      document.body.appendChild(el);
    }
    return el;
  }

  function scheduleDraw() {
    if (rafHandle !== null) return;
    rafHandle = requestAnimationFrame(() => {
      rafHandle = null;
      drawOutline();
    });
  }

  function drawOutline() {
    const el = ensureOutlineEl();
    if (!el) return;
    if (!currentTarget || !currentTarget.isConnected) {
      el.style.display = "none";
      return;
    }
    const r = currentTarget.getBoundingClientRect();
    el.style.display = "block";
    el.style.top = r.top + "px";
    el.style.left = r.left + "px";
    el.style.width = r.width + "px";
    el.style.height = r.height + "px";
  }

  function clearOutline() {
    currentTarget = null;
    const el = document.getElementById(OUTLINE_ID);
    if (el) (el as HTMLElement).style.display = "none";
  }

  function onClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (!target || !(target instanceof HTMLElement)) return;
    // Empty-space click (body/html) → deselect.
    if (target === document.body || target === document.documentElement) {
      clearOutline();
      post({ type: "deselected" });
      return;
    }
    const rect = target.getBoundingClientRect();
    const self = target.getAttribute("data-scene-node-id");
    const ancestor = !self
      ? target.closest("[data-scene-node-id]")?.getAttribute("data-scene-node-id") ?? ""
      : "";
    const nodeId = self || ancestor || "";
    currentTarget = target;
    scheduleDraw();
    post({
      type: "selected",
      nodeId,
      elementTag: target.tagName.toLowerCase(),
      textPreview: (target.innerText || "").trim().slice(0, 80),
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }
    });
    e.stopPropagation();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      clearOutline();
      post({ type: "deselected" });
    }
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
  // Keep the outline pinned to the target as the page scrolls or reflows.
  window.addEventListener("scroll", scheduleDraw, true);
  window.addEventListener("resize", scheduleDraw);
})();

export {};
`;
