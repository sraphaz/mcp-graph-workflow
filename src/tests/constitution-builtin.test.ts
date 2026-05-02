/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  handleConstitutionInstallBuiltin,
  handleConstitutionList,
} from "../mcp/tools/constitution.js";
import {
  getBuiltinConstitution,
  listBuiltinConstitutions,
  KARPATHY_BASELINE_NAME,
} from "../core/constitution/built-in-constitutions.js";

describe("Built-in constitutions", () => {
  describe("registry", () => {
    it("should expose karpathy-baseline as a built-in", () => {
      const names = listBuiltinConstitutions().map((c) => c.name);
      expect(names).toContain(KARPATHY_BASELINE_NAME);
    });

    it("should return karpathy-baseline with 4 principles", () => {
      const bundle = getBuiltinConstitution(KARPATHY_BASELINE_NAME);
      expect(bundle).toBeDefined();
      expect(bundle?.principles).toHaveLength(4);

      const ids = bundle?.principles.map((p) => p.id);
      expect(ids).toEqual([
        "karpathy-think",
        "karpathy-simplicity",
        "karpathy-surgical",
        "karpathy-goal-driven",
      ]);
    });

    it("should mark only karpathy-simplicity as enforceable", () => {
      const bundle = getBuiltinConstitution(KARPATHY_BASELINE_NAME);
      const enforceable = bundle?.principles.filter((p) => p.enforceable).map((p) => p.id);
      expect(enforceable).toEqual(["karpathy-simplicity"]);
    });

    it("should return undefined for unknown built-in name", () => {
      expect(getBuiltinConstitution("does-not-exist")).toBeUndefined();
    });
  });

  describe("handleConstitutionInstallBuiltin", () => {
    let store: SqliteStore;

    beforeEach(() => {
      store = SqliteStore.open(":memory:");
      store.initProject("Test");
    });

    afterEach(() => {
      store.close();
    });

    it("should install karpathy-baseline and index 4 principles", () => {
      const result = handleConstitutionInstallBuiltin(store, { name: KARPATHY_BASELINE_NAME });

      expect(result.ok).toBe(true);
      expect(result.nodeId).toBeDefined();
      expect(result.builtinName).toBe(KARPATHY_BASELINE_NAME);
      expect(result.principlesIndexed).toBe(4);
      expect(result.alreadyInstalled).toBe(false);
    });

    it("should be idempotent — re-install returns existing nodeId", () => {
      const first = handleConstitutionInstallBuiltin(store, { name: KARPATHY_BASELINE_NAME });
      const second = handleConstitutionInstallBuiltin(store, { name: KARPATHY_BASELINE_NAME });

      expect(second.nodeId).toBe(first.nodeId);
      expect(second.alreadyInstalled).toBe(true);

      const list = handleConstitutionList(store);
      expect(list.totalPrinciples).toBe(4);
    });

    it("should throw on unknown built-in name", () => {
      expect(() => handleConstitutionInstallBuiltin(store, { name: "unknown-bundle" })).toThrow(
        /unknown.*built-in/i,
      );
    });

    it("should make principles visible via handleConstitutionList grouped by category", () => {
      handleConstitutionInstallBuiltin(store, { name: KARPATHY_BASELINE_NAME });
      const list = handleConstitutionList(store);

      expect(list.totalPrinciples).toBe(4);
      expect(Object.keys(list.byCategory).sort()).toContain("behavioral");
    });
  });
});
