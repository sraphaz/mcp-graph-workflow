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
import { DreamPhaseViz } from "./dream-phase-viz.js";
import type { DreamStatus } from "@/lib/types";

describe("<DreamPhaseViz>", () => {
  it("should render all 3 phases (NREM/REM/Wake) with subtitles", () => {
    render(
      <DreamPhaseViz status={{ running: false, currentPhase: undefined } as DreamStatus} />,
    );

    expect(screen.getByText("NREM")).toBeInTheDocument();
    expect(screen.getByText("REM")).toBeInTheDocument();
    expect(screen.getByText("Wake")).toBeInTheDocument();

    expect(screen.getByText("Replay + Decay + Prune")).toBeInTheDocument();
    expect(screen.getByText("Priority + Merge + Associate")).toBeInTheDocument();
    expect(screen.getByText("Report + Synthesize")).toBeInTheDocument();
  });

  it("should mark all phases pending when not running", () => {
    const { container } = render(
      <DreamPhaseViz status={{ running: false } as DreamStatus} />,
    );

    // Pending phases: backgroundColor=transparent, border uses pending color (#6b7280)
    const circles = container.querySelectorAll(".w-8.h-8.rounded-full");
    expect(circles).toHaveLength(3);
    for (const c of Array.from(circles) as HTMLElement[]) {
      // Pending always renders backgroundColor as transparent
      expect(c.style.backgroundColor).toBe("transparent");
    }
  });

  it("should mark earlier phases completed and current phase active when running", () => {
    const { container } = render(
      <DreamPhaseViz
        status={{ running: true, currentPhase: "rem" } as DreamStatus}
      />,
    );

    const circles = Array.from(
      container.querySelectorAll(".w-8.h-8.rounded-full"),
    ) as HTMLElement[];

    // NREM (index 0) should be completed → backgroundColor !== transparent
    expect(circles[0].style.backgroundColor).not.toBe("transparent");
    // REM (index 1) should be active → also has fill
    expect(circles[1].style.backgroundColor).not.toBe("transparent");
    // wake-ready (index 2) is pending → transparent
    expect(circles[2].style.backgroundColor).toBe("transparent");
  });

  it("should number circles 1, 2, 3 in order", () => {
    const { container } = render(
      <DreamPhaseViz status={{ running: false } as DreamStatus} />,
    );

    const circles = container.querySelectorAll(".w-8.h-8.rounded-full");
    expect(circles[0].textContent).toBe("1");
    expect(circles[1].textContent).toBe("2");
    expect(circles[2].textContent).toBe("3");
  });
});
