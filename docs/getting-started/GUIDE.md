# mcp-graph — Guia Prático

**Em uma frase:** mcp-graph é a camada de **engenharia de software dirigida por IA (AISE)** que dá memória persistente e disciplina ao seu agente — em vez dele improvisar a cada sessão, ele navega um grafo executável que vive no seu projeto.

> **AISE = AI-Driven Software Engineering.** É entregar software com agentes de IA aplicando o mesmo rigor que time sênior usa: spec antes do código, TDD obrigatório, rastreabilidade, memória entre sessões. mcp-graph é a instância local-first dessa categoria.

Este guia te leva de "nunca ouvi falar" até "primeira task entregue" em **5 minutos** de leitura + **5 minutos** de mão na massa.

---

## Sumário

1. [O que é mcp-graph?](#1-o-que-é-mcp-graph)
2. [Quando usar (e quando não)](#2-quando-usar-e-quando-não)
3. [Instalação em 60 segundos](#3-instalação-em-60-segundos)
4. [Seu primeiro projeto em 5 minutos](#4-seu-primeiro-projeto-em-5-minutos)
5. [Conceitos-chave](#5-conceitos-chave)
6. [Os 3 jeitos de chamar a mesma ação](#6-os-3-jeitos-de-chamar-a-mesma-ação)
7. [Hooks — automação invisível](#7-hooks--automação-invisível)
8. [Próximos passos](#8-próximos-passos)

---

## 1. O que é mcp-graph?

Você já cansou disso?

- O agente **esquece** o que você combinou na sessão de ontem
- O PRD vira parede de texto que ninguém revisita
- Não dá pra **rastrear** o que o agente fez nem onde ele travou

mcp-graph resolve esses três problemas juntos: pega seu PRD (Markdown, PDF, HTML), transforma em um **grafo persistente de tasks** com dependências, e o agente passa a navegar esse grafo em vez de improvisar a partir do zero.

### Como ele se encaixa com sua CLI de IA

```
Você (humano)
 └─ CLI de IA (Claude Code · Copilot CLI · Cursor)        ← agente roda aqui, sem memória
    └─ mcp-graph (servidor MCP + CLI unificado)           ← memória + porta humana + auto-hooks
                                                           ↓
                                  workflow-graph/graph.db (a "memória" persistente)
```

**O que mcp-graph adiciona:**

- **Sem ele:** ótimo agente, **memória zero**. Cada chat começa do nada.
- **Com ele:** memória estruturada (PRD → grafo, lifecycle de 9 fases) + acesso humano direto via `mcp-graph next` (sem gastar tokens) + auto-hooks no Claude Code + skill files que reduzem alucinação.

> **As 9 fases do lifecycle** (você não precisa decorar — `mcp-graph` te guia):
> ANALYZE → DESIGN → PLAN → IMPLEMENT → VALIDATE → REVIEW → HANDOFF → DEPLOY → LISTENING.

> **`unified-gate`**: o componente do mcp-graph que sincroniza múltiplos agentes mexendo no mesmo grafo — evita que dois Claude Code em paralelo brigem pela mesma task.

### Sem mcp-graph vs. com mcp-graph

| Sem (Claude/Copilot direto) | Com mcp-graph |
|---|---|
| "Faz um SaaS pra mim" → caos | PRD → tasks atômicas com critérios de aceitação |
| Agente esquece entre sessões | Estado persistente em SQLite, contexto comprimido |
| TDD opcional, depende do humor do agente | Hook bloqueia commit sem teste primeiro |
| Dois agentes em paralelo brigam | `unified-gate` sincroniza |
| "Já está pronto?" → adivinhação | `mcp-graph status` responde em 200ms |

> **Tudo local.** SQLite no seu projeto, zero LLM ao runtime do mcp-graph, sem chave de API, sem cloud, sem Docker.

---

## 2. Quando usar (e quando não)

**Use mcp-graph se:**

- Projeto vai durar mais de uma sessão
- Você usa múltiplos agentes (Claude Code + Copilot, ou dois Claude em paralelo)
- Quer rastreabilidade — "o que foi feito, por quê, quando, por quem"
- Time precisa alinhar — PRD vira fonte da verdade compartilhada
- Você quer TDD enforced de verdade, não só "tentar lembrar"
- Mais de 5 tasks na cabeça já é muita coisa

**Não use se:**

- Script de 50 linhas que você vai jogar fora amanhã
- Protótipo de 1 dia, descartável
- Você prefere "vibe coding" e não quer disciplina (legítimo, só não combina)

> Boa hora pra começar: feature de 2-5 dias com pelo menos 4 tasks. Pequeno o suficiente pra você ver o ciclo inteiro, grande o suficiente pra justificar a estrutura.

---

## 3. Instalação em 60 segundos

**Pré-requisito único:** Node.js ≥ 18 (`node -v`). Sem Docker, sem cloud.

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

Um pacote, 24 subcomandos: setup (init, doctor, serve, import) + lifecycle (start, finish, next, hooks, ui, demo, login, set-phase, ...). Veja `mcp-graph --help`.

### Verificar

```bash
mcp-graph --version           # 12.x.x
```

---

## 4. Seu primeiro projeto em 5 minutos

Vamos criar um projeto novo e fechar o ciclo `init → next → start → finish`. Use uma pasta vazia.

### 4.1 — Inicializar

```bash
mkdir meu-projeto && cd meu-projeto
mcp-graph init
```

O wizard detecta o stack (TypeScript, Python, etc.) e cria:

| Arquivo / Pasta | Por que |
|---|---|
| `workflow-graph/graph.db` | SQLite local — fonte da verdade do grafo (gitignored) |
| `.mcp.json` | Config para Claude Code, Cursor, IntelliJ |
| `.vscode/mcp.json` | Config para Copilot |
| `.claude/skills/*.md` | Skills `mcp-graph` pra usar dentro de Claude Code via slash |
| `.gitignore` (linhas) | Pra não commitar o DB |

### 4.2 — Adicionar tasks (rápido) ou importar PRD (completo)

**Rápido** — duas tasks pra ver o fluxo:

```bash
mcp-graph add task --title "fix login flow" --priority 2
mcp-graph add task --title "write tests"     --priority 3
```

**Completo** — partir de um PRD:

```bash
# Não tem PRD ainda? Use o exemplo do projeto:
cp /caminho/para/mcp-graph-workflow/docs/examples/sample-prd.md ./PRD.md
# ou baixe direto:
curl -o PRD.md https://raw.githubusercontent.com/DiegoNogueiraDev/mcp-graph-workflow/master/docs/examples/sample-prd.md

mcp-graph repl                    # entra no REPL
> /import_prd ./PRD.md            # transforma o PRD em grafo (1 epic + 3 tasks)
> /plan_sprint                    # decompõe em sprint baseado em DORA velocity
```

> Quer só explorar sem mexer em arquivo? Rode `mcp-graph demo` numa pasta separada — cria um sandbox com PRD exemplo e te deixa brincar.

### 4.3 — Fechar o ciclo

```bash
mcp-graph next                                # mostra a próxima task desbloqueada
# ╭─ NEXT TASK  node_799f48ee8dfb ─╮
# │ fix login flow                  │
# │ priority 2 · type: task         │
# ╰─────────────────────────────────╯

mcp-graph start node_799f48ee8dfb             # status → in_progress, render checklist TDD
# ... escreve teste falhando ...
# ... implementa o mínimo pra passar ...
# ... refatora ...

mcp-graph finish                              # status → done, sugere próxima
```

### 4.4 — Visualizar

```bash
mcp-graph ui                                  # abre dashboard em http://localhost:3000
```

Você vê o grafo, kanban, métricas, knowledge base — tudo no browser. Ctrl+C pra parar.

---

## 5. Conceitos-chave

Só os 5 que você precisa pra sobreviver a primeira semana.

### Grafo, Nó, Edge

- **Grafo** — a estrutura inteira do seu projeto. Persistido em `workflow-graph/graph.db`.
- **Nó** — uma unidade de trabalho. Tipos: `task`, `epic`, `decision`, `risk`, `note`.
- **Edge** — relação entre nós. Tipos comuns: `blocks`, `depends_on`, `child_of`.

Termos completos em [GLOSSARY.md](./GLOSSARY.md).

### As 9 fases do lifecycle

Toda feature passa por todas, em ordem:

| Fase | O que acontece |
|---|---|
| **ANALYZE** | PRD + cenários Given/When/Then. Definition of Ready (7 checks) |
| **DESIGN** | ADRs, contratos, decisões arquiteturais |
| **PLAN** | Decomposição em tasks atômicas, validação de gates (7/7) |
| **IMPLEMENT** | TDD Red → Green → Refactor |
| **VALIDATE** | E2E, AC scoring (Definition of Done — 9 checks) |
| **REVIEW** | Code review, blast radius |
| **HANDOFF** | PR, documentação |
| **DEPLOY** | CI/release, post-release validation |
| **LISTENING** | Feedback, abre próximo ciclo |

> Gates não pulam. Se PLAN→IMPLEMENT travou em 5/7, **fixe a causa raiz** — geralmente: tasks sem AC, ciclo no grafo, stack docs desatualizadas. Não relaxe o gate.

### TDD obrigatório (Red → Green → Refactor)

Em IMPLEMENT, o pipeline `mcp-graph start` renderiza um checklist TDD. Hook bloqueia commit que não tenha teste primeiro. Não dá pra "esquecer". Não é opcional.

### Definition of Done — 9 checks

`mcp-graph finish` roda os 9 antes de promover task pra `done`. Inclui: testes passando, AC validados, sem regressão, lint clean, etc. Se algum falha, task volta pra `in_progress` com mensagem específica.

---

## 6. Os 3 jeitos de chamar a mesma ação

Você consegue fazer **a mesma operação** de três formas. A escolha é só **conveniência do contexto**.

### Tabela rápida

| Modo | Como | Quando usar | Custo de tokens |
|---|---|---|---|
| **Claude direto** | `mcp__mcp-graph__start_task` no chat | já está conversando com o agente, fluxo todo pela IA | sim (agente paga) |
| **Shell `mcp-graph`** | `mcp-graph start <id>` no terminal | scripts, CI, "quero ver rápido sem prompt" | zero |
| **REPL `/cmd`** | `mcp-graph` aberto, depois `/start <id>` | sessão interativa humana, descoberta via `/help` | zero |

### Quando cada modo brilha

**Claude direto** — você está no meio de uma conversa com Claude Code, ele já entende o contexto, faz sentido pedir pro agente disparar a ação. Custa tokens, mas você economiza troca de janela.

**Shell `mcp-graph`** — você quer ver rapidinho qual a próxima task, sem perguntar pro agente. Ou está em CI rodando pipelines. Ou quer scriptar `mcp-graph list --status=blocked | wc -l`. Zero tokens, zero LLM.

**REPL `/cmd`** — você abriu `mcp-graph`, está em sessão interativa. `/help` te mostra a paleta inteira, fuzzy search funciona, history navega com setas. Bom pra explorar o que existe.

> **Cobertura do CLI `mcp-graph`**: cobre o ciclo de vida (`init`, `start`, `finish`, `next`, `list`, `status`, `add`, `set-phase`) e ops (`hooks`, `ui`, `demo`, `login`). As demais ~45 tools (`analyze`, `validate`, `search`, `node`, `edge`, `metrics`, `journey`, `code_intelligence`, `kanban`, `import_prd`, `plan_sprint` etc.) ficam **só via MCP** — use dentro de Claude Code/Cursor via `mcp__mcp-graph__<nome>`.

> Tabela completa de equivalência (todos os comandos `mcp-graph` + tools que continuam só MCP) em [cli-surface-map.md](../guides/cli-surface-map.md).

---

## 7. Hooks — automação invisível

Hook = ação automática que dispara em momentos específicos do Claude Code (start de sessão, antes de uma tool, depois de um edit, etc.). mcp-graph instala hooks pra automatizar a parte chata.

### Instalar

```bash
mcp-graph hooks install --profile balanced
```

### Os 3 perfis

| Perfil | Hooks | Quando usar |
|---|---|---|
| `minimal` | 1 (banner em SessionStart) | sinal de vida, nada mais |
| `balanced` *(recomendado)* | 5 (banner + pre-MCP-tool + post-edit + post-finish + Stop) | uso diário, defaults opinativos |
| `aggressive` | 7 (balanced + post-Bash + UserPromptSubmit) | máxima supervisão |

### O que `balanced` faz, em ordem

1. **SessionStart** → printa banner com health do projeto (status, harness score, próxima task)
2. **PreToolUse** (matcher: `mcp__mcp-graph__.*`) → valida lifecycle antes do agente chamar tool mcp-graph
3. **PostToolUse** (matcher: `Edit|Write|MultiEdit`) → harness scan incremental
4. **PostToolUse** (matcher: `mcp__mcp-graph__finish_task`) → encadeia `validate(ac)` + `analyze(implement_done)`
5. **Stop** → snapshot do grafo

Tudo silencioso. Logs em `~/.mcp-graph/logs/hooks.jsonl`. Os hooks que você já tinha em Claude Code são preservados.

### Desligar

```bash
mcp-graph hooks uninstall              # remove só os hooks do mcp-graph
MCP_GRAPH_HOOKS_OFF=1 mcp-graph ...    # ou desativa pra um comando só
```

> Por que perfis e não "tudo ou nada"? Cada hook adiciona um custo (tempo + ruído). `minimal` pra quem só quer um sinal de vida; `aggressive` pra quem quer rastreio completo de cada Bash; `balanced` é o ponto onde 80% das pessoas fica.

---

## 8. Próximos passos

- 🚀 [QUICKSTART.md](./QUICKSTART.md) — versão "60 segundos" deste guia
- 🔖 [CHEATSHEET.md](./CHEATSHEET.md) — todos os comandos em uma página
- 📖 [GLOSSARY.md](./GLOSSARY.md) — termos em linguagem clara
- 🔧 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — quando algo não funciona
- 🗺️ [cli-surface-map.md](../guides/cli-surface-map.md) — tabela completa MCP ↔ shell ↔ REPL
- 🌐 Dashboard em <http://localhost:3000> depois de `mcp-graph ui`
- 💬 Dúvidas: <https://github.com/DiegoNogueiraDev/mcp-graph-workflow/discussions>

---

**Próxima ação:** se você ainda não rodou nada, abra um terminal e cole:

```bash
mkdir mcp-graph-test && cd mcp-graph-test
mcp-graph init && mcp-graph add task --title "test the loop" && mcp-graph next
```

Em menos de 30 segundos você tem um grafo, uma task e a próxima ação na tela. A partir daí é só seguir o ciclo.
