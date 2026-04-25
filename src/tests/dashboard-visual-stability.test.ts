/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 11.4.2: Performance e estabilidade visual
 * AC1 — Área principal não sofre saltos visuais significativos no carregamento inicial.
 * AC2 — Bundle inicial não inclui módulo completo do editor quando editor não está aberto.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(process.cwd(), "src/web/dashboard/src");

describe("AC1 — Layout stability: SkeletonPage fills container height", () => {
  const skeletonSource = readFileSync(
    resolve(ROOT, "components/layout/skeleton.tsx"),
    "utf-8",
  );

  it("should render SkeletonPage with h-full to prevent container height collapse", () => {
    expect(skeletonSource).toMatch(/SkeletonPage/);
    // SkeletonPage must use h-full so it matches the flex-1 parent height
    // preventing layout shift when content loads
    expect(skeletonSource).toMatch(/h-full/);
  });

  it("should have role=status on SkeletonPage for a11y", () => {
    expect(skeletonSource).toMatch(/role="status"/);
  });

  it("should have animate-pulse with motion-reduce override to respect preferences", () => {
    expect(skeletonSource).toMatch(/motion-reduce:animate-none/);
  });
});

describe("AC1 — Layout stability: App main area has stable dimensions", () => {
  const appSource = readFileSync(resolve(ROOT, "app/App.tsx"), "utf-8");

  it("should use flex-1 on main to take full available height", () => {
    expect(appSource).toMatch(/flex-1/);
  });

  it("should use overflow-hidden on main to prevent content overflow shift", () => {
    expect(appSource).toMatch(/overflow-hidden/);
  });

  it("should use Suspense with LoadingFallback to render skeleton during tab transitions", () => {
    expect(appSource).toMatch(/Suspense/);
    expect(appSource).toMatch(/LoadingFallback/);
  });
});

describe("AC2 — Editor lazy loading: Monaco not in initial bundle", () => {
  const editorPanelSource = readFileSync(
    resolve(ROOT, "components/ide/task-editor-panel.tsx"),
    "utf-8",
  );

  it("should import Monaco via React.lazy() to enable code splitting", () => {
    expect(editorPanelSource).toMatch(/lazy\s*</);
  });

  it("should wrap Monaco with Suspense to provide fallback while loading", () => {
    expect(editorPanelSource).toMatch(/Suspense/);
  });

  it("should use dynamic import() for @monaco-editor/react", () => {
    expect(editorPanelSource).toMatch(/import\(["']@monaco-editor\/react["']\)/);
  });

  it("should NOT statically import @monaco-editor/react at top level", () => {
    const staticImportPattern = /^import\s+.*from\s+["']@monaco-editor\/react["']/m;
    expect(editorPanelSource).not.toMatch(staticImportPattern);
  });
});

describe("AC2 — Editor lazy loading: TaskEditorPanel not eagerly imported by initial tabs", () => {
  const overviewSource = readFileSync(
    resolve(ROOT, "components/tabs/overview-tab.tsx"),
    "utf-8",
  );

  it("should not import TaskEditorPanel in overview-tab (initial visible tab)", () => {
    expect(overviewSource).not.toMatch(/task-editor-panel/);
    expect(overviewSource).not.toMatch(/TaskEditorPanel/);
  });

  it("App.tsx should load all tabs via React.lazy to defer editor tab chunks", () => {
    const appSource = readFileSync(resolve(ROOT, "app/App.tsx"), "utf-8");
    // All tab-level imports should be lazy
    const eagerTabImports = [...appSource.matchAll(/^import\s+\{[^}]*Tab\s*\}/gm)];
    expect(eagerTabImports).toHaveLength(0);
  });
});
