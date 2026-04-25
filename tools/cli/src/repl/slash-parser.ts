/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Parser for REPL slash commands. Accepts `/cmd arg1 arg2 --flag=value -x`.
 *
 * Behaviour mirrors a tiny shell parser:
 *   - first token after `/` is the command name
 *   - positional args follow until a flag is seen
 *   - `--key=value` and `--key value` both supported
 *   - boolean flags (`-v`, `--verbose`) become `{verbose: true}`
 *   - quoted values supported: `--text "hello world"`
 */

export interface ParsedSlash {
  readonly raw: string;
  readonly name: string;
  readonly args: readonly string[];
  readonly flags: Readonly<Record<string, string | boolean>>;
}

export class SlashParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlashParseError";
  }
}

export function parseSlash(input: string): ParsedSlash {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    throw new SlashParseError(`expected leading '/': ${input}`);
  }
  const tokens = tokenize(trimmed.slice(1));
  if (tokens.length === 0) {
    throw new SlashParseError("empty slash command");
  }
  const [name, ...rest] = tokens;
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith("--")) {
      const body = token.slice(2);
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
    } else if (token.startsWith("-") && token.length > 1) {
      const body = token.slice(1);
      flags[body] = true;
    } else {
      args.push(token);
    }
  }

  return { raw: input, name, args, flags };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let buf = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t") {
      if (buf.length > 0) {
        tokens.push(buf);
        buf = "";
      }
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\" && i + 1 < input.length) {
          buf += input[i + 1];
          i += 2;
          continue;
        }
        buf += input[i];
        i++;
      }
      if (i < input.length && input[i] === quote) i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf.length > 0) tokens.push(buf);
  return tokens;
}
