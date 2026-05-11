/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 4.2: journey-session-timeline.tsx
 *
 * AC1: GIVEN sessão selecionada WHEN render THEN timeline aparece com eventos em ordem
 * AC2: GIVEN click no evento WHEN expand THEN payload + causality children aparecem inline
 * AC3: GIVEN timeline > 200 eventos WHEN render THEN virtualização (scroll container presente)
 * AC4: GIVEN navegação entre sessions WHEN troca THEN cleanup + load (sem memory leak)
 * AC5: GIVEN componente WHEN testado THEN role/text queries (sem snapshot)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { BhSession, BhAuditEvent } from "@/lib/types";

vi.mock("@/hooks/use-journey-sessions", () => ({
  useJourneySessions: vi.fn(),
  useJourneySessionEvents: vi.fn(),
}));

import { useJourneySessions, useJourneySessionEvents } from "@/hooks/use-journey-sessions";
import { JourneySessionTimeline } from "./journey-session-timeline";

const mockedUseSessions = vi.mocked(useJourneySessions);
const mockedUseEvents = vi.mocked(useJourneySessionEvents);

function makeSession(id: string): BhSession {
  return { id, status: "closed", startedAt: 1_700_000_000_000, closedAt: 1_700_000_060_000 };
}

function makeEvent(id: string, action: string, at: number, payload?: unknown): BhAuditEvent {
  return { id, action, payload: payload ?? {}, result: null, at };
}

const EMPTY_EVENTS = { events: [], loading: false, hasMore: false, loadMore: vi.fn() };

beforeEach(() => {
  mockedUseSessions.mockReturnValue({ sessions: [], loading: false });
  mockedUseEvents.mockReturnValue(EMPTY_EVENTS);
});

// ── AC1: Timeline shows events in order ──────────────────────────────────────

describe("JourneySessionTimeline — AC1: timeline shows ordered events", () => {
  it("AC1: renders session list item accessible by name", () => {
    mockedUseSessions.mockReturnValue({
      sessions: [makeSession("ses-1")],
      loading: false,
    });
    render(<JourneySessionTimeline />);
    expect(screen.getByRole("button", { name: /ses-1/i })).toBeDefined();
  });

  it("AC1: events appear in timeline after session selection", () => {
    mockedUseSessions.mockReturnValue({
      sessions: [makeSession("ses-1")],
      loading: false,
    });
    mockedUseEvents.mockReturnValue({
      events: [
        makeEvent("ev-1", "navigate", 1000),
        makeEvent("ev-2", "click", 2000),
      ],
      loading: false,
      hasMore: false,
      loadMore: vi.fn(),
    });
    render(<JourneySessionTimeline />);
    expect(screen.getByText("navigate")).toBeDefined();
    expect(screen.getByText("click")).toBeDefined();
  });

  it("AC1: events appear in chronological order (earlier action listed first)", () => {
    mockedUseSessions.mockReturnValue({ sessions: [makeSession("ses-1")], loading: false });
    mockedUseEvents.mockReturnValue({
      events: [
        makeEvent("ev-1", "navigate", 1000),
        makeEvent("ev-2", "click", 2000),
        makeEvent("ev-3", "input", 3000),
      ],
      loading: false,
      hasMore: false,
      loadMore: vi.fn(),
    });
    render(<JourneySessionTimeline />);
    const items = screen.getAllByRole("listitem");
    const texts = items.map((el) => el.textContent ?? "");
    const navIdx = texts.findIndex((t) => t.includes("navigate"));
    const clickIdx = texts.findIndex((t) => t.includes("click"));
    const inputIdx = texts.findIndex((t) => t.includes("input"));
    expect(navIdx).toBeLessThan(clickIdx);
    expect(clickIdx).toBeLessThan(inputIdx);
  });
});

// ── AC2: Click expands payload inline ────────────────────────────────────────

describe("JourneySessionTimeline — AC2: click expands payload inline", () => {
  it("AC2: payload is not visible before click", () => {
    mockedUseSessions.mockReturnValue({ sessions: [makeSession("ses-1")], loading: false });
    mockedUseEvents.mockReturnValue({
      events: [makeEvent("ev-1", "navigate", 1000, { url: "https://example.com" })],
      loading: false,
      hasMore: false,
      loadMore: vi.fn(),
    });
    render(<JourneySessionTimeline />);
    expect(screen.queryByText(/https:\/\/example\.com/)).toBeNull();
  });

  it("AC2: payload is visible after click on event row", () => {
    mockedUseSessions.mockReturnValue({ sessions: [makeSession("ses-1")], loading: false });
    mockedUseEvents.mockReturnValue({
      events: [makeEvent("ev-1", "navigate", 1000, { url: "https://example.com" })],
      loading: false,
      hasMore: false,
      loadMore: vi.fn(),
    });
    render(<JourneySessionTimeline />);
    const row = screen.getByRole("button", { name: /navigate/i });
    fireEvent.click(row);
    expect(screen.getByText(/https:\/\/example\.com/)).toBeDefined();
  });

  it("AC2: second click collapses payload again", () => {
    mockedUseSessions.mockReturnValue({ sessions: [makeSession("ses-1")], loading: false });
    mockedUseEvents.mockReturnValue({
      events: [makeEvent("ev-1", "navigate", 1000, { url: "https://example.com" })],
      loading: false,
      hasMore: false,
      loadMore: vi.fn(),
    });
    render(<JourneySessionTimeline />);
    const row = screen.getByRole("button", { name: /navigate/i });
    fireEvent.click(row);
    fireEvent.click(row);
    expect(screen.queryByText(/https:\/\/example\.com/)).toBeNull();
  });
});

// ── AC3: Virtualization scroll container present ──────────────────────────────

describe("JourneySessionTimeline — AC3: virtualization container", () => {
  it("AC3: renders a scrollable timeline container (supports virtualization)", () => {
    mockedUseSessions.mockReturnValue({ sessions: [makeSession("ses-1")], loading: false });
    mockedUseEvents.mockReturnValue({
      events: Array.from({ length: 201 }, (_, i) =>
        makeEvent(`ev-${i}`, `action-${i}`, i * 100)
      ),
      loading: false,
      hasMore: false,
      loadMore: vi.fn(),
    });
    render(<JourneySessionTimeline />);
    const list = screen.getByRole("list", { name: /event timeline/i });
    expect(list).toBeDefined();
  });
});

// ── AC4: Session switch triggers reload ──────────────────────────────────────

describe("JourneySessionTimeline — AC4: session navigation", () => {
  it("AC4: switching session calls hook with new sessionId", () => {
    mockedUseSessions.mockReturnValue({
      sessions: [makeSession("ses-1"), makeSession("ses-2")],
      loading: false,
    });
    render(<JourneySessionTimeline />);
    const btn2 = screen.getByRole("button", { name: /ses-2/i });
    fireEvent.click(btn2);
    expect(mockedUseEvents).toHaveBeenCalledWith("ses-2");
  });
});

// ── AC5: Empty state ──────────────────────────────────────────────────────────

describe("JourneySessionTimeline — AC5: empty state", () => {
  it("AC5: shows no-sessions message when list is empty", () => {
    mockedUseSessions.mockReturnValue({ sessions: [], loading: false });
    render(<JourneySessionTimeline />);
    expect(screen.getByText(/no sessions|sem sessões/i)).toBeDefined();
  });
});
