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
  DEFAULT_NODE_STATUS,
  DEFAULT_NODE_PRIORITY,
  DEFAULT_TOKEN_BUDGET,
  DEFAULT_CHUNK_MAX_TOKENS,
  DEFAULT_CHUNK_OVERLAP,
} from "../core/utils/constants.js";

describe("default constants", () => {
  it("should have correct default node status", () => {
    expect(DEFAULT_NODE_STATUS).toBe("backlog");
  });

  it("should have correct default node priority", () => {
    expect(DEFAULT_NODE_PRIORITY).toBe(3);
  });

  it("should have correct default token budget", () => {
    expect(DEFAULT_TOKEN_BUDGET).toBe(4000);
  });

  it("should have correct default chunk max tokens", () => {
    expect(DEFAULT_CHUNK_MAX_TOKENS).toBe(500);
  });

  it("should have correct default chunk overlap", () => {
    expect(DEFAULT_CHUNK_OVERLAP).toBe(50);
  });
});
