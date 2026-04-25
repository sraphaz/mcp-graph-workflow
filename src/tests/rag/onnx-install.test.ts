/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import {
  OnnxModelNotFoundError,
} from "../../core/utils/errors.js";
import {
  isOnnxAvailable,
  ensureOnnxModelDir,
} from "../../core/rag/onnx-embeddings.js";

describe("First-install experience", () => {
  describe("AC1 — model:download script is registered in package.json", () => {
    it("should have a model:download entry in package.json scripts", () => {
      const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as {
        scripts: Record<string, string>;
      };
      expect(pkg.scripts["model:download"]).toBeTruthy();
    });

    it("model:download script should reference the download tool", () => {
      const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as {
        scripts: Record<string, string>;
      };
      const script = pkg.scripts["model:download"];
      expect(script).toMatch(/download-model|model:download/i);
    });
  });

  describe("AC2 — workflow-graph/models/ auto-created before download", () => {
    it("should create the models directory if it does not exist", () => {
      const base = join(tmpdir(), `onnx-test-${Date.now()}`);
      const modelsDir = join(base, "workflow-graph", "models");

      try {
        expect(existsSync(modelsDir)).toBe(false);
        ensureOnnxModelDir(modelsDir);
        expect(existsSync(modelsDir)).toBe(true);
      } finally {
        rmSync(base, { recursive: true, force: true });
      }
    });

    it("should not throw when the models directory already exists", () => {
      const base = join(tmpdir(), `onnx-test-${Date.now()}`);
      const modelsDir = join(base, "workflow-graph", "models");
      mkdirSync(modelsDir, { recursive: true });

      try {
        expect(() => ensureOnnxModelDir(modelsDir)).not.toThrow();
      } finally {
        rmSync(base, { recursive: true, force: true });
      }
    });
  });

  describe("AC3 — OnnxModelNotFoundError message is actionable", () => {
    it("should contain 'npm run model:download' in the error message", () => {
      const err = new OnnxModelNotFoundError("/some/path/model.onnx");
      expect(err.message).toContain("npm run model:download");
    });

    it("should contain the missing model path in the error message", () => {
      const path = "/workflow-graph/models/model.onnx";
      const err = new OnnxModelNotFoundError(path);
      expect(err.message).toContain(path);
    });

    it("should have name OnnxModelNotFoundError", () => {
      const err = new OnnxModelNotFoundError("/path");
      expect(err.name).toBe("OnnxModelNotFoundError");
    });
  });

  describe("AC4 — isOnnxAvailable and getOnnxProvider contract", () => {
    it("should return a boolean from isOnnxAvailable", async () => {
      const result = await isOnnxAvailable();
      expect(typeof result).toBe("boolean");
    });

    it("isOnnxAvailable should be stable across multiple calls (cached)", async () => {
      const first = await isOnnxAvailable();
      const second = await isOnnxAvailable();
      expect(first).toBe(second);
    });
  });
});
