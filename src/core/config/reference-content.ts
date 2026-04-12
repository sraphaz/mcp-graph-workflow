/**
 * Reference content extracted from ai-memory-generator.ts.
 * Shared between the generator (full mode) and the help MCP tool (on-demand).
 */

export const TOOL_TABLE_FULL = `### Ferramentas MCP disponíveis (37 tools — v8.0 consolidated)

#### Pipeline Tools (v6.0 — recommended)

| Tool | Quando usar |
|------|-------------|
| \`start_task\` | Iniciar próxima task em 1 call (compõe next + context + TDD hints + update_status). Substitui 5 calls separados. |
| \`finish_task\` | Finalizar task com validação em 1 call (compõe DoD 9 checks + AC + update_status + epic promotion + next). Substitui 3 calls separados. |

#### Projeto & Grafo

| Tool | Quando usar |
|------|-------------|
| \`init\` | Inicializar grafo do projeto (cria DB, AI memory files, detecta MCPs) |
| \`list\` | Listar nodes do grafo (filtrar por tipo/status/parent) |
| \`show\` | Ver detalhes de um node específico (metadata, deps, knowledge) |
| \`search\` | Busca full-text no grafo (FTS5 + BM25 ranking) |
| \`export\` | Exportar grafo (JSON completo ou Mermaid diagram) |
| \`snapshot\` | Criar/restaurar snapshots do grafo (backup/rollback) |
| \`metrics\` | Estatísticas do grafo (\`stats\`) ou velocidade por sprint (\`velocity\`) |

#### Nodes & Edges

| Tool | Quando usar |
|------|-------------|
| \`node\` | CRUD de nodes: action \`add\` (criar), \`update\` (atualizar), \`delete\` (remover) |
| \`move_node\` | Mover node para outro parent |
| \`clone_node\` | Clonar node com filhos (deep copy) |
| \`edge\` | Criar/remover relações entre nodes (depends_on, blocks, related_to) |
| \`update_status\` | Mudar status de um node (backlog→ready→in_progress→done) |
| \`bulk_update_status\` | Atualizar status de múltiplos nodes de uma vez |

#### PRD & Planejamento

| Tool | Quando usar |
|------|-------------|
| \`import_prd\` | Importar PRD → segmentar → classificar → extrair → inferir deps → criar grafo + indexar knowledge |
| \`plan_sprint\` | Gerar relatório de planejamento de sprint (capacity, velocity, recomendações) |
| \`analyze\` | 24 modos de análise por fase do lifecycle (ver modos abaixo) |
| \`set_phase\` | Forçar/resetar fase do lifecycle (strict/advisory, gate checks) + Code Intelligence mode (strict/advisory/off) + Tool Prerequisites mode (strict/advisory/off) |

#### Contexto & RAG

| Tool | Quando usar |
|------|-------------|
| \`next\` | Próxima task recomendada (prioridade + deps + knowledge coverage 0-1 + TDD hints + velocity) |
| \`context\` | Contexto consolidado: action \`compact\` (task context ~73% redução), \`rag\` (RAG phase-aware, tiers: summary/standard/deep), \`compress\` (compressão de texto), \`batch_compress\` (compressão em lote) |
| \`sync_stack_docs\` | Sincronizar docs das libs do projeto via Context7 |

#### Memórias do Projeto

| Tool | Quando usar |
|------|-------------|
| \`write_memory\` | Escrever memória em workflow-graph/memories/{name}.md (auto-indexa no RAG) |
| \`read_memory\` | Ler conteúdo de uma memória específica |
| \`list_memories\` | Listar todas as memórias disponíveis |
| \`delete_memory\` | Remover memória do filesystem e do knowledge store |

#### Validação

| Tool | Quando usar |
|------|-------------|
| \`validate\` | Validação: action \`task\` (browser A/B com Playwright) ou \`ac\` (critérios de aceitação) |

#### Skills

| Tool | Quando usar |
|------|-------------|
| \`manage_skill\` | Gerenciar skills: action \`list\` (listar/filtrar por fase), \`enable\`/\`disable\`, CRUD de custom skills |

#### Utilitários

| Tool | Quando usar |
|------|-------------|
| \`help\` | Referência on-demand de tools, analyze modes, skills, CLI, workflow (este tool) |
| \`journey\` | Gerenciar journey maps de websites (list, get, search, index para RAG) |
| \`import_graph\` | Importar/merge grafo JSON exportado (local wins, dry_run disponível) |

#### Code Intelligence (LSP)

| Tool | Quando usar |
|------|-------------|
| \`code_intelligence\` | Análise semântica via LSP: definition, references, hover, rename, call_hierarchy, diagnostics, symbols. Multi-language (TS, Python, Rust, Go, Java, C/C++, Ruby, PHP, Kotlin, Swift, C#, Lua) |

#### Knowledge (consolidated v8.0)

| Tool | Quando usar |
|------|-------------|
| \`knowledge\` | Knowledge store consolidado: action \`stats\` (estatísticas), \`export\` (export/import/preview packages), \`feedback\` (helpful/unhelpful/outdated), \`prune\` (limpeza), \`reindex\` (rebuild FTS), \`batch_feedback\` (feedback em lote) |

#### Siebel CRM (consolidated v8.0)

| Tool | Quando usar |
|------|-------------|
| \`siebel\` | Siebel CRM consolidado: action \`import_sif\` (importar .SIF), \`analyze\` (impact/dependencies/circular), \`compose\` (Composer via Playwright), \`env\` (ambientes), \`validate\` (validação SIF), \`search\` (busca objetos), \`generate\` (gerar SIF), \`import_docs\` (importar docs), \`batch_import_sif\` (import em lote) |

#### DaVinci (consolidated v8.0)

| Tool | Quando usar |
|------|-------------|
| \`davinci\` | DaVinci converter consolidado: action \`analyze\` (JS AST analysis), \`build\` (build output), \`convert\` (code conversion), \`batch_convert\` (conversão em lote) |

#### Translation (consolidated v8.0)

| Tool | Quando usar |
|------|-------------|
| \`translate\` | Tradução de código: action \`convert\` (traduzir entre linguagens), \`analyze\` (prontidão), \`jobs\` (gerenciar jobs), \`batch_convert\` (traduzir múltiplos) |`;

