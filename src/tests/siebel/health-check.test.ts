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
import { checkEnvironmentHealth } from "../../core/siebel/health-check.js";
import type { SiebelEnvironment } from "../../schemas/siebel.schema.js";

const ENV: SiebelEnvironment = {
  name: "dev",
  url: "http://localhost:9999",
  version: "15.0",
  type: "dev",
};

describe("health-check", () => {
  it("should return offline for unreachable host", async () => {
    const result = await checkEnvironmentHealth(ENV, { timeoutMs: 1000 });
    expect(result.status).toBe("offline");
    expect(result.environmentName).toBe("dev");
  });

  it("should include response time when available", async () => {
    const result = await checkEnvironmentHealth(ENV, { timeoutMs: 1000 });
    expect(result.responseTimeMs).toBeDefined();
    expect(typeof result.responseTimeMs).toBe("number");
  });

  it("should include error message on failure", async () => {
    const result = await checkEnvironmentHealth(ENV, { timeoutMs: 1000 });
    expect(result.error).toBeDefined();
  });

  it("should respect custom timeout", async () => {
    const start = Date.now();
    await checkEnvironmentHealth(ENV, { timeoutMs: 500 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });

  it("should use default timeout of 10s", async () => {
    // Just verify the function signature accepts no options
    const result = await checkEnvironmentHealth(ENV);
    expect(result.status).toBe("offline");
  });
});
