/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * SqliteStore hot-path bench — measures throughput of the read methods
 * called in inner loops by buildTaskContext, findNextTask, and toGraphDocument.
 * After the prepared-statement reuse migration (getStmt helper), each of these
 * should show a meaningful uplift vs a baseline that re-prepares per call.
 */

import { bench, describe } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

function seedStore(nodes: number, edgesPerNode: number): { store: SqliteStore; ids: string[] } {
  const store = SqliteStore.open(":memory:");
  store.initProject("Bench");
  const ids: string[] = [];
  for (let i = 0; i < nodes; i++) {
    const node = makeNode({
      title: `Task ${i}`,
      status: i % 4 === 0 ? "in_progress" : "backlog",
      parentId: i > 0 ? ids[Math.floor(i / 5)] : undefined,
    });
    store.insertNode(node);
    ids.push(node.id);
  }
  for (let i = 0; i < nodes; i++) {
    for (let j = 0; j < edgesPerNode && i + j + 1 < nodes; j++) {
      store.insertEdge(makeEdge(ids[i], ids[i + j + 1], { relationType: "depends_on" }));
    }
  }
  return { store, ids };
}

const { store: seeded, ids } = seedStore(500, 2);
const sampleNodeId = ids[42];
const sampleParentId = ids[10];

describe("SqliteStore hot-path reads", () => {
  bench("getAllNodes (500 nodes)", () => {
    seeded.getAllNodes();
  });

  bench("getNodesByStatus (in_progress)", () => {
    seeded.getNodesByStatus("in_progress");
  });

  bench("getNodeById", () => {
    seeded.getNodeById(sampleNodeId);
  });

  bench("getChildNodes", () => {
    seeded.getChildNodes(sampleParentId);
  });

  bench("getEdgesFrom", () => {
    seeded.getEdgesFrom(sampleNodeId);
  });

  bench("getEdgesTo", () => {
    seeded.getEdgesTo(sampleNodeId);
  });

  bench("getAllEdges", () => {
    seeded.getAllEdges();
  });

  bench("getStats", () => {
    seeded.getStats();
  });

  bench("toGraphDocument (500 nodes + ~1000 edges)", () => {
    seeded.toGraphDocument();
  });
});