export const DEPRECATED_TOOLS_SECTION = `#### Tools Deprecated (backward compat, removidos na v7.0)

| Tool antigo | Usar no lugar |
|-------------|---------------|
| \`add_node\` | \`node\` com action:\`add\` |
| \`update_node\` | \`node\` com action:\`update\` |
| \`delete_node\` | \`node\` com action:\`delete\` |
| \`validate_task\` | \`validate\` com action:\`task\` |
| \`validate_ac\` | \`validate\` com action:\`ac\` |
| \`list_skills\` | \`manage_skill\` com action:\`list\` |`;

export const ANALYZE_MODES_SECTION = `### Modos do analyze por fase

| Fase | Modo | O que verifica |
|------|------|----------------|
| ANALYZE | \`prd_quality\` | Qualidade do PRD (completude, user stories, AC) |
| ANALYZE | \`scope\` | Escopo do grafo (tipos, distribuição, cobertura) |
| ANALYZE | \`ready\` | Definition of Ready (bloqueios, dependências, AC) |
| ANALYZE | \`risk\` | Riscos (complexidade, deps, tamanho, AC faltantes) |
| ANALYZE | \`blockers\` | Bloqueios transitivos de um node |
| ANALYZE | \`cycles\` | Ciclos de dependência no grafo |
| ANALYZE | \`critical_path\` | Caminho crítico (sequência mais longa de deps) |
| PLAN | \`decompose\` | Tasks grandes que precisam ser decompostas |
| DESIGN | \`adr\` | Validação de ADRs (Architecture Decision Records) |
| DESIGN | \`traceability\` | Matriz de rastreabilidade (req → task → test) |
| DESIGN | \`coupling\` | Acoplamento entre módulos |
| DESIGN | \`interfaces\` | Verificação de interfaces e contratos |
| DESIGN | \`tech_risk\` | Riscos técnicos (complexidade, stack, deps externas) |
| DESIGN | \`design_ready\` | Gate DESIGN→PLAN (pré-requisitos atendidos?) |
| IMPLEMENT | \`implement_done\` | Definition of Done (8 checks: 4 required + 4 recommended) |
| IMPLEMENT | \`tdd_check\` | Aderência TDD (specs sugeridos por AC) |
| IMPLEMENT | \`progress\` | Sprint burndown + velocity trend + blockers + ETA |
| VALIDATE | \`validate_ready\` | Gate IMPLEMENT→VALIDATE |
| VALIDATE | \`done_integrity\` | Integridade dos nodes marcados done |
| VALIDATE | \`status_flow\` | Fluxo de status válido (sem pulos) |
| REVIEW | \`review_ready\` | Gate VALIDATE→REVIEW |
| HANDOFF | \`handoff_ready\` | Gate REVIEW→HANDOFF |
| HANDOFF | \`doc_completeness\` | Completude de documentação |
| DEPLOY | \`deploy_ready\` | Gate HANDOFF→DEPLOY (snapshot, tasks done, no blocked) |
| DEPLOY | \`release_check\` | Validação de release readiness |
| LISTENING | \`listening_ready\` | Gate DEPLOY→LISTENING |
| LISTENING | \`backlog_health\` | Saúde do backlog (distribuição, aging) |
| PLAN | \`sprint_health\` | Saúde do sprint (burndown, bloqueios, health grade) |
| PLAN | \`auto_ready\` | Tasks que podem ser promovidas backlog → ready |
| DESIGN | \`contract_coverage\` | Cobertura de contratos cross-service |
| DESIGN | \`data_integrity\` | Validação de data tables |
| IMPLEMENT | \`formula_consistency\` | Validação de fórmulas (game balance) |
| IMPLEMENT | \`performance_budget\` | Status do budget de performance |
| IMPLEMENT | \`state_completeness\` | Validação de state machines |
| VALIDATE | \`scenario_coverage\` | Cobertura de cenários de teste |
| VALIDATE | \`asset_blockers\` | Assets bloqueando tasks |
| VALIDATE | \`config_coverage\` | Cobertura de config schemas |
| VALIDATE | \`metric_coverage\` | Métricas para itens de alto risco |
| VALIDATE | \`concurrency_risk\` | Detecção de race conditions |
| IMPLEMENT | \`economy_simulation\` | Simulação de economia (inflação, gold balance) |`;

