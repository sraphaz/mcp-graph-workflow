/**
 * Siebel tool handler functions.
 * Each handler contains the exact logic from the original separate siebel_* tools.
 */

import type { SqliteStore } from "../../core/store/sqlite-store.js";
import {
  analyzeSiebelImpact,
  findDependencyChain,
  detectCircularDeps,
} from "../../core/siebel/dependency-analyzer.js";
import { parseSifContent, parseSifFile } from "../../core/siebel/sif-parser.js";
import { diffSifObjects, formatDiffMarkdown } from "../../core/siebel/sif-diff.js";
import { refactorEscript } from "../../core/siebel/escript-refactor.js";
import { troubleshootSiebel } from "../../core/siebel/troubleshoot.js";
import { generateIntegrationTests } from "../../core/siebel/integration-test-gen.js";
import { parseWsdlContent } from "../../core/siebel/wsdl-parser.js";
import { buildComposerInstructions } from "../../core/siebel/composer-automation.js";
import { findEnvironment, loadSiebelConfig, addEnvironment, removeEnvironment } from "../../core/siebel/siebel-config.js";
import { buildMigrationPackage } from "../../core/siebel/migration-package.js";
import { prepareSifGeneration, finalizeSifGeneration } from "../../core/siebel/sif-generator.js";
import { listTemplates } from "../../core/siebel/sif-templates.js";
import { scaffoldSiebelObjects } from "../../core/siebel/scaffold-generator.js";
import { cloneAndAdapt } from "../../core/siebel/clone-adapt.js";
import { generateEScript } from "../../core/siebel/escript-generator.js";
import { autoWireDependencies } from "../../core/siebel/auto-wiring.js";
import { generateSifFromWsdl } from "../../core/siebel/wsdl-to-sif.js";
import { parseSwaggerContent, parseWsdlContent as parseSwaggerWsdl } from "../../core/parser/read-swagger.js";
import { indexSwaggerContent } from "../../core/rag/swagger-indexer.js";
import { readFileContent } from "../../core/parser/file-reader.js";
import { chunkText } from "../../core/rag/chunk-text.js";
import { indexEntitiesForSource, indexEntitiesForDocs } from "../../core/rag/entity-index-hook.js";
import { convertSifToGraph } from "../../core/siebel/sif-to-graph.js";
import { indexSifContent } from "../../core/rag/siebel-indexer.js";
import { batchImportSifs } from "../../core/siebel/sif-batch-importer.js";
import { validateNamingConventions, DEFAULT_RULE_SETS } from "../../core/siebel/naming-convention-validator.js";
import type { NamingRuleSet } from "../../core/siebel/naming-convention-validator.js";
import { validateSecurity, validatePerformance, validateMigrationReadiness } from "../../core/siebel/siebel-validators.js";
import { reviewSiebelCode } from "../../core/siebel/code-review.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import type { SiebelObject, SiebelObjectType, SiebelEnvironmentType, SiebelSifParseResult } from "../../schemas/siebel.schema.js";
import { STORE_DIR } from "../../core/utils/constants.js";
import { assertPathInsideProject } from "../../core/utils/fs.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError, normalizeNewlines } from "../response-helpers.js";
import type { McpToolResponse } from "../response-helpers.js";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Type for the flat params object from siebel.ts
interface SiebelParams {
  action: string;
  analyzeMode?: string;
  objectName?: string;
  objectType?: SiebelObjectType;
  targetName?: string;
  targetType?: SiebelObjectType;
  sifContent?: string;
  targetSifContent?: string;
  outputFormat?: string;
  scriptContent?: string;
  errorMessage?: string;
  wsdlContent?: string;
  composerAction?: string;
  envName?: string;
  sifPath?: string;
  property?: string;
  value?: string;
  selector?: string;
  timeout?: number;
  currentUser?: string;
  envAction?: string;
  name?: string;
  url?: string;
  version?: string;
  envType?: SiebelEnvironmentType;
  composerUrl?: string;
  restApiUrl?: string;
  generateAction?: string;
  description?: string;
  objectTypes?: SiebelObjectType[];
  basedOnProject?: string;
  properties?: Record<string, string>;
  generatedXml?: string;
  prefix?: string;
  includeScriptBoilerplate?: boolean;
  sourceSifContent?: string;
  sourceObjectName?: string;
  newName?: string;
  renames?: Record<string, string>;
  addFields?: string[];
  removeFields?: string[];
  parentObjectName?: string;
  parentObjectType?: "applet" | "business_component" | "business_service";
  eventName?: string;
  existingBcName?: string;
  filePath?: string;
  content?: string;
  fileName?: string;
  docType?: string;
  directory?: string;
  concurrency?: number;
  mapToGraph?: boolean;
  query?: string;
  limit?: number;
  validateMode?: string;
  ruleSetName?: string;
  checkDeps?: boolean;
  checkCircular?: boolean;
  files?: Array<{ filePath?: string; content?: string; fileName?: string }>;
}

