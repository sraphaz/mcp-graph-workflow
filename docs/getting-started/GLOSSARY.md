# mcp-graph — Glossário (em linguagem clara)

Sem jargão. Cada termo explicado como se fosse pra alguém com 15 anos que nunca ouviu falar.

---

## O termo guarda-chuva

### AISE — AI-Driven Software Engineering (engenharia de software dirigida por IA)
**A categoria que mcp-graph instancia.** Pense em "engenharia de software" do jeito que time sênior faz: spec antes do código, teste antes da implementação, decisão registrada, ninguém improvisa. AISE é fazer isso **com agentes de IA** no meio do processo — sem perder o rigor.

Sem AISE → "vibe-coding": prompt solto, agente improvisa, código nasce sem teste, sessão seguinte recomeça do zero.
Com AISE → grafo de tasks atômicas + TDD obrigatório + memória persistente + decisão rastreada. O agente *navega*, não inventa.

**mcp-graph é a instância local-first dessa categoria.** Tudo neste projeto — graph, node, edge, TDD hook, memory — existe pra tornar AISE viável no seu fluxo diário.

**Os dois pilares operacionais da AISE** (que mcp-graph implementa lado a lado):

### SDD — Specification-Driven Development
Escrever especificações precisas e *machine-readable* **antes** do código. Raízes em métodos formais, BDD e API design. No mcp-graph: PRD vira grafo de tasks com critérios de aceite explícitos; o TDD obrigatório torna o teste a forma executável da especificação.

### CDE — Context-Driven Engineering
Dar contexto completo (intenção + constraints + histórico) ao agente em vez de prompts soltos. Reduz a fração não-determinística do output. No mcp-graph: grafo persistente + RAG local + memory snapshots = contexto que sobrevive ao reload e cresce a cada sessão.