export const KNOWLEDGE_PIPELINE_SECTION = `### Pipeline de Conhecimento (Knowledge Store + RAG)

Fontes indexadas automaticamente:
- **Project memories** — ao escrever com \`write_memory\` (auto-indexa)
- **PRD imports** — ao importar com \`import_prd\`
- **Browser captures** — ao validar com \`validate_task\`
- **Stack docs** — ao sincronizar com \`sync_stack_docs\`
- **Sprint reports** — ao gerar com \`plan_sprint\`

Recuperação: \`context(action:rag)\` monta contexto phase-aware com budget de tokens:
- 60% contexto do grafo (nodes, deps, status)
- 30% knowledge store (BM25 + TF-IDF)
- 10% metadata de fase

Manual: \`knowledge(action:reindex)\` para rebuild completo do índice.`;

export const SKILLS_SECTION = `### Skills Built-in (54 skills)

54 skills mapeadas às fases do lifecycle. Use \`list_skills\` para descobrir por fase ou ver instruções completas.

#### Skills por fase

| Fase | Skills sugeridas |
|------|-----------------|
| ANALYZE | \`create-prd-chat-mode\`, \`business-analyst\`, \`product-manager\` |
| DESIGN | \`breakdown-epic-arch\`, \`context-architect\`, \`backend-architect\` |
| PLAN | \`breakdown-feature-prd\`, \`track-with-mcp-graph\` |
| IMPLEMENT | \`subagent-driven-development\`, \`xp-bootstrap\`, \`self-healing-awareness\` |
| VALIDATE | \`playwright-explore-website\`, \`playwright-generate-test\`, \`e2e-testing\` |
| REVIEW | \`code-reviewer\`, \`code-review-checklist\`, \`review-and-refactor\`, \`observability-engineer\` |
| DEPLOY | \`deployment-engineer\`, \`devops-deploy\`, \`git-pushing\` |
| HANDOFF | \`delivery-checklist\`, \`pr-documentation\`, \`knowledge-capture\` |
| LISTENING | \`feedback-collector\`, \`iteration-planner\`, \`metrics-retrospective\` |

#### Categorias adicionais (multi-fase)

| Categoria | Skills |
|-----------|--------|
| software-design | SOLID, KISS, YAGNI, DRY, clean-architecture, composition-over-inheritance |
| security | \`owasp-web-security\`, \`auth-and-secrets\`, \`database-and-deps-security\` |
| ddd | \`domain-driven-design\` (DESIGN, PLAN) |
| testing | \`comprehensive-testing-reference\`, \`self-healing-awareness\` (IMPLEMENT, VALIDATE) |
| cost-reducer | \`cloud-infra-cost\`, \`code-level-savings\`, \`finops-services\` (DESIGN, REVIEW) |
| frontend-design | \`ui-ux-patterns\` (DESIGN, IMPLEMENT) |

#### Custom Skills

Crie skills específicas do projeto via \`manage_skill\` (create/enable/disable). Custom skills são armazenadas no grafo e aparecem junto com as built-in em \`list_skills\`.

#### Self-Healing Awareness

A skill \`self-healing-awareness\` monitora padrões de erro recorrentes e sugere correções automaticamente. Ativa nas fases IMPLEMENT e VALIDATE.`;

