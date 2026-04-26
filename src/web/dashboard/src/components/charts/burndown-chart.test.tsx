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
import { BurndownChart } from "./burndown-chart.js";
import type { FlowSnapshot } from "@/lib/types";

describe("<BurndownChart>", () => {
  it("should show empty state for empty data", () => {
    render(<BurndownChart data={[]} />);
    expect(screen.getByText("No burndown data available")).toBeInTheDocument();
  });

  it("should render the chart container with non-empty snapshots", () => {
    const data: FlowSnapshot[] = [
      {
        snapshotDate: "2026-04-01",
        backlogCount: 10,
        readyCount: 0,
        inProgressCount: 0,
        blockedCount: 0,
        doneCount: 0,
      },
      {
        snapshotDate: "2026-04-02",
        backlogCount: 9,
        readyCount: 0,
        inProgressCount: 1,
        blockedCount: 0,
        doneCount: 1,
      },
    ];

    const { container } = render(<BurndownChart data={data} />);

    const chart = container.querySelector(".recharts-responsive-container");
    expect(chart).not.toBeNull();
    expect(screen.queryByText("No burndown data available")).not.toBeInTheDocument();
  });

  it("should forward className in empty state", () => {
    const { container } = render(<BurndownChart data={[]} className="bd-cls" />);
    expect(container.firstChild).toHaveClass("bd-cls");
    expect(container.firstChild).toHaveClass("h-[220px]");
  });
});
