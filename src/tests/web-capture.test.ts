import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  captureWebPage,
  isBlockedUrl,
  type CaptureOptions,
} from "../core/capture/web-capture.js";

const playwrightMocks = vi.hoisted(() => ({
  goto: vi.fn(async () => undefined),
  waitForSelector: vi.fn(async () => undefined),
  content: vi.fn(async () => "<html><body><main>Hello</main></body></html>"),
  closePage: vi.fn(async () => undefined),
  closeBrowser: vi.fn(async () => undefined),
}));

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(async () => ({
      newPage: async () => ({
        goto: playwrightMocks.goto,
        waitForSelector: playwrightMocks.waitForSelector,
        content: playwrightMocks.content,
        close: playwrightMocks.closePage,
      }),
      close: playwrightMocks.closeBrowser,
    })),
  },
}));

// Web capture tests require Playwright browser binaries.
// These are integration tests — skip if Playwright is not available.
describe("captureWebPage", () => {
  beforeEach(() => {
    playwrightMocks.goto.mockClear();
    playwrightMocks.waitForSelector.mockClear();
    playwrightMocks.content.mockClear();
    playwrightMocks.closePage.mockClear();
    playwrightMocks.closeBrowser.mockClear();
    playwrightMocks.closeBrowser.mockImplementation(async () => undefined);
  });

  it("should reject empty URL", async () => {
    await expect(captureWebPage("")).rejects.toThrow("URL is required");
  });

  it("should reject invalid URL", async () => {
    await expect(captureWebPage("not-a-url")).rejects.toThrow("Invalid URL");
  });

  it("should reject non-http(s) URLs", async () => {
    await expect(captureWebPage("ftp://example.com")).rejects.toThrow("Only HTTP");
  });

  it("should accept valid options shape", () => {
    // Type-level test: verify CaptureOptions and CaptureResult types compile
    const opts: CaptureOptions = {
      selector: "main",
      timeout: 5000,
      waitForSelector: ".loaded",
    };
    expect(opts.selector).toBe("main");
  });

  it("should block decimal IPv4 loopback host notation", () => {
    expect(isBlockedUrl("http://2130706433/")).toBe(true); // 127.0.0.1
  });

  it("should block hexadecimal IPv4 loopback host notation", () => {
    expect(isBlockedUrl("http://0x7f000001/")).toBe(true); // 127.0.0.1
  });

  it("should block localhost subdomains", () => {
    expect(isBlockedUrl("http://foo.localhost/")).toBe(true);
  });

  it("should not fail when browser.close times out", async () => {
    playwrightMocks.closeBrowser.mockImplementation(
      () => new Promise<void>(() => undefined),
    );

    const result = await captureWebPage("https://example.com", { closeTimeoutMs: 1 });

    expect(result.url).toBe("https://example.com");
    expect(playwrightMocks.goto).toHaveBeenCalledOnce();
  });
});
