# mcp-graph — Cheat Sheet

Tudo o que você precisa em uma página. Imprimível em A4.

> **3 modos para a mesma ação** — escolha o que cabe no fluxo:
> **Claude direto** = `mcp__mcp-graph__X` no chat • **Shell `mg`** = no terminal • **REPL slash** = `mg` aberto, depois `/X`

---

## Equivalência: Claude tool ↔ `mg` shell ↔ REPL slash

| O que você quer fazer | Claude direto (MCP) | Shell `mg` | REPL `/cmd` |
|---|---|---|---|
| Inicializar projeto | `mcp__mcp-graph__init` | `mg init` | `/init` |
| Próxima task disponível | `mcp__mcp-graph__next` | `mg next` | `/next` |
| Começar uma task | `mcp__mcp-graph__start_task` | `mg start <id>` | `/start <id>` |
| Finalizar task atual | `mcp__mcp-graph__finish_task` | `mg finish` | `/finish` |
| Listar tasks | `mcp__mcp-graph__list` | `mg list` | `/list` |
| Status do projeto | (via dashboard) | `mg status` | `/status` |
| Adicionar nó | `mcp__mcp-graph__node` (batch) | `mg add task --title "..."` | `/add task --title "..."` |
| Trocar fase do lifecycle | `mcp__mcp-graph__set_phase` | `mg set-phase <PHASE>` | `/set-phase <PHASE>` |
| Demo descartável | (não disponível) | `mg demo` | `/demo` |
| Login GitHub Copilot | (não disponível) | `mg login` | `/login` |

📎 Tabela completa (todos os 20 comandos + tools que continuam só MCP) em [v11-cli-surface-map.md](../guides/v11-cli-surface-map.md).

**Quando usar cada modo:**

| Modo | Quando | Custo de tokens |
|---|---|---|
| **Claude direto** | já está conversando com o agente, fluxo inteiro pela IA | sim (agente paga) |
| **Shell `mg`** | scripts, CI, "quero ver rápido sem prompt" | zero |
| **REPL `/cmd`** | sessão interativa humana, descoberta via `/help` | zero |

---

## Setup (uma vez por máquina)

| Ação | Comando |
|---|---|
| Verificar Node ≥ 18 | `node -v` |
| Verificar Git | `git --version` |
| **Instalar MCP server (v10)** | `npm install -g @mcp-graph-workflow/mcp-graph` |
| **Instalar v11 CLI (opcional, recomendado)** | `npm install -g @mcp-graph-workflow/cli@beta` |
| Verificar versões | `mcp-graph --version` e `mg --version` |

## Setup do projeto (por projeto)

| Ação | Comando |
|---|---|
| Inicializar (v11 — recomendado) | `mg init` |
| Inicializar (v10 legado) | `npx mcp-graph init` |
| Inicializar sem prompts (CI) | `mg init --force` |
| Instalar hooks Claude Code | `mg hooks install --profile balanced` |
| Ver status dos hooks | `mg hooks status` |
| Remover hooks | `mg hooks uninstall` |

## Hooks — o que cada perfil instala

| Perfil | Hooks | Quando usar |
|---|---|---|
| `minimal` | 1 (banner em SessionStart) | sinal de vida, nada mais |
| `balanced` *(recomendado)* | 5 (banner + pre-MCP + post-edit + post-finish + Stop) | uso diário, defaults opinativos |
| `aggressive` | 7 (balanced + post-Bash + UserPromptSubmit) | máxima supervisão |

> Off temporário: `MCP_GRAPH_HOOKS_OFF=1`. Hooks ficam em `.claude/settings.local.json` (project-scoped, nunca global).

## Demo zero-config

```bash
mg demo                    # cria sandbox em ~/.mcp-graph/demos/<stamp>/ com PRD exemplo
mg demo --cleanup          # limpa
```

Bom pra entender o produto em 60s sem mexer no seu projeto.

## Visualização e diagnóstico

| Ação | Comando |
|---|---|
| Dashboard web | `mg ui` (abre `http://localhost:3000`) |
| Status compacto | `mg status` |
| Ver logs estruturados | `mg log` |
| Diagnóstico (v10) | `mcp-graph doctor` |

## Servidor MCP (v10 — legado, ainda funciona)

Se você está no fluxo two-terminal v10 (sem v11 CLI):

| Ação | Comando |
|---|---|
| Iniciar servidor | `npx mcp-graph serve --port 3000` |
| Em outra porta | `npx mcp-graph serve --port 3001` |
| Encerrar | Ctrl+C |

## MCP tool surface (avançado)

Profiles controlam quantas tools o agente vê:

| Profile | Tools | Como ativar |
|---|---|---|
| Default (core) | ~8 | (padrão, nenhum env var) |
| Pro | ~20 | `MCP_GRAPH_PROFILE=pro` |
| Expert | ~50 | `MCP_GRAPH_PROFILE=expert` |
| Tudo (legacy) | todos | `MCP_GRAPH_PROFILE=all` |

## Atualizações

```bash
npm update -g @mcp-graph-workflow/mcp-graph    # v10 server
npm update -g @mcp-graph-workflow/cli@beta     # v11 CLI
mcp-graph update                                # sync configs do projeto
```

---

## Atalhos mentais

- **3 modos, mesma ação** — Claude direto / shell `mg` / REPL `/cmd`. Escolha pelo contexto, não pela disponibilidade.
- **9 fases lifecycle**: ANALYZE → DESIGN → PLAN → IMPLEMENT → VALIDATE → REVIEW → HANDOFF → DEPLOY → LISTENING.
- **Decomponha tasks** o máximo possível na fase PLAN (4 tasks → 20 subtasks XS).
- **Gates não pulam** — fixe a causa raiz, não o gate.
- **TDD obrigatório** em IMPLEMENT (Red → Green → Refactor).
- **Hooks são silenciosos** — se nada apareceu, está tudo OK (logs em `~/.mcp-graph/logs/hooks.jsonl`).
- **v10 e v11 coexistem** — v11 é opt-in, não força migração.

---

📚 [GUIDE.md](./GUIDE.md) — guia completo passo a passo
🚀 [QUICKSTART.md](./QUICKSTART.md) — 60 segundos até o primeiro `mg next`
🔧 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — erros comuns e soluções
📖 [GLOSSARY.md](./GLOSSARY.md) — termos em linguagem clara
🗺️ [v11-cli-surface-map.md](../guides/v11-cli-surface-map.md) — tabela completa de 3-mode parity
