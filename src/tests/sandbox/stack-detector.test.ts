import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectStack } from "../../core/sandbox/stack-detector.js";

describe("detectStack — Wave-12 Sandbox stack auto-detection", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "stack-det-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function touch(relative: string, content = "{}") {
    const full = path.join(dir, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }

  it("detects npm from package.json", () => {
    touch("package.json");
    const result = detectStack(dir);
    expect(result.stack).toBe("npm");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.evidence).toContain("package.json");
  });

  it("detects maven from pom.xml", () => {
    touch("pom.xml", "<project/>");
    expect(detectStack(dir).stack).toBe("maven");
  });

  it("detects gradle from build.gradle", () => {
    touch("build.gradle");
    expect(detectStack(dir).stack).toBe("gradle");
  });

  it("detects gradle from build.gradle.kts (Kotlin DSL)", () => {
    touch("build.gradle.kts");
    expect(detectStack(dir).stack).toBe("gradle");
  });

  it("detects go from go.mod", () => {
    touch("go.mod", "module example.com/x\n");
    expect(detectStack(dir).stack).toBe("go");
  });

  it("detects pip from requirements.txt", () => {
    touch("requirements.txt", "zod==1.0\n");
    expect(detectStack(dir).stack).toBe("pip");
  });

  it("detects pip from pyproject.toml", () => {
    touch("pyproject.toml", "[project]\nname='x'");
    expect(detectStack(dir).stack).toBe("pip");
  });

  it("detects pip from setup.py", () => {
    touch("setup.py", "from setuptools import setup");
    expect(detectStack(dir).stack).toBe("pip");
  });

  it("falls back to auto when no marker exists", () => {
    // empty dir
    const result = detectStack(dir);
    expect(result.stack).toBe("auto");
    expect(result.confidence).toBe(0);
    expect(result.evidence).toEqual([]);
  });

  it("prefers npm over maven when both exist (higher confidence marker)", () => {
    // polyglot repo — npm gets priority via marker specificity
    touch("package.json");
    touch("pom.xml", "<project/>");
    const result = detectStack(dir);
    expect(result.stack).toBe("npm");
    expect(result.evidence).toContain("package.json");
  });

  it("returns full confidence when lock file exists alongside manifest", () => {
    touch("package.json");
    touch("package-lock.json");
    const result = detectStack(dir);
    expect(result.stack).toBe("npm");
    expect(result.evidence).toContain("package-lock.json");
    expect(result.confidence).toBe(1);
  });

  it("throws a clear error when the directory does not exist", () => {
    expect(() => detectStack(path.join(dir, "missing"))).toThrow(/does not exist|not found/i);
  });
});
