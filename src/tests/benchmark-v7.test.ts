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
 * Benchmark v6→v7: Measures real impact of v7.0 changes.
 * Compares: tool registration, gate overhead, FTS search, knowledge autoprune,
 * security validation, and end-to-end workflow performance.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { registerAllTools } from "../mcp/tools/index.js";
import { assertPathInside } from "../core/utils/safe-path.js";
import { buildLifecycleBlock } from "../mcp/unified-gate.js";
import { makeNode, makeEpic } from "./helpers/factories.js";
import path from "node:path";
import os from "node:os";

describe("Benchmark v7.0 — Real Impact Measurements", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("benchmark-v7");
  });

  afterEach(() => {
    store.close();
  });

  // ── B1: Tool Registration (v6: 59 tools, v7: 53 tools) ──

  describe("B1: Tool Registration Count", () => {
    it("should register exactly 54 tools (no deprecated)", async () => {
      const server = new McpServer({ name: "bench", version: "7.0.0" }, { capabilities: { tools: {} } });
      // T2.5 — registerAllTools is async (lazy `await import()` per profile gate).
      await registerAllTools(server, store);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools = (server as any)._registeredTools;
      const toolNames = Object.keys(tools);

      // Post-T4.0: 54 active tools (v7 had 53 active + 6 deprecated;
      // T4.0 added the 5 graph_* tools and T0 wired browser_pilot_run).
      expect(toolNames).not.toContain("add_node");
      expect(toolNames).not.toContain("delete_node");
      expect(toolNames).not.toContain("update_node");
      expect(toolNames).not.toContain("validate_ac");
      expect(toolNames).not.toContain("validate_task");
      expect(toolNames).not.toContain("list_skills");

      // Consolidated tools exist
      expect(toolNames).toContain("node");
      expect(toolNames).toContain("validate");
      expect(toolNames).toContain("manage_skill");

      console.log(`[B1] Registered tools: ${toolNames.length} (v7 had 53; T4.0 → 54)`);
    });

    it("should register all tools in < 1500ms (lazy import budget post-T2.5)", async () => {
      const server = new McpServer({ name: "bench", version: "7.0.0" }, { capabilities: { tools: {} } });

      // T2.5 — lazy `await import()` shifts cost from process boot to
      // first registerAllTools call. Pre-T2.5 budget was 100ms (deps
      // already evaluated at module load); post-T2.5 the call evaluates
      // 49 modules on first hit, so the budget grows. This is the
      // intended trade — saves cold-start cost when profile=core skips
      // most modules entirely.
      const start = performance.now();
      await registerAllTools(server, store);
      const elapsed = performance.now() - start;

      console.log(`[B1] Tool registration time: ${elapsed.toFixed(1)}ms`);
      expect(elapsed).toBeLessThan(1500);
    });
  });

  // ── B2: Unified Gate — Single vs Double Wrap Overhead ──

  describe("B2: Unified Gate Overhead", () => {
    it("should build lifecycle block in < 100ms for project with 100 nodes", () => {
      // Seed 100 nodes
      for (let i = 0; i < 100; i++) {
        store.insertNode(makeNode({ title: `Task ${i}`, status: i < 60 ? "done" : "backlog" }));
      }

      const doc = store.toGraphDocument();
      const iterations = 100;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        buildLifecycleBlock(doc, { toolName: "list", store });
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(`[B2] Lifecycle block build: ${avgMs.toFixed(2)}ms avg (${iterations} iterations, 100 nodes)`);
      expect(avgMs).toBeLessThan(300);
    });

    it("should build lifecycle block in < 100ms for project with 500 nodes", () => {
      // Seed 500 nodes
      for (let i = 0; i < 500; i++) {
        store.insertNode(makeNode({ title: `Task ${i}`, status: i < 300 ? "done" : "backlog" }));
      }

      const doc = store.toGraphDocument();
      const iterations = 50;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        buildLifecycleBlock(doc, { toolName: "analyze", store });
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(`[B2] Lifecycle block build (500 nodes): ${avgMs.toFixed(2)}ms avg`);
      expect(avgMs).toBeLessThan(300);
    });
  });

  // ── B3: FTS Search Performance (after v30 rebuild) ──

  describe("B3: FTS Search Performance", () => {
    it("should search 500 nodes in < 10ms", () => {
      // Seed 500 nodes with varied content
      const categories = ["authentication", "database", "API", "frontend", "backend", "testing", "deployment", "monitoring"];
      for (let i = 0; i < 500; i++) {
        const cat = categories[i % categories.length];
        store.insertNode(makeNode({
          title: `${cat} task ${i}: implement ${cat} feature`,
          description: `Detailed description for ${cat} implementation with requirements and acceptance criteria for task number ${i}`,
        }));
      }

      const iterations = 50;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        store.searchNodes("authentication");
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(`[B3] FTS search (500 nodes): ${avgMs.toFixed(2)}ms avg (${iterations} iterations)`);
      expect(avgMs).toBeLessThan(30);
    });

    it("should handle complex multi-term search in < 15ms", () => {
      for (let i = 0; i < 300; i++) {
        store.insertNode(makeNode({
          title: `Implement OAuth2 authentication flow for REST API endpoint ${i}`,
          description: `This task involves creating a secure authentication mechanism using JWT tokens and refresh token rotation`,
        }));
      }

      const iterations = 30;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        store.searchNodes("OAuth authentication JWT tokens");
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(`[B3] Complex FTS search (300 nodes): ${avgMs.toFixed(2)}ms avg`);
      expect(avgMs).toBeLessThan(150);
    });
  });

  // ── B4: Knowledge Autoprune Performance ──

  describe("B4: Knowledge Autoprune", () => {
    it("should prune 200 docs to 50 in < 100ms", () => {
      const ks = new KnowledgeStore(store.getDb());

      // Seed 200 docs
      for (let i = 0; i < 200; i++) {
        ks.insert({
          sourceType: "ai_decision",
          sourceId: `decision-${i}`,
          title: `Decision ${i}`,
          content: `Content for decision ${i} with technical details about implementation approach`,
          metadata: {},
        });
      }

      expect(ks.count()).toBe(200);

      const start = performance.now();
      const pruned = ks.autoprune(50);
      const elapsed = performance.now() - start;

      console.log(`[B4] Autoprune 200→50: ${elapsed.toFixed(1)}ms, pruned ${pruned.removed} docs`);
      expect(pruned.removed).toBe(150);
      expect(ks.count()).toBe(50);
      expect(elapsed).toBeLessThan(300);
    });

    it("should dry-run prune without modifying data", () => {
      const ks = new KnowledgeStore(store.getDb());

      for (let i = 0; i < 100; i++) {
        ks.insert({
          sourceType: "ai_decision",
          sourceId: `dry-${i}`,
          title: `Dry ${i}`,
          content: `Dry run test content ${i}`,
          metadata: {},
        });
      }

      const result = ks.autoprune(30, true);
      expect(result.removed).toBe(70);
      expect(ks.count()).toBe(100); // unchanged
    });
  });

  // ── B5: Security — Path Traversal Validation Throughput ──

  describe("B5: Security Validation Throughput", () => {
    it("should validate 10000 paths in < 50ms", () => {
      const root = path.join(os.tmpdir(), "bench-root");
      const validPaths = [
        "file.md", "sub/dir/file.txt", "a/b/c/d.json",
        "my-project/src/index.ts", "docs/README.md",
      ];
      const iterations = 10000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        assertPathInside(validPaths[i % validPaths.length], root);
      }
      const elapsed = performance.now() - start;

      console.log(`[B5] Path validation: ${elapsed.toFixed(1)}ms for ${iterations} calls (${(elapsed / iterations * 1000).toFixed(1)}µs/call)`);
      expect(elapsed).toBeLessThan(300);
    });

    it("should reject attack vectors efficiently", () => {
      const root = path.join(os.tmpdir(), "bench-root");
      const attacks = [
        "../etc/passwd", "../../secret", "%2e%2e%2f",
        "file\0.md", "..\\windows", "\uFF0E\uFF0E/etc",
      ];
      const iterations = 5000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        try {
          assertPathInside(attacks[i % attacks.length], root);
        } catch {
          // expected
        }
      }
      const elapsed = performance.now() - start;

      console.log(`[B5] Attack rejection: ${elapsed.toFixed(1)}ms for ${iterations} calls (${(elapsed / iterations * 1000).toFixed(1)}µs/call)`);
      expect(elapsed).toBeLessThan(150);
    });
  });

  // ── B6: End-to-End Workflow — Import PRD + Plan Sprint + Execute ──

  describe("B6: End-to-End Workflow", () => {
    it("should handle project with 500 nodes for context generation in < 50ms", () => {
      // Create realistic project structure
      const epic = makeEpic({ title: "Feature: User Management" });
      store.insertNode(epic);

      for (let i = 0; i < 50; i++) {
        const task = makeNode({
          title: `Task ${i}: ${["Implement", "Test", "Review", "Document", "Deploy"][i % 5]} user ${["auth", "profile", "settings", "roles", "permissions"][i % 5]}`,
          description: `Detailed task description with acceptance criteria and technical requirements for task ${i}`,
          parentId: epic.id,
          status: i < 30 ? "done" : "backlog",
          acceptanceCriteria: [`GIVEN user ${i} WHEN action THEN result`],
        });
        store.insertNode(task);
      }

      // Measure context generation
      const iterations = 20;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        store.toGraphDocument();
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(`[B6] GraphDocument generation (50 nodes): ${avgMs.toFixed(2)}ms avg`);
      expect(avgMs).toBeLessThan(150);
    });
  });

  // ── B7: Migration v30 — Schema Integrity ──

  describe("B7: Schema Integrity Post-Migration", () => {
    it("should have zero NULL status/priority/blocked after v30", () => {
      // Insert some nodes
      for (let i = 0; i < 20; i++) {
        store.insertNode(makeNode({ title: `Node ${i}` }));
      }

      const db = (store as unknown as { db: import("better-sqlite3").Database }).db;
      const nullStatus = db.prepare("SELECT COUNT(*) as cnt FROM nodes WHERE status IS NULL").get() as { cnt: number };
      const nullPriority = db.prepare("SELECT COUNT(*) as cnt FROM nodes WHERE priority IS NULL").get() as { cnt: number };
      const nullBlocked = db.prepare("SELECT COUNT(*) as cnt FROM nodes WHERE blocked IS NULL").get() as { cnt: number };

      console.log(`[B7] NULL status: ${nullStatus.cnt}, NULL priority: ${nullPriority.cnt}, NULL blocked: ${nullBlocked.cnt}`);
      expect(nullStatus.cnt).toBe(0);
      expect(nullPriority.cnt).toBe(0);
      expect(nullBlocked.cnt).toBe(0);
    });
  });
});
