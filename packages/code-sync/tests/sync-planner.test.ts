import { describe, expect, test } from "vitest";

import { planSyncPatch } from "../src/index";

describe("planSyncPatch", () => {
  test("returns a full sync plan for supported code to scene updates", () => {
    const plan = planSyncPatch({
      sourceMode: "code-supported",
      targetMode: "scene",
      changeScope: "node"
    });

    expect(plan).toEqual({
      mode: "full",
      reason: "Supported code can round-trip into scene structures.",
      sourceMode: "code-supported",
      targetMode: "scene",
      changeScope: "node"
    });
  });

  test("returns a constrained sync plan for advanced code edits", () => {
    const plan = planSyncPatch({
      sourceMode: "code-advanced",
      targetMode: "scene",
      changeScope: "section"
    });

    expect(plan).toEqual({
      mode: "constrained",
      reason: "Advanced code can only safely sync at section granularity.",
      sourceMode: "code-advanced",
      targetMode: "scene",
      changeScope: "section"
    });
  });
});
