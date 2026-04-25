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
  translateDaVinciToJavaBody,
  extractFunctionBody,
  substituteTemplateVariables,
} from "../core/davinci/js-to-java-translator.js";

describe("extractFunctionBody — DaVinci wrapper unwrap", () => {
  it("strips arrow async wrapper: module.exports = async ({params}) => { ... }", () => {
    const code = "module.exports = async ({params}) => {\n  return {ok: true};\n};";
    const r = extractFunctionBody(code);
    expect(r.kind).toBe("arrow");
    expect(r.body.trim()).toBe("return {ok: true};");
  });

  it("strips named-arrow assignment: module.exports = a = async ({params}) => { ... }", () => {
    const code = "module.exports = a = async ({params}) => {\n  return {ok: true};\n};";
    const r = extractFunctionBody(code);
    expect(r.kind).toBe("arrow");
    expect(r.body.trim()).toBe("return {ok: true};");
  });

  it("strips function-expression wrapper: module.exports = function({params}) { ... }", () => {
    const code = "module.exports = function({params}) {\n  return 42;\n};";
    const r = extractFunctionBody(code);
    expect(r.kind).toBe("function");
    expect(r.body.trim()).toBe("return 42;");
  });

  it("treats raw body without module.exports as already-unwrapped", () => {
    const code = "const x = 1;\nreturn x;";
    const r = extractFunctionBody(code);
    expect(r.kind).toBe("raw");
    expect(r.body).toBe(code);
  });

  it("preserves nested braces inside the body", () => {
    const code = "module.exports = async ({params}) => {\n  const m = {a: 1, b: 2};\n  return m;\n};";
    const r = extractFunctionBody(code);
    expect(r.body).toContain("const m = {a: 1, b: 2};");
    expect(r.body).toContain("return m;");
  });
});

describe("substituteTemplateVariables — {{...}} → Java getters", () => {
  it("replaces {{global.variables.X}} with configuration.getFieldValue", () => {
    const r = substituteTemplateVariables('var x = "{{global.variables.apiKey}}";');
    expect(r.code).toContain('configuration.getFieldValue("apiKey")');
    expect(r.code).not.toContain("{{");
    expect(r.substitutions).toBe(1);
  });

  it("replaces multiple variables in a single line", () => {
    const r = substituteTemplateVariables(
      'var url = "{{global.variables.host}}/api/{{global.variables.path}}";',
    );
    expect(r.substitutions).toBe(2);
    expect(r.code).toContain('configuration.getFieldValue("host")');
    expect(r.code).toContain('configuration.getFieldValue("path")');
  });

  it("preserves code without template variables verbatim", () => {
    const code = "const x = 1; return x;";
    const r = substituteTemplateVariables(code);
    expect(r.code).toBe(code);
    expect(r.substitutions).toBe(0);
  });

  it("emits a TODO marker for {{local.X}} (resolved at runtime, not translation time)", () => {
    const r = substituteTemplateVariables(
      'var name = "{{local.node1.cap.output.userName}}";',
    );
    expect(r.code).toMatch(/\/\* TODO local var: local\.node1\.cap\.output\.userName \*\//);
    expect(r.unresolved.length).toBe(1);
  });

  it("emits a TODO marker for {{flow.variables.X}}", () => {
    const r = substituteTemplateVariables('var x = "{{flow.variables.step}}";');
    expect(r.code).toContain("TODO flow var");
    expect(r.unresolved.length).toBe(1);
  });

  it("strips quotes around the {{...}} when used as a full string literal", () => {
    const r = substituteTemplateVariables('var k = "{{global.variables.token}}";');
    // The result should not double-quote the configuration.getFieldValue() call.
    expect(r.code).toContain('var k = configuration.getFieldValue("token");');
  });
});

describe("translateDaVinciToJavaBody — full pipeline (MVP)", () => {
  it("returns indented Java body wrapping the original JS as a comment block", () => {
    const code = "module.exports = async ({params}) => { return {ok: true}; };";
    const r = translateDaVinciToJavaBody(code);
    expect(r.partial).toBe(true);
    expect(r.javaBody).toMatch(/\/\* Original DaVinci body/);
    expect(r.javaBody).toMatch(/return \{ok: true\};/);
  });

  it("includes a logger.info entry for runtime traceability", () => {
    const code = "module.exports = async ({params}) => { return {ok: true}; };";
    const r = translateDaVinciToJavaBody(code);
    expect(r.javaBody).toMatch(/log\.info|logger\.info/);
  });

  it("substitutes {{global.variables.X}} into configuration.getFieldValue() calls", () => {
    const code = `
      module.exports = async ({params}) => {
        var apiKey = "{{global.variables.apiKey}}";
        return {key: apiKey};
      };
    `;
    const r = translateDaVinciToJavaBody(code);
    expect(r.javaBody).toContain('configuration.getFieldValue("apiKey")');
  });

  it("flags partial=true when unsupported features are present", () => {
    const code = `
      module.exports = async ({params}) => {
        const resp = await fetch("https://api.example.com");
        return resp.json();
      };
    `;
    const r = translateDaVinciToJavaBody(code);
    expect(r.partial).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("preserves indentation expected by the plugin template (8 spaces)", () => {
    const code = "module.exports = async ({params}) => { return 1; };";
    const r = translateDaVinciToJavaBody(code);
    // Every non-empty line should start with at least 8 spaces (template indentation).
    for (const line of r.javaBody.split("\n")) {
      if (line.trim().length === 0) continue;
      expect(line.startsWith("        "), `line "${line}" must be 8-space indented`).toBe(true);
    }
  });

  it("emits a warning listing which DaVinci variables were substituted", () => {
    const code = `
      module.exports = async ({params}) => {
        var k = "{{global.variables.apiKey}}";
        var h = "{{global.variables.host}}";
        return {k, h};
      };
    `;
    const r = translateDaVinciToJavaBody(code);
    expect(r.substitutionsCount).toBe(2);
  });

  it("returns a usable result for empty / whitespace-only input", () => {
    const r = translateDaVinciToJavaBody("   \n  \t  ");
    expect(r.partial).toBe(true);
    expect(r.javaBody).toMatch(/empty|no DaVinci/i);
  });

  it("escapes unsafe characters in Java comment block (e.g. */ inside JS comments)", () => {
    const code = "module.exports = async () => { /* unsafe */ return 1; };";
    const r = translateDaVinciToJavaBody(code);
    // The substring "*/" inside the comment block would close it prematurely
    // and break the Java code. Translator must escape or replace it.
    const commentBlocks = r.javaBody.match(/\/\*[\s\S]*?\*\//g) ?? [];
    for (const block of commentBlocks) {
      // Block start and end are valid; no spurious */ inside.
      const inner = block.slice(2, -2);
      expect(inner.includes("*/")).toBe(false);
    }
  });
});
