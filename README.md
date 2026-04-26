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
  <a href="https://www.npmjs.com/package/@mcp-graph-workflow/cli"><img src="https://img.shields.io/npm/v/%40mcp-graph-workflow%2Fcli/beta?label=cli%20%40beta&color=orange" alt="cli @beta"></a>
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
    ├─ mcp-graph (servidor MCP, v10.x)                    ← memória estruturada do projeto
    └─ mg CLI (v11 beta)                                  ← porta humana + auto-hooks + skills
                                                          ↓
                                  workflow-graph/graph.db (a "memória" persistente)
```

| Sem mcp-graph | Com mcp-graph |
|---|---|
| "Faz um SaaS pra mim" → caos | PRD → tasks atômicas com critérios de aceite |
| Agente esquece entre sessões | SQLite persistente, contexto comprimido entre sessões |
| TDD opcional, depende do humor do agente | Hook bloqueia commit sem teste primeiro |
| Dois agentes em paralelo brigam | `unified-gate` mantém ambos sincronizados |
| "Tá pronto?" → adivinhação | `mg status` responde em 200ms |

### Um ciclo completo em 4 comandos

```bash
mg init                           # cria grafo + configs do IDE
mg add task --title "fix login"   # ou: importar PRD inteiro com import_prd <arquivo>
mg start <id>                     # status → in_progress, mostra checklist TDD
mg finish                         # status → done, sugere a próxima
```

> Não tem PRD ainda? Use [este exemplo](docs/examples/sample-prd.md) (login básico, ~3 tasks) para testar `import_prd` antes de escrever o seu.

100% offline. Determinístico. Reproduzível.

## Instalação

Dois caminhos — escolha um. O CLI v11 é **opt-in** e **totalmente backward-compat**: instalações v10 existentes continuam funcionando sem mudar nada.

### Caminho 1 — só servidor MCP (estável, **sem o CLI `mg`**)

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

Adicione ao `.mcp.json` (Claude Code, Cursor, IntelliJ) ou `.vscode/mcp.json` (Copilot):

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

Dentro do seu agente: `init` → `import_prd <arquivo>` → `plan_sprint` → `start_task` / `finish_task`.

> ⚠️ **Neste caminho, o comando `mg` não é instalado.** Os exemplos `mg init`, `mg next` etc. mostrados acima e nos demais docs **não funcionam aqui** — você usa só as MCP tools dentro do seu agente. Se você quer o REPL `mg` e os hooks automáticos, escolha o **Caminho 2** abaixo.

### Caminho 2 — servidor MCP + CLI `mg` (**recomendado para começar**)

```bash
npm install -g @mcp-graph-workflow/mcp-graph
npm install -g @mcp-graph-workflow/cli@beta
```

No seu projeto:

```bash
cd seu-projeto
mg init                                # grafo + configs do IDE + .claude/skills
mg hooks install --profile balanced    # automação do Claude Code (opcional, recomendado)
mg                                     # REPL interativo — digite /help para descobrir
```

**Pré-requisitos:** Node.js ≥ 18. Sem Docker, sem infra externa, sem chave de API de LLM.

## Documentação

Comece por aqui:

- **[Quickstart](docs/getting-started/QUICKSTART.md)** — 60 segundos com `mg`
- **[Guia](docs/getting-started/GUIDE.md)** — passo a passo completo (PT-BR)
- **[Cheatsheet](docs/getting-started/CHEATSHEET.md)** — todos os comandos em uma página

Aprofunde:

- **[Mapa de superfície v10 → v11](docs/guides/v11-cli-surface-map.md)** — três modos lado a lado: tool do Claude, shell `mg`, slash do REPL
- **[Troubleshooting](docs/getting-started/TROUBLESHOOTING.md)** — resolva problemas comuns
- **[Glossário](docs/getting-started/GLOSSARY.md)** — vocabulário em linguagem clara
- **[PRD de exemplo](docs/examples/sample-prd.md)** — para testar `import_prd` sem precisar escrever um PRD do zero

## Pesquisa & Citação

Este projeto é um experimento ativo de pesquisa de Mestrado (UNOPAR). Para contexto acadêmico, citação (BibTeX/ABNT) e a hipótese de pesquisa: veja [`docs/_internal/RESEARCH.md`](docs/_internal/RESEARCH.md).

## Licença

- **Open Source:** [AGPL v3](LICENSE) — gratuita para uso open-source e de pesquisa
- **Comercial:** [licença comercial disponível](COMMERCIAL.md) para uso proprietário
- **Atribuição:** [NOTICE.md](NOTICE.md) — metodologias originais e créditos requeridos
