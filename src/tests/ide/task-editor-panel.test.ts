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
 * Task 11.3.2: Componente de editor open-source — node_3524c7b8e489
 * Structural source-inspection tests (no DOM env available in Vitest).
 *
 * AC1: syntax highlighting — Monaco language prop wired to supported languages.
 * AC2: find shortcut (Cmd+F / Ctrl+F) — opens Monaco find action.
 * AC3: dirty-state — visual indicator when content differs from initialValue.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COMPONENT_PATH = resolve(
  "src/web/dashboard/src/components/ide/task-editor-panel.tsx",
);

function source(): string {
  return readFileSync(COMPONENT_PATH, "utf-8");
}

// ── AC1: syntax highlighting ──────────────────────────────────────
describe("TaskEditorPanel — AC1: syntax highlighting", () => {
  it("should reference Monaco Editor", () => {
    const src = source();
    expect(src).toMatch(/@monaco-editor\/react|MonacoEditor|monaco-editor/);
  });

  it("should accept a language prop", () => {
    const src = source();
    expect(src).toMatch(/language[?]?\s*:\s*string/);
  });

  it("should pass language to the editor component", () => {
    const src = source();
    expect(src).toMatch(/language[=\s{]+\{?\s*language/);
  });

  it("should list supported languages including typescript and python", () => {
    const src = source();
    expect(src).toMatch(/typescript/);
    expect(src).toMatch(/python/);
  });
});

// ── AC2: find shortcut ────────────────────────────────────────────
describe("TaskEditorPanel — AC2: find shortcut", () => {
  it("should handle Cmd+F or Ctrl+F keyboard shortcut", () => {
    const src = source();
    expect(src).toMatch(/(?:MetaKey|ctrlKey|key.*F\b|actions\.find|find.*action)/i);
  });

  it("should expose a showFind or findOpen state or ref", () => {
    const src = source();
    expect(src).toMatch(/showFind|findOpen|findVisible|find.*State|actions\.find/i);
  });
});

// ── AC3: dirty state ──────────────────────────────────────────────
describe("TaskEditorPanel — AC3: dirty state", () => {
  it("should track dirty state when content differs from initialValue", () => {
    const src = source();
    expect(src).toMatch(/isDirty|dirty/i);
  });

  it("should show a visual dirty indicator", () => {
    const src = source();
    expect(src).toMatch(/isDirty|dirty.*indicator|dot.*dirty|dirty.*dot|●|unsaved/i);
  });

  it("should accept an initialValue prop", () => {
    const src = source();
    expect(src).toMatch(/initialValue[?]?\s*:/);
  });

  it("should accept an onChange callback prop", () => {
    const src = source();
    expect(src).toMatch(/onChange[?]?\s*:/);
  });
});
