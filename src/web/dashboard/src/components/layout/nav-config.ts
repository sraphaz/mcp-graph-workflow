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

import {
  GitFork,
  ClipboardList,
  Route,
  Network,
  Brain,
  BarChart3,
  Zap,
  Target,
  Timer,
  ScrollText,
  Languages,
  BookOpen,
  Workflow,
  Columns3,
  Code,
  Database,
  LayoutDashboard,
  Wrench,
  Settings,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TabId =
  | "overview"
  | "graph"
  | "prd-backlog"
  | "kanban"
  | "journey"
  | "gitnexus"
  | "memories"
  | "insights"
  | "skills"
  | "context"
  | "benchmark"
  | "logs"
  | "siebel"
  | "lsp"
  | "languages"
  | "davinci"
  | "docs"
  | "harness"
  | "autopilot";

export type NavGroupId = "visualization" | "intelligence" | "tools" | "system";

export interface NavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
  beta?: boolean;
}

export interface NavGroup {
  id: NavGroupId;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "visualization",
    label: "Visualize",
    icon: LayoutDashboard,
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "graph", label: "Graph", icon: GitFork },
      { id: "prd-backlog", label: "PRD & Backlog", icon: ClipboardList },
      { id: "kanban", label: "Kanban", icon: Columns3 },
      { id: "journey", label: "Journey", icon: Route, beta: true },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    icon: Brain,
    items: [
      { id: "gitnexus", label: "Code Graph", icon: Network },
      { id: "memories", label: "Memories", icon: Brain },
      { id: "insights", label: "Insights", icon: BarChart3 },
      { id: "skills", label: "Skills", icon: Zap },
      { id: "harness", label: "Harness", icon: Shield },
      { id: "autopilot", label: "Autopilot", icon: Zap },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    items: [
      { id: "context", label: "Context", icon: Target },
      { id: "benchmark", label: "Benchmark", icon: Timer },
      { id: "languages", label: "Languages", icon: Languages, beta: true },
      { id: "davinci", label: "DaVinci", icon: Workflow, beta: true },
      { id: "siebel", label: "Siebel", icon: Database, beta: true },
      { id: "lsp", label: "LSP", icon: Code, beta: true },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: Settings,
    items: [
      { id: "docs", label: "Docs", icon: BookOpen },
      { id: "logs", label: "Logs", icon: ScrollText },
    ],
  },
];

/** Flat array derived from NAV_GROUPS — backward compat with existing code */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
