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

import { memo } from "react";
import { BetaBadge } from "./beta-badge";

export type TabId = "graph" | "prd-backlog" | "journey" | "gitnexus" | "memories" | "insights" | "skills" | "context" | "benchmark" | "logs" | "siebel" | "hooks" | "lifecycle-health" | "agents";

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: Array<{ id: TabId; label: string; beta?: boolean }> = [
  { id: "graph", label: "Graph" },
  { id: "prd-backlog", label: "PRD & Backlog" },
  { id: "journey", label: "Journey", beta: true },
  { id: "gitnexus", label: "Code Graph" },
  { id: "siebel", label: "Siebel", beta: true },
  { id: "memories", label: "Memories" },
  { id: "insights", label: "Insights" },
  { id: "skills", label: "Skills" },
  { id: "context", label: "Context" },
  { id: "benchmark", label: "Benchmark" },
  { id: "logs", label: "Logs" },
  { id: "hooks", label: "Hooks", beta: true },
  { id: "lifecycle-health", label: "Lifecycle Health", beta: true },
  { id: "agents", label: "Agents", beta: true },
];

export const TabNav = memo(function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <nav
      className="flex overflow-x-auto border-b border-edge bg-surface-alt"
      role="tablist"
      aria-label="Dashboard sections"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
            activeTab === tab.id
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {tab.label}
          {tab.beta && <BetaBadge />}
        </button>
      ))}
    </nav>
  );
});
