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
 * Surface-level invariants for the dashboard apiClient.
 *
 * The client is a high-churn file (27 touches in 7 weeks). Renames and
 * accidental removals are the dominant regression risk. These tests pin the
 * canonical method names: a future refactor that renames `getNodes` →
 * `listNodes` must update tests + every call site, not silently pass through.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "./api-client.js";

describe("apiClient — surface contract", () => {
  beforeEach(() => {
    // Replace fetch with a stub that always returns 200 + empty JSON. This
    // lets us call methods without hitting the network; we only assert that
    // the call goes out at all.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should expose the canonical project methods", () => {
    expect(typeof apiClient.getProject).toBe("function");
    expect(typeof apiClient.initProject).toBe("function");
    expect(typeof apiClient.getProjects).toBe("function");
    expect(typeof apiClient.getActiveProject).toBe("function");
    expect(typeof apiClient.activateProject).toBe("function");
  });

  it("should expose the canonical node CRUD methods", () => {
    expect(typeof apiClient.getNodes).toBe("function");
    expect(typeof apiClient.getNode).toBe("function");
    expect(typeof apiClient.createNode).toBe("function");
    expect(typeof apiClient.updateNode).toBe("function");
    expect(typeof apiClient.deleteNode).toBe("function");
  });

  it("should expose the canonical edge methods", () => {
    expect(typeof apiClient.getEdges).toBe("function");
    expect(typeof apiClient.createEdge).toBe("function");
    expect(typeof apiClient.deleteEdge).toBe("function");
  });

  it("should expose stats and search", () => {
    expect(typeof apiClient.getStats).toBe("function");
    expect(typeof apiClient.search).toBe("function");
    expect(typeof apiClient.getGraph).toBe("function");
  });

  it("should call the right URL for getProject (path stability)", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

    await apiClient.getProject();

    expect(fetchMock).toHaveBeenCalledOnce();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("/api/v1/project");
  });

  it("should POST to /project/init for initProject", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

    await apiClient.initProject("my-project");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/project/init");
    expect((options as RequestInit).method).toBe("POST");
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.name).toBe("my-project");
  });

  it("should DELETE for deleteNode and pass id in path", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

    await apiClient.deleteNode("node-123");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/nodes/node-123");
    expect((options as RequestInit).method).toBe("DELETE");
  });

  it("should append limit query param when provided to search", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

    await apiClient.search("foo", 50);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/search");
    expect(url).toContain("limit=50");
    expect(url).toContain("q=foo");
  });

  it("should NOT append limit when not provided", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

    await apiClient.search("foo");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain("limit=");
  });

  it("should throw a structured error for non-OK responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "bork", details: { foo: 1 } }),
    } as Response);

    await expect(apiClient.getProject()).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
    });
  });
});
