/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * §node_a7da930769e7 — Task 2.2: <AgentNow> component
 *
 * AC1: GIVEN agente idle WHEN render THEN card mostra "Idle" + última ação há X
 * AC2: GIVEN tool ativa WHEN render THEN spinner + nome da tool + duração crescendo
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentNow } from "./agent-now.js";
import type { AgentNow as AgentNowState } from "@/hooks/use-agent-state";

const PAST = new Date(Date.now() - 30_000).toISOString(); // 30s ago

// ── AC1: idle state ───────────────────────────────────────────────────────────

describe("AC1: idle state renders 'Idle' label", () => {
  it("shows 'Idle' text when state.idle is true", () => {
    const state: AgentNowState = {
      phase: "IMPLEMENT",
      idle: true,
      activeSession: null,
      currentTool: null,
    };
    render(<AgentNow state={state} />);
    expect(screen.getByText(/Idle/i)).toBeInTheDocument();
  });

  it("shows last action time when idle with a recent tool call", () => {
    const state: AgentNowState = {
      phase: "IMPLEMENT",
      idle: true,
      activeSession: null,
      currentTool: { name: "read_file", calledAt: PAST },
    };
    render(<AgentNow state={state} />);
    expect(screen.getByText(/Idle/i)).toBeInTheDocument();
    expect(screen.getByText(/ago/i)).toBeInTheDocument();
  });

  it("shows the current lifecycle phase", () => {
    const state: AgentNowState = {
      phase: "VALIDATE",
      idle: true,
      activeSession: null,
    };
    render(<AgentNow state={state} />);
    expect(screen.getByText(/VALIDATE/i)).toBeInTheDocument();
  });
});

// ── AC2: active state with spinner + tool name ────────────────────────────────

describe("AC2: active tool renders spinner, tool name, and duration", () => {
  it("shows the active tool name when idle is false", () => {
    const state: AgentNowState = {
      phase: "IMPLEMENT",
      idle: false,
      activeSession: "sess_abc",
      currentTool: { name: "write_file", calledAt: PAST },
    };
    render(<AgentNow state={state} />);
    expect(screen.getByText(/write_file/i)).toBeInTheDocument();
  });

  it("shows a spinner element when tool is active", () => {
    const state: AgentNowState = {
      phase: "IMPLEMENT",
      idle: false,
      activeSession: "sess_abc",
      currentTool: { name: "bash", calledAt: PAST },
    };
    render(<AgentNow state={state} />);
    expect(screen.getByTestId("agent-now-spinner")).toBeInTheDocument();
  });

  it("shows duration text (Xs) for an active tool call", () => {
    const state: AgentNowState = {
      phase: "IMPLEMENT",
      idle: false,
      activeSession: "sess_abc",
      currentTool: { name: "bash", calledAt: PAST },
    };
    render(<AgentNow state={state} />);
    expect(screen.getByText(/\d+s/)).toBeInTheDocument();
  });
});

// ── null state ────────────────────────────────────────────────────────────────

describe("null state", () => {
  it("renders nothing (or a placeholder) when state is null", () => {
    const { container } = render(<AgentNow state={null} />);
    expect(container.firstChild).toBeNull();
  });
});
