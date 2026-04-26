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
import { BetaBadge } from "./beta-badge.js";

describe("<BetaBadge>", () => {
  it("should render the 'Beta' text content", () => {
    render(<BetaBadge />);

    // Tolerate the leading bolt char and flexible whitespace inside the span.
    expect(screen.getByText(/Beta/i)).toBeInTheDocument();
  });

  it("should render as an inline span", () => {
    render(<BetaBadge />);

    // The component is a `<span>` — confirm it stays inline (no `<div>` swap)
    // because that affects layout in nav contexts.
    const node = screen.getByText(/Beta/i);
    expect(node.tagName).toBe("SPAN");
  });

  it("should apply the red bolt visual cue via class names", () => {
    render(<BetaBadge />);

    const node = screen.getByText(/Beta/i);
    // Tailwind class invariants — these are the visual contract.
    expect(node.className).toContain("bg-red-500/15");
    expect(node.className).toContain("text-red-500");
    expect(node.className).toContain("rounded-full");
  });
});
