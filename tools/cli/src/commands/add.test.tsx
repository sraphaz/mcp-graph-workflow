/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  resetParentBridgeForTests,
  setParentRuntimeForTests,
} from "../core/parent-bridge.js";
import { runAdd } from "./add.js";

interface CapturedNode {
  id: string;
  type: string;
  title: string;
  status: string;
  priority: number;
  metadata?: { provenance?: { source: string; cmd: string; actor: string } };
  [k: string]: unknown;
}

function makeRuntime() {
  let inserted: CapturedNode | null = null;
  let closed = false;
  const runtime = {
    distRoot: "/fake",
    loadStore: async () => ({
      SqliteStore: {
        open: () => ({
          insertNode(node: CapturedNode) {
            inserted = node;
          },
          close: () => {
            closed = true;
          },
        }),
      },
    }),
    loadPlanner: async () => ({}),
    loadGraphTypes: async () => ({}),
  };
  return { runtime, get inserted() { return inserted; }, get closed() { return closed; } };
}

const baseCtx = {
  args: [],
  flags: {},
  mode: "shell" as const,
  traceId: "trace-XYZ",
};

describe("runAdd", () => {
  afterEach(() => resetParentBridgeForTests());

  it("rejects missing type with help text", async () => {
    setParentRuntimeForTests(makeRuntime().runtime);
    const result = await runAdd(baseCtx);
    expect(result.exitCode).toBe(2);
    expect(result.text).toContain("usage: mg add");
  });

  it("rejects unknown type", async () => {
    setParentRuntimeForTests(makeRuntime().runtime);
    const result = await runAdd({ ...baseCtx, args: ["banana"] });
    expect(result.exitCode).toBe(2);
    expect(result.text).toContain("unknown type");
  });

  it("rejects missing --title", async () => {
    setParentRuntimeForTests(makeRuntime().runtime);
    const result = await runAdd({ ...baseCtx, args: ["task"] });
    expect(result.exitCode).toBe(2);
    expect(result.text).toContain("--title is required");
  });

  it("creates a task and stamps provenance", async () => {
    const ctrl = makeRuntime();
    setParentRuntimeForTests(ctrl.runtime);

    const result = await runAdd({
      ...baseCtx,
      args: ["task"],
      flags: { title: "fix auth bug", priority: "2", xpSize: "S", json: true },
    });

    expect(result.exitCode).toBe(0);
    const json = result.json as { id: string; type: string; provenance: { cmd: string; source: string; actor: string } };
    expect(json.type).toBe("task");
    expect(json.provenance.source).toBe("cli");
    expect(json.provenance.cmd).toBe("mg add task");

    expect(ctrl.inserted?.title).toBe("fix auth bug");
    expect(ctrl.inserted?.priority).toBe(2);
    expect(ctrl.inserted?.metadata?.provenance?.source).toBe("cli");
    expect(ctrl.closed).toBe(true);
  });

  it("default priority is 3, default status is backlog", async () => {
    const ctrl = makeRuntime();
    setParentRuntimeForTests(ctrl.runtime);

    await runAdd({
      ...baseCtx,
      args: ["task"],
      flags: { title: "no flags task" },
    });

    expect(ctrl.inserted?.priority).toBe(3);
    expect(ctrl.inserted?.status).toBe("backlog");
  });

  it("rejects invalid xpSize", async () => {
    setParentRuntimeForTests(makeRuntime().runtime);
    const result = await runAdd({
      ...baseCtx,
      args: ["task"],
      flags: { title: "x", xpSize: "HUGE" },
    });
    expect(result.exitCode).toBe(2);
    expect(result.text).toContain("invalid xpSize");
  });

  it("rejects invalid status", async () => {
    setParentRuntimeForTests(makeRuntime().runtime);
    const result = await runAdd({
      ...baseCtx,
      args: ["task"],
      flags: { title: "x", status: "frozen" },
    });
    expect(result.exitCode).toBe(2);
    expect(result.text).toContain("invalid status");
  });

  it("parses --tags and --ac as comma-separated lists", async () => {
    const ctrl = makeRuntime();
    setParentRuntimeForTests(ctrl.runtime);

    await runAdd({
      ...baseCtx,
      args: ["epic"],
      flags: {
        title: "Q4 epic",
        tags: "infra, q4 ,roadmap",
        ac: "ships by Dec 31, no breaking changes",
      },
    });

    expect(ctrl.inserted?.tags).toEqual(["infra", "q4", "roadmap"]);
    const acs = ctrl.inserted?.acceptanceCriteria as string[] | undefined;
    expect(acs).toEqual(["ships by Dec 31", "no breaking changes"]);
  });

  it("stamps trace_id from the handler context", async () => {
    const ctrl = makeRuntime();
    setParentRuntimeForTests(ctrl.runtime);

    await runAdd({
      ...baseCtx,
      args: ["task"],
      flags: { title: "trace test" },
    });

    expect(ctrl.inserted?.metadata?.provenance?.source).toBe("cli");
    const prov = (ctrl.inserted?.metadata?.provenance ?? {}) as { trace_id?: string };
    expect(prov.trace_id).toBe("trace-XYZ");
  });
});
