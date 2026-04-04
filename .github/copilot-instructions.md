<!-- mcp-graph:start -->
## mcp-graph — mcp-graph-workflow

Este projeto usa **mcp-graph** para gestão de execução via grafo persistente (SQLite).
Dados armazenados em `workflow-graph/graph.db` (local, gitignored).

### ⚠️ Regra de Execução OBRIGATÓRIA

**O mcp-graph é a fonte de verdade ABSOLUTA. Nenhuma implementação acontece fora do grafo.**

1. **Node deve existir** — antes de escrever QUALQUER código, o node correspondente DEVE existir no grafo
2. **Fluxo obrigatório** — `start_task → [implementar com TDD] → finish_task` (pipeline v6.0) ou `next → context → rag_context → [TDD] → analyze(implement_done) → update_status` (granular) — SEM EXCEÇÕES
3. **Epic = estrutura primeiro** — criar Epic + tasks filhas + edges ANTES de implementar
4. **Status tracking** — `update_status → in_progress` ANTES de codar, `→ done` APÓS completar
5. **Validação** — usar `validate` (action: `ac`) após cada task para checar critérios de aceitação
6. **Zero trabalho não-rastreado** — se não tem node no grafo, CRIAR PRIMEIRO

> **Sem node no grafo = sem código escrito.**

### Fluxo de trabalho OBRIGATÓRIO

**Pipeline v6.0 (recomendado — 2 calls):**
```
start_task → [implementar com TDD] → finish_task
```

**Granular (6 calls — disponível para controle fino):**
```
next → context → rag_context → [implementar com TDD] → analyze(implement_done) → update_status
```

### Lifecycle (9 fases)

1. **ANALYZE** — Criar PRD, definir requisitos (`import_prd`, `add_node`)
2. **DESIGN** — Arquitetura, decisões técnicas (`add_node`, `edge`, `analyze`)
3. **PLAN** — Sprint planning, decomposição (`plan_sprint`, `analyze`, `sync_stack_docs`)
4. **IMPLEMENT** — TDD Red→Green→Refactor (`next`, `context`, `update_status`, `analyze` — modes: implement_done, tdd_check, progress)
5. **VALIDATE** — Testes E2E, critérios de aceitação (`validate_task`, `metrics`)
6. **REVIEW** — Code review, blast radius (`export`, `metrics`)
7. **HANDOFF** — PR, documentação, entrega (`export`, `snapshot`)
8. **DEPLOY** — CI pipeline, release, post-release validation (`export`, `snapshot`, `analyze`)
9. **LISTENING** — Feedback, novo ciclo (`add_node`, `import_prd`)

### Phase Gates (Transições entre Fases)

Antes de mudar de fase, rodar o analyze mode correspondente:

| De → Para | Gate (analyze mode) | Pré-requisitos |
|-----------|---------------------|----------------|
| ANALYZE → DESIGN | — | ≥1 epic/requirement no grafo |
| DESIGN → PLAN | `design_ready` | ADRs, interfaces, coupling check |
| PLAN → IMPLEMENT | — | `sync_stack_docs` + `plan_sprint` executados |
| IMPLEMENT → VALIDATE | `validate_ready` | ≥50% tasks done com AC testável |
| VALIDATE → REVIEW | `done_integrity` + `status_flow` | Todos checks passam |
| REVIEW → HANDOFF | `review_ready` | Export + blast radius ok |
| HANDOFF → DEPLOY | `handoff_ready` + `doc_completeness` | Snapshot + memories salvos |
| DEPLOY → LISTENING | `deploy_ready` + `release_check` | Release validado |

### Definition of Done (8 Checks)

Rodar `analyze(mode: "implement_done", nodeId)` antes de `update_status(done)`:

| # | Check | Severidade | O que verifica |
|---|-------|------------|----------------|
| 1 | `has_acceptance_criteria` | **required** | Task ou parent tem AC |
| 2 | `ac_quality_pass` | **required** | Score AC ≥ 60 (INVEST) |
| 3 | `no_unresolved_blockers` | **required** | Nenhum `depends_on` para node não-done |
| 4 | `status_flow_valid` | **required** | Passou por `in_progress` antes de `done` |
| 5 | `has_description` | recomendado | Descrição não-vazia |
| 6 | `not_oversized` | recomendado | Sem L/XL sem subtasks |
| 7 | `has_testable_ac` | recomendado | ≥1 AC testável |
| 8 | `has_test_files` | recomendado | testFiles preenchido |

### Definition of Ready (7 Checks — Gate ANALYZE → DESIGN)

Rodar `analyze(mode: "ready")` antes de avançar para DESIGN:

| # | Check | O que verifica |
|---|-------|----------------|
| 1 | `has_requirements` | ≥1 epic ou requirement no grafo |
| 2 | `has_acceptance_criteria` | Tasks ou AC nodes existem |
| 3 | `no_orphans` | Sem requirements ou tasks órfãos |
| 4 | `no_cycles` | Sem ciclos de dependência |
| 5 | `has_constraints` | ≥1 constraint node |
| 6 | `has_risks` | ≥1 risk node |
| 7 | `prd_quality_score` | Score PRD ≥ 60 |

### Princípios de Fluxo (Little's Law + Lean + TOC)

**WIP = 1** — Um agente deve ter no máximo 1 task `in_progress` de cada vez.
Lei de Little: `cycle_time = WIP / throughput`. Reduzir WIP reduz cycle time sem perder throughput.

**Pull, não Push** — Usar `next` para puxar a próxima task (pull system).
Nunca empurrar tasks para `in_progress` sem terminar a anterior.

**Gargalo primeiro (Theory of Constraints)** — Se VALIDATE tem tasks acumuladas,
parar de implementar e validar. Otimizar o gargalo, não produzir mais WIP.

**Eliminar desperdício (Lean/Toyota):**
- Overproduction: não implementar features não planejadas
- Waiting: não deixar tasks blocked sem ação
- Overprocessing: usar `context()` (73% menos tokens) em vez de `export()`
- Defects: TDD Red→Green→Refactor elimina retrabalho

**Métricas de fluxo (usar com `metrics` e `analyze(progress)`):**
- Cycle time = `done_timestamp - in_progress_timestamp` por task
- Lead time = `done_timestamp - created_at` por task
- Throughput = tasks done / dias
- Flow efficiency = tempo ativo / lead time total (target > 40%)

### Princípios XP Anti-Vibe-Coding

- **TDD obrigatório** — Teste antes do código. Sem teste = sem implementação.
- **Anti-one-shot** — Nunca gere sistemas inteiros em um prompt. Decomponha em tasks atômicas.
- **Decomposição atômica** — Cada task deve ser completável em ≤2h.
- **Code detachment** — Se a IA errou, explique o erro via prompt. Nunca edite manualmente.
- **CLAUDE.md como spec evolutiva** — Documente padrões e decisões aqui.

### Memory ≠ Estado Atual

Memory files são **snapshots point-in-time**, não estado live. Contagens de progresso ("X/Y done", "% complete") ficam stale rapidamente.

**Antes de planejar baseado em memories:**
1. Grep pelo arquivo/função — se existe com implementação real, o memory é stale
2. **Código vence memory** — se memory diz "X não existe" mas código mostra que sim, confiar no código
3. Contagens numéricas > 48h = possivelmente stale — verificar antes de usar

> **Nunca confiar em contagens de progresso de memories. Sempre verificar no código antes de planejar.**

> **Referências detalhadas on-demand:** Use `help` tool para consultar: `tools`, `analyze_modes`, `skills`, `cli`, `knowledge`, `workflow`, `gates`, `dod`, `dor`, `prerequisites`, `workflows`, `flow`, `quality_metrics`, `tdd`, `pipeline`, `antipatterns`.
<!-- mcp-graph:end -->