// ─── ANALYZE ─────────────────────────────────────────────────────────────────

export async function handleSiebelAnalyze(store: SqliteStore, params: SiebelParams): Promise<McpToolResponse> {
  const { analyzeMode: action, objectName, objectType, targetName, targetType, sifContent, targetSifContent, outputFormat, scriptContent, errorMessage, wsdlContent } = params;

  if (!action) {
    return mcpError("analyzeMode is required for analyze action");
  }

  logger.info("tool:siebel:analyze", { analyzeMode: action, objectName, objectType });

  // Get dependencies from SIF content or stored knowledge
  let dependencies;
  if (sifContent) {
    const parseResult = parseSifContent(sifContent, "analyze-input.sif");
    dependencies = parseResult.dependencies;
  } else {
    const knowledgeStore = new KnowledgeStore(store.getDb());
    const docs = knowledgeStore.search("Siebel", 100);
    const siebelDocs = docs.filter((d) => d.sourceType === "siebel_sif");

    if (siebelDocs.length === 0) {
      return mcpError("No Siebel data found in knowledge store. Import a SIF file first with siebel action=import_sif.");
    }

    if (action !== "summary" && action !== "diff") {
      return mcpError("Detailed analysis requires sifContent parameter. Use siebel action=import_sif to import a SIF first, then pass the content here.");
    }

    return mcpText({
      ok: true,
      action: "summary",
      totalDocuments: siebelDocs.length,
      objectTypes: [...new Set(siebelDocs.map((d) => d.metadata?.siebelType).filter(Boolean))],
      projects: [...new Set(siebelDocs.map((d) => d.metadata?.siebelProject).filter(Boolean))],
    });
  }

  switch (action) {
    case "impact": {
      if (!objectName || !objectType) {
        return mcpError("objectName and objectType are required for impact analysis");
      }
      const impact = analyzeSiebelImpact(dependencies, { name: objectName, type: objectType });
      return mcpText({ ok: true, action: "impact", ...impact });
    }

    case "dependencies": {
      if (!objectName || !objectType || !targetName || !targetType) {
        return mcpError("objectName, objectType, targetName, and targetType are required for dependency chain analysis");
      }
      const chains = findDependencyChain(
        dependencies,
        { name: objectName, type: objectType },
        { name: targetName, type: targetType },
      );
      return mcpText({
        ok: true,
        action: "dependencies",
        from: { name: objectName, type: objectType },
        to: { name: targetName, type: targetType },
        pathsFound: chains.length,
        paths: chains,
      });
    }

    case "circular": {
      const cycles = detectCircularDeps(dependencies);
      return mcpText({
        ok: true,
        action: "circular",
        cyclesFound: cycles.length,
        cycles,
      });
    }

    case "summary": {
      if (!sifContent) {
        return mcpError("sifContent is required for summary analysis");
      }
      const parseResult = parseSifContent(sifContent, "summary-input.sif");
      return mcpText({
        ok: true,
        action: "summary",
        metadata: parseResult.metadata,
        objectCount: parseResult.objects.length,
        dependencyCount: parseResult.dependencies.length,
        objectsByType: Object.fromEntries(
          [...new Set(parseResult.objects.map((o) => o.type))].map((t) => [
            t,
            parseResult.objects.filter((o) => o.type === t).length,
          ]),
        ),
      });
    }

    case "diff": {
      if (!sifContent || !targetSifContent) {
        return mcpError("sifContent and targetSifContent are required for diff mode");
      }
      const baseNorm = normalizeNewlines(sifContent) ?? sifContent;
      const targetNorm = normalizeNewlines(targetSifContent) ?? targetSifContent;
      const baseResult = parseSifContent(baseNorm, "base.sif");
      const targetResult = parseSifContent(targetNorm, "target.sif");
      const diffResult = diffSifObjects(baseResult.objects, targetResult.objects);

      if (outputFormat === "markdown") {
        const markdown = formatDiffMarkdown(diffResult);
        return mcpText({ ok: true, action: "diff", format: "markdown", content: markdown });
      }

      return mcpText({ ok: true, action: "diff", format: "json", ...diffResult });
    }

    case "generate_integration_tests": {
      if (!wsdlContent) {
        return mcpError("wsdlContent is required for generate_integration_tests mode");
      }
      const wsdlResult = parseWsdlContent(normalizeNewlines(wsdlContent) ?? wsdlContent, "input.wsdl");
      const testSuite = generateIntegrationTests(wsdlResult);
      return mcpText({
        ok: true,
        action: "generate_integration_tests",
        serviceName: testSuite.serviceName,
        endpointUrl: testSuite.endpointUrl,
        totalOperations: testSuite.totalOperations,
        testCases: testSuite.testCases.map((tc) => ({
          operation: tc.operationName,
          direction: tc.direction,
          soapAction: tc.soapAction,
          requestPayload: tc.requestPayload,
          httpScript: tc.httpScript,
          expectedFields: tc.expectedResponseFields,
        })),
      });
    }

    case "troubleshoot": {
      if (!errorMessage) {
        return mcpError("errorMessage is required for troubleshoot mode");
      }
      const objects = sifContent
        ? parseSifContent(normalizeNewlines(sifContent) ?? sifContent, "troubleshoot.sif").objects
        : [];
      const deps = sifContent
        ? parseSifContent(normalizeNewlines(sifContent) ?? sifContent, "troubleshoot.sif").dependencies
        : [];

      const tsResult = troubleshootSiebel({ errorMessage, objects, dependencies: deps });
      return mcpText({
        ok: true,
        action: "troubleshoot",
        relatedObjects: tsResult.relatedObjects,
        relatedScripts: tsResult.relatedScripts.length,
        dependencyChain: tsResult.dependencyChain.length,
        configIssues: tsResult.configIssues,
        causes: tsResult.causes,
      });
    }

    case "refactor_script": {
      if (!scriptContent) {
        return mcpError("scriptContent is required for refactor_script mode");
      }
      const refactorResult = refactorEscript(scriptContent);
      return mcpText({
        ok: true,
        action: "refactor_script",
        issueCount: refactorResult.issues.length,
        issues: refactorResult.issues,
        hasChanges: refactorResult.diff.length > 0,
        refactored: refactorResult.refactored,
        diff: refactorResult.diff,
      });
    }

    default:
      return mcpError(`Unknown analyze mode: ${action}`);
  }
}

