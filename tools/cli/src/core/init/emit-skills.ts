/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ScaffoldChange } from "./scaffold.js";

/**
 * Emit Claude Code skill files into `.claude/skills/`.
 *
 * Skills are markdown files that Claude Code surfaces as `/<skill-name>`
 * autocomplete entries. Each skill teaches Claude how/when to invoke a
 * matching `mg <cmd>` action so the conversational and CLI surfaces stay
 * in lockstep (three-mode parity, ADR-0053).
 */

export interface SkillEmitOptions {
  readonly force?: boolean;
  readonly dryRun?: boolean;
}

interface SkillTemplate {
  readonly name: string;
  readonly body: string;
}

const TEMPLATES: ReadonlyArray<SkillTemplate> = [
  {
    name: "browser-harness",
    body: `---
name: browser-harness
description: Direct CDP browser automation via the local Chrome DevTools harness. Use when the user asks to navigate, screenshot, find elements, or run JavaScript in a real browser.
---

# /browser-harness

This skill mirrors the \`mcp-graph harness\` CLI command and the parent's MCP \`browser_harness\` tool. Use it when the user wants to:

- "open a browser at <url>"
- "take a screenshot of <site>"
- "find the <element> on <site>"
- "click <selector>"
- "run JavaScript in the browser"
- debug a page that's already open in Chrome (CDP attached)

## Pre-flight

Before any action, verify Chrome is running with remote debugging enabled. If not, instruct the user:

\`\`\`bash
open -na "Google Chrome" --args --remote-debugging-port=9222
# then visit http://localhost:9222/json/version to grab the webSocketDebuggerUrl
\`\`\`

Use the \`webSocketDebuggerUrl\` value (looks like \`ws://127.0.0.1:9222/devtools/browser/<UUID>\`) as the \`--cdp\` argument.

## Action map

| Intent | Command |
|---|---|
| List installed helpers | \`mcp-graph harness list\` |
| Open a session | \`mcp-graph harness start --cdp <ws-url>\` |
| Close a session | \`mcp-graph harness stop --sid <id>\` |
| Call a helper | \`mcp-graph harness call <name> --sid <id> --args '{"k":"v"}'\` |
| Raw CDP method | \`mcp-graph harness cdp Page.navigate --sid <id> --params '{"url":"https://…"}'\` |
| Register a new helper | \`mcp-graph harness add <name> --sid <id> --source helpers/<name>.ts\` |
| List active sessions | \`mcp-graph harness sessions\` |

## Safety rules (non-negotiable)

These come from \`.claude/rules/browser-pilot.md\`:

- **Never invoke \`Browser.close\`.** It's in \`forbiddenCdpMethods\`; the runtime will reject. Don't attempt it.
- **Never log the full CDP wsEndpoint** in chat output. Mask the UUID portion as \`/devtools/browser/<redacted>\` when echoing.
- **Never echo bearer tokens or session cookies.** If you observe one in a CDP response, redact before showing the user.
- **Respect \`allowedDomains\`.** If the user requests a domain not in their config's allow-list, surface \`domain_blocked\` and stop.
- **Hard cap on steps.** Default \`maxSteps=25\`. Don't loop past it.

## Output style

- Use \`--json\` when scripting a multi-step plan; parse the structured response.
- For interactive answers, summarise the helper result; show the first 20 lines and offer \`--json\` for full output.
- Always announce the \`sessionId\` once per session so the user can manually stop it later.

## Failure modes

- **Helper not found**: respond with \`mcp-graph harness add <name> --source ...\` to register it, or fall back to \`mcp-graph harness cdp <method>\` if a built-in CDP call works.
- **Session not found**: ask the user to \`mcp-graph harness start\` first, or list sessions with \`mcp-graph harness sessions\`.
- **Forbidden method**: explain which method tripped the safety check and suggest a non-destructive alternative.
- **Bridge unreachable**: this skill does NOT depend on the Copilot bridge; if the harness errors, it's about Chrome / CDP, not the LLM gateway.

## When NOT to use this skill

- The user just wants a static page rendered (use \`fetch\` / \`curl\` instead).
- The page is publicly available and you don't need to interact (use a browser-less HTTP fetch).
- The user is asking about UI design — that's Figma / design-context work, not CDP.
`,
  },
];

export function emitSkills(
  cwd: string,
  opts: SkillEmitOptions = {},
): ScaffoldChange[] {
  const out: ScaffoldChange[] = [];
  for (const tpl of TEMPLATES) {
    out.push(emitSkill(cwd, tpl, opts));
  }
  return out;
}

function emitSkill(
  cwd: string,
  tpl: SkillTemplate,
  opts: SkillEmitOptions,
): ScaffoldChange {
  const path = join(cwd, ".claude", "skills", `${tpl.name}.md`);
  const exists = existsSync(path);
  if (exists && !opts.force) {
    const current = readFileSync(path, "utf8");
    if (current === tpl.body) {
      return { path, action: "skipped-noop", bytes: current.length };
    }
    return { path, action: "skipped-existing", bytes: current.length };
  }
  if (!opts.dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, tpl.body, "utf8");
  }
  return {
    path,
    action: exists ? "patched" : "created",
    bytes: tpl.body.length,
  };
}
