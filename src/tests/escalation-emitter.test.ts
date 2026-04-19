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
 * Escalation Emitter Tests — TDD
 *
 * Tests HITL escalation events emitted via GraphEventBus
 * when autopilot pauses or recovery exhausts retries.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GraphEventBus } from "../core/events/event-bus.js";
import type { GraphEvent } from "../core/events/event-types.js";
import {
  EscalationEmitter,
} from "../core/autonomy/escalation-emitter.js";

describe("escalation-emitter", () => {
  let bus: GraphEventBus;
  let emitter: EscalationEmitter;
  let captured: GraphEvent[];

  beforeEach(() => {
    bus = new GraphEventBus();
    emitter = new EscalationEmitter(bus);
    captured = [];
    bus.on("*", (event: GraphEvent) => {
      captured.push(event);
    });
  });

  describe("emitPause", () => {
    it("should emit autopilot:paused event via GraphEventBus", () => {
      emitter.emitPause("node-42", "Harness score below 70", { harnessScore: 55 });

      const event = captured.find((e) => e.type === "autopilot:paused");
      expect(event).toBeTruthy();
      expect(event?.payload.nodeId).toBe("node-42");
      expect(event?.payload.reason).toBe("Harness score below 70");
      expect(event?.payload.harnessScore).toBe(55);
    });
  });

  describe("emitEscalation", () => {
    it("should emit autopilot:escalation event with retry info", () => {
      emitter.emitEscalation("node-99", "Max retries exceeded", {
        attempts: 3,
        mttrMs: 42,
      });

      const event = captured.find((e) => e.type === "autopilot:escalation");
      expect(event).toBeTruthy();
      expect(event?.payload.nodeId).toBe("node-99");
      expect(event?.payload.attempts).toBe(3);
      expect(event?.payload.mttrMs).toBe(42);
    });
  });

  describe("emitRollback", () => {
    it("should emit autopilot:rollback event with MTTR-A", () => {
      emitter.emitRollback("node-77", true, 15);

      const event = captured.find((e) => e.type === "autopilot:rollback");
      expect(event).toBeTruthy();
      expect(event?.payload.nodeId).toBe("node-77");
      expect(event?.payload.success).toBe(true);
      expect(event?.payload.mttrMs).toBe(15);
    });
  });

  describe("getHistory", () => {
    it("should track all emitted escalation events", () => {
      emitter.emitPause("n1", "reason1", {});
      emitter.emitEscalation("n2", "reason2", { attempts: 2 });
      emitter.emitRollback("n3", true, 10);

      const history = emitter.getHistory();

      expect(history).toHaveLength(3);
      expect(history[0].type).toBe("pause");
      expect(history[1].type).toBe("escalation");
      expect(history[2].type).toBe("rollback");
    });
  });
});
