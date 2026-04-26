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
import { HealthGauge } from "./health-gauge.js";

describe("<HealthGauge>", () => {
  it("should display the numeric score in the center label", () => {
    render(<HealthGauge score={85} />);

    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText(/Health Score/i)).toBeInTheDocument();
  });

  it("should colour the score green (#22c55e) when score > 70", () => {
    render(<HealthGauge score={85} />);

    const scoreEl = screen.getByText("85");
    expect(scoreEl.style.color).toMatch(/#22c55e|rgb\(34,\s*197,\s*94\)/);
  });

  it("should colour the score yellow (#f59e0b) when 40 < score <= 70", () => {
    render(<HealthGauge score={55} />);

    const scoreEl = screen.getByText("55");
    expect(scoreEl.style.color).toMatch(/#f59e0b|rgb\(245,\s*158,\s*11\)/);
  });

  it("should colour the score red (#ef4444) when score <= 40", () => {
    render(<HealthGauge score={20} />);

    const scoreEl = screen.getByText("20");
    expect(scoreEl.style.color).toMatch(/#ef4444|rgb\(239,\s*68,\s*68\)/);
  });

  it("should treat the boundary score=40 as red (≤40 is red, not yellow)", () => {
    render(<HealthGauge score={40} />);

    const scoreEl = screen.getByText("40");
    expect(scoreEl.style.color).toMatch(/#ef4444|rgb\(239,\s*68,\s*68\)/);
  });

  it("should treat the boundary score=70 as yellow (≤70 is yellow, not green)", () => {
    render(<HealthGauge score={70} />);

    const scoreEl = screen.getByText("70");
    expect(scoreEl.style.color).toMatch(/#f59e0b|rgb\(245,\s*158,\s*11\)/);
  });

  it("should accept and forward a className prop to the wrapper", () => {
    const { container } = render(
      <HealthGauge score={50} className="custom-gauge" />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("custom-gauge");
  });
});
