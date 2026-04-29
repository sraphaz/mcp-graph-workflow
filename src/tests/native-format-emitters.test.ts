/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §HOOKS-MULTI-CLI-INTEGRATION-PRD — emitter tests.
 */

import { describe, it, expect } from "vitest";
import {
  emitCodex,
  emitOpenCode,
  emitCopilot,
  emitNative,
  type CanonicalHookSpec,
} from "../core/hooks/native-format-emitters.js";

const SAMPLE: CanonicalHookSpec[] = [
  {
    id: "codex-pretooluse-0",
    cli: "codex",
    event: "pretooluse",
    matcher: "Bash",
    command: ".claude/hooks/block-dangerous-git.sh",
  },
  {
    id: "opencode-posttooluse-0",
    cli: "opencode",
    event: "posttooluse",
    matcher: "Bash",
    command: ".claude/hooks/graph-wip-check.sh",
  },
  {
    id: "copilot-notification-0",
    cli: "copilot",
    event: "notification",
    command: "echo notify",
  },
  {
    id: "claude-pretooluse-0",
    cli: "claude",
    event: "pretooluse",
    command: ".claude/hooks/block-dangerous-git.sh",
  },
];

describe("native-format-emitters (HOOKS multi-cli bidirecionalidade)", () => {
  describe("emitCodex", () => {
    it("filters to cli=codex and maps event names", () => {
      const out = emitCodex(SAMPLE);
      expect(out.hooks).toHaveLength(1);
      expect(out.hooks[0].name).toBe("codex-pretooluse-0");
      expect(out.hooks[0].event).toBe("pre_tool");
      expect(out.hooks[0].matcher).toBe("Bash");
      expect(out.hooks[0].run).toBe(".claude/hooks/block-dangerous-git.sh");
    });

    it("omits matcher field when absent on canonical spec", () => {
      const out = emitCodex([
        { id: "x", cli: "codex", event: "stop", command: "echo done" },
      ]);
      expect(out.hooks[0]).not.toHaveProperty("matcher");
      expect(out.hooks[0].event).toBe("stop");
    });
  });

  describe("emitOpenCode", () => {
    it("filters to cli=opencode and maps event + key names", () => {
      const out = emitOpenCode(SAMPLE);
      expect(out.triggers).toHaveLength(1);
      expect(out.triggers[0].id).toBe("opencode-posttooluse-0");
      expect(out.triggers[0].on).toBe("after_tool");
      expect(out.triggers[0].pattern).toBe("Bash");
      expect(out.triggers[0].exec).toBe(".claude/hooks/graph-wip-check.sh");
    });

    it("notification event maps to 'notify' in OpenCode", () => {
      const out = emitOpenCode([
        { id: "n", cli: "opencode", event: "notification", command: "echo" },
      ]);
      expect(out.triggers[0].on).toBe("notify");
    });
  });

  describe("emitCopilot", () => {
    it("filters to cli=copilot and uses PascalCase events", () => {
      const out = emitCopilot(SAMPLE);
      expect(out.hooks).toHaveLength(1);
      expect(out.hooks[0].id).toBe("copilot-notification-0");
      expect(out.hooks[0].event).toBe("Notification");
      expect(out.hooks[0].command).toBe("echo notify");
    });

    it("preserves matcher when present", () => {
      const out = emitCopilot([
        {
          id: "c1", cli: "copilot", event: "pretooluse",
          matcher: "Bash", command: "echo",
        },
      ]);
      expect(out.hooks[0].matcher).toBe("Bash");
      expect(out.hooks[0].event).toBe("PreToolUse");
    });
  });

  describe("emitNative dispatch", () => {
    it("routes 'codex' format", () => {
      const out = emitNative(SAMPLE, "codex");
      expect("hooks" in out).toBe(true);
      const h = (out as { hooks: unknown[] }).hooks;
      expect(h).toHaveLength(1);
    });

    it("routes 'opencode' format", () => {
      const out = emitNative(SAMPLE, "opencode");
      expect("triggers" in out).toBe(true);
    });

    it("routes 'copilot' format", () => {
      const out = emitNative(SAMPLE, "copilot");
      expect("hooks" in out).toBe(true);
    });
  });

  it("does not include hooks from other CLIs (claude/cursor/aider/continue/cline)", () => {
    expect(emitCodex(SAMPLE).hooks).toHaveLength(1);
    expect(emitOpenCode(SAMPLE).triggers).toHaveLength(1);
    expect(emitCopilot(SAMPLE).hooks).toHaveLength(1);
    // The claude entry does NOT appear in any of the 3 outputs.
    const allIds = [
      ...emitCodex(SAMPLE).hooks.map((h) => h.name),
      ...emitOpenCode(SAMPLE).triggers.map((t) => t.id),
      ...emitCopilot(SAMPLE).hooks.map((h) => h.id),
    ];
    expect(allIds).not.toContain("claude-pretooluse-0");
  });

  it("returns empty container when no spec matches the chosen format", () => {
    expect(emitCodex([]).hooks).toEqual([]);
    expect(emitOpenCode([]).triggers).toEqual([]);
    expect(emitCopilot([]).hooks).toEqual([]);
  });
});
