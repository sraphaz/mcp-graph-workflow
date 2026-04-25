/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatDeprecationBanner,
  printDeprecationBanner,
} from "../cli/deprecation.js";

describe("formatDeprecationBanner (Sprint 9 #9.5)", () => {
  it("includes the legacy header and new-command line", () => {
    const out = formatDeprecationBanner({ newCommand: "mg <command>" });
    expect(out).toContain("[mcp-graph] DEPRECATED");
    expect(out).toContain("legacy v10 surface");
    expect(out).toContain("Switch to:");
    expect(out).toContain("mg <command>");
  });

  it("appends the migration doc line when provided", () => {
    const out = formatDeprecationBanner({
      newCommand: "mg <command>",
      migrationDoc: "docs/_internal/migration/v10-to-v11-cli.md",
    });
    expect(out).toContain("Migration:");
    expect(out).toContain("docs/_internal/migration/v10-to-v11-cli.md");
  });

  it("omits the migration line when not provided", () => {
    const out = formatDeprecationBanner({ newCommand: "mg <command>" });
    expect(out).not.toContain("Migration:");
  });

  it("mentions the env-var silencer", () => {
    const out = formatDeprecationBanner({ newCommand: "mg <command>" });
    expect(out).toContain("MCP_GRAPH_NO_BANNER=1");
  });
});

describe("printDeprecationBanner side effects (Sprint 9 #9.5)", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let prevSilence: string | undefined;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    prevSilence = process.env.MCP_GRAPH_NO_BANNER;
    delete process.env.MCP_GRAPH_NO_BANNER;
  });

  afterEach(() => {
    writeSpy.mockRestore();
    if (prevSilence === undefined) delete process.env.MCP_GRAPH_NO_BANNER;
    else process.env.MCP_GRAPH_NO_BANNER = prevSilence;
  });

  it("writes to stderr when forceTTY=true", () => {
    printDeprecationBanner({ newCommand: "mg <command>", forceTTY: true });
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(String(writeSpy.mock.calls[0]?.[0])).toContain("DEPRECATED");
  });

  it("is a no-op when stderr is not a TTY (agent host pipes stderr)", () => {
    printDeprecationBanner({ newCommand: "mg <command>", forceTTY: false });
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("is a no-op when MCP_GRAPH_NO_BANNER=1, even on TTY", () => {
    process.env.MCP_GRAPH_NO_BANNER = "1";
    printDeprecationBanner({ newCommand: "mg <command>", forceTTY: true });
    expect(writeSpy).not.toHaveBeenCalled();
  });
});
