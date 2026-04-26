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
import { render } from "@testing-library/react";
import { ChartSkeleton } from "./chart-skeleton.js";

describe("<ChartSkeleton>", () => {
  it("should render a gauge skeleton with rounded top arc", () => {
    const { container } = render(<ChartSkeleton type="gauge" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("animate-pulse");
    expect(wrapper.className).toContain("h-[180px]");
    // Inner shape is a rounded-top arc.
    const inner = wrapper.querySelector(".rounded-t-full");
    expect(inner).not.toBeNull();
  });

  it("should render a donut skeleton with full rounded border", () => {
    const { container } = render(<ChartSkeleton type="donut" />);

    const ring = container.querySelector(".rounded-full.border-8");
    expect(ring).not.toBeNull();
  });

  it("should render exactly 6 bars for type=bar", () => {
    const { container } = render(<ChartSkeleton type="bar" />);

    const bars = container.querySelectorAll(".rounded-t.bg-surface");
    expect(bars).toHaveLength(6);
  });

  it("should render 4 cards for type=cards", () => {
    const { container } = render(<ChartSkeleton type="cards" />);

    const cards = container.querySelectorAll(".rounded-xl.bg-surface");
    expect(cards).toHaveLength(4);
  });

  it("should treat 'line' and 'area' identically (single horizontal bar)", () => {
    const { container: lineContainer } = render(<ChartSkeleton type="line" />);
    const { container: areaContainer } = render(<ChartSkeleton type="area" />);

    // Both render a single .rounded.bg-surface inside a 220px wrapper.
    expect(lineContainer.querySelectorAll(".bg-surface")).toHaveLength(1);
    expect(areaContainer.querySelectorAll(".bg-surface")).toHaveLength(1);
    expect(lineContainer.firstChild).toHaveClass("h-[220px]");
    expect(areaContainer.firstChild).toHaveClass("h-[220px]");
  });

  it("should forward className prop in addition to base animate-pulse class", () => {
    const { container } = render(
      <ChartSkeleton type="gauge" className="my-custom-class" />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("my-custom-class");
    expect(wrapper.className).toContain("animate-pulse");
  });

  it("should fall through to default placeholder for unknown variants", () => {
    // Cast to unknown then back so we can intentionally pass an unrecognized
    // value — the runtime guards against this with a default branch.
    const { container } = render(
      <ChartSkeleton type={"radar" as unknown as "bar"} />,
    );

    const wrapper = container.firstChild as HTMLElement;
    // Default branch: a 220px-tall rounded surface placeholder.
    expect(wrapper.className).toContain("h-[220px]");
    expect(wrapper.className).toContain("bg-surface");
  });
});
