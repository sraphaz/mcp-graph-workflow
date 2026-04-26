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
import { KnowledgeBar } from "./knowledge-bar.js";

describe("<KnowledgeBar>", () => {
  it("should show empty state when given an empty record", () => {
    render(<KnowledgeBar data={{}} />);
    expect(screen.getByText("No knowledge data")).toBeInTheDocument();
  });

  it("should show empty state when all source counts are zero", () => {
    render(<KnowledgeBar data={{ memory: 0, docs: 0, upload: 0 }} />);
    expect(screen.getByText("No knowledge data")).toBeInTheDocument();
  });

  it("should render the chart container when at least one source has count > 0", () => {
    const { container } = render(<KnowledgeBar data={{ memory: 7 }} />);
    const chart = container.querySelector(".recharts-responsive-container");
    expect(chart).not.toBeNull();
    expect(screen.queryByText("No knowledge data")).not.toBeInTheDocument();
  });

  it("should forward className in empty state", () => {
    const { container } = render(<KnowledgeBar data={{}} className="cls-x" />);
    expect(container.firstChild).toHaveClass("cls-x");
  });

  it("should forward className when chart is rendered", () => {
    const { container } = render(
      <KnowledgeBar data={{ docs: 4 }} className="cls-y" />,
    );
    expect(container.firstChild).toHaveClass("cls-y");
  });
});
