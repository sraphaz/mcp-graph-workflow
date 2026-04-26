/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { Box, Text } from "ink";
import { fingerprintProject } from "../core/init/detect.js";
import {
  type ScaffoldChange,
  scaffoldProject,
} from "../core/init/scaffold.js";
import { syncConfigs } from "../core/init/sync-configs.js";
import { t } from "../i18n/index.js";
import {
  ParentNotInstalledError,
  getParentRuntime,
} from "../core/parent-bridge.js";

interface ParentStoreModule {
  SqliteStore: {
    open(basePath?: string): {
      initProject(name?: string): unknown;
      close(): void;
    };
  };
}
import type {
  CommandHandlerArgs,
  CommandHandlerResult,
} from "./registry.js";

export async function runInit(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  const cwd = process.cwd();
  const force = Boolean(ctx.flags.force);

  const fp = fingerprintProject(cwd);
  const result = scaffoldProject(cwd, { force });
  const configs = syncConfigs(cwd, { force });
  const allChanges = [...result.changes, ...configs.changes];
  const projectInit = await bootstrapParentProject(cwd, fp.packageName);
  if (projectInit) allChanges.push(projectInit);

  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: {
        cwd,
        projectType: fp.projectType,
        ides: fp.ides,
        packageName: fp.packageName,
        changes: allChanges,
        nextSteps: nextStepsList(),
      },
    };
  }

  const element = (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text color="green" bold>
          {t("init.success")}
        </Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text>
          <Text dimColor>{t("init.projectLabel")}</Text>
          <Text>{fp.packageName ?? cwd.split("/").pop()}</Text>
          <Text dimColor>{t("init.typeLabel")}</Text>
          <Text>{fp.projectType}</Text>
          <Text dimColor>{t("init.ideLabel")}</Text>
          <Text>{fp.ides.length === 0 ? t("init.ideNone") : fp.ides.join(", ")}</Text>
        </Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>{t("init.changesHeader")}</Text>
        {allChanges.map((c) => (
          <Text key={c.path}>
            <Text color={colorFor(c.action)}>{labelFor(c.action)}</Text>
            <Text>{` ${c.path}`}</Text>
          </Text>
        ))}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text bold>{t("init.nextStepsHeader")}</Text>
        {nextStepsList().map((s, i) => (
          <Text key={i}>
            <Text color="cyan">  {i + 1}. </Text>
            <Text>{s}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  );

  return { exitCode: 0, element };
}

async function bootstrapParentProject(
  cwd: string,
  name: string | undefined,
): Promise<ScaffoldChange | null> {
  try {
    const parent = await getParentRuntime();
    const mod = (await parent.loadStore()) as ParentStoreModule;
    const store = mod.SqliteStore.open(cwd);
    try {
      store.initProject(name ?? cwd.split("/").pop() ?? "project");
    } finally {
      try {
        store.close();
      } catch {
        // ignore
      }
    }
    return {
      path: `${cwd}/workflow-graph/graph.db`,
      action: "patched",
      bytes: 0,
    };
  } catch (err) {
    if (err instanceof ParentNotInstalledError) {
      // Parent runtime missing — graph features won't work yet. Skip silently;
      // the next-steps card already points at the install hint.
      return null;
    }
    return null;
  }
}

function colorFor(action: ScaffoldChange["action"]): string {
  switch (action) {
    case "created":
      return "green";
    case "patched":
      return "yellow";
    case "skipped-existing":
    case "skipped-noop":
      return "gray";
  }
}

function labelFor(action: ScaffoldChange["action"]): string {
  switch (action) {
    case "created":
      return "+ created     ";
    case "patched":
      return "~ patched     ";
    case "skipped-existing":
      return "· kept (yours)";
    case "skipped-noop":
      return "· in-sync     ";
  }
}

function nextStepsList(): readonly string[] {
  return [
    "mcp-graph login   — authenticate with GitHub Copilot (terminal-only flow)",
    "mcp-graph next    — show the first task from PRD.md",
    "mcp-graph ui      — open the dashboard at http://localhost:3000",
    "mcp-graph demo    — guided 60-second tour with a sample project",
  ];
}
