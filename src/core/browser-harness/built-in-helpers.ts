/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Seed helpers for the browser harness. Each is a string of TS source that
 * compiles inside helpers-runtime's vm sandbox. Keep these tiny — the agent
 * can self-heal anything else. Mirrors browser-harness's helpers.py stub set.
 */

import type { HelpersRegistry } from "./helpers-registry.js";
import type { HelperSignature } from "../../schemas/browser-harness.schema.js";

interface BuiltIn {
  name: string;
  source: string;
  signature: HelperSignature;
}

const BUILT_INS: BuiltIn[] = [
  {
    name: "navigate",
    source: `async (cdp, { url }) => {
      const result = await cdp.send("Page.navigate", { url });
      return { ok: true, frameId: result.frameId };
    }`,
    signature: { params: [{ name: "url", type: "string" }], returns: "{ ok: boolean, frameId: string }" },
  },
  {
    name: "evaluate",
    source: `async (cdp, { expression }) => {
      const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
      if (r.exceptionDetails) {
        return { ok: false, error: r.exceptionDetails.text || "Runtime exception" };
      }
      return { ok: true, value: r.result && r.result.value };
    }`,
    signature: { params: [{ name: "expression", type: "string" }], returns: "{ ok: boolean, value?: unknown, error?: string }" },
  },
  {
    name: "screenshot",
    source: `async (cdp, _args) => {
      const r = await cdp.send("Page.captureScreenshot", { format: "png" });
      return { ok: true, base64: r.data };
    }`,
    signature: { params: [], returns: "{ ok: boolean, base64: string }" },
  },
  {
    name: "wait_for",
    source: `async (cdp, { selector, timeoutMs }) => {
      const deadline = Date.now() + (timeoutMs || 5000);
      while (Date.now() < deadline) {
        const r = await cdp.send("Runtime.evaluate", {
          expression: "!!document.querySelector(" + JSON.stringify(selector) + ")",
          returnByValue: true,
        });
        if (r && r.result && r.result.value === true) return { ok: true };
        await new Promise((res) => setTimeout(res, 100));
      }
      return { ok: false, error: "selector not found before timeout: " + selector };
    }`,
    signature: { params: [{ name: "selector", type: "string" }, { name: "timeoutMs", type: "number" }], returns: "{ ok: boolean, error?: string }" },
  },
  {
    name: "click",
    source: `async (cdp, { selector }) => {
      const r = await cdp.send("Runtime.evaluate", {
        expression: "(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (!el) return false; el.click(); return true; })()",
        returnByValue: true,
      });
      const ok = r && r.result && r.result.value === true;
      return ok ? { ok: true } : { ok: false, error: "no element matched: " + selector };
    }`,
    signature: { params: [{ name: "selector", type: "string" }], returns: "{ ok: boolean, error?: string }" },
  },
  {
    name: "type_text",
    source: `async (cdp, { selector, text }) => {
      const expr = "(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (!el) return false; el.focus(); el.value = " + JSON.stringify(text) + "; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()";
      const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true });
      const ok = r && r.result && r.result.value === true;
      return ok ? { ok: true } : { ok: false, error: "no element matched: " + selector };
    }`,
    signature: { params: [{ name: "selector", type: "string" }, { name: "text", type: "string" }], returns: "{ ok: boolean, error?: string }" },
  },
  {
    name: "get_url",
    source: `async (cdp) => {
      const r = await cdp.send("Runtime.evaluate", { expression: "location.href", returnByValue: true });
      return { ok: true, url: r && r.result && r.result.value };
    }`,
    signature: { params: [], returns: "{ ok: boolean, url: string }" },
  },
  {
    name: "get_text",
    source: `async (cdp, { selector }) => {
      const expr = "(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); return el ? el.textContent : null; })()";
      const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true });
      return { ok: true, text: r && r.result && r.result.value };
    }`,
    signature: { params: [{ name: "selector", type: "string" }], returns: "{ ok: boolean, text: string | null }" },
  },
];

export const BUILT_IN_HELPER_NAMES: readonly string[] = BUILT_INS.map((h) => h.name);

export function seedBuiltInHelpers(registry: HelpersRegistry): number {
  let inserted = 0;
  for (const helper of BUILT_INS) {
    const existing = registry.find(helper.name);
    if (existing && existing.origin === "builtin" && existing.source === helper.source) continue;
    registry.upsert({
      name: helper.name,
      source: helper.source,
      signature: helper.signature,
      origin: "builtin",
      createdBy: null,
    });
    inserted++;
  }
  return inserted;
}
