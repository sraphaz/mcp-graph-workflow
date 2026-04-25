/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocketServer, WebSocket } from "ws";
import { CdpClient } from "../core/browser-harness/cdp-client.js";
import { CdpProtocolError, CdpConnectionError } from "../core/utils/errors.js";

let server: WebSocketServer;
let port: number;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = new WebSocketServer({ port: 0 });
    server.on("listening", () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });

  server.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString()) as { id: number; method: string; params?: Record<string, unknown> };
      if (msg.method === "Test.echo") {
        ws.send(JSON.stringify({ id: msg.id, result: { value: msg.params?.value ?? null } }));
      } else if (msg.method === "Test.fail") {
        ws.send(JSON.stringify({ id: msg.id, error: { code: -32000, message: "boom" } }));
      } else if (msg.method === "Test.fireEvent") {
        ws.send(JSON.stringify({ id: msg.id, result: {} }));
        // emit an unsolicited event
        ws.send(JSON.stringify({ method: "Test.event", params: { hello: "world" } }));
      }
      // Test.timeout: never reply
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("CdpClient", () => {
  it("connects and round-trips a request → response", async () => {
    const c = new CdpClient({ endpoint: `ws://127.0.0.1:${port}`, webSocketImpl: WebSocket });
    await c.connect();
    const r = await c.send<{ value: number }>("Test.echo", { value: 42 });
    expect(r.value).toBe(42);
    await c.close();
  });

  it("rejects with CdpProtocolError when the peer returns an error frame", async () => {
    const c = new CdpClient({ endpoint: `ws://127.0.0.1:${port}`, webSocketImpl: WebSocket });
    await c.connect();
    await expect(c.send("Test.fail")).rejects.toBeInstanceOf(CdpProtocolError);
    await c.close();
  });

  it("dispatches events to subscribers", async () => {
    const c = new CdpClient({ endpoint: `ws://127.0.0.1:${port}`, webSocketImpl: WebSocket });
    await c.connect();
    let received: Record<string, unknown> | null = null;
    c.on("Test.event", (params) => { received = params; });
    await c.send("Test.fireEvent");
    await new Promise((r) => setTimeout(r, 30));
    expect(received).toEqual({ hello: "world" });
    await c.close();
  });

  it("times out a hanging call", async () => {
    const c = new CdpClient({ endpoint: `ws://127.0.0.1:${port}`, webSocketImpl: WebSocket, callTimeoutMs: 50 });
    await c.connect();
    await expect(c.send("Test.timeout")).rejects.toBeInstanceOf(CdpProtocolError);
    await c.close();
  });

  it("fails fast with CdpConnectionError on unreachable endpoints", async () => {
    const c = new CdpClient({ endpoint: `ws://127.0.0.1:1`, webSocketImpl: WebSocket });
    await expect(c.connect()).rejects.toBeInstanceOf(CdpConnectionError);
  });
});
