# Skills Audit — `.agents/skills/` (2026-04-25)

**Task:** T1.1 Tier 1 da v10.2.0 DX Overhaul (`node_7fc7d7dc8b27`).
**Escopo:** Auditoria de 25 skills do Copilot CLI antes de polimento.
**Decisão da Frente 1:** Polir, **não recriar**. As skills já existem e funcionam.

> ⚠️ **Documento interno** — design rationale, fica em `docs/_research/`. Não exposto publicamente per regra `feedback_no_public_design_exposure`.

---

## TL;DR

- **22 de 25** skills (88%) seguem template consistente e de alta qualidade
- **4 outliers** precisam normalização: `graph-prd`, `harness-engineering`, `kanban-orchestrator`, `ui-ux-pro-max`
- As **5 skills prioritárias** (analyze/design/plan/implement/prd) estão **alinhadas com o documento oficial do usuário**, com pequenos ajustes de narrativa necessários (4 fases públicas vs 9 internas)
- Recomendado: 1 commit normalizando os 4 outliers + 1 commit ajustando narrativa "9-phase" → "4 public phases" nas 22 skills consistentes

---

## Skills auditadas (25 total)

### Skills do ciclo de vida (4 — alinhadas com `/graph-*` no documento do usuário)

| Skill | Trigger | Phase | Modelo preferido | AC |
|---|---|---|---|---|
| `graph-analyze` | `/graph-analyze` | ANALYZE | sonnet → opus | ✅ |
| `graph-design` | `/graph-design` | DESIGN | opus → sonnet | ✅ |
| `graph-plan` | `/graph-plan` | PLAN | sonnet → opus | ✅ |
| `graph-implement` | `/graph-implement` | IMPLEMENT | haiku-4-5 → sonnet | ✅ |

### Skills auxiliares (1 — pre-lifecycle)

| Skill | Trigger | Função | Modelo |
|---|---|---|---|
| `graph-prd` | (nenhum — Phase 0) | Transforma idéia → PRD via 7 metodologias (5W2H, JTBD, Pareto, MoSCoW, INVEST, GWT, Risk Matrix) | sonnet → opus |

### Skills internas das 9 fases (5 — invisíveis ao público de 4 fases)

| Skill | Trigger | Mapeamento → Fase Pública |
|---|---|---|
| `graph-validate` | `/graph-validate` | IMPLEMENT (sub-gate VALIDATE) |
| `graph-review` | `/graph-review` | IMPLEMENT (sub-gate REVIEW) |
| `graph-handoff` | `/graph-handoff` | IMPLEMENT (sub-gate HANDOFF) |
| `graph-deploy` | `/graph-deploy` | IMPLEMENT (sub-gate DEPLOY) |
| `graph-listening` | `/graph-listening` | ANALYZE (próximo ciclo) |

### Skills temáticas (10 — usadas dentro das fases conforme contexto)

| Skill | Quando usar |
|---|---|
| `graph-architecture` | DESIGN — decisões arquiteturais avançadas |
| `graph-api-design` | DESIGN — design de APIs REST/GraphQL |
| `graph-security` | qualquer fase — security review |
| `graph-tests` | IMPLEMENT — escrita de testes |
| `graph-quality-assurance` | IMPLEMENT — QA antes de finish_task |
| `graph-bug-hunter` | IMPLEMENT — caça bug em código existente |
| `graph-fix-bugs` | IMPLEMENT — fix de issue específico |
| `graph-refactor` | IMPLEMENT — refactor isolado |
| `graph-performance` | IMPLEMENT — otimização |
| `graph-accessibility` | IMPLEMENT — a11y audit |
| `graph-dependency` | qualquer fase — análise de dependências |
| `graph-docs` | qualquer fase — geração de documentação |

### Skills "non-graph" (3 — utilitárias)

| Skill | Função |
|---|---|
| `harness-engineering` | Cálculo/melhoria do harness score (agent-readiness metric) |
| `kanban-orchestrator` | Orquestração multi-agent via dashboard kanban |
| `ui-ux-pro-max` | Guia de design UI/UX (67 styles, 96 palettes, 57 fonts) |

