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
  resolveWsEndpoint,
  type SessionLookup,
} from "../core/browser-pilot/resolve-ws-endpoint.js";

const noopLookup: SessionLookup = {
  find: () => null,
};

const lookupWith = (sessionId: string, endpoint: string): SessionLookup => ({
  find: (id) => (id === sessionId ? { cdpEndpoint: endpoint } : null),
});

describe("resolveWsEndpoint — Copilot Bridge Sprint 1.15 (3-tier)", () => {
  it("tier 1 — argEndpoint wins over everything else", () => {
    const r = resolveWsEndpoint({
      argEndpoint: "ws://from-arg:9222/devtools/browser/a",
      sessionId: "sess_1",
      sessionStore: lookupWith("sess_1", "ws://from-session:9222/x"),
      configDefaultUrl: "ws://from-config:9222/y",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("arg");
      expect(r.endpoint).toBe("ws://from-arg:9222/devtools/browser/a");
    }
  });

  it("tier 2 — session lookup when arg is absent", () => {
    const r = resolveWsEndpoint({
      sessionId: "sess_42",
      sessionStore: lookupWith("sess_42", "ws://from-session:9222/x"),
      configDefaultUrl: "ws://from-config:9222/y",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("session");
      expect(r.endpoint).toBe("ws://from-session:9222/x");
    }
  });

  it("tier 3 — config default when arg + session both absent", () => {
    const r = resolveWsEndpoint({
      sessionStore: noopLookup,
      configDefaultUrl: "ws://from-config:9222/y",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("config");
      expect(r.endpoint).toBe("ws://from-config:9222/y");
    }
  });

  it("falls through to config when sessionId provided but session not found", () => {
    const r = resolveWsEndpoint({
      sessionId: "sess_missing",
      sessionStore: noopLookup,
      configDefaultUrl: "ws://from-config:9222/y",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("config");
  });

  it("returns ok=false when nothing resolves", () => {
    const r = resolveWsEndpoint({ sessionStore: noopLookup });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/no.*endpoint|cdp_ws_unreachable|ws_endpoint/i);
      expect(r.code).toBe("cdp_ws_unreachable");
    }
  });

  it("rejects empty-string argEndpoint as 'not provided' and falls through", () => {
    const r = resolveWsEndpoint({
      argEndpoint: "",
      sessionId: "sess_1",
      sessionStore: lookupWith("sess_1", "ws://from-session:9222/x"),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("session");
  });

  it("rejects empty-string configDefaultUrl as 'not provided'", () => {
    const r = resolveWsEndpoint({
      sessionStore: noopLookup,
      configDefaultUrl: "",
    });
    expect(r.ok).toBe(false);
  });

  it("validates the resolved endpoint starts with ws:// or wss://", () => {
    const r = resolveWsEndpoint({
      argEndpoint: "http://not-a-ws-url:9222/",
      sessionStore: noopLookup,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("cdp_ws_unreachable");
      expect(r.error).toMatch(/ws:\/\/|wss:\/\//);
    }
  });

  it("accepts wss:// (TLS over WebSocket)", () => {
    const r = resolveWsEndpoint({
      argEndpoint: "wss://browser.example.com:9222/devtools/browser/abc",
      sessionStore: noopLookup,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.endpoint).toMatch(/^wss:\/\//);
  });

  it("returns the source label so the tool can audit which tier hit", () => {
    const r = resolveWsEndpoint({
      argEndpoint: "ws://x:9222/",
      sessionStore: noopLookup,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(["arg", "session", "config"]).toContain(r.source);
  });
});
