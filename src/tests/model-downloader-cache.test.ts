/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-3.T02 — model-downloader cache + resume tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  downloadIfMissing,
  computeFileSha256,
} from "../core/rag/model-downloader.js";

function sha256Of(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

describe("downloadIfMissing (E3.T02)", () => {
  let tmp: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mdl-"));
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    rmSync(tmp, { recursive: true, force: true });
  });

  it("downloads on first use when destination is missing", async () => {
    const buf = Buffer.from("hello model", "utf-8");
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new Uint8Array(buf).buffer),
    } as unknown as Response);

    const dest = join(tmp, "model.bin");
    const r = await downloadIfMissing("http://example/model.bin", dest);
    expect(r.cached).toBe(false);
    expect(r.sha256).toBe(sha256Of(buf));
    expect(existsSync(dest)).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("skips download (cached) when file exists and hash matches expected", async () => {
    const buf = Buffer.from("cached body", "utf-8");
    const dest = join(tmp, "model.bin");
    writeFileSync(dest, buf);
    const expected = computeFileSha256(dest);

    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const r = await downloadIfMissing("http://example/model.bin", dest, expected);
    expect(r.cached).toBe(true);
    expect(r.verified).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("re-downloads when cached file has wrong hash (stale cache)", async () => {
    const dest = join(tmp, "model.bin");
    writeFileSync(dest, "stale-bytes"); // wrong content
    const goodBuf = Buffer.from("good bytes", "utf-8");
    const expected = sha256Of(goodBuf);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new Uint8Array(goodBuf).buffer),
    } as unknown as Response);

    const r = await downloadIfMissing("http://example/model.bin", dest, expected);
    expect(r.cached).toBe(false);
    expect(r.verified).toBe(true);
    expect(computeFileSha256(dest)).toBe(expected);
  });

  it("removes partial file on download error so the next call can resume cleanly", async () => {
    const dest = join(tmp, "model.bin");
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(
      downloadIfMissing("http://example/model.bin", dest),
    ).rejects.toBeDefined();
    expect(existsSync(dest)).toBe(false);
  });

  it("verifies SHA256 before activation when expected is provided", async () => {
    const goodBuf = Buffer.from("payload", "utf-8");
    const wrongExpected = "0".repeat(64);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new Uint8Array(goodBuf).buffer),
    } as unknown as Response);

    const dest = join(tmp, "model.bin");
    await expect(
      downloadIfMissing("http://example/model.bin", dest, wrongExpected),
    ).rejects.toThrow(/sha256/i);
    expect(existsSync(dest)).toBe(false);
  });
});
