/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JourneyRunsStore } from "../core/journey/journey-runs-store.js";
import { JourneyRunner, type StepExecutor, type OcrLike } from "../core/journey/journey-runner.js";
import type { JourneyMapFull } from "../core/journey/journey-store.js";
import type { JourneyRunEvent } from "../schemas/journey-run.schema.js";

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE journey_runs (
      id TEXT PRIMARY KEY,
      map_id TEXT NOT NULL,
      variant_id TEXT,
      node_id TEXT,
      prompt TEXT,
      plan TEXT NOT NULL,
      results TEXT NOT NULL DEFAULT '[]',
      verdict TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      finished_at INTEGER
    );
  `);
  return db;
}

const ts = "2026-04-22T00:00:00.000Z";

function fakeMap(): JourneyMapFull {
  return {
    id: "jmap_1", name: "Test", createdAt: ts, updatedAt: ts,
    screens: [
      { id: "s1", mapId: "jmap_1", title: "Landing", url: "https://a", screenType: "landing", positionX: 0, positionY: 0, createdAt: ts, updatedAt: ts },
      { id: "s2", mapId: "jmap_1", title: "Form",    url: "https://b", screenType: "form",    positionX: 0, positionY: 0, createdAt: ts, updatedAt: ts },
    ],
    edges: [
      { id: "e1", mapId: "jmap_1", from: "s1", to: "s2", type: "navigation", createdAt: ts },
    ],
    variants: [
      { id: "v1", mapId: "jmap_1", name: "happy", path: ["s1", "s2"], createdAt: ts },
    ],
  };
}

describe("JourneyRunner", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "journey-runner-"));
  });

  it("plans one navigate+screenshot pair per screen in the variant path", async () => {
    // Arrange
    const db = freshDb();
    const runs = new JourneyRunsStore(db, root);

    const execCalls: Array<{ helper: string; args: Record<string, unknown> }> = [];
    const executor: StepExecutor = async (helper, args) => {
      execCalls.push({ helper, args });
      if (helper === "screenshot") return { ok: true, base64: Buffer.from("png").toString("base64") };
      if (helper === "get_text") return { ok: true, text: "rich dom text content from the page here" };
      return { ok: true };
    };

    const runner = new JourneyRunner({ runs, executor });

    const events: JourneyRunEvent[] = [];
    runner.on((e) => events.push(e));

    // Act
    const result = await runner.run({ map: fakeMap(), variantId: "v1" });

    // Assert
    expect(result.verdict).toBe("pass");
    expect(result.plan).toHaveLength(4); // navigate+screenshot × 2 screens
    expect(result.plan.map((p) => p.helper)).toEqual(["navigate", "screenshot", "navigate", "screenshot"]);
    expect(execCalls.map((c) => c.helper)).toEqual(["navigate", "screenshot", "navigate", "screenshot"]);

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("plan");
    expect(types.filter((t) => t === "step")).toHaveLength(4);
    expect(types).toContain("verdict");
  });

  it("marks verdict=fail when any step fails", async () => {
    // Arrange
    const db = freshDb();
    const runs = new JourneyRunsStore(db, root);
    const executor: StepExecutor = async (helper) => {
      if (helper === "navigate") return { ok: true };
      return { ok: false, error: "screenshot crashed" };
    };
    const runner = new JourneyRunner({ runs, executor });

    // Act
    const result = await runner.run({ map: fakeMap(), variantId: "v1" });

    // Assert
    expect(result.verdict).toBe("fail");
    expect(result.results.some((r) => !r.ok)).toBe(true);
  });

  it("runs OCR on screenshots when DOM text is insufficient and emits ocr events", async () => {
    // Arrange
    const db = freshDb();
    const runs = new JourneyRunsStore(db, root);
    const executor: StepExecutor = async (helper) => {
      if (helper === "screenshot") return { ok: true, base64: Buffer.from("png").toString("base64") };
      return { ok: true };
    };
    const ocr: OcrLike = {
      recognise: async () => ({ text: "OCR recognised text", confidence: 95 }),
    };
    const runner = new JourneyRunner({ runs, executor, ocr });

    const events: JourneyRunEvent[] = [];
    runner.on((e) => events.push(e));

    // Act
    const result = await runner.run({ map: fakeMap(), variantId: "v1" });

    // Assert
    const ocrEvents = events.filter((e): e is Extract<JourneyRunEvent, { type: "ocr" }> => e.type === "ocr");
    expect(ocrEvents.length).toBeGreaterThan(0);
    expect(ocrEvents[0].text).toBe("OCR recognised text");

    const stepsWithOcr = result.results.filter((r) => r.ocrText !== null);
    expect(stepsWithOcr.length).toBeGreaterThan(0);
  });

  it("persists the run to the store with final verdict", async () => {
    // Arrange
    const db = freshDb();
    const runs = new JourneyRunsStore(db, root);
    const executor: StepExecutor = async () => ({ ok: true });
    const runner = new JourneyRunner({ runs, executor });

    // Act
    const result = await runner.run({ map: fakeMap(), variantId: "v1" });

    // Assert
    const persisted = runs.get(result.id);
    expect(persisted).not.toBeNull();
    expect(persisted?.verdict).toBe("pass");
    expect(persisted?.finishedAt).not.toBeNull();
  });

  it("when variantId is null, walks screens in map definition order", async () => {
    // Arrange
    const db = freshDb();
    const runs = new JourneyRunsStore(db, root);
    const executor: StepExecutor = async () => ({ ok: true });
    const runner = new JourneyRunner({ runs, executor });

    // Act
    const result = await runner.run({ map: fakeMap(), variantId: null });

    // Assert
    expect(result.variantId).toBeNull();
    expect(result.plan[0].screenId).toBe("s1");
    expect(result.plan[2].screenId).toBe("s2");
  });
});
