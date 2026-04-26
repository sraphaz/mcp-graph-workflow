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
import { DreamHistory } from "./dream-history.js";
import type { DreamCycleResult } from "@/lib/types";

function makeCycle(overrides: Partial<DreamCycleResult> = {}): DreamCycleResult {
  return {
    id: "cycle-1",
    startedAt: "2026-04-01T10:00:00Z",
    status: "completed",
    phases: {
      nrem: { durationMs: 1000 },
      rem: { durationMs: 2000 },
      wakeReady: { durationMs: 500 },
    },
    summary: {
      totalPruned: 0,
      totalMerged: 0,
    },
    ...overrides,
  } as DreamCycleResult;
}

describe("<DreamHistory>", () => {
  it("should render empty state when no cycles", () => {
    render(<DreamHistory cycles={[]} />);
    expect(screen.getByText("No dream cycles yet")).toBeInTheDocument();
  });

  it("should render a table row per cycle with columns Date/Status/Pruned/Merged/Duration", () => {
    render(
      <DreamHistory
        cycles={[
          makeCycle({ id: "c1", summary: { totalPruned: 12, totalMerged: 3 } as DreamCycleResult["summary"] }),
        ]}
      />,
    );

    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Pruned")).toBeInTheDocument();
    expect(screen.getByText("Merged")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();

    expect(screen.getByText("12")).toBeInTheDocument(); // pruned
    expect(screen.getByText("3")).toBeInTheDocument(); // merged
  });

  it("should sum the 3 phase durations and format total in seconds (>=1s)", () => {
    render(
      <DreamHistory
        cycles={[
          makeCycle({
            id: "c1",
            phases: {
              nrem: { durationMs: 1500 },
              rem: { durationMs: 1500 },
              wakeReady: { durationMs: 500 },
            } as DreamCycleResult["phases"],
          }),
        ]}
      />,
    );

    // Total = 3500ms = 3.5s
    expect(screen.getByText("3.5s")).toBeInTheDocument();
  });

  it("should format sub-second total durations in ms", () => {
    render(
      <DreamHistory
        cycles={[
          makeCycle({
            id: "c1",
            phases: {
              nrem: { durationMs: 100 },
              rem: { durationMs: 200 },
              wakeReady: { durationMs: 150 },
            } as DreamCycleResult["phases"],
          }),
        ]}
      />,
    );

    expect(screen.getByText("450ms")).toBeInTheDocument();
  });

  it("should colour-code statuses (completed → green, failed → red)", () => {
    const { container } = render(
      <DreamHistory
        cycles={[
          makeCycle({ id: "c1", status: "completed" }),
          makeCycle({ id: "c2", status: "failed" }),
        ]}
      />,
    );

    const completedCell = Array.from(container.querySelectorAll("td")).find((el) =>
      el.textContent?.trim() === "completed",
    );
    const failedCell = Array.from(container.querySelectorAll("td")).find((el) =>
      el.textContent?.trim() === "failed",
    );

    expect(completedCell?.className).toContain("text-green-500");
    expect(failedCell?.className).toContain("text-red-500");
  });

  it("should fall back to muted text for unknown status", () => {
    const { container } = render(
      <DreamHistory
        cycles={[makeCycle({ id: "c1", status: "ghost" as DreamCycleResult["status"] })]}
      />,
    );

    const cell = Array.from(container.querySelectorAll("td")).find((el) =>
      el.textContent?.trim() === "ghost",
    );
    expect(cell?.className).toContain("text-muted");
  });
});
