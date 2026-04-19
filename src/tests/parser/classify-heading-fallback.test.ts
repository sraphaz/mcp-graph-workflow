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
import { classifySectionTitle } from "../../core/parser/classify.js";

describe("classifySectionTitle — heading-level fallback", () => {
  it("should return epic for h2 without keywords", () => {
    const result = classifySectionTitle("Sistema de Inventario", 2);
    expect(result.type).toBe("epic");
    expect(result.confidence).toBe(0.7);
  });

  it("should return task for h3 without keywords", () => {
    const result = classifySectionTitle("Servidor Autoritativo", 3);
    expect(result.type).toBe("task");
    expect(result.confidence).toBe(0.65);
  });

  it("should return subtask for h4 without keywords", () => {
    const result = classifySectionTitle("Subsistema X", 4);
    expect(result.type).toBe("subtask");
    expect(result.confidence).toBe(0.6);
  });

  it("should return subtask for h5 without keywords", () => {
    const result = classifySectionTitle("Detalhes internos", 5);
    expect(result.type).toBe("subtask");
    expect(result.confidence).toBe(0.6);
  });

  it("should still return risk when keyword matches (h2)", () => {
    const result = classifySectionTitle("Risco do Projeto", 2);
    expect(result.type).toBe("risk");
    expect(result.confidence).toBe(0.85);
  });

  it("should still return epic for h1 (existing behavior)", () => {
    const result = classifySectionTitle("Introdução", 1);
    expect(result.type).toBe("epic");
    expect(result.confidence).toBe(0.8);
  });

  it("should still match acceptance patterns over heading fallback", () => {
    const result = classifySectionTitle("Critérios de Aceite", 3);
    expect(result.type).toBe("acceptance_criteria");
    expect(result.confidence).toBe(0.9);
  });

  it("should still match requirement keyword over heading fallback", () => {
    const result = classifySectionTitle("Requisitos Funcionais", 2);
    expect(result.type).toBe("requirement");
    expect(result.confidence).toBe(0.9);
  });
});
