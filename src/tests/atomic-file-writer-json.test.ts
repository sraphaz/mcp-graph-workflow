/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-atomic-files-writer — Task 1.3: JSON writer tests
 *
 * AC1: GIVEN config JSON inexistente WHEN init THEN cria com _managedSchemaVersion: 1 + defaults
 * AC2: GIVEN config existe + key custom adicionada fora de _managedFields WHEN update THEN custom preservada
 * AC3: GIVEN usuário removeu key de _managedFields WHEN update THEN sistema NÃO toca essa key (opt-out usuário)
 * AC4: GIVEN escrita atômica WHEN testada THEN tmpfile + rename igual ao markdown writer
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { initJson, updateJson } from "../core/atomic-files/writer-json.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-graph-json-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── AC1: init creates file with _managedSchemaVersion: 1 + defaults ──────────

describe("WriterJson — AC1: init creates file", () => {
  it("AC1: creates file when it does not exist", () => {
    const filePath = path.join(tmpDir, "config.json");
    const defaults = { port: 3000, host: "localhost" };

    initJson(filePath, ["port", "host"], defaults);

    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("AC1: created file has _managedSchemaVersion: 1", () => {
    const filePath = path.join(tmpDir, "config.json");
    initJson(filePath, ["port"], { port: 8080 });

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(parsed._managedSchemaVersion).toBe(1);
  });

  it("AC1: created file has _managedFields listing managed keys", () => {
    const filePath = path.join(tmpDir, "config.json");
    initJson(filePath, ["port", "host", "backends"], { port: 8080, host: "0.0.0.0", backends: [] });

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(parsed._managedFields).toEqual(["port", "host", "backends"]);
  });

  it("AC1: created file has defaults written as top-level keys", () => {
    const filePath = path.join(tmpDir, "config.json");
    initJson(filePath, ["port", "host"], { port: 3000, host: "localhost" });

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(parsed.port).toBe(3000);
    expect(parsed.host).toBe("localhost");
  });

  it("AC1: init is noop if file already exists", () => {
    const filePath = path.join(tmpDir, "config.json");
    initJson(filePath, ["port"], { port: 3000 });

    // Manually change the file
    const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
    existing.port = 9999;
    fs.writeFileSync(filePath, JSON.stringify(existing), "utf8");

    // Re-init should NOT overwrite
    initJson(filePath, ["port"], { port: 3000 });

    const after = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(after.port).toBe(9999);
  });
});

// ── AC2: update preserves custom keys outside _managedFields ─────────────────

describe("WriterJson — AC2: update preserves custom keys", () => {
  it("AC2: custom key added outside _managedFields is preserved after update", () => {
    const filePath = path.join(tmpDir, "config.json");
    initJson(filePath, ["port"], { port: 3000 });

    // User adds a custom key outside managed scope
    const current = JSON.parse(fs.readFileSync(filePath, "utf8"));
    current.myCustomKey = "user-value";
    fs.writeFileSync(filePath, JSON.stringify(current), "utf8");

    updateJson(filePath, ["port"], { port: 4000 });

    const after = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(after.myCustomKey).toBe("user-value");
  });

  it("AC2: update replaces only keys listed in _managedFields", () => {
    const filePath = path.join(tmpDir, "config.json");
    initJson(filePath, ["port", "host"], { port: 3000, host: "localhost" });

    updateJson(filePath, ["port", "host"], { port: 4000, host: "0.0.0.0" });

    const after = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(after.port).toBe(4000);
    expect(after.host).toBe("0.0.0.0");
  });
});

// ── AC3: update respects user opt-out (removed key from _managedFields) ───────

describe("WriterJson — AC3: user opt-out via _managedFields removal", () => {
  it("AC3: key removed from _managedFields by user is not touched on update", () => {
    const filePath = path.join(tmpDir, "config.json");
    initJson(filePath, ["port", "host"], { port: 3000, host: "localhost" });

    // User removes "host" from _managedFields in the file (opt-out)
    const current = JSON.parse(fs.readFileSync(filePath, "utf8"));
    current._managedFields = ["port"]; // host removed by user
    current.host = "my-custom-host";
    fs.writeFileSync(filePath, JSON.stringify(current), "utf8");

    // Update with new values — but host should be untouched because file says only "port" is managed
    updateJson(filePath, ["port", "host"], { port: 5000, host: "new-host" });

    const after = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(after.host).toBe("my-custom-host");
    expect(after.port).toBe(5000);
  });
});

// ── AC4: atomic write (tmpfile + rename) ─────────────────────────────────────

describe("WriterJson — AC4: atomic write", () => {
  it("AC4: file is written atomically (no tmp file left behind)", () => {
    const filePath = path.join(tmpDir, "config.json");
    initJson(filePath, ["port"], { port: 3000 });

    // No tmp files should remain in the directory
    const files = fs.readdirSync(tmpDir);
    const tmpFiles = files.filter((f) => f.startsWith(".mcp-graph-tmp-"));
    expect(tmpFiles).toHaveLength(0);
  });

  it("AC4: file is valid JSON after update", () => {
    const filePath = path.join(tmpDir, "config.json");
    initJson(filePath, ["port"], { port: 3000 });
    updateJson(filePath, ["port"], { port: 9000 });

    expect(() => JSON.parse(fs.readFileSync(filePath, "utf8"))).not.toThrow();
  });
});
