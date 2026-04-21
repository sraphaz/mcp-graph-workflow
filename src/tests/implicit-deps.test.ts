/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { detectImplicitDeps } from "../core/pipeline/implicit-deps.js";

describe("detectImplicitDeps", () => {
  it("should return empty array when no files provided", () => {
    const result = detectImplicitDeps([]);
    expect(result).toEqual([]);
  });

  it("should return empty array when single file has no shared imports with others", () => {
    const fileContents: Record<string, string> = {
      "src/a.ts": `import { foo } from "./unique-a.js";\nexport const a = foo();`,
      "src/b.ts": `import { bar } from "./unique-b.js";\nexport const b = bar();`,
    };
    const result = detectImplicitDeps(Object.keys(fileContents), fileContents);
    expect(result).toEqual([]);
  });

  it("should surface warning when two touched files share a common import", () => {
    const fileContents: Record<string, string> = {
      "src/a.ts": `import { db } from "../core/store/sqlite-store.js";\nexport const a = 1;`,
      "src/b.ts": `import { db } from "../core/store/sqlite-store.js";\nexport const b = 2;`,
    };
    const result = detectImplicitDeps(Object.keys(fileContents), fileContents);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toContain("sqlite-store");
  });

  it("should never throw even with malformed content", () => {
    const fileContents: Record<string, string> = {
      "src/broken.ts": `import { \n\n\n`,
      "src/valid.ts": `import { x } from "./x.js";`,
    };
    expect(() => detectImplicitDeps(Object.keys(fileContents), fileContents)).not.toThrow();
  });

  it("should not warn on imports from node_modules (external deps)", () => {
    const fileContents: Record<string, string> = {
      "src/a.ts": `import { z } from "zod/v4";\nimport { foo } from "./local-a.js";`,
      "src/b.ts": `import { z } from "zod/v4";\nimport { bar } from "./local-b.js";`,
    };
    const result = detectImplicitDeps(Object.keys(fileContents), fileContents);
    // zod is external — no warning
    expect(result.every((w) => !w.includes("zod"))).toBe(true);
  });

  it("should handle undefined file contents gracefully", () => {
    const result = detectImplicitDeps(["src/a.ts", "src/b.ts"], {});
    expect(result).toEqual([]);
  });
});
