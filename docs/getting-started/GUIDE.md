# mcp-graph — Guia Completo de Instalação, Configuração e Uso

**Versão:** v10.2.0
**Para:** desenvolvedores que querem usar mcp-graph para guiar workflows de IA (GitHub Copilot, Claude, Cursor) com estrutura e disciplina.

---

## Sumário

1. [Visão Geral — Como Funciona](#1-visão-geral)
2. [Pré-Requisitos](#2-pré-requisitos)
3. [Instalação](#3-instalação)
4. [Primeiro uso (60 segundos)](#4-primeiro-uso-60-segundos)
5. [Inicialização do Projeto](#5-inicialização-do-projeto)
6. [Iniciando o Servidor](#6-iniciando-o-servidor)
7. [Ciclo de Vida em 4 Fases](#7-ciclo-de-vida-em-4-fases)
8. [Exemplo Real — Sessão de Repasse](#8-exemplo-real)
9. [Dicas e Boas Práticas](#9-dicas-e-boas-práticas)
10. [Troubleshooting & Cheat Sheet](#10-troubleshooting--cheat-sheet)

---

## 1. Visão Geral

`mcp-graph` é uma ferramenta de **workflow estruturado para desenvolvimento assistido por IA**. Ela transforma seu PRD (documento de requisitos) em um grafo executável de tasks — e o agente de IA navega esse grafo em vez de improvisar a cada sessão.

Resultado: menos alucinação, mais continuidade entre sessões, gates de qualidade entre fases, TDD obrigatório.

### Arquitetura simplificada

Para usar `mcp-graph`, você precisa entender que existem **dois componentes principais** rodando em terminais separados:

```
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│  Terminal 1 — Servidor          │    │  Terminal 2 — Copilot CLI       │
│                                 │    │                                 │
│  $ npx mcp-graph serve          │    │  $ copilot                      │
│    --port 3000                  │    │  > /graph-analyze [requisito]   │
│                                 │◀──▶│  > /graph-design [...]          │
│  (mantenha aberto durante       │MCP │  > /graph-plan [...]            │
│   toda a sessão)                │    │  > /graph-implement             │
└─────────────────────────────────┘    └─────────────────────────────────┘
                                                       │
                                       ┌───────────────▼───────────────┐
                                       │  Browser                      │
                                       │  http://localhost:3000        │
                                       │  Dashboard visual do graph    │
                                       └───────────────────────────────┘
```

> 💡 **Dica:** sempre **2 janelas de terminal**: T1 com servidor (long-running), T2 com Copilot CLI onde você executa os comandos de fase.

### As 4 fases do ciclo de vida

| Fase | O que acontece | Comando no Copilot |
|---|---|---|
| **ANALYZE** | Análise de requisitos, criação do PRD, Definition of Ready (7 checks) | `/graph-analyze [requisito]` |
| **DESIGN** | Decisões de arquitetura, ADRs, revisão humana (strict mode) | `/graph-design [instruções]` |
| **PLAN** | Decomposição em tasks, validação de gates (7/7), estimativas | `/graph-plan [instruções]` |
| **IMPLEMENT** | TDD Red→Green→Refactor, Definition of Done (9 checks) | `/graph-implement` |

---

## 2. Pré-Requisitos

### 2.1 — Node.js ≥ 20

Necessário para executar o servidor e a CLI. Baixe a versão LTS:

- 🔗 <https://nodejs.org/pt>
- Instale a LTS (≥ 20.x)
- Marque "Add to PATH" durante instalação (Windows)

Verificar:

```bash
node -v   # deve mostrar v20.x.x ou superior
npm -v
```

### 2.2 — Git

Para versionamento do projeto:

- 🔗 <https://git-scm.com/downloads>
- Instale com opções padrão

Verificar:

```bash
git --version
```

### 2.3 — GitHub Copilot CLI (opcional mas recomendado)

A integração principal do mcp-graph é via Copilot CLI (`/graph-analyze`, `/graph-design` etc.). Você precisa:

- Acesso/assinatura ao GitHub Copilot
- 🔗 Instalar conforme docs oficiais: <https://docs.github.com/en/copilot/github-copilot-in-the-cli>
- Autenticar com `gh auth login`

Verificar:

```bash
copilot --version
```

> 💡 **Sem Copilot CLI?** Você ainda pode usar mcp-graph diretamente (REPL standalone, comandos non-interactive, dashboard). Mas o fluxo `/graph-*` polido pertence ao Copilot CLI.

### 2.4 — PowerShell 7+ (Windows)

Recomendado no Windows para melhor compatibilidade:

```powershell
$PSVersionTable.PSVersion
```

---

## 3. Instalação

### Passo 1 — Limpar cache npm (opcional)

Apenas se você teve problemas de instalação anteriormente:

```bash
npm cache clean --force
```

### Passo 2 — Instalar globalmente

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

Aguarde a conclusão. O npm baixa o pacote e dependências.

> ⚠️ **Erro de permissão (Linux/Mac)?** Veja [TROUBLESHOOTING.md → Erro de permissão](./TROUBLESHOOTING.md). Recomendado mudar prefixo do npm em vez de usar `sudo`.

### Passo 3 — Verificar a instalação

```bash
mcp-graph -V
# Deve retornar: 10.2.0 (ou versão mais recente)
```

> ❓ **Comando não reconhecido?** O diretório global do npm não está no `PATH`. Veja [TROUBLESHOOTING.md → command not found](./TROUBLESHOOTING.md).

---

## 4. Primeiro uso (60 segundos)

A maneira **mais rápida** de entender o produto sem precisar entender configuração ainda:

```bash
# Em uma pasta vazia
npx -y @mcp-graph-workflow/mcp-graph hello
```

Isso vai:
1. Criar um PRD de exemplo (`mcp-graph-sample.md`)
2. Rodar `init` mínimo (DB local + `.mcp.json` + `.gitignore`)
3. Importar o PRD para o graph
4. Renderizar o graph em ASCII no terminal
5. Abrir o dashboard em `http://localhost:3000`

Se isso funcionou, você está pronto. Se quiser entender o fluxo real para um projeto seu, continue para a Seção 5.

---

## 5. Inicialização do Projeto

Navegue até seu projeto (existente ou novo) e inicialize:

```bash
cd caminho/do/seu/projeto
npx mcp-graph init
```

### O que o wizard pergunta

A partir da v10.2.0, o `init` é interativo. Ele detecta o stack e pergunta:

```
✓ Stack detectado: TypeScript + React + Vitest
✓ Vou criar:
   - workflow-graph/graph.db (banco local do graph)
   - .mcp.json (config para Claude/Cursor)
   - .gitignore (linhas para não commitar o DB)

? Install Copilot CLI integration? (Y/n)
   Inclui:
   - .agents/skills/* (25 skills /graph-*)
   - .github/copilot-instructions.md
   - .vscode/mcp.json
```

**Recomendado:** aceite (`Y`). Sem Copilot integration, você não terá os comandos `/graph-analyze`, `/graph-design` etc.

### Modos não-interativos

```bash
# CI: aceitar tudo (legacy completo, todos os 9 alvos)
npx mcp-graph init --yes-all

# Sem integração Copilot (só DB + config base)
npx mcp-graph init --no-copilot
```

### O que é criado

| Arquivo/Pasta | Por que |
|---|---|
| `workflow-graph/graph.db` | SQLite local, fonte da verdade do graph (gitignored) |
| `.mcp.json` | Config para Claude Code, Cursor, IntelliJ |
| `.vscode/mcp.json` | Config para VSCode + GitHub Copilot |
| `.gitignore` (linhas) | Para não commitar o DB local |
| `.agents/skills/graph-*/` | 25 skills que ativam `/graph-analyze` etc. no Copilot |
| `.github/copilot-instructions.md` | Instruções base para o Copilot CLI |

---

## 6. Iniciando o Servidor

O servidor mantém o graph em memória + SQLite e processa requisições MCP.

### Passo 1 — Iniciar (Terminal 1)

```bash
npx mcp-graph serve --port 3000
```

Você verá algo como:

```
mcp-graph serve
  project:  /Users/voce/seu-projeto
  port:     3000
  db:       workflow-graph/graph.db (47 nodes, 23 edges)
  dashboard: http://localhost:3000
listening on http://localhost:3000
```

> ⚠️ **MANTENHA ESTA JANELA ABERTA** durante todo o uso. Fechar = perder o servidor.

### Passo 2 — Abrir Copilot CLI (Terminal 2)

Em uma **NOVA janela** de terminal:

```bash
copilot
```

A partir daqui, todos os comandos `/graph-*` rodam **dentro do Copilot CLI**, não no terminal direto.

---

## 7. Ciclo de Vida em 4 Fases

Toda feature passa pelas 4 fases. Cada fase tem um comando, gates de qualidade, e produz artefatos específicos.

### 7.1 — Fase ANALYZE

**Objetivo:** transformar uma ideia em PRD estruturado com cenários de aceitação.

**No Copilot CLI:**

```
/graph-analyze [descrição do requisito ou feature]
```

**O que acontece:**
- Sistema analisa o requisito fornecido
- Cria um PRD com cenários (Given/When/Then)
- Roda **Definition of Ready** (7 checks)
- Salva conhecimento no graph
- Pode invocar skill especializada `graph-prd`

**Variantes úteis:**

```
/graph-analyze use rubber-duck @docs/prd/meu-prd.md
```

(Ativa revisão crítica + salva notas no PRD existente.)

### 7.2 — Fase DESIGN

**Objetivo:** decisões arquiteturais documentadas (ADRs) baseadas no PRD.

**No Copilot CLI:**

```
/graph-design [instruções]
```

**Recomendado: strict mode**

```
/graph-design use strict mode [...instruções]
```

Strict mode garante que o PRD humano não é alterado sem sua revisão. Cria arquivos derivados (`-designer`) para você revisar antes de aprovar.

**O que é medido:**
- ADR quality (A/B/C)
- Contract coverage (%)
- Design ready score (0-100)

**Saídas típicas:**
- `docs/adr/ADR-NNN.md`
- `docs/contracts/<feature>.contract.md`
- `docs/prd/<feature>-designer.md` (em strict mode)

### 7.3 — Fase PLAN

**Objetivo:** decompor a feature em tasks pequenas com dependências e estimativas.

**No Copilot CLI:**

```
/graph-plan [instruções]
```

**Variante recomendada:**

```
/graph-plan Decomponha as tasks no menor grau possível. Salve em docs/prd
```

(4 tasks → tipicamente 20+ subtasks XS após decomposição fina.)

**O que acontece:**
- Decomposição máxima
- Criação de sprints baseada em DORA velocity
- Validação de **7 gates de qualidade**
- Verificação: sem ciclos no graph, sem nós órfãos, stack docs sincronizadas
- Alerta de capacidade se sprint sobrecarregado

**Antes de avançar para IMPLEMENT, valide:**

```
/graph-plan valide se está tudo ok e se podemos passar para a próxima fase.
```

> ⚠️ Transição para IMPLEMENT só acontece com gate **7/7**. Alertas de capacidade não bloqueiam, mas indicam: ramp down task size.

### 7.4 — Fase IMPLEMENT

**Objetivo:** implementar o código seguindo o plano, com **TDD Red-Green-Refactor**.

**Antes de iniciar, selecione o modelo:**

```
/model
```

Escolha conforme o trabalho:
- **Claude Sonnet 4.6 / Sonnet 4.7** — equilíbrio velocidade/qualidade (recomendado)
- **Claude Opus 4.7** — qualidade máxima (planejamento, decisões críticas)
- **Claude Haiku 4.5** — velocidade alta (tarefas mecânicas)

**Inicie:**

```
/graph-implement
```

**O que acontece:**
- Pipeline TDD: Red (teste falha) → Green (mínimo p/ passar) → Refactor (limpeza)
- Implementação por fatias pequenas, respeitando sprint capacity
- **9 checks de Definition of Done** após cada task
- Promoção automática de tasks (`backlog` → `in_progress` → `done`)

---

## 8. Exemplo Real

> Sessão real de desenvolvimento de uma feature "Check-In" em app de segurança familiar. Use como **referência**, não como receita rígida.

### Cenário

Membro do círculo familiar pode enviar um "Check-In" com um toque para notificar todos que está seguro. Inclui: localização, mensagem opcional, feed de check-ins recentes.

### Fase ANALYZE

```
/graph-analyze Um membro do círculo pode enviar um "Check-In" com um toque
para notificar todos os membros do grupo de que está seguro.
Captura localização atual. Mensagem opcional.
Feed de check-ins recentes visível para todos do círculo.
```

**Saída:** PRD criado em `docs/prd/check-in-feature.md` com 4 cenários Given/When/Then. DoR: 7/7.

### Fase DESIGN — Strict Mode

```
/graph-design use strict mode do mcp-graph baseado no prd
@docs/prd/check-in-feature.md crie um novo arquivo
intitulado como -designer
```

**Saídas:**
- `docs/prd/check-in-feature-designer.md` (revisão humana)
- `docs/adr/ADR-042-check-in-storage.md`
- `docs/contracts/check-in.contract.md`

**Resultado:** ADR quality A, contract coverage 100%, design_ready 82/100 (B).

### Fase PLAN — Decomposição Fina

```
/graph-plan Decomponha as tasks no menor grau possível. Salve em docs/prd
```

**Resultado:** 4 tasks principais → 20 subtasks XS. Gate ready 7/7. 43 itens planejados. Harness A (95.5).

### Fase IMPLEMENT

```
/model
> selecionar Claude Sonnet 4.6

/graph-implement
```

**Saída:** 20 commits TDD ao longo de 3 sessões. Todas as 9 DoD passaram. Feature merged.

---

## 9. Dicas e Boas Práticas

### Controle Humano

- **Use strict mode no DESIGN** para manter controle sobre decisões
- **Sempre revise** os arquivos `-designer` antes de aprovar avanços de fase
- **Salve PRDs e plans** em `docs/prd/` para análise posterior

### Qualidade

- **Decomponha tasks no menor grau possível** na fase PLAN
- **Valide TODOS os gates** antes de avançar (7/7 checks)
- **Use rubber-duck** para revisão crítica em momentos chave (`/graph-analyze use rubber-duck`)
- **Monitore alertas de capacidade** no sprint (sinal de subdivisão necessária)

### Produtividade

- **Selecione o modelo de IA adequado** com `/model` antes de implementar
- **Use skills especializadas** quando disponíveis (`@.agents/skills/`)
- **Salve conhecimento no MCP-Graph frequentemente** (`/graph-design use rubber-duck save notes`)
- **Mantenha o servidor rodando** durante toda a sessão de trabalho

### Organização

- **Abra uma nova janela do Copilot** para cada contexto diferente
- **Nomeie arquivos de design com sufixo `-designer`** para revisão clara
- **Mantenha o feed de atividades** do mcp-graph atualizado (dashboard `/activity`)
- **Commits atômicos** — uma task → um commit

---

## 10. Troubleshooting & Cheat Sheet

🔧 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — erros comuns e soluções
🔖 [CHEATSHEET.md](./CHEATSHEET.md) — referência rápida de 1 página
📖 [GLOSSARY.md](./GLOSSARY.md) — termos explicados em linguagem clara

---

## Próximos passos

- 🌐 Abra o dashboard em <http://localhost:3000> para visualizar seu graph
- 📊 Rode `mcp-graph stats --json` para ver métricas
- 🔍 Rode `mcp-graph doctor` periodicamente para diagnóstico do ambiente
- 🤝 Contribuir: <https://github.com/DiegoNogueiraDev/mcp-graph-workflow>

---

**Versão deste guia:** v10.2.0 (DX overhaul)
**Última atualização:** 2026-04-25
