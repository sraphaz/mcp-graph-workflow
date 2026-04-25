/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Portuguese (Brazil) translations.
 *
 * Missing keys fall back to English (`en.ts`) at runtime — see `t()` in
 * `index.ts`. Keys here override the English defaults.
 */

export const ptBr: Record<string, string> = {
  // Common
  "common.untitled": "(sem título)",
  "common.tryAgain": "tente novamente",
  "common.run": "execute",
  "common.next": "próxima",

  // /init
  "init.success": "✔ mcp-graph inicializado",
  "init.projectLabel": "projeto: ",
  "init.typeLabel": "  ·  tipo: ",
  "init.ideLabel": "  ·  ide: ",
  "init.ideNone": "(nenhuma detectada)",
  "init.changesHeader": "alterações:",
  "init.nextStepsHeader": "próximos passos",

  // /next
  "next.title": "PRÓXIMA TAREFA",
  "next.acHeader": "critérios de aceitação",
  "next.acMore": "  …+{n} a mais",
  "next.startHint": "▸ inicie: ",
  "next.seeAll": "  ·  ver todas: ",
  "next.empty":
    "sem tarefas desbloqueadas. Execute `mg list --status backlog` para ver pendências, ou `mg add task` para adicionar.",

  // /list
  "list.header": "tarefas  ({shown}/{total} exibindo)",
  "list.empty": "nenhuma tarefa corresponde ao filtro atual.",
  "list.startHint": "▸ inicie uma: ",
  "list.filterLabel": "   ·   filtros: ",
  "list.moreHint": "…+{n} a mais — passe --limit {total} para exibir todas",

  // /start
  "start.started": "▶ INICIADA",
  "start.inProgress": "▶ EM PROGRESSO",
  "start.tddHeader": "checklist TDD",
  "start.tdd1": "escreva um teste falhando que capture o AC",
  "start.tdd2": "faça-o passar com a menor mudança possível",
  "start.tdd3": "refatore; suíte completa verde",
  "start.whenDone": "▸ ao concluir: ",

  // /finish
  "finish.success": "✔ concluída",
  "finish.nextHeader": "próxima",
  "finish.noMore":
    "sem mais tarefas desbloqueadas. execute `mg list` ou `mg add task`",

  // /add
  "add.created": "✔ {type} criado(a)",
  "add.startHint": "▸ inicie: ",

  // /status
  "status.progressLabel": "progresso: ",
  "status.inProgressHeader": "em progresso ({n})",
  "status.blockedHeader": "⛔ bloqueadas ({n})",
  "status.bridgeLabel": "auth bridge: ",
  "status.bridgeHint": "  (execute ",
  "status.graphUnavailable":
    "(grafo indisponível — execute `mg init` para iniciar)",

  // /demo
  "demo.ready": "✔ sandbox de demo pronto",
  "demo.locationLabel": "local: ",
  "demo.tryHeader": "experimente",
  "demo.cleanupHint":
    "ao concluir: rm -rf {path}   ·   ou execute mg demo --cleanup",

  // /lang
  "lang.current": "idioma: {lang}",
  "lang.changed": "✔ idioma → {lang}",
  "lang.persistedAt": "  salvo em {path}",
  "lang.unsupported":
    "idioma não suportado: {lang}\n  use um destes: {supported}",

  // /hooks
  "hooks.installed": "✔ hooks instalados  (perfil: {profile})",
  "hooks.uninstalled": "✔ hooks desinstalados",
  "hooks.empty":
    "nenhum hook do mcp-graph instalado neste projeto. execute `mg hooks install`",

  // /config
  "config.synced": "✔ configs sincronizadas  ({ides})",
  "config.inSync": "✔ todas as configs estão sincronizadas",
  "config.drift": "⚠ {n} arquivo(s) seriam alterados",
  "config.applyHint": "execute `mg config sync` para aplicar",

  // Errors
  "error.parentNotInstalled":
    "runtime do @mcp-graph-workflow/mcp-graph não encontrado. execute `mg init` primeiro ou instale: `npm install -g @mcp-graph-workflow/mcp-graph`",
  "error.bridgeNotFound":
    "Não foi possível localizar o bridge CLI do GitHub Copilot. Instale: `npm install -g @mcp-graph-workflow/bridge-cli`",
  "error.notInitialized":
    "Grafo não inicializado. Execute `mg init` para iniciar um projeto aqui.",
  "error.unknownCommand": "comando desconhecido: {cmd}",
  "error.didYouMean": "  você quis dizer: {hits}?",

  // /help shell layout
  "help.tagline": "CLI moderno para o MCP Graph Workflow",
  "help.usageHeader": "Uso:",
  "help.usage1": "  mg                       # entra no REPL com comandos /slash",
  "help.usage2": "  mg <comando> [args]      # modo shell one-shot",
  "help.commandsHeader": "Comandos:",
  "help.replHint":
    "Equivalentes slash no REPL (dentro de `mg`):  /init  /next  /help  /exit",
  "help.docsHint": "Docs: https://github.com/diegonogueira/mcp-graph-workflow",

  // Command descriptions (mg --help)
  "cmd.help.description":
    "Mostra todos os comandos. Passe uma busca para correspondência aproximada.",
  "cmd.exit.description": "Sai do REPL (no modo shell: sem efeito).",
  "cmd.version.description": "Imprime a versão do CLI + status do projeto.",
  "cmd.init.description":
    "Inicializa o mcp-graph neste projeto (assistente interativo).",
  "cmd.demo.description":
    "Tour de primeiro-valor sem config: projeto tmp + PRD de exemplo + dashboard.",
  "cmd.add.description":
    "Cria um nó no grafo (task, epic, decision, risk, …) — com proveniência.",
  "cmd.list.description":
    "Lista nós (padrão: tarefas acionáveis). Filtros por status/tipo/busca.",
  "cmd.next.description": "Mostra a próxima tarefa desbloqueada (cartão animado).",
  "cmd.start.description":
    "Inicia uma tarefa: status → in_progress, renderiza checklist TDD + AC.",
  "cmd.finish.description":
    "Conclui a tarefa em progresso: status → done, sugere a próxima.",
  "cmd.login.description":
    "Autentica no GitHub Copilot via device flow (ou importa do gh-copilot).",
  "cmd.ui.description":
    "Abre o dashboard (Express :3000). Envolve o comando serve do projeto pai.",
  "cmd.status.description":
    "Saúde do projeto em uma tela: tarefas, progresso do sprint, harness, auth bridge.",
  "cmd.config.description":
    "Gerencia configs de IDE/agente (sync .mcp.json, .vscode/, .cursor/, .claude/).",
  "cmd.hooks.description":
    "Instala / desinstala / status dos hooks do Claude Code (workflow sem intervenção).",
  "cmd.log.description":
    "Consulta logs estruturados (~/.mcp-graph/logs/*.jsonl). Filtros: --task --hook --trace --since.",
  "cmd.lang.description":
    "Alterna idioma do CLI (Inglês / Português-BR). Toggle, set, ou one-shot via --lang.",
  "cmd.harness.description":
    "Harness de navegador: list/start/stop/call/cdp/add via o módulo CDP do projeto pai.",
};
