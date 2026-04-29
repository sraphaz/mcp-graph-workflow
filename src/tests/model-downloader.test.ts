/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-17.T01 — model-downloader with SHA256 verify
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  downloadFileWithVerify,
  computeFileSha256,
  ChecksumMismatchError,
} from "../core/rag/model-downloader.js";

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

describe("computeFileSha256", () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "model-dl-")); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("returns hex sha256 of file content", () => {
    const path = join(tmp, "f.bin");
    writeFileSync(path, "hello");
    expect(computeFileSha256(path)).toBe(sha256("hello"));
  });

  it("matches across different content", () => {
    const path = join(tmp, "x.bin");
    writeFileSync(path, "world");
    expect(computeFileSha256(path)).toBe(sha256("world"));
    writeFileSync(path, "world!");
    expect(computeFileSha256(path)).toBe(sha256("world!"));
  });
});

describe("downloadFileWithVerify", () => {
  let tmp: string;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "model-dl-"));
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    rmSync(tmp, { recursive: true, force: true });
  });

  function mockFetch(body: string): void {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer,
    } as unknown as Response);
  }

  it("downloads and writes the file when no expected hash provided", async () => {
    mockFetch("payload-A");
    const dest = join(tmp, "a.bin");
    await downloadFileWithVerify("https://example.test/a", dest);
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toBe("payload-A");
  });

  it("returns the computed SHA256 of the downloaded file", async () => {
    mockFetch("checksum-me");
    const dest = join(tmp, "b.bin");
    const result = await downloadFileWithVerify("https://example.test/b", dest);
    expect(result.sha256).toBe(sha256("checksum-me"));
    expect(result.sizeBytes).toBe("checksum-me".length);
    expect(result.verified).toBe(false); // no expected hash → not verified
  });

  it("verifies and returns verified:true when expected hash matches", async () => {
    mockFetch("verified-content");
    const dest = join(tmp, "c.bin");
    const expected = sha256("verified-content");
    const result = await downloadFileWithVerify("https://example.test/c", dest, expected);
    expect(result.verified).toBe(true);
    expect(result.sha256).toBe(expected);
    expect(existsSync(dest)).toBe(true);
  });

  it("throws ChecksumMismatchError and deletes file on hash mismatch", async () => {
    mockFetch("tampered");
    const dest = join(tmp, "d.bin");
    const wrongHash = sha256("expected-different");
    await expect(
      downloadFileWithVerify("https://example.test/d", dest, wrongHash),
    ).rejects.toThrow(ChecksumMismatchError);
    // File must be removed to prevent reuse of corrupted artifact
    expect(existsSync(dest)).toBe(false);
  });

  it("throws when HTTP response is not ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response);
    const dest = join(tmp, "e.bin");
    await expect(
      downloadFileWithVerify("https://example.test/e", dest),
    ).rejects.toThrow(/404/);
    expect(existsSync(dest)).toBe(false);
  });

  it("ChecksumMismatchError exposes expected and actual hashes for diagnostics", async () => {
    mockFetch("ABC");
    const dest = join(tmp, "f.bin");
    const wrongHash = "0".repeat(64);
    try {
      await downloadFileWithVerify("https://example.test/f", dest, wrongHash);
      expect.fail("should have thrown");
    } catch (err) {
      if (!(err instanceof ChecksumMismatchError)) throw err;
      expect(err.expected).toBe(wrongHash);
      expect(err.actual).toBe(sha256("ABC"));
      expect(err.url).toBe("https://example.test/f");
    }
  });
});
