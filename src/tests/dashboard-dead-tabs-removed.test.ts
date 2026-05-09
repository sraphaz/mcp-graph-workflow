/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.2 — Deletar tabs mortas
 *
 * Structural tests verifying that tabs marked "delete" in docs/_internal/dashboard-audit.md
 * have been fully removed: file gone, nav-config clean, App.tsx clean.
 *
 * AC1: npm run build passes after deletion
 * AC2: deleted tab no longer referenced in routing / nav-config
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DASHBOARD_SRC = join(process.cwd(), "src/web/dashboard/src");

// ---------------------------------------------------------------------------
// gitnexus-tab — marked "delete" in dashboard-audit.md
// ---------------------------------------------------------------------------

describe("gitnexus-tab removed — AC1 & AC2", () => {
  it("gitnexus-tab.tsx file no longer exists", () => {
    const path = join(DASHBOARD_SRC, "components/tabs/gitnexus-tab.tsx");
    expect(existsSync(path)).toBe(false);
  });

  it("App.tsx does not import GitNexusTab", () => {
    const src = readFileSync(join(DASHBOARD_SRC, "app/App.tsx"), "utf-8");
    expect(src).not.toMatch(/gitnexus-tab/);
    expect(src).not.toMatch(/GitNexusTab/);
  });

  it("nav-config.ts does not include gitnexus id", () => {
    const src = readFileSync(
      join(DASHBOARD_SRC, "components/layout/nav-config.ts"),
      "utf-8"
    );
    expect(src).not.toMatch(/["']gitnexus["']/);
  });

  it("tab-nav.tsx does not include gitnexus in TabId", () => {
    const src = readFileSync(
      join(DASHBOARD_SRC, "components/layout/tab-nav.tsx"),
      "utf-8"
    );
    expect(src).not.toMatch(/["']gitnexus["']/);
  });
});
