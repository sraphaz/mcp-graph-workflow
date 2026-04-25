/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { makeTask } from "../helpers/factories.js";
import { smartDecomposeWithInvest } from "../../core/planner/smart-decompose.js";

let store: SqliteStore;

beforeEach(() => {
  store = SqliteStore.open(":memory:");
  store.initProject("Test");
});

afterEach(() => {
  store.close();
});

describe("smartDecomposeWithInvest", () => {
  describe("AC1 — XL task without AC generates S/M children with ≥2 ACs each", () => {
    it("should generate at least 2 child tasks when XL task has no AC", () => {
      const task = makeTask({ xpSize: "XL", title: "Build payment integration module" });
      store.insertNode(task);

      const result = smartDecomposeWithInvest(store, task.id);

      expect(result).not.toBeNull();
      expect(result!.accepted.length).toBeGreaterThanOrEqual(2);
    });

    it("should generate children with xpSize S or M", () => {
      const task = makeTask({ xpSize: "XL", title: "Build payment integration module" });
      store.insertNode(task);

      const result = smartDecomposeWithInvest(store, task.id);

      for (const child of result!.accepted) {
        expect(["S", "M"]).toContain(child.xpSize);
      }
    });

    it("should generate children with at least 2 ACs each", () => {
      const task = makeTask({ xpSize: "XL", title: "Build payment integration module" });
      store.insertNode(task);

      const result = smartDecomposeWithInvest(store, task.id);

      for (const child of result!.accepted) {
        expect(child.acceptanceCriteria.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("should also trigger for L tasks without AC", () => {
      const task = makeTask({ xpSize: "L", title: "Implement audit log" });
      store.insertNode(task);

      const result = smartDecomposeWithInvest(store, task.id);

      expect(result).not.toBeNull();
      expect(result!.accepted.length).toBeGreaterThanOrEqual(2);
    });

    it("should return null for S task without AC (not oversized)", () => {
      const task = makeTask({ xpSize: "S", title: "Fix null pointer" });
      store.insertNode(task);

      const result = smartDecomposeWithInvest(store, task.id);

      expect(result).toBeNull();
    });
  });

  describe("AC2 — child failing INVEST (not testable) is rejected with reason", () => {
    it("should reject proposed child with no testable AC", () => {
      const task = makeTask({
        xpSize: "XL",
        title: "Improve system performance",
        acceptanceCriteria: [
          "System runs faster",
          "Users are happy",
          "Works correctly overall",
        ],
      });
      store.insertNode(task);

      const result = smartDecomposeWithInvest(store, task.id);

      expect(result!.rejected.length).toBeGreaterThan(0);
      for (const rej of result!.rejected) {
        expect(rej.reasons.length).toBeGreaterThan(0);
      }
    });

    it("should include testable in rejection reason when AC has no GIVEN/WHEN/THEN or should", () => {
      const task = makeTask({
        xpSize: "XL",
        title: "Do everything",
        acceptanceCriteria: ["Works well", "All good"],
      });
      store.insertNode(task);

      const result = smartDecomposeWithInvest(store, task.id);
      const reasons = result!.rejected.flatMap((r) => r.reasons);

      expect(reasons.some((r: string) => (r as string).toLowerCase().includes("testable"))).toBe(true);
    });

    it("should keep accepted and rejected in separate lists", () => {
      const task = makeTask({
        xpSize: "XL",
        title: "Process checkout flow",
        acceptanceCriteria: [
          "GIVEN cart WHEN checkout clicked THEN order created",
          "GIVEN order WHEN payment confirmed THEN confirmation sent",
          "vague task with no structure",
        ],
      });
      store.insertNode(task);

      const result = smartDecomposeWithInvest(store, task.id);

      expect(result).not.toBeNull();
      const total = result!.accepted.length + result!.rejected.length;
      expect(total).toBeGreaterThan(0);
    });

    it("should accept children with testable ACs", () => {
      const task = makeTask({
        xpSize: "XL",
        title: "Build auth module",
        acceptanceCriteria: [
          "GIVEN user WHEN login THEN JWT issued",
          "GIVEN expired token WHEN request THEN 401 returned",
        ],
      });
      store.insertNode(task);

      const result = smartDecomposeWithInvest(store, task.id);

      expect(result!.accepted.length).toBeGreaterThan(0);
    });
  });

  describe("AC3 — decomposed_into edges created on success", () => {
    it("should produce decomposed_into edges for each accepted child", () => {
      const task = makeTask({
        xpSize: "XL",
        title: "Build auth module",
        acceptanceCriteria: [
          "GIVEN user WHEN login THEN JWT issued",
          "GIVEN expired token WHEN request THEN 401 returned",
        ],
      });
      store.insertNode(task);

      const result = smartDecomposeWithInvest(store, task.id);

      expect(result!.accepted.length).toBeGreaterThan(0);
      expect(result!.edges.length).toBeGreaterThanOrEqual(result!.accepted.length);
      for (const edge of result!.edges) {
        expect(edge.relation).toBe("decomposed_into");
      }
    });

    it("should set the parent as the edge source for all decomposed_into edges", () => {
      const task = makeTask({
        xpSize: "L",
        title: "Implement search",
        acceptanceCriteria: [
          "GIVEN query WHEN search runs THEN results ranked by score",
          "GIVEN empty query WHEN search runs THEN recent items returned",
        ],
      });
      store.insertNode(task);

      const result = smartDecomposeWithInvest(store, task.id);

      for (const edge of result!.edges) {
        expect(edge.from).toBe(task.id);
      }
    });

    it("should return no edges when all children are rejected", () => {
      const task = makeTask({
        xpSize: "XL",
        title: "Do magic",
        acceptanceCriteria: ["works", "good"],
      });
      store.insertNode(task);

      const result = smartDecomposeWithInvest(store, task.id);

      expect(result!.edges.length).toBe(0);
      expect(result!.accepted.length).toBe(0);
    });
  });
});
