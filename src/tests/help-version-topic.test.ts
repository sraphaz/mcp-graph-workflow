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
 * TDD: Version topic in help tool.
 * Validates that help(topic: "version") returns running binary version + drift-check guidance.
 */

import { describe, it, expect } from "vitest";
import { getVersionReference } from "../core/config/reference-content.js";
import { SERVICE_NAME, SERVICE_VERSION } from "../core/utils/ecs-formatter.js";

describe("help topic: version", () => {
  const content = getVersionReference();

  it("should return non-empty content", () => {
    expect(content.length).toBeGreaterThan(50);
  });

  it("should include the running package name", () => {
    expect(content).toContain(SERVICE_NAME);
  });

  it("should include the running version (semver)", () => {
    expect(content).toContain(SERVICE_VERSION);
    expect(content).toMatch(/\d+\.\d+\.\d+/);
  });

  it("should mention drift-check commands", () => {
    expect(content).toContain("mcp-graph --version");
    expect(content).toContain("npm view");
    expect(content).toContain("npm outdated");
  });

  it("should mention client restart requirement", () => {
    expect(content).toMatch(/restart|reinici/i);
  });
});
