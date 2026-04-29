/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Economy pipeline orchestrator — ADR-ruflo-07.
 * Stage order: Booster → Cache → Tier → Batch → Tiered → LLM.
 * Each stage is gated by an env flag (default off).
 */

/** Canonical pipeline stage order per ADR-ruflo-07. */
export const ECONOMY_PIPELINE_ORDER = ["booster", "cache", "tier", "batch", "tiered", "llm"] as const;
export type EconomyStage = (typeof ECONOMY_PIPELINE_ORDER)[number];

type Next<Req, Res> = (req: Req) => Promise<Res>;
type StageHandler<Req, Res> = (req: Req, next: Next<Req, Res>) => Promise<Res>;

type StageMap<Req, Res> = Partial<Record<EconomyStage, StageHandler<Req, Res>>>;

const ENV_FLAGS: Record<EconomyStage, string | undefined> = {
  booster: "ECONOMY_BOOSTER",
  cache: "ECONOMY_CACHE",
  tier: "ECONOMY_TIER_ROUTER",
  batch: "ECONOMY_BATCH",
  tiered: "ECONOMY_TIERED",
  llm: undefined,
};

function isStageEnabled(stage: EconomyStage): boolean {
  const flag = ENV_FLAGS[stage];
  if (!flag) return true;
  return process.env[flag] === "on";
}

export interface EconomyPipelineOptions<Req, Res> {
  llmFn: (req: Req) => Promise<Res>;
  stages?: StageMap<Req, Res>;
}

/**
 * Builds a composed pipeline function.
 * Stages with disabled env flags are skipped; the request passes through to the next enabled stage.
 */
export function buildEconomyPipeline<Req, Res>(
  opts: EconomyPipelineOptions<Req, Res>,
): (req: Req) => Promise<Res> {
  const { llmFn, stages = {} } = opts;

  const enabledStages = ECONOMY_PIPELINE_ORDER
    .filter((s) => s !== "llm" && isStageEnabled(s) && stages[s] !== undefined)
    .map((s) => stages[s] as StageHandler<Req, Res>);

  const terminal: Next<Req, Res> = (req) => llmFn(req);

  const composed = enabledStages.reduceRight<Next<Req, Res>>(
    (next, handler) => (req) => handler(req, next),
    terminal,
  );

  return composed;
}
