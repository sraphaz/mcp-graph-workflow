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
  resolveLayeredConfig,
} from "../core/config/layered-config.js";

describe("4-layer configuration system", () => {
  describe("resolveLayeredConfig", () => {
    it("should return defaults when no overrides", () => {
      const result = resolveLayeredConfig({});
      expect(result.port.value).toBe(3000);
      expect(result.port.source).toBe("default");
    });

    it("should override default with project config", () => {
      const result = resolveLayeredConfig({
        projectConfig: { port: 4000 },
      });
      expect(result.port.value).toBe(4000);
      expect(result.port.source).toBe("project");
    });

    it("should override project with local config", () => {
      const result = resolveLayeredConfig({
        projectConfig: { port: 4000 },
        localConfig: { port: 5000 },
      });
      expect(result.port.value).toBe(5000);
      expect(result.port.source).toBe("local");
    });

    it("should override local with environment variables", () => {
      const result = resolveLayeredConfig({
        projectConfig: { port: 4000 },
        localConfig: { port: 5000 },
        envOverrides: { port: 6000 },
      });
      expect(result.port.value).toBe(6000);
      expect(result.port.source).toBe("env");
    });

    it("should skip missing layers without error", () => {
      const result = resolveLayeredConfig({
        envOverrides: { port: 9000 },
      });
      expect(result.port.value).toBe(9000);
      expect(result.port.source).toBe("env");
    });

    it("should track source for each field independently", () => {
      const result = resolveLayeredConfig({
        projectConfig: { port: 4000, contextMode: "full" },
        envOverrides: { port: 6000 },
      });
      expect(result.port.value).toBe(6000);
      expect(result.port.source).toBe("env");
      expect(result.contextMode.value).toBe("full");
      expect(result.contextMode.source).toBe("project");
    });

    it("should include dbPath and contextMode fields", () => {
      const result = resolveLayeredConfig({});
      expect(result.dbPath.value).toBe("workflow-graph");
      expect(result.dbPath.source).toBe("default");
      expect(result.contextMode.value).toBe("lean");
      expect(result.contextMode.source).toBe("default");
    });
  });
});
