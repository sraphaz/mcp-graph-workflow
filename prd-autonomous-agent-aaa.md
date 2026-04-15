# PRD: Autonomous Agent AAA+ — mcp-graph-workflow v10.0

## 1. Vision and Overview

Transformar o mcp-graph-workflow de um **orquestrador de tarefas assistido por IA** em um **agente autônomo de Engenharia de Software AAA+**, capaz de operar ciclos completos de desenvolvimento (ANALYZE→DEPLOY) com intervenção humana mínima — mantendo confiabilidade Enterprise, economia extrema de tokens e zero alucinação estrutural.

### Tese Central (Oceano Azul)

> "O problema não é o modelo — é a estrutura do código que o alimenta."

O mercado trata alucinações como limitação do LLM. Nós tratamos como **problema de engenharia resolvível** via Harness Engineering, Arquitetura Determinística e RAG em Camadas.

### Metodologias Aplicadas

| Framework | Aplicação |
|-----------|-----------|
| **Doblin — 10 Tipos de Inovação** | Classificação de cada feature em: Processo Central, Desempenho, Sistema, Rede |
| **Oceano Azul (Inovação de Valor)** | Separar commodities (table stakes) de diferenciais competitivos |
| **Teorema CAP adaptado** | Trade-offs Autonomia × Confiabilidade × Velocidade |
| **Lei de Conway inversa** | Estrutura do código molda capacidade do agente |
| **Princípio de Pareto (80/20)** | 20% das melhorias geram 80% do impacto em autonomia |
| **Feedback Loop Theory** | Micro-ciclos TDD fechados < 30s para convergência rápida |
| **Information Theory (Shannon)** | Minimizar entropia no contexto enviado ao LLM |

---

## 2. Problem Definition

### Estado Atual (v9.1.0)

O mcp-graph já implementa:
- 53 MCP tools determinísticas (0% AI fallback)
- Harness Score com 7 dimensões
- RAG em 3 Tiers com compressão 70-85%
- Multi-Terminal Orchestrator (teamTask)
- Lifecycle enforcement em 9 fases

### Gaps para Autonomia AAA+

| Gap | Impacto | Risco se não resolvido |
|-----|---------|----------------------|
| Harness é **estático** (verifica existência de .test.ts) | Agente pode quebrar arquitetura sem detecção pré-commit | Alto |
| Sem **proveniência RAG** (citation mapping rigoroso) | Decisões sem rastreabilidade = confiança baixa | Alto |
| Budget de tokens é **fixo** por fase | Desperdício em fases que precisam de menos contexto | Médio |
| Sem **prefetching preditivo** de tarefas | Latência de 3-8s entre tarefas (BM25 + AST) | Médio |
| Sem **self-healing** de Harness em idle | Score degrada passivamente com novos commits | Médio |
| Sem **AST-pruning** no contexto Deep (Tier 3) | Envio de código irrelevante consome tokens | Alto |
| Sem **micro-ciclos TDD** integrados no loop | finish_task não valida testes antes de marcar done | Crítico |

---

## 3. Product Objectives

### Objetivo Primário
Atingir **Autonomia AAA+**: o agente completa sprints inteiros (5-15 tasks) com < 2 intervenções humanas, mantendo Harness Score ≥ 85 e zero regressões.

### Métricas de Sucesso

| Métrica | Baseline (v9.1) | Target (v10.0) | Método de Medição |
|---------|-----------------|----------------|-------------------|
| Autonomia (tasks/intervenção) | 2-3 | 10-15 | Sprint tracking |
| Token Economy (tokens/task) | ~15k | ~6k | Context assembler logs |
| Harness Score | 72 | ≥ 85 (Grade A) | harness_scan |
| TTM (time per task) | ~45s | ~20s | Pipeline timing |
| Alucinação estrutural | ~5% | < 0.5% | Contract violations |
| RAG Precision@5 | ~78% | ≥ 92% | Benchmark suite |

---

## 4. Architecture Overview

### Pilha de Autonomia (5 camadas)

