import { describe, it, expect, beforeEach, afterEach } from "vitest";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { startDaemonRunner, type DaemonRunnerHandle } from "../../mcp/daemon/runner.js";
import { encodeFrame, FrameBuffer } from "../../core/daemon/daemon-protocol.js";

function makeSocketPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-graph-daemon-"));
  return path.join(dir, "daemon.sock");
}

async function readFirstFrame(conn: net.Socket, matchId: number): Promise<Record<string, unknown>> {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const buf = new FrameBuffer();
    const onData = (chunk: Buffer): void => {
      try {
        const frames = buf.feed(chunk.toString("utf8"));
        for (const f of frames) {
          const msg = f as Record<string, unknown>;
          if (msg.id === matchId) {
            conn.off("data", onData);
            resolve(msg);
            return;
          }
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    conn.on("data", onData);
    conn.once("error", reject);
  });
}

describe("daemon runner (integration)", () => {
  let workspaceDir: string;
  let store: SqliteStore;
  let handle: DaemonRunnerHandle;
  let socketPath: string;

  beforeEach(async () => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-graph-daemon-ws-"));
    store = SqliteStore.open(workspaceDir);
    socketPath = makeSocketPath();
    handle = await startDaemonRunner({ socketPath, store });
  });

  afterEach(async () => {
    await handle.close();
    store.close();
    try {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it("accepts a connection and responds to initialize + tools/list", async () => {
    const conn = net.createConnection(socketPath);
    await new Promise<void>((resolve, reject) => {
      conn.once("connect", () => resolve());
      conn.once("error", reject);
    });

    // 1. initialize handshake
    conn.write(encodeFrame({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.0.0" },
      },
    }));

    const initResp = await readFirstFrame(conn, 1);
    expect(initResp.jsonrpc).toBe("2.0");
    expect(initResp.result).toMatchObject({
      serverInfo: { name: "mcp-graph" },
    });

    // 2. initialized notification (no id, no response expected)
    conn.write(encodeFrame({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }));

    // 3. tools/list
    conn.write(encodeFrame({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    }));

    const listResp = await readFirstFrame(conn, 2);
    expect(listResp.jsonrpc).toBe("2.0");
    expect(listResp.result).toMatchObject({
      tools: expect.any(Array),
    });

    conn.end();
  });

  it("fires onIdleShutdown after the idle window elapses with no clients", async () => {
    // Close the default handle so we can swap in one configured for idle shutdown.
    await handle.close();

    let resolveFired: (() => void) | undefined;
    const fired = new Promise<void>((resolve) => { resolveFired = resolve; });

    let calls = 0;
    handle = await startDaemonRunner({
      socketPath,
      store,
      idleShutdownMs: 80,
      onIdleShutdown: () => {
        calls++;
        resolveFired?.();
      },
    });

    await fired;
    expect(calls).toBe(1);
  });

  it("does NOT fire onIdleShutdown while a client is connected", async () => {
    await handle.close();

    let fired = false;
    handle = await startDaemonRunner({
      socketPath,
      store,
      idleShutdownMs: 80,
      onIdleShutdown: () => { fired = true; },
    });

    const conn = net.createConnection(socketPath);
    await new Promise((r) => conn.once("connect", r));
    // Keep the connection open across more than one idle-check interval.
    await new Promise((r) => setTimeout(r, 200));
    expect(fired).toBe(false);
    conn.destroy();
  });

  it("tracks connection count", async () => {
    expect(handle.clientCount()).toBe(0);

    const waitFor = async (predicate: () => boolean, timeoutMs = 1000): Promise<void> => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise((r) => setTimeout(r, 5));
      }
      throw new Error("waitFor timed out");
    };

    const a = net.createConnection(socketPath);
    await new Promise((r) => a.once("connect", r));
    await waitFor(() => handle.clientCount() === 1);

    const b = net.createConnection(socketPath);
    await new Promise((r) => b.once("connect", r));
    await waitFor(() => handle.clientCount() === 2);

    a.destroy();
    await waitFor(() => handle.clientCount() === 1);

    b.destroy();
    await waitFor(() => handle.clientCount() === 0);
  });
});
