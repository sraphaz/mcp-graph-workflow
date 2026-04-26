<p align="center">
  <img src="docs/images/graph-logo.jpg" alt="mcp-graph" width="700">
</p>

<h1 align="center">mcp-graph</h1>

<p align="center">
  <strong>Engenharia de software dirigida por IA. Local-first. Anti-vibe-coding por padrão.</strong><br/>
  O Claude Code não esquece mais o que vocês combinaram.<br/>
  PRD → grafo → TDD → produção. Tudo local, tudo rastreado.
</p>

<p align="center">
  <a href="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/actions/workflows/ci.yml"><img src="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@mcp-graph-workflow/mcp-graph"><img src="https://img.shields.io/npm/v/%40mcp-graph-workflow%2Fmcp-graph" alt="npm version"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/%40mcp-graph-workflow%2Fmcp-graph" alt="Node.js"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL_v3-blue.svg" alt="License: AGPL v3"></a>
  <a href="COMMERCIAL.md"><img src="https://img.shields.io/badge/Commercial-available-informational" alt="Commercial license available"></a>
</p>

## Em uma página

**Categoria:** mcp-graph é uma camada de **engenharia de software dirigida por IA (AISE — AI-Driven Software Engineering)**. Significa entregar software com agentes de IA aplicando o mesmo rigor de time sênior: spec antes do código, TDD obrigatório, decisão rastreada, memória entre sessões. Sem vibe-coding.

