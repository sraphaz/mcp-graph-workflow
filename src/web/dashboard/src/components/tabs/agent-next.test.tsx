/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * §node_635334a74e22 — Task 2.4: <AgentNext> — planned next actions list
 *
 * AC1: GIVEN 5 next steps WHEN render THEN aparecem em ordem
 * AC2: GIVEN sem next WHEN render THEN mostra "No planned actions"
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentNext } from "./agent-next.js";

interface Step { id: string; title: string; priority?: number; xpSize?: string }

function makeSteps(count: number): Step[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `node_step_${i}`,
    title: `Step ${i + 1}: some task`,
    priority: i + 1,
    xpSize: "S",
  }));
}

// ── AC1: renders steps in order ───────────────────────────────────────────────

describe("AC1: renders steps in order", () => {
  it("renders all 5 steps", () => {
    render(<AgentNext steps={makeSteps(5)} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(`Step ${i}: some task`)).toBeInTheDocument();
    }
  });

  it("renders steps in the order provided", () => {
    const steps: Step[] = [
      { id: "a", title: "First task" },
      { id: "b", title: "Second task" },
      { id: "c", title: "Third task" },
    ];
    render(<AgentNext steps={steps} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("First task");
    expect(items[1]).toHaveTextContent("Second task");
    expect(items[2]).toHaveTextContent("Third task");
  });

  it("calls onStepClick with the step id when clicked", async () => {
    const onStepClick = vi.fn();
    render(<AgentNext steps={makeSteps(3)} onStepClick={onStepClick} />);
    const firstItem = screen.getByRole("button", { name: /Step 1/i });
    await userEvent.click(firstItem);
    expect(onStepClick).toHaveBeenCalledWith("node_step_0");
  });
});

// ── AC2: empty state shows "No planned actions" ───────────────────────────────

describe("AC2: empty state", () => {
  it("shows 'No planned actions' when steps array is empty", () => {
    render(<AgentNext steps={[]} />);
    expect(screen.getByText(/No planned actions/i)).toBeInTheDocument();
  });

  it("does NOT render a list when steps is empty", () => {
    render(<AgentNext steps={[]} />);
    expect(screen.queryByRole("list")).toBeNull();
  });
});