export const PHASE_GATES_SECTION = `### Phase Gates (Transições entre Fases)

Antes de mudar de fase, rodar o analyze mode correspondente:

| De → Para | Gate (analyze mode) | Pré-requisitos |
|-----------|---------------------|----------------|
| ANALYZE → DESIGN | — | ≥1 epic/requirement no grafo |
| DESIGN → PLAN | \`design_ready\` | ADRs, interfaces, coupling check |
| PLAN → IMPLEMENT | — | \`sync_stack_docs\` + \`plan_sprint\` executados |
| IMPLEMENT → VALIDATE | \`validate_ready\` | ≥50% tasks done com AC testável |
| VALIDATE → REVIEW | \`done_integrity\` + \`status_flow\` | Todos checks passam |
| REVIEW → HANDOFF | \`review_ready\` | Export + blast radius ok |
| HANDOFF → DEPLOY | \`handoff_ready\` + \`doc_completeness\` | Snapshot + memories salvos |
| DEPLOY → LISTENING | \`deploy_ready\` + \`release_check\` | Release validado |`;

export const DOD_SECTION = `### Definition of Done (8 Checks)

Rodar \`analyze(mode: "implement_done", nodeId)\` antes de \`update_status(done)\`:

| # | Check | Severidade | O que verifica |
|---|-------|------------|----------------|
| 1 | \`has_acceptance_criteria\` | **required** | Task ou parent tem AC |
| 2 | \`ac_quality_pass\` | **required** | Score AC ≥ 60 (INVEST) |
| 3 | \`no_unresolved_blockers\` | **required** | Nenhum \`depends_on\` para node não-done |
| 4 | \`status_flow_valid\` | **required** | Passou por \`in_progress\` antes de \`done\` |
| 5 | \`has_description\` | recomendado | Descrição não-vazia |
| 6 | \`not_oversized\` | recomendado | Sem L/XL sem subtasks |
| 7 | \`has_testable_ac\` | recomendado | ≥1 AC testável |
| 8 | \`has_test_files\` | recomendado | testFiles preenchido |`;

export const TOOL_PREREQUISITES_SECTION = `### Tool Prerequisites (Modo Strict)

Em \`strict\`, ações são bloqueadas se pré-requisitos não foram executados:

| Trigger | Pré-requisitos obrigatórios | Escopo |
|---------|----------------------------|--------|
| \`set_phase(PLAN)\` | \`analyze(design_ready)\` | projeto |
| \`set_phase(IMPLEMENT)\` | \`sync_stack_docs\` + \`plan_sprint\` | projeto |
| \`update_status(in_progress)\` | \`next\` | projeto |
| \`update_status(done)\` IMPLEMENT | \`context(compact)\` + \`context(rag)\` + \`analyze(implement_done)\` | por node |
| \`update_status(done)\` VALIDATE | \`validate\` + \`analyze(validate_ready)\` | misto |
| \`set_phase(HANDOFF)\` | \`analyze(review_ready)\` + \`export\` | projeto |
| \`set_phase(LISTENING)\` | \`analyze(handoff_ready)\` + \`snapshot\` + \`write_memory\` | projeto |`;

