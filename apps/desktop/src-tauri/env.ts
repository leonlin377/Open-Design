/**
 * Shared constants for the OpenDesign Studio desktop shell.
 *
 * This file exists so that:
 *  1. `tsc -p tsconfig.json` has at least one input and does not fail with TS18003.
 *  2. Any future TypeScript glue (preload scripts, build-time codegen) has a
 *     single source of truth for the Studio origin fallback.
 *
 * The Rust side (`src/lib.rs`) hard-codes the same default; keep them in sync.
 */

/** Default Studio origin used when `OPENDESIGN_STUDIO_URL` is not set. */
export const DEFAULT_STUDIO_URL = "http://127.0.0.1:3100";

/** Name of the environment variable that overrides {@link DEFAULT_STUDIO_URL}. */
export const STUDIO_URL_ENV = "OPENDESIGN_STUDIO_URL";

/**
 * Resolve the Studio origin from `process.env`, falling back to the dev default.
 * Only used by optional Node-side build tooling; the runtime shell reads the
 * variable directly in Rust.
 */
export function resolveStudioUrl(env: NodeJS.ProcessEnv = process.env): string {
  const candidate = env[STUDIO_URL_ENV];
  return candidate && candidate.length > 0 ? candidate : DEFAULT_STUDIO_URL;
}
