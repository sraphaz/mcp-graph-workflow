import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { checkBuildEnvironment, runMavenBuild } from "../../core/davinci/build-runner.js";
import { validateBuildResult } from "../../core/davinci/davinci-validators.js";
import { DaVinciStore } from "../../core/davinci/davinci-store.js";
import { mcpText } from "../response-helpers.js";
import { logger } from "../../core/utils/logger.js";

export function registerDavinciBuild(server: McpServer, store: SqliteStore): void {
  server.tool(
    "davinci_build",
    "Build a DaVinci-converted Java plugin using Maven. Checks environment (JDK, Maven, SDK) and runs mvn package. Returns build status, JAR path, and environment indicators. Optionally updates a persisted job.",
    {
      projectDir: z.string().describe("Path to the Maven project directory containing pom.xml"),
      checkOnly: z.boolean().optional().describe("Only check environment, do not build (default: false)"),
      jobId: z.string().optional().describe("DaVinci job ID to update with build results"),
    },
    async ({ projectDir, checkOnly, jobId }) => {
      logger.info("davinci: build requested", { projectDir, checkOnly, jobId });

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

      // Update job status to building
      if (jobId) {
        try {
          const davinciStore = new DaVinciStore(store.getDb());
          davinciStore.updateJob(jobId, { status: "building" });
        } catch (err) {
          logger.warn("davinci: failed to update job to building", { jobId, error: String(err) });
        }
      }

      const result = await runMavenBuild(projectDir);

      // Validate build result
      const buildValidation = validateBuildResult(result);

      // Update job with build outcome
      if (jobId) {
        try {
          const davinciStore = new DaVinciStore(store.getDb());
          davinciStore.updateJob(jobId, {
            status: result.success ? "done" : "failed",
            jarPath: result.jarPath,
            buildOutput: result.stdout.slice(0, 5000),
          });
          logger.info("davinci: job build updated", { jobId, success: result.success });
        } catch (err) {
          logger.warn("davinci: failed to update job after build", { jobId, error: String(err) });
        }
      }

      return mcpText(JSON.stringify({
        ok: result.success,
        action: "build_complete",
        jobId,
        buildResult: {
          success: result.success,
          jarPath: result.jarPath,
          durationMs: result.durationMs,
          stdout: result.stdout.slice(0, 2000),
          stderr: result.stderr.slice(0, 2000),
        },
        validation: buildValidation.issues,
        environment: env,
      }, null, 2));
    },
  );
}
