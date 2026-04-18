"use client";

import { useState, type ReactNode } from "react";
import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack
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
  projectId: string;
  artifactId: string;
  initialTab: StudioInspectorTab;
  sourceBundle: {
    filenameBase: string;
    files: Record<string, string>;
  };
  sceneVersion: number;
  codeWorkspaceBaseSceneVersion: number | null;
  codeWorkspaceUpdatedAt: string | null;
  frameLabel: string;
  syncStrategy: string;
  versionLane: string;
  saveCodeWorkspaceAction: (formData: FormData) => void | Promise<void>;
  inspectorPanel: ReactNode;
  versionsPanel: ReactNode;
  exportPanel: ReactNode;
  artifactSwitcher: ReactNode;
};

function SaveCodeWorkspaceForm(props: {
  projectId: string;
  artifactId: string;
  sceneVersion: number;
  codeWorkspaceBaseSceneVersion: number | null;
  codeWorkspaceUpdatedAt: string | null;
  saveCodeWorkspaceAction: (formData: FormData) => void | Promise<void>;
}) {
  const { sandpack } = useSandpack();
  const files = Object.fromEntries(
    Object.entries(sandpack.files).map(([filePath, value]) => [
      filePath,
      typeof value === "string" ? value : value.code
    ])
  );
  const hasSceneDrift =
    props.codeWorkspaceBaseSceneVersion !== null &&
    props.codeWorkspaceBaseSceneVersion !== props.sceneVersion;

  return (
    <form action={props.saveCodeWorkspaceAction} className="stack-form">
      <input type="hidden" name="projectId" value={props.projectId} />
      <input type="hidden" name="artifactId" value={props.artifactId} />
      <input type="hidden" name="filesJson" value={JSON.stringify(files)} />
      <div className="project-meta">
        <span>
          {props.codeWorkspaceUpdatedAt
            ? `Saved from scene v${props.codeWorkspaceBaseSceneVersion} at ${new Date(props.codeWorkspaceUpdatedAt).toLocaleString("zh-CN")}`
            : "No saved code workspace yet"}
        </span>
        <span>
          {hasSceneDrift
            ? `Scene is now v${props.sceneVersion}; save again to refresh ZIP and preview from the latest scene baseline`
            : "ZIP export follows the saved code workspace when present"}
        </span>
      </div>
      <button type="submit" className="button-link ghost studio-inline-button">
        Save Code Workspace
      </button>
    </form>
  );
}

export function StudioInspector({
  projectId,
  artifactId,
  initialTab,
  sourceBundle,
  sceneVersion,
  codeWorkspaceBaseSceneVersion,
  codeWorkspaceUpdatedAt,
  frameLabel,
  syncStrategy,
  versionLane,
  saveCodeWorkspaceAction,
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
              Preview runs from the live session bundle. Saved code workspaces seed this
              bundle when present, while snapshots and HTML export stay scene-based.
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
                  Edit the scaffold locally, then save it as a persisted code workspace.
                  Scene snapshots and HTML export still follow the scene document.
                </p>
              </div>
              <div className="project-meta">
                <span>{sourceBundle.filenameBase}</span>
                <span>{Object.keys(sourceBundle.files).length} files</span>
              </div>
              <SaveCodeWorkspaceForm
                projectId={projectId}
                artifactId={artifactId}
                sceneVersion={sceneVersion}
                codeWorkspaceBaseSceneVersion={codeWorkspaceBaseSceneVersion}
                codeWorkspaceUpdatedAt={codeWorkspaceUpdatedAt}
                saveCodeWorkspaceAction={saveCodeWorkspaceAction}
              />
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
