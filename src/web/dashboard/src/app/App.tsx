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

import React, { useState, useCallback, lazy, Suspense, useEffect } from "react";
import { clientLogger } from "@/lib/client-logger";
import { ThemeProvider } from "@/providers/theme-provider";
import { ProjectProvider } from "@/providers/project-provider";
import { Sidebar, type TabId } from "@/components/layout/sidebar";
import { useGraphData } from "@/hooks/use-graph-data";
import { useStats } from "@/hooks/use-stats";
import { useSSE } from "@/hooks/use-sse";
import { ImportModal } from "@/components/modals/import-modal";
import { CaptureModal } from "@/components/modals/capture-modal";
import { OpenFolderModal } from "@/components/modals/open-folder-modal";
import { FolderOpen, FileUp, Globe } from "lucide-react";
import { SkeletonPage } from "@/components/layout/skeleton";

// Lazy-load tabs
const OverviewTab = lazy(() => import("@/components/tabs/overview-tab").then((m) => ({ default: m.OverviewTab })));
const GraphTab = lazy(() => import("@/components/tabs/graph-tab").then((m) => ({ default: m.GraphTab })));
const PrdBacklogTab = lazy(() => import("@/components/tabs/prd-backlog-tab").then((m) => ({ default: m.PrdBacklogTab })));
const KanbanTab = lazy(() => import("@/components/tabs/kanban-tab").then((m) => ({ default: m.KanbanTab })));
const JourneyTab = lazy(() => import("@/components/tabs/journey-tab").then((m) => ({ default: m.JourneyTab })));
const MemoriesTab = lazy(() => import("@/components/tabs/memories-tab").then((m) => ({ default: m.MemoriesTab })));
const InsightsTab = lazy(() => import("@/components/tabs/insights-tab").then((m) => ({ default: m.InsightsTab })));
const SkillsTab = lazy(() => import("@/components/tabs/skills-tab").then((m) => ({ default: m.SkillsTab })));
const ContextTab = lazy(() => import("@/components/tabs/context-tab").then((m) => ({ default: m.ContextTab })));
const BenchmarkTab = lazy(() => import("@/components/tabs/benchmark-tab").then((m) => ({ default: m.BenchmarkTab })));
const AutopilotTab = lazy(() => import("@/components/tabs/autopilot-tab").then((m) => ({ default: m.AutopilotTab })));
const LogsTab = lazy(() => import("@/components/tabs/logs-tab").then((m) => ({ default: m.LogsTab })));
const SiebelTab = lazy(() => import("@/components/siebel/siebel-tab").then((m) => ({ default: m.SiebelTab })));
const LspTab = lazy(() => import("@/components/tabs/lsp-tab").then((m) => ({ default: m.LspTab })));
const LanguagesTab = lazy(() => import("@/components/tabs/languages-tab").then((m) => ({ default: m.LanguagesTab })));
const DocsTab = lazy(() => import("@/components/tabs/docs-tab").then((m) => ({ default: m.DocsTab })));
const DavinciTab = lazy(() => import("@/components/davinci/davinci-tab").then((m) => ({ default: m.DavinciTab })));
const HarnessTab = lazy(() => import("@/components/tabs/harness-tab").then((m) => ({ default: m.HarnessTab })));
const BrowserPilotTab = lazy(() => import("@/components/tabs/browser-pilot-tab").then((m) => ({ default: m.BrowserPilotTab })));
const HooksTab = lazy(() => import("@/components/tabs/hooks-tab").then((m) => ({ default: m.HooksTab })));
const AgentsTab = lazy(() => import("@/components/tabs/agents-tab").then((m) => ({ default: m.AgentsTab })));

const TAB_LABELS: Record<TabId, string> = {
  overview: "Overview",
  graph: "Graph",
  "prd-backlog": "PRD & Backlog",
  kanban: "Kanban",
  journey: "Journey",
  siebel: "Siebel",
  lsp: "LSP",
  memories: "Memories",
  insights: "Insights",
  skills: "Skills",
  context: "Context",
  benchmark: "Benchmark",
  languages: "Languages",
  davinci: "DaVinci",
  docs: "Docs",
  logs: "Logs",
  harness: "Harness",
  autopilot: "Autopilot",
  "browser-pilot": "Browser Pilot",
  hooks: "Hooks",
  agents: "Agents",
};

const CHUNK_RETRY_KEY = "chunk_retry_attempted";

