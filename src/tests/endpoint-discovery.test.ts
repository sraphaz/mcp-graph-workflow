/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 2.2 — endpoint-discovery.ts
 *
 * AC1: Chrome with remote-debugging → valid wsEndpoint
 * AC2: No remote-debugging → cdp_unreachable error + hint
 * AC3: DevToolsActivePort exists but port closing → polling up to 30s
 * AC4: wsEndpoint in logs → masked ws://<host>:<port>/devtools/browser/<redacted>
 */

import { describe, it, expect } from "vitest";
import {
  discoverWsEndpoint,
  maskWsEndpoint,
  parseDevToolsActivePort,
  CdpUnreachableError,
  type DiscoveryDeps,
} from "../core/browser-harness/endpoint-discovery.js";

// --- helpers ---

const noopSleep = async (_ms: number): Promise<void> => {
  // instant — no real sleep in tests
};

function makeDeps(
  portFileContent: string | null,
  jsonVersionResponse: string | null,
): DiscoveryDeps {
  return {
    readFileAt: async (_path) => portFileContent,
    httpGetJson: async (_url) => jsonVersionResponse,
    sleep: noopSleep,
  };
}

const validPortFile = "9222\n/devtools/browser/abc1-2345-6789-def0";
const validJsonVersion = JSON.stringify({
  webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/abc1-2345-6789-def0",
  Browser: "Chrome/144.0.0.0",
});

// --- AC4 pure: maskWsEndpoint ---

describe("endpoint-discovery — AC4: wsEndpoint masking (pure)", () => {
  it("masks the browser UUID segment", () => {
    const raw = "ws://127.0.0.1:9222/devtools/browser/4c15d8cd-b26e-4e4e-9a14-8e3c2c7d4a62";
    expect(maskWsEndpoint(raw)).toBe(
      "ws://127.0.0.1:9222/devtools/browser/<redacted>",
    );
  });

  it("masks wss:// URLs too", () => {
    const raw = "wss://host:9222/devtools/browser/some-uuid-here";
    expect(maskWsEndpoint(raw)).toBe("wss://host:9222/devtools/browser/<redacted>");
  });

  it("leaves already-masked URLs unchanged", () => {
    const masked = "ws://127.0.0.1:9222/devtools/browser/<redacted>";
    expect(maskWsEndpoint(masked)).toBe(masked);
  });

  it("leaves non-devtools URLs unchanged", () => {
    const url = "ws://127.0.0.1:9222/devtools/page/some-tab";
    expect(maskWsEndpoint(url)).toBe(url);
  });
});

// --- parseDevToolsActivePort pure ---

describe("endpoint-discovery — parseDevToolsActivePort (pure)", () => {
  it("parses valid port file", () => {
    const result = parseDevToolsActivePort("9222\n/devtools/browser/abc-def");
    expect(result).toEqual({ port: 9222, path: "/devtools/browser/abc-def" });
  });

  it("handles trailing whitespace", () => {
    const result = parseDevToolsActivePort("9222 \n/devtools/browser/abc\n");
    expect(result?.port).toBe(9222);
  });

  it("returns null for empty content", () => {
    expect(parseDevToolsActivePort("")).toBeNull();
  });

  it("returns null for non-numeric port", () => {
    expect(parseDevToolsActivePort("not-a-port\n/devtools/browser/x")).toBeNull();
  });
});

// --- AC1: valid endpoint ---

describe("endpoint-discovery — AC1: Chrome with remote-debugging → valid wsEndpoint", () => {
  it("discovers endpoint via DevToolsActivePort + /json/version", async () => {
    const deps = makeDeps(validPortFile, validJsonVersion);
    const result = await discoverWsEndpoint({ timeoutMs: 500 }, deps);

    expect(result.wsEndpoint).toBe(
      "ws://127.0.0.1:9222/devtools/browser/abc1-2345-6789-def0",
    );
    expect(result.port).toBe(9222);
    expect(result.source).toMatch(/devtools_active_port|json_version/);
  });

  it("discovers endpoint via /json/version fallback when port file absent", async () => {
    const deps = makeDeps(null, validJsonVersion);
    const result = await discoverWsEndpoint({ port: 9222, timeoutMs: 500 }, deps);

    expect(result.wsEndpoint).toContain("ws://");
    expect(result.source).toBe("json_version");
  });
});

// --- AC2: unreachable ---

describe("endpoint-discovery — AC2: no remote-debugging → cdp_unreachable + hint", () => {
  it("throws CdpUnreachableError when both sources fail", async () => {
    const deps = makeDeps(null, null);
    await expect(
      discoverWsEndpoint({ timeoutMs: 50, pollIntervalMs: 10 }, deps),
    ).rejects.toThrow(CdpUnreachableError);
  });

  it("error has code cdp_unreachable", async () => {
    const deps = makeDeps(null, null);
    try {
      await discoverWsEndpoint({ timeoutMs: 50, pollIntervalMs: 10 }, deps);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CdpUnreachableError);
      expect((err as CdpUnreachableError).code).toBe("cdp_unreachable");
    }
  });

  it("error hint mentions --remote-debugging-port", async () => {
    const deps = makeDeps(null, null);
    try {
      await discoverWsEndpoint({ timeoutMs: 50, pollIntervalMs: 10 }, deps);
    } catch (err) {
      expect((err as CdpUnreachableError).hint).toMatch(/remote-debugging-port/i);
    }
  });
});

// --- AC3: polling ---

describe("endpoint-discovery — AC3: port closing → polling until timeout or success", () => {
  it("retries until endpoint becomes available", async () => {
    let attempts = 0;
    const deps: DiscoveryDeps = {
      readFileAt: async (_p) => {
        attempts++;
        // Succeed on the 3rd attempt
        return attempts >= 3 ? validPortFile : null;
      },
      httpGetJson: async (_u) => (attempts >= 3 ? validJsonVersion : null),
      sleep: noopSleep,
    };

    const result = await discoverWsEndpoint({ timeoutMs: 1000, pollIntervalMs: 1 }, deps);
    expect(result.wsEndpoint).toContain("ws://");
    expect(attempts).toBeGreaterThanOrEqual(3);
  });

  it("exhausts timeout when always failing", async () => {
    const deps = makeDeps(null, null);
    const start = Date.now();
    await expect(
      discoverWsEndpoint({ timeoutMs: 60, pollIntervalMs: 10 }, deps),
    ).rejects.toBeInstanceOf(CdpUnreachableError);
    // Should have spent at least ~50ms polling
    expect(Date.now() - start).toBeGreaterThanOrEqual(50);
  });
});