> **Validação externa:** o [DORA Report 2025](https://www.infoq.com/news/2026/03/ai-dora-report/) (citado em InfoQ, Pragmatic Engineer e no *2026 Agentic Coding Trends Report* da Anthropic) afirma que organizações com workflows definidos e capacidades de plataforma maduras convertem ganhos de IA em entrega — sem isso, o agente fica mais rápido sem o ciclo de delivery acompanhar.

---

## Os 5 termos principais

### Graph (grafo)
**O esqueleto do seu projeto.** Imagina o **mapa do metrô** da sua cidade. Cada estação é um lugar onde o trem para. As linhas conectam estações. Você consegue ver de cima quais lugares existem, quais conectam com quais, e o caminho mais curto entre dois pontos.

O `graph` no mcp-graph é exatamente isso: a planta do que precisa ser feito no seu projeto. Você vê tudo de cima, vê o que depende de quê, e o que tem que vir antes do quê.

### Node (nó)
**Cada estação do mapa.** Uma coisa específica que precisa ser feita ou que existe no projeto.

Tipos de node:
- **task** — uma tarefa pra fazer (ex: "implementar tela de login")
- **epic** — um conjunto grande de tarefas relacionadas (ex: "Sistema de Login completo")
- **decision** — uma decisão de arquitetura registrada (ADR)
- **constraint** — uma regra/limite que precisa ser respeitado
- **acceptance_criteria** — o que tem que valer para a task ser considerada pronta

### Edge (aresta / linha)
**A conexão entre dois nodes.** Como a linha no mapa do metrô que liga uma estação à outra.

Tipos de edge:
- **dependsOn** — A só pode começar depois de B terminar
- **blocks** — A está impedindo B de avançar
- **relates_to** — A e B estão relacionados (mas não dependentes)
- **part_of** — A é parte de B (task dentro de epic)

### Epic
**Um bairro inteiro do mapa do metrô.** Não é uma estação só — é um conjunto delas que formam uma feature/módulo grande.

Por exemplo: o epic "Autenticação" tem dentro as tasks "tela de login", "API de auth", "integração OAuth", "logout", etc. Cada uma vira um node task.

### Task
**Um ponto específico onde você desce.** Uma unidade de trabalho concreta, idealmente pequena o bastante pra fazer em algumas horas.

Boa task tem:
- **título** claro (verbo + objeto: "Implementar API de login")
- **AC (acceptance_criteria)** — como saber que está pronta
- **estimativa** (opcional)
- **status**: `backlog` → `in_progress` → `done`

---

## Termos do agente / Copilot

### MCP (Model Context Protocol)
**Como o robô de IA fala com o mapa.** É um protocolo padrão que permite que o GitHub Copilot, Claude, Cursor, etc. consultem e atualizem o graph do mcp-graph durante uma conversa.

Sem MCP, você teria que digitar comandos manualmente. Com MCP, o agente consulta o graph e atualiza ele sozinho.

### Tool (MCP tool)
**Uma função que o agente pode chamar.** Cada tool faz uma coisa específica no graph: `next` (pegar próxima task), `start_task` (começar), `update_status` (mudar status), `validate` (rodar gates), etc.

O mcp-graph expõe ~50 tools no total, mas por padrão o agente só vê as ~8 principais (profile `core`).

### Skill
**Um mini-prompt pré-pronto pro agente seguir.** No GitHub Copilot CLI, comandos como `/graph-analyze`, `/graph-design`, `/graph-plan`, `/graph-implement` são skills.

Cada skill instrui o agente a usar as tools certas na ordem certa para uma fase do ciclo de vida. Estão em `.agents/skills/` no seu projeto.

### Profile (do MCP server)
**Quantas tools o agente vê.** 3 níveis:
- **core** (~8 tools) — daily work loop. Padrão.
- **pro** (~20) — adiciona planning, validação, exports
- **expert** (~50) — tudo, incluindo coisas raras (siebel, davinci, etc.)

Configura via `MCP_GRAPH_PROFILE=pro mcp-graph mcp` (ou `core`/`expert`/`all`).

---

## Termos do ciclo de vida

### Lifecycle (ciclo de vida)
**As fases que toda feature passa.** Pública: 4 fases (ANALYZE → DESIGN → PLAN → IMPLEMENT). Internamente o sistema rastreia 9 (porque dentro de IMPLEMENT existem sub-passos como VALIDATE, REVIEW, HANDOFF, DEPLOY).

Você só precisa pensar nas 4 públicas. As 9 internas aparecem só se rodar `mcp-graph status --verbose`.

### Gate
**Portão de qualidade entre fases.** Antes de pular de PLAN para IMPLEMENT, o sistema roda 7 verificações: tem AC nas tasks? Sem ciclos no graph? Stack docs sincronizadas? Etc.

Se 7/7 passa, pode avançar. Se não, fixe os pendentes primeiro.

### TDD (Test-Driven Development)
**Escrever o teste antes do código.** Ciclo:
1. **Red**: escreve teste que falha (porque a feature não existe ainda)
2. **Green**: escreve o mínimo de código pra fazer passar
3. **Refactor**: limpa o código sem quebrar o teste

mcp-graph exige TDD em IMPLEMENT — não tem código sem teste antes.

### DoD (Definition of Done)
**O checklist do que significa "pronto".** No mcp-graph, são 9 checks: testes passam, sem regressões, AC cumpridos, lint OK, etc. Toda task tem que cumprir antes de virar `done`.

### DoR (Definition of Ready)
**O checklist do que significa "pronto para começar".** 7 checks rodados na fase ANALYZE: requisito claro, AC definidos, estimativa razoável, dependências identificadas, etc. Sem isso, a task entra em `backlog` mas não é elegível pra `start_task`.

### PRD (Product Requirements Document)
**O documento de requisitos do produto.** É o arquivo `.md`/`.txt` que descreve o que precisa ser construído, em linguagem natural. Você escreve, e `mcp-graph import_prd <arquivo>` transforma ele em nodes do graph automaticamente.

### Sprint
**Um período de trabalho com escopo definido.** Tipicamente 1-2 semanas. Tasks são alocadas a um sprint via `plan_sprint` baseado em capacidade de velocity histórica.

### Velocity
**Quanto seu time entrega por sprint, em média.** Calculado a partir do histórico (tasks done / sprint). Usado para não sobrealocar o próximo sprint.

---

## Termos de arquitetura

### Strict mode
**Modo onde o sistema não toca em artefatos sem revisão humana.** No DESIGN, ativar strict garante que ADRs, contracts e PRDs gerados ficam em arquivos `-designer` separados pra você revisar antes de mergir no oficial.

Recomendado pra projetos sérios.

### Knowledge Store
**A base de conhecimento do projeto.** Indexação local (FTS5 + BM25 + TF-IDF) de PRDs, decisões, convenções, código. O agente consulta via tool `knowledge` ou `search` em vez de improvisar.

### RAG (Retrieval-Augmented Generation)
**Buscar contexto antes de responder.** Em vez de o agente inventar baseado no que sabe, ele primeiro pergunta ao knowledge store o que é relevante e responde baseado nisso.

mcp-graph faz RAG automaticamente quando você pede `context(rag, "minha pergunta")`.

### Harnessability score
**Quão "preparado pra agente" o seu código está.** Métrica composta (0-100) que mede 7 dimensões: type coverage, test coverage, arquitetura, docs, naming, error handling, jsdoc.

A ≥85 / B ≥70 / C ≥55 / D <55. Roda com `npm run harness:scan`.

---

## Termos do dashboard

### Kanban
**Tabela com colunas por status.** Visualização padrão das tasks: backlog | in_progress | done.

### Graph view
**Mapa visual do projeto.** Renderiza o graph em React Flow — você vê os nodes como caixas e edges como setas. Bom pra entender dependências.

---

📚 [GUIDE.md](./GUIDE.md) — guia completo passo a passo
🔖 [CHEATSHEET.md](./CHEATSHEET.md) — referência rápida em 1 página
🔧 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — erros comuns
