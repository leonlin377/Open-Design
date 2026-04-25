"use client";

import type { UnifiedSendState } from "./use-unified-send";

type AgentDef = {
  id: string;
  label: string;
  labelEn: string;
  mapStates: UnifiedSendState[];
};

const AGENTS: AgentDef[] = [
  { id: "design", label: "设计", labelEn: "Design", mapStates: ["generating"] },
  { id: "content", label: "内容", labelEn: "Content", mapStates: ["streaming"] },
  { id: "layout", label: "布局", labelEn: "Layout", mapStates: ["refining"] },
];

type AgentChipStatus = "idle" | "working" | "done";

function deriveChipStatus(
  agent: AgentDef,
  sendState: UnifiedSendState,
  _previouslyActive: Set<string>
): AgentChipStatus {
  if (agent.mapStates.includes(sendState)) return "working";
  if (_previouslyActive.has(agent.id)) return "done";
  return "idle";
}

export function AgentStatusStrip({
  sendState,
  compact = false,
  previouslyActive = new Set(),
}: {
  sendState: UnifiedSendState;
  compact?: boolean;
  previouslyActive?: Set<string>;
}) {
  return (
    <div className="studio-agent-chips" role="status" aria-label="Agent team status">
      {AGENTS.map((agent) => {
        const status = deriveChipStatus(agent, sendState, previouslyActive);
        return (
          <span
            key={agent.id}
            className="studio-agent-chip"
            data-status={status}
            data-agent={agent.id}
          >
            <span className="studio-agent-chip-dot" aria-hidden="true" />
            {!compact && (
              <span className="studio-agent-chip-label">{agent.label}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
