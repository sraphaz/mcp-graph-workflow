/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectConfigDrift,
  installHooks,
  listInstalledHooks,
  uninstallHooks,
} from "./install.js";

describe("hook installer", () => {
  let tmp: string;
  const settingsPath = (dir: string) =>
    join(dir, ".claude", "settings.local.json");

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mg-hooks-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("installs the balanced profile by default", () => {
    const change = installHooks(tmp);
    expect(change.action).toBe("created");
    expect(existsSync(settingsPath(tmp))).toBe(true);

    const installed = listInstalledHooks(tmp);
    const events = installed.map((h) => h.event);
    expect(events).toContain("SessionStart");
    expect(events).toContain("PostToolUse");
    expect(events).toContain("Stop");
  });

  it("respects --profile minimal (only SessionStart)", () => {
    installHooks(tmp, { profile: "minimal" });
    const installed = listInstalledHooks(tmp);
    expect(installed).toHaveLength(1);
    expect(installed[0].event).toBe("SessionStart");
  });

  // ── Wave C1 ── PreToolUse hook ships with balanced + aggressive
  it("balanced installs the PreToolUse mcp-graph gate hook", () => {
    installHooks(tmp, { profile: "balanced" });
    const installed = listInstalledHooks(tmp);
    const preToolUse = installed.find((h) => h.event === "PreToolUse");
    expect(preToolUse).toBeDefined();
    expect(preToolUse!.matcher).toBe("mcp__mcp-graph__.*");
    expect(preToolUse!.command).toBe("mcp-graph hook pre-tool-use");
  });

  it("aggressive installs the PreToolUse mcp-graph gate hook", () => {
    installHooks(tmp, { profile: "aggressive" });
    const installed = listInstalledHooks(tmp);
    const preToolUse = installed.find((h) => h.event === "PreToolUse");
    expect(preToolUse).toBeDefined();
    expect(preToolUse!.matcher).toBe("mcp__mcp-graph__.*");
    expect(preToolUse!.command).toBe("mcp-graph hook pre-tool-use");
  });

  it("minimal does NOT install PreToolUse (gate-free profile)", () => {
    installHooks(tmp, { profile: "minimal" });
    const installed = listInstalledHooks(tmp);
    const preToolUse = installed.find((h) => h.event === "PreToolUse");
    expect(preToolUse).toBeUndefined();
  });

  it("respects --profile aggressive (more hooks)", () => {
    installHooks(tmp, { profile: "aggressive" });
    const installed = listInstalledHooks(tmp);
    const events = installed.map((h) => h.event);
    expect(events).toContain("UserPromptSubmit");
    expect(installed.length).toBeGreaterThan(4);
  });

  it("re-install is idempotent (replaces our entries, doesn't duplicate)", () => {
    installHooks(tmp);
    installHooks(tmp);
    installHooks(tmp);

    const installed = listInstalledHooks(tmp);
    const seen = new Set<string>();
    for (const h of installed) {
      const key = `${h.event}:${h.matcher ?? "*"}:${h.command}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("preserves user hooks (only strips our tagged entries on reinstall)", () => {
    mkdirSync(join(tmp, ".claude"), { recursive: true });
    writeFileSync(
      settingsPath(tmp),
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              { hooks: [{ type: "command", command: "user-custom" }] },
            ],
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    installHooks(tmp);
    const after = JSON.parse(readFileSync(settingsPath(tmp), "utf8"));
    const userHook = after.hooks.SessionStart.find(
      (h: { hooks: { command: string }[] }) =>
        h.hooks[0].command === "user-custom",
    );
    expect(userHook).toBeDefined();
  });

  it("uninstall removes only our tagged hooks", () => {
    mkdirSync(join(tmp, ".claude"), { recursive: true });
    writeFileSync(
      settingsPath(tmp),
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              { hooks: [{ type: "command", command: "user-custom" }] },
            ],
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    installHooks(tmp);
    uninstallHooks(tmp);

    const after = JSON.parse(readFileSync(settingsPath(tmp), "utf8"));
    expect(after.hooks.SessionStart).toHaveLength(1);
    expect(after.hooks.SessionStart[0].hooks[0].command).toBe("user-custom");
    expect(listInstalledHooks(tmp)).toEqual([]);
  });

  it("uninstall is a no-op when settings file does not exist", () => {
    const change = uninstallHooks(tmp);
    expect(change.action).toBe("skipped-noop");
  });

  it("listInstalledHooks returns [] for fresh project", () => {
    expect(listInstalledHooks(tmp)).toEqual([]);
  });

  describe("Sprint 7.4 #7.4.10 — config drift detection", () => {
    it("returns 'uninstalled' when settings file is missing", () => {
      const drift = detectConfigDrift(tmp);
      expect(drift.status).toBe("uninstalled");
      expect(drift.currentVersion).toBeTruthy();
      expect(drift.installedVersion).toBeUndefined();
    });

    it("returns 'uninstalled' when settings file has no mcp-graph hooks", () => {
      mkdirSync(join(tmp, ".claude"), { recursive: true });
      writeFileSync(
        settingsPath(tmp),
        JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: "echo unrelated" }] }] } }),
      );
      const drift = detectConfigDrift(tmp);
      expect(drift.status).toBe("uninstalled");
    });

    it("returns 'ok' immediately after install (versions match)", () => {
      installHooks(tmp, { profile: "balanced" });
      const drift = detectConfigDrift(tmp);
      expect(drift.status).toBe("ok");
      expect(drift.installedVersion).toBe(drift.currentVersion);
      expect(drift.installedProfile).toBe("balanced");
    });

    it("returns 'stale' with a re-install hint when installed version lags", () => {
      installHooks(tmp, { profile: "minimal" });
      // Hand-edit the persisted settings to simulate an older schema version
      // (this mirrors what would happen if the user upgraded the CLI without
      // re-running `mcp-graph hooks install`).
      const path = settingsPath(tmp);
      const settings = JSON.parse(readFileSync(path, "utf8")) as {
        hooks: Record<string, Array<{ __mg__?: { version: string } }>>;
      };
      for (const entries of Object.values(settings.hooks)) {
        for (const entry of entries) {
          if (entry.__mg__) entry.__mg__.version = "v0";
        }
      }
      writeFileSync(path, JSON.stringify(settings));
      const drift = detectConfigDrift(tmp);
      expect(drift.status).toBe("stale");
      expect(drift.installedVersion).toBe("v0");
      expect(drift.hint).toContain("mcp-graph hooks install");
      expect(drift.hint).toContain("--profile minimal");
    });
  });
});
