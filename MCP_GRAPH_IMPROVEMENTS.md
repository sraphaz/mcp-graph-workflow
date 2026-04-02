# mcp-graph — Melhorias para Projetos Complexos

> Baseado na experiencia real de uso em Prison Tale Remake (MMORPG, 120+ nodes, 12 sprints, 10 ADRs)
> Data: 2026-04-02

---

## 1. CRITICOS — Impedem velocidade

### 1.1 `import_prd` nao gera nodes a partir de markdown
**Problema:** `import_prd` indexa o conteudo no knowledge store (25 docs) mas cria 0 nodes. Todo o trabalho de criacao de epics, requirements, risks e constraints foi manual (~80 chamadas `node(add)`).

**Impacto:** Horas de trabalho manual que poderiam ser automatizadas. Um PRD de 1300 linhas deveria gerar pelo menos os epics e requirements automaticamente.

**Sugestao:**
- Parsear headers markdown (## / ###) como epics/tasks
- Extrair bullet points como acceptance criteria
- Detectar tabelas com "Risco" / "Risk" como risk nodes
- Detectar secoes com "Requisito" / "Constraint" como constraint/requirement nodes
- Modo `--dry-run` para preview antes de commit

### 1.2 Batch operations inexistentes
**Problema:** Criar 15 epics = 15 chamadas sequenciais. Criar 20 edges = 20 chamadas. Nao existe `node(action: "batch_add")` ou `edge(action: "batch_add")`.

**Impacto:** Latencia acumulada de ~2s por chamada * 100 chamadas = ~200s so de overhead de rede.

**Sugestao:**
- `node(action: "batch_add", nodes: [{...}, {...}])` — cria N nodes em 1 chamada
- `edge(action: "batch_add", edges: [{...}, {...}])` — cria N edges em 1 chamada
- Retornar array de IDs criados
- Limite: max 50 nodes/edges por batch

### 1.3 ADR analyzer nao le metadata — so description com ## headers
**Problema:** Criei ADRs com campos Status/Context/Decision/Consequences no metadata JSON. O analyzer retornou grade F. So funciona com `## Status\n## Context\n## Decision\n## Consequences` dentro da description string.

**Impacto:** Obriga format especifico na description. metadata fica redundante. Gastei ciclos extras descobrindo o formato correto.

**Sugestao:**
- Analyzer deve checar metadata.status, metadata.context, metadata.decision, metadata.consequences PRIMEIRO
- Fallback para parsing de description com ## headers
- Documentar o formato esperado na help tool

### 1.4 `tech_risk` mitigation detection inconsistente
**Problema:** Riscos com edges `blocks` e `related_to` de/para epics nao sao detectados como mitigados. So funciona quando um `decision` node tem edge `implements` apontando para o risk.

**Impacto:** Precisei criar 3 ADRs extras (ADR-006/007/008) especificamente para satisfazer o analyzer, quando os risks ja tinham mitigation documentada no description e edges para epics.

**Sugestao:**
- Detectar mitigacao por qualquer edge entrante de constraint, decision, ou epic
- Considerar risk.metadata.mitigation preenchido como mitigacao parcial
- Niveis: unmitigated → partially_mitigated (tem description) → mitigated (tem edge de decision)

---

## 2. IMPORTANTES — Reduzem precisao

### 2.1 Sem validacao de sprint capacity / balanceamento
**Problema:** `plan_sprint` gera report com `estimatedPoints: 301` mas nao sugere distribuicao por sprint nem detecta sprints sobrecarregados. Nao ha conceito de "velocidade do time" ou "capacity por sprint".

**Sugestao:**
- Parametro `velocity` (pts/sprint) no plan_sprint
- Alerta quando sprint tem > velocity pontos
- Sugestao automatica de redistribuicao
- Historico de velocity por sprint completado

### 2.2 Sem dependency edges automaticos entre tasks do mesmo epic
**Problema:** Subtasks dentro de um parent (ex: 6 subtasks de "Servidor Autoritario") nao tem edges entre si. O report nao sabe a ordem de execucao intra-task.

**Sugestao:**
- Opcao `auto_sequence: true` ao criar subtask — cria edge depends_on para subtask anterior
- Ou ferramenta `sequence_subtasks(parentId)` que cria chain de dependencia entre filhos

### 2.3 Falta `analyze(mode: "sprint_health")` — saude por sprint
**Problema:** Nao existe analyze que mostra metricas POR SPRINT: total de pontos, distribuicao de tamanho, riscos, dependencias externas, tasks sem AC.

**Sugestao:**
- `analyze(mode: "sprint_health", nodeId: "sprint-3")` retornando:
  - Total points, task count, avg size
  - Tasks sem AC
  - Dependencias externas (tasks de outros sprints)
  - Riscos associados
  - Balance score

### 2.4 Sem suporte a templates de task
**Problema:** Padroes repetitivos como "Implementar X backend + UI + tests" requerem 3 chamadas manuais com AC semelhantes. Deveria haver templates.

**Sugestao:**
- `manage_skill(action: "create_template", template: {name: "backend_ui_task", subtasks: [...]})` 
- `node(action: "add_from_template", template: "backend_ui_task", title: "Auction House")`

---

## 3. NICE TO HAVE — Melhoram experiencia

### 3.1 Visualizacao de sprint timeline (Gantt)
**Problema:** `export(mermaid)` gera flowchart de dependencias mas nao timeline. Impossivel visualizar overlaps e caminho critico temporal.

**Sugestao:**
- `export(action: "mermaid", format: "gantt")` gerando Mermaid Gantt chart
- Tasks agrupadas por sprint
- Dependencias mostradas como links

### 3.2 `import_prd` deveria aceitar .docx diretamente
**Problema:** Precisei converter .docx para .md via pandoc externamente, copiar para dentro do projeto, e entao importar.

**Sugestao:**
- Aceitar .docx como input com conversao interna
- Ou pelo menos aceitar path absoluto fora do projeto

### 3.3 Metricas de cobertura de AC por dominio
**Problema:** `analyze(prd_quality)` checa AC globalmente mas nao por dominio. Um epic com 50 ACs e outro com 0 ambos passam se o total e suficiente.

**Sugestao:**
- Coverage report por epic: % tasks com AC, avg ACs por task
- Flag epics com 0 ACs como warning

### 3.4 `node(action: "update")` deveria aceitar merge de arrays
**Problema:** Ao atualizar acceptanceCriteria, preciso passar o array completo. Deveria ter opcao de append.

**Sugestao:**
- `acceptanceCriteria_append: ["novo AC"]` para adicionar sem sobrescrever

### 3.5 Historico de mudancas no node
**Problema:** Nao ha audit trail de mudancas. Se um AC foi removido ou description alterada, nao ha como saber quando ou por que.

**Sugestao:**
- `show(id, history: true)` mostrando changelog do node
- Ou pelo menos `updatedAt` + `updatedBy` + `changeReason`

### 3.6 `context` e `rag_context` deviam ser usaveis em qualquer fase
**Problema:** Na fase PLAN, as tools sugeridas nao incluem `context` e `rag_context`. Elas sao essenciais para carregar contexto antes de decompor tasks.

**Sugestao:**
- `context` e `rag_context` disponiveis em TODAS as fases sem warning
- Sao tools de leitura, nao deviam ser restricted

### 3.7 Suporte a `node(type: "interface")` nativo
**Problema:** Para definir interfaces entre servicos (Client<->Server, Auth API, Economy API), usei requirement/constraint com tags. Deveria ter tipo nativo.

**Sugestao:**
- `type: "interface"` com campos: protocol, endpoints, contract (protobuf/openapi ref)
- `analyze(interfaces)` checa que todo service tem interface definida

### 3.8 Export para formatos de project management
**Problema:** O grafo so exporta para JSON e Mermaid. Para times que usam Linear/Jira/GitHub Projects, seria util exportar tasks com sprints.

**Sugestao:**
- `export(action: "linear")` — cria issues no Linear via API
- `export(action: "github_projects")` — cria issues no GitHub
- `export(action: "csv")` — tabela de tasks para importacao

---

## 4. Pontuacao de impacto

| # | Melhoria | Impacto | Esforco | Prioridade |
|---|----------|---------|---------|-----------|
| 1.1 | import_prd gera nodes | 10 | L | P0 |
| 1.2 | Batch operations | 9 | M | P0 |
| 1.3 | ADR analyzer le metadata | 7 | S | P1 |
| 1.4 | Risk mitigation detection | 7 | M | P1 |
| 2.1 | Sprint capacity/velocity | 8 | M | P1 |
| 2.2 | Auto dependency edges | 6 | S | P2 |
| 2.3 | Sprint health analyze | 7 | M | P1 |
| 2.4 | Task templates | 5 | M | P2 |
| 3.1 | Gantt chart export | 6 | M | P2 |
| 3.2 | .docx direto | 4 | S | P3 |
| 3.3 | AC coverage por dominio | 5 | S | P2 |
| 3.4 | Array merge em update | 3 | XS | P3 |
| 3.5 | Historico de mudancas | 5 | M | P2 |
| 3.6 | context em todas fases | 4 | XS | P3 |
| 3.7 | Tipo interface nativo | 4 | S | P3 |
| 3.8 | Export Linear/GitHub/CSV | 6 | L | P2 |

---

## 5. O que funciona muito bem

- **Lifecycle enforced** — strict mode impede operacoes fora de fase, evita vibe coding
- **ADR com ## headers** — uma vez descoberto o formato, funciona perfeitamente
- **analyze modes** — 24 modos cobrem quase tudo (prd_quality, design_ready, traceability, etc)
- **Edge types** — depends_on, blocks, implements, related_to cobrem todos os relacionamentos
- **plan_sprint report** — da overview rapido de tasks prontas e bloqueadas
- **Knowledge indexing** — import_prd indexa para RAG mesmo sem criar nodes
- **cycles detection** — zero false positives em 90+ edges
- **critical_path** — identifica corretamente a cadeia mais longa

---

## 6. GAME-SPECIFIC — Melhorias para projetos de jogos complexos (MMORPG)

### 6.1 Formula Nodes com validacao numerica
**Problema:** Temos 175+ formulas matematicas (dano, atributos, aging probability, craft, etc) definidas em acceptance criteria como texto. O grafo nao valida consistencia numerica — ex: se p_sucesso + p_falha + p_retrocesso + p_quebra = 1.0 em TODOS os niveis de Aging.

**Sugestao:**
- `node(type: "formula")` com campos: `expression`, `inputs`, `outputs`, `constraints`
- Ex: `{expression: "ATK_base + ATK_Arma + STR*1.5", inputs: ["ATK_base", "ATK_Arma", "STR"], constraints: ["result >= 1"]}`
- `analyze(mode: "formula_consistency")` — valida que todas as formulas sao consistentes
- Detectar formulas conflitantes (ex: duas formulas diferentes calculando o mesmo output)
- Gerar test stubs automaticamente a partir das formulas

### 6.2 Economy Simulation Mode
**Problema:** O PRD define 8 gold sinks, drop rates, custos de Aging/Mix/Craft, mas nao ha como simular o impacto economico ANTES de implementar. Inflacao e o risco #1 do jogo.

**Sugestao:**
- `analyze(mode: "economy_simulation")` com parametros: player_count, avg_session_hours, avg_level
- Simula gold inflow (drops, quest rewards) vs gold outflow (8 sinks)
- Detecta inflacao potencial: "Com 10k players, gold supply cresce 15%/dia — acima do target 5%"
- Sugere ajustes: "Reduzir drop rate de Gold em 10% ou aumentar custo de Aging em 20%"
- Vinculado a ADR-006 (Gold Sinks) e risk de inflacao

### 6.3 State Machine Visualizer
**Problema:** Aging tem state machine (Unaged → Aging → Maturing → Matured) e Monster AI tem FSM (Idle → Patrol → Chase → Attack → Return). Essas maquinas estao em descriptions como texto, nao como dados estruturados.

**Sugestao:**
- `node(type: "state_machine")` com campos: `states`, `transitions`, `initial_state`
- `export(action: "mermaid", format: "stateDiagram")` para visualizar
- `analyze(mode: "state_completeness")` — valida que todos os estados tem transicoes de saida
- Detectar dead states (estados sem transicao de saida) e unreachable states

### 6.4 Config Schema Validation
**Problema:** Muitas tasks referenciam "config via TOML" (formulas, drop tables, spawn data, gold sinks). O grafo nao valida que o schema existe, esta completo, ou e consistente.

**Sugestao:**
- `node(type: "config_schema")` com: schema_path, format (TOML/JSON), fields, referenced_by
- `analyze(mode: "config_coverage")` — detecta configs referenciadas mas nao definidas
- Detectar configs orfas (definidas mas nao usadas por nenhuma task)
- Validar que todas as formulas tem seus parametros cobertos por config

### 6.5 Cross-Service Contract Tracking
**Problema:** 5 microservicos Go se comunicam via gRPC e NATS. Mudancas em um contrato podem quebrar outro servico. Nao ha como rastrear contratos no grafo.

**Sugestao:**
- `node(type: "contract")` com: protocol (gRPC/REST/NATS), schema (protobuf ref), provider, consumer
- `edge(relationType: "provides")` do service para o contract
- `edge(relationType: "consumes")` do service para o contract
- `analyze(mode: "contract_coverage")` — todo servico tem contratos definidos
- `analyze(mode: "breaking_changes")` — quando task modifica contract, alerta consumers

### 6.6 Playtest Scenario Nodes
**Problema:** Cenarios de playtest sao mentais — ninguem documenta "Jogador level 45, tenta Aging +7 com Aging Stone, falha, usa Copper Ore". Isso leva a gaps de teste.

**Sugestao:**
- `node(type: "scenario")` com: steps[], expected_outcome, preconditions, systems_involved
- Vinculado as tasks que implementam cada passo
- `analyze(mode: "scenario_coverage")` — % de systems cobertos por scenarios
- Gera checklist de playtest automaticamente
- Cenarios de regressao: se task de Aging muda, re-rodar scenarios vinculados

### 6.7 Performance Budget Tracking
**Problema:** ACs como "500 mobs/tick < 20ms" e "10k pacotes/s < 1ms" sao texto. Nao ha como rastrear se os budgets estao sendo cumpridos apos implementacao.

**Sugestao:**
- `node(type: "performance_budget")` com: metric_name, threshold, unit, measurement_method
- `analyze(mode: "performance_budget")` — lista todos budgets e status (untested/passing/failing)
- Vinculado a benchmarks reais quando implementados
- Alerta quando task nova potencialmente impacta um budget existente

### 6.8 Asset Pipeline Tracking (Arte vs Codigo)
**Problema:** Tasks de gameplay dependem de assets (models, animations, VFX, audio). "Hit feedback depende de impact_sound.wav" nao e rastreavel. Nao da pra saber o que esta bloqueado por arte vs codigo.

**Sugestao:**
- `node(type: "asset")` com: asset_type (model/animation/vfx/audio), path, status, assigned_to
- `edge(relationType: "requires_asset")` de task para asset
- `analyze(mode: "asset_blockers")` — tasks bloqueadas por assets pendentes
- Dashboard: % tasks bloqueadas por arte vs prontas para codigo

### 6.9 Economy Telemetry Dashboard Definition
**Problema:** O economy dashboard (TimescaleDB + Grafana) precisa rastrear metricas especificas vinculadas a risks. Essas definicoes estao espalhadas em descriptions.

**Sugestao:**
- `node(type: "metric")` com: name, query (SQL/PromQL), threshold, alert_condition, linked_risk
- Ex: `{name: "gold_inflation_rate", query: "SELECT ...", threshold: "< 5%/day", linked_risk: "node_fcc25012a2f2"}`
- `analyze(mode: "metric_coverage")` — todo risk HIGH tem pelo menos 1 metrica de monitoramento
- Gerar queries SQL/PromQL a partir da definicao

### 6.10 Multiplayer Concurrency Risk Analysis
**Problema:** MMORPGs tem race conditions em todo lugar: trade entre 2 jogadores, Aging simultaneo no mesmo item, loot de boss com 20 players. Nao ha analyze que detecta isso.

**Sugestao:**
- `analyze(mode: "concurrency_risk")` que identifica tasks com potencial de race condition
- Heuristicas: tasks que modificam inventario, gold, item state, ou trade de 2+ players
- Gera test cases de concorrencia automaticamente
- Ex: "Trade entre 2 jogadores + Aging simultaneo no mesmo item" → test case

### 6.11 PRD Diff Tracking (v2 → v3)
**Problema:** Quando o PRD muda (ex: drop rate de Lendario 2% → 3%), nao ha como detectar quais nodes do grafo sao impactados automaticamente.

**Sugestao:**
- `import_prd(filePath, diff: true)` — compara com import anterior
- Retorna: nodes impactados, fields mudados, risks afetados
- Ex: "Drop rate Lendario mudou 2% → 3%" → impacta task de drops + risk de power creep
- Notificacao de re-review para tasks afetadas

### 6.12 Data Tables como First-Class Citizens
**Problema:** O jogo depende de tabelas de dados: Aging probability table, Sheltom recipes, Monster stats, XP curve, Drop tables. Essas tabelas sao mencionadas em descriptions mas nao sao nodes rastreavies.

**Sugestao:**
- `node(type: "data_table")` com: columns, rows_preview, source_file, version
- Ex: Aging table com colunas [level, p_success, p_fail, p_regress, p_break, sheltoms, gold_cost]
- `analyze(mode: "data_integrity")` — valida que somas probabilisticas = 1.0, custos > 0, etc
- Vinculado a tasks que consomem a tabela e configs que definem os valores

---

## 7. Pontuacao de impacto ATUALIZADA

| # | Melhoria | Impacto | Esforco | Prioridade | Categoria |
|---|----------|---------|---------|-----------|-----------|
| 1.1 | import_prd gera nodes | 10 | L | P0 | Core |
| 1.2 | Batch operations | 9 | M | P0 | Core |
| 6.1 | Formula nodes + validacao | 9 | L | P0 | Game |
| 6.2 | Economy simulation | 9 | XL | P0 | Game |
| 1.3 | ADR analyzer le metadata | 7 | S | P1 | Core |
| 1.4 | Risk mitigation detection | 7 | M | P1 | Core |
| 2.1 | Sprint capacity/velocity | 8 | M | P1 | Core |
| 2.3 | Sprint health analyze | 7 | M | P1 | Core |
| 6.3 | State machine visualizer | 8 | M | P1 | Game |
| 6.5 | Cross-service contracts | 8 | M | P1 | Game |
| 6.10 | Concurrency risk analysis | 8 | L | P1 | Game |
| 6.12 | Data tables first-class | 7 | M | P1 | Game |
| 6.4 | Config schema validation | 6 | M | P2 | Game |
| 6.6 | Playtest scenarios | 7 | M | P2 | Game |
| 6.7 | Performance budgets | 6 | M | P2 | Game |
| 6.8 | Asset pipeline tracking | 6 | M | P2 | Game |
| 6.9 | Economy telemetry def | 5 | M | P2 | Game |
| 6.11 | PRD diff tracking | 7 | L | P2 | Core |
| 2.2 | Auto dependency edges | 6 | S | P2 | Core |
| 2.4 | Task templates | 5 | M | P2 | Core |
| 3.1 | Gantt chart export | 6 | M | P2 | Core |
| 3.3 | AC coverage por dominio | 5 | S | P2 | Core |
| 3.5 | Historico de mudancas | 5 | M | P2 | Core |
| 3.8 | Export Linear/GitHub/CSV | 6 | L | P2 | Core |
| 3.2 | .docx direto | 4 | S | P3 | Core |
| 3.4 | Array merge em update | 3 | XS | P3 | Core |
| 3.6 | context em todas fases | 4 | XS | P3 | Core |
| 3.7 | Tipo interface nativo | 4 | S | P3 | Core |
| **8.1** | **risk vs tech_risk conflito** | **8** | **M** | **P0** | **Bug** |
| 8.2 | False positive tech debt | 5 | S | P1 | Bug |
| 8.3 | Traceability cai com novos ADRs | 6 | S | P1 | Bug |
| 8.4 | Auto-ready para tasks decompostas | 5 | S | P2 | Core |

---

## 8. BUGS / Inconsistencias encontradas na investigacao do grafo

### 8.1 `risk` vs `tech_risk` analyzers dao resultados conflitantes
**Bug:** `analyze(mode: "risk")` retorna 10/10 risks como "unmitigated". `analyze(mode: "tech_risk")` retorna 6/10 como "mitigated". Os mesmos risks, com os mesmos edges (decision→risk via `implements`), sao avaliados de forma oposta.

**Evidencia:**
- `risk` mode: `"mitigationStatus": "unmitigated"` para TODOS os 10
- `tech_risk` mode: `"mitigated": true` para Grind, P2W, Bots, Server (4), `false` para outros 6
- `design_ready` check `risks_mitigated`: `"passed": true, "Todos riscos altos estão mitigados"`

**Impacto:** Impossivel confiar nos dados de mitigacao. Tres fontes de verdade com tres respostas diferentes.

**Sugestao:** Unificar logica de mitigation detection. Um risk e mitigado se:
- Tem edge `implements` de decision (mais forte)
- OU tem edge `blocks` de epic/constraint
- OU tem metadata.mitigation preenchido (mais fraco)

### 8.2 `backlog_health` false positive em tech debt detection
**Bug:** O analyzer detecta keyword "fix" em textos como "preco fixo", "fixed timestep" e marca como tech debt indicator. 6 false positives nesta sessao.

**Evidencia:** Tasks como "Auction House com filtros e taxa 5%" e "game loop tick system 30/20 ticks/s" foram marcadas como tech debt porque contém "fix" em "fixo" e "fixed".

**Sugestao:**
- Usar word boundary matching: `\bfix\b` em vez de substring
- Excluir matches em portugues: "fixo", "fixar" nao sao tech debt
- Ou melhor: checar tags como `tech-debt`, `bug`, `hotfix` em vez de keyword matching

### 8.3 Traceability coverage cai ao adicionar ADRs sem edge para requirement
**Bug:** Ao criar ADR-009 e ADR-010, traceability caiu de 100% para 87.5% porque os novos decisions nao tinham edges para requirements. O analyzer conta decisions SEM link como "gap" mesmo que estejam linkados a epics.

**Impacto:** Score oscila ao adicionar mais conteudo ao grafo — deveria so subir.

**Sugestao:** Considerar decision linkado a epic como "covered" (partial coverage), nao so decision linkado a requirement.

### 8.4 Todos os 91 nodes em status "backlog" — nenhum "ready"
**Observacao:** O `backlog_health` mostra 91 backlog, 0 ready. No workflow do mcp-graph, tasks deveriam ser marcadas "ready" apos decomposicao e AC review. Nao ha automacao para isso.

**Sugestao:**
- `analyze(mode: "auto_ready")` que marca tasks como "ready" quando: tem sprint, tem AC, sem blockers
- Ou parametro `auto_ready: true` no `plan_sprint`

---

## 9. Conclusao: O que falta para MMORPGs matematicos

O mcp-graph e excelente para **estrutura e rastreabilidade** — lifecycle enforced, 24 analyze modes, ADR tracking, cycle detection, critical path. Para projetos web/SaaS tradicionais, ja e muito bom.

Para **projetos de jogos complexos como Priston Tale** (matematico, economia player-driven, multiplayer, live-ops), falta uma camada de **validacao numerica e simulacao**:

| Necessidade | Estado atual | Proposta |
|-------------|-------------|----------|
| Formulas como dados | Texto em ACs | `type: "formula"` com expressao e validacao |
| Simulacao economica | Inexistente | `analyze(economy_simulation)` |
| State machines | Texto em description | `type: "state_machine"` com mermaid export |
| Tabelas de dados | Texto em description | `type: "data_table"` com validacao de integridade |
| Race conditions | Nao detectadas | `analyze(concurrency_risk)` |
| Contratos entre servicos | Tags manuais | `type: "contract"` com breaking change detection |
| Assets vs Codigo | Nao rastreavel | `type: "asset"` com blocker tracking |
| Performance budgets | Texto em ACs | `type: "performance_budget"` com benchmark linking |

**Top 3 mais impactantes para este projeto:**
1. **Economy Simulation** — inflacao e o risk #1, precisa ser simulada ANTES de implementar
2. **Formula Nodes** — 175+ formulas precisam de validacao automatica de consistencia
3. **State Machine Visualizer** — Aging FSM e Monster AI FSM sao core do jogo

---

*Arquivo gerado durante sessao de planejamento do Prison Tale Remake.*
*Stack: Unity 2022 LTS + Go + PostgreSQL + Redis + AWS + NATS + Next.js*
*Grafo: ~120 nodes, ~100 edges, 12 sprints, 10 ADRs, 70 tasks/subtasks*
*30 melhorias identificadas — 4 criticas, 4 importantes, 10 nice-to-have, 12 game-specific*