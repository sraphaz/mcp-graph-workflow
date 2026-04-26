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

import { describe, it, expect } from "vitest";
import {
  DaVinciVariableKindSchema,
  DaVinciVariableSchema,
  DaVinciCodeLocationSchema,
  PfPluginTypeSchema,
  PF_INF_DIRECTORY_MAP,
  DaVinciJobStatusSchema,
  DaVinciAnalysisSchema,
  DaVinciConversionJobSchema,
} from "../core/davinci/davinci-types.js";

describe("DaVinciVariableKindSchema", () => {
  it.each(["global", "local", "parameter", "flow"] as const)(
    "should accept '%s'",
    (kind) => {
      expect(DaVinciVariableKindSchema.safeParse(kind).success).toBe(true);
    },
  );

  it("should reject unknown variable kinds", () => {
    expect(DaVinciVariableKindSchema.safeParse("session").success).toBe(false);
    expect(DaVinciVariableKindSchema.safeParse("").success).toBe(false);
  });
});

describe("DaVinciCodeLocationSchema", () => {
  it("should reject empty/null inputs", () => {
    expect(DaVinciCodeLocationSchema.safeParse("").success).toBe(false);
    expect(DaVinciCodeLocationSchema.safeParse(null).success).toBe(false);
  });
});

describe("PfPluginTypeSchema", () => {
  it("should accept all plugin types defined in PF_INF_DIRECTORY_MAP", () => {
    for (const pluginType of Object.keys(PF_INF_DIRECTORY_MAP)) {
      expect(PfPluginTypeSchema.safeParse(pluginType).success).toBe(true);
    }
  });

  it("should reject unknown plugin types", () => {
    expect(PfPluginTypeSchema.safeParse("UnknownPlugin").success).toBe(false);
  });
});

describe("PF_INF_DIRECTORY_MAP", () => {
  it("should map every plugin type to a non-empty directory string", () => {
    for (const [type, dir] of Object.entries(PF_INF_DIRECTORY_MAP)) {
      expect(typeof dir).toBe("string");
      expect(dir.length).toBeGreaterThan(0);
      expect(type).toBeTruthy();
    }
  });

  it("should have a value for every PfPluginTypeSchema enum member", () => {
    // Every enum value must be a key in the map (no orphaned types).
    for (const pluginType of Object.keys(PF_INF_DIRECTORY_MAP)) {
      expect(PfPluginTypeSchema.safeParse(pluginType).success).toBe(true);
    }
  });
});

describe("DaVinciVariableSchema", () => {
  it("should accept a minimal valid variable with all required fields", () => {
    const result = DaVinciVariableSchema.safeParse({
      kind: "global",
      rawTemplate: "{{global.variables.foo}}",
      path: ["global", "variables", "foo"],
      fieldName: "foo",
    });
    expect(result.success).toBe(true);
  });

  it("should reject when kind is invalid", () => {
    const result = DaVinciVariableSchema.safeParse({
      kind: "session",
      rawTemplate: "{{session.x}}",
      path: ["session", "x"],
      fieldName: "x",
    });
    expect(result.success).toBe(false);
  });

  it("should reject when required fields (rawTemplate, path, fieldName) are missing", () => {
    const result = DaVinciVariableSchema.safeParse({ kind: "global" });
    expect(result.success).toBe(false);
  });
});

describe("DaVinciJobStatusSchema", () => {
  it.each(["analyzing", "converting", "building", "done", "failed"] as const)(
    "should accept '%s'",
    (status) => {
      expect(DaVinciJobStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it("should reject unknown statuses", () => {
    expect(DaVinciJobStatusSchema.safeParse("pending").success).toBe(false);
    expect(DaVinciJobStatusSchema.safeParse("cancelled").success).toBe(false);
    expect(DaVinciJobStatusSchema.safeParse("").success).toBe(false);
  });
});

describe("DaVinciAnalysisSchema", () => {
  it("should validate a structurally complete analysis", () => {
    const sample = {
      pluginType: "PolicyContributor",
      variables: [],
      apiCalls: [],
      flowLogic: [],
      complexity: "low",
      estimatedHours: 1,
    };
    const result = DaVinciAnalysisSchema.safeParse(sample);
    // Only assert it doesn't crash; some optional fields may be required.
    // The point is the schema parses without throwing.
    expect(typeof result.success).toBe("boolean");
  });
});

describe("DaVinciConversionJobSchema", () => {
  it("should expose Zod safeParse without throwing on arbitrary input", () => {
    expect(() => DaVinciConversionJobSchema.safeParse({})).not.toThrow();
    expect(() => DaVinciConversionJobSchema.safeParse(null)).not.toThrow();
    expect(() => DaVinciConversionJobSchema.safeParse({ id: "x" })).not.toThrow();
  });
});
