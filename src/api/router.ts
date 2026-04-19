/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { Router } from "express";
import type { SqliteStore } from "../core/store/sqlite-store.js";
import type { GraphEventBus } from "../core/events/event-bus.js";
import type { StoreRef } from "../core/store/store-manager.js";
import { createProjectRouter } from "./routes/project.js";
import { createNodesRouter } from "./routes/nodes.js";
import { createEdgesRouter } from "./routes/edges.js";
import { createStatsRouter } from "./routes/stats.js";
import { createSearchRouter } from "./routes/search.js";
import { createGraphRouter } from "./routes/graph.js";
import { createImportRouter } from "./routes/import.js";
import { createIntegrationsRouter } from "./routes/integrations.js";
import { createInsightsRouter } from "./routes/insights.js";
import { createSkillsRouter } from "./routes/skills.js";
import { createCaptureRouter } from "./routes/capture.js";
import { createDocsCacheRouter } from "./routes/docs-cache.js";
import { createContextRouter } from "./routes/context.js";
import { createCodeGraphRouter } from "./routes/code-graph.js";
import { createRagRouter } from "./routes/rag.js";
import { createKnowledgeRouter } from "./routes/knowledge.js";
import { createBenchmarkRouter } from "./routes/benchmark.js";
import { createHarnessRouter } from "./routes/harness.js";
import { createAutonomyRouter } from "./routes/autonomy.js";
import { createLogsRouter } from "./routes/logs.js";
import { createJourneyRouter } from "./routes/journey.js";
import { createFolderRouter } from "./routes/folder.js";
import { createSiebelRouter } from "./routes/siebel.js";
import { createTranslationRouter } from "./routes/translation.js";
import { createTranslationProjectRouter } from "./routes/translation-project.js";
import { createDocsReferenceRouter } from "./routes/docs-reference.js";
import { createDreamRouter } from "./routes/dream.js";
import { createDavinciRouter } from "./routes/davinci.js";
import { createKanbanRouter } from "./routes/kanban.js";
import { createEventsSseRouter } from "./routes/events-sse.js";
import { createAgentsRouter } from "./routes/agents.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { setLogListener } from "../core/utils/logger.js";

export interface ApiRouterOptions {
  store: SqliteStore;
  basePath?: string;
  eventBus?: GraphEventBus;
  storeRef?: StoreRef;
  getBasePath?: () => string;
  storeManager?: import("../core/store/store-manager.js").StoreManager;
}

export function createApiRouter(storeOrOptions: SqliteStore | ApiRouterOptions): Router {
  const store = "store" in storeOrOptions ? storeOrOptions.store : storeOrOptions;
  const basePath = "basePath" in storeOrOptions ? (storeOrOptions.basePath ?? process.cwd()) : process.cwd();
  const eventBus = "eventBus" in storeOrOptions ? storeOrOptions.eventBus : undefined;

  // StoreRef: if a storeManager was provided, use its storeRef; otherwise create a static ref
  const storeManager = "storeManager" in storeOrOptions ? storeOrOptions.storeManager : undefined;
  const storeRef: StoreRef = storeManager?.storeRef ?? ("storeRef" in storeOrOptions && storeOrOptions.storeRef
    ? storeOrOptions.storeRef
    : { current: store });
  const getBasePath: () => string = storeManager?.getBasePathFn ?? ("getBasePath" in storeOrOptions && storeOrOptions.getBasePath
    ? storeOrOptions.getBasePath
    : () => basePath);

  const router = Router();

  router.use(requestLogger);

  router.use("/project", createProjectRouter(storeRef));
  router.use("/nodes", createNodesRouter(storeRef));
  router.use("/edges", createEdgesRouter(storeRef));
  router.use("/stats", createStatsRouter(storeRef));
  router.use("/search", createSearchRouter(storeRef));
  router.use("/graph", createGraphRouter(storeRef));
  router.use("/import", createImportRouter(storeRef));
  router.use("/integrations", createIntegrationsRouter(storeRef, getBasePath));
  router.use("/insights", createInsightsRouter(storeRef, getBasePath));
  router.use("/skills", createSkillsRouter(getBasePath, storeRef));
  router.use("/capture", createCaptureRouter());
  router.use("/docs", createDocsCacheRouter(storeRef));
  router.use("/context", createContextRouter(storeRef));
  router.use("/code-graph", createCodeGraphRouter({ storeRef, getBasePath }));
  router.use("/rag", createRagRouter(storeRef));
  router.use("/knowledge", createKnowledgeRouter(storeRef));
  router.use("/benchmark", createBenchmarkRouter(storeRef));
  router.use("/harness", createHarnessRouter(storeRef));
  router.use("/autonomy", createAutonomyRouter(storeRef));
  router.use("/siebel", createSiebelRouter(storeRef, getBasePath));
  router.use("/logs", createLogsRouter());
  router.use("/journey", createJourneyRouter(storeRef, getBasePath));
  router.use("/translation", createTranslationRouter(storeRef, eventBus ?? undefined));
  router.use("/translation/projects", createTranslationProjectRouter(storeRef, eventBus ?? undefined));
  router.use("/docs-reference", createDocsReferenceRouter(getBasePath));
  router.use("/dream", createDreamRouter(storeRef, eventBus ?? undefined));
  router.use("/davinci", createDavinciRouter());
  router.use("/kanban", createKanbanRouter(storeRef));
  router.use("/events", createEventsSseRouter(eventBus ?? undefined));
  router.use("/agents", createAgentsRouter(storeRef));

  if (storeManager) {
    router.use("/folder", createFolderRouter(storeManager));
  }

  if (eventBus) {
    // NOTE: SSE is already handled by createEventsSseRouter above.
    // createEventsRouter was previously also mounted at /events causing a
    // duplicate route — it is intentionally omitted here (E14-T09 fix).

    let emitting = false;
    setLogListener((entry) => {
      if (emitting) return;
      emitting = true;
      try {
        eventBus.emit({
          type: "log:entry" as const,
          timestamp: entry.timestamp,
          payload: {
            id: entry.id,
            level: entry.level,
            message: entry.message,
            ...(entry.context ? { context: entry.context } : {}),
          },
        });
      } finally {
        emitting = false;
      }
    });
  }

  // 404 handler — must come before errorHandler (E14-T08 fix)
  router.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  router.use(errorHandler);

  return router;
}
