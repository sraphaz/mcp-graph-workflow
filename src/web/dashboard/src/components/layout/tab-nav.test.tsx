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

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabNav } from "./tab-nav.js";

describe("<TabNav>", () => {
  it("should render all 11 dashboard tabs", () => {
    render(<TabNav activeTab="graph" onTabChange={() => {}} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(11);
  });

  it("should mark only the active tab with aria-selected=true", () => {
    render(<TabNav activeTab="memories" onTabChange={() => {}} />);

    const memoriesTab = screen.getByRole("tab", { name: "Memories" });
    expect(memoriesTab).toHaveAttribute("aria-selected", "true");

    const graphTab = screen.getByRole("tab", { name: "Graph" });
    expect(graphTab).toHaveAttribute("aria-selected", "false");
  });

  it("should set tabIndex=0 on active tab and -1 on inactive (arrow-key navigation contract)", () => {
    render(<TabNav activeTab="logs" onTabChange={() => {}} />);

    const logsTab = screen.getByRole("tab", { name: "Logs" });
    expect(logsTab).toHaveAttribute("tabindex", "0");

    const graphTab = screen.getByRole("tab", { name: "Graph" });
    expect(graphTab).toHaveAttribute("tabindex", "-1");
  });

  it("should call onTabChange with the correct TabId when a tab is clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<TabNav activeTab="graph" onTabChange={onTabChange} />);

    await user.click(screen.getByRole("tab", { name: "Insights" }));

    expect(onTabChange).toHaveBeenCalledOnce();
    expect(onTabChange).toHaveBeenCalledWith("insights");
  });

  it("should render the BetaBadge next to beta tabs (Journey, Siebel)", () => {
    render(<TabNav activeTab="graph" onTabChange={() => {}} />);

    // Beta tabs have label + BetaBadge inside the same button.
    const journey = screen.getByRole("tab", { name: /Journey/i });
    expect(journey.textContent).toMatch(/Beta/i);

    const siebel = screen.getByRole("tab", { name: /Siebel/i });
    expect(siebel.textContent).toMatch(/Beta/i);

    // Non-beta tab should NOT contain "Beta" text.
    const graph = screen.getByRole("tab", { name: "Graph" });
    expect(graph.textContent).not.toMatch(/Beta/i);
  });

  it("should expose the right aria-controls panel id for each tab (a11y contract)", () => {
    render(<TabNav activeTab="graph" onTabChange={() => {}} />);

    const graphTab = screen.getByRole("tab", { name: "Graph" });
    expect(graphTab).toHaveAttribute("aria-controls", "panel-graph");
    expect(graphTab).toHaveAttribute("id", "tab-graph");
  });

  it("should set the parent tablist with aria-label for screen readers", () => {
    render(<TabNav activeTab="graph" onTabChange={() => {}} />);

    const tablist = screen.getByRole("tablist");
    expect(tablist).toHaveAttribute("aria-label", "Dashboard sections");
  });
});
