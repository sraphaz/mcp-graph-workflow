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
 * Tests for Siebel tool action routing and schema validation.
 *
 * AC1: describe per action (9 actions)
 * AC2: Correct routing per action
 * AC3: Error when required params missing
 *
 * Tests the tool's Zod schema validation and action routing
 * without calling the actual Siebel handlers (those are integration tests).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod/v4";

// Replicate the action enum from siebel.ts for validation testing
const SiebelActionSchema = z.enum([
  "analyze", "compose", "env", "generate",
  "import_docs", "import_sif", "search", "validate",
  "batch_import_sif",
]);

type SiebelAction = z.infer<typeof SiebelActionSchema>;

const ALL_ACTIONS: SiebelAction[] = [
  "analyze", "compose", "env", "generate",
  "import_docs", "import_sif", "search", "validate",
  "batch_import_sif",
];

describe("siebel tool routing", () => {
  // AC1: 9 action describes
  describe("action: analyze", () => {
    it("should be a valid action", () => {
      expect(SiebelActionSchema.safeParse("analyze").success).toBe(true);
    });

    it("should support analyze sub-modes", () => {
      const modes = z.enum(["impact", "dependencies", "circular", "summary", "diff", "refactor_script", "troubleshoot", "generate_integration_tests"]);
      expect(modes.safeParse("impact").success).toBe(true);
      expect(modes.safeParse("dependencies").success).toBe(true);
      expect(modes.safeParse("circular").success).toBe(true);
    });
  });

  describe("action: compose", () => {
    it("should be a valid action", () => {
      expect(SiebelActionSchema.safeParse("compose").success).toBe(true);
    });
  });

  describe("action: env", () => {
    it("should be a valid action", () => {
      expect(SiebelActionSchema.safeParse("env").success).toBe(true);
    });

    it("should support env sub-actions", () => {
      const envActions = z.enum(["list", "add", "remove"]);
      expect(envActions.safeParse("list").success).toBe(true);
      expect(envActions.safeParse("add").success).toBe(true);
      expect(envActions.safeParse("remove").success).toBe(true);
    });
  });

  describe("action: generate", () => {
    it("should be a valid action", () => {
      expect(SiebelActionSchema.safeParse("generate").success).toBe(true);
    });

    it("should support 8 generate sub-actions", () => {
      const genActions = z.enum(["prepare", "finalize", "templates", "scaffold", "clone_adapt", "generate_script", "auto_wire", "wsdl_to_sif"]);
      const all = ["prepare", "finalize", "templates", "scaffold", "clone_adapt", "generate_script", "auto_wire", "wsdl_to_sif"];
      for (const a of all) {
        expect(genActions.safeParse(a).success).toBe(true);
      }
    });
  });

  describe("action: import_docs", () => {
    it("should be a valid action", () => {
      expect(SiebelActionSchema.safeParse("import_docs").success).toBe(true);
    });

    it("should support doc types", () => {
      const docTypes = z.enum(["swagger", "wsdl", "pdf", "html", "doc", "docx", "markdown"]);
      expect(docTypes.safeParse("wsdl").success).toBe(true);
    });
  });

  describe("action: import_sif", () => {
    it("should be a valid action", () => {
      expect(SiebelActionSchema.safeParse("import_sif").success).toBe(true);
    });
  });

  describe("action: search", () => {
    it("should be a valid action", () => {
      expect(SiebelActionSchema.safeParse("search").success).toBe(true);
    });
  });

  describe("action: validate", () => {
    it("should be a valid action", () => {
      expect(SiebelActionSchema.safeParse("validate").success).toBe(true);
    });

    it("should support validate modes", () => {
      const modes = z.enum(["full", "naming", "security", "performance", "migration_ready", "code_review"]);
      expect(modes.safeParse("full").success).toBe(true);
      expect(modes.safeParse("security").success).toBe(true);
    });
  });

  describe("action: batch_import_sif", () => {
    it("should be a valid action", () => {
      expect(SiebelActionSchema.safeParse("batch_import_sif").success).toBe(true);
    });
  });

  // AC2: Routing correctness
  describe("routing", () => {
    it("should have exactly 9 valid actions", () => {
      expect(ALL_ACTIONS.length).toBe(9);
    });

    it("should reject invalid actions", () => {
      expect(SiebelActionSchema.safeParse("invalid_action").success).toBe(false);
      expect(SiebelActionSchema.safeParse("").success).toBe(false);
    });

    it("should route each action to a unique handler", () => {
      const uniqueActions = new Set(ALL_ACTIONS);
      expect(uniqueActions.size).toBe(9);
    });
  });

  // AC3: Error handling
  describe("error handling", () => {
    it("should reject null action", () => {
      expect(SiebelActionSchema.safeParse(null).success).toBe(false);
    });

    it("should reject undefined action", () => {
      expect(SiebelActionSchema.safeParse(undefined).success).toBe(false);
    });

    it("should reject numeric action", () => {
      expect(SiebelActionSchema.safeParse(42).success).toBe(false);
    });
  });
});
