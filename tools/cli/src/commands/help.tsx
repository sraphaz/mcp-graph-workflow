/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { Box, Text } from "ink";
import {
  type CommandDefinition,
  type CommandHandlerArgs,
  type CommandHandlerResult,
  fuzzyMatchCommands,
  listCommands,
} from "./registry.js";

const CATEGORY_ORDER: Array<readonly [string, string]> = [
  ["lifecycle", "Lifecycle"],
  ["graph", "Graph"],
  ["browser", "Browser"],
  ["auth", "Auth"],
  ["ops", "Ops"],
  ["meta", "Meta"],
];

export function renderHelp(ctx: CommandHandlerArgs): CommandHandlerResult {
  const query = ctx.args[0] ?? "";
  const matched = query ? fuzzyMatchCommands(query) : listCommands();

  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: matched.map((c) => ({
        id: c.id,
        description: c.description,
        usage: c.usage,
        slash: c.slashAliases,
        shell: c.shellAliases,
        category: c.category,
      })),
    };
  }

  const grouped = new Map<string, CommandDefinition[]>();
  for (const cmd of matched) {
    const arr = grouped.get(cmd.category) ?? [];
    arr.push(cmd);
    grouped.set(cmd.category, arr);
  }

  return {
    exitCode: 0,
    element: (
      <Box flexDirection="column">
        <Text bold>
          {query ? `Commands matching "${query}":` : "Available commands:"}
        </Text>
        {CATEGORY_ORDER.filter(([k]) => grouped.has(k)).map(([k, label]) => (
          <Box key={k} flexDirection="column" marginTop={1}>
            <Text color="cyan" bold>
              {label}
            </Text>
            {(grouped.get(k) ?? []).map((c) => (
              <Box key={c.id} paddingLeft={2}>
                <Box width={28}>
                  <Text color="green">/{c.slashAliases[0] ?? c.id}</Text>
                  <Text dimColor> · mg {c.shellAliases[0] ?? c.id}</Text>
                </Box>
                <Text>{c.description}</Text>
              </Box>
            ))}
          </Box>
        ))}
        {matched.length === 0 && (
          <Text color="yellow">No commands matched "{query}".</Text>
        )}
      </Box>
    ),
  };
}
