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

/**
 * PlanPayload — V11 Maestro Phase 4 contract.
 *
 * Maestro principle: mcp-graph rastreia, NÃO executa. Tool-braço (graph_*)
 * devolve um plan-payload JSON que o agente cliente executa via:
 *   - native-write → Write/Edit (Claude Code)
 *   - playwright   → Playwright MCP (browser_navigate, browser_snapshot, …)
 *   - browser-use  → Browser Use MCP (browser_use_run com goal/rubric)
 *   - context7     → Context7 MCP (resolve-library-id, query-docs)
 *
 * Decisão arquitetural em ADR 0042 §plan-payload:
 *   - MCP-to-MCP direto é impossível (processos isolados, stdio independente)
 *   - O agente cliente JÁ tem todos os MCPs no mesmo namespace
 *   - postCallback fecha o loop chamando finish_task no graph
 */

import { z } from "zod/v4";

/** Lista canônica de executores. Ordenada para igualdade estável em testes. */
export const EXECUTORS = ["native-write", "playwright", "browser-use", "context7"] as const;
export type Executor = typeof EXECUTORS[number];

/** Step individual do plan — referencia tool por nome + args estruturados. */
export const PlanStepSchema = z.object({
  tool: z.string().min(1).describe("Nome da tool (ex: Write, browser_navigate, browser_use_run)"),
  args: z.record(z.string(), z.unknown()).describe("Args estruturados que o executor passa para a tool"),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;

/** Callback opcional disparado pelo agente após executar todos os steps. */
export const PostCallbackSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
});

export type PostCallback = z.infer<typeof PostCallbackSchema>;

/** Plan-payload completo — boundary contract entre tool-braço e agente cliente. */
export const PlanPayloadSchema = z.object({
  executor: z.enum(EXECUTORS).describe("Qual MCP roda os steps no agente cliente"),
  steps: z.array(PlanStepSchema).min(1).describe("Pelo menos 1 step. Executados na ordem por executor."),
  postCallback: PostCallbackSchema.optional().describe("Tool a chamar após todos os steps (tipicamente finish_task)"),
  auditId: z.string().min(1).describe("UUID gerado pela tool-braço — rastreável em tool_call_log"),
  nodeId: z.string().min(1).describe("Node do graph a que esta intenção pertence"),
});

export type PlanPayload = z.infer<typeof PlanPayloadSchema>;