---

## Análise de qualidade — frontmatter (consistência template)

Critérios de consistência (✅ = presente, ❌ = ausente):

| Skill | name | description | triggers | version | model | When | Flow | Anti-Patterns |
|---|---|---|---|---|---|---|---|---|
| graph-accessibility | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-analyze | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-api-design | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-architecture | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-bug-hunter | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-dependency | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-deploy | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-design | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-docs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-fix-bugs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-handoff | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-implement | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-listening | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-performance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-plan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **graph-prd** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| graph-quality-assurance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-refactor | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-review | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-security | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-tests | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph-validate | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **harness-engineering** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **kanban-orchestrator** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **ui-ux-pro-max** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ (When to Apply em vez disso) | ❌ | ❌ |

**Score de consistência:** 22 skills 8/8, 1 skill 6/8 (graph-prd), 1 skill 6/8 (harness-engineering), 1 skill 5/8 (kanban-orchestrator), 1 skill 1/8 (ui-ux-pro-max).

---

## Outliers — fixes recomendados

### 1. `graph-prd` — Adicionar triggers + version

**Atual:**
```yaml
---
name: graph-prd
description: "Phase 0 — transform a vague idea into a structured, import-ready PRD..."
model:
  prefer: sonnet
  fallback: opus
  rationale: "PRD parsing produces structured decomposition from free-form text"
---
```

**Recomendado:**
```yaml
---
name: graph-prd
description: "Phase 0 — transform a vague idea into a structured, import-ready PRD using 7 product methodologies"
triggers:
  - graph-prd
version: 2.0.0
author: Diego Nogueira
date: 2026-04-25
model:
  prefer: sonnet
  fallback: opus
  rationale: "PRD parsing produces structured decomposition from free-form text"
---
```

**Justificativa:** sem `triggers:`, o Copilot CLI não pega `/graph-prd` como ativador. Mesmo template do resto.

### 2. `harness-engineering` — Adicionar `model` + `Mandatory Flow`

Falta o bloco `model:` no frontmatter (resto: triggers, version, when-to-use, anti-patterns presentes). E não tem seção `## Mandatory Flow` (só `## Workflow`). Adicionar ambos.

### 3. `kanban-orchestrator` — Adicionar `model`, `Flow`, `Anti-Patterns`

Falta os 3 blocos comuns. Tem o essencial (name, desc, triggers, version, When to Use) mas precisa do template completo para uniformidade.

### 4. `ui-ux-pro-max` — Reescrita do frontmatter

Frontmatter mínimo (só name + description). Description tem 810 caracteres — basicamente um catálogo. Recomendar:

- Mover catálogo para `## Catalogue` na body
- Description curta (1 frase, ≤140 chars)
- Adicionar triggers, version, model, When to Use, Anti-Patterns

**Decisão sugerida:** isto é uma skill de domínio diferente (UI/UX, não graph workflow). Talvez **mover para `.agents/skills/_external/ui-ux-pro-max/`** ou marcar como "domain skill" via tag no frontmatter, deixando claro que não segue o template `graph-*`.

---

## Análise de conteúdo — alinhamento com documento oficial do usuário

O documento do usuário ("MCP-Graph v9.4.0 — Guia Completo") propõe **4 fases públicas** (ANALYZE → DESIGN → PLAN → IMPLEMENT) acionadas por:

- `/graph-analyze [requisito]` → **graph-analyze.md** ✅ alinhado
- `/graph-design [instruções]` → **graph-design.md** ✅ alinhado, inclui strict mode
- `/graph-plan [instruções]` → **graph-plan.md** ✅ alinhado, inclui smart_decompose
- `/graph-implement` → **graph-implement.md** ✅ alinhado, inclui v6.0 pipeline

### Ajustes de narrativa recomendados (não-bloqueantes)

