# mcp-graph — Troubleshooting

Erros comuns, sintomas, e como resolver — operando o mcp-graph como camada de **engenharia de software dirigida por IA (AISE)**. Cada item segue o formato:
**Sintoma** → **Causa provável** → **Fix em 1-2 comandos**.

> Faltou um caso aqui? Abra issue em <https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues> com o output exato do terminal.

---

## Instalação

### `mcp-graph: command not found` / `não é reconhecido`

**Causa:** o diretório global do npm não está no `PATH`.

```bash
# Descobrir onde o npm instala globais
npm config get prefix

# Adicionar ao PATH (Linux/macOS, sessão atual)
export PATH="$(npm config get prefix)/bin:$PATH"

# Persistir (Linux/macOS)
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.zshrc

# Windows (PowerShell): adicionar via Painel de Controle → Sistema → Variáveis de Ambiente
```

### Erro de permissão em `npm install -g`

**Causa:** instalação global sem permissão (Linux/macOS) ou shell não-elevado (Windows).

```bash
# macOS / Linux — preferir mudar prefixo (não usar sudo)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
npm install -g @mcp-graph-workflow/mcp-graph

# Windows — abrir PowerShell como Administrador
npm install -g @mcp-graph-workflow/mcp-graph
```

### Versão errada após install

**Causa:** múltiplos `node`/`npm` no sistema (nvm, fnm, asdf...).

```bash
which mcp-graph         # Confere de onde está vindo o bin
mcp-graph -V            # Confirma versão real
node -v                 # Confere versão do Node ativa
```

Se a versão está antiga, force a reinstalação:

```bash
npm uninstall -g @mcp-graph-workflow/mcp-graph
npm install -g @mcp-graph-workflow/mcp-graph@latest
```

---

## CLI

### `mcp-graph: command not found`

**Causa:** o pacote não está instalado globalmente.

```bash
npm install -g @mcp-graph-workflow/mcp-graph

# Verificar
mcp-graph --version           # 12.x.x
```

A partir de v12, um único pacote (`@mcp-graph-workflow/mcp-graph`) traz todos os 24 subcomandos: setup (init, doctor, serve, import) + lifecycle (start, finish, next, hooks, ui, demo, login, set-phase, ...). Veja `mcp-graph --help`.

### Erro: `parent runtime not found`

**Sintoma:** `mcp-graph --version` funciona mas `mcp-graph init` falha com `parent runtime not found`.

**Causa:** o pacote `@mcp-graph-workflow/mcp-graph` (parent runtime) não está instalado.

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

Em monorepo de dev: build do parent primeiro (`npm --prefix path/to/parent run build`) e setar `MG_PARENT_DIST=/abs/path/to/dist`.

### Aviso "numerical-convergence" no `mcp-graph start` (capability gate)

**Sintoma:** ao começar uma task, aparece um warning como `capability gate: numerical-convergence`.

**Causa:** o gate detectou que a task envolve otimização numérica / calibração de ML — área onde modelos rápidos (ex: Haiku) historicamente erram. É **advisory**, não bloqueia.

**O que fazer:**
- **Sonnet/Opus**: ignore o aviso, esses modelos lidam bem com o tipo de task.
- **Haiku**: considere trocar pra Sonnet 4.6+ pra essa task específica, ou aceitar o risco e seguir.
- **Desligar o aviso por completo**: `mcp-graph set-phase IMPLEMENT --code-intel advisory` (vira advisory) ou `--code-intel off`.

> O gate é opcionado em duas dimensões: tipo da task (estrutura/CRUD/REST → "World 1", seguro pra qualquer modelo) e tipo de teste (otimização numérica → "World 2", exige modelo capaz). É o teste que decide o fit do modelo, não o modelo em si.

### Hooks instalados mas não disparam

**Sintoma:** rodou `mcp-graph hooks install --profile balanced` mas Claude Code não exibe o banner em SessionStart, ou os hooks não rodam em edits.

**Diagnóstico em ordem:**

```bash
# 1. Confirmar status
mcp-graph hooks status

# 2. Conferir que o arquivo foi escrito
cat .claude/settings.local.json | grep -A2 SessionStart

# 3. Conferir env var de off
echo $MCP_GRAPH_HOOKS_OFF      # se "1", desligado intencionalmente — limpe: unset MCP_GRAPH_HOOKS_OFF

# 4. Logs estruturados
mcp-graph log --tail
# ou diretamente
tail -f ~/.mcp-graph/logs/hooks.jsonl
```

**Causas comuns:**
- Claude Code precisa **reabrir** a sessão depois de instalar hooks novos
- `.claude/settings.local.json` está em `.gitignore` mas escrito em outro pasta — confirme que rodou `mcp-graph hooks install` no root do projeto, não em subpasta
- `MCP_GRAPH_HOOKS_OFF=1` está exportado no shell profile (`.zshrc`/`.bashrc`)

**Fix universal:** `mcp-graph hooks uninstall && mcp-graph hooks install --profile balanced` e reabra Claude Code.

---

## Servidor

### Porta 3000 já está em uso

**Sintoma:** `Error: listen EADDRINUSE: address already in use :::3000`

**Causa:** outro processo ocupando a porta (outro `mcp-graph serve`, dashboard, ou app local).

```bash
# Opção A — usar outra porta
npx mcp-graph serve --port 3001

# Opção B — encontrar e matar o processo (Linux/macOS)
lsof -i :3000
kill -9 <PID>

# Opção B — Windows (PowerShell)
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
Stop-Process -Id <PID> -Force
```

