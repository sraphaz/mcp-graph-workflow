/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * TDD tests for the plan-payload contract (Task 4.1).
 *
 * The plan-payload is the wire format every MCP tool-braco (graph_materialize,
 * graph_validate_ui, graph_explore_web, graph_refresh_docs) returns instead
 * of executing side-effects directly. mcp-graph stays a maestro: the agent
 * client receives the plan and dispatches it to the named executor.
 *
 * Validates ACs:
 * - GIVEN payload valido WHEN parse THEN retorna typed PlanPayload
 * - GIVEN executor invalido WHEN parse THEN rejeita
 * - GIVEN steps array vazio WHEN parse THEN rejeita (deve ter ao menos 1 step)
 */

import { describe, it, expect } from "vitest";
import {
  PlanPayloadSchema,
  PlanExecutorSchema,
  PlanStepSchema,
  PostCallbackSchema,
  type PlanPayload,
  type PlanExecutor,
} from "../mcp/contracts/plan-payload.js";

function validPayload(): PlanPayload {
  return {
    executor: "native-write",
    steps: [{ tool: "Write", args: { file_path: "/tmp/x.md", content: "# x" } }],
    postCallback: { tool: "finish_task", args: { nodeId: "node_x" } },
    auditId: "audit_abc123",
    nodeId: "node_x",
  };
}

describe("PlanPayloadSchema", () => {
  it("AC1 — accepts a valid payload and returns typed PlanPayload", () => {
    const result = PlanPayloadSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
    if (result.success) {
      const typed: PlanPayload = result.data;
      expect(typed.executor).toBe("native-write");
      expect(typed.steps).toHaveLength(1);
      expect(typed.auditId).toBe("audit_abc123");
      expect(typed.nodeId).toBe("node_x");
    }
  });

  it("AC2 — rejects when executor is unknown", () => {
    const bad = { ...validPayload(), executor: "rogue-executor" };
    const result = PlanPayloadSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("AC2 — rejects when executor is missing", () => {
    const { executor: _executor, ...rest } = validPayload();
    void _executor;
    const result = PlanPayloadSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("AC3 — rejects when steps array is empty", () => {
    const bad = { ...validPayload(), steps: [] };
    const result = PlanPayloadSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      expect(issues.some((i) => i.path.join(".") === "steps")).toBe(true);
    }
  });

  it("AC3 — rejects when steps is missing", () => {
    const { steps: _steps, ...rest } = validPayload();
    void _steps;
    const result = PlanPayloadSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("postCallback is optional — payload parses without it", () => {
    const { postCallback: _postCallback, ...rest } = validPayload();
    void _postCallback;
    const result = PlanPayloadSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("rejects when auditId is empty", () => {
    const bad = { ...validPayload(), auditId: "" };
    const result = PlanPayloadSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects when nodeId is empty", () => {
    const bad = { ...validPayload(), nodeId: "" };
    const result = PlanPayloadSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("accepts steps with optional args (omitted)", () => {
    const payload = { ...validPayload(), steps: [{ tool: "Write" }] };
    const result = PlanPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects step with empty tool name", () => {
    const payload = { ...validPayload(), steps: [{ tool: "", args: {} }] };
    const result = PlanPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe("PlanExecutorSchema", () => {
  it("accepts the four maestro-surface executors", () => {
    const executors: PlanExecutor[] = ["native-write", "playwright", "browser-use", "context7"];
    for (const e of executors) {
      expect(PlanExecutorSchema.safeParse(e).success).toBe(true);
    }
  });

  it("rejects arbitrary string", () => {
    expect(PlanExecutorSchema.safeParse("rogue").success).toBe(false);
  });
});

describe("PlanStepSchema and PostCallbackSchema", () => {
  it("PlanStepSchema requires non-empty tool", () => {
    expect(PlanStepSchema.safeParse({ tool: "Write" }).success).toBe(true);
    expect(PlanStepSchema.safeParse({ tool: "" }).success).toBe(false);
  });

  it("PostCallbackSchema requires non-empty tool and accepts optional args", () => {
    expect(PostCallbackSchema.safeParse({ tool: "finish_task" }).success).toBe(true);
    expect(PostCallbackSchema.safeParse({ tool: "finish_task", args: { nodeId: "n_1" } }).success).toBe(true);
    expect(PostCallbackSchema.safeParse({ tool: "" }).success).toBe(false);
  });
});
