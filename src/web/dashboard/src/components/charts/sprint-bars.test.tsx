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
import { SprintBars } from "./sprint-bars.js";

describe("<SprintBars>", () => {
  it("should render the empty-state message when given an empty data array", () => {
    render(<SprintBars data={[]} />);

    expect(screen.getByText("No sprint data")).toBeInTheDocument();
  });

  it("should NOT render the empty-state when at least one sprint is present", () => {
    render(
      <SprintBars
        data={[{ sprint: "S1", done: 5, total: 10, percentage: 50 }]}
      />,
    );

    expect(screen.queryByText("No sprint data")).not.toBeInTheDocument();
  });

  it("should render the chart wrapper (recharts ResponsiveContainer)", () => {
    const { container } = render(
      <SprintBars
        data={[
          { sprint: "S1", done: 3, total: 10, percentage: 30 },
          { sprint: "S2", done: 7, total: 10, percentage: 70 },
        ]}
      />,
    );

    // ResponsiveContainer renders a div with class containing "responsive".
    const chartHost = container.querySelector(".recharts-responsive-container");
    expect(chartHost).not.toBeNull();
  });

  it("should forward className to the empty-state wrapper", () => {
    const { container } = render(
      <SprintBars data={[]} className="custom-empty" />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("custom-empty");
    expect(wrapper).toHaveClass("text-muted");
  });

  it("should forward className to the chart wrapper when there is data", () => {
    const { container } = render(
      <SprintBars
        data={[{ sprint: "S1", done: 3, total: 10, percentage: 30 }]}
        className="custom-chart"
      />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("custom-chart");
  });
});
