/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 3.3: LoadingState + ErrorState components
 *
 * AC1: GIVEN fetch falha WHEN ErrorState THEN retry button visible
 * AC2: role/text queries only (no snapshots per web.md)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoadingState } from "./loading-state";
import { ErrorState } from "./error-state";

// ── LoadingState ──────────────────────────────────────────────────────────────

describe("LoadingState", () => {
  it("renders accessible loading indicator", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders optional message", () => {
    render(<LoadingState message="Fetching sessions…" />);
    expect(screen.getByText(/Fetching sessions/)).toBeDefined();
  });
});

// ── ErrorState ────────────────────────────────────────────────────────────────

describe("ErrorState", () => {
  it("AC1: renders the error message", () => {
    render(<ErrorState message="Connection refused" onRetry={vi.fn()} />);
    expect(screen.getByText(/Connection refused/)).toBeDefined();
  });

  it("AC1: retry button is present and calls onRetry", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Failed" onRetry={onRetry} />);
    const btn = screen.getByRole("button", { name: /retry/i });
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("AC1: no retry button when onRetry is not provided", () => {
    render(<ErrorState message="Error occurred" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