// ─── COMPOSE ─────────────────────────────────────────────────────────────────

export async function handleSiebelCompose(store: SqliteStore, params: SiebelParams): Promise<McpToolResponse> {
  const { composerAction: action, envName, sifPath, objectName, property, value, selector, timeout, sifContent, currentUser } = params;

  if (!action) {
    return mcpError("composerAction is required for compose action");
  }

  logger.info("tool:siebel:compose", { composerAction: action, envName, objectName });

  // build_package doesn't need environment
  if (action === "build_package") {
    if (!sifContent) {
      return mcpError("sifContent is required for build_package action");
    }
    const normalized = normalizeNewlines(sifContent) ?? sifContent;
    const parseResult = parseSifContent(normalized, "migration-input.sif");

    const pkg = buildMigrationPackage({
      modifiedObjects: parseResult.objects,
      allObjects: parseResult.objects,
      dependencies: parseResult.dependencies,
      currentUser,
    });

    return mcpText({
      ok: true,
      action: "build_package",
      objectCount: pkg.objects.length,
      riskLevel: pkg.riskLevel,
      conflictCount: pkg.conflicts.length,
      conflicts: pkg.conflicts,
      circularDeps: pkg.circularDeps.length,
      deployOrder: pkg.deployOrder.map((o) => `${o.type}:${o.name}`),
      deployScripts: pkg.deployScripts.map((s) => ({
        environment: s.environment,
        commandCount: s.commands.length,
      })),
      report: pkg.report,
    });
  }

  if (!envName) {
    return mcpError("envName is required for this action");
  }

  const graphDir = path.join(process.cwd(), STORE_DIR);
  const env = findEnvironment(graphDir, envName);

  if (!env) {
    return mcpError(`Siebel environment "${envName}" not found. Use siebel action=env envAction=list to see available environments, or siebel action=env envAction=add to register one.`);
  }

  const instructions = buildComposerInstructions({
    env,
    action: action as "navigate" | "import_sif" | "edit" | "publish" | "capture",
    sifPath,
    objectName,
    property,
    value,
    selector,
    timeout,
  });

  return mcpText({
    ok: true,
    action,
    envName,
    composerUrl: env.composerUrl ?? `${env.url}/composer`,
    instructions: instructions.steps,
    description: instructions.description,
    hint: "Use Playwright MCP tools (browser_navigate, browser_click, browser_type, browser_file_upload, browser_take_screenshot) to execute these steps sequentially.",
  });
}

// ─── ENV ─────────────────────────────────────────────────────────────────────

export async function handleSiebelEnv(_store: SqliteStore, params: SiebelParams): Promise<McpToolResponse> {
  const { envAction: action, name, url, version, envType: type, composerUrl, restApiUrl } = params;

  if (!action) {
    return mcpError("envAction is required for env action");
  }

  logger.info("tool:siebel:env", { envAction: action, name });

  const graphDir = path.join(process.cwd(), STORE_DIR);

  switch (action) {
    case "list": {
      const envs = loadSiebelConfig(graphDir);
      return mcpText({ ok: true, environments: envs, count: envs.length });
    }

    case "add": {
      if (!name || !url) {
        return mcpError("name and url are required to add an environment");
      }
      const envs = addEnvironment(graphDir, {
        name,
        url,
        version: version ?? "15.0",
        type: type ?? "dev",
        ...(composerUrl ? { composerUrl } : {}),
        ...(restApiUrl ? { restApiUrl } : {}),
      });
      return mcpText({ ok: true, added: name, environments: envs });
    }

    case "remove": {
      if (!name) {
        return mcpError("name is required to remove an environment");
      }
      const envs = removeEnvironment(graphDir, name);
      return mcpText({ ok: true, removed: name, environments: envs });
    }

    default:
      return mcpError(`Unknown env action: ${action}`);
  }
}

