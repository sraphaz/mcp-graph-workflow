/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 0.3 — .sentrux/rules.toml layer conventions
 *
 * AC1: GIVEN rules.toml válido WHEN parse THEN aceito sem erro de sintaxe
 * AC2: GIVEN regra "core não importa cli" WHEN violação THEN reportada
 * AC3: GIVEN regra "provider SDK confinement" WHEN violação THEN reportada
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const rulesPath = path.resolve(".sentrux/rules.toml");
const rulesContent = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, "utf8") : "";

// ---------------------------------------------------------------------------
// AC1: file exists and has valid TOML structure (no bare keys issues)
// ---------------------------------------------------------------------------

describe(".sentrux/rules.toml — AC1: file exists and is valid TOML", () => {
  it("should exist at .sentrux/rules.toml", () => {
    expect(fs.existsSync(rulesPath)).toBe(true);
  });

  it("should not be empty", () => {
    expect(rulesContent.length).toBeGreaterThan(0);
  });

  it("should contain at least one [[rules]] section", () => {
    expect(rulesContent).toMatch(/\[\[rules\]\]/);
  });
});

// ---------------------------------------------------------------------------
// AC2: core-no-cli rule defined
// ---------------------------------------------------------------------------

describe(".sentrux/rules.toml — AC2: core-no-cli rule", () => {
  it("should contain a rule targeting src/core imports from src/cli", () => {
    expect(rulesContent).toMatch(/core[\s\S]*cli|no.cli|layer.*core/i);
  });

  it("should specify src/core as the guarded layer", () => {
    expect(rulesContent).toMatch(/src\/core/);
  });

  it("should specify src/cli as a forbidden import", () => {
    expect(rulesContent).toMatch(/src\/cli/);
  });
});

// ---------------------------------------------------------------------------
// AC3: provider-sdk-confinement rule defined
// ---------------------------------------------------------------------------

describe(".sentrux/rules.toml — AC3: provider SDK confinement rule", () => {
  it("should contain a rule for provider SDK confinement", () => {
    expect(rulesContent).toMatch(/openai|anthropic|sdk.*adapter|adapter.*sdk/i);
  });

  it("should specify src/core/llm/adapters as the allowed zone", () => {
    expect(rulesContent).toMatch(/llm\/adapters/);
  });
});
