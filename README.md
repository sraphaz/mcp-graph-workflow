<p align="center">
  <img src="docs/images/graph-logo.jpg" alt="mcp-graph" width="700">
</p>

<h1 align="center">mcp-graph</h1>

<p align="center">
  <strong>Execução estruturada para workflows de desenvolvimento com IA.</strong><br/>
  Transforma documentos de requisitos em grafos de tasks persistentes, navegáveis pelo agente.
</p>

<p align="center">
  <a href="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/actions/workflows/ci.yml"><img src="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@mcp-graph-workflow/mcp-graph"><img src="https://img.shields.io/npm/v/%40mcp-graph-workflow%2Fmcp-graph" alt="npm version"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/%40mcp-graph-workflow%2Fmcp-graph" alt="Node.js"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL_v3-blue.svg" alt="License: AGPL v3"></a>
  <a href="COMMERCIAL.md"><img src="https://img.shields.io/badge/Commercial-available-informational" alt="Commercial license available"></a>
</p>

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
mcp-graph add task --title "fix login"   # ou: importar PRD inteiro com import_prd <arquivo>
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

> 📦 **Veio de v10.x ou v11.x-beta?** Veja o [guia de migração](docs/migration/mg-to-mcp-graph.md). v12 unifica os dois pacotes (`@mcp-graph-workflow/mcp-graph` e `@mcp-graph-workflow/cli`) sob um único bin `mcp-graph`. O comando `mg` foi removido (conflitava com `/usr/bin/mg` MicroEmacs no macOS).

## Documentação

Comece por aqui:

- **[Quickstart](docs/getting-started/QUICKSTART.md)** — 60 segundos com `mcp-graph`
- **[Guia](docs/getting-started/GUIDE.md)** — passo a passo completo (PT-BR)
- **[Cheatsheet](docs/getting-started/CHEATSHEET.md)** — todos os comandos em uma página

Aprofunde:

- **[Mapa de superfície v10 → v11](docs/guides/v11-cli-surface-map.md)** — três modos lado a lado: tool do Claude, shell `mcp-graph`, slash do REPL
- **[Troubleshooting](docs/getting-started/TROUBLESHOOTING.md)** — resolva problemas comuns
- **[Glossário](docs/getting-started/GLOSSARY.md)** — vocabulário em linguagem clara
- **[PRD de exemplo](docs/examples/sample-prd.md)** — para testar `import_prd` sem precisar escrever um PRD do zero

## Pesquisa & Citação

Este projeto é um experimento ativo de pesquisa de Mestrado (UNOPAR). Para contexto acadêmico, citação (BibTeX/ABNT) e a hipótese de pesquisa: veja [`docs/_internal/RESEARCH.md`](docs/_internal/RESEARCH.md).

## Licença

- **Open Source:** [AGPL v3](LICENSE) — gratuita para uso open-source e de pesquisa
- **Comercial:** [licença comercial disponível](COMMERCIAL.md) para uso proprietário
- **Atribuição:** [NOTICE.md](NOTICE.md) — metodologias originais e créditos requeridos
