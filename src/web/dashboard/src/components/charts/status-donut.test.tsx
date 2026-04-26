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
import { StatusDonut } from "./status-donut.js";
import type { NodeStatus } from "@/lib/types";

describe("<StatusDonut>", () => {
  it("should render empty state when no status entries", () => {
    render(<StatusDonut data={[]} />);
    expect(screen.getByText("No status data")).toBeInTheDocument();
  });

  it("should render empty state when all counts are zero", () => {
    render(
      <StatusDonut
        data={[
          { status: "backlog" as NodeStatus, count: 0, percentage: 0 },
          { status: "done" as NodeStatus, count: 0, percentage: 0 },
        ]}
      />,
    );
    expect(screen.getByText("No status data")).toBeInTheDocument();
  });

  it("should render the chart container when data is present", () => {
    const { container } = render(
      <StatusDonut
        data={[
          { status: "in_progress" as NodeStatus, count: 5, percentage: 50 },
          { status: "done" as NodeStatus, count: 5, percentage: 50 },
        ]}
      />,
    );

    expect(container.querySelector(".recharts-responsive-container")).not.toBeNull();
    expect(screen.queryByText("No status data")).not.toBeInTheDocument();
  });

  it("should forward className to wrapper", () => {
    const { container } = render(
      <StatusDonut data={[]} className="cls-x" />,
    );

    expect(container.firstChild).toHaveClass("cls-x");
  });
});
