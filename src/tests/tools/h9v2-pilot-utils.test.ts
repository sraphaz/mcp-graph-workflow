/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Tests for H9v2 pilot utilities: key loading (mask safety) and response extraction.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadApiKey, maskKey } from "../../../tools/h9v2-pilot/load-key.js";
import { extractFiles, latestPerPath } from "../../../tools/h9v2-pilot/extract.js";

describe("maskKey", () => {
  it("should show prefix and last 4 chars for long keys", () => {
    expect(maskKey("sk-or-v1-abcdef1234567890")).toBe("sk-...7890");
  });

  it("should return [REDACTED] for short input", () => {
    expect(maskKey("short")).toBe("[REDACTED]");
  });

  it("should never return the full key", () => {
    const key = "sk-or-v1-secret";
    const masked = maskKey(key);
    expect(masked).not.toBe(key);
    expect(masked).not.toContain("secret");
  });
});

describe("loadApiKey — file mode", () => {
  it("should load key from workflow-graph/key.txt when present", () => {
    const dir = mkdtempSync(join(tmpdir(), "h9v2-"));
    mkdirSync(join(dir, "workflow-graph"));
    writeFileSync(join(dir, "workflow-graph/key.txt"), "sk-or-v1-testkey12345\n");

    const result = loadApiKey(dir);

    expect(result.source).toBe("file");
    expect(result.value).toBe("sk-or-v1-testkey12345");
    expect(result.masked).toMatch(/^sk-\.\.\./);
    expect(result.masked).not.toContain("testkey");
  });

  it("should throw if key file is empty", () => {
    const dir = mkdtempSync(join(tmpdir(), "h9v2-"));
    mkdirSync(join(dir, "workflow-graph"));
    writeFileSync(join(dir, "workflow-graph/key.txt"), "   \n  ");

    expect(() => loadApiKey(dir)).toThrow(/empty/);
  });

  it("should throw descriptive error when no source available", () => {
    const dir = mkdtempSync(join(tmpdir(), "h9v2-"));
    const prev = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      expect(() => loadApiKey(dir)).toThrow(/key.txt/);
    } finally {
      if (prev) process.env.OPENROUTER_API_KEY = prev;
    }
  });
});

describe("extractFiles — filename+fence patterns", () => {
  it("should extract single file with bare filename line", () => {
    const response = `Here is the solution:

calibration.ts
\`\`\`ts
export const x = 1;
\`\`\`
`;
    const files = extractFiles(response);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("calibration.ts");
    expect(files[0].content).toBe("export const x = 1;");
  });

  it("should extract two files", () => {
    const response = `calibration.ts
\`\`\`ts
export const x = 1;
\`\`\`

calibration.test.ts
\`\`\`ts
test("x", () => {});
\`\`\`
`;
    const files = extractFiles(response);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.path)).toEqual(["calibration.ts", "calibration.test.ts"]);
  });

  it("should handle markdown header filename", () => {
    const response = `## calibration.ts
\`\`\`ts
export const y = 2;
\`\`\`
`;
    const files = extractFiles(response);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("calibration.ts");
  });

  it("should fallback to file-N.ts when no filename found", () => {
    const response = `Here's the code:
\`\`\`ts
export const z = 3;
\`\`\`
`;
    const files = extractFiles(response);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("file-1.ts");
    expect(files[0].content).toBe("export const z = 3;");
  });

  it("should return [] for empty response", () => {
    expect(extractFiles("")).toEqual([]);
    expect(extractFiles("no code here")).toEqual([]);
  });
});

describe("latestPerPath", () => {
  it("should keep latest version of each path", () => {
    const files = [
      { path: "a.ts", content: "v1" },
      { path: "b.ts", content: "v1" },
      { path: "a.ts", content: "v2" },
    ];
    const latest = latestPerPath(files);
    expect(latest).toHaveLength(2);
    const a = latest.find((f) => f.path === "a.ts")!;
    expect(a.content).toBe("v2");
  });
});