### Servidor sobe mas comandos `/graph-*` não funcionam

**Sintoma:** Copilot CLI responde sem invocar nenhum tool MCP.

**Causa:** Copilot não está conectado ao servidor mcp-graph (config `.mcp.json` ou `.vscode/mcp.json` faltando/incorreta).

```bash
# Verificar config
cat .vscode/mcp.json    # ou .mcp.json

# Se faltando, recriar
npx mcp-graph init      # wizard reescreve a integração

# No Copilot CLI, testar:
copilot
> /graph-analyze test
# Se nada acontece, reinicie o copilot e o serve.
```

### Servidor crasha no boot

**Sintoma:** `Error: SQLITE_CORRUPT` ou stack trace na inicialização.

**Causa:** SQLite WAL inconsistente (provavelmente após crash anterior ou kill -9).

```bash
# Backup do DB
cp workflow-graph/graph.db workflow-graph/graph.db.backup

# Limpar WAL/journal stuck
rm -f workflow-graph/graph.db-journal workflow-graph/graph.db-wal workflow-graph/graph.db-shm

# Testar
npx mcp-graph serve --port 3000
```

Se persistir:

```bash
# Recriar DB do zero (perde histórico do graph!)
mv workflow-graph workflow-graph.broken
npx mcp-graph init
```

---

## Copilot CLI

### `copilot: command not found`

**Causa:** GitHub Copilot CLI não instalado ou não autenticado.

```bash
# Instalar (consultar docs oficiais do GitHub para sua plataforma)
# https://docs.github.com/en/copilot/github-copilot-in-the-cli

# Após instalar, autenticar
gh auth login
copilot
```

### `/graph-analyze`/`/graph-design` etc. não aparecem como sugestão

**Causa:** skills do mcp-graph não foram instaladas no projeto.

```bash
# Recriar skills via init (default ativa Copilot integration)
npx mcp-graph init

# Verificar
ls .agents/skills/ | grep graph-

# Reabrir o copilot CLI
copilot
```

### Context window exceeded no Copilot

**Sintoma:** Copilot avisa que o contexto excedeu, ou respostas ficam incoerentes.

**Causa:** sessão muito longa sem compactação.

No Copilot CLI:
```
> /context compact
```

Ou via tool MCP:
```
> use mcp-graph context with mode=compact
```

---

## Workflow / Gates

### Gate da fase não passa (transição PLAN→IMPLEMENT bloqueada)

**Sintoma:** `/graph-plan valide se podemos avançar` retorna `gate failed: 5/7`.

**Causa:** alguns dos 7 checks de readiness ainda não satisfeitos (geralmente: tasks sem AC, ciclos no graph, stack docs desatualizadas).

```
# No Copilot CLI, pedir relatório detalhado
> /graph-plan mostre quais gates falharam e por quê

# Resolver os gates específicos antes de tentar de novo
# Exemplos comuns:
# - sem ciclos no graph: ajustar edges
# - todas tasks têm AC: rodar /graph-analyze para tasks órfãs
# - stack docs sincronizadas: rodar mcp-graph reindex
```

### Skills do agent ignoram fase atual

**Causa:** Code Intelligence index stale ou phase override incorreto.

```bash
# Reindexar
mcp-graph reindex

# No Copilot CLI, forçar fase explícita
> use mcp-graph set_phase with phase=PLAN
```

---

## Git / Branches (multi-agent)

### Shadow branch stuck (estou em `ai-shadow/...` sem saber como sair)

**Causa:** o sistema de autopilot do mcp-graph criou um branch shadow durante operação. Trabalho está preservado.

```bash
# Ver onde está
git branch --show-current

# Ver o que está pendente
git status --short
git stash list

# Voltar para master sem perder trabalho
git stash push -u -m "WIP rescue $(date +%s)"
git checkout master
git pull origin master

# Recuperar trabalho stashed depois (em branch dedicada)
git checkout -b dx/my-work
git stash pop
```

### Múltiplos agents commitando no mesmo branch

**Sintoma:** conflitos surgindo ao fazer `git pull`.

**Mitigação:** cada agent deve trabalhar em branch dedicado (`dx/<feature>`, `bugfix/<id>`). Antes de iniciar trabalho:

```bash
git checkout master && git pull
git checkout -b dx/<minha-feature>-<data>
```

---

## Performance

### CLI demora >1s para responder a `--help`

**Sintoma:** cold start lento.

**Diagnóstico:**

```bash
node scripts/perf/measure.mjs --runs=5
```

Compara com baseline em `scripts/perf/perf-baseline.json`. Se regressão >10%, investigar mudanças recentes em `src/cli/index.ts` ou no MCP server boot path.

### `npm install -g` puxa centenas de MB

**Causa esperada (atual):** dependências opcionais de tree-sitter (parsers C, C++, Swift, etc.) e OCR (tesseract.js, pdfjs-dist) somam ~600MB.

**Mitigação até T2.12 (extras package):**

```bash
# Instalar sem opcionais (perde Code Intelligence multi-linguagem)
npm install -g @mcp-graph-workflow/mcp-graph --omit=optional
```

---

## Onde pedir ajuda

- 🐛 Bugs: <https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues>
- 💬 Dúvidas de uso: <https://github.com/DiegoNogueiraDev/mcp-graph-workflow/discussions>
- 📖 Guia completo: [GUIDE.md](./GUIDE.md)
- 🔖 Cheat sheet: [CHEATSHEET.md](./CHEATSHEET.md)