```
┌─────────────────────────────────────────────┐
│ L5: Autonomous Loop (novo)                  │
│     Self-directed sprint execution          │
├─────────────────────────────────────────────┤
│ L4: Adaptive Intelligence (novo)            │
│     RL token budget, predictive prefetch    │
├─────────────────────────────────────────────┤
│ L3: Quality Sentinel (evolução)             │
│     Dynamic contracts, self-healing harness │
├─────────────────────────────────────────────┤
│ L2: Context Engine (evolução)               │
│     AST-pruning, semantic cache, citations  │
├─────────────────────────────────────────────┤
│ L1: Deterministic Foundation (existente)    │
│     SQL, Cache, Heurística, Propriedade     │
└─────────────────────────────────────────────┘
```

---

## 5. Functional Requirements

### Epic 1: Dynamic Harness (Grounding & Anti-Hallucination)
**Classificação Doblin:** Inovação em Processo e Sistema | **Impacto:** 95/100

#### REQ-1.1: Dynamic Contract Assertions
Interceptar chamadas AST em tempo real e gerar asserções de invariância no código escrito pelo agente. Se o agente quebrar a arquitetura (ex: core importando cli), a asserção falha antes do commit.

**AC:**
- Parser AST analisa imports/exports do código modificado
- Regras de dependência (core → schemas OK, core → cli FAIL) validadas automaticamente
- Violações bloqueiam finish_task com mensagem descritiva
- Cobertura: 100% das regras em `.claude/rules/`

#### REQ-1.2: Citation Mapper Rigoroso (RAG Provenance)
Cada decisão arquitetural baseada em RAG deve incluir citação `[N]` rastreável ao documento de origem (Memory, Knowledge, ADR).

**AC:**
- Contexto RAG retorna `citationId` por chunk
- finish_task valida que decisões de design referenciam citações
- Dashboard mostra provenance trail por node
- API endpoint: GET /api/citations/:nodeId

#### REQ-1.3: Self-Healing Harness (Autonomous Remediation)
Em fases Listening/Idle, o agente gera micro-PRs para elevar Harness Score: renomear variáveis genéricas, adicionar JSDoc, criar testes faltantes.

**AC:**
- Remediation engine identifica top-5 quick wins por score
- Gera branch `harness/improve-{dimension}` automaticamente
- Cada micro-PR tem escopo < 50 linhas alteradas
- Score delta tracking: antes vs depois do fix
- Modo dry-run disponível (preview sem commit)

### Epic 2: Intelligent Context Engine (Token Economy)
**Classificação Doblin:** Inovação em Desempenho | **Impacto:** 92/100

#### REQ-2.1: Semantic Response Cache
Se a assinatura semântica da query tiver ≥ 98% similaridade com query anterior no mesmo estágio, retornar contexto do cache SQLite.

**AC:**
- Embedding local (TF-IDF vectorizado) para fingerprint de queries
- Cache hit rate ≥ 40% em sprints típicos
- TTL configurável por fase (IMPLEMENT: 30min, DESIGN: 2h)
- Invalidação automática quando nodes dependentes mudam status
- Métrica: tokens economizados por cache hit

#### REQ-2.2: AST-Pruning no Contexto Deep
Em vez de enviar arquivos inteiros no Tier 3, parsear AST e omitir corpo de funções não relacionadas à query, enviando apenas assinaturas.

**AC:**
- Parser TypeScript extrai assinaturas (function, class, interface, type)
- Corpo de funções não-relevantes substituído por `{ /* ... */ }`
- Redução ≥ 50% no tamanho de arquivos enviados em Tier 3
- Relevância determinada por: imports do node atual + dependency chain
- Fallback: arquivo completo se parsing falhar

#### REQ-2.3: Adaptive Token Budget (Phase-Aware RL)
Budget de tokens ajustado dinamicamente por fase usando reinforcement learning local simples.

**AC:**
- Modelo tabular: fase × dimensão → peso (grafo, conhecimento, AST, histórico)
- Reward signal: task completada sem regressão = +1, com regressão = -3
- Exploration rate: 10% (epsilon-greedy)
- Persistência em SQLite (tabela `token_budget_weights`)
- Default fallback se < 20 observações por fase
- Dashboard: visualização da evolução dos pesos por fase

### Epic 3: Velocity Engine (Time to Market)
**Classificação Doblin:** Inovação em Desempenho e Processo | **Impacto:** 88/100