export const WORKFLOWS_SECTION = `### Workflows Compostos (Combinações Poderosas)

**PRD → Sprint Ready:**
\`import_prd → analyze(prd_quality, scope, risk) → plan_sprint → sync_stack_docs\`

**Implementação com Contexto Completo:**
\`next → context(compact) → context(rag, detail=deep) → code_intelligence(impact) → [TDD] → analyze(implement_done) → update_status(done)\`

**Validação E2E:**
\`validate(task, Playwright A/B) → analyze(done_integrity, status_flow) → export(mermaid)\`

**Self-Healing (prevenir erros recorrentes):**
\`context(action:rag, query="erro similar") → write_memory(padrão encontrado) → next\`

**Snapshot & Rollback:**
\`snapshot(create) antes de mudanças arriscadas → [implementar] → snapshot(restore) se falhar\``;

export const AGENT_ANTIPATTERNS_SECTION = `### Erros Comuns de Agentes

| Erro | Correto |
|------|---------|
| Usar \`export()\` para contexto de task | Usar \`context()\` (73% menos tokens) |
| Marcar done sem rodar \`analyze(implement_done)\` | Sempre rodar DoD check antes |
| Implementar sem chamar \`next\` | \`next\` dá prioridade + TDD hints + deps check |
| Confiar em memories para estado atual | Grep no código — memories ficam stale |
| Pular \`context(action:rag)\` em IMPLEMENT | RAG traz decisões de DESIGN + healing memories |
| Criar tasks sem AC | AC é required — \`validate(ac)\` bloqueia sem ela |
| Ignorar Code Intelligence em REVIEW | \`code_intelligence(impact)\` mostra blast radius |
| Usar 6 calls separados (next+context+rag+...) | Usar \`start_task\` + \`finish_task\` (pipeline v6.0) |
| Ignorar \`_lifecycle.nextAction\` na resposta | Seguir o nextAction — o grafo sabe o que fazer |`;

export const FLOW_PRINCIPLES_SECTION = `### Princípios de Fluxo (Little's Law + Lean + TOC)

**WIP = 1** \u2014 Um agente deve ter no máximo 1 task \`in_progress\` de cada vez.
Lei de Little: \`cycle_time = WIP / throughput\`. Reduzir WIP reduz cycle time sem perder throughput.

**Pull, não Push** \u2014 Usar \`next\` para puxar a próxima task (pull system).
Nunca empurrar tasks para \`in_progress\` sem terminar a anterior.

**Gargalo primeiro (Theory of Constraints)** \u2014 Se VALIDATE tem tasks acumuladas,
parar de implementar e validar. Otimizar o gargalo, não produzir mais WIP.

**Eliminar desperdício (Lean/Toyota):**
- Overproduction: não implementar features não planejadas
- Waiting: não deixar tasks blocked sem ação
- Overprocessing: usar \`context()\` (73% menos tokens) em vez de \`export()\`
- Defects: TDD Red→Green→Refactor elimina retrabalho

**Métricas de fluxo (usar com \`metrics\` e \`analyze(progress)\`):**
- Cycle time = \`done_timestamp - in_progress_timestamp\` por task
- Lead time = \`done_timestamp - created_at\` por task
- Throughput = tasks done / dias
- Flow efficiency = tempo ativo / lead time total (target > 40%)`;

export const QUALITY_METRICS_SECTION = `### Métricas de Qualidade (Six Sigma + DORA + Shift-Left)

**First-Pass Yield (Six Sigma):**
Tasks marcadas done que NÃO precisaram de rework (status revertido). Target: > 95%.
Se first_pass_yield cai, rodar \`analyze(tdd_check)\` mais rigoroso.

**DORA Metrics (4 indicadores de delivery health):**
1. **Deployment Frequency** = nodes \`done\` por dia
2. **Lead Time** = \`done_timestamp - created_at\` (target P85 < 1 dia para tasks atômicas)
3. **Change Failure Rate** = tasks revertidas / total done (target < 10%)
4. **MTTR** = tempo de rework-detectado até rework-resolvido (target < 2h)

**Shift-Left Testing (custo de defeitos por fase):**
| Fase onde bug é encontrado | Custo relativo |
|---------------------------|----------------|
| DESIGN | 1x |
| PLAN | 3x |
| IMPLEMENT | 10x |
| VALIDATE | 25x |
| DEPLOY/produção | 100x |

Implicação: validar schemas em DESIGN, test stubs em PLAN, TDD em IMPLEMENT. Nunca descobrir bugs em DEPLOY.`;

