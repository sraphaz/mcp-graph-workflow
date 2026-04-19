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
import { detectLanguageFromCode } from "../../core/translation/language-detect.js";

describe("davinci integration", () => {
  describe("language detection", () => {
    it("should detect davinci-js for module.exports with params pattern", () => {
      const code = `module.exports = a = async ({params}) => {
        const apiKey = "{{global.variables.apiKey}}";
        return { ok: true };
      }`;

      const result = detectLanguageFromCode(code);

      expect(result.languageId).toBe("davinci-js");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should detect davinci-js for code with global.variables", () => {
      const code = `module.exports = a = async ({params}) => {
        const url = "{{global.company.variables.baseUrl}}";
        const token = "{{global.flow.variables.flowToken}}";
        return { url, token };
      }`;

      const result = detectLanguageFromCode(code);

      expect(result.languageId).toBe("davinci-js");
    });

    it("should detect davinci-js for code with local node output", () => {
      const code = `module.exports = a = async ({params}) => {
        const userId = "{{local.httpNode.makeRequest.output.userId}}";
        return { userId };
      }`;

      const result = detectLanguageFromCode(code);

      expect(result.languageId).toBe("davinci-js");
    });

    it("should not detect davinci-js for plain JavaScript", () => {
      const code = `const x = 42; function foo() { return x * 2; }`;

      const result = detectLanguageFromCode(code);

      expect(result.languageId).not.toBe("davinci-js");
    });
  });
});
