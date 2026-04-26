/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { Box, Text } from "ink";
import { createDemoSandbox } from "../core/init/demo-sandbox.js";
import { t } from "../i18n/index.js";
import type {
  CommandHandlerArgs,
  CommandHandlerResult,
} from "./registry.js";

/**
 * `/demo` · `mcp-graph demo` — zero-config first-value tour.
 *
 * Creates an ephemeral sandbox under `~/.mcp-graph/demos/<stamp>/` with a
 * pre-imported sample PRD. The user can `cd` into the sandbox and run
 * `mcp-graph next`, `mcp-graph ui`, etc. to feel the workflow without polluting their
 * own repo. Optional cleanup with `--cleanup` flag (otherwise the dir stays
 * for revisits).
 */

export async function runDemo(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  const sandbox = createDemoSandbox();

  if (ctx.flags.cleanup) {
    sandbox.cleanup();
    return {
      exitCode: 0,
      text: `removed ${sandbox.path}`,
    };
  }

  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: {
        sandbox: sandbox.path,
        changes: sandbox.scaffold.changes,
        nextSteps: nextStepsList(sandbox.path),
      },
    };
  }

  const element = (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text color="green" bold>
          {t("demo.ready")}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{t("demo.locationLabel")}</Text>
        <Text>{sandbox.path}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text bold>{t("demo.tryHeader")}</Text>
        {nextStepsList(sandbox.path).map((step, i) => (
          <Text key={i}>
            <Text color="cyan">  {i + 1}. </Text>
            <Text>{step}</Text>
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {t("demo.cleanupHint", { path: sandbox.path })}
        </Text>
      </Box>
    </Box>
  );

  return { exitCode: 0, element };
}

function nextStepsList(sandbox: string): readonly string[] {
  return [
    `cd ${sandbox}`,
    "mcp-graph next     — see the first task from the sample PRD",
    "mcp-graph ui       — open the dashboard at http://localhost:3000",
    "mcp-graph start <id>  → mcp-graph finish   — close the loop",
  ];
}
