/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §SprintE.5 — Destructive DB guard tests.
 */

import { describe, it, expect } from "vitest";
import {
  checkDestructiveDbIntent,
  DESTRUCTIVE_DB_CONFIRM_PHRASE,
} from "../core/hooks/destructive-db-guard.js";

describe("destructive-db-guard — pattern matching", () => {
  it.each([
    ["rm -rf workflow-graph", "rm workflow-graph"],
    ["rm -rf ./workflow-graph/", "rm workflow-graph"],
    ["rm workflow-graph/graph.db", "rm graph.db"],
    ["DROP TABLE nodes;", "DROP TABLE on mcp-graph table"],
    ["DROP TABLE IF EXISTS edges", "DROP TABLE on mcp-graph table"],
    ["DELETE FROM knowledge_documents;", "DELETE FROM mcp-graph table without WHERE"],
    ["TRUNCATE TABLE nodes", "TRUNCATE mcp-graph table"],
    ["mcp-graph init --force", "mcp-graph init --force/--reset/--wipe"],
    ["mcp-graph init --reset", "mcp-graph init --force/--reset/--wipe"],
    ["por favor apague o banco do mcp-graph", "PT-BR destructive intent against mcp-graph"],
    ["delete o grafo agora", "PT-BR destructive intent against mcp-graph"],
    ["resete o banco mcp-graph", "PT-BR destructive intent against mcp-graph"],
    ["wipe the mcp-graph database", "EN destructive intent against mcp-graph"],
  ])("blocks destructive intent: %s", (text, expectedLabel) => {
    const verdict = checkDestructiveDbIntent(text);
    expect(verdict.blocked).toBe(true);
    expect(verdict.matchedPattern).toBe(expectedLabel);
    expect(verdict.reason).toContain(DESTRUCTIVE_DB_CONFIRM_PHRASE);
  });

  it.each([
    "let me list workflow-graph contents",
    "please read the workflow-graph/graph.db schema",
    "SELECT * FROM nodes WHERE id = 'foo'",
    "UPDATE nodes SET status = 'done' WHERE id = ?",
    "implement next task",
    "rm /tmp/scratch.txt",
    "DROP TABLE temporary_scratch",
  ])("allows benign request: %s", (text) => {
    const verdict = checkDestructiveDbIntent(text);
    expect(verdict.blocked).toBe(false);
    expect(verdict.reason).toBeNull();
  });

  it("releases when the literal confirmation phrase is supplied", () => {
    const verdict = checkDestructiveDbIntent(
      "apague o banco mcp-graph",
      `${DESTRUCTIVE_DB_CONFIRM_PHRASE} please`,
    );
    expect(verdict.blocked).toBe(false);
  });

  it("releases when the confirmation phrase appears inside the prompt itself", () => {
    const verdict = checkDestructiveDbIntent(
      `apague o banco mcp-graph — ${DESTRUCTIVE_DB_CONFIRM_PHRASE}`,
    );
    expect(verdict.blocked).toBe(false);
  });

  it("does NOT release on a near-miss confirmation phrase", () => {
    const verdict = checkDestructiveDbIntent(
      "apague o banco mcp-graph",
      "confirmo apagar mcp-graph", // wrong case
    );
    expect(verdict.blocked).toBe(true);
  });

  it("returns a stable empty verdict on empty input", () => {
    expect(checkDestructiveDbIntent("")).toEqual({
      blocked: false,
      reason: null,
      matchedPattern: null,
    });
  });

  it("is idempotent — repeated calls give the same verdict", () => {
    const first = checkDestructiveDbIntent("rm -rf workflow-graph");
    const second = checkDestructiveDbIntent("rm -rf workflow-graph");
    expect(first).toEqual(second);
  });
});
