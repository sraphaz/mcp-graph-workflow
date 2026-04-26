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
import { CfdChart } from "./cfd-chart.js";
import type { FlowSnapshot } from "@/lib/types";

describe("<CfdChart>", () => {
  it("should render empty state with daily-snapshot hint when no data", () => {
    render(<CfdChart data={[]} />);
    expect(screen.getByText(/No flow data yet/i)).toBeInTheDocument();
    expect(screen.getByText(/snapshots are captured daily/i)).toBeInTheDocument();
  });

  it("should render the chart container with snapshot data", () => {
    const data: FlowSnapshot[] = [
      {
        snapshotDate: "2026-04-01",
        backlogCount: 5,
        readyCount: 1,
        inProgressCount: 2,
        blockedCount: 0,
        doneCount: 1,
      },
      {
        snapshotDate: "2026-04-02",
        backlogCount: 4,
        readyCount: 1,
        inProgressCount: 2,
        blockedCount: 1,
        doneCount: 2,
      },
    ];

    const { container } = render(<CfdChart data={data} />);
    expect(container.querySelector(".recharts-responsive-container")).not.toBeNull();
    expect(screen.queryByText(/No flow data yet/i)).not.toBeInTheDocument();
  });

  it("should forward className in empty state with h-[220px] anchor", () => {
    const { container } = render(<CfdChart data={[]} className="custom-cfd" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("custom-cfd");
    expect(wrapper).toHaveClass("h-[220px]");
  });
});
