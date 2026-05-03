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
 * B19 (P1): REST POST com Content-Type application/json e body malformado
 * deve responder 400 com JSON {error,details}, não HTML stack trace.
 *
 * Repro (manual, against running mcp-graph-server):
 *   $ curl -s -X POST http://localhost:3000/api/v1/nodes \
 *       -H 'Content-Type: application/json' -d 'not-json'
 *   <!DOCTYPE html>
 *   <html lang="en">
 *   ...SyntaxError: Unexpected token 'n', "not-json" is not valid JSON...
 *
 * Esperado: HTTP 400 com Content-Type application/json e payload
 *   {"error":"Invalid JSON body","details":"..."} (mesma forma que outros
 *   400s já retornam, ex /api/v1/nodes com body Zod-inválido).
 *
 * Source: mcp-graph notebook node_50f68e898f02.
 */

import { describe, it, expect } from "vitest";

describe.skip("B19 — REST malformed JSON returns JSON 400 (recon, no fix yet)", () => {
  it("POST /api/v1/nodes with non-JSON body returns 400 application/json", async () => {
    // PLACEHOLDER for fix verification. Currently fails with HTML 400 from
    // the express.json default error handler. The fix wires a body-parser
    // error middleware before the route handlers that catches SyntaxError
    // and emits a structured JSON 400.
    expect(true).toBe(true); // intentional no-op until fix lands
  });
});
