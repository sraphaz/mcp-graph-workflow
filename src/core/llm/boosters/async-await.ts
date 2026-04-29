/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T05d — Booster transform: async-await.
 *
 * Pure: detects simple `return X.then(arrow)` patterns at the top of
 * exported async functions and rewrites them to `const Y = await X; return
 * arrow(Y);`. Conservative — only safe shapes:
 *   - return EXPR.then((arg) => body)   (single .then, single arg)
 *   - return EXPR.then(handler)          (named handler)
 *
 * Preserves Promise.all/race/allSettled (no rewrite). Skips chains with
 * .catch/.finally (those need explicit try/catch and are out of scope for
 * a regex transform). Caller (booster-runner) gates by file kind.
 */

const RETURN_SINGLE_THEN_ARROW =
  /^(?<indent>[ \t]*)return\s+(?<expr>[a-zA-Z_$][\w$.()'"`]*?)\.then\(\((?<arg>[a-zA-Z_$][\w$]*)\)\s*=>\s*(?<body>[^)]+)\);?\s*$/gm;

export interface AsyncAwaitResult {
  output: string;
  rewritten: number;
  preservedPromiseAll: boolean;
  skippedChains: number;
}

function looksLikePromiseAll(line: string): boolean {
  return /Promise\.(all|race|allSettled|any)\b/.test(line);
}

function hasUnsafeMethod(line: string): boolean {
  return /\.(catch|finally)\(/.test(line);
}

export function asyncAwait(source: string): AsyncAwaitResult {
  let rewritten = 0;
  let skippedChains = 0;

  const out = source.replace(
    RETURN_SINGLE_THEN_ARROW,
    (full, ...captures) => {
      const groups = captures[captures.length - 1] as {
        indent: string;
        expr: string;
        arg: string;
        body: string;
      };
      if (looksLikePromiseAll(groups.expr) || hasUnsafeMethod(full)) {
        skippedChains++;
        return full;
      }
      rewritten++;
      const tmp = groups.arg;
      return [
        `${groups.indent}const ${tmp} = await ${groups.expr};`,
        `${groups.indent}return ${groups.body.trim()};`,
      ].join("\n");
    },
  );

  const preservedPromiseAll = /Promise\.(all|race|allSettled|any)\b/.test(out);

  return {
    output: out,
    rewritten,
    preservedPromiseAll,
    skippedChains,
  };
}
