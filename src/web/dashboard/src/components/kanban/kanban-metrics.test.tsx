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
import { KanbanMetrics } from "./kanban-metrics.js";
import type { KanbanMetrics as KanbanMetricsType } from "@/lib/types";

function makeMetrics(overrides: Partial<KanbanMetricsType> = {}): KanbanMetricsType {
  return {
    throughput: 0,
    avgCycleTime: 0,
    avgLeadTime: 0,
    blockedPercentage: 0,
    wipViolations: [],
    ...overrides,
  };
}

describe("<KanbanMetrics>", () => {
  it("should render throughput in 'N done' format", () => {
    render(<KanbanMetrics metrics={makeMetrics({ throughput: 7 })} />);

    expect(screen.getByText("7 done")).toBeInTheDocument();
  });

  it("should display em-dash placeholder for avgCycleTime when zero (no data)", () => {
    render(<KanbanMetrics metrics={makeMetrics({ avgCycleTime: 0 })} />);

    // Both Avg Cycle and Avg Lead default to 0 in the fixture, so two dashes.
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("should format avgCycleTime in hours when > 0", () => {
    render(<KanbanMetrics metrics={makeMetrics({ avgCycleTime: 12 })} />);

    expect(screen.getByText("12h")).toBeInTheDocument();
  });

  it("should format blockedPercentage with % suffix", () => {
    render(<KanbanMetrics metrics={makeMetrics({ blockedPercentage: 15 })} />);

    expect(screen.getByText("15%")).toBeInTheDocument();
  });

  it("should warn-style (red) the blocked metric when above 20% threshold", () => {
    const { container } = render(
      <KanbanMetrics metrics={makeMetrics({ blockedPercentage: 35 })} />,
    );

    // Find the value element (not the label) and confirm it has the warn class.
    const valueEl = container.querySelector(".text-red-400");
    expect(valueEl).not.toBeNull();
    expect(valueEl?.textContent).toBe("35%");
  });

  it("should NOT warn-style the blocked metric at exactly 20% (strict >)", () => {
    const { container } = render(
      <KanbanMetrics metrics={makeMetrics({ blockedPercentage: 20 })} />,
    );

    // 20% is the boundary; the > 20 check should NOT trigger red.
    const redElements = container.querySelectorAll(".text-red-400");
    // There should be no red element for the metric. (WIP violations could
    // also be red but we have no violations here.)
    expect(redElements).toHaveLength(0);
  });

  it("should pluralize WIP violations correctly (1 violation)", () => {
    render(
      <KanbanMetrics
        metrics={makeMetrics({ wipViolations: [{ column: "in_progress", limit: 3, actual: 4 }] as KanbanMetricsType["wipViolations"] })}
      />,
    );

    expect(screen.getByText("1 WIP violation")).toBeInTheDocument();
  });

  it("should pluralize WIP violations correctly (multiple → 's')", () => {
    render(
      <KanbanMetrics
        metrics={makeMetrics({
          wipViolations: [
            { column: "in_progress", limit: 3, actual: 4 },
            { column: "review", limit: 2, actual: 5 },
          ] as KanbanMetricsType["wipViolations"],
        })}
      />,
    );

    expect(screen.getByText("2 WIP violations")).toBeInTheDocument();
  });

  it("should NOT render the WIP violation row when there are no violations", () => {
    render(<KanbanMetrics metrics={makeMetrics({ wipViolations: [] })} />);

    expect(screen.queryByText(/WIP violation/i)).not.toBeInTheDocument();
  });
});
