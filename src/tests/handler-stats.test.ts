/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §HOOKS-INTEGRATION-PRD — handler-stats tests.
 */

import { describe, it, expect } from "vitest";
import {
  aggregateHandlerStats,
  type HandlerCallRecord,
} from "../core/hooks/handler-stats.js";

function rec(
  handlerId: string,
  durationMs: number,
  ok: boolean,
  ts = 0,
  errorMessage?: string,
): HandlerCallRecord {
  return { handlerId, durationMs, ok, ts, errorMessage };
}

describe("handler-stats (HOOKS observability)", () => {
  it("returns [] when no records", () => {
    expect(aggregateHandlerStats({ records: [] })).toEqual([]);
  });

  it("computes call_count + error_count per handler", () => {
    const stats = aggregateHandlerStats({
      records: [
        rec("a", 10, true),
        rec("a", 20, false, 1, "boom"),
        rec("a", 15, true),
        rec("b", 5, true),
      ],
    });
    const a = stats.find((s) => s.handlerId === "a")!;
    expect(a.callCount).toBe(3);
    expect(a.errorCount).toBe(1);
    const b = stats.find((s) => s.handlerId === "b")!;
    expect(b.callCount).toBe(1);
    expect(b.errorCount).toBe(0);
  });

  it("computes p50 and p95 durations", () => {
    const records: HandlerCallRecord[] = Array.from({ length: 20 }, (_, i) =>
      rec("h", (i + 1) * 10, true), // 10..200 ms
    );
    const [s] = aggregateHandlerStats({ records });
    expect(s.p50DurationMs).toBeCloseTo(110, -1);
    expect(s.p95DurationMs).toBeCloseTo(200, -1);
  });

  it("records last_error message + timestamp", () => {
    const stats = aggregateHandlerStats({
      records: [
        rec("h", 5, false, 1, "old"),
        rec("h", 8, false, 2, "newer"),
        rec("h", 3, true, 3),
      ],
    });
    const s = stats[0];
    expect(s.lastError).toBe("newer");
    expect(s.lastErrorTs).toBe(2);
  });

  it("lastError is null when no errors", () => {
    const stats = aggregateHandlerStats({
      records: [rec("h", 1, true), rec("h", 2, true)],
    });
    expect(stats[0].lastError).toBeNull();
    expect(stats[0].lastErrorTs).toBeNull();
  });

  it("uses circuit_state override per handler; defaults to 'closed'", () => {
    const stats = aggregateHandlerStats({
      records: [rec("a", 1, true), rec("b", 1, true)],
      circuitStates: { a: "open" },
    });
    expect(stats.find((s) => s.handlerId === "a")?.circuitState).toBe("open");
    expect(stats.find((s) => s.handlerId === "b")?.circuitState).toBe("closed");
  });

  it("sorts results by callCount DESC", () => {
    const stats = aggregateHandlerStats({
      records: [
        rec("low", 1, true),
        rec("high", 1, true),
        rec("high", 2, true),
        rec("high", 3, true),
        rec("mid", 1, true),
        rec("mid", 2, true),
      ],
    });
    expect(stats.map((s) => s.handlerId)).toEqual(["high", "mid", "low"]);
  });

  it("single handler with single call returns sane percentiles", () => {
    const stats = aggregateHandlerStats({
      records: [rec("x", 42, true)],
    });
    expect(stats[0].p50DurationMs).toBe(42);
    expect(stats[0].p95DurationMs).toBe(42);
  });
});
