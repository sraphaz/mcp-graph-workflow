import { describe, it, expect } from "vitest";
import { encodeFrame, FrameBuffer } from "../../core/daemon/daemon-protocol.js";

describe("encodeFrame", () => {
  it("emits a newline-delimited JSON frame", () => {
    expect(encodeFrame({ jsonrpc: "2.0", id: 1, method: "ping" })).toBe(
      '{"jsonrpc":"2.0","id":1,"method":"ping"}\n',
    );
  });

  it("escapes embedded newlines so they do not break framing", () => {
    const frame = encodeFrame({ text: "line1\nline2" });
    // The frame itself ends in exactly one '\n' — any '\n' inside the JSON
    // string must have been escaped to '\\n' by JSON.stringify.
    const newlineCount = (frame.match(/\n/g) ?? []).length;
    expect(newlineCount).toBe(1);
    expect(frame).toMatch(/\\n/);
  });
});

describe("FrameBuffer", () => {
  it("parses a single complete frame", () => {
    const buf = new FrameBuffer();
    const msgs = buf.feed('{"id":1}\n');
    expect(msgs).toEqual([{ id: 1 }]);
  });

  it("parses multiple frames from one chunk", () => {
    const buf = new FrameBuffer();
    const msgs = buf.feed('{"id":1}\n{"id":2}\n');
    expect(msgs).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("holds incomplete frames and emits them once terminated", () => {
    const buf = new FrameBuffer();
    expect(buf.feed('{"id":')).toEqual([]);
    expect(buf.feed("1}")).toEqual([]);
    expect(buf.feed("\n")).toEqual([{ id: 1 }]);
  });

  it("drops empty lines (keepalive noise)", () => {
    const buf = new FrameBuffer();
    expect(buf.feed("\n\n\n")).toEqual([]);
  });

  it("throws on malformed JSON frames", () => {
    const buf = new FrameBuffer();
    expect(() => buf.feed("not-json\n")).toThrow(/invalid json frame/i);
  });

  it("preserves remainder across feed calls after a malformed frame recovers via reset", () => {
    const buf = new FrameBuffer();
    expect(() => buf.feed("bad\n")).toThrow();
    buf.reset();
    expect(buf.feed('{"ok":true}\n')).toEqual([{ ok: true }]);
  });

  it("pending() reports in-progress data", () => {
    const buf = new FrameBuffer();
    buf.feed('{"partial":');
    expect(buf.pending()).toBe('{"partial":');
  });
});

describe("roundtrip", () => {
  it("encode then decode reproduces the original object", () => {
    const buf = new FrameBuffer();
    const original = { jsonrpc: "2.0", id: 42, result: { a: 1, nested: { arr: [1, 2, 3] } } };
    const msgs = buf.feed(encodeFrame(original));
    expect(msgs).toEqual([original]);
  });
});
