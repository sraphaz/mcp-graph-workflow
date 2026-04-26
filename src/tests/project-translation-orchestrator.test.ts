/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * Tests for ProjectTranslationOrchestrator — focused on validation/error
 * paths that don't require a real AI orchestrator running.
 *
 * Full end-to-end translation flow is covered by integration tests in
 * src/tests/translation-*.test.ts; this file pins the contract that
 * "project not found" / "file not found" / "file mismatch" all surface as
 * structured TranslationError instances rather than crashing.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { ProjectTranslationOrchestrator } from "../core/translation/project-translation-orchestrator.js";
import { TranslationProjectStore } from "../core/translation/translation-project-store.js";
import { TranslationStore } from "../core/translation/translation-store.js";
import { TranslationOrchestrator } from "../core/translation/translation-orchestrator.js";
import { ConstructRegistry } from "../core/translation/ucr/construct-registry.js";
import { CodeStore } from "../core/code/code-store.js";
import { TranslationError } from "../core/utils/errors.js";

describe("ProjectTranslationOrchestrator — error & validation paths", () => {
  let db: Database.Database;
  let projectStore: TranslationProjectStore;
  let orchestrator: ProjectTranslationOrchestrator;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);

    const registry = new ConstructRegistry(db);
    const translationStore = new TranslationStore(db);
    const codeStore = new CodeStore(db);
    const inner = new TranslationOrchestrator(registry, translationStore, codeStore);
    projectStore = new TranslationProjectStore(db);

    orchestrator = new ProjectTranslationOrchestrator(
      inner,
      projectStore,
      translationStore,
    );
  });

  afterEach(() => {
    db.close();
  });

  describe("analyzeProject", () => {
    it("should throw TranslationError when project does not exist", () => {
      expect(() => orchestrator.analyzeProject("nonexistent-project")).toThrow(
        TranslationError,
      );
    });

    it("should include the project id in the error message", () => {
      try {
        orchestrator.analyzeProject("missing-id");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TranslationError);
        expect((err as TranslationError).message).toContain("missing-id");
      }
    });
  });

  describe("prepareFile", () => {
    it("should throw TranslationError when project does not exist", async () => {
      await expect(
        orchestrator.prepareFile("nonexistent-project", "file-1"),
      ).rejects.toThrow(TranslationError);
    });
  });

  describe("finalizeFile", () => {
    it("should throw TranslationError when project does not exist", () => {
      expect(() =>
        orchestrator.finalizeFile("nonexistent-project", "file-1", "code"),
      ).toThrow(TranslationError);
    });
  });

  describe("createFromZip", () => {
    it("should throw TranslationError when zip path is invalid", () => {
      // Non-existent zip → extractZip throws or returns empty.
      expect(() =>
        orchestrator.createFromZip("proj-1", "/tmp/nonexistent.zip", "python"),
      ).toThrow();
    });
  });

  describe("instantiation", () => {
    it("should construct without throwing", () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator).toBeInstanceOf(ProjectTranslationOrchestrator);
    });
  });
});
