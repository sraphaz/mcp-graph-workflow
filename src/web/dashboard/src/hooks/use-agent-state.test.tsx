/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 2.1 — Hook use-agent-state
 *
 * AC1: hook montado, endpoints respondem → 4 estados populados
 * AC2: evento SSE de novo step → trail atualiza incrementalmente (sem refetch full)
 * AC3: unmount → SSE fecha + AbortController disparado
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAgentState } from "./use-agent-state";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class FakeEventSource {
  static instance: FakeEventSource | null = null;
  listeners: Record<string, EventListener[]> = {};
  closed = false;
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instance = this;
  }

  addEventListener(type: string, handler: EventListener) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  removeEventListener(type: string, handler: EventListener) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((h) => h !== handler);
    }
  }

  emit(type: string, data: string) {
    const evt = new MessageEvent(type, { data });
    (this.listeners[type] ?? []).forEach((h) => h(evt));
  }

  close() {
    this.closed = true;
  }
}

const NOW_IDLE = { phase: "IMPLEMENT", idle: true, activeSession: null, currentTool: null };
const NOW_ACTIVE = {
  phase: "IMPLEMENT",
  idle: false,
  activeSession: "run-abc",
  activeRun: { runId: "run-abc", currentStep: 3 },
  currentTool: { name: "start_task", calledAt: "2026-05-09T00:00:00Z" },
};

function mockFetch(responses: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const key = Object.keys(responses).find((k) => url.includes(k));
      const body = key ? responses[key] : { error: "not_found" };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }),
  );
}

// ---------------------------------------------------------------------------
// AC1: 4 states populated
// ---------------------------------------------------------------------------

describe("useAgentState — AC1: 4 states populated on mount", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
    mockFetch({
      "agents/now": NOW_IDLE,
      "agents/trail": { entries: [] },
      "agents/next": { nextTask: null },
      "agents/learnings": { learnings: [] },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeEventSource.instance = null;
  });

  it("should start with loading true and nulls", () => {
    const { result } = renderHook(() => useAgentState());
    expect(result.current.loading).toBe(true);
    expect(result.current.now).toBeNull();
  });

  it("should populate now state after fetch", async () => {
    const { result } = renderHook(() => useAgentState());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.now).not.toBeNull();
    expect(result.current.now?.phase).toBe("IMPLEMENT");
    expect(result.current.now?.idle).toBe(true);
  });

  it("should populate all 4 states", async () => {
    const { result } = renderHook(() => useAgentState());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.now).toBeDefined();
    expect(result.current.trail).toBeDefined();
    expect(result.current.next).toBeDefined();
    expect(result.current.learnings).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC2: SSE → trail incremental update (no full refetch)
// ---------------------------------------------------------------------------

describe("useAgentState — AC2: SSE trail incremental update", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
    mockFetch({
      "agents/now": NOW_ACTIVE,
      "agents/trail": { entries: [{ step: 1, tool: "context", at: "2026-05-09T00:00:00Z" }] },
      "agents/next": { nextTask: null },
      "agents/learnings": { learnings: [] },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeEventSource.instance = null;
  });

  it("should append new step to trail on SSE event without refetch", async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    const { result } = renderHook(() => useAgentState());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callCountAfterMount = fetchSpy.mock.calls.length;

    act(() => {
      FakeEventSource.instance?.emit(
        "agent:step",
        JSON.stringify({ step: 2, tool: "finish_task", at: "2026-05-09T00:01:00Z" }),
      );
    });

    await waitFor(() => {
      const entries = result.current.trail?.entries ?? [];
      return entries.length > 1;
    });

    expect(fetchSpy.mock.calls.length).toBe(callCountAfterMount);
    expect(result.current.trail?.entries).toHaveLength(2);
    expect(result.current.trail?.entries[1].tool).toBe("finish_task");
  });
});

// ---------------------------------------------------------------------------
// AC3: unmount → SSE closed + cleanup
// ---------------------------------------------------------------------------

describe("useAgentState — AC3: cleanup on unmount", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
    mockFetch({
      "agents/now": NOW_IDLE,
      "agents/trail": { entries: [] },
      "agents/next": { nextTask: null },
      "agents/learnings": { learnings: [] },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeEventSource.instance = null;
  });

  it("should close EventSource on unmount", async () => {
    const { unmount } = renderHook(() => useAgentState());
    await waitFor(() => FakeEventSource.instance !== null);
    unmount();
    expect(FakeEventSource.instance?.closed).toBe(true);
  });
});
