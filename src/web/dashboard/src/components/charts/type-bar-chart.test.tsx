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
import { TypeBarChart } from "./type-bar-chart.js";
import type { NodeType } from "@/lib/types";

describe("<TypeBarChart>", () => {
  it("should show empty state when data is empty", () => {
    render(<TypeBarChart data={[]} />);
    expect(screen.getByText("No node types")).toBeInTheDocument();
  });

  it("should show empty state when all counts are zero", () => {
    render(
      <TypeBarChart
        data={[
          { type: "task" as NodeType, count: 0 },
          { type: "epic" as NodeType, count: 0 },
        ]}
      />,
    );
    expect(screen.getByText("No node types")).toBeInTheDocument();
  });

  it("should render the chart container when at least one type has count > 0", () => {
    const { container } = render(
      <TypeBarChart data={[{ type: "task" as NodeType, count: 5 }]} />,
    );
    const chart = container.querySelector(".recharts-responsive-container");
    expect(chart).not.toBeNull();
    expect(screen.queryByText("No node types")).not.toBeInTheDocument();
  });

  it("should forward className in both empty and populated states", () => {
    const { container: emptyC } = render(
      <TypeBarChart data={[]} className="empty-cls" />,
    );
    expect(emptyC.firstChild).toHaveClass("empty-cls");

    const { container: fullC } = render(
      <TypeBarChart
        data={[{ type: "task" as NodeType, count: 3 }]}
        className="full-cls"
      />,
    );
    expect(fullC.firstChild).toHaveClass("full-cls");
  });
});
