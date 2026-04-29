/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §SprintF — LifecycleHealthTab render contract.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LifecycleHealthTab } from "./lifecycle-health-tab";

vi.mock("@/hooks/use-lifecycle-health", () => ({
  useLifecycleTrend: vi.fn(),
  useLifecycleSnapshots: vi.fn(),
}));

import {
  useLifecycleTrend,
  useLifecycleSnapshots,
  type LifecycleSnapshot,
  type SuccessRateData,
} from "@/hooks/use-lifecycle-health";

const mockedTrend = vi.mocked(useLifecycleTrend);
const mockedSnaps = vi.mocked(useLifecycleSnapshots);

function trend(overrides: { data?: SuccessRateData | null; loading?: boolean } = {}) {
  return {
    data:
      overrides.data === null
        ? null
        : (overrides.data ?? {
            window: 10,
            samples: 0,
            passed: 0,
            successRate: 0,
            latestPassedAll: null,
            summary: "no snapshots",
          }),
    loading: overrides.loading ?? false,
    error: null,
  };
}

function snaps(data: LifecycleSnapshot[] = [], loading = false) {
  return { data, loading, error: null };
}

describe("<LifecycleHealthTab>", () => {
  beforeEach(() => {
    mockedTrend.mockReset();
    mockedSnaps.mockReset();
  });

  it("renders the empty-state hint when no snapshots exist", () => {
    mockedTrend.mockReturnValue(
      trend({ data: { window: 10, samples: 0, passed: 0, successRate: 0, latestPassedAll: null, summary: "" } }),
    );
    mockedSnaps.mockReturnValue(snaps([]));
    render(<LifecycleHealthTab />);
    expect(screen.getByText(/No snapshots yet/i)).toBeInTheDocument();
  });

  it("renders the rolling success-rate when samples > 0", () => {
    mockedTrend.mockReturnValue(
      trend({
        data: {
          window: 10,
          samples: 5,
          passed: 3,
          successRate: 0.6,
          latestPassedAll: true,
          summary: "3/5 passed",
        },
      }),
    );
    mockedSnaps.mockReturnValue(snaps([]));
    render(<LifecycleHealthTab />);
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText(/3\/5 passed all 9 phases/i)).toBeInTheDocument();
    expect(screen.getByText(/latest: pass/i)).toBeInTheDocument();
  });

  it("shows the latest=fail badge when most recent snapshot failed", () => {
    mockedTrend.mockReturnValue(
      trend({
        data: {
          window: 10,
          samples: 1,
          passed: 0,
          successRate: 0,
          latestPassedAll: false,
          summary: "0/1",
        },
      }),
    );
    mockedSnaps.mockReturnValue(snaps([]));
    render(<LifecycleHealthTab />);
    expect(screen.getByText(/latest: fail/i)).toBeInTheDocument();
  });

  it("renders the recent snapshots list with epic id and date", () => {
    mockedTrend.mockReturnValue(trend());
    mockedSnaps.mockReturnValue(
      snaps([
        {
          id: "lhs-1",
          epicId: "epic-A",
          passedAll: true,
          takenAt: "2026-04-29T10:00:00.000Z",
          takenOn: "2026-04-29",
          report: { epicId: "epic-A", passedCount: 9, passedAll: true, summary: "all green" },
        },
      ]),
    );
    render(<LifecycleHealthTab />);
    expect(screen.getByText("epic-A")).toBeInTheDocument();
    expect(screen.getByText("2026-04-29")).toBeInTheDocument();
    expect(screen.getByText(/all green/)).toBeInTheDocument();
  });

  it("renders Loading… while either hook is pending", () => {
    mockedTrend.mockReturnValue({ data: null, loading: true, error: null });
    mockedSnaps.mockReturnValue(snaps([], true));
    render(<LifecycleHealthTab />);
    const loading = screen.getAllByText(/Loading…/i);
    expect(loading.length).toBeGreaterThanOrEqual(2);
  });
});
