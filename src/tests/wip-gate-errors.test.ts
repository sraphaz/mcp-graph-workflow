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
  McpGraphError,
  WIPLimitError,
  FileConflictError,
} from "../core/utils/errors.js";

describe("WIPLimitError", () => {
  it("should extend McpGraphError", () => {
    const err = new WIPLimitError({ current: 3, limit: 3, inFlightNodeIds: ["node_a", "node_b", "node_c"] });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(McpGraphError);
    expect(err).toBeInstanceOf(WIPLimitError);
  });

  it("should set name to WIPLimitError", () => {
    const err = new WIPLimitError({ current: 1, limit: 1, inFlightNodeIds: ["node_x"] });

    expect(err.name).toBe("WIPLimitError");
  });

  it("should carry current, limit, inFlightNodeIds on details", () => {
    const details = { current: 2, limit: 3, inFlightNodeIds: ["node_1", "node_2"] };
    const err = new WIPLimitError(details);

    expect(err.details.current).toBe(2);
    expect(err.details.limit).toBe(3);
    expect(err.details.inFlightNodeIds).toEqual(["node_1", "node_2"]);
  });

  it("should include current and limit in message", () => {
    const err = new WIPLimitError({ current: 3, limit: 3, inFlightNodeIds: [] });

    expect(err.message).toContain("3");
  });
});

describe("FileConflictError", () => {
  it("should extend McpGraphError", () => {
    const err = new FileConflictError({
      nodeId: "node_new",
      conflictingFiles: ["src/foo.ts"],
      heldBy: [{ nodeId: "node_old", agentId: "agent_1" }],
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(McpGraphError);
    expect(err).toBeInstanceOf(FileConflictError);
  });

  it("should set name to FileConflictError", () => {
    const err = new FileConflictError({
      nodeId: "node_new",
      conflictingFiles: ["src/bar.ts"],
      heldBy: [],
    });

    expect(err.name).toBe("FileConflictError");
  });

  it("should carry nodeId, conflictingFiles, heldBy on details", () => {
    const holder = { nodeId: "node_old", agentId: "agent_x" };
    const err = new FileConflictError({
      nodeId: "node_new",
      conflictingFiles: ["src/a.ts", "src/b.ts"],
      heldBy: [holder],
    });

    expect(err.details.nodeId).toBe("node_new");
    expect(err.details.conflictingFiles).toEqual(["src/a.ts", "src/b.ts"]);
    expect(err.details.heldBy).toEqual([holder]);
  });

  it("should mention conflicting file count in message", () => {
    const err = new FileConflictError({
      nodeId: "node_new",
      conflictingFiles: ["src/foo.ts", "src/bar.ts"],
      heldBy: [{ nodeId: "node_old", agentId: "agent_1" }],
    });

    expect(err.message).toContain("node_new");
  });
});
