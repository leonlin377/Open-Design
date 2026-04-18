"use client";

import { useState, type ReactNode } from "react";
import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider
} from "@codesandbox/sandpack-react";
import { Surface } from "@opendesign/ui";

const inspectorTabs = [
  { id: "preview", label: "Preview" },
  { id: "code", label: "Code" },
  { id: "inspector", label: "Inspector" },
  { id: "versions", label: "Versions" },
  { id: "export", label: "Export" }
] as const;

export type StudioInspectorTab = (typeof inspectorTabs)[number]["id"];

type StudioInspectorProps = {
  initialTab: StudioInspectorTab;
  sourceBundle: {
    filenameBase: string;
    files: Record<string, string>;
  };
  frameLabel: string;
  syncStrategy: string;
  versionLane: string;
  inspectorPanel: ReactNode;
  versionsPanel: ReactNode;
  exportPanel: ReactNode;
  artifactSwitcher: ReactNode;
};

export function StudioInspector({
  initialTab,
  sourceBundle,
  frameLabel,
  syncStrategy,
  versionLane,
  inspectorPanel,
  versionsPanel,
  exportPanel,
  artifactSwitcher
}: StudioInspectorProps) {
  const [activeTab, setActiveTab] = useState<StudioInspectorTab>(initialTab);

  return (
    <aside className="inspector">
      <div className="tab-row">
        {inspectorTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === activeTab ? "tab active" : "tab"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="inspector-section">
        <SandpackProvider
          template="react-ts"
          files={sourceBundle.files}
          options={{
            activeFile: "/App.tsx",
            visibleFiles: Object.keys(sourceBundle.files)
          }}
        >
          <div className={activeTab === "preview" ? "studio-tab-panel active" : "studio-tab-panel"}>
            <div className="footer-note">
              Preview runs from the live session bundle. Code edits here stay local until
              save/back-sync lands.
            </div>
            <div className="studio-sandpack-shell">
              <SandpackPreview
                className="studio-preview-shell"
                showNavigator={false}
                showRefreshButton
                showRestartButton
              />
            </div>
            <Surface className="kv">
              <span>Active Frame</span>
              {frameLabel}
            </Surface>
            <Surface className="kv">
              <span>Sync Strategy</span>
              {syncStrategy}
            </Surface>
            <Surface className="kv">
              <span>Version Lane</span>
              {versionLane}
            </Surface>
          </div>

          <div className={activeTab === "code" ? "studio-tab-panel active" : "studio-tab-panel"}>
            <Surface className="project-card" as="section">
              <div>
                <h3>Session Code Workspace</h3>
                <p className="footer-note">
                  Edit the generated scaffold locally in this session. Exports still derive
                  from the scene document until code sync save lands.
                </p>
              </div>
              <div className="project-meta">
                <span>{sourceBundle.filenameBase}</span>
                <span>{Object.keys(sourceBundle.files).length} files</span>
              </div>
            </Surface>
            <div className="studio-sandpack-shell">
              <SandpackLayout className="studio-code-layout">
                <SandpackFileExplorer autoHiddenFiles={false} />
                <div className="studio-code-column">
                  <SandpackCodeEditor
                    showTabs
                    showLineNumbers
                    showInlineErrors
                    wrapContent
                  />
                </div>
              </SandpackLayout>
            </div>
          </div>
        </SandpackProvider>

        <div className={activeTab === "inspector" ? "studio-tab-panel active" : "studio-tab-panel"}>
          {inspectorPanel}
        </div>

        <div className={activeTab === "versions" ? "studio-tab-panel active" : "studio-tab-panel"}>
          {versionsPanel}
        </div>

        <div className={activeTab === "export" ? "studio-tab-panel active" : "studio-tab-panel"}>
          {exportPanel}
        </div>

        <div className="project-meta">{artifactSwitcher}</div>
      </div>
    </aside>
  );
}
