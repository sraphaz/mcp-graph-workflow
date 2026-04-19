/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { useAgentActivity } from "@/hooks/use-agent-activity";
import type { AgentActivity } from "@/hooks/use-agent-activity";

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: "#4caf50", bg: "rgba(76,175,80,0.15)", label: "Active" },
  stale: { color: "#9e9e9e", bg: "rgba(158,158,158,0.15)", label: "Inactive" },
};

function AgentCard({ agent }: { agent: AgentActivity }): React.JSX.Element {
  const config = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.stale;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border border-edge bg-surface-alt transition-colors"
      style={agent.status === "stale" ? { opacity: 0.6 } : undefined}
    >
      {/* Status indicator */}
      <div className="relative shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: config.bg, color: config.color }}
        >
          {agent.agentId.slice(0, 2).toUpperCase()}
        </div>
        {agent.status === "active" && (
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-alt" style={{ background: config.color }} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold truncate">{agent.agentId}</span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
            style={{ background: config.bg, color: config.color }}
          >
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted">
          <span title="Last heartbeat">{formatTimeAgo(agent.lastHeartbeat)}</span>
          {agent.activeLocks > 0 && (
            <span title="Active locks">
              {agent.activeLocks} lock{agent.activeLocks > 1 ? "s" : ""}
            </span>
          )}
          {agent.currentTaskId && (
            <span className="truncate" title={`Working on: ${agent.currentTaskId}`}>
              {agent.currentTaskId.slice(0, 16)}...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Agent Activity Monitor — shows active agents with real-time status.
 * Updates via SSE when agent heartbeat events arrive.
 */
export function AgentActivityMonitor(): React.JSX.Element {
  const { data, loading, error } = useAgentActivity();

  if (loading && !data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg border border-edge bg-surface-alt animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-muted text-center py-3">
        Failed to load agent activity
      </div>
    );
  }

  if (!data || !data.teamTaskEnabled || data.agents.length === 0) {
    return (
      <div className="text-xs text-muted text-center py-3">
        No agents active — enable teamTask mode to see activity
      </div>
    );
  }

  const activeCount = data.agents.filter((a) => a.status === "active").length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-muted">
          {activeCount}/{data.agents.length} active
        </span>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: activeCount > 0 ? "#4caf50" : "#9e9e9e" }} />
      </div>
      <div className="space-y-2">
        {data.agents.map((agent) => (
          <AgentCard key={agent.agentId} agent={agent} />
        ))}
      </div>
    </div>
  );
}
