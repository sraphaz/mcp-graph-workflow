/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §HOOKS-MULTI-CLI-INTEGRATION-PRD — hook id scheme tests.
 */

import { describe, it, expect } from "vitest";
import {
  makeHookId,
  parseHookId,
  isValidHookId,
} from "../core/hooks/hook-id-scheme.js";

describe("hook-id-scheme", () => {
  describe("makeHookId", () => {
    it("emits cli-event-groupIndex when hookIndex absent", () => {
      expect(makeHookId({ cli: "codex", event: "notification", groupIndex: 0 }))
        .toBe("codex-notification-0");
    });

    it("emits cli-event-group-hook when hookIndex present", () => {
      expect(
        makeHookId({ cli: "claude", event: "pretooluse", groupIndex: 0, hookIndex: 0 }),
      ).toBe("claude-pretooluse-0-0");
    });

    it("supports compound event names with hyphens", () => {
      expect(
        makeHookId({ cli: "opencode", event: "subagent-stop", groupIndex: 2 }),
      ).toBe("opencode-subagent-stop-2");
    });

    it("rejects invalid cli", () => {
      expect(() => makeHookId({ cli: "Bad-CLI", event: "x", groupIndex: 0 })).toThrow(/cli/);
      expect(() => makeHookId({ cli: "", event: "x", groupIndex: 0 })).toThrow(/cli/);
    });

    it("rejects invalid event", () => {
      expect(() => makeHookId({ cli: "cli", event: "Bad", groupIndex: 0 })).toThrow(/event/);
      expect(() => makeHookId({ cli: "cli", event: "", groupIndex: 0 })).toThrow(/event/);
    });

    it("rejects negative or non-integer indexes", () => {
      expect(() => makeHookId({ cli: "cli", event: "ev", groupIndex: -1 })).toThrow(/groupIndex/);
      expect(() => makeHookId({ cli: "cli", event: "ev", groupIndex: 1.5 })).toThrow(/groupIndex/);
      expect(() => makeHookId({ cli: "cli", event: "ev", groupIndex: 0, hookIndex: -1 }))
        .toThrow(/hookIndex/);
    });
  });

  describe("parseHookId", () => {
    it("parses 3-segment id with no hookIndex", () => {
      expect(parseHookId("codex-notification-0")).toEqual({
        cli: "codex",
        event: "notification",
        groupIndex: 0,
      });
    });

    it("parses 4-segment id with hookIndex", () => {
      expect(parseHookId("claude-pretooluse-0-0")).toEqual({
        cli: "claude",
        event: "pretooluse",
        groupIndex: 0,
        hookIndex: 0,
      });
    });

    it("parses compound event name", () => {
      expect(parseHookId("opencode-subagent-stop-2")).toEqual({
        cli: "opencode",
        event: "subagent-stop",
        groupIndex: 2,
      });
    });

    it("returns undefined on invalid id", () => {
      expect(parseHookId("")).toBeUndefined();
      expect(parseHookId("invalid")).toBeUndefined();
      expect(parseHookId("CLI-event-0")).toBeUndefined();
    });
  });

  describe("round-trip", () => {
    it("makeHookId(parseHookId(id)) === id for canonical ids", () => {
      const ids = [
        "claude-pretooluse-0-0",
        "codex-notification-0",
        "opencode-subagent-stop-2",
        "copilot-stop-7",
      ];
      for (const id of ids) {
        const parts = parseHookId(id)!;
        expect(makeHookId(parts)).toBe(id);
      }
    });
  });

  describe("isValidHookId", () => {
    it("returns true for canonical ids and false for malformed ones", () => {
      expect(isValidHookId("claude-pretooluse-0-0")).toBe(true);
      expect(isValidHookId("codex-notification-0")).toBe(true);
      expect(isValidHookId("CLAUDE-x-0")).toBe(false);
      expect(isValidHookId("missing-index")).toBe(false);
    });
  });
});
