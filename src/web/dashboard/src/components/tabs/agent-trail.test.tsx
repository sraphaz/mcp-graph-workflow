/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * §node_76ece58f4105 — Task 2.3: <AgentTrail> — expandable timeline
 *
 * AC1: GIVEN trail de 50 eventos WHEN render THEN virtualização (só DOM dos visíveis)
 * AC2: GIVEN click em item WHEN expand THEN payload + causality children carregam inline
 * AC3: GIVEN re-click WHEN collapse THEN volta ao estado anterior
 * AC4: GIVEN evento com subjectRef WHEN render THEN link present
 * AC5: Tested via role/text queries — no snapshots
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentTrail } from "./agent-trail.js";
import type { TrailEvent } from "./agent-trail.js";

function makeEvent(overrides: Partial<TrailEvent> = {}): TrailEvent {
  return {
    id: overrides.id ?? `evt_${Math.random().toString(36).slice(2)}`,
    kind: overrides.kind ?? "tool.invoked",
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    durationMs: overrides.durationMs ?? 120,
    payload: overrides.payload ?? null,
    subjectRef: overrides.subjectRef ?? null,
  };
}

function makeEvents(count: number): TrailEvent[] {
  return Array.from({ length: count }, (_, i) =>
    makeEvent({
      id: `evt_${i.toString().padStart(3, "0")}`,
      kind: "tool.invoked",
      timestamp: new Date(1_700_000_000_000 + i * 1000).toISOString(),
    })
  );
}

// ── AC1: virtualization — only pageSize items in DOM initially ────────────────

describe("AC1: virtualization — only visible items rendered", () => {
  it("renders only pageSize items when given 50 events", () => {
    const events = makeEvents(50);
    render(<AgentTrail events={events} pageSize={20} />);

    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(20);
  });

  it("renders all items when count <= pageSize", () => {
    const events = makeEvents(5);
    render(<AgentTrail events={events} pageSize={20} />);

    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(5);
  });

  it("shows 'Load more' button when there are more events than pageSize", () => {
    const events = makeEvents(25);
    render(<AgentTrail events={events} pageSize={20} />);

    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("does not show 'Load more' when all events fit in pageSize", () => {
    const events = makeEvents(10);
    render(<AgentTrail events={events} pageSize={20} />);

    expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();
  });
});

// ── AC2: expand — payload + causality children load inline ───────────────────

describe("AC2: expand on click shows payload and causality children", () => {
  it("shows payload inline after clicking an item", async () => {
    const event = makeEvent({
      id: "evt_expand",
      kind: "tool.invoked",
      payload: JSON.stringify({ tool: "bash", args: ["ls"] }),
    });
    const onExpand = vi.fn().mockResolvedValue([]);
    render(<AgentTrail events={[event]} onExpandCausality={onExpand} />);

    const toggle = screen.getByRole("button", { name: /toggle evt_expand/i });
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByTestId(`payload-evt_expand`)).toBeInTheDocument();
    });
  });

  it("loads and shows causality children after clicking", async () => {
    const parent = makeEvent({ id: "evt_parent", kind: "tool.invoked" });
    const child = makeEvent({ id: "evt_child", kind: "tool.step" });
    const onExpand = vi.fn().mockResolvedValue([child]);

    render(<AgentTrail events={[parent]} onExpandCausality={onExpand} />);

    const toggle = screen.getByRole("button", { name: /toggle evt_parent/i });
    await userEvent.click(toggle);

    expect(onExpand).toHaveBeenCalledWith("evt_parent");
    await waitFor(() => {
      expect(screen.getByText("tool.step")).toBeInTheDocument();
    });
  });
});

// ── AC3: collapse — re-click collapses back ───────────────────────────────────

describe("AC3: re-click collapses the item", () => {
  it("hides payload after second click", async () => {
    const event = makeEvent({
      id: "evt_toggle",
      payload: JSON.stringify({ key: "value" }),
    });
    const onExpand = vi.fn().mockResolvedValue([]);
    render(<AgentTrail events={[event]} onExpandCausality={onExpand} />);

    const toggle = screen.getByRole("button", { name: /toggle evt_toggle/i });

    // expand
    await userEvent.click(toggle);
    await waitFor(() => {
      expect(screen.getByTestId("payload-evt_toggle")).toBeInTheDocument();
    });

    // collapse
    await userEvent.click(toggle);
    expect(screen.queryByTestId("payload-evt_toggle")).toBeNull();
  });
});

// ── AC4: subjectRef link ──────────────────────────────────────────────────────

describe("AC4: subjectRef renders as a navigable link", () => {
  it("renders a link for events with a subjectRef", () => {
    const event = makeEvent({
      id: "evt_link",
      kind: "node:updated",
      subjectRef: { kind: "task", id: "node_abc123" },
    });
    render(<AgentTrail events={[event]} />);

    const link = screen.getByRole("link", { name: /node_abc123/i });
    expect(link).toBeInTheDocument();
  });
});

// ── AC5: role/text queries (no snapshots) — the tests above satisfy this ─────
// All assertions above use getByRole / getByText / getByTestId — no toMatchSnapshot

// ── empty state ───────────────────────────────────────────────────────────────

describe("empty state", () => {
  it("shows an empty message when events array is empty", () => {
    render(<AgentTrail events={[]} />);
    expect(screen.getByText(/no events/i)).toBeInTheDocument();
  });
});