1. **`graph-analyze` linha 17 e linha 26**: menciona "9-phase lifecycle" e "Mandatory Flow → set_phase(DESIGN)". Para alinhar com narrativa pública de 4 fases:
   - Substituir "9-phase lifecycle" por "lifecycle" (ou "4 public phases / 9 internal")
   - O `set_phase(DESIGN)` continua certo (DESIGN é fase pública também).

2. **`graph-implement` linha 14 e linha 117**: referência a "9-phase" presente. Mesmo tratamento.

3. **`graph-prd` linha 27**: "9-phase lifecycle" presente. Atualizar.

4. **graph-design/plan/implement não-mencionam `analyze(mode: "rubber-duck")`** mas o documento do usuário menciona `/graph-analyze use rubber-duck`. Verificar se o modo `rubber-duck` existe em `analyze` tool — se sim, documentar nas skills; se não, criar (futuro).

### Modos de `analyze` referenciados pelas skills

| Skill | Modos `analyze` usados |
|---|---|
| graph-analyze | `prd_quality`, `ready` |
| graph-design | `adr`, `contract_coverage`, `design_ready` |
| graph-plan | `smart_decompose`, `sprint_health`, `ready` |
| graph-implement | `tdd_check`, `code_sync`, `implement_done` |

**Total: 11 modos distintos.** Próxima auditoria deveria verificar `src/mcp/tools/analyze.ts` para garantir que todos existem e têm contratos estáveis.

### Tools MCP referenciadas

Skills referenciam estas tools (cross-check com taxonomy.ts/T4.1 necessário):

- **core (já em taxonomy core):** `init`, `import_prd`, `next`, `start_task`, `finish_task`, `update_status`
- **pro (já em taxonomy pro):** `node`, `edge`, `analyze`, `validate`, `plan_sprint`, `context`, `search`, `kanban`, `metrics`, `export`, `snapshot`
- **expert:** `learn_from_project`, `knowledge_stats`, `code_intelligence`, `write_memory`, `set_phase`, `sync_stack_docs`, `forecast`

⚠️ **Inconsistência detectada:** `learn_from_project` e `knowledge_stats` são **referenciadas pelas skills mas não existem na taxonomy** (`src/mcp/tools/taxonomy.ts` criada em T4.1). Verificação:
- Se existem como tools reais não-listadas → adicionar à taxonomy como `expert`
- Se foram renomeadas → atualizar referências nas skills
- Se nunca existiram → remover das skills

---

## Plano de fix (próximas tasks)

Sugerir como tasks subsequentes (não fazer agora):

| ID | Escopo | Esforço |
|---|---|---|
| T1.1a | Normalizar frontmatter dos 4 outliers (graph-prd, harness-engineering, kanban-orchestrator, ui-ux-pro-max) | XS |
| T1.1b | Atualizar narrativa "9-phase" → "4 public phases" nas 22 skills consistentes (find/replace) | S |
| T1.1c | Cross-check tools referenciadas vs taxonomy.ts; resolver `learn_from_project`, `knowledge_stats` | S |
| T1.1d | Verificar 11 modos de `analyze` referenciados existem em `src/mcp/tools/analyze.ts` | S |
| T1.1e | Decidir status de `ui-ux-pro-max` (skill de domínio separada? mover para subfolder?) | XS |

**Esforço total estimado:** 5 tasks XS-S = ~3-5h. Não-bloqueante para release v10.2.0 — pode acontecer em uma sprint subsequente.

---

## Conclusão

**O ecossistema de skills está sólido.** 22 de 25 skills seguem template consistente, as 5 skills prioritárias do documento do usuário têm conteúdo alinhado, e os 4 outliers têm fixes triviais.

**Recomendação para v10.2.0:** não bloquear release nessas correções. Documentar como follow-up. Foco da release deve ser:
1. Wizard `init` que ofereça Copilot integration default-yes (T4.4)
2. Profile filter no MCP server (T4.2)
3. Documentação user-facing (GUIDE/CHEATSHEET/TROUBLESHOOTING/GLOSSARY ✅ entregues)
4. Performance harness (T2.1 ✅ entregue)

Skills audit + fixes vai num PR follow-up dedicado.