#### REQ-3.1: Predictive Task Prefetching
Enquanto o LLM processa finish_task, pré-processar BM25/TF-IDF e AST para a próxima tarefa provável.

**AC:**
- Pipeline prediz próximo node via `_lifecycle.nextAction` + dependency chain
- Pré-computa: contexto RAG, AST do node, BM25 ranking
- Cache warm para próxima iteração (TTL: 5min)
- Latência de start_task reduzida ≥ 60%
- Invalidação se task manual override pelo usuário

#### REQ-3.2: Micro-Cycle TDD Integration (Fast-Fail)
Integrar Vitest watcher no loop do agente. finish_task valida testes antes de marcar done.

**AC:**
- finish_task executa `vitest run --reporter=json` nos testFiles do node
- Se teste falha: retorna erro com stack trace, status permanece in_progress
- Loop corretivo: agente recebe erro e corrige sem novo start_task
- Timeout: 30s por suite (configurável)
- Métricas: red→green cycles por task, tempo médio de correção

#### REQ-3.3: Synthetic Test Data Generation
Gerar dados de teste baseados nos schemas Zod do projeto antes da implementação.

**AC:**
- Parser Zod extrai schemas exportados do projeto
- Factory functions geradas automaticamente (1 minimal + 1 edge case por schema)
- Output: arquivo `src/tests/factories/{schema-name}.factory.ts`
- Integração com `arrange` phase dos testes existentes
- Suporte a: string, number, enum, array, object, optional, nullable

### Epic 4: Autonomous Loop (Sprint Execution)
**Classificação Doblin:** Inovação em Sistema e Rede | **Impacto:** 97/100

#### REQ-4.1: Sprint Autopilot Mode
Modo onde o agente executa sprint inteiro: pick task → context → TDD → implement → validate → next.

**AC:**
- Comando: `set_phase({ phase: "IMPLEMENT", autopilot: true })`
- Guardrails: pausa em risk nodes, pausa se Harness < 70, pausa se 2+ failures consecutivos
- Human checkpoint: a cada 5 tasks completadas, summarize e aguarda aprovação
- Rollback: se 3 tasks consecutivas falham, reverte ao último snapshot estável
- Métricas: tasks/hora, success rate, tokens/task

#### REQ-4.2: Decision Confidence Scoring
Cada decisão do agente recebe score de confiança (0-100) baseado em evidências disponíveis.

**AC:**
- Score composto: RAG relevance (40%) + Harness coverage (30%) + Historical success (30%)
- Threshold: < 60 = pausa e consulta humano, 60-80 = executa com log, > 80 = executa silencioso
- Persistência: decisões + scores salvos em knowledge store
- Dashboard: timeline de decisões com confidence overlay

#### REQ-4.3: Autonomous Error Recovery
Quando um erro ocorre durante autopilot, o agente tenta recuperação antes de escalar.

**AC:**
- Estratégias ordenadas: retry → rollback parcial → decompose → escalate
- Max 2 retries por estratégia antes de escalar
- Knowledge learning: erros + soluções indexados para reuso
- Métricas: recovery success rate, escalation rate

---

## 6. Non-Functional Requirements

### NFR-1: Performance
- start_task latência < 500ms (com prefetch) / < 3s (cold)
- Context assembly < 200ms para Tier 1-2, < 1s para Tier 3
- AST parsing < 100ms por arquivo
- Semantic cache lookup < 50ms

### NFR-2: Reliability
- Zero data loss em crash (SQLite WAL mode + transactions)
- Graceful degradation: se AST parser falha → fallback para arquivo completo
- Se semantic cache corrompe → rebuild automático
- Se RL model diverge → reset para defaults

### NFR-3: Token Economy
- Budget máximo por task: 8000 tokens (Tier 1), 15000 (Tier 2), 25000 (Tier 3)
- Cache hit ratio target: ≥ 40%
- AST-pruning reduction: ≥ 50% em Tier 3

### NFR-4: Observability
- Todas as decisões autônomas logadas com: timestamp, confidence, evidence, outcome
- Dashboard tab: "Autonomy Monitor" com métricas em tempo real
- Alertas: Harness drop > 5pts, confidence < 60, 3+ failures