// ─── GENERATE ────────────────────────────────────────────────────────────────

export async function handleSiebelGenerate(store: SqliteStore, params: SiebelParams): Promise<McpToolResponse> {
  const {
    generateAction: action, description, objectTypes, basedOnProject, properties,
    generatedXml, prefix, includeScriptBoilerplate, sourceSifContent, sourceObjectName,
    newName, renames, addFields, removeFields, parentObjectName, parentObjectType,
    eventName, wsdlContent, existingBcName,
  } = params;

  if (!action) {
    return mcpError("generateAction is required for generate action");
  }

  logger.info("tool:siebel:generate", { generateAction: action });

  if (action === "templates") {
    const templates = listTemplates();
    return mcpText({
      ok: true,
      templates: templates.map((t) => ({
        type: t.type,
        xmlTag: t.xmlTag,
        requiredAttrs: t.requiredAttrs,
        optionalAttrs: t.optionalAttrs,
        childTags: t.childTags,
      })),
    });
  }

  const knowledgeStore = new KnowledgeStore(store.getDb());

  if (action === "prepare") {
    if (!description) {
      return mcpError("description is required for prepare action");
    }
    if (!objectTypes || objectTypes.length === 0) {
      return mcpError("objectTypes is required for prepare action");
    }

    const context = prepareSifGeneration(knowledgeStore, {
      description,
      objectTypes,
      basedOnProject,
      properties,
    });

    return mcpText({
      ok: true,
      action: "prepare",
      prompt: context.prompt,
      templates: context.templates.map((t) => t.type),
      existingObjectsCount: context.existingObjects.length,
      relatedDocsCount: context.relatedDocs.length,
      validationRules: context.validationRules,
    });
  }

  if (action === "finalize") {
    if (!generatedXml) {
      return mcpError("generatedXml is required for finalize action");
    }

    const normalized = normalizeNewlines(generatedXml) ?? generatedXml;

    const result = finalizeSifGeneration(
      knowledgeStore,
      normalized,
      {
        description: description ?? "SIF generation",
        objectTypes: objectTypes ?? [],
      },
    );

    return mcpText({
      ok: true,
      action: "finalize",
      sifContent: result.sifContent,
      objectCount: result.metadata.objectCount,
      objects: result.objects,
      validation: result.validation,
      metadata: result.metadata,
    });
  }

  if (action === "scaffold") {
    if (!description) {
      return mcpError("description is required for scaffold action");
    }

    const referenceObjects = loadReferenceObjects(knowledgeStore);

    const scaffoldResult = scaffoldSiebelObjects({
      description,
      prefix: prefix ?? "CX_",
      projectName: basedOnProject ?? "Generated Project",
      referenceObjects,
      includeScriptBoilerplate,
    });

    return mcpText({
      ok: true,
      action: "scaffold",
      sifContent: scaffoldResult.sifXml,
      objectCount: scaffoldResult.objects.length,
      objects: scaffoldResult.objects.map((o) => ({ name: o.name, type: o.type })),
      validationScore: scaffoldResult.validationScore,
      scriptBoilerplate: scaffoldResult.scriptBoilerplate,
    });
  }

  if (action === "clone_adapt") {
    if (!sourceSifContent || !sourceObjectName || !newName) {
      return mcpError("sourceSifContent, sourceObjectName, and newName are required for clone_adapt action");
    }

    const normalized = normalizeNewlines(sourceSifContent) ?? sourceSifContent;
    const parseResult = parseSifContent(normalized, "clone-source.sif");
    const sourceObj = parseResult.objects.find((o) => o.name === sourceObjectName);

    if (!sourceObj) {
      return mcpError(`Object "${sourceObjectName}" not found in SIF content. Available: ${parseResult.objects.map((o) => o.name).join(", ")}`);
    }

    const addChildren = addFields?.map((fieldName) => ({
      name: fieldName,
      type: "control" as const,
      properties: [{ name: "FIELD", value: fieldName }],
      children: [] as SiebelObject[],
    }));
    const removeChildren = removeFields;

    const result = cloneAndAdapt({
      source: sourceObj,
      newName,
      renames: renames ?? {},
      addChildren,
      removeChildren,
    });

    const diffMarkdown = formatDiffMarkdown(result.diff);

    return mcpText({
      ok: true,
      action: "clone_adapt",
      clonedObject: { name: result.cloned.name, type: result.cloned.type },
      childCount: result.cloned.children.length,
      renamesApplied: result.renamesApplied,
      diff: result.diff.summary,
      diffMarkdown,
    });
  }

  if (action === "generate_script") {
    if (!parentObjectName || !parentObjectType || !eventName || !description) {
      return mcpError("parentObjectName, parentObjectType, eventName, and description are required for generate_script action");
    }

    const scriptResult = generateEScript({
      parentObjectName,
      parentObjectType,
      eventName,
      behaviorDescription: description,
      referenceScripts: [],
    });

    return mcpText({
      ok: true,
      action: "generate_script",
      functionName: scriptResult.functionName,
      eventName: scriptResult.eventName,
      script: scriptResult.script,
      sifXmlBlock: scriptResult.sifXmlBlock,
      referencedEntities: scriptResult.referencedEntities,
    });
  }

  if (action === "wsdl_to_sif") {
    if (!wsdlContent) {
      return mcpError("wsdlContent is required for wsdl_to_sif action");
    }
    const normalized = normalizeNewlines(wsdlContent) ?? wsdlContent;
    const wsdlResult = parseWsdlContent(normalized, "wsdl-input.wsdl");
    const sifResult = generateSifFromWsdl(wsdlResult, {
      prefix: prefix ?? "CX",
      projectName: basedOnProject,
      existingBcName,
    });

    return mcpText({
      ok: true,
      action: "wsdl_to_sif",
      objectCount: sifResult.objects.length,
      operationCount: sifResult.operationCount,
      objects: sifResult.objects.map((o) => ({ name: o.name, type: o.type, fields: o.children.length })),
      validationScore: sifResult.validationScore,
      sifContent: sifResult.sifXml,
    });
  }

  if (action === "auto_wire") {
    if (!sourceSifContent) {
      return mcpError("sourceSifContent is required for auto_wire action (SIF XML with new objects)");
    }

    const normalized = normalizeNewlines(sourceSifContent) ?? sourceSifContent;
    const parseResult = parseSifContent(normalized, "auto-wire-source.sif");

    const ks = new KnowledgeStore(store.getDb());
    const repositoryObjects = loadReferenceObjects(ks);

    const wireResult = autoWireDependencies({
      newObjects: parseResult.objects,
      repository: repositoryObjects,
    });

    return mcpText({
      ok: true,
      action: "auto_wire",
      wiredEdges: wireResult.wiredEdges.length,
      missingDependencies: wireResult.missingDependencies.length,
      edges: wireResult.wiredEdges.map((e) => ({
        from: `${e.from.type}:${e.from.name}`,
        to: `${e.to.type}:${e.to.name}`,
        relation: e.relationType,
      })),
      missing: wireResult.missingDependencies.map((d) => ({
        from: `${d.from.type}:${d.from.name}`,
        to: `${d.to.type}:${d.to.name}`,
        suggestion: d.suggestion,
      })),
      report: wireResult.report,
    });
  }

  return mcpError(`Unknown generate action: ${action}`);
}

