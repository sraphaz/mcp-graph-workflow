/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-dashboard-ux — Task 2.1: <TopNav> com 3 áreas.
 *
 * AC3: role="navigation" + roles tab corretos
 * AC1: área clicada → sub-nav aparece + URL muda para /area/<name>
 * AC2: deep link /area/work/browser-tests → navega direto
 * AC4: keyboard nav tab → enter funciona
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopNav } from "./top-nav";
import type { TabId } from "./nav-config";

describe("<TopNav>", () => {
  let onTabChange: (tab: TabId) => void;

  beforeEach(() => {
    onTabChange = vi.fn() as unknown as (tab: TabId) => void;
    // Reset URL hash before each test
    window.location.hash = "";
  });

  afterEach(() => {
    window.location.hash = "";
  });

  // AC3 — role="navigation" + role="tab" on area buttons
  it("renders a nav element with role=navigation", () => {
    render(<TopNav activeTab="overview" onTabChange={onTabChange} />);
    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
  });

  it("renders 3 area buttons with role=tab", () => {
    render(<TopNav activeTab="overview" onTabChange={onTabChange} />);
    const tabs = screen.getAllByRole("tab");
    const areaLabels = tabs.map((t) => t.textContent?.trim()).filter(Boolean);
    expect(areaLabels).toContain("Overview");
    expect(areaLabels).toContain("Work");
    expect(areaLabels).toContain("Insights");
  });

  // AC1 — clicking area expands sub-nav
  it("clicking an area expands its sub-nav items", async () => {
    const user = userEvent.setup();
    render(<TopNav activeTab="graph" onTabChange={onTabChange} />);

    const workTab = screen.getByRole("tab", { name: /^work$/i });
    await user.click(workTab);

    // Sub-nav should appear with tabs from Work area
    expect(screen.getByRole("tablist", { name: /work sub-navigation/i })).toBeInTheDocument();
  });

  // AC1 — URL updates to /area/<name> when area clicked
  it("updates location hash when area is clicked", async () => {
    const user = userEvent.setup();
    render(<TopNav activeTab="overview" onTabChange={onTabChange} />);

    const insightsTab = screen.getByRole("tab", { name: /^insights$/i });
    await user.click(insightsTab);

    expect(window.location.hash).toContain("area=insights");
  });

  // AC1 — clicking sub-nav tab calls onTabChange
  it("clicking a sub-nav tab calls onTabChange with correct TabId", async () => {
    const user = userEvent.setup();
    render(<TopNav activeTab="graph" onTabChange={onTabChange} />);

    // Click Work area to expand
    await user.click(screen.getByRole("tab", { name: /^work$/i }));
    // Click a sub-tab (kanban)
    const kanbanBtn = screen.getByRole("tab", { name: /kanban/i });
    await user.click(kanbanBtn);

    expect(onTabChange).toHaveBeenCalledWith("kanban");
  });

  // AC2 — deep link: hash #?area=work&tab=browser-tests navigates correctly
  it("initialises to the area+tab specified in the URL hash", () => {
    window.location.hash = "#?area=work&tab=browser-pilot";
    render(<TopNav activeTab="browser-pilot" onTabChange={onTabChange} />);

    // Work area should be active (sub-nav visible)
    expect(screen.getByRole("tablist", { name: /work sub-navigation/i })).toBeInTheDocument();
  });

  // AC4 — keyboard: Enter on an area tab triggers click
  it("pressing Enter on an area tab activates it", () => {
    render(<TopNav activeTab="overview" onTabChange={onTabChange} />);

    const workTab = screen.getByRole("tab", { name: /^work$/i });
    workTab.focus();
    fireEvent.keyDown(workTab, { key: "Enter", code: "Enter" });

    expect(screen.queryByRole("tablist", { name: /work sub-navigation/i })).toBeInTheDocument();
  });

  // AC3 — area tabs have correct aria-selected
  it("active area tab has aria-selected=true", () => {
    render(<TopNav activeTab="overview" onTabChange={onTabChange} />);
    // Overview has only 1 tab, so clicking it activates that area without sub-tab conflict
    const overviewAreaBtn = screen.getByRole("tab", { name: /^overview$/i });
    expect(overviewAreaBtn).toHaveAttribute("aria-selected", "true");
  });
});
