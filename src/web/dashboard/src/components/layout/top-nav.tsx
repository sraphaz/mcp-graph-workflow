/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-dashboard-ux — Task 2.1: <TopNav> com 3 áreas.
 *
 * Sticky top-nav with 3 area buttons (Overview, Work, Insights).
 * Clicking an area expands an inline sub-nav row below (not a dropdown).
 * URL hash is synced: #?area=<id>&tab=<tabId> for deep linking.
 */

import { memo, useCallback, useEffect, useState } from "react";
import type { TabId } from "./nav-config";

// ── Area definitions ─────────────────────────────────────

export type AreaId = "overview" | "work" | "insights";

interface AreaTab {
  id: TabId;
  label: string;
}

const AREA_TABS: Record<AreaId, AreaTab[]> = {
  overview: [{ id: "overview", label: "Overview" }],
  work: [
    { id: "graph", label: "Graph" },
    { id: "prd-backlog", label: "PRD & Backlog" },
    { id: "kanban", label: "Kanban" },
    { id: "journey", label: "Journey" },
    { id: "autopilot", label: "Autopilot" },
    { id: "browser-pilot", label: "Browser Pilot" },
    { id: "hooks", label: "Hooks" },
    { id: "agents", label: "Agents" },
    { id: "docs", label: "Docs" },
    { id: "logs", label: "Logs" },
  ],
  insights: [
    { id: "insights", label: "Insights" },
    { id: "memories", label: "Memories" },
    { id: "skills", label: "Skills" },
    { id: "harness", label: "Harness" },
    { id: "context", label: "Context" },
    { id: "benchmark", label: "Benchmark" },
    { id: "lsp", label: "LSP" },
    { id: "siebel", label: "Siebel" },
    { id: "languages", label: "Languages" },
    { id: "davinci", label: "DaVinci" },
  ],
};

const AREAS: Array<{ id: AreaId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "work", label: "Work" },
  { id: "insights", label: "Insights" },
];

// ── URL helpers ──────────────────────────────────────────

function areaForTab(tabId: TabId): AreaId | null {
  for (const [area, tabs] of Object.entries(AREA_TABS) as [AreaId, AreaTab[]][]) {
    if (tabs.some((t) => t.id === tabId)) return area;
  }
  return null;
}

function parseHash(): { area: AreaId | null; tab: TabId | null } {
  const hash = window.location.hash.replace(/^#\??/, "");
  const params = new URLSearchParams(hash);
  const area = params.get("area") as AreaId | null;
  const tab = params.get("tab") as TabId | null;
  return { area, tab };
}

function setHash(area: AreaId, tab?: TabId): void {
  const params = new URLSearchParams();
  params.set("area", area);
  if (tab) params.set("tab", tab);
  window.location.hash = "?" + params.toString();
}

// ── Component ────────────────────────────────────────────

interface TopNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const TopNav = memo(function TopNav({ activeTab, onTabChange }: TopNavProps): React.JSX.Element {
  const derivedArea = areaForTab(activeTab);
  const [activeArea, setActiveArea] = useState<AreaId | null>(() => {
    const { area } = parseHash();
    return area ?? derivedArea;
  });

  // Sync from URL hash on mount (deep link support)
  useEffect(() => {
    const { area, tab } = parseHash();
    if (area) {
      setActiveArea(area);
      if (tab && tab !== activeTab) onTabChange(tab);
    } else if (derivedArea) {
      setActiveArea(derivedArea);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAreaClick = useCallback((areaId: AreaId): void => {
    setActiveArea(areaId);
    setHash(areaId);
    // Navigate to first tab of the area if current tab not in this area
    const tabs = AREA_TABS[areaId];
    if (tabs.length === 1) {
      onTabChange(tabs[0].id);
      setHash(areaId, tabs[0].id);
    }
  }, [onTabChange]);

  const handleSubTabClick = useCallback((tab: TabId): void => {
    if (activeArea) setHash(activeArea, tab);
    onTabChange(tab);
  }, [activeArea, onTabChange]);

  const handleAreaKeyDown = useCallback((e: React.KeyboardEvent, areaId: AreaId): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAreaClick(areaId);
    }
  }, [handleAreaClick]);

  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-edge">
      {/* Area tabs row */}
      <nav role="navigation" aria-label="Main navigation">
        <div role="tablist" aria-label="Navigation areas" className="flex">
          {AREAS.map((area) => {
            const isActive = activeArea === area.id;
            return (
              <button
                key={area.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-area-${area.id}`}
                id={`tab-area-${area.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleAreaClick(area.id)}
                onKeyDown={(e) => handleAreaKeyDown(e, area.id)}
                className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 ${
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {area.label}
              </button>
            );
          })}
        </div>

        {/* Sub-nav row — expands below when area is active */}
        {activeArea !== null && AREA_TABS[activeArea].length > 1 && (
          <div
            role="tablist"
            aria-label={`${AREAS.find((a) => a.id === activeArea)?.label} sub-navigation`}
            className="flex overflow-x-auto bg-surface-alt border-b border-edge"
          >
            {AREA_TABS[activeArea].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => handleSubTabClick(tab.id)}
                className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
});
