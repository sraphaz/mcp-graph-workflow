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
import { DreamMetricsCards } from "./dream-metrics.js";
import type { DreamMetrics as DreamMetricsType } from "@/lib/types";

function makeMetrics(overrides: Partial<DreamMetricsType> = {}): DreamMetricsType {
  return {
    totalCycles: 0,
    totalPruned: 0,
    totalMerged: 0,
    avgQualityImprovement: 0,
    ...overrides,
  } as DreamMetricsType;
}

describe("<DreamMetricsCards>", () => {
  it("should render nothing when metrics is null", () => {
    const { container } = render(<DreamMetricsCards metrics={null} />);

    expect(container.firstChild).toBeNull();
  });

  it("should render exactly 4 metric cards", () => {
    const { container } = render(
      <DreamMetricsCards metrics={makeMetrics()} />,
    );

    const cards = container.querySelectorAll(".rounded-xl.border");
    expect(cards).toHaveLength(4);
  });

  it("should display totalCycles as a plain integer", () => {
    render(
      <DreamMetricsCards metrics={makeMetrics({ totalCycles: 42 })} />,
    );

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Total Cycles")).toBeInTheDocument();
  });

  it("should locale-format totalPruned with thousand separators", () => {
    render(
      <DreamMetricsCards metrics={makeMetrics({ totalPruned: 12345 })} />,
    );

    // toLocaleString output depends on system locale. The number should
    // contain the digits and at least one separator (comma, dot, or space).
    const node = screen.getByText(/12.?345/);
    expect(node).toBeInTheDocument();
  });

  it("should format avgQualityImprovement as percentage with sign", () => {
    render(
      <DreamMetricsCards
        metrics={makeMetrics({ avgQualityImprovement: 0.123 })}
      />,
    );

    expect(screen.getByText("+12.3%")).toBeInTheDocument();
  });

  it("should drop the leading '+' when avgQualityImprovement is negative", () => {
    render(
      <DreamMetricsCards
        metrics={makeMetrics({ avgQualityImprovement: -0.05 })}
      />,
    );

    // -0.05 → -5.0% (no extra +)
    expect(screen.getByText("-5.0%")).toBeInTheDocument();
  });
});