export const DOR_SECTION = `### Definition of Ready (7 Checks — Gate ANALYZE → DESIGN)

Rodar \`analyze(mode: "ready")\` antes de avançar para DESIGN:

| # | Check | O que verifica |
|---|-------|----------------|
| 1 | \`has_requirements\` | ≥1 epic ou requirement no grafo |
| 2 | \`has_acceptance_criteria\` | Tasks ou AC nodes existem |
| 3 | \`no_orphans\` | Sem requirements ou tasks órfãos |
| 4 | \`no_cycles\` | Sem ciclos de dependência |
| 5 | \`has_constraints\` | ≥1 constraint node |
| 6 | \`has_risks\` | ≥1 risk node |
| 7 | \`prd_quality_score\` | Score PRD ≥ 60 |`;

export const TDD_ENFORCEMENT_SECTION = `### TDD Enforcement (Testabilidade por AC)

O \`next\` retorna \`tddHints\` — specs de teste inferidos dos AC:

**Inferência de tipo de teste por keywords:**
- **Unit**: "retorna", "returns", "valida", "calculates", "parse"
- **Integration**: "persiste", "database", "sync", "saves", "indexa"
- **E2E**: "navega", "page", "form", "clicks", "browser"

**Métricas TDD (via \`analyze(tdd_check)\`):**
- \`testabilityScore\` — % de AC que são testáveis (target: 100%)
- \`tasksAtRisk\` — tasks com testability = 0%
- \`suggestedSpecs\` — specs sugeridos por AC (nome + tipo + setup)

**Regra:** Se \`testabilityScore < 80%\`, reescrever AC antes de implementar.`;

export const PIPELINE_TOOLS_SECTION = `### Pipeline Tools v6.0 (Agent Autopilot)

**Fluxo v6.0 (recomendado — 2 calls):**
\`\`\`
start_task → [implementar com TDD] → finish_task
\`\`\`

**Fluxo v5.x (granular — 6 calls, ainda disponível):**
\`\`\`
next → context(compact) → context(rag) → [implementar com TDD] → analyze(implement_done) → update_status
\`\`\`

#### start_task
Compõe: \`next\` + \`context(compact)\` + \`context(rag)\` + TDD hints + \`update_status(in_progress)\`
- \`nodeId?\` — task específica ou auto via next
- \`contextDetail?\` — "summary" | "standard" | "deep" (default: standard)
- \`ragBudget?\` — token budget para RAG (default: 4000)
- \`autoStart?\` — marca in_progress automaticamente (default: true)
Retorna: task + context + ragContext + tddHints + startedAt

#### finish_task
Compõe: DoD (9 checks) + AC validation + \`update_status(done)\` + epic promotion + next
- \`nodeId\` — task ID (obrigatório)
- \`rationale?\` — decisão técnica (indexada como AI decision para RAG futuro)
- \`testFiles?\` — arquivos de teste associados
- \`autoNext?\` — retorna próxima task recomendada (default: true)
Retorna: dodReport + status (done|blocked) + blockers + epicPromotion + nextTask

#### Agent State Machine (nextAction)
Toda resposta de tool inclui \`_lifecycle.nextAction\` com a próxima ação recomendada:
- \`tool\` — qual tool chamar
- \`args?\` — argumentos sugeridos
- \`reason\` — por que essa ação
- \`priority\` — "required" | "recommended" | "optional"
- \`hint?\` — dica contextual (ex: "Write test for AC #1 first")

O agente segue o \`nextAction\` — o grafo dirige o workflow, não o agente.`;

export const CLI_COMMANDS = `### Comandos essenciais

\`\`\`bash
npx mcp-graph stats            # Estatísticas do grafo
npx mcp-graph list             # Listar nodes
npx mcp-graph update           # Atualizar configs para última versão
npx mcp-graph doctor           # Validar ambiente de execução
npx mcp-graph doctor --json    # Diagnóstico em JSON estruturado
npx mcp-graph serve --port 3000  # Dashboard visual
\`\`\``;

// ── Phase-to-tools mapping ──────────────────────────

