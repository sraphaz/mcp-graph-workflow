/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 2.1 — Hook use-browser-tests
 *
 * AC1: hook montado WHEN SSE chega THEN `runs` atualiza incrementalmente
 * AC2: unmount WHEN cleanup THEN SSE fecha (sem leak — assert via spy)
 * AC4: `activeRun` setado WHEN trocado THEN fetch detalhes via REST
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBrowserTests } from "./use-browser-tests";

// ---------------------------------------------------------------------------
// FakeEventSource
// ---------------------------------------------------------------------------

class FakeEventSource {
  static instance: FakeEventSource | null = null;
  static closeCalls = 0;
  listeners: Record<string, EventListener[]> = {};
  closed = false;
  url: string;
  onerror: ((e: Event) => void) | null = null;

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

  emit(type: string, data: unknown) {
    const evt = new MessageEvent(type, { data: JSON.stringify(data) });
    (this.listeners[type] ?? []).forEach((h) => h(evt));
  }

  close() {
    this.closed = true;
    FakeEventSource.closeCalls++;
  }
}

const SAMPLE_RUN = {
  id: "bhrun-001",
  sessionId: "sess-001",
  nodeId: null,
  prompt: "login flow",
  plan: [],
  results: [],
  verdict: "pass",
  durationMs: 100,
  createdAt: Date.now(),
};

function makeFetchStub(responses: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const key = Object.keys(responses).find((k) => (url as string).includes(k));
    const body = key ? responses[key] : { error: "not_found" };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  });
}

// ---------------------------------------------------------------------------
// AC1: SSE event → runs updates incrementally
// ---------------------------------------------------------------------------

describe("useBrowserTests — AC1: runs update incrementally via SSE", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
    FakeEventSource.instance = null;
    FakeEventSource.closeCalls = 0;
    vi.stubGlobal("fetch", makeFetchStub({ "browser-tests/runs": [SAMPLE_RUN] }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with loading true", () => {
    const { result } = renderHook(() => useBrowserTests());
    expect(result.current.loading).toBe(true);
  });

  it("populates runs after initial fetch", async () => {
    const { result } = renderHook(() => useBrowserTests());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.runs).toHaveLength(1);
    expect(result.current.runs[0].id).toBe("bhrun-001");
  });

  it("prepends a new run when test.started SSE arrives", async () => {
    const newRun = { ...SAMPLE_RUN, id: "bhrun-002" };
    const { result } = renderHook(() => useBrowserTests());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      FakeEventSource.instance?.emit("test.started", newRun);
    });

    expect(result.current.runs.some((r) => r.id === "bhrun-002")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC2: unmount → SSE closes (no leak)
// ---------------------------------------------------------------------------

describe("useBrowserTests — AC2: SSE closes on unmount", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
    FakeEventSource.instance = null;
    FakeEventSource.closeCalls = 0;
    vi.stubGlobal("fetch", makeFetchStub({ "browser-tests/runs": [] }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("closes the EventSource on unmount", async () => {
    const { unmount } = renderHook(() => useBrowserTests());
    await waitFor(() => expect(FakeEventSource.instance).not.toBeNull());

    unmount();

    expect(FakeEventSource.instance?.closed).toBe(true);
  });

  it("close is called exactly once on unmount", async () => {
    const { unmount } = renderHook(() => useBrowserTests());
    await waitFor(() => expect(FakeEventSource.instance).not.toBeNull());

    const before = FakeEventSource.closeCalls;
    unmount();
    expect(FakeEventSource.closeCalls).toBe(before + 1);
  });
});

// ---------------------------------------------------------------------------
// AC4: activeRun change → REST fetch (not polling)
// ---------------------------------------------------------------------------

describe("useBrowserTests — AC4: activeRun → REST fetch on change", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
    FakeEventSource.instance = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches run detail when activeRunId is set", async () => {
    const fetchSpy = makeFetchStub({
      "browser-tests/runs": [SAMPLE_RUN],
      "browser-tests/runs/bhrun-001": SAMPLE_RUN,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { result } = renderHook(() => useBrowserTests());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setActiveRunId("bhrun-001");
    });

    await waitFor(() =>
      fetchSpy.mock.calls.some(([url]) => (url as string).includes("bhrun-001"))
    );

    expect(fetchSpy.mock.calls.some(([url]) => (url as string).includes("bhrun-001"))).toBe(true);
  });
});
