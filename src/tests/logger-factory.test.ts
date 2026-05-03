/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createLogger,
  logger,
  getLogBuffer,
  clearLogBuffer,
} from "../core/utils/logger.js";

describe("createLogger factory", () => {
  beforeEach(() => {
    clearLogBuffer();
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  it("AC1: returns object with all five methods", () => {
    const log = createLogger({ layer: "api", source: "routes/x.ts" });
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.success).toBe("function");
    expect(typeof log.debug).toBe("function");
  });

  it("AC2: tags every entry with layer + source merged with caller context", () => {
    const log = createLogger({ layer: "api", source: "routes/foo.ts" });
    log.info("hello", { reqId: "abc" });

    const entry = getLogBuffer().find((e) => e.message === "hello");
    expect(entry).toBeDefined();
    expect(entry?.context?.layer).toBe("api");
    expect(entry?.context?.source).toBe("routes/foo.ts");
    expect(entry?.context?.reqId).toBe("abc");
  });

  it("AC3: caller-supplied context.layer is overridden by factory layer", () => {
    const log = createLogger({ layer: "mcp", source: "tools/y.ts" });
    log.warn("nope", { layer: "core" as never });

    const entry = getLogBuffer().find((e) => e.message === "nope");
    expect(entry?.context?.layer).toBe("mcp");
  });

  it("AC4: caller-supplied context.source is overridden by factory source", () => {
    const log = createLogger({ layer: "rag", source: "rag/index.ts" });
    log.error("x", { source: "wrong/place.ts" });

    const entry = getLogBuffer().find((e) => e.message === "x");
    expect(entry?.context?.source).toBe("rag/index.ts");
  });

  it("AC2: also works with no caller context", () => {
    const log = createLogger({ layer: "cli", source: "cli/main.ts" });
    log.success("ok");

    const entry = getLogBuffer().find((e) => e.message === "ok");
    expect(entry?.context?.layer).toBe("cli");
    expect(entry?.context?.source).toBe("cli/main.ts");
  });

  it("AC5: legacy logger singleton still works without layer/source", () => {
    logger.info("legacy", { a: 1 });
    const entry = getLogBuffer().find((e) => e.message === "legacy");
    expect(entry).toBeDefined();
    expect(entry?.context?.a).toBe(1);
    expect(entry?.context?.layer).toBeUndefined();
    expect(entry?.context?.source).toBeUndefined();
  });
});
