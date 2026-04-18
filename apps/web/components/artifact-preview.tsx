"use client";

import { Sandpack } from "@codesandbox/sandpack-react";
import type { SceneNode } from "@opendesign/contracts";
import { buildArtifactSourceBundle } from "@opendesign/exporters";

type ArtifactPreviewProps = {
  artifactKind: "website" | "prototype" | "slides";
  artifactName: string;
  prompt: string;
  sceneNodes: SceneNode[];
};

export function ArtifactPreview(props: ArtifactPreviewProps) {
  const bundle = buildArtifactSourceBundle(props);

  return (
    <div
      style={{
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid rgba(42, 49, 66, 0.8)"
      }}
    >
      <Sandpack
        template="react-ts"
        files={bundle.files}
        options={{
          showTabs: true,
          showLineNumbers: true,
          showNavigator: false,
          editorHeight: 520,
          editorWidthPercentage: 58,
          resizablePanels: true
        }}
      />
    </div>
  );
}
