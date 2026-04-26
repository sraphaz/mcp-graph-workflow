/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Entry point: routes between REPL (interactive) and shell (one-shot).
 *
 * No args                   → REPL mode (Ink interactive)
 * `<bin> <cmd> [args]`      → shell mode (find handler, run, print, exit)
 * `<bin> --version`         → version flag
 * `<bin> --help`            → help flag
 *
 * Invoked as a library by the parent `@mcp-graph-workflow/mcp-graph` package's
 * `mcp-graph` bin (via spawn). v12+ no longer ships its own bin.
 */

import { render } from "ink";
import { ReplApp } from "./repl/host.js";
import { registerBuiltinCommands } from "./commands/builtins.js";
import {
  findCommandByShell,
  fuzzyMatchCommands,
} from "./commands/registry.js";
import { listCommands } from "./commands/registry.js";
import { resolveLang, setActiveLang, t } from "./i18n/index.js";
import { VERSION } from "./meta.js";

async function runShellCommand(
  argv: string[],
): Promise<number> {
  const [head, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const args: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i];
    if (tok.startsWith("--")) {
      const body = tok.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else {
        const next = rest[i + 1];
        if (next !== undefined && !next.startsWith("-")) {
          flags[body] = next;
          i++;
        } else {
          flags[body] = true;
        }
      }
    } else if (tok.startsWith("-") && tok.length > 1) {
      flags[tok.slice(1)] = true;
    } else {
      args.push(tok);
    }
  }

  if (head === "--version" || head === "-v") {
    process.stdout.write(`mcp-graph-cli v${VERSION}\n`);
    return 0;
  }

  if (head === "--help" || head === "-h") {
    return runShellHelp();
  }

  const cmd = findCommandByShell(head);
  if (!cmd) {
    const hits = fuzzyMatchCommands(head, 3)
      .map((c) => `mg ${c.shellAliases[0] ?? c.id}`)
      .join(", ");
    const lines = [t("error.unknownCommand", { cmd: head })];
    if (hits) lines.push(t("error.didYouMean", { hits }));
    lines.push("  try: mg --help");
    process.stderr.write(`${lines.join("\n")}\n`);
    return 2;
  }

  const result = await cmd.handler({
    args,
    flags,
    mode: "shell",
    traceId:
      globalThis.crypto?.randomUUID?.() ??
      Math.random().toString(36).slice(2),
  });

  if (flags.json && result.json !== undefined) {
    process.stdout.write(`${JSON.stringify(result.json)}\n`);
  } else if (result.text) {
    process.stdout.write(`${result.text}\n`);
  } else if (result.element) {
    const { unmount, waitUntilExit } = render(result.element, {
      exitOnCtrlC: true,
    });
    await waitUntilExit();
    unmount();
  }

  return result.exitCode ?? 0;
}

function runShellHelp(): number {
  const cmds = listCommands();
  const lines = [
    `mcp-graph-cli v${VERSION} — ${t("help.tagline")}`,
    "",
    t("help.usageHeader"),
    t("help.usage1"),
    t("help.usage2"),
    "",
    t("help.commandsHeader"),
  ];
  const cats = new Map<string, string[]>();
  for (const c of cmds) {
    if (c.hidden) continue;
    const arr = cats.get(c.category) ?? [];
    const desc = t(`cmd.${c.id}.description`);
    // t() returns the key literal when the translation is missing — fall back
    // to the registry's static description so registry consumers still get
    // a useful string for commands without a dictionary entry.
    const display = desc === `cmd.${c.id}.description` ? c.description : desc;
    arr.push(`  mg ${(c.shellAliases[0] ?? c.id).padEnd(16)} ${display}`);
    cats.set(c.category, arr);
  }
  for (const [cat, list] of cats.entries()) {
    lines.push("", `[${cat}]`);
    lines.push(...list);
  }
  lines.push("", t("help.replHint"), t("help.docsHint"));
  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}

async function main(): Promise<number> {
  registerBuiltinCommands();

  const argv = process.argv.slice(2);
  const langFromFlag = extractLangFlag(argv);
  setActiveLang(resolveLang({ cliFlag: langFromFlag }));
  if (argv.length === 0) {
    // REPL mode
    const { waitUntilExit } = render(<ReplApp />, { exitOnCtrlC: true });
    await waitUntilExit();
    return 0;
  }
  return runShellCommand(argv);
}

function extractLangFlag(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === "--lang" && argv[i + 1]) return argv[i + 1];
    if (tok.startsWith("--lang=")) return tok.slice("--lang=".length);
  }
  return undefined;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(
      `\n✗ ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(2);
  });
