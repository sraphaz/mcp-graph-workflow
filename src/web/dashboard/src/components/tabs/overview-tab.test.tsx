/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-dashboard-ux — Task 1.3: Lifecycle Health merged into Overview tab.
 *
 * AC1: GIVEN merge executado WHEN tab unificada renderiza THEN funcionalidades de ambos preservadas
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as mod from "./overview-tab";

vi.mock("@/hooks/use-insights", () => ({
  useInsights: vi.fn(),
}));

vi.mock("@/hooks/use-lifecycle-health", () => ({
  useLifecycleTrend: vi.fn(),
  useLifecycleSnapshots: vi.fn(),
}));

vi.mock("@/components/charts/health-gauge", () => ({
  HealthGauge: ({ score }: { score: number }) => <div data-testid="health-gauge">{score}</div>,
}));

vi.mock("@/lib/constants", () => ({
  STATUS_COLORS: {},
}));

vi.mock("@/lib/runtime-guards", () => ({
  safePercentage: (v: number) => v,
}));

import { useInsights } from "@/hooks/use-insights";
import { useLifecycleTrend, useLifecycleSnapshots } from "@/hooks/use-lifecycle-health";

const mockedInsights = vi.mocked(useInsights);
const mockedTrend = vi.mocked(useLifecycleTrend);
const mockedSnaps = vi.mocked(useLifecycleSnapshots);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function minimalInsights(): any {
  return {
    data: {
      metrics: { velocity: { tasksCompleted: 3 }, statusDistribution: [], sprintProgress: [] },
      stats: { byStatus: { done: 2, in_progress: 1, blocked: 0 }, totalNodes: 10 },
      bottlenecks: { blockedTasks: [], missingAcceptanceCriteria: [], oversizedTasks: [] },
      healthScore: 72,
      knowledgeStats: { total: 5 },
      phaseDistribution: [],
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  };
}

describe("overview-tab (dashboard smoke)", () => {
  it("module imports without throwing", () => {
    expect(mod).toBeDefined();
  });
});

describe("<OverviewTab> — lifecycle health merge (Task 1.3)", () => {
  beforeEach(() => {
    mockedInsights.mockReset();
    mockedTrend.mockReset();
    mockedSnaps.mockReset();
  });

  it("renders the Lifecycle Health section heading", () => {
    mockedInsights.mockReturnValue(minimalInsights());
    mockedTrend.mockReturnValue({
      data: { window: 10, samples: 0, passed: 0, successRate: 0, latestPassedAll: null, summary: "" },
      loading: false,
      error: null,
    });
    mockedSnaps.mockReturnValue({ data: [], loading: false, error: null });

    const { OverviewTab } = mod;
    render(<OverviewTab />);
    expect(screen.getByRole("heading", { name: /lifecycle health/i })).toBeInTheDocument();
  });

  it("shows the rolling success rate from lifecycle hooks inside overview", () => {
    mockedInsights.mockReturnValue(minimalInsights());
    mockedTrend.mockReturnValue({
      data: { window: 10, samples: 4, passed: 3, successRate: 0.75, latestPassedAll: true, summary: "3/4 passed" },
      loading: false,
      error: null,
    });
    mockedSnaps.mockReturnValue({ data: [], loading: false, error: null });

    const { OverviewTab } = mod;
    render(<OverviewTab />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText(/3\/4 passed all 9 phases/i)).toBeInTheDocument();
  });

  it("still renders KPI cards from overview (AC1: both preserved)", () => {
    mockedInsights.mockReturnValue(minimalInsights());
    mockedTrend.mockReturnValue({
      data: { window: 10, samples: 0, passed: 0, successRate: 0, latestPassedAll: null, summary: "" },
      loading: false,
      error: null,
    });
    mockedSnaps.mockReturnValue({ data: [], loading: false, error: null });

    const { OverviewTab } = mod;
    render(<OverviewTab />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });
});
