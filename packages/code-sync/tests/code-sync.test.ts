import { describe, expect, test } from "vitest";

import { planSyncPatch } from "../src/index";

describe("planSyncPatch", () => {
  test("uses a full sync plan for supported round-trip code edits", () => {
    expect(
      planSyncPatch({
        sourceMode: "code-supported",
        targetMode: "scene",
        changeScope: "node"
      })
    ).toEqual({
      mode: "full",
      reason: "Supported code can round-trip into scene structures.",
      sourceMode: "code-supported",
      targetMode: "scene",
      changeScope: "node"
    });
  });

  test("uses a constrained sync plan for advanced code edits", () => {
    expect(
      planSyncPatch({
        sourceMode: "code-advanced",
        targetMode: "scene",
        changeScope: "section"
      })
    ).toEqual({
      mode: "constrained",
      reason: "Advanced code can only safely sync at section granularity.",
      sourceMode: "code-advanced",
      targetMode: "scene",
      changeScope: "section"
    });
  });
});
