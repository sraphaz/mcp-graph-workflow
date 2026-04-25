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

import { describe, it, expect } from "vitest";
import { PlanPayloadSchema, type PlanPayload, EXECUTORS } from "../mcp/contracts/plan-payload.js";

describe("PlanPayloadSchema — V11 Maestro Phase 4.1", () => {
  describe("happy paths", () => {
    it("accepts a minimal native-write payload", () => {
      const payload: PlanPayload = {
        executor: "native-write",
        steps: [{ tool: "Write", args: { file_path: "/tmp/x.md", content: "hi" } }],
        auditId: "a-1",
        nodeId: "node_x",
      };
      const r = PlanPayloadSchema.safeParse(payload);
      expect(r.success).toBe(true);
    });

    it("accepts a payload with postCallback", () => {
      const payload: PlanPayload = {
        executor: "native-write",
        steps: [{ tool: "Write", args: { file_path: "/tmp/x.md", content: "hi" } }],
        postCallback: { tool: "finish_task", args: { nodeId: "node_x" } },
        auditId: "a-2",
        nodeId: "node_x",
      };
      const r = PlanPayloadSchema.safeParse(payload);
      expect(r.success).toBe(true);
    });

    it("accepts a multi-step playwright payload", () => {
      const payload: PlanPayload = {
        executor: "playwright",
        steps: [
          { tool: "browser_navigate", args: { url: "http://localhost:3000" } },
          { tool: "browser_snapshot", args: {} },
          { tool: "browser_console_messages", args: {} },
        ],
        auditId: "a-3",
        nodeId: "node_y",
      };
      const r = PlanPayloadSchema.safeParse(payload);
      expect(r.success).toBe(true);
    });

    it("accepts each declared executor", () => {
      for (const executor of EXECUTORS) {
        const payload: PlanPayload = {
          executor,
          steps: [{ tool: "x", args: {} }],
          auditId: "a",
          nodeId: "n",
        };
        expect(PlanPayloadSchema.safeParse(payload).success).toBe(true);
      }
    });
  });

  describe("rejection paths", () => {
    it("rejects an unknown executor", () => {
      const r = PlanPayloadSchema.safeParse({
        executor: "telepathy",
        steps: [{ tool: "x", args: {} }],
        auditId: "a",
        nodeId: "n",
      });
      expect(r.success).toBe(false);
    });

    it("rejects empty steps array", () => {
      const r = PlanPayloadSchema.safeParse({
        executor: "native-write",
        steps: [],
        auditId: "a",
        nodeId: "n",
      });
      expect(r.success).toBe(false);
    });

    it("rejects step missing tool name", () => {
      const r = PlanPayloadSchema.safeParse({
        executor: "native-write",
        steps: [{ args: {} }],
        auditId: "a",
        nodeId: "n",
      });
      expect(r.success).toBe(false);
    });

    it("rejects missing auditId", () => {
      const r = PlanPayloadSchema.safeParse({
        executor: "native-write",
        steps: [{ tool: "Write", args: {} }],
        nodeId: "n",
      });
      expect(r.success).toBe(false);
    });

    it("rejects missing nodeId", () => {
      const r = PlanPayloadSchema.safeParse({
        executor: "native-write",
        steps: [{ tool: "Write", args: {} }],
        auditId: "a",
      });
      expect(r.success).toBe(false);
    });

    it("rejects empty auditId or nodeId", () => {
      const r1 = PlanPayloadSchema.safeParse({
        executor: "native-write",
        steps: [{ tool: "Write", args: {} }],
        auditId: "",
        nodeId: "n",
      });
      expect(r1.success).toBe(false);
      const r2 = PlanPayloadSchema.safeParse({
        executor: "native-write",
        steps: [{ tool: "Write", args: {} }],
        auditId: "a",
        nodeId: "",
      });
      expect(r2.success).toBe(false);
    });
  });

  describe("EXECUTORS list integrity", () => {
    it("includes the 4 declared executors and only those", () => {
      const sorted = [...EXECUTORS].sort();
      expect(sorted).toEqual(["browser-use", "context7", "native-write", "playwright"]);
    });
  });
});
