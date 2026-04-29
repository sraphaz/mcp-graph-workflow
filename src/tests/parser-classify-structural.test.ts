/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { isStructuralHeading } from "../core/parser/classify.js";

describe("isStructuralHeading", () => {
  it.each([
    "TIER A — Alto valor, gap real, recomendados para roadmap próximo (7 itens)",
    "TIER B — Útil, escopo focado, considerar após TIER A (8 itens)",
    "TIER C — Niche, requer investimento maior, avaliar caso-a-caso (6 itens)",
    "TIER D — Explicitamente fora de escopo (4 itens — não portar)",
  ])("marks TIER X — heading as structural: %s", (title) => {
    expect(isStructuralHeading(title)).toBe(true);
  });

  it.each([
    "Roadmap sugerido pós-MVP (após sprints 1-3)",
    "Princípio orientador da seleção",
    "Sequenciamento (4 sprints, ordem por dependência)",
    "Arquivos críticos a modificar (não só criar)",
  ])("marks nominal section heading as structural: %s", (title) => {
    expect(isStructuralHeading(title)).toBe(true);
  });

  it.each([
    "Subtarefas extraídas (3 itens)",
    "Critérios de aceite (5 items)",
    "Plano executivo (2 sprints)",
  ])("marks parenthetical-count suffix as structural: %s", (title) => {
    expect(isStructuralHeading(title)).toBe(true);
  });

  it.each([
    "Implementar autenticação OAuth",
    "TIER 1 routing logic",
    "Fix bug in cache invalidation",
    "Add metadata.implementable flag",
    "E4.T01 — hook-types.ts Zod (HookEvent/HookHandler/HookRegistration)",
    "Sprint 1 — implementar pipeline core",
    "criar endpoint /healthz",
  ])("does NOT mark implementable task as structural: %s", (title) => {
    expect(isStructuralHeading(title)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isStructuralHeading("")).toBe(false);
  });
});
