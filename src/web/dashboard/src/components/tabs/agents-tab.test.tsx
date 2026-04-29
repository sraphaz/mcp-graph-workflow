/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §AgentMonitor — AgentsTab render contract.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentsTab, classifyDiffLine, sortAgents } from "./agents-tab";

vi.mock("@/hooks/use-agent-activity", () => ({
  useAgentActivity: vi.fn(),
}));
vi.mock("@/hooks/use-agent-work", () => ({
  useAgentWork: vi.fn(),
  useAgentEvents: vi.fn(),
  fetchFileDiff: vi.fn(),
}));

import { useAgentActivity } from "@/hooks/use-agent-activity";
import {
  useAgentWork,
  useAgentEvents,
  fetchFileDiff,
  type AgentWorkPayload,
} from "@/hooks/use-agent-work";

const mockedActivity = vi.mocked(useAgentActivity);
const mockedWork = vi.mocked(useAgentWork);
const mockedEvents = vi.mocked(useAgentEvents);
const mockedDiff = vi.mocked(fetchFileDiff);

function activity(agents: Array<{ agentId: string; status: string; lastHeartbeat: string; activeLocks: number; currentTaskId: string | null }>) {
  return {
    data: { agents, teamTaskEnabled: agents.length > 0 },
    loading: false,
    error: null,
    refresh: vi.fn(),
  };
}

function work(payload: AgentWorkPayload | null, opts: { loading?: boolean; error?: string | null } = {}) {
  return {
    data: payload,
    loading: opts.loading ?? false,
    error: opts.error ?? null,
    refresh: vi.fn(),
  };
}

const NOW = new Date("2026-04-29T12:00:00.000Z").toISOString();

