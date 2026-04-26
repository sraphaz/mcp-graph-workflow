# Quickstart — 60 segundos até a primeira task

Três comandos e você está rodando:

```bash
mcp-graph init                          # 1. cria grafo + configs (5s)
mcp-graph add task --title "minha task" # 2. adiciona uma task qualquer
mcp-graph next                          # 3. mostra a próxima — você está dentro do loop
```

Se isso fez sentido, pula direto pro [tour de 60 segundos](#tour-de-60-segundos) abaixo. Se não, continua lendo.

## Pré-requisitos

- Node.js ≥ 20 (`node --version`)
- Um terminal e uma pasta de projeto

Só isso. Sem Docker, sem cloud, sem cadastro.

## Instalação

```bash
npm install -g @mcp-graph-workflow/mcp-graph    # servidor MCP (v10.x)
npm install -g @mcp-graph-workflow/cli@beta     # CLI v11 (com o comando `mcp-graph`)
```

> Você precisa dos **dois pacotes**: o `mcp-graph` é o runtime (mantém o grafo), e o `cli@beta` é a porta `mcp-graph`. Sem o primeiro, `mcp-graph init` falha com `parent runtime not found`.

(Ou `curl -fsSL https://mcp-graph.dev/install.sh | sh` — mesmo efeito, com check amigável de Node.)

## Tour de 60 segundos

```bash
mkdir meu-projeto && cd meu-projeto

mcp-graph init
```

Saída esperada:

```
✓ Stack detectado: TypeScript + Vitest
✓ Criado workflow-graph/graph.db
✓ Escrito .mcp.json (Claude Code, Cursor)
✓ Escrito .vscode/mcp.json (Copilot)
✓ Escrito .gitignore (3 linhas)
✓ Escrito .claude/skills/ (15 skill files)
```

Agora adicione uma task e veja a próxima:

```bash
mcp-graph add task --title "fix login flow" --priority 2
mcp-graph add task --title "write tests"     --priority 3
mcp-graph next
```

Saída esperada do `mcp-graph next`:

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ NEXT TASK  node_799f48ee8dfb                                                 │
│                                                                              │
│ fix login flow                                                               │
│                                                                              │
│ tipo: task  ·  prioridade: 2                                                 │
│                                                                              │
│ desbloqueada, alta prioridade                                                │
│                                                                              │
│ ▸ start: mcp-graph start node_799f48ee8dfb  ·  ver tudo: mcp-graph list                    │
╰──────────────────────────────────────────────────────────────────────────────╯
```

Esse é o ciclo inteiro. A partir daqui:

```bash
mcp-graph start node_799f48ee8dfb            # status → in_progress, mostra checklist TDD
# ... você implementa ...
mcp-graph finish                             # status → done, sugere a próxima
```

## Quer importar um PRD em vez de criar tasks soltas?

Use o exemplo do projeto (3 tasks já estruturadas):

```bash
curl -o PRD.md https://raw.githubusercontent.com/DiegoNogueiraDev/mcp-graph-workflow/master/docs/examples/sample-prd.md

mcp-graph repl           # entra no REPL
> /import_prd ./PRD.md   # transforma o PRD em grafo
> /list                  # vê todas as tasks geradas
```

## Quer o dashboard?

```bash
mcp-graph ui
# abre http://localhost:3000 — graph view, search, kanban
```

Ctrl+C para parar.

## Quer fluxo zero-intervenção?

```bash
mcp-graph hooks install --profile balanced
```

Três perfis, escolha um:

| Perfil | Hooks instalados | Quando |
|---|---|---|
| `minimal` | 1 — banner em `SessionStart` | você só quer um sinal de vida |
| `balanced` *(recomendado)* | 5 — `SessionStart`, pre-MCP-tool, post-edit harness scan, post-`finish_task` chain, `Stop` snapshot | uso diário, defaults opinativos |
| `aggressive` | 7 — balanced + post-`Bash` + `UserPromptSubmit` | supervisão máxima, um pouco mais barulhento |

Hooks rodam em silêncio e logam em `~/.mcp-graph/logs/hooks.jsonl`. Seus hooks existentes do Claude Code são preservados.

Para desligar: `mcp-graph hooks uninstall` (idempotente). Para checar o que está instalado: `mcp-graph hooks status`.

## Quer testar sem comprometer um projeto?

```bash
mcp-graph demo
```

Cria um sandbox descartável em `~/.mcp-graph/demos/<stamp>/` com um PRD de exemplo já importado. Brinque o quanto quiser; limpe depois com `mcp-graph demo --cleanup` ou `rm -rf <pasta>`.

## Verificar o que você tem instalado

Dois comandos, duas respostas:

```bash
mcp-graph --version           # 11.x.x-beta — o CLI v11 que você acabou de instalar
mcp-graph --version    # 10.x.x — o servidor MCP (runtime que o `mcp-graph` conversa)
```

Os dois precisam responder versão. Se `mcp-graph --version` funciona mas `mcp-graph init` falha com `parent runtime not found`, instale também o servidor: `npm install -g @mcp-graph-workflow/mcp-graph`.

## Três modos de invocação

Cada comando funciona de três jeitos — mesmo handler, três portas de entrada:

| Modo | Como | Quando usar |
|---|---|---|
| **REPL** | `mcp-graph` e depois `/cmd` | trabalho interativo do dia a dia |
| **Shell** | `mcp-graph cmd` | scripts, CI, one-shot rápido |
| **Skill do Claude** | `/cmd` dentro do Claude Code | quando já está num chat de agente |

As skills do Claude são auto-instaladas no seu projeto pelo `mcp-graph init` (em `.claude/skills/`). Digite `/` no Claude Code e elas aparecem no autocomplete.

## Próximos passos

- **Cheatsheet** — todos os comandos em uma página: [CHEATSHEET.md](CHEATSHEET.md)
- **Guia completo** — conceitos, lifecycle, três modos lado a lado: [GUIDE.md](GUIDE.md)
- **Três modos lado a lado** — quando usar tool do Claude vs `mcp-graph` shell vs slash do REPL: [mapa de superfície v11](../guides/v11-cli-surface-map.md)
- **PRD de exemplo** — copie e teste: [sample-prd.md](../examples/sample-prd.md)
- **Listar todos os comandos** — `mcp-graph help` (ou `mcp-graph help <busca>`, ex: `mcp-graph help auth`)

## Troubleshooting

Se `mcp-graph --version` funciona mas `mcp-graph init` dá erro com "parent runtime not found", o pacote do servidor não foi instalado:

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

Ou em setup de monorepo dev: builde o parent primeiro (`npm --prefix path/para/parent run build`) e defina `MG_PARENT_DIST=/abs/path/to/dist`.

Para o resto: [TROUBLESHOOTING.md](TROUBLESHOOTING.md) ou abra issue em https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues.

## Licença

AGPL-3.0-or-later · Copyright © 2026 Diego Lima Nogueira de Paula
