# mcp-graph — Cheat Sheet

Todos os comandos principais em uma página. Imprimível em A4.

> Convenção: **Terminal** = shell direto • **Copilot** = dentro do `copilot` CLI (com servidor mcp-graph rodando) • **Browser** = navegador

---

## Setup (uma vez por máquina)

| Ação | Comando | Onde |
|---|---|---|
| Verificar Node ≥ 20 | `node -v` | Terminal |
| Verificar Git | `git --version` | Terminal |
| Verificar Copilot CLI | `copilot --version` | Terminal |
| Limpar cache npm (opcional) | `npm cache clean --force` | Terminal |
| **Instalar mcp-graph** | `npm install -g @mcp-graph-workflow/mcp-graph` | Terminal |
| Verificar versão | `mcp-graph -V` | Terminal |

## Primeiro uso (recomendado)

| Ação | Comando | Onde |
|---|---|---|
| **Demo guiada (zero config)** | `npx -y @mcp-graph-workflow/mcp-graph hello` | Terminal |

Cria sample PRD, importa, mostra graph e abre dashboard. Bom pra entender o produto em 60s.

## Setup do projeto (por projeto)

| Ação | Comando | Onde |
|---|---|---|
| Inicializar | `npx mcp-graph init` | Terminal (no projeto) |
| Inicializar (CI, sem prompt) | `npx mcp-graph init --yes-all` | Terminal |
| Inicializar sem skills Copilot | `npx mcp-graph init --no-copilot` | Terminal |

## Servidor (sempre aberto durante o uso)

| Ação | Comando | Onde |
|---|---|---|
| Iniciar servidor (Terminal 1) | `npx mcp-graph serve --port 3000` | Terminal |
| Servidor em outra porta | `npx mcp-graph serve --port 3001` | Terminal |
| Encerrar | Ctrl+C na janela do servidor | Terminal |

## Ciclo de vida (no Copilot CLI — Terminal 2)

| Ação | Comando | Onde |
|---|---|---|
| Abrir Copilot | `copilot` | Terminal |
| **ANALYZE** — analisar requisito | `/graph-analyze [descrição da feature]` | Copilot |
| **DESIGN** — arquitetura | `/graph-design [instruções]` | Copilot |
| DESIGN strict (revisão humana) | `/graph-design use strict mode [...]` | Copilot |
| **PLAN** — decompor em tasks | `/graph-plan [instruções]` | Copilot |
| Validar passagem de fase | `/graph-plan valide se podemos avançar` | Copilot |
| Trocar modelo de IA | `/model` | Copilot |
| **IMPLEMENT** — executar com TDD | `/graph-implement` | Copilot |

## Visualização e diagnóstico

| Ação | Comando | Onde |
|---|---|---|
| Dashboard web | abrir <http://localhost:3000> | Browser |
| Status do projeto | `mcp-graph stats --json` | Terminal |
| Diagnóstico do ambiente | `mcp-graph doctor` | Terminal |
| Reindexar (knowledge/RAG) | `mcp-graph reindex` | Terminal |

## MCP tool surface (avançado)

| Ação | Comando | Onde |
|---|---|---|
| Default (core, ~8 tools) | (nenhum — é o padrão) | — |
| Habilitar pro (~20 tools) | `MCP_GRAPH_PROFILE=pro mcp-graph mcp` | Terminal/env |
| Habilitar expert (~50 tools) | `MCP_GRAPH_PROFILE=expert mcp-graph mcp` | Terminal/env |
| Tudo (legacy compat) | `MCP_GRAPH_PROFILE=all mcp-graph mcp` | Terminal/env |

## Atualizações

| Ação | Comando | Onde |
|---|---|---|
| Atualizar mcp-graph | `npm update -g @mcp-graph-workflow/mcp-graph` | Terminal |
| Sincronizar config do projeto | `mcp-graph update` | Terminal (no projeto) |

---

## Atalhos mentais

- **2 terminais** sempre: T1 = `serve` rodando, T2 = `copilot` interativo
- **4 fases**: ANALYZE → DESIGN → PLAN → IMPLEMENT (do contexto até código)
- **Strict mode** no DESIGN garante revisão humana antes de tocar artefatos
- **Decomponha tasks** o máximo possível na fase PLAN (4 tasks → 20 subtasks XS)
- **Gates** são portões de qualidade — não pule, fixe a causa raiz
- **TDD obrigatório** em IMPLEMENT (Red → Green → Refactor)

---

📚 [GUIDE.md](./GUIDE.md) — guia completo passo a passo
🔧 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — erros comuns e soluções
📖 [GLOSSARY.md](./GLOSSARY.md) — o que é graph, node, epic em linguagem clara
