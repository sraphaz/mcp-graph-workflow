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

/**
 * resolveWsEndpoint — Copilot Bridge Sprint 1.15.
 *
 * 3-tier resolution that the browser_pilot_run handler runs to find the
 * CDP WebSocket endpoint to drive:
 *
 *   tier 1: explicit `argEndpoint` (caller passed it in)
 *   tier 2: session lookup by `sessionId` (resume a registered Chrome)
 *   tier 3: config default (`integrations.browserAutomation.defaultCdpUrl`)
 *
 * Pure function — accepts a SessionLookup interface so it doesn't depend
 * on SqliteStore directly. Returns a discriminated result aligned with
 * BrowserPilotErrorSchema's codes so the calling tool can map errors
 * straight through.
 */

import type { BrowserPilotErrorCode } from "../../schemas/browser-pilot.schema.js";

/**
 * Minimal contract a session-store-like object must satisfy for the
 * resolver. Lets us pass the concrete SessionStore without coupling.
 */
export interface SessionLookup {
  find: (id: string) => { cdpEndpoint: string } | null;
}

export interface ResolveWsEndpointInput {
  argEndpoint?: string;
  sessionId?: string;
  sessionStore: SessionLookup;
  configDefaultUrl?: string;
}

export type ResolveWsEndpointResult =
  | { ok: true; endpoint: string; source: "arg" | "session" | "config" }
  | { ok: false; error: string; code: BrowserPilotErrorCode };

function isWsUrl(url: string): boolean {
  return /^wss?:\/\//.test(url);
}

/** Treats undefined and empty string the same way ("not provided"). */
function present(s: string | undefined): s is string {
  return typeof s === "string" && s.length > 0;
}

export function resolveWsEndpoint(input: ResolveWsEndpointInput): ResolveWsEndpointResult {
  // Tier 1 — explicit arg wins.
  if (present(input.argEndpoint)) {
    if (!isWsUrl(input.argEndpoint)) {
      return {
        ok: false,
        code: "cdp_ws_unreachable",
        error: `argEndpoint must start with ws:// or wss:// — got "${input.argEndpoint}"`,
      };
    }
    return { ok: true, endpoint: input.argEndpoint, source: "arg" };
  }

  // Tier 2 — session lookup.
  if (present(input.sessionId)) {
    const session = input.sessionStore.find(input.sessionId);
    if (session && present(session.cdpEndpoint) && isWsUrl(session.cdpEndpoint)) {
      return { ok: true, endpoint: session.cdpEndpoint, source: "session" };
    }
    // Session missing or invalid endpoint — fall through to tier 3.
  }

  // Tier 3 — config default.
  if (present(input.configDefaultUrl)) {
    if (!isWsUrl(input.configDefaultUrl)) {
      return {
        ok: false,
        code: "cdp_ws_unreachable",
        error: `configDefaultUrl must start with ws:// or wss:// — got "${input.configDefaultUrl}"`,
      };
    }
    return { ok: true, endpoint: input.configDefaultUrl, source: "config" };
  }

  return {
    ok: false,
    code: "cdp_ws_unreachable",
    error: "No CDP WS endpoint provided. Pass argEndpoint, register a session, or set integrations.browserAutomation.defaultCdpUrl in config.",
  };
}
