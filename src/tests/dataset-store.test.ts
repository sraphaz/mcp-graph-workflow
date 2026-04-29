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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { DatasetStore } from "../core/observability/dataset-store.js";

describe("DatasetStore", () => {
  let db: Database.Database;
  let store: DatasetStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new DatasetStore(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("createDataset + getDataset round-trip", () => {
    it("should persist a dataset and return id matching dataset_<hex>", () => {
      const id = store.createDataset("eval-1", "manual");
      expect(id).toMatch(/^dataset_/);
    });

    it("should return null for non-existent dataset id", () => {
      expect(store.getDataset("does-not-exist")).toBeNull();
    });

    it("should retrieve dataset with name + source + entryCount=0 initially", () => {
      const id = store.createDataset("hello", "tests");
      const ds = store.getDataset(id);

      expect(ds).not.toBeNull();
      expect(ds?.name).toBe("hello");
      expect(ds?.source).toBe("tests");
      expect(ds?.entryCount).toBe(0);
    });
  });

  describe("addEntry", () => {
    it("should increment entryCount on the parent dataset after adding an entry", () => {
      const id = store.createDataset("counts", "manual");
      store.addEntry(id, { q: "what?" }, { a: "this" });

      const ds = store.getDataset(id);
      expect(ds?.entryCount).toBe(1);
    });

    it("should accept entries without expectedOutput", () => {
      const id = store.createDataset("no-output", "test");
      const entryId = store.addEntry(id, { x: 1 });

      expect(entryId).toMatch(/^entry_/);
      expect(store.getDataset(id)?.entryCount).toBe(1);
    });

    it("should preserve input/expectedOutput JSON via getEntries", () => {
      const id = store.createDataset("json-test", "test");
      store.addEntry(
        id,
        { question: "color?", n: 42 },
        { answer: "blue" },
        { source: "fixture" },
      );

      const entries = store.getEntries(id);
      expect(entries).toHaveLength(1);
      expect(entries[0].input).toEqual({ question: "color?", n: 42 });
      expect(entries[0].expectedOutput).toEqual({ answer: "blue" });
      expect(entries[0].metadata).toEqual({ source: "fixture" });
    });

    it("should return entries with null expectedOutput when none was provided", () => {
      const id = store.createDataset("nulls", "test");
      store.addEntry(id, { x: 1 });

      const entries = store.getEntries(id);
      expect(entries[0].expectedOutput).toBeNull();
    });
  });

  describe("getEntries", () => {
    it("should return empty array for empty dataset", () => {
      const id = store.createDataset("empty", "manual");
      expect(store.getEntries(id)).toEqual([]);
    });

    it("should return all entries for the dataset id (no cross-dataset leak)", () => {
      const ds1 = store.createDataset("ds1", "test");
      const ds2 = store.createDataset("ds2", "test");

      store.addEntry(ds1, { a: 1 });
      store.addEntry(ds1, { a: 2 });
      store.addEntry(ds2, { b: 1 });

      expect(store.getEntries(ds1)).toHaveLength(2);
      expect(store.getEntries(ds2)).toHaveLength(1);
    });
  });

  describe("getEntryCount", () => {
    it("should match the running total after multiple addEntry calls", () => {
      const id = store.createDataset("cnt", "test");
      for (let i = 0; i < 5; i++) {
        store.addEntry(id, { i });
      }
      expect(store.getEntryCount(id)).toBe(5);
    });
  });
});
