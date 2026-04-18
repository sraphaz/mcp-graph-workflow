# Resumo Técnico — MCP Graph Workflow

**Registro INPI — Programa de Computador**

_Documento destinado ao campo "Descrição Funcional" do e-INPI.
Máximo 8000 caracteres; texto abaixo tem aproximadamente 4200._

---

## 1. Finalidade

O **MCP Graph Workflow** (nome curto: `mcp-graph`) é um programa
de computador que **transforma documentos de requisitos de produto
(PRD) em grafos de execução persistentes**, servindo como camada
de orquestração entre agentes de inteligência artificial (como
Claude Code, Cursor, GitHub Copilot) e bases de código em
desenvolvimento. O programa opera como um servidor local que
implementa o Model Context Protocol (MCP), permitindo que um ou
múltiplos agentes de IA executem trabalho de engenharia de
software de forma coordenada, rastreável e determinística, sobre
um grafo persistido em banco de dados SQLite local.

## 2. Problema técnico que resolve

Agentes de IA contemporâneos, quando aplicados a tarefas de
engenharia de software, apresentam taxas significativas de
alucinação proporcionais à falta de estrutura do código
circundante. Ferramentas existentes tratam o agente como único
centro de raciocínio; o código é apenas texto lido. O programa
MCP Graph Workflow inverte essa relação: o **código e sua estrutura
tornam-se o instrumento primário**, engenhado de modo que agentes
sucedam por padrão. Para isso, o programa introduz métricas
estruturais e fases de execução determinísticas que substituem
supervisão humana contínua por contratos verificáveis.

## 3. Linguagem e plataforma

- **Linguagem principal:** TypeScript 5.x (strict mode, ESNext
  modules)
- **Runtime:** Node.js ≥ 18
- **Persistência:** SQLite com Write-Ahead Logging (better-sqlite3)
- **Protocolo de integração:** Model Context Protocol (MCP)
  versão 2025-06-18
- **Embeddings:** ONNX Runtime (all-MiniLM-L6-v2 quantizado, 384
  dimensões)
- **Framework CLI:** Commander.js v14
- **Testes:** Vitest v4 (7500+ testes)
- **Build:** TypeScript Compiler + Vite

## 4. Arquitetura funcional

O programa é estruturado em quatro camadas principais:

### 4.1. Núcleo do grafo (`src/core/`)

Gerencia nodos (tasks, epics, subtasks, requirements, constraints,
acceptance criteria, risks, decisions, etc.), arestas tipadas
(depends_on, blocks, derives_from, etc.) e mutações transacionais.
Inclui índices invertidos para consultas eficientes, motor de
Retrieval-Augmented Generation (RAG) local, compressão de contexto
em tiers, e análise de código nativa.

### 4.2. Pipeline de execução (`src/core/pipeline/`)

Implementa o ciclo de vida em **nove fases** (ANALYZE → DESIGN →
PLAN → IMPLEMENT → VALIDATE → REVIEW → HANDOFF → DEPLOY → LISTENING)
com phase gates determinísticos. As operações compostas
`start_task` e `finish_task` encapsulam o trabalho típico de uma
tarefa em duas chamadas, aplicando Definition of Ready (7 checks)
e Definition of Done (8 checks) automaticamente.

### 4.3. Camada MCP (`src/mcp/`)

Expõe 45 ferramentas MCP para agentes de IA, agrupadas por função:
consulta de grafo (list, show, search), mutação (add_node, edge,
update_status), análise (analyze com 20+ modos), contexto (context
com modos compact/rag/compress), integrações (context7,
playwright), lifecycle (set_phase, validate), e workflow
(start_task, finish_task, plan_sprint, validate).

### 4.4. Dashboard e API REST (`src/web/dashboard/` e `src/api/`)

React 19 com Tailwind CSS e React Flow para visualização
interativa do grafo. API Express com 30 roteadores e 130+
endpoints para integração externa.

## 5. Contribuições metodológicas originais

O programa encapsula três constructos originais do autor:

### 5.1. Harnessability Score

Métrica composta de sete dimensões (0-100) que quantifica o grau
em que uma base de código suporta trabalho efetivo de agentes de
IA: cobertura de tipos (25%), cobertura de testes (25%), fitness
arquitetural (15%), cobertura de documentação (15%), clareza de
nomes (10%), tratamento de erros (5%) e densidade de contexto
(5%). A métrica gera notas A/B/C/D e alimenta decisões de phase
gate.

### 5.2. Anti-Vibe-Coding Lifecycle

Metodologia de desenvolvimento em nove fases que combina
disciplina Extreme Programming (TDD Red-Green-Refactor) com
execução ancorada em grafo persistente. Cada transição de fase é
um gate determinístico baseado em fitness functions, prevenindo
atalhos sob pressão de tempo.

### 5.3. Task Readiness Score + Model Router

Função composta de cinco sinais (xpSize 35%, AC quality 30%,
harness 15%, dependency depth 10%, issue pattern penalty 10%)
que seleciona dinamicamente o modelo de linguagem mais econômico
capaz de executar cada tarefa atômica. Arquitetura de daemon
compartilhado reduz consumo de memória em ~55% para cinco agentes
concorrentes (medição empírica).

## 6. Modo de operação

O programa é iniciado como servidor local via `mcp-graph` ou
`mcp-graph-daemon` (modo daemon compartilhado). Agentes de IA
compatíveis com MCP conectam via stdio ou HTTP, autenticando e
executando ferramentas do grafo. Operações são transacionais e
rastreáveis; cada mutação atualiza o grafo SQLite atomicamente.

## 7. Determinismo e reprodutibilidade

O programa opera **sem dependência de modelos de linguagem em
tempo de execução**: todas as operações sobre o grafo são
determinísticas. Modelos de IA são consumidores do grafo, não
componentes internos. Isso torna o programa auditável, testável
com 7500+ testes automatizados, e independente de disponibilidade
de serviços externos.

## 8. Licenciamento

O código-fonte é distribuído sob **MIT License**, permitindo uso,
modificação e redistribuição sob os termos dessa licença. A
titularidade intelectual permanece com o autor, conforme
`NOTICE.md` no repositório.

---

**Referências no repositório:**

- `CLAUDE.md` — especificação evolutiva completa
- `docs/architecture/` — diagramas e ADRs
- `docs/guides/HARNESS-ENGINEERING.md` — guia da métrica
- `docs/reference/LIFECYCLE.md` — metodologia completa do pipeline
- `NOTICE.md` — declaração formal de autoria
