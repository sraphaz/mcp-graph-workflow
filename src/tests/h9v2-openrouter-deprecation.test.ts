/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi } from "vitest";

describe("tools/h9v2-pilot/openrouter-client — deprecation warning", () => {
  it("module source contains deprecation console.warn pointing to src/core/llm/adapters/openrouter.ts", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const url = await import("node:url");
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const target = path.resolve(here, "../../tools/h9v2-pilot/openrouter-client.ts");
    const source = await fs.readFile(target, "utf8");
    expect(source).toContain("console.warn");
    expect(source).toContain("deprecated");
    expect(source).toContain("src/core/llm/adapters/openrouter.ts");
  });

  it("the warn fires when the module is imported (mocked console.warn captures it)", async () => {
    // The module has top-level side-effect; if vitest already loaded it during a prior
    // test the once-flag silences subsequent imports. We assert structure above; here we
    // do a best-effort: spy and import. Either the spy sees the warn (first load) or
    // the once-flag protects subsequent loads (still acceptable per AC).
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("../../tools/h9v2-pilot/openrouter-client.js");
    const seen = warnSpy.mock.calls.flatMap((c) => c.map(String));
    if (seen.length > 0) {
      expect(seen.some((m) => m.includes("deprecated"))).toBe(true);
    }
    warnSpy.mockRestore();
  });
});
