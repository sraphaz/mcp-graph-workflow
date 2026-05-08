/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Direct Chrome DevTools Protocol client — single websocket, JSON-RPC framing.
 * Port of browser-harness's admin.py/daemon.py philosophy: one ws to Chrome,
 * nothing between.
 */

import WebSocket from "ws";
import { CdpConnectionError, CdpProtocolError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "cdp-client.ts" });

type CdpResultHandler = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  method: string;
  timeoutId: ReturnType<typeof setTimeout>;
};

type CdpEventHandler = (params: Record<string, unknown>) => void;

export interface CdpClientOptions {
  endpoint: string;
  /** Per-call timeout in ms. Default 30s. */
  callTimeoutMs?: number;
  /** Inject a WebSocket constructor (used in tests). */
  webSocketImpl?: typeof WebSocket;
}

export class CdpClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, CdpResultHandler>();
  private readonly listeners = new Map<string, Set<CdpEventHandler>>();
  private readonly callTimeoutMs: number;
  private readonly endpoint: string;
  private readonly WsCtor: typeof WebSocket;
  private closed = false;

  constructor(opts: CdpClientOptions) {
    this.endpoint = opts.endpoint;
    this.callTimeoutMs = opts.callTimeoutMs ?? 30_000;
    this.WsCtor = opts.webSocketImpl ?? WebSocket;
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let ws: WebSocket;
      try {
        ws = new this.WsCtor(this.endpoint);
      } catch (err) {
        reject(new CdpConnectionError(this.endpoint, err instanceof Error ? err.message : String(err)));
        return;
      }

      const onOpen = (): void => {
        if (settled) return;
        settled = true;
        this.ws = ws;
        ws.removeListener("error", onError);
        ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => this.handleMessage(data));
        ws.on("close", () => this.handleClose());
        ws.on("error", (err: Error) => log.warn("cdp:ws:error", { error: err.message }));
        log.info("cdp:connected", { endpoint: this.endpoint });
        resolve();
      };
      const onError = (err: Error): void => {
        if (settled) return;
        settled = true;
        reject(new CdpConnectionError(this.endpoint, err.message));
      };

      ws.once("open", onOpen);
      ws.once("error", onError);
    });
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.ws || this.closed) {
      return Promise.reject(new CdpConnectionError(this.endpoint, "client not connected"));
    }
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        reject(new CdpProtocolError(method, -32001, `timed out after ${this.callTimeoutMs}ms`));
      }, this.callTimeoutMs);

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        method,
        timeoutId,
      });
      const ws = this.ws;
      if (!ws) {
        reject(new CdpConnectionError(this.endpoint, "not connected"));
        return;
      }
      ws.send(payload, (err) => {
        if (err) {
          const handler = this.pending.get(id);
          if (handler) {
            clearTimeout(handler.timeoutId);
            this.pending.delete(id);
            reject(new CdpProtocolError(method, -32002, err.message));
          }
        }
      });
    });
  }

  on(event: string, handler: CdpEventHandler): () => void {
    let bucket = this.listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(event, bucket);
    }
    bucket.add(handler);
    const created = bucket;
    return () => created.delete(handler);
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const [, h] of this.pending) {
      clearTimeout(h.timeoutId);
      h.reject(new CdpConnectionError(this.endpoint, "client closed"));
    }
    this.pending.clear();
    this.listeners.clear();
    const ws = this.ws;
    if (ws && ws.readyState === this.WsCtor.OPEN) {
      await new Promise<void>((resolve) => {
        ws.once("close", () => resolve());
        ws.close();
      });
    }
    this.ws = null;
  }

  isOpen(): boolean {
    return !!this.ws && !this.closed && this.ws.readyState === this.WsCtor.OPEN;
  }

  private handleMessage(data: Buffer | ArrayBuffer | Buffer[]): void {
    let text: string;
    if (typeof data === "string") text = data;
    else if (Buffer.isBuffer(data)) text = data.toString("utf8");
    else if (Array.isArray(data)) text = Buffer.concat(data).toString("utf8");
    else text = Buffer.from(data as ArrayBuffer).toString("utf8");

    let msg: { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { code: number; message: string } };
    try {
      msg = JSON.parse(text);
    } catch (err) {
      log.warn("cdp:parse:error", { error: err instanceof Error ? err.message : String(err) });
      return;
    }

    if (typeof msg.id === "number") {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      clearTimeout(pending.timeoutId);
      this.pending.delete(msg.id);
      if (msg.error) {
        pending.reject(new CdpProtocolError(pending.method, msg.error.code, msg.error.message));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    if (msg.method) {
      const bucket = this.listeners.get(msg.method);
      if (bucket) {
        for (const fn of bucket) {
          try { fn(msg.params ?? {}); } catch (err) {
            log.warn("cdp:listener:error", { method: msg.method, error: err instanceof Error ? err.message : String(err) });
          }
        }
      }
    }
  }

  private handleClose(): void {
    if (this.closed) return;
    this.closed = true;
    for (const [, h] of this.pending) {
      clearTimeout(h.timeoutId);
      h.reject(new CdpConnectionError(this.endpoint, "socket closed unexpectedly"));
    }
    this.pending.clear();
    log.info("cdp:closed", { endpoint: this.endpoint });
  }
}
