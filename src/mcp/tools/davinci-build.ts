import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { checkBuildEnvironment, runMavenBuild } from "../../core/davinci/build-runner.js";
import { mcpText } from "../response-helpers.js";
import { logger } from "../../core/utils/logger.js";

export function registerDavinciBuild(server: McpServer, _store: SqliteStore): void {
  server.tool(
    "davinci_build",
    "Build a DaVinci-converted Java plugin using Maven. Checks environment (JDK, Maven, SDK) and runs mvn package. Returns build status, JAR path, and environment indicators.",
    {
      projectDir: z.string().describe("Path to the Maven project directory containing pom.xml"),
      checkOnly: z.boolean().optional().describe("Only check environment, do not build (default: false)"),
    },
    async ({ projectDir, checkOnly }) => {
      logger.info("davinci: build requested", { projectDir, checkOnly });

      const env = checkBuildEnvironment();

      if (checkOnly) {
        return mcpText(JSON.stringify({
          ok: true,
          action: "environment_check",
          environment: env,
        }, null, 2));
      }

      if (!env.readyToBuild) {
        return mcpText(JSON.stringify({
          ok: false,
          action: "build_blocked",
          reason: "Build environment not ready",
          environment: env,
          hint: env.instructions.join(" | "),
        }, null, 2));
      }

      const result = await runMavenBuild(projectDir);

      return mcpText(JSON.stringify({
        ok: result.success,
        action: "build_complete",
        buildResult: {
          success: result.success,
          jarPath: result.jarPath,
          durationMs: result.durationMs,
          stdout: result.stdout.slice(0, 2000),
          stderr: result.stderr.slice(0, 2000),
        },
        environment: env,
      }, null, 2));
    },
  );
}
