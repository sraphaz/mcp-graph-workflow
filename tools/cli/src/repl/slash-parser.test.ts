/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, expect, it } from "vitest";
import { SlashParseError, parseSlash } from "./slash-parser.js";

describe("parseSlash", () => {
  it("parses a bare command", () => {
    expect(parseSlash("/help")).toEqual({
      raw: "/help",
      name: "help",
      args: [],
      flags: {},
    });
  });

  it("parses positional arguments", () => {
    expect(parseSlash("/start node_abc123")).toEqual({
      raw: "/start node_abc123",
      name: "start",
      args: ["node_abc123"],
      flags: {},
    });
  });

  it("parses --key=value flags", () => {
    expect(parseSlash("/init --type=node --name=foo")).toEqual({
      raw: "/init --type=node --name=foo",
      name: "init",
      args: [],
      flags: { type: "node", name: "foo" },
    });
  });

  it("parses --key value (separated) flags", () => {
    expect(parseSlash("/add task --title hello")).toEqual({
      raw: "/add task --title hello",
      name: "add",
      args: ["task"],
      flags: { title: "hello" },
    });
  });

  it("parses boolean flags --verbose", () => {
    expect(parseSlash("/list --verbose")).toEqual({
      raw: "/list --verbose",
      name: "list",
      args: [],
      flags: { verbose: true },
    });
  });

  it("parses short boolean flags -v", () => {
    expect(parseSlash("/list -v")).toEqual({
      raw: "/list -v",
      name: "list",
      args: [],
      flags: { v: true },
    });
  });

  it("parses quoted args with spaces", () => {
    expect(parseSlash('/add task --title "hello world"').flags.title).toBe(
      "hello world",
    );
  });

  it("parses single-quoted args", () => {
    expect(parseSlash("/add --title 'foo bar'").flags.title).toBe("foo bar");
  });

  it("supports escaped chars inside quotes", () => {
    expect(parseSlash('/echo --msg "a\\"b"').flags.msg).toBe('a"b');
  });

  it("throws on missing leading slash", () => {
    expect(() => parseSlash("help")).toThrow(SlashParseError);
  });

  it("throws on empty command", () => {
    expect(() => parseSlash("/")).toThrow(SlashParseError);
  });

  it("preserves the raw input", () => {
    const raw = "/foo bar --x=1";
    expect(parseSlash(raw).raw).toBe(raw);
  });
});