const PHASE_TOOLS: Record<string, string[]> = {
  ANALYZE: [
    "import_prd",
    "node",
    "analyze",
    "validate",
    "search",
    "list",
    "show",
    "help",
    "knowledge",
  ],
  DESIGN: [
    "node",
    "edge",
    "analyze",
    "export",
    "search",
    "show",
    "help",
    "code_intelligence",
    "siebel",
    "translate",
  ],
  PLAN: [
    "plan_sprint",
    "analyze",
    "sync_stack_docs",
    "edge",
    "node",
    "search",
    "help",
    "import_graph",
  ],
  IMPLEMENT: [
    "start_task",
    "finish_task",
    "next",
    "context",
    "update_status",
    "analyze",
    "validate",
    "write_memory",
    "read_memory",
    "help",
    "code_intelligence",
    "translate",
    "siebel",
    "davinci",
    "journey",
  ],
  VALIDATE: [
    "validate",
    "metrics",
    "analyze",
    "export",
    "next",
    "update_status",
    "help",
    "siebel",
    "knowledge",
  ],
  REVIEW: [
    "export",
    "metrics",
    "analyze",
    "search",
    "show",
    "help",
    "code_intelligence",
    "knowledge",
  ],
  HANDOFF: [
    "export",
    "snapshot",
    "analyze",
    "write_memory",
    "help",
    "knowledge",
    "translate",
  ],
  DEPLOY: [
    "export",
    "snapshot",
    "analyze",
    "metrics",
    "write_memory",
    "help",
  ],
  LISTENING: [
    "node",
    "import_prd",
    "analyze",
    "search",
    "list",
    "help",
    "knowledge",
    "import_graph",
  ],
};

// ── Phase-to-analyze-modes mapping ──────────────────

const PHASE_ANALYZE_MODES: Record<string, string[]> = {
  ANALYZE: [
    "prd_quality",
    "scope",
    "ready",
    "risk",
    "blockers",
    "cycles",
    "critical_path",
  ],
  PLAN: ["decompose", "sprint_health", "auto_ready"],
  DESIGN: [
    "adr",
    "traceability",
    "coupling",
    "interfaces",
    "tech_risk",
    "design_ready",
    "contract_coverage",
    "data_integrity",
  ],
  IMPLEMENT: ["implement_done", "tdd_check", "progress", "formula_consistency", "performance_budget", "state_completeness", "economy_simulation"],
  VALIDATE: ["validate_ready", "done_integrity", "status_flow", "scenario_coverage", "asset_blockers", "config_coverage", "metric_coverage", "concurrency_risk"],
  REVIEW: ["review_ready"],
  HANDOFF: ["handoff_ready", "doc_completeness"],
  DEPLOY: ["deploy_ready", "release_check"],
  LISTENING: ["listening_ready", "backlog_health"],
};

// ── Phase-to-skills mapping ─────────────────────────

const PHASE_SKILLS: Record<string, string[]> = {
  ANALYZE: ["create-prd-chat-mode", "business-analyst", "product-manager"],
  DESIGN: ["breakdown-epic-arch", "context-architect", "backend-architect"],
  PLAN: ["breakdown-feature-prd", "track-with-mcp-graph"],
  IMPLEMENT: [
    "subagent-driven-development",
    "xp-bootstrap",
    "self-healing-awareness",
  ],
  VALIDATE: [
    "playwright-explore-website",
    "playwright-generate-test",
    "e2e-testing",
  ],
  REVIEW: [
    "code-reviewer",
    "code-review-checklist",
    "review-and-refactor",
    "observability-engineer",
  ],
  DEPLOY: [
    "deployment-engineer",
    "devops-deploy",
    "git-pushing",
  ],
  HANDOFF: [
    "delivery-checklist",
    "pr-documentation",
    "knowledge-capture",
  ],
  LISTENING: [
    "feedback-collector",
    "iteration-planner",
    "metrics-retrospective",
  ],
};

// ── Getter functions ────────────────────────────────

/**
 * Get tool reference, optionally filtered by lifecycle phase.
 */
