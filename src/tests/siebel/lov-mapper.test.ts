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
import { mapLovDependencies } from "../../core/siebel/lov-mapper.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] }): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const OBJECTS: SiebelObject[] = [
  makeObj({ name: "Account BC", type: "business_component", children: [
    makeObj({ name: "SetField", type: "escript", parentName: "Account BC",
      properties: [{ name: "SOURCE_CODE", value: 'var val = TheApplication().InvokeMethod("LookupValue", "STATUS_TYPE", "Active");\nvar msg = TheApplication().InvokeMethod("LookupValue", "MSG_TYPE", "Error");' }, { name: "METHOD", value: "SetField" }],
    }),
  ]}),
  makeObj({ name: "Contact BC", type: "business_component", children: [
    makeObj({ name: "Validate", type: "escript", parentName: "Contact BC",
      properties: [{ name: "SOURCE_CODE", value: 'TheApplication().InvokeMethod("LookupValue", "STATUS_TYPE", "Inactive");' }, { name: "METHOD", value: "Validate" }],
    }),
  ]}),
];

describe("lov-mapper", () => {
  it("should map LOV types to dependent objects", () => {
    const result = mapLovDependencies(OBJECTS);
    const statusLov = result.lovTypes.find((l) => l.name === "STATUS_TYPE");
    expect(statusLov).toBeDefined();
    expect(statusLov!.dependents.length).toBe(2);
  });

  it("should list LOV values used", () => {
    const result = mapLovDependencies(OBJECTS);
    const statusLov = result.lovTypes.find((l) => l.name === "STATUS_TYPE");
    expect(statusLov!.values).toContain("Active");
    expect(statusLov!.values).toContain("Inactive");
  });

  it("should count total LOV types", () => {
    const result = mapLovDependencies(OBJECTS);
    expect(result.totalLovTypes).toBe(2); // STATUS_TYPE + MSG_TYPE
  });

  it("should handle empty input", () => {
    const result = mapLovDependencies([]);
    expect(result.lovTypes).toEqual([]);
    expect(result.totalLovTypes).toBe(0);
  });
});
