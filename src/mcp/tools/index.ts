import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { registerInit } from "./init.js";
import { registerImportPrd } from "./import-prd.js";
import { registerList } from "./list.js";
import { registerShow } from "./show.js";
import { registerNext } from "./next.js";
import { registerUpdateStatus } from "./update-status.js";
import { registerMetrics } from "./metrics.js";
import { registerContext } from "./context.js";
import { registerSearch } from "./search.js";
import { registerAnalyze } from "./analyze.js";
import { registerEdge } from "./edge.js";
import { registerSnapshot } from "./snapshot.js";
import { registerExport } from "./export.js";
import { registerImportGraph } from "./import-graph.js";
import { registerMoveNode } from "./move-node.js";
import { registerCloneNode } from "./clone-node.js";
import { registerSyncStackDocs } from "./sync-stack-docs.js";
import { registerPlanSprint } from "./plan-sprint.js";
import { registerSetPhase } from "./set-phase.js";
import { registerMemory } from "./memory.js";
import { registerManageSkill } from "./manage-skill.js";
import { registerJourney } from "./journey.js";
import { registerHelp } from "./help.js";
// Consolidated tools (v8.0)
import { registerSiebel } from "./siebel.js";
import { registerKnowledge } from "./knowledge.js";
import { registerDavinci } from "./davinci.js";
import { registerTranslate } from "./translate.js";
import { registerNode } from "./node.js";
import { registerValidate } from "./validate.js";
// Task templates
import { registerTemplate } from "./template.js";
// LSP Code Intelligence
import { registerCodeIntelligence } from "./code-intelligence.js";
// Pipeline tools (v6.0)
import { registerStartTask } from "./start-task.js";
import { registerFinishTask } from "./finish-task.js";
// Predictive analytics (v6.0)
import { registerForecast } from "./forecast.js";
// Cross-project learning (v6.0)
import { registerLearnFromProject } from "./learn-from-project.js";
// Interdisciplinary knowledge intersector
import { registerIntersectKnowledge } from "./intersect-knowledge.js";
// Self-healing MAPE-K engine
import { registerSelfHealing } from "./self-healing.js";
// Kanban orchestrator
import { registerKanban } from "./kanban.js";
// Graph health scanner
import { registerGraphHealth } from "./graph-health.js";
import { wrapToolsWithGates } from "../unified-gate.js";

export function registerAllTools(server: McpServer, store: SqliteStore): void {
  registerInit(server, store);
  registerImportPrd(server, store);
  registerList(server, store);
  registerShow(server, store);
  registerNext(server, store);
  registerUpdateStatus(server, store);
  registerMetrics(server, store);
  registerContext(server, store);
  registerSearch(server, store);
  registerAnalyze(server, store);
  registerEdge(server, store);
  registerSnapshot(server, store);
  registerExport(server, store);
  registerImportGraph(server, store);
  registerMoveNode(server, store);
  registerCloneNode(server, store);
  registerSyncStackDocs(server, store);
  registerPlanSprint(server, store);
  registerSetPhase(server, store);
  registerMemory(server, store);
  registerManageSkill(server, store);
  registerJourney(server, store);
  registerHelp(server);
  // Consolidated tools (v8.0)
  registerSiebel(server, store);
  registerKnowledge(server, store);
  registerDavinci(server, store);
  registerTranslate(server, store);
  registerNode(server, store);
  registerValidate(server, store);
  registerTemplate(server, store);
  registerCodeIntelligence(server, store);
  registerStartTask(server, store);
  registerFinishTask(server, store);
  registerForecast(server, store);
  registerLearnFromProject(server, store);
  registerIntersectKnowledge(server, store);
  registerSelfHealing(server, store);
  registerKanban(server, store);
  registerGraphHealth(server, store);
  wrapToolsWithGates(server, store);
}
