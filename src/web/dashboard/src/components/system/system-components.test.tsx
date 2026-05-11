/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 3.1: system/ components
 *
 * AC1: GIVEN componente extraído WHEN renderizado THEN comportamento idêntico ao ad-hoc original
 * Tests use role/text queries — no DOM snapshots (per web.md).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Card } from "./card";
import { StatusBadge } from "./status-badge";
import { KpiTile } from "./kpi-tile";
import { TimelineItem } from "./timeline-item";
import { EvidenceThumbnail } from "./evidence-thumbnail";
import { EmptyState } from "./empty-state";

// ── Card ─────────────────────────────────────────────────────────────────────

describe("Card", () => {
  it("renders children inside a card container", () => {
    render(<Card><span>hello card</span></Card>);
    expect(screen.getByText("hello card")).toBeDefined();
  });

  it("accepts extra className", () => {
    const { container } = render(<Card className="extra-class"><span>x</span></Card>);
    expect(container.firstElementChild?.className).toContain("extra-class");
  });
});

// ── StatusBadge ───────────────────────────────────────────────────────────────

describe("StatusBadge", () => {
  it("renders the status text", () => {
    render(<StatusBadge status="online" />);
    expect(screen.getByText(/online/i)).toBeDefined();
  });

  it("renders optional label prefix when provided", () => {
    render(<StatusBadge status="done" label="Task" />);
    expect(screen.getByText(/Task/i)).toBeDefined();
    expect(screen.getByText(/done/i)).toBeDefined();
  });

  it("has role=status for accessibility", () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders offline status", () => {
    render(<StatusBadge status="offline" />);
    expect(screen.getByText(/offline/i)).toBeDefined();
  });
});

// ── KpiTile ──────────────────────────────────────────────────────────────────

describe("KpiTile", () => {
  it("renders the numeric value", () => {
    render(<KpiTile value={42} label="Tasks done" />);
    expect(screen.getByText("42")).toBeDefined();
  });

  it("renders the label", () => {
    render(<KpiTile value={7} label="Active agents" />);
    expect(screen.getByText("Active agents")).toBeDefined();
  });

  it("renders string value", () => {
    render(<KpiTile value="99%" label="Coverage" />);
    expect(screen.getByText("99%")).toBeDefined();
  });
});

// ── TimelineItem ──────────────────────────────────────────────────────────────

describe("TimelineItem", () => {
  it("renders the label", () => {
    render(<TimelineItem label="navigate" />);
    expect(screen.getByText("navigate")).toBeDefined();
  });

  it("renders timestamp when provided", () => {
    render(<TimelineItem label="click" timestamp="12:00:01.234" />);
    expect(screen.getByText(/12:00:01/)).toBeDefined();
  });

  it("renders outcome badge when provided", () => {
    render(<TimelineItem label="submit" outcome="pass" />);
    expect(screen.getByText(/pass/i)).toBeDefined();
  });

  it("renders children (causality detail)", () => {
    render(
      <TimelineItem label="parent">
        <span>child-detail</span>
      </TimelineItem>,
    );
    expect(screen.getByText("child-detail")).toBeDefined();
  });
});

// ── EvidenceThumbnail ─────────────────────────────────────────────────────────

describe("EvidenceThumbnail", () => {
  it("renders an img with the given src", () => {
    render(<EvidenceThumbnail src="/screenshot.png" alt="step 1" />);
    const img = screen.getByRole("img", { name: "step 1" });
    expect(img).toBeDefined();
    expect((img as HTMLImageElement).src).toContain("/screenshot.png");
  });

  it("renders optional label below the image", () => {
    render(<EvidenceThumbnail src="/s.png" alt="step" label="Step 3" />);
    expect(screen.getByText("Step 3")).toBeDefined();
  });
});

// ── EmptyState ────────────────────────────────────────────────────────────────

describe("EmptyState", () => {
  it("renders the message text", () => {
    render(<EmptyState message="No items found" />);
    expect(screen.getByText("No items found")).toBeDefined();
  });

  it("renders action button when provided", () => {
    const onClick = vi.fn();
    render(<EmptyState message="Empty" action={{ label: "Add item", onClick }} />);
    const btn = screen.getByRole("button", { name: "Add item" });
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not render button when no action provided", () => {
    render(<EmptyState message="Nothing here" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