describe("<AgentsTab>", () => {
  beforeEach(() => {
    mockedActivity.mockReset();
    mockedWork.mockReset();
    mockedEvents.mockReset();
    mockedDiff.mockReset();
    // Default empty events so individual tests only override when relevant.
    mockedEvents.mockReturnValue({ data: [], loading: false, error: null });
    // Reset localStorage so tests that read the persisted-selection key
    // never inherit state from a prior test in the same file.
    try {
      localStorage.clear();
    } catch {
      // jsdom localStorage may throw on quota in rare configs — best effort.
    }
  });

  it("renders the empty-state when no agents have heartbeat", () => {
    mockedActivity.mockReturnValue(activity([]));
    mockedWork.mockReturnValue(work(null));
    render(<AgentsTab />);
    expect(screen.getByText(/No agents have heartbeat/i)).toBeInTheDocument();
  });

  it("lists each agent and auto-selects the first", () => {
    mockedActivity.mockReturnValue(
      activity([
        { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 1, currentTaskId: "task-1" },
        { agentId: "agent-B", status: "stale", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: null },
      ]),
    );
    mockedWork.mockReturnValue(
      work({
        agent: { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 1, currentTaskId: "task-1" },
        projectPhase: "IMPLEMENT",
        currentTask: {
          id: "task-1",
          title: "Add validation",
          status: "in_progress",
          lifecyclePhase: "IMPLEMENT",
          startedAt: NOW,
          acceptanceCriteria: [],
        },
        changedFiles: [{ path: "src/x.ts", additions: 47, deletions: 12 }],
        changedFileCount: 1,
      }),
    );
    render(<AgentsTab />);
    // Both agents appear in the list (left column)
    expect(screen.getAllByText("agent-A").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("agent-B")).toBeInTheDocument();
    // detail panel for agent-A renders
    expect(screen.getByText("Add validation")).toBeInTheDocument();
    expect(screen.getByText("IMPLEMENT")).toBeInTheDocument();
  });

  it("honors a persisted selection when the agent is still in the list", () => {
    localStorage.setItem("mcp-graph-agents-selected", "agent-B");
    mockedActivity.mockReturnValue(
      activity([
        { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: null },
        { agentId: "agent-B", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: "task-2" },
      ]),
    );
    mockedWork.mockReturnValue(
      work({
        agent: { agentId: "agent-B", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: "task-2" },
        projectPhase: "IMPLEMENT",
        currentTask: {
          id: "task-2",
          title: "Persisted-selection task",
          status: "in_progress",
          lifecyclePhase: "IMPLEMENT",
          startedAt: NOW,
          acceptanceCriteria: [],
        },
        changedFiles: [],
        changedFileCount: 0,
      }),
    );
    render(<AgentsTab />);
    expect(screen.getByText("Persisted-selection task")).toBeInTheDocument();
    localStorage.removeItem("mcp-graph-agents-selected");
  });

  it("falls back to the first agent when the persisted id no longer exists", () => {
    localStorage.setItem("mcp-graph-agents-selected", "agent-vanished");
    mockedActivity.mockReturnValue(
      activity([
        { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: "task-1" },
      ]),
    );
    mockedWork.mockReturnValue(
      work({
        agent: { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: "task-1" },
        projectPhase: "IMPLEMENT",
        currentTask: {
          id: "task-1",
          title: "Fallback task",
          status: "in_progress",
          lifecyclePhase: "IMPLEMENT",
          startedAt: NOW,
          acceptanceCriteria: [],
        },
        changedFiles: [],
        changedFileCount: 0,
      }),
    );
    render(<AgentsTab />);
    // Falls back to the only agent in the list
    expect(screen.getByText("Fallback task")).toBeInTheDocument();
    localStorage.removeItem("mcp-graph-agents-selected");
  });

  it("renders idle state when an agent has no current task", () => {
    mockedActivity.mockReturnValue(
      activity([
        { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: null },
      ]),
    );
    mockedWork.mockReturnValue(
      work({
        agent: { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: null },
        projectPhase: "ANALYZE",
        currentTask: null,
        changedFiles: [],
        changedFileCount: 0,
      }),
    );
    render(<AgentsTab />);
    expect(screen.getByText(/Agent is idle/i)).toBeInTheDocument();
    expect(screen.getByText(/No working-tree changes/i)).toBeInTheDocument();
  });

  it("expands a changed file row and fetches its diff on click", async () => {
    mockedActivity.mockReturnValue(
      activity([
        { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: "task-1" },
      ]),
    );
    mockedWork.mockReturnValue(
      work({
        agent: { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: "task-1" },
        projectPhase: "IMPLEMENT",
        currentTask: {
          id: "task-1",
          title: "Refactor",
          status: "in_progress",
          lifecyclePhase: "IMPLEMENT",
          startedAt: NOW,
          acceptanceCriteria: [],
        },
        changedFiles: [{ path: "src/foo.ts", additions: 5, deletions: 2 }],
        changedFileCount: 1,
      }),
    );
    mockedDiff.mockResolvedValue({
      path: "src/foo.ts",
      baseRef: "HEAD",
      diff: "@@ +1 +1 @@\n-old\n+new\n",
      truncated: false,
      byteCount: 24,
    });
    render(<AgentsTab />);
    const toggle = screen.getByRole("button", { name: /Toggle diff for src\/foo\.ts/i });
    await userEvent.click(toggle);
    expect(mockedDiff).toHaveBeenCalledWith("agent-A", "src/foo.ts");
    // Wait for the async diff to render
    expect(await screen.findByText(/\+new/)).toBeInTheDocument();
  });

  it("renders the acceptance-criteria progress bar with done/total count", () => {
    mockedActivity.mockReturnValue(
      activity([
        { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: "task-1" },
      ]),
    );
    mockedWork.mockReturnValue(
      work({
        agent: { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: "task-1" },
        projectPhase: "IMPLEMENT",
        currentTask: {
          id: "task-1",
          title: "Add validation",
          status: "in_progress",
          lifecyclePhase: "IMPLEMENT",
          startedAt: NOW,
          acceptanceCriteria: [
            { text: "Reject empty payload", done: true },
            { text: "Surface error code", done: true },
            { text: "Add unit test", done: false },
          ],
        },
        changedFiles: [],
        changedFileCount: 0,
      }),
    );
    render(<AgentsTab />);
    expect(screen.getByText(/2\/3 \(67%\)/)).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: /Acceptance criteria progress/i });
    expect(bar).toHaveAttribute("aria-valuenow", "67");
  });

  it("renders the recent-activity timeline when events are present", () => {
    mockedActivity.mockReturnValue(
      activity([
        { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: "task-1" },
      ]),
    );
    mockedWork.mockReturnValue(
      work({
        agent: { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: "task-1" },
        projectPhase: "IMPLEMENT",
        currentTask: {
          id: "task-1",
          title: "Refactor",
          status: "in_progress",
          lifecyclePhase: "IMPLEMENT",
          startedAt: NOW,
          acceptanceCriteria: [],
        },
        changedFiles: [],
        changedFileCount: 0,
      }),
    );
    mockedEvents.mockReturnValue({
      data: [
        { id: 2, type: "task:claimed", createdAt: NOW, payload: {} },
        { id: 1, type: "agent:heartbeat", createdAt: NOW, payload: {} },
      ],
      loading: false,
      error: null,
    });
    render(<AgentsTab />);
    expect(screen.getByText("task:claimed")).toBeInTheDocument();
    expect(screen.getByText("agent:heartbeat")).toBeInTheDocument();
    expect(screen.getByText(/last 20 events/i)).toBeInTheDocument();
  });

  it.each([
    ["+++ b/src/foo.ts", "header"],
    ["--- a/src/foo.ts", "header"],
    ["diff --git a/foo b/foo", "header"],
    ["index abc..def 100644", "header"],
    ["@@ -1,3 +1,4 @@", "hunk"],
    ["+new line", "add"],
    ["-old line", "del"],
    [" unchanged context", "context"],
    ["", "context"],
  ])("classifyDiffLine(%j) → %s", (line, expected) => {
    expect(classifyDiffLine(line)).toBe(expected);
  });

  it("renders count badges for active / stale / working agents", () => {
    mockedActivity.mockReturnValue(
      activity([
        { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: "task-1" },
        { agentId: "agent-B", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: null },
        { agentId: "agent-C", status: "stale", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: null },
      ]),
    );
    mockedWork.mockReturnValue(
      work({
        agent: { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: "task-1" },
        projectPhase: "IMPLEMENT",
        currentTask: null,
        changedFiles: [],
        changedFileCount: 0,
      }),
    );
    render(<AgentsTab />);
    const summary = screen.getByRole("status", { name: /Agent count summary/i });
    expect(summary).toHaveTextContent("2 active");
    expect(summary).toHaveTextContent("1 stale");
    expect(summary).toHaveTextContent("1 working");
  });

  it("hides the stale badge when no agents are stale", () => {
    mockedActivity.mockReturnValue(
      activity([
        { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: null },
      ]),
    );
    mockedWork.mockReturnValue(
      work({
        agent: { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: null },
        projectPhase: "ANALYZE",
        currentTask: null,
        changedFiles: [],
        changedFileCount: 0,
      }),
    );
    render(<AgentsTab />);
    const summary = screen.getByRole("status", { name: /Agent count summary/i });
    expect(summary).toHaveTextContent("1 active");
    expect(summary).not.toHaveTextContent("stale");
  });

  it("hides the count summary entirely when there are no agents", () => {
    mockedActivity.mockReturnValue(activity([]));
    mockedWork.mockReturnValue(work(null));
    render(<AgentsTab />);
    expect(screen.queryByRole("status", { name: /Agent count summary/i })).toBeNull();
  });

  it("persists the selected agent id to localStorage on click", async () => {
    mockedActivity.mockReturnValue(
      activity([
        { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: null },
        { agentId: "agent-B", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: null },
      ]),
    );
    mockedWork.mockReturnValue(
      work({
        agent: { agentId: "agent-A", status: "active", lastHeartbeat: NOW, activeLocks: 0, currentTaskId: null },
        projectPhase: "ANALYZE",
        currentTask: null,
        changedFiles: [],
        changedFileCount: 0,
      }),
    );
    localStorage.removeItem("mcp-graph-agents-selected");
    render(<AgentsTab />);
    const agentBButton = screen.getByRole("button", { name: /agent-B/i });
    await userEvent.click(agentBButton);
    expect(localStorage.getItem("mcp-graph-agents-selected")).toBe("agent-B");
  });

  describe("sortAgents", () => {
    it("places active agents before stale ones", () => {
      const sorted = sortAgents([
        { agentId: "old-stale", status: "stale", lastHeartbeat: "2026-04-29T11:00:00.000Z" },
        { agentId: "fresh-active", status: "active", lastHeartbeat: "2026-04-29T10:00:00.000Z" },
      ]);
      expect(sorted.map((a) => a.agentId)).toEqual(["fresh-active", "old-stale"]);
    });

    it("orders within a status group by most recent heartbeat", () => {
      const sorted = sortAgents([
        { agentId: "older", status: "active", lastHeartbeat: "2026-04-29T10:00:00.000Z" },
        { agentId: "newer", status: "active", lastHeartbeat: "2026-04-29T12:00:00.000Z" },
        { agentId: "middle", status: "active", lastHeartbeat: "2026-04-29T11:00:00.000Z" },
      ]);
      expect(sorted.map((a) => a.agentId)).toEqual(["newer", "middle", "older"]);
    });

    it("breaks heartbeat ties by agentId for a stable order", () => {
      const ts = "2026-04-29T12:00:00.000Z";
      const sorted = sortAgents([
        { agentId: "b", status: "active", lastHeartbeat: ts },
        { agentId: "a", status: "active", lastHeartbeat: ts },
      ]);
      expect(sorted.map((a) => a.agentId)).toEqual(["a", "b"]);
    });
  });

  it("shows a load error from useAgentActivity", () => {
    mockedActivity.mockReturnValue({
      data: null,
      loading: false,
      error: "boom",
      refresh: vi.fn(),
    });
    mockedWork.mockReturnValue(work(null));
    render(<AgentsTab />);
    expect(screen.getByRole("alert")).toHaveTextContent(/boom/);
  });
});
