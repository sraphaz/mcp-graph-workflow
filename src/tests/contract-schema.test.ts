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
import { ContractSchema, ContractResultSchema } from "../schemas/contract-schema.js";

describe("ContractResultSchema", () => {
  it("should accept the minimal valid result", () => {
    expect(
      ContractResultSchema.safeParse({ claim: "tests pass", validated: true }).success,
    ).toBe(true);
  });

  it("should accept optional evidence string", () => {
    expect(
      ContractResultSchema.safeParse({
        claim: "all green",
        validated: true,
        evidence: "9100 tests passing",
      }).success,
    ).toBe(true);
  });

  it("should reject empty claim", () => {
    expect(ContractResultSchema.safeParse({ claim: "", validated: false }).success).toBe(false);
  });

  it("should reject non-boolean validated", () => {
    expect(
      ContractResultSchema.safeParse({ claim: "x", validated: "yes" }).success,
    ).toBe(false);
  });
});

describe("ContractSchema", () => {
  const baseContract = {
    taskId: "task-1",
    implementorClaims: ["I added the test"],
    validationCriteria: ["test must pass"],
    results: [],
  };

  it("should accept the minimal valid contract", () => {
    expect(ContractSchema.safeParse(baseContract).success).toBe(true);
  });

  it("should require at least one implementor claim", () => {
    expect(
      ContractSchema.safeParse({ ...baseContract, implementorClaims: [] }).success,
    ).toBe(false);
  });

  it("should require at least one validation criterion", () => {
    expect(
      ContractSchema.safeParse({ ...baseContract, validationCriteria: [] }).success,
    ).toBe(false);
  });

  it("should reject empty taskId", () => {
    expect(ContractSchema.safeParse({ ...baseContract, taskId: "" }).success).toBe(false);
  });

  it("should accept results array of ContractResults", () => {
    const result = ContractSchema.safeParse({
      ...baseContract,
      results: [
        { claim: "test added", validated: true },
        { claim: "test runs", validated: true, evidence: "stdout pass" },
      ],
    });
    expect(result.success).toBe(true);
  });
});
