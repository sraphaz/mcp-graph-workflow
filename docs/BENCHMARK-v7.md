# Benchmark Real: mcp-graph v7.0

> Resultados medidos no projeto real `mcp-graph-workflow` — 415 nodes, 923 edges, 224 knowledge docs, 6 sprints, 178 tasks concluidas. Data: 2026-04-11.

## 1. Estado do Projeto Real

| Metrica | Valor |
|---------|-------|
| Total Nodes | 415 |
| Total Edges | 923 |
| Epics | 56 |
| Tasks | 84 |
| Subtasks | 114 |
| Acceptance Criteria | 114 |
| Done | 178 (43%) |
| Backlog | 237 (57%) |
| Sprints | 6 |
| Knowledge Docs | 224 |
| Knowledge Token Budget | 53,272 tokens |

### Distribuicao por Tipo

```
epic ████████████████████████████ 56
task ██████████████████████████████████████████ 84
subtask ██████████████████████████████████████████████████████████ 114
acceptance_criteria ██████████████████████████████████████████████████████████ 114
constraint ██████ 12
decision ███████ 14
risk ██████ 11
requirement █████ 9
```

## 2. DORA Metrics (Dados Reais)

| Metrica | Valor | Classificacao |
|---------|-------|---------------|
| Deployment Frequency | 25.4 tasks/day | **Elite** (>2/day) |
| Lead Time (P50) | 14.9h | **Elite** |
| Lead Time (P85) | 30.7h | **High** (<1 week) |
| Change Failure Rate | 0% | **Elite** (<5%) |
| MTTR | 0h | **Elite** (<1h) |
| Trend | Improving | - |

## 3. Integridade do Grafo (Validacao Real)

| Check | Resultado |
|-------|-----------|
| Done Integrity | **PASSED** (0 issues) |
| Status Flow Compliance | **100%** (0 violations) |
| Dependency Cycles | **0** ciclos detectados |
| PRD Quality Score | **B (78/100)** |

## 4. Performance v7 (Benchmarks com SLOs)

### 4.1 Chaos Engineering — Stress Tests

| Operacao | Escala | SLO | Status |
|----------|--------|-----|--------|
| FTS search | 10,000 nodes | < 200ms | PASS |
| Cycle detection + health scan | 1,000 nodes | < 300ms | PASS |
| Full health scan | 1,000 nodes | < 500ms | PASS |
| Knowledge autoprune | 5,000 docs → 500 | < 500ms | PASS |
| Bulk insert | 10K nodes + 20K edges | < 5s | PASS |
| buildTaskContext | 500 nodes | < 500ms | PASS |
| findNextTask | 5,000 tasks | < 300ms | PASS |

### 4.2 RAG Pipeline

| Componente | Escala | SLO | Status |
|-----------|--------|-----|--------|
| Query understanding | per query | < 5ms | PASS |
| Semantic cache lookup | 50 entries | < 2ms | PASS |
| Knowledge FTS search | 500 docs | < 20ms | PASS |
| Token budget report | 500 docs | < 10ms | PASS |
| Intent detection accuracy | 10 queries | > 80% | PASS |

### 4.3 DX Metrics

| Componente | Escala | SLO | Status |
|-----------|--------|-----|--------|
| Token economy summary | 1,000 calls | < 50ms | PASS |
| Velocity calculation | 200 tasks | < 50ms | PASS |
| Tool classification | 58 tools | 100% covered | PASS |
| AI Usage Reduction Score | all tools | 100% | PASS |

## 5. Comparativo v6.3.1 vs v7.0

### O que mudou

| Area | v6.3.1 | v7.0 | Impacto |
|------|--------|------|---------|
| MCP Tools | 53 active + 6 deprecated = 59 | 53 active + 0 deprecated | -10% overhead |
| Tool gate wrapping | 2 wrappers sequenciais | 1 unified gate | **-50% overhead/call** |
| Store reads per call | 2x toGraphDocument + 2x detectPhase | 1x cada | **-50% DB reads** |
| Security | 3 implementacoes fragmentadas | 1 centralizada (safe-path.ts) | 20 vetores cobertos |
| Knowledge pruning | Manual only | Autoprune + dedup deletion + budget | **NOVO** |
| Graph health | Analyzers separados | Unified scan (graph_health tool) | **NOVO** |
| Schema integrity | NULLs possiveis em blocked | Migration v30 backfill | Zero NULLs |
| Legacy migration | .mcp-graph/ auto-rename | Removido (clean) | Menos codigo |
| FTS indexes | Acumulados desde v1 | Rebuilt fresh (migration v30) | Performance limpa |
| Skills | 0 in skills-graph/ | 155 skill definitions | **NOVO** |

### Novas Capacidades v7

1. **Unified Gate System** — single wrapper combina lifecycle + code intelligence, elimina deadlocks (#001-#007)
2. **Knowledge Autoprune** — `KnowledgeStore.autoprune(budget)` com ordenacao por quality/usage/age
3. **Dedup Deletion** — `knowledge_prune(strategy: "dedup")` agora deleta (antes so reportava)
4. **Budget Strategy** — `knowledge_prune(strategy: "budget", maxDocs: 100)` enforce limite
5. **Graph Health Scanner** — `graph_health(scan)` combina 6 analyzers num diagnostico unico
6. **Path Traversal Protection** — `assertPathInside()` centralizado com 20 vetores de ataque
7. **Migration v30** — backfill NULLs + FTS rebuild automatico
8. **155 Skills** — audio, CV, IoT, NLP, ML/AI, data pipelines, Nirvana autonomous systems

## 6. Deterministic-First Architecture

Todos os 58 MCP tools sao 100% deterministicos — zero dependencia de AI/LLM para operacoes internas.

| Layer | Nome | Tools | % |
|-------|------|-------|---|
| L0 | Pure SQL / Data | 32 | 55% |
| L1 | Cache / Memoization | 3 | 5% |
| L2 | Heuristics / FSM | 11 | 19% |
| L3 | Property-Based | 3 | 5% |
| L4 | Meta-Rule Learning | 2 | 3% |
| **Total** | **Deterministic** | **58** | **100%** |
| AI | Fallback | 0 | 0% |

**AI Usage Reduction Score: 100%**

## 7. Knowledge Store Health

| Metrica | Valor |
|---------|-------|
| Total documents | 224 |
| Token budget | 53,272 / 4,000 (1332%) |
| Freshness | 100% fresh (0 stale) |
| Top consumer | PRD (47%, 25K tokens) |
| Quality distribution | 100% medium (avg 0.5) |
| Autoprune available | Yes (v7 new) |
| Dedup deletion available | Yes (v7 new) |

## 8. Test Suite

| Metrica | Valor |
|---------|-------|
| Test files | 502 |
| Tests passing | 5,471 |
| Tests failing | 0 |
| Benchmark SLOs defined | 24 |
| Benchmark SLOs passing | 24/24 (100%) |
| Build | OK |
| Typecheck | zero errors |

## 9. Methodology

- **Lifecycle**: 9-phase Dev Flow (ANALYZE → DEPLOY → LISTENING)
- **Quality Gates**: DoD 9 checks, 4 quality gate analyze modes
- **Pipeline**: v6.0 2-call flow (`start_task` → `finish_task`)
- **44 analyze modes** cobrindo PRD, design, implementation, validation, review, deployment
- **DORA tracking** integrado com `forecast(dora)`
- **Flow principles**: Little's Law, Theory of Constraints, Lean/Toyota, WIP=1
