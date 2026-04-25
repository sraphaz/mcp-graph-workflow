/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import figlet from "figlet";
import { Box, Text } from "ink";
import { PRODUCT, VERSION } from "../meta.js";

export interface BannerProps {
  readonly mode: "shell" | "repl";
  readonly subtitle?: string;
}

export function Banner({ mode, subtitle }: BannerProps) {
  const title = figlet.textSync("mcp-graph", {
    font: "Slant",
    horizontalLayout: "fitted",
  });
  const lines = title.split("\n");

  return (
    <Box flexDirection="column" marginBottom={1}>
      {lines.map((line, i) => (
        <Text key={i} color="cyan">
          {line}
        </Text>
      ))}
      <Box marginTop={1}>
        <Text color="green" bold>
          {PRODUCT}
        </Text>
        <Text dimColor>{` v${VERSION}`}</Text>
        <Text dimColor>{` · ${mode === "repl" ? "REPL" : "shell"}`}</Text>
      </Box>
      {subtitle && (
        <Text dimColor italic>
          {subtitle}
        </Text>
      )}
    </Box>
  );
}