export function getToolReference(phase?: string): string {
  if (!phase) return TOOL_TABLE_FULL;

  const upper = phase.toUpperCase();
  const tools = PHASE_TOOLS[upper];
  if (!tools) return TOOL_TABLE_FULL;

  const lines = TOOL_TABLE_FULL.split("\n");
  const filtered = lines.filter((line) => {
    if (line.startsWith("#") || line.startsWith("|--") || line.trim() === "")
      return true;
    if (line.startsWith("| Tool") || line.startsWith("| `")) {
      if (line.startsWith("| Tool")) return true;
      return tools.some((tool) => line.includes(`\`${tool}\``));
    }
    return true;
  });

  return `### Tools recomendadas para fase ${upper}\n\n${filtered.join("\n")}`;
}

/**
 * Get analyze modes, optionally filtered by lifecycle phase.
 */
export function getAnalyzeModes(phase?: string): string {
  if (!phase) return ANALYZE_MODES_SECTION;

  const upper = phase.toUpperCase();
  const modes = PHASE_ANALYZE_MODES[upper];
  if (!modes) return ANALYZE_MODES_SECTION;

  const lines = ANALYZE_MODES_SECTION.split("\n");
  const filtered = lines.filter((line) => {
    if (
      line.startsWith("#") ||
      line.startsWith("|--") ||
      line.startsWith("| Fase") ||
      line.trim() === ""
    )
      return true;
    return modes.some((mode) => line.includes(`\`${mode}\``));
  });

  return `### Modos analyze para fase ${upper}\n\n${filtered.join("\n")}`;
}

/**
 * Get skills by lifecycle phase.
 */
export function getSkillsByPhase(phase?: string): string {
  if (!phase) return SKILLS_SECTION;

  const upper = phase.toUpperCase();
  const skills = PHASE_SKILLS[upper];
  if (!skills)
    return `### Skills para fase ${upper}\n\nNenhuma skill específica mapeada. Use \`manage_skill(list)\` para ver todas.`;

  return `### Skills para fase ${upper}\n\n${skills.map((s) => `- \`${s}\``).join("\n")}`;
}

/**
 * Get CLI commands reference.
 */
export function getCliCommands(): string {
  return CLI_COMMANDS;
}

/**
 * Get knowledge pipeline documentation.
 */
export function getKnowledgePipeline(): string {
  return KNOWLEDGE_PIPELINE_SECTION;
}

/**
 * Get phase gates documentation.
 */
export function getPhaseGates(): string {
  return PHASE_GATES_SECTION;
}

/**
 * Get Definition of Done checks.
 */
export function getDefinitionOfDone(): string {
  return DOD_SECTION;
}

/**
 * Get tool prerequisites documentation.
 */
export function getToolPrerequisites(): string {
  return TOOL_PREREQUISITES_SECTION;
}

/**
 * Get composite workflows documentation.
 */
export function getWorkflows(): string {
  return WORKFLOWS_SECTION;
}

/**
 * Get agent antipatterns documentation.
 */
export function getAgentAntipatterns(): string {
  return AGENT_ANTIPATTERNS_SECTION;
}

/**
 * Get flow principles documentation.
 */
export function getFlowPrinciples(): string {
  return FLOW_PRINCIPLES_SECTION;
}

/**
 * Get quality metrics documentation.
 */
export function getQualityMetrics(): string {
  return QUALITY_METRICS_SECTION;
}

/**
 * Get Definition of Ready checks.
 */
export function getDefinitionOfReady(): string {
  return DOR_SECTION;
}

/**
 * Get TDD enforcement documentation.
 */
export function getTddEnforcement(): string {
  return TDD_ENFORCEMENT_SECTION;
}

/**
 * Get pipeline tools documentation.
 */
export function getPipelineTools(): string {
  return PIPELINE_TOOLS_SECTION;
}

/**
 * Get all reference content combined.
 */
export function getFullReference(): string {
  return [
    TOOL_TABLE_FULL,
    DEPRECATED_TOOLS_SECTION,
    ANALYZE_MODES_SECTION,
    PIPELINE_TOOLS_SECTION,
    KNOWLEDGE_PIPELINE_SECTION,
    SKILLS_SECTION,
    PHASE_GATES_SECTION,
    DOD_SECTION,
    DOR_SECTION,
    TOOL_PREREQUISITES_SECTION,
    WORKFLOWS_SECTION,
    FLOW_PRINCIPLES_SECTION,
    QUALITY_METRICS_SECTION,
    TDD_ENFORCEMENT_SECTION,
    AGENT_ANTIPATTERNS_SECTION,
    CLI_COMMANDS,
  ].join("\n\n");
}
