/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { Box, Text, useApp, useInput, useStdin } from "ink";
import { useEffect, useRef, useState } from "react";
import { Banner } from "../ui/banner.js";
import {
  type CommandHandlerResult,
  findCommandBySlash,
  fuzzyMatchCommands,
} from "../commands/registry.js";
import { t } from "../i18n/index.js";
import {
  appendHistory,
  compactHistory,
  loadHistory,
} from "./persistent-history.js";
import { SlashParseError, parseSlash } from "./slash-parser.js";

interface HistoryEntry {
  readonly id: number;
  readonly raw: string;
  readonly result: CommandHandlerResult;
}

export function ReplApp(): JSX.Element {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [counter, setCounter] = useState(0);

  // Sprint 7 #7.12 — persistent command history with up/down arrow
  // navigation. `pastCmds` holds chronological order (oldest first);
  // `navIndex` is the current cursor offset from the end (0 = present
  // input, 1 = most recent past command, …). `lastAppendedRef` lets
  // appendHistory dedup adjacent repeats cheaply.
  const [pastCmds, setPastCmds] = useState<readonly string[]>([]);
  const [navIndex, setNavIndex] = useState(0);
  const lastAppendedRef = useRef<string | undefined>(undefined);
  const draftRef = useRef<string>(""); // input the user was typing before scrolling

  useEffect(() => {
    compactHistory();
    setPastCmds(loadHistory());
  }, []);

  const completions = input.startsWith("/")
    ? fuzzyMatchCommands(input.slice(1), 5)
    : [];

  useInput(async (ch, key) => {
    if (busy) return;

    // Sprint 7 #7.12 — up/down navigation through pastCmds. Holding
    // upArrow walks toward the oldest entry; downArrow walks back
    // toward the present. When the cursor returns to 0 the previously-
    // typed draft is restored so we never silently eat input.
    if (key.upArrow) {
      if (pastCmds.length === 0) return;
      if (navIndex === 0) draftRef.current = input;
      const next = Math.min(navIndex + 1, pastCmds.length);
      setNavIndex(next);
      setInput(pastCmds[pastCmds.length - next] ?? "");
      return;
    }
    if (key.downArrow) {
      if (navIndex === 0) return;
      const next = navIndex - 1;
      setNavIndex(next);
      setInput(next === 0 ? draftRef.current : (pastCmds[pastCmds.length - next] ?? ""));
      return;
    }

    if (key.return) {
      const raw = input.trim();
      if (!raw) return;
      setInput("");
      // Persist + reset navigation state on submission.
      appendHistory(raw, lastAppendedRef.current);
      lastAppendedRef.current = raw;
      setPastCmds((prev) => [...prev, raw]);
      setNavIndex(0);
      draftRef.current = "";

      if (!raw.startsWith("/")) {
        setHistory((h) => [
          ...h,
          {
            id: counter,
            raw,
            result: {
              exitCode: 1,
              text: `(input ignored) commands must start with /  ·  try /help`,
            },
          },
        ]);
        setCounter((c) => c + 1);
        return;
      }

      let parsed;
      try {
        parsed = parseSlash(raw);
      } catch (err) {
        const msg = err instanceof SlashParseError ? err.message : String(err);
        setHistory((h) => [
          ...h,
          {
            id: counter,
            raw,
            result: { exitCode: 1, text: `parse error: ${msg}` },
          },
        ]);
        setCounter((c) => c + 1);
        return;
      }

      const cmd = findCommandBySlash(parsed.name);
      if (!cmd) {
        const suggestions = fuzzyMatchCommands(parsed.name, 3)
          .map((c) => `/${c.slashAliases[0] ?? c.id}`)
          .join(", ");
        const parts = [t("error.unknownCommand", { cmd: `/${parsed.name}` })];
        if (suggestions) parts.push(t("error.didYouMean", { hits: suggestions }));
        setHistory((h) => [
          ...h,
          {
            id: counter,
            raw,
            result: { exitCode: 1, text: parts.join("\n") },
          },
        ]);
        setCounter((c) => c + 1);
        return;
      }

      if (cmd.id === "exit") {
        exit();
        return;
      }

      setBusy(true);
      try {
        const result = await cmd.handler({
          args: parsed.args,
          flags: parsed.flags,
          mode: "repl",
          traceId: cryptoRandomId(),
        });
        setHistory((h) => [...h, { id: counter, raw, result }]);
        setCounter((c) => c + 1);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setHistory((h) => [
          ...h,
          {
            id: counter,
            raw,
            result: { exitCode: 1, text: `handler error: ${msg}` },
          },
        ]);
        setCounter((c) => c + 1);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (key.backspace || key.delete) {
      setInput((s) => s.slice(0, -1));
      return;
    }

    if (key.ctrl && ch === "c") {
      exit();
      return;
    }

    if (ch && !key.escape) {
      setInput((s) => s + ch);
    }
  });

  return (
    <Box flexDirection="column">
      <Banner mode="repl" subtitle={'type "/help" to list commands  ·  /exit to leave'} />
      {history.map((h) => (
        <Box key={h.id} flexDirection="column" marginBottom={1}>
          <Box>
            <Text color="cyan">▸ </Text>
            <Text>{h.raw}</Text>
          </Box>
          {h.result.element ?? (
            <Text color={h.result.exitCode === 0 ? "white" : "red"}>
              {h.result.text ?? JSON.stringify(h.result.json ?? "", null, 2)}
            </Text>
          )}
        </Box>
      ))}
      <Box>
        <Text color={busy ? "yellow" : "cyan"}>
          {busy ? "⏳ " : "▸ "}
        </Text>
        <Text>{input}</Text>
        <Text color="cyan">▮</Text>
      </Box>
      {completions.length > 0 && input.length > 1 && !busy && (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          {completions.map((c) => (
            <Box key={c.id}>
              <Box width={20}>
                <Text color="green">/{c.slashAliases[0] ?? c.id}</Text>
              </Box>
              <Text dimColor>{c.description}</Text>
            </Box>
          ))}
        </Box>
      )}
      {!isRawModeSupported && (
        <Box marginTop={1}>
          <Text color="red">
            (terminal does not support raw input — REPL needs an interactive
            TTY; use shell mode instead)
          </Text>
        </Box>
      )}
    </Box>
  );
}

function cryptoRandomId(): string {
  // lightweight; full UUID via crypto.randomUUID (Node 20+)
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}
