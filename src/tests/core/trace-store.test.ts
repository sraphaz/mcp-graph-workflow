/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Story 5 subtask: Logger inclui trace.id e span.id via AsyncLocalStorage
 *
 * AC1: GIVEN runWithTrace active WHEN logger emits THEN entry.context includes trace.id
 * AC2: GIVEN runWithTrace active WHEN logger emits THEN entry.context includes span.id
 * AC3: GIVEN no runWithTrace WHEN logger emits THEN trace.id/span.id absent from context
 * AC4: GIVEN nested runWithTrace WHEN inner fn runs THEN inner traceId overrides outer
 */

import { describe, it, expect, beforeEach } from "vitest";
import { clearLogBuffer, getLogBuffer } from "../../core/utils/logger.js";
import { runWithTrace, getTraceContext } from "../../core/utils/trace-store.js";

beforeEach(() => {
  clearLogBuffer();
});

// ── AC1 + AC2: trace.id and span.id injected when runWithTrace is active ──────

describe("trace-store — AC1/AC2: trace.id and span.id injected into log entries", () => {
  it("AC1: log entry context contains trace.id equal to the active traceId", async () => {
    await runWithTrace("trace-abc", "span-xyz", async () => {
      const { logger } = await import("../../core/utils/logger.js");
      logger.info("test message");
    });

    const entries = getLogBuffer();
    const entry = entries.find((e) => e.message === "test message");
    expect(entry?.context?.["trace.id"]).toBe("trace-abc");
  });

  it("AC2: log entry context contains span.id equal to the active spanId", async () => {
    await runWithTrace("trace-111", "span-222", async () => {
      const { logger } = await import("../../core/utils/logger.js");
      logger.info("span test");
    });

    const entries = getLogBuffer();
    const entry = entries.find((e) => e.message === "span test");
    expect(entry?.context?.["span.id"]).toBe("span-222");
  });

  it("AC1+AC2: works with warn and error levels too", async () => {
    await runWithTrace("trace-warn", "span-warn", async () => {
      const { logger } = await import("../../core/utils/logger.js");
      logger.warn("warn message");
    });

    const entries = getLogBuffer();
    const entry = entries.find((e) => e.message === "warn message");
    expect(entry?.context?.["trace.id"]).toBe("trace-warn");
    expect(entry?.context?.["span.id"]).toBe("span-warn");
  });
});

// ── AC3: trace.id absent outside runWithTrace ─────────────────────────────────

describe("trace-store — AC3: trace.id absent without active context", () => {
  it("AC3: log entry has no trace.id when no runWithTrace active", async () => {
    const { logger } = await import("../../core/utils/logger.js");
    logger.info("no trace message");

    const entries = getLogBuffer();
    const entry = entries.find((e) => e.message === "no trace message");
    expect(entry?.context?.["trace.id"]).toBeUndefined();
    expect(entry?.context?.["span.id"]).toBeUndefined();
  });
});

// ── AC4: nested runWithTrace — inner scope overrides outer ────────────────────

describe("trace-store — AC4: nested runWithTrace inner scope overrides outer", () => {
  it("AC4: inner runWithTrace traceId shadows outer traceId", async () => {
    const innerEntries: Array<{ traceId: unknown }> = [];

    await runWithTrace("outer-trace", "outer-span", async () => {
      await runWithTrace("inner-trace", "inner-span", async () => {
        const ctx = getTraceContext();
        innerEntries.push({ traceId: ctx?.traceId });
      });
    });

    expect(innerEntries[0]?.traceId).toBe("inner-trace");
  });

  it("AC4: outer runWithTrace context is restored after inner exits", async () => {
    let outerTraceAfterInner: string | undefined;

    await runWithTrace("outer-trace", "outer-span", async () => {
      await runWithTrace("inner-trace", "inner-span", async () => {
        // inner scope
      });
      outerTraceAfterInner = getTraceContext()?.traceId;
    });

    expect(outerTraceAfterInner).toBe("outer-trace");
  });
});