// ─── IMPORT DOCS ─────────────────────────────────────────────────────────────

export async function handleSiebelImportDocs(store: SqliteStore, params: SiebelParams): Promise<McpToolResponse> {
  const { filePath, content, fileName, docType } = params;

  if (!docType) {
    return mcpError("docType is required for import_docs action");
  }

  logger.info("tool:siebel:import_docs", { filePath, fileName, docType });

  // Security: validate file path is inside project directory
  if (filePath) assertPathInsideProject(filePath);

  const knowledgeStore = new KnowledgeStore(store.getDb());
  let documentsIndexed: number;

  if (docType === "swagger" || docType === "wsdl") {
    const rawContent = content ?? (filePath ? await readFileToString(filePath) : undefined);
    if (!rawContent) {
      return mcpError("Either filePath or content is required");
    }
    const normalized = normalizeNewlines(rawContent) ?? rawContent;

    const parseResult = docType === "wsdl"
      ? parseSwaggerWsdl(normalized)
      : parseSwaggerContent(normalized);

    const indexResult = indexSwaggerContent(knowledgeStore, parseResult, fileName ?? "inline-doc");
    documentsIndexed = indexResult.documentsIndexed;
    indexEntitiesForSource(store.getDb(), "swagger");

    return mcpText({
      ok: true,
      docType,
      fileName,
      title: parseResult.title,
      version: parseResult.version,
      format: parseResult.format,
      endpointsFound: parseResult.endpoints.length,
      schemasFound: parseResult.schemas.length,
      documentsIndexed,
    });
  }

  // General docs: PDF, HTML, DOC/DOCX, Markdown
  let textContent: string;
  if (filePath) {
    const fileResult = await readFileContent(filePath, fileName);
    textContent = fileResult.text;
  } else if (content) {
    textContent = normalizeNewlines(content) ?? content;
  } else {
    return mcpError("Either filePath or content is required");
  }

  // Chunk and index into knowledge store
  const sourceId = `siebel_docs:${fileName}`;
  knowledgeStore.deleteBySource("siebel_docs", sourceId);

  const chunks = chunkText(textContent);
  const chunkDocs = chunks.map((chunk, index) => ({
    sourceType: "siebel_docs" as const,
    sourceId,
    title: `Siebel Doc: ${fileName} [${index + 1}/${chunks.length}]`,
    content: chunk.content,
    chunkIndex: index,
    metadata: {
      docType,
      fileName,
      chunkTokens: chunk.tokens,
      indexedAt: new Date().toISOString(),
    },
  }));

  const docs = knowledgeStore.insertChunks(chunkDocs);
  documentsIndexed = docs.length;
  indexEntitiesForDocs(store.getDb(), docs.map((d) => d.id));

  logger.info("Documentation indexed", {
    fileName,
    docType,
    chunks: String(chunks.length),
    documents: String(documentsIndexed),
  });

  return mcpText({
    ok: true,
    docType,
    fileName,
    textLength: textContent.length,
    chunksCreated: chunks.length,
    documentsIndexed,
  });
}

