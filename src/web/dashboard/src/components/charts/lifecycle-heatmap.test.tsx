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

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LifecycleHeatmap } from "./lifecycle-heatmap.js";
import type { PhaseDistributionEntry } from "@/hooks/use-insights";

function makeEntry(overrides: Partial<PhaseDistributionEntry> = {}): PhaseDistributionEntry {
  return {
    phase: "IMPLEMENT",
    taskCount: 0,
    percentage: 0,
    color: "#3b82f6",
    ...overrides,
  } as PhaseDistributionEntry;
}

describe("<LifecycleHeatmap>", () => {
  it("should render empty state when data is empty", () => {
    render(<LifecycleHeatmap data={[]} />);

    expect(screen.getByText("No phase data")).toBeInTheDocument();
  });

  it("should render a card per phase entry with the short label", () => {
    render(
      <LifecycleHeatmap
        data={[
          makeEntry({ phase: "ANALYZE", taskCount: 2, percentage: 20 }),
          makeEntry({ phase: "IMPLEMENT", taskCount: 5, percentage: 50 }),
          makeEntry({ phase: "DEPLOY", taskCount: 3, percentage: 30 }),
        ]}
      />,
    );

    expect(screen.getByText("ANL")).toBeInTheDocument();
    expect(screen.getByText("IMP")).toBeInTheDocument();
    expect(screen.getByText("DPL")).toBeInTheDocument();
  });

  it("should fall back to the full phase name when no short label is mapped", () => {
    render(
      <LifecycleHeatmap
        data={[makeEntry({ phase: "UNKNOWN_PHASE", taskCount: 1, percentage: 100 })]}
      />,
    );

    expect(screen.getByText("UNKNOWN_PHASE")).toBeInTheDocument();
  });

  it("should display each entry's task count and percentage", () => {
    render(
      <LifecycleHeatmap
        data={[makeEntry({ phase: "REVIEW", taskCount: 7, percentage: 35 })]}
      />,
    );

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
  });

  it("should apply background opacity proportional to taskCount/maxCount", () => {
    const { container } = render(
      <LifecycleHeatmap
        data={[
          makeEntry({ phase: "ANALYZE", taskCount: 1, percentage: 10, color: "#ff0000" }),
          makeEntry({ phase: "IMPLEMENT", taskCount: 9, percentage: 90, color: "#00ff00" }),
        ]}
      />,
    );

    const cards = container.querySelectorAll(".rounded-lg.p-3");
    expect(cards).toHaveLength(2);

    // ANALYZE: 0.2 + (1/9)*0.8 ≈ 0.289 → rgba(...,0.289) preserved
    // IMPLEMENT: 0.2 + (9/9)*0.8 = 1.0 → jsdom collapses to rgb(...) (no alpha)
    const analyzeBg = (cards[0] as HTMLElement).style.backgroundColor;
    const implementBg = (cards[1] as HTMLElement).style.backgroundColor;

    // Lower-count card keeps the rgba() form because alpha != 1.
    expect(analyzeBg).toMatch(/rgba\(/);
    // Higher-count card (alpha=1) gets normalised to rgb() by jsdom.
    expect(implementBg).toMatch(/^rgb\(/);

    // Extract alpha (treating rgb() as alpha=1).
    const alphaOf = (s: string): number => {
      const rgba = s.match(/rgba\([^)]+,\s*([\d.]+)\)/);
      if (rgba) return Number(rgba[1]);
      return s.startsWith("rgb(") ? 1 : 0;
    };
    expect(alphaOf(implementBg)).toBeGreaterThan(alphaOf(analyzeBg));
  });

  it("should treat zero-count entries with minimal opacity (0.1)", () => {
    const { container } = render(
      <LifecycleHeatmap
        data={[makeEntry({ phase: "PLAN", taskCount: 0, percentage: 0, color: "#abcdef" })]}
      />,
    );

    const card = container.querySelector(".rounded-lg.p-3") as HTMLElement;
    const alpha = Number(card.style.backgroundColor.match(/rgba\([^)]+,\s*([\d.]+)\)/)?.[1] ?? 0);
    expect(alpha).toBeCloseTo(0.1, 1);
  });
});
