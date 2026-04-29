/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.D5 — lessons consultant tests (D5 layer over D4 store).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import {
  buildLessonsContext,
  formatLessonsForContext,
  isLessonsConsultantDisabled,
  persistLesson,
} from "../core/autonomy/lessons-store.js";

describe("lessons-consultant (E22.D5)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("isLessonsConsultantDisabled respects MCP_GRAPH_LESSONS_CONSULTANT=off", () => {
    expect(isLessonsConsultantDisabled({ MCP_GRAPH_LESSONS_CONSULTANT: "off" })).toBe(true);
    expect(isLessonsConsultantDisabled({})).toBe(false);
  });

  it("formatLessonsForContext returns '' on empty list", () => {
    expect(formatLessonsForContext([])).toBe("");
  });

  it("formatLessonsForContext emits structured Past lessons block", () => {
    const text = formatLessonsForContext([
      {
        id: "l1",
        patternHash: "h1",
        description: "OAuth flow needs PKCE",
        recommendedAction: "use-pkce",
        confidence: 0.9,
        appliedCount: 3,
        source: "dream-wake",
        createdAt: "x",
        updatedAt: "x",
      },
    ]);
    expect(text).toContain("Past lessons:");
    expect(text).toContain("[use-pkce]");
    expect(text).toContain("OAuth flow");
    expect(text).toContain("conf=0.90");
  });

  it("formatLessonsForContext truncates beyond maxChars", () => {
    const long = {
      id: "l", patternHash: "h", description: "x".repeat(1500),
      recommendedAction: "y", confidence: 0.5, appliedCount: 1,
      source: "u", createdAt: "x", updatedAt: "x",
    };
    const text = formatLessonsForContext([long], 200);
    expect(text.length).toBeLessThanOrEqual(200);
    expect(text.endsWith("...")).toBe(true);
  });

  it("buildLessonsContext returns '' when toggle off", () => {
    persistLesson(db, {
      patternHash: "h1",
      description: "migration v76 retry queue",
      recommendedAction: "follow-pattern",
      confidence: 0.9,
    });
    expect(buildLessonsContext(db, "migration v76", 3, { MCP_GRAPH_LESSONS_CONSULTANT: "off" })).toBe("");
  });

  it("scenario: lesson on 'migration' + node 'migration v76' → injected", () => {
    persistLesson(db, {
      patternHash: "mig",
      description: "Migration patterns: always backward-compatible",
      recommendedAction: "ensure-bw-compat",
      confidence: 0.85,
    });
    const context = buildLessonsContext(db, "migration v76 retry queue", 3, {});
    expect(context).toContain("Past lessons:");
    expect(context).toContain("ensure-bw-compat");
  });

  it("returns top-K only (default 3) ordered by confidence", () => {
    for (let i = 0; i < 5; i++) {
      persistLesson(db, {
        patternHash: `auth-${i}`,
        description: `auth lesson ${i}`,
        recommendedAction: `act-${i}`,
        confidence: 0.5 + i * 0.1,
      });
    }
    const context = buildLessonsContext(db, "auth", 3, {});
    const lines = context.split("\n").slice(1);
    expect(lines.length).toBeLessThanOrEqual(3);
  });

  it("returns '' when no lesson matches the query", () => {
    persistLesson(db, {
      patternHash: "x",
      description: "completely unrelated topic",
      recommendedAction: "n",
      confidence: 0.5,
    });
    expect(buildLessonsContext(db, "deployment kubernetes", 3, {})).toBe("");
  });
});