// ─── IMPORT SIF ──────────────────────────────────────────────────────────────

export async function handleSiebelImportSif(store: SqliteStore, params: SiebelParams): Promise<McpToolResponse> {
  const { filePath, content, fileName, directory, concurrency, mapToGraph } = params;

  logger.info("tool:siebel:import_sif", { filePath, fileName, directory, concurrency, mapToGraph });

  // Security: validate paths are inside project directory
  if (filePath) assertPathInsideProject(filePath);
  if (directory) assertPathInsideProject(directory);

  // Batch import mode
  if (directory) {
    const batchResult = await batchImportSifs(directory, { concurrency });

    let totalNodesCreated = 0;
    let totalEdgesCreated = 0;
    let totalDocsIndexed = 0;

    for (const parseResult of batchResult.results) {
      const singleResult = importSingleSif(store, parseResult, mapToGraph ?? true);
      totalNodesCreated += (singleResult.nodesCreated as number) ?? 0;
      totalEdgesCreated += (singleResult.edgesCreated as number) ?? 0;
      totalDocsIndexed += (singleResult.documentsIndexed as number) ?? 0;
    }

    return mcpText({
      ok: true,
      mode: "batch",
      totalFiles: batchResult.totalFiles,
      successCount: batchResult.successCount,
      errorCount: batchResult.errorCount,
      totalObjects: batchResult.totalObjects,
      totalDependencies: batchResult.totalDependencies,
      objectsByType: batchResult.objectsByType,
      nodesCreated: totalNodesCreated,
      edgesCreated: totalEdgesCreated,
      documentsIndexed: totalDocsIndexed,
      errors: batchResult.errors,
    });
  }

  // Single file mode
  let parseResult;
  if (filePath) {
    parseResult = await parseSifFile(filePath);
  } else if (content) {
    const normalizedContent = normalizeNewlines(content) ?? content;
    parseResult = parseSifContent(normalizedContent, fileName ?? "inline.sif");
  } else {
    return mcpError("Either filePath, content, or directory is required");
  }

  return mcpText(importSingleSif(store, parseResult, mapToGraph ?? true));
}

// ─── SEARCH ──────────────────────────────────────────────────────────────────

export async function handleSiebelSearch(store: SqliteStore, params: SiebelParams): Promise<McpToolResponse> {
  const { query, objectType, limit } = params;

  if (!query) {
    return mcpError("query is required for search action");
  }

  logger.info("tool:siebel:search", { query, objectType, limit });

  const knowledgeStore = new KnowledgeStore(store.getDb());
  const effectiveLimit = limit ?? 10;
  const allResults = knowledgeStore.search(query, effectiveLimit * 3);

  let siebelResults = allResults.filter(
    (d) => d.sourceType === "siebel_sif" || d.sourceType === "siebel_composer" || d.sourceType === "siebel_escript",
  );

  if (objectType) {
    siebelResults = siebelResults.filter(
      (d) => d.metadata?.siebelType === objectType,
    );
  }

  siebelResults = siebelResults.slice(0, effectiveLimit);

  return mcpText({
    ok: true,
    query,
    objectType: objectType ?? "all",
    resultCount: siebelResults.length,
    results: siebelResults.map((d) => ({
      title: d.title,
      sourceType: d.sourceType,
      siebelType: d.metadata?.siebelType,
      siebelProject: d.metadata?.siebelProject,
      content: d.content.slice(0, 200) + (d.content.length > 200 ? "..." : ""),
    })),
  });
}

// ─── VALIDATE ────────────────────────────────────────────────────────────────