**Tecnicamente:** implementa as duas metodologias canônicas da AISE — **Specification-Driven Development (SDD)**, onde PRD vira grafo de specs executáveis com AC, e **Context-Driven Engineering (CDE)**, onde grafo + RAG + memory dão contexto persistente entre sessões. É a "capacidade de plataforma" que o [DORA Report 2025](https://www.infoq.com/news/2026/03/ai-dora-report/) cita como pré-requisito para AI converter produtividade em entrega.

**O que entrega:**

1. **Estrutura antes do código** — PRD vira grafo persistente em SQLite. Zero trabalho não-rastreado.
2. **TDD não-negociável** — toda task tem teste antes da implementação. O agente recusa pular.
3. **Memória que sobrevive ao reload** — contexto comprimido, RAG local, 50+ ferramentas MCP.

**Como se diferencia:**

| Comparação | mcp-graph traz |
|---|---|
| vs Cursor / Copilot puros | Persistência + governança entre sessões |
| vs Linear / Jira | Grafo executável pelo agente, não só visual |
| vs LangGraph e afins | Local-first, zero infra, CLI única |

## O que faz

Três problemas que toda sessão de coding com IA tem:

1. **Seu agente esquece** — todo chat novo começa do zero, ele reinventa o plano cada vez.
2. **PRDs viram paredes de texto** — ninguém relê, o agente improvisa as features.
3. **Zero rastreabilidade** — você não consegue dizer o que foi feito, o que travou nem por que uma decisão foi tomada.

`mcp-graph` resolve isso. Pega seu PRD, transforma num grafo de tasks persistente que o agente **navega** em vez de **improvisar** — tudo guardado em SQLite local. Sem cloud, sem chave de API de LLM.

> 💡 **MCP** = Model Context Protocol. É o padrão que faz seu agente de IA (Claude Code, Cursor, Copilot) enxergar ferramentas externas como o mcp-graph. Você não precisa entender o protocolo — só saber que `.mcp.json` é o arquivo onde o agente descobre quais ferramentas estão disponíveis.

### Como ele se encaixa com sua CLI de IA

```
Você (humano)
 └─ CLI de IA (Claude Code · Copilot CLI · Cursor)        ← agente roda aqui, sem memória
    └─ mcp-graph (servidor MCP + CLI unificado, v12)      ← memória + porta humana + hooks + skills
                                                          ↓
                                  workflow-graph/graph.db (a "memória" persistente)
```

| Sem mcp-graph | Com mcp-graph |
|---|---|
| "Faz um SaaS pra mim" → caos | PRD → tasks atômicas com critérios de aceite |
| Agente esquece entre sessões | SQLite persistente, contexto comprimido entre sessões |
| TDD opcional, depende do humor do agente | Hook bloqueia commit sem teste primeiro |
| Dois agentes em paralelo brigam | `unified-gate` mantém ambos sincronizados |
| "Tá pronto?" → adivinhação | `mcp-graph status` responde em 200ms |

### Um ciclo completo em 4 comandos

```bash
mcp-graph init                           # cria grafo + configs do IDE
mcp-graph add task --title "fix login"   # ou: importar PRD inteiro com 'mcp-graph import <arquivo>'
mcp-graph start <id>                     # status → in_progress, mostra checklist TDD
mcp-graph finish                         # status → done, sugere a próxima
```

> Não tem PRD ainda? Use [este exemplo](docs/examples/sample-prd.md) (login básico, ~3 tasks) para testar `import_prd` antes de escrever o seu.

100% offline. Determinístico. Reproduzível.

## Instalação

Um único comando — pacote unificado v12 traz servidor MCP + CLI completo:

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

Pra usar como MCP tool dentro do agente, adicione ao `.mcp.json` (Claude Code, Cursor, IntelliJ) ou `.vscode/mcp.json` (Copilot):

```json
{
  "mcpServers": {
    "mcp-graph": {
      "command": "npx",
      "args": ["-y", "@mcp-graph-workflow/mcp-graph"]
    }
  }
}
```

Pra usar via terminal:

```bash
cd seu-projeto
mcp-graph init                                # grafo + configs do IDE + .claude/skills
mcp-graph hooks install --profile balanced    # automação do Claude Code (opcional, recomendado)
mcp-graph repl                                # REPL interativo — digite /help para descobrir
```

**Pré-requisitos:** Node.js ≥ 18. Sem Docker, sem infra externa, sem chave de API de LLM.

## Documentação

Comece por aqui:

- **[Quickstart](docs/getting-started/QUICKSTART.md)** — 60 segundos com `mcp-graph`
- **[Guia](docs/getting-started/GUIDE.md)** — passo a passo completo (PT-BR)
- **[Cheatsheet](docs/getting-started/CHEATSHEET.md)** — todos os comandos em uma página

Aprofunde:

- **[Mapa de superfície](docs/guides/cli-surface-map.md)** — três modos lado a lado: tool do Claude, shell `mcp-graph`, slash do REPL
- **[Troubleshooting](docs/getting-started/TROUBLESHOOTING.md)** — resolva problemas comuns
- **[Glossário](docs/getting-started/GLOSSARY.md)** — vocabulário em linguagem clara
- **[PRD de exemplo](docs/examples/sample-prd.md)** — para testar `import_prd` sem precisar escrever um PRD do zero

## Rede & Privacidade

**mcp-graph é 100% local-first.** Zero SaaS obrigatório, zero telemetria, zero phone-home automático. Roda completo em ambiente air-gapped depois de instalado.

Cinco integrações são opt-in e ficam desligadas por padrão:

| Integração | Como ativa | Como desliga |
|---|---|---|
| Verificação de update no npm | Banner não-bloqueante em CLI interativo | `MCP_GRAPH_NO_UPDATE_CHECK=1` (ou rode em `CI=true`, ou em modo MCP stdio) |
| LLM (Anthropic / GitHub Copilot) | Você cria `workflow-graph/bh-auth.json` ou define `ANTHROPIC_API_KEY` / `GITHUB_COPILOT_TOKEN` | Apague o arquivo / unset das env vars |
| Embeddings neurais (Hugging Face) | `mcp-graph install-neural` | Não rode o comando — fallback hash automático |
| Context7 MCP (docs de bibliotecas) | Adicionar em `.mcp.json` | Remover de `.mcp.json` |
| browser-use / Playwright MCP | Adicionar em `.mcp.json` + Copilot Bridge | Remover de `.mcp.json` |

Detalhes completos, contratos de fallback e justificativas: [`docs/_internal/adr/0057-local-first-zero-saas.md`](docs/_internal/adr/0057-local-first-zero-saas.md).

## Pesquisa & Citação

Este projeto é um experimento ativo de pesquisa de Mestrado (UNOPAR). Para contexto acadêmico, citação (BibTeX/ABNT) e a hipótese de pesquisa: veja [`docs/_internal/RESEARCH.md`](docs/_internal/RESEARCH.md).

## Licença

**[GNU Affero General Public License v3.0 ou posterior (AGPL-3.0-or-later)](LICENSE)** — copyleft forte por padrão.

- **Open Source / pesquisa / uso interno:** gratuito sob AGPL. Distribuir versão modificada (incluindo via SaaS/rede — §13 da AGPL) exige liberar o código fonte sob a mesma licença.
- **Uso comercial proprietário:** se o copyleft AGPL não couber no seu modelo (ex.: produto fechado, SaaS sem abrir derivações), há [licença comercial disponível](COMMERCIAL.md).
- **Atribuição obrigatória:** [NOTICE.md](NOTICE.md) — autoria, metodologia original e créditos.

Por que AGPL e não uma licença permissiva: garante que melhorias derivadas voltem pra comunidade. mcp-graph é pesquisa de mestrado em código aberto — copyleft preserva esse contrato.
