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

import { describe, it, expect, beforeEach } from "vitest";
import { isTypeScriptAvailable, resetTypeScriptLoader } from "../core/code/ts-analyzer.js";

describe("isTypeScriptAvailable", () => {
  beforeEach(() => {
    resetTypeScriptLoader();
  });

  it("should return true when typescript is available", async () => {
    const available = await isTypeScriptAvailable();

    expect(available).toBe(true);
  });

  it("should return consistent result on subsequent calls", async () => {
    const first = await isTypeScriptAvailable();
    const second = await isTypeScriptAvailable();

    expect(first).toBe(second);
  });
});
