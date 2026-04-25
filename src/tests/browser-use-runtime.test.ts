/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, expect, it, vi } from "vitest";
import {
  buildRuntimeSpec,
  prepareRuntimeFiles,
} from "../core/browser-pilot/browser-use-runtime.js";

const baseConfig = {
  bridgeBaseUrl: "http://127.0.0.1:9876/v1",
  model: "claude-3.5-sonnet",
  cdpUrl: "ws://127.0.0.1:9222/devtools/browser/abc",
  allowedDomains: ["*.example.com"],
};

describe("buildRuntimeSpec", () => {
  it("targets python -m browser_use.cli --mcp", () => {
    const spec = buildRuntimeSpec(baseConfig);

    expect(spec.command).toBe("python");
    expect(spec.args).toEqual(["-m", "browser_use.cli", "--mcp"]);
  });

  it("forces OpenAI-compat env to point at the bridge", () => {
    const spec = buildRuntimeSpec(baseConfig);

    expect(spec.env.OPENAI_API_KEY).toBe("copilot-dummy");
    expect(spec.env.OPENAI_BASE_URL).toBe("http://127.0.0.1:9876/v1");
    expect(spec.env.BROWSER_USE_LLM_MODEL).toBe("claude-3.5-sonnet");
  });

  it("encodes cdp_url and allowed_domains in the JSON config payload", () => {
    const spec = buildRuntimeSpec(baseConfig);
    const parsed = JSON.parse(spec.configFileContent);

    expect(parsed.cdp_url).toBe("ws://127.0.0.1:9222/devtools/browser/abc");
    expect(parsed.allowed_domains).toEqual(["*.example.com"]);
  });

  it("includes forbidden_cdp_methods when provided", () => {
    const spec = buildRuntimeSpec({
      ...baseConfig,
      forbiddenCdpMethods: ["Browser.close"],
    });
    const parsed = JSON.parse(spec.configFileContent);

    expect(parsed.forbidden_cdp_methods).toEqual(["Browser.close"]);
  });

  it("includes max_steps when provided", () => {
    const spec = buildRuntimeSpec({ ...baseConfig, maxSteps: 25 });
    const parsed = JSON.parse(spec.configFileContent);

    expect(parsed.max_steps).toBe(25);
  });
});

describe("prepareRuntimeFiles", () => {
  it("writes the JSON payload under tmpdir and threads --config <path>", async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const mkdtemp = vi.fn().mockResolvedValue("/tmp/mock-runtime-xyz");
    const spec = buildRuntimeSpec(baseConfig);

    const result = await prepareRuntimeFiles(spec, {
      writeFile,
      mkdtemp,
      tmpRoot: "/tmp",
    });

    expect(mkdtemp).toHaveBeenCalledWith("/tmp/browser-pilot-");
    expect(writeFile).toHaveBeenCalledWith(
      "/tmp/mock-runtime-xyz/config.json",
      spec.configFileContent,
      "utf8",
    );
    expect(result.configPath).toBe("/tmp/mock-runtime-xyz/config.json");
    expect(result.args).toContain("--config");
    expect(result.args).toContain("/tmp/mock-runtime-xyz/config.json");
    expect(result.tmpDir).toBe("/tmp/mock-runtime-xyz");
  });

  it("preserves the spec base args before injecting --config", async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const mkdtemp = vi.fn().mockResolvedValue("/tmp/aaa");
    const spec = buildRuntimeSpec(baseConfig);

    const result = await prepareRuntimeFiles(spec, {
      writeFile,
      mkdtemp,
      tmpRoot: "/tmp",
    });

    expect(result.args.slice(0, 3)).toEqual([
      "-m",
      "browser_use.cli",
      "--mcp",
    ]);
  });
});
