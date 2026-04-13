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
  | "harness";

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
