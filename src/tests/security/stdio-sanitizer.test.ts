/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  safeArg,
  safeArgv,
  assertCdpMethod,
} from "../../core/security/stdio-sanitizer.js";
import { StdioSanitizationError } from "../../core/utils/errors.js";

describe("safeArg (path)", () => {
  it("accepts a plain relative path", () => {
    expect(safeArg("src/foo/bar.ts", "path")).toBe("src/foo/bar.ts");
  });

  it("rejects path traversal", () => {
    expect(() => safeArg("../../../etc/passwd", "path")).toThrow(StdioSanitizationError);
  });

  it("rejects URI-style smuggling", () => {
    expect(() => safeArg("file:///etc/passwd", "path")).toThrow(StdioSanitizationError);
    expect(() => safeArg("data:text/plain,boom", "path")).toThrow(StdioSanitizationError);
  });

  it("rejects NUL bytes", () => {
    expect(() => safeArg("ok.txt\x00/etc/shadow", "path")).toThrow(StdioSanitizationError);
  });

  it("rejects non-strings", () => {
    expect(() => safeArg(undefined as unknown as string, "path")).toThrow(StdioSanitizationError);
  });
});

describe("safeArg (url)", () => {
  it("accepts https", () => {
    expect(safeArg("https://example.com/x", "url")).toBe("https://example.com/x");
  });

  it("rejects javascript: scheme", () => {
    expect(() => safeArg("javascript:alert(1)", "url")).toThrow(StdioSanitizationError);
  });

  it("rejects file: scheme", () => {
    expect(() => safeArg("file:///etc/passwd", "url")).toThrow(StdioSanitizationError);
  });

  it("rejects data: scheme", () => {
    expect(() => safeArg("data:text/html,<script>", "url")).toThrow(StdioSanitizationError);
  });

  it("rejects malformed URLs", () => {
    expect(() => safeArg("not a url", "url")).toThrow(StdioSanitizationError);
  });
});

describe("safeArg (command-arg)", () => {
  it("accepts simple alphanumeric + dashes", () => {
    expect(safeArg("--verbose", "command-arg")).toBe("--verbose");
    expect(safeArg("build-main", "command-arg")).toBe("build-main");
  });

  it("rejects shell metacharacters", () => {
    for (const bad of [";", "|", "&", "`", "$", "$(x)", "${x}", ">", "<", "\\", "\n"]) {
      expect(() => safeArg(`x${bad}y`, "command-arg")).toThrow(StdioSanitizationError);
    }
  });
});

describe("safeArg (identifier)", () => {
  it("accepts snake_case and kebab-case", () => {
    expect(safeArg("helper_one", "identifier")).toBe("helper_one");
    expect(safeArg("helper-one", "identifier")).toBe("helper-one");
  });

  it("rejects spaces and punctuation", () => {
    expect(() => safeArg("hello world", "identifier")).toThrow(StdioSanitizationError);
    expect(() => safeArg("hi!", "identifier")).toThrow(StdioSanitizationError);
  });
});

describe("safeArgv", () => {
  it("validates every entry", () => {
    expect(safeArgv(["--flag", "value-1"], "command-arg")).toEqual(["--flag", "value-1"]);
  });

  it("rejects if any entry is unsafe", () => {
    expect(() => safeArgv(["--flag", "value;rm -rf /"], "command-arg")).toThrow(StdioSanitizationError);
  });
});

describe("assertCdpMethod", () => {
  it("allows safe Page/DOM/Runtime methods", () => {
    expect(() => assertCdpMethod("Page.navigate")).not.toThrow();
    expect(() => assertCdpMethod("DOM.querySelector")).not.toThrow();
    expect(() => assertCdpMethod("Runtime.evaluate")).not.toThrow();
    expect(() => assertCdpMethod("Network.enable")).not.toThrow();
  });

  it("rejects denied methods", () => {
    expect(() => assertCdpMethod("Browser.close")).toThrow(StdioSanitizationError);
    expect(() => assertCdpMethod("Security.setIgnoreCertificateErrors")).toThrow(StdioSanitizationError);
    expect(() => assertCdpMethod("Network.setCookies")).toThrow(StdioSanitizationError);
  });

  it("rejects unknown domain prefixes", () => {
    expect(() => assertCdpMethod("Unknown.method")).toThrow(StdioSanitizationError);
  });

  it("rejects malformed method strings", () => {
    expect(() => assertCdpMethod("no-dot")).toThrow(StdioSanitizationError);
    expect(() => assertCdpMethod("")).toThrow(StdioSanitizationError);
  });
});
