# Bug-hunt regression tests

Each file in this directory locks in the fix for one finding from the v13.3.x
bug-hunt notebook (mcp-graph epic `node_4e5847d6d9ac`). Naming convention:

```
src/tests/bug-hunt/B<NN>-<short-slug>.test.ts
```

For example: `B11-corrupt-db-friendly-error.test.ts`.

## Authoring rules

1. **Every test starts from the public observable** — `mcp-graph` CLI exit code,
   MCP JSON-RPC response, HTTP status, console log line. No reaching into private
   internals if the user-visible surface can prove the same invariant.
2. **Repro mirrors the bug-hunt node** — the test description quotes the
   `Repro:` block from the corresponding mcp-graph node verbatim, so a future
   reader can map test → finding without leaving the file.
3. **Anti-hallucination**: comments and assertions refer to concrete values
   (file paths, exit codes, JSON keys) — no banned phrases (see
   `.claude/rules/anti-hallucination.md`).
4. **Use `repro.ts` helpers** for `runCli` / `runMcpRpc` / `httpProbe` so exit
   codes, stdout, and stderr stay separated. Lesson from batch 1: piping CLI
   output through `| tail` masked exit codes and produced 3 false-positive
   bugs (B8, B9, B16). The helpers force `> stdout 2> stderr; exit=$?` style
   capture.
5. **One `it()` per behavior**, one assertion per finding. If a fix touches two
   surfaces, one test file may have multiple `it()` blocks but each maps to a
   distinct mcp-graph node.

## Running

```bash
# Single bug
npx vitest run src/tests/bug-hunt/B11-*.test.ts

# All bug-hunt regression tests
npx vitest run src/tests/bug-hunt/
```

The bug-hunt suite is part of the regular `npm test` run; these are not
quarantined.
