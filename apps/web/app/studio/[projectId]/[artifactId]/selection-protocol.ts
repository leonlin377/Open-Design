/**
 * Studio selection postMessage protocol — STUDIO-SELECTION-001.
 *
 * The Sandpack preview iframe posts selection-state events to the parent
 * window; the studio shell listens and threads the result into chat /
 * refine / remix consumers via SelectionProvider.
 *
 * We use a discriminated union tagged with a stable `source` string so the
 * listener can ignore unrelated postMessage traffic (Sandpack itself, HMR,
 * vite, etc.). Rects are expressed in the iframe's own viewport; the parent
 * is responsible for transforming to its own coordinate space.
 */
export type StudioSelectionMessage =
  | {
      source: "opendesign-studio";
      type: "selected";
      /** `data-scene-node-id` of the clicked element or nearest ancestor. Empty string when not found. */
      nodeId: string;
      /** Lower-cased `tagName` of the clicked element (e.g. `"button"`). */
      elementTag: string;
      /** First 80 chars of the element's trimmed `innerText`. */
      textPreview: string;
      /** `getBoundingClientRect()` inside the iframe viewport. */
      rect: { top: number; left: number; width: number; height: number };
    }
  | {
      source: "opendesign-studio";
      type: "deselected";
    };

export const SELECTION_MESSAGE_SOURCE = "opendesign-studio";