function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("dynamically imported module") ||
    msg.includes("loading chunk") ||
    msg.includes("failed to fetch");
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error): void {
    clientLogger.reportError(error, { component: "ErrorBoundary" });

    if (isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RETRY_KEY)) {
      sessionStorage.setItem(CHUNK_RETRY_KEY, "1");
      window.location.reload();
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      const isChunk = isChunkLoadError(this.state.error);
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-muted">
          <p className="text-sm">
            {isChunk
              ? "This tab failed to load. The app may have been updated."
              : "Something went wrong."}
          </p>
          <p className="text-xs text-danger">{this.state.error?.message}</p>
          <button
            onClick={() => {
              sessionStorage.removeItem(CHUNK_RETRY_KEY);
              window.location.reload();
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingFallback(): React.JSX.Element {
  return <SkeletonPage />;
}

function AppContent(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [importOpen, setImportOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [openFolderOpen, setOpenFolderOpen] = useState(false);

  useEffect(() => {
    clientLogger.installGlobalHandlers();
    return () => clientLogger.destroy();
  }, []);

  const { graph, loading, error, refresh } = useGraphData();
  const { stats, refresh: refreshStats } = useStats();

  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshStats()]);
  }, [refresh, refreshStats]);

  // SSE: auto-refresh on backend events (skip translation events — handled by LanguagesTab)
  useSSE(useCallback((event: string) => {
    if (!event.startsWith("translation:")) {
      void handleRefresh();
    }
  }, [handleRefresh]));

  const done = stats?.byStatus?.done ?? 0;
  const total = stats?.totalNodes ?? 0;

  return (
    <ProjectProvider onProjectChange={handleRefresh}>
      {/* Skip navigation for a11y */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-white focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <div className="h-screen flex flex-row">
        {/* Sidebar navigation */}
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main area: header + content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Slim header */}
          <header role="banner" className="flex items-center justify-between gap-2 px-4 py-2 border-b border-edge bg-surface-alt md:px-6">
            {/* Left: breadcrumb + stats */}
            <div className="flex items-center gap-3 pl-10 md:pl-0">
              <h1 className="text-sm font-semibold text-foreground">
                {TAB_LABELS[activeTab]}
              </h1>
              {total > 0 && (
                <span className="text-xs text-muted">
                  {done}/{total} done
                </span>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setOpenFolderOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-edge rounded-lg hover:bg-surface-elevated transition-colors"
                aria-label="Open project folder"
                title="Open a different project folder"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open Folder</span>
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent-light transition-colors"
                aria-label="Import PRD file"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Import PRD</span>
              </button>
              <button
                onClick={() => setCaptureOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-edge rounded-lg hover:bg-surface-elevated transition-colors"
                aria-label="Capture web content"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Capture</span>
              </button>
            </div>
          </header>

          {/* Content */}
          <main id="main-content" role="main" aria-label={`${TAB_LABELS[activeTab]} content`} className="flex-1 min-h-0 overflow-hidden">
            {loading ? (
              <LoadingFallback />
            ) : error ? (
              <div className="flex items-center justify-center h-full text-danger">
                {error}
              </div>
            ) : (
              <ErrorBoundary key={activeTab}>
                <Suspense fallback={<LoadingFallback />}>
                  {/* Conditional render: unmounts inactive tabs to reduce DOM nodes */}
                  {activeTab === "overview" && <OverviewTab onNavigate={setActiveTab} />}
                  {activeTab === "graph" && <GraphTab graph={graph} loading={loading} error={error} onRetry={handleRefresh} onImportPrd={() => setImportOpen(true)} />}
                  {activeTab === "prd-backlog" && <PrdBacklogTab graph={graph} loading={loading} error={error} onRetry={handleRefresh} />}
                  {activeTab === "kanban" && <KanbanTab onNavigate={setActiveTab} />}
                  {activeTab === "journey" && <JourneyTab />}
                  {activeTab === "memories" && <MemoriesTab />}
                  {activeTab === "insights" && <InsightsTab />}
                  {activeTab === "skills" && <SkillsTab />}
                  {activeTab === "context" && <ContextTab />}
                  {activeTab === "benchmark" && <BenchmarkTab />}
                  {activeTab === "logs" && <LogsTab />}
                  {activeTab === "siebel" && <SiebelTab />}
                  {activeTab === "lsp" && <LspTab />}
                  {activeTab === "languages" && <LanguagesTab />}
                  {activeTab === "davinci" && <DavinciTab />}
                  {activeTab === "docs" && <DocsTab />}
                  {activeTab === "harness" && <HarnessTab />}
                  {activeTab === "autopilot" && <AutopilotTab />}
                  {activeTab === "browser-pilot" && <BrowserPilotTab />}
                  {activeTab === "hooks" && <HooksTab />}
                  {activeTab === "agents" && <AgentsTab />}
                </Suspense>
              </ErrorBoundary>
            )}
          </main>
        </div>

        <ImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={handleRefresh}
        />
        <CaptureModal
          open={captureOpen}
          onClose={() => setCaptureOpen(false)}
          onImported={handleRefresh}
        />
        <OpenFolderModal
          open={openFolderOpen}
          onClose={() => setOpenFolderOpen(false)}
          onFolderChanged={handleRefresh}
        />
      </div>
    </ProjectProvider>
  );
}

/** App — auto-generated description placeholder. */
export function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
