/**
 * `Transport` implementation that carries MCP JSON-RPC messages over a
 * `net.Socket` using line-delimited JSON framing (see `daemon-protocol.ts`).
 *
 * One instance is created per client connection — the daemon's shared heavy
 * state (SqliteStore, EventBus, ONNX session) lives outside the transport.
 */

import type { Socket } from "node:net";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { FrameBuffer, encodeFrame } from "../../core/daemon/daemon-protocol.js";

export class SocketTransport implements Transport {
  onclose?: () => void;
  onerror?: (err: Error) => void;
  onmessage?: (msg: JSONRPCMessage) => void;

  private readonly buffer = new FrameBuffer();
  private started = false;

  constructor(private readonly socket: Socket) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    this.socket.on("data", (chunk: Buffer) => {
      try {
        const frames = this.buffer.feed(chunk.toString("utf8"));
        for (const frame of frames) {
          this.onmessage?.(frame as JSONRPCMessage);
        }
      } catch (err) {
        this.onerror?.(err instanceof Error ? err : new Error(String(err)));
      }
    });

    this.socket.on("close", () => {
      this.onclose?.();
    });

    this.socket.on("error", (err: Error) => {
      this.onerror?.(err);
    });
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.socket.writable) return;
    await new Promise<void>((resolve, reject) => {
      this.socket.write(encodeFrame(message), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.socket.destroyed) {
        resolve();
        return;
      }
      this.socket.end(() => resolve());
    });
  }
}
