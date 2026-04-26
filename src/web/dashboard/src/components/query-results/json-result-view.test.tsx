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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JsonResultView } from "./json-result-view.js";

describe("<JsonResultView>", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("should render the data as pretty-printed JSON (2-space indent)", () => {
    render(<JsonResultView data={{ name: "test", count: 42 }} />);

    const pre = screen.getByText(/"name": "test"/);
    expect(pre).toBeInTheDocument();
    // 2-space indent invariant: "  " before keys, not "\t" or "    ".
    expect(pre.textContent).toMatch(/^\{\n  "name": "test",\n  "count": 42\n\}$/);
  });

  it("should expose a Copy button by default (not 'Copied!')", () => {
    render(<JsonResultView data={{ a: 1 }} />);

    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.queryByText("Copied!")).not.toBeInTheDocument();
  });

  it("should hide the JSON pre when toggled to collapsed", async () => {
    const user = userEvent.setup();
    render(<JsonResultView data={{ a: 1 }} />);

    expect(screen.getByText(/"a": 1/)).toBeInTheDocument();

    await user.click(screen.getByText(/JSON/));

    expect(screen.queryByText(/"a": 1/)).not.toBeInTheDocument();
  });

  it("should switch the toggle label between '▾ JSON' (open) and '▸ Show JSON' (collapsed)", async () => {
    const user = userEvent.setup();
    render(<JsonResultView data={{ a: 1 }} />);

    expect(screen.getByText(/▾ JSON/)).toBeInTheDocument();

    await user.click(screen.getByText(/▾ JSON/));

    expect(screen.getByText(/▸ Show JSON/)).toBeInTheDocument();
  });

  it("should briefly show 'Copied!' after a successful clipboard write", async () => {
    // navigator.clipboard is a getter in jsdom — use defineProperty.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    const user = userEvent.setup();
    render(<JsonResultView data={{ a: 1 }} />);

    await user.click(screen.getByText("Copy"));

    // findByText waits for the post-click "Copied!" transition. This single
    // assertion verifies the full happy path: click → writeText awaited
    // successfully → setCopied(true) → button re-renders with "Copied!".
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("should handle null/undefined data without crashing", () => {
    expect(() => render(<JsonResultView data={null} />)).not.toThrow();
    expect(() => render(<JsonResultView data={undefined} />)).not.toThrow();
  });
});
