/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { detectSpecImpact, syncSpecToGraph } from "../core/spec-evolution/sync-engine.js";
import type { SpecStore } from "../core/spec-evolution/spec-store.js";

interface SpecRow {
  id: string;
  content_hash: string;
  version: number;
}

interface LinkRow {
  spec_id: string;
  section_title: string | null;
  node_id: string;
  link_type: string;
}

function makeSpecStore(specs: SpecRow[], links: Record<string, LinkRow[]>): SpecStore {
  const store = new Map(specs.map((s) => [s.id, s]));
  const fake = {
    get(specId: string): SpecRow | undefined {
      return store.get(specId);
    },
    update(specId: string, _content: string, _reason: string): void {
      const cur = store.get(specId);
      if (cur) {
        store.set(specId, { ...cur, content_hash: "newhash16char000", version: cur.version + 1 });
      }
    },
    getLinksForNode(nodeId: string): LinkRow[] {
      return links[nodeId] ?? [];
    },
  };
  return fake as unknown as SpecStore;
}

describe("detectSpecImpact", () => {
  it("returns empty when no nodes provided", () => {
    const store = makeSpecStore([], {});
    expect(detectSpecImpact(store, [])).toEqual([]);
  });

  it("returns empty when nodes have no spec links", () => {
    const store = makeSpecStore([], { n1: [] });
    expect(detectSpecImpact(store, ["n1"])).toEqual([]);
  });

  it("collects links across multiple changed nodes", () => {
    const store = makeSpecStore([], {
      n1: [{ spec_id: "spec-A", section_title: "Auth", node_id: "n1", link_type: "implements" }],
      n2: [{ spec_id: "spec-B", section_title: null, node_id: "n2", link_type: "validates" }],
    });
    const impacts = detectSpecImpact(store, ["n1", "n2"]);
    expect(impacts).toHaveLength(2);
    expect(impacts[0].specId).toBe("spec-A");
    expect(impacts[1].linkType).toBe("validates");
  });

  it("preserves null sectionTitle in the impact entry", () => {
    const store = makeSpecStore([], {
      n1: [{ spec_id: "s", section_title: null, node_id: "n1", link_type: "derived_from" }],
    });
    expect(detectSpecImpact(store, ["n1"])[0].sectionTitle).toBeNull();
  });
});

describe("syncSpecToGraph", () => {
  it("returns changed=false when spec is missing", () => {
    const store = makeSpecStore([], {});
    const result = syncSpecToGraph(store, "ghost", "any content");
    expect(result.changed).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it("returns changed=false when content hash matches", () => {
    // Pre-compute hash so we can match it
    const fixedHash = createHash("sha256").update("same content").digest("hex").slice(0, 16);
    const store = makeSpecStore([{ id: "s1", content_hash: fixedHash, version: 1 }], {});
    const result = syncSpecToGraph(store, "s1", "same content");
    expect(result.changed).toBe(false);
    expect(result.message).toMatch(/unchanged/);
  });

  it("returns changed=true with newVersion when content differs", () => {
    const store = makeSpecStore([{ id: "s2", content_hash: "old_hash_aaaaaaa", version: 3 }], {});
    const result = syncSpecToGraph(store, "s2", "new content");
    expect(result.changed).toBe(true);
    expect(result.newVersion).toBe(4);
    expect(result.message).toMatch(/version 4/);
  });

  it("does not throw on empty new content", () => {
    const store = makeSpecStore([{ id: "s3", content_hash: "x", version: 1 }], {});
    expect(() => syncSpecToGraph(store, "s3", "")).not.toThrow();
  });
});
