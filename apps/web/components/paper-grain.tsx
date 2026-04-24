"use client";

/**
 * PaperGrain — Claude Design paper texture overlay.
 *
 * Renders a single site-wide SVG noise layer (feTurbulence) at 2% opacity
 * tinted with `var(--ink-1)`. It sits fixed behind everything, ignores
 * pointer events, and is mounted exactly once from `client-providers.tsx`.
 *
 * The filter produces fractal noise; the rect fills the viewport and is
 * filled with the filter. The effect is deliberately subtle — enough to
 * break up flat paper fills without registering as a pattern.
 */

import type { CSSProperties } from "react";

const wrapStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 0,
  opacity: 0.02,
  // The tint comes from currentColor so the SVG picks up `color:` below.
  color: "var(--ink-1)"
};

const svgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block"
};

export function PaperGrain() {
  return (
    <div aria-hidden="true" style={wrapStyle}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        style={svgStyle}
        preserveAspectRatio="none"
      >
        <filter id="od-paper-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
          />
        </filter>
        <rect
          width="100%"
          height="100%"
          fill="currentColor"
          filter="url(#od-paper-grain)"
        />
      </svg>
    </div>
  );
}

export default PaperGrain;
