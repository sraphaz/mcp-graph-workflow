/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-local-model-hub — Task 4.2: model-hub-tab.tsx
 *
 * AC1: GIVEN backend MLX online THEN card aparece verde com lista de modelos
 * AC2: GIVEN inferência ativa WHEN running THEN spinner + tokens/s ao vivo
 * AC3: GIVEN backend offline WHEN visualizado THEN card vermelho com último erro
 * AC4: Testing Library role/text queries (sem snapshot — web.md)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModelHubTab } from "./model-hub-tab";

vi.mock("@/hooks/use-model-hub", () => ({
  useModelHub: vi.fn(),
}));

import { useModelHub } from "@/hooks/use-model-hub";
const mockedUseModelHub = vi.mocked(useModelHub);

const EMPTY_STATE = { backends: [], connected: false };

beforeEach(() => {
  mockedUseModelHub.mockReturnValue(EMPTY_STATE);
});

// ── AC1: Online backend shows green card with models ──────────────────────────

describe("ModelHubTab — AC1: online backend card", () => {
  it("AC1: renders backend id as heading", () => {
    mockedUseModelHub.mockReturnValue({
      backends: [
        { id: "mlx-server", status: "online", models: ["llama-3-8b"], inferenceRunning: false },
      ],
      connected: true,
    });
    render(<ModelHubTab />);
    expect(screen.getByText("mlx-server")).toBeDefined();
  });

  it("AC1: online badge has accessible label 'online'", () => {
    mockedUseModelHub.mockReturnValue({
      backends: [
        { id: "mlx-server", status: "online", models: [], inferenceRunning: false },
      ],
      connected: true,
    });
    render(<ModelHubTab />);
    expect(screen.getByRole("status", { name: /online/i })).toBeDefined();
  });

  it("AC1: model names appear in the card", () => {
    mockedUseModelHub.mockReturnValue({
      backends: [
        { id: "mlx-server", status: "online", models: ["llama-3-8b", "phi-3-mini"], inferenceRunning: false },
      ],
      connected: true,
    });
    render(<ModelHubTab />);
    expect(screen.getByText("llama-3-8b")).toBeDefined();
    expect(screen.getByText("phi-3-mini")).toBeDefined();
  });

  it("AC1: shows latency values when provided", () => {
    mockedUseModelHub.mockReturnValue({
      backends: [
        { id: "mlx-server", status: "online", models: [], latencyP50: 120, latencyP95: 340, inferenceRunning: false },
      ],
      connected: true,
    });
    render(<ModelHubTab />);
    expect(screen.getByText(/p50/i)).toBeDefined();
    expect(screen.getByText(/120/)).toBeDefined();
  });
});

// ── AC2: Running inference shows spinner + tokens/s ───────────────────────────

describe("ModelHubTab — AC2: inference running", () => {
  it("AC2: spinner is visible when inferenceRunning is true", () => {
    mockedUseModelHub.mockReturnValue({
      backends: [
        { id: "mlx-server", status: "online", models: [], inferenceRunning: true },
      ],
      connected: true,
    });
    render(<ModelHubTab />);
    expect(screen.getByRole("status", { name: /inferring|running|inference/i })).toBeDefined();
  });

  it("AC2: tokens/s throughput displayed when provided", () => {
    mockedUseModelHub.mockReturnValue({
      backends: [
        { id: "mlx-server", status: "online", models: [], inferenceRunning: true, tokensThroughput: 85 },
      ],
      connected: true,
    });
    render(<ModelHubTab />);
    expect(screen.getByText(/85/)).toBeDefined();
    expect(screen.getByText(/tok\/s|tokens\/s/i)).toBeDefined();
  });
});

// ── AC3: Offline backend shows red card with last error ───────────────────────

describe("ModelHubTab — AC3: offline backend card", () => {
  it("AC3: offline badge has accessible label 'offline'", () => {
    mockedUseModelHub.mockReturnValue({
      backends: [
        { id: "mlx-server", status: "offline", models: [], inferenceRunning: false },
      ],
      connected: true,
    });
    render(<ModelHubTab />);
    expect(screen.getByRole("status", { name: /offline/i })).toBeDefined();
  });

  it("AC3: last error message is shown for offline backend", () => {
    mockedUseModelHub.mockReturnValue({
      backends: [
        { id: "mlx-server", status: "offline", models: [], lastError: "connection refused", inferenceRunning: false },
      ],
      connected: true,
    });
    render(<ModelHubTab />);
    expect(screen.getByText(/connection refused/i)).toBeDefined();
  });
});

// ── AC4: Empty state ──────────────────────────────────────────────────────────

describe("ModelHubTab — AC4: empty state", () => {
  it("AC4: shows empty/no-backends message when no backends present", () => {
    mockedUseModelHub.mockReturnValue({ backends: [], connected: true });
    render(<ModelHubTab />);
    expect(screen.getByText(/no backends|sem backends|no backends detected/i)).toBeDefined();
  });
});