### NFR-5: Security
- Autopilot não pode: push to remote, delete branches, modify CI/CD
- Todas as ações destrutivas requerem confirmação humana
- Audit trail completo em SQLite

---

## 7. Risk Analysis

### RISK-1: Over-automation (Autonomia sem Confiança)
- **Probabilidade:** Alta | **Impacto:** Crítico
- **Mitigação:** Confidence scoring + human checkpoints a cada 5 tasks
- **Contingência:** Kill switch via `set_phase({ autopilot: false })`

### RISK-2: RL Model Divergence
- **Probabilidade:** Média | **Impacto:** Alto
- **Mitigação:** Epsilon-greedy exploration + reset threshold + default fallback
- **Contingência:** Tabela de pesos com snapshot automático, rollback em 1 query

### RISK-3: AST Parser Fragility
- **Probabilidade:** Média | **Impacto:** Médio
- **Mitigação:** Graceful fallback para arquivo completo + error boundary
- **Contingência:** Flag `astPruning: false` no config desativa globalmente

### RISK-4: Semantic Cache Poisoning
- **Probabilidade:** Baixa | **Impacto:** Alto
- **Mitigação:** Cache invalidation por dependency graph + TTL por fase
- **Contingência:** `knowledge(action: "prune", strategy: "quality")` limpa entries ruins

### RISK-5: Self-Healing Introducing Bugs
- **Probabilidade:** Média | **Impacto:** Alto
- **Mitigação:** Micro-PRs com escopo < 50 linhas + test suite obrigatório
- **Contingência:** Branch isolada, nunca merge automático em master

---

## 8. Constraints

### CONST-1: Local-First Architecture
Todas as features devem funcionar 100% offline. Nenhuma dependência de serviço externo para operação core.

### CONST-2: Zero Breaking Changes
Backward compatibility com v9.x. Migrations devem suportar formato antigo + novo.

### CONST-3: SQLite as Single Store
Sem introdução de novos datastores. Novas tabelas/índices no SQLite existente.

### CONST-4: Token Budget Hard Cap
Nenhuma feature pode aumentar o consumo médio de tokens por task acima de 25000 (Tier 3 max).

### CONST-5: No External ML Models
RL e embeddings devem ser implementados com algoritmos locais simples (tabular RL, TF-IDF vectors). Sem ONNX, TensorFlow ou dependências pesadas.

---

## 9. Milestone Roadmap

### Phase A: Quality Sentinel (Sprint 1-2)
- REQ-1.1: Dynamic Contract Assertions
- REQ-1.2: Citation Mapper
- REQ-3.2: Micro-Cycle TDD

### Phase B: Token Optimizer (Sprint 3-4)
- REQ-2.1: Semantic Cache
- REQ-2.2: AST-Pruning
- REQ-3.1: Predictive Prefetching

### Phase C: Adaptive Intelligence (Sprint 5-6)
- REQ-2.3: Adaptive Token Budget
- REQ-3.3: Synthetic Test Data
- REQ-1.3: Self-Healing Harness

### Phase D: Autonomous Loop (Sprint 7-8)
- REQ-4.1: Sprint Autopilot
- REQ-4.2: Decision Confidence
- REQ-4.3: Error Recovery

---

## 10. Innovation Classification (Doblin × Blue Ocean)

| Feature | Doblin Type | Blue Ocean Zone | Impact |
|---------|-------------|-----------------|--------|
| Dynamic Contracts | Process | Blue Ocean | 95/100 |
| Citation Mapper | Process + Performance | Blue Ocean | 90/100 |
| Self-Healing Harness | System | Blue Ocean | 88/100 |
| Semantic Cache | Performance | Red→Blue | 92/100 |
| AST-Pruning | Performance | Blue Ocean | 85/100 |
| Adaptive RL Budget | Performance | Blue Ocean | 87/100 |
| Predictive Prefetch | Performance | Red→Blue | 80/100 |
| Micro-Cycle TDD | Process | Red→Blue | 85/100 |
| Synthetic Test Data | Process | Red Ocean | 70/100 |
| Sprint Autopilot | System + Network | Blue Ocean | 97/100 |
| Confidence Scoring | System | Blue Ocean | 90/100 |
| Error Recovery | System | Blue Ocean | 88/100 |