export async function handleSiebelValidate(_store: SqliteStore, params: SiebelParams): Promise<McpToolResponse> {
  const { filePath, content, fileName, validateMode: mode, ruleSetName, checkDeps, checkCircular, prefix } = params;

  logger.info("tool:siebel:validate", { filePath, fileName, mode });

  let parseResult: SiebelSifParseResult;
  if (filePath) {
    parseResult = await parseSifFile(filePath);
  } else if (content) {
    const normalized = normalizeNewlines(content) ?? content;
    parseResult = parseSifContent(normalized, fileName ?? "validate.sif");
  } else {
    return mcpError("Either filePath or content is required");
  }

  // --- Naming Convention Mode ---
  if (mode === "naming") {
    const ruleSet = resolveNamingRuleSet(ruleSetName);
    if (!ruleSet) {
      return mcpError(`Unknown naming rule set: "${ruleSetName}". Available: ${Object.keys(DEFAULT_RULE_SETS).join(", ")}`);
    }
    const allObjects = flattenObjects(parseResult.objects);
    const namingResult = validateNamingConventions(allObjects, ruleSet);
    return mcpText({
      ok: true,
      mode: "naming",
      ...namingResult,
      fileName: parseResult.metadata.fileName,
      objectCount: allObjects.length,
    });
  }

  // --- Security Validation Mode ---
  if (mode === "security") {
    const allObjects = flattenObjects(parseResult.objects);
    const securityResult = validateSecurity(allObjects);
    return mcpText({
      ok: true,
      mode: "security",
      ...securityResult,
      fileName: parseResult.metadata.fileName,
      objectCount: allObjects.length,
    });
  }

  // --- Performance Validation Mode ---
  if (mode === "performance") {
    const allObjects = flattenObjects(parseResult.objects);
    const perfResult = validatePerformance(allObjects);
    return mcpText({
      ok: true,
      mode: "performance",
      ...perfResult,
      fileName: parseResult.metadata.fileName,
      objectCount: allObjects.length,
    });
  }

  // --- Migration Readiness Mode ---
  if (mode === "migration_ready") {
    const migrationResult = validateMigrationReadiness(
      parseResult.objects,
      parseResult.dependencies,
    );
    return mcpText({
      ok: true,
      mode: "migration_ready",
      ...migrationResult,
      fileName: parseResult.metadata.fileName,
      objectCount: parseResult.objects.length,
    });
  }

  if (mode === "code_review") {
    const reviewResult = reviewSiebelCode(parseResult.objects, {
      prefix: prefix ?? "CX_",
    });
    return mcpText({
      ok: true,
      mode: "code_review",
      score: reviewResult.score,
      breakdown: reviewResult.breakdown,
      issueCount: reviewResult.issues.length,
      issues: reviewResult.issues,
      objectCount: reviewResult.objectCount,
      fileName: parseResult.metadata.fileName,
    });
  }

  // --- Full Validation Mode ---
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  info.push(`Parsed ${parseResult.objects.length} objects, ${parseResult.dependencies.length} dependencies`);

  const unnamed = parseResult.objects.filter((o) => !o.name || o.name.trim() === "");
  if (unnamed.length > 0) {
    errors.push(`${unnamed.length} objects found without names`);
  }

  const inactive = parseResult.objects.filter((o) => o.inactive);
  if (inactive.length > 0) {
    warnings.push(`${inactive.length} inactive objects: ${inactive.map((o) => o.name).join(", ")}`);
  }

  if (checkDeps !== false) {
    const objectIndex = new Set(
      parseResult.objects.map((o) => `${o.type}:${o.name}`),
    );

    const missingDeps = parseResult.dependencies.filter(
      (d) => !objectIndex.has(`${d.to.type}:${d.to.name}`),
    );

    if (missingDeps.length > 0) {
      for (const dep of missingDeps) {
        warnings.push(`Missing dependency: ${dep.from.name} → ${dep.to.type}:${dep.to.name}`);
      }
    }

    const bcsWithoutTable = parseResult.objects
      .filter((o) => o.type === "business_component")
      .filter((o) => !o.properties.some((p) => p.name === "TABLE"));
    if (bcsWithoutTable.length > 0) {
      warnings.push(`BCs without TABLE: ${bcsWithoutTable.map((o) => o.name).join(", ")}`);
    }
  }

  if (checkCircular !== false) {
    const cycles = detectCircularDeps(parseResult.dependencies);
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        errors.push(`Circular dependency: ${cycle.cycle.map((r) => r.name).join(" → ")}`);
      }
    }
  }

  validateBestPractices(parseResult.objects, warnings);

  const status = errors.length > 0 ? "invalid" : warnings.length > 0 ? "warnings" : "valid";

  return mcpText({
    ok: true,
    mode: "full",
    status,
    fileName: parseResult.metadata.fileName,
    objectCount: parseResult.objects.length,
    dependencyCount: parseResult.dependencies.length,
    errors,
    warnings,
    info,
  });
}

// ─── BATCH IMPORT SIF ────────────────────────────────────────────────────────

export async function handleSiebelBatchImportSif(store: SqliteStore, params: SiebelParams): Promise<McpToolResponse> {
  const { files, mapToGraph } = params;

  if (!files || files.length === 0) {
    return mcpError("files array is required for batch_import_sif action");
  }

  if (files.length > 50) {
    return mcpError("batch_import_sif supports at most 50 files");
  }

  logger.info("tool:siebel:batch_import_sif", { fileCount: files.length, mapToGraph });

  const results: Array<{ fileName: string; ok: boolean; objectCount?: number; error?: string }> = [];
  let totalNodesCreated = 0;
  let totalEdgesCreated = 0;
  let totalDocsIndexed = 0;

  for (const file of files) {
    try {
      let parseResult: SiebelSifParseResult;
      if (file.filePath) {
        assertPathInsideProject(file.filePath);
        parseResult = await parseSifFile(file.filePath);
      } else if (file.content) {
        const normalized = normalizeNewlines(file.content) ?? file.content;
        parseResult = parseSifContent(normalized, file.fileName ?? "batch-inline.sif");
      } else {
        results.push({ fileName: file.fileName ?? "unknown", ok: false, error: "Either filePath or content is required" });
        continue;
      }

      const singleResult = importSingleSif(store, parseResult, mapToGraph ?? true);
      totalNodesCreated += (singleResult.nodesCreated as number) ?? 0;
      totalEdgesCreated += (singleResult.edgesCreated as number) ?? 0;
      totalDocsIndexed += (singleResult.documentsIndexed as number) ?? 0;

      results.push({
        fileName: parseResult.metadata.fileName,
        ok: true,
        objectCount: parseResult.objects.length,
      });
    } catch (err) {
      results.push({
        fileName: file.fileName ?? file.filePath ?? "unknown",
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const successCount = results.filter((r) => r.ok).length;

  return mcpText({
    ok: true,
    mode: "batch",
    totalFiles: files.length,
    successCount,
    errorCount: files.length - successCount,
    nodesCreated: totalNodesCreated,
    edgesCreated: totalEdgesCreated,
    documentsIndexed: totalDocsIndexed,
    results,
  });
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

function importSingleSif(
  store: SqliteStore,
  parseResult: SiebelSifParseResult,
  mapToGraph: boolean,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ok: true,
    metadata: parseResult.metadata,
    objectCount: parseResult.objects.length,
    dependencyCount: parseResult.dependencies.length,
    objectTypes: parseResult.metadata.objectTypes,
  };

  if (mapToGraph) {
    const { nodes, edges } = convertSifToGraph(parseResult);
    store.bulkInsert(nodes, edges);
    result.nodesCreated = nodes.length;
    result.edgesCreated = edges.length;
    result.epicId = nodes.find((n) => n.type === "epic")?.id;
  }

  try {
    const knowledgeStore = new KnowledgeStore(store.getDb());
    const indexResult = indexSifContent(knowledgeStore, parseResult);
    result.documentsIndexed = indexResult.documentsIndexed;
    indexEntitiesForSource(store.getDb(), "siebel_sif");
  } catch (indexErr) {
    logger.warn("Siebel knowledge indexing failed (non-fatal)", {
      error: String(indexErr),
    });
  }

  store.recordImport(parseResult.metadata.fileName, parseResult.objects.length, parseResult.dependencies.length);

  return result;
}

function loadReferenceObjects(knowledgeStore: KnowledgeStore): SiebelObject[] {
  try {
    const docs = knowledgeStore.search("siebel object", 50);
    const sifDocs = docs.filter((d) => d.sourceType === "siebel_sif" || d.sourceType === "siebel_sif_raw");

    const objects: SiebelObject[] = [];
    for (const doc of sifDocs) {
      try {
        const parseResult = parseSifContent(doc.content, doc.title);
        objects.push(...parseResult.objects);
      } catch (err) {
        logger.debug("scaffold:docParseFailure", { error: err instanceof Error ? err.message : String(err) });
      }
    }

    logger.debug("scaffold:loadReferenceObjects", {
      docsFound: String(sifDocs.length),
      objectsLoaded: String(objects.length),
    });

    return objects;
  } catch (err) {
    logger.debug("scaffold:knowledgeSearchFailure", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

async function readFileToString(filePath: string): Promise<string> {
  const buffer = await readFile(filePath, "utf-8");
  return buffer;
}

function resolveNamingRuleSet(name?: string): NamingRuleSet | undefined {
  if (!name) return DEFAULT_RULE_SETS["standard"];
  return DEFAULT_RULE_SETS[name];
}

function flattenObjects(objects: readonly SiebelObject[]): SiebelObject[] {
  const result: SiebelObject[] = [];
  for (const obj of objects) {
    result.push(obj);
    if (obj.children.length > 0) {
      result.push(...flattenObjects(obj.children));
    }
  }
  return result;
}

function validateBestPractices(objects: SiebelObject[], warnings: string[]): void {
  const appletsWithoutBc = objects
    .filter((o) => o.type === "applet")
    .filter((o) => !o.properties.some((p) => p.name === "BUS_COMP"));
  if (appletsWithoutBc.length > 0) {
    warnings.push(`Applets without BUS_COMP: ${appletsWithoutBc.map((o) => o.name).join(", ")}`);
  }

  const viewsWithoutBo = objects
    .filter((o) => o.type === "view")
    .filter((o) => !o.properties.some((p) => p.name === "BUS_OBJECT"));
  if (viewsWithoutBo.length > 0) {
    warnings.push(`Views without BUS_OBJECT: ${viewsWithoutBo.map((o) => o.name).join(", ")}`);
  }
}
