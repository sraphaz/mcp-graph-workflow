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
import { parseAc } from "../core/analyzer/ac-parser.js";

describe("parseAc", () => {
  it("should detect GWT format in English", () => {
    const result = parseAc("Given a user is logged in\nWhen they click logout\nThen they should be redirected");

    expect(result.format).toBe("gwt");
    expect(result.steps).toHaveLength(3);
    expect(result.steps![0].keyword).toBe("given");
    expect(result.steps![1].keyword).toBe("when");
    expect(result.steps![2].keyword).toBe("then");
  });

  it("should detect GWT format in Portuguese", () => {
    const result = parseAc("Dado que o usuário está logado\nQuando clica em sair\nEntão deve ser redirecionado");

    expect(result.format).toBe("gwt");
    expect(result.steps).toHaveLength(3);
    expect(result.steps![0].keyword).toBe("dado");
  });

  it("should detect checklist format", () => {
    const result = parseAc("- Item 1\n- Item 2\n- Item 3");

    expect(result.format).toBe("checklist");
    expect(result.steps).toBeUndefined();
  });

  it("should detect free_text format", () => {
    const result = parseAc("The system must handle errors gracefully");

    expect(result.format).toBe("free_text");
  });

  it("should detect testable AC with action verbs", () => {
    const result = parseAc("O sistema deve retornar status 200");

    expect(result.isTestable).toBe(true);
  });

  it("should detect non-testable AC", () => {
    const result = parseAc("A experiência do usuário é boa");

    expect(result.isTestable).toBe(false);
  });

  it("should detect measurable AC with numeric thresholds", () => {
    const result = parseAc("Response time must be under 200ms");

    expect(result.isMeasurable).toBe(true);
  });

  it("should detect non-measurable AC", () => {
    const result = parseAc("The page loads fast");

    expect(result.isMeasurable).toBe(false);
  });

  it("should handle GWT with And/But steps", () => {
    const result = parseAc("Given a user\nAnd they have admin role\nWhen they access settings\nThen they should see admin panel\nBut not billing section");

    expect(result.format).toBe("gwt");
    expect(result.steps).toHaveLength(5);
    expect(result.steps![1].keyword).toBe("and");
    expect(result.steps![4].keyword).toBe("but");
  });
});
