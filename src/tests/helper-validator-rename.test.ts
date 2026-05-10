/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.4 — Renomear self-heal.ts → helper-validator.ts
 *
 * AC1: GIVEN rename WHEN grep `self-heal` em browser-harness/ THEN zero match
 * AC2: GIVEN doc cabeçalho WHEN lida THEN explicita validador de admissão para helpers
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "../..");
const BH = join(ROOT, "src/core/browser-harness");

function src(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

// ---------------------------------------------------------------------------
// AC1: self-heal.ts gone, helper-validator.ts present, barrel updated
// ---------------------------------------------------------------------------

describe("helper-validator rename — AC1: rename complete", () => {
  it("browser-harness/self-heal.ts is deleted", () => {
    expect(existsSync(join(BH, "self-heal.ts")), "self-heal.ts should not exist").toBe(false);
  });

  it("browser-harness/helper-validator.ts exists", () => {
    expect(existsSync(join(BH, "helper-validator.ts")), "helper-validator.ts should exist").toBe(true);
  });

  it("barrel index.ts exports from helper-validator (not self-heal)", () => {
    const barrel = src("src/core/browser-harness/index.ts");
    expect(barrel).toMatch(/helper-validator/);
    expect(barrel).not.toMatch(/self-heal/);
  });
});

// ---------------------------------------------------------------------------
// AC2: file header explains the validator purpose
// ---------------------------------------------------------------------------

describe("helper-validator rename — AC2: doc header updated", () => {
  it("helper-validator.ts header mentions validador de admissão para helpers", () => {
    const source = src("src/core/browser-harness/helper-validator.ts");
    expect(source).toMatch(/validador.*(admissão|admissao).*helper|helper.*validador.*(admissão|admissao)/i);
  });
});
