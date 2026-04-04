import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { parseDaVinciCode } from "../../core/davinci/davinci-parser.js";
import type { TargetSdk } from "../../core/davinci/pom-generator.js";
import { validatePreConversion, validatePostGeneration } from "../../core/davinci/davinci-validators.js";
import { generateGuiDescriptor, generatePfInfDescriptor } from "../../core/davinci/descriptor-generator.js";
import { generatePlugin } from "../../core/davinci/plugin-generator.js";
import { DaVinciStore } from "../../core/davinci/davinci-store.js";
import { mcpText } from "../response-helpers.js";
import { logger } from "../../core/utils/logger.js";

export function registerDavinciConvert(server: McpServer, store: SqliteStore): void {
  server.tool(
    "davinci_convert",
    "Convert DaVinci JavaScript code to PingAccess/PingFederate Java plugin. Generates Java class structure, POM.xml, and PF-INF descriptor. Validates input/output and persists job history.",
    {
      code: z.string().describe("DaVinci JavaScript code to convert"),
      pluginName: z.string().describe("Plugin name (kebab-case, e.g. 'my-auth-adapter')"),
      packageName: z.string().describe("Java package name (e.g. 'com.example.adapter')"),
      className: z.string().describe("Java class name (e.g. 'MyAuthAdapter')"),
      targetSdk: z.enum(["pingfederate", "pingaccess"]).optional()
        .describe("Target SDK (default: pingfederate)"),
      pluginType: z.string().optional()
        .describe("Override plugin type (e.g. 'idp-adapter', 'token-generator')"),
    },
    async ({ code, pluginName, packageName, className, targetSdk, pluginType }) => {
      logger.info("davinci: converting code", { pluginName, targetSdk });

      const sdk: TargetSdk = targetSdk ?? "pingfederate";

      // 1. Parse and analyze
      const analysis = parseDaVinciCode(code);

      // 2. Pre-conversion validation
      const preValidation = validatePreConversion(code, analysis);
      if (!preValidation.valid) {
        return mcpText(JSON.stringify({
          ok: false,
          action: "validation_failed",
          phase: "pre_conversion",
          issues: preValidation.issues,
          hint: "Fix the errors above before conversion.",
        }, null, 2));
      }

      // 3. Generate plugin via full pipeline
      const pluginResult = generatePlugin({
        code,
        pluginName,
        packageName,
        className,
        targetSdk: sdk,
        pluginType,
      });

      // 4. Post-generation validation
      const postValidation = validatePostGeneration(pluginResult);

      // 5. Generate rich GUI descriptor
      const guiDescriptor = generateGuiDescriptor(analysis.variables);

      // 6. Generate PF-INF descriptor
      const pfInfDescriptor = generatePfInfDescriptor(
        pluginResult.pluginType,
        packageName,
        className,
      );

      // 7. Persist job to store
      let jobId: string | undefined;
      try {
        const davinciStore = new DaVinciStore(store.getDb());
        const job = davinciStore.createJob({
          sourceCode: code,
          pluginType: pluginResult.pluginType,
          pluginName,
          packageName,
          className,
          targetSdk: sdk,
        });
        davinciStore.updateJob(job.id, {
          status: "done",
          analysis: JSON.stringify(pluginResult.analysis),
          generatedJava: pluginResult.javaCode,
          generatedPom: pluginResult.pomXml,
          confidence: pluginResult.confidence,
          warnings: [...pluginResult.warnings, ...preValidation.issues.map((i) => `[${i.severity}] ${i.message}`)],
        });
        jobId = job.id;
        logger.info("davinci: job persisted", { jobId, pluginName });
      } catch (err) {
        logger.warn("davinci: failed to persist job", { error: String(err) });
      }

      return mcpText(JSON.stringify({
        ok: postValidation.valid,
        jobId,
        pluginName,
        className,
        packageName,
        pluginType: pluginResult.pluginType,
        confidence: pluginResult.confidence,
        javaCode: pluginResult.javaCode,
        pomXml: pluginResult.pomXml,
        pfInfDescriptor: {
          directoryName: pfInfDescriptor.directoryName,
          content: pfInfDescriptor.content,
          fullPath: pfInfDescriptor.fullPath,
        },
        guiDescriptor: {
          fieldDeclarations: guiDescriptor.fieldDeclarations,
          fieldRegistrations: guiDescriptor.fieldRegistrations,
          instanceFields: guiDescriptor.instanceFields,
        },
        validation: {
          preConversion: preValidation.issues,
          postGeneration: postValidation.issues,
        },
        analysis: pluginResult.analysis,
        hint: "Use the generated POM and Java structure to build the plugin. Run davinci_build to compile.",
      }, null, 2));
    },
  );
}
