---
name: browser-harness
description: Safety and behaviour rules for the direct-CDP browser harness. The agent has complete freedom inside this fence.
triggers:
  - browser-harness
  - bh
version: 1.0.0
allowedDomains:
  - "*"
forbiddenCdpMethods:
  - Browser.close
  - Security.setIgnoreCertificateErrors
  - Network.setCookies
  - Network.clearBrowserCookies
selfHealPolicy:
  requireTest: false
  maxSourceBytes: 4096
  forbiddenApis:
    - fs
    - child_process
    - process
    - eval
    - require
---

# Browser Harness Guardrails

Direct Chrome DevTools Protocol harness — one websocket, no framework. The
agent writes what's missing mid-task and keeps going.

## When to Self-Heal

If a `call_helper` returns `helper_not_found`, you may submit a new helper via
`action: "add_helper"`. Keep helpers small (< 4 KB), pure, and safe.

## Helper Contract

Every helper is an **async function expression** of shape:

```ts
async (cdp, args) => {
  const r = await cdp.send("Page.navigate", { url: args.url });
  return { ok: true, frameId: r.frameId };
}
```

- First arg is a `cdp` client with `.send(method, params): Promise<result>`.
- Second arg is a plain object — destructure your params.
- Always return `{ ok: boolean, ...payload }` so the runner can grade it.
- On failure return `{ ok: false, error: "..." }` — do not throw.

## Forbidden in Helpers

- `require`, `import()`, `process`, `child_process`, `globalThis`, `eval`, `Function(...)`.
- File-system access, network outside CDP, environment reads.
- CDP methods listed in `forbiddenCdpMethods` above.

## Naming

- snake_case: `upload_file`, `wait_for_redirect`.
- Single-purpose verbs that read like UI actions.

## Screenshot Discipline

Take a screenshot **after every state-changing step**. The harness does this
automatically for the report — but if you're writing a custom helper that
performs multiple sub-actions, call `Page.captureScreenshot` between them.

## Domain Allowlist

Edit `allowedDomains` above to constrain `navigate` calls. Use `"*"` for
local development, then narrow to e.g. `["*.your-app.com", "localhost"]`
before pointing the harness at production browsers.
