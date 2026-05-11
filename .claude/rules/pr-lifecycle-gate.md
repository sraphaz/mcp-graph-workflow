/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

# PR Lifecycle Gate — Obrigatório antes de avançar para a próxima task/epic

Nenhuma nova implementação começa antes que o PR corrente tenha completado o ciclo completo abaixo.
Viola o princípio Little's Law (WIP = 1): PR aberto = work in progress não finalizado.

## Ciclo obrigatório

```
1. push branch       → git push origin <branch>
2. CI green          → todos os checks passam (build, typecheck, tests, lint)
3. version bump      → release-please cria PR de bump OU o merge no master
                       aciona o bump automaticamente
4. merge + delete    → PR merged (squash), branch deletada local + remota
5. git pull master   → base atualizada
6. start_task next   → só então: próxima task/epic
```

## Regras

- **Nunca abrir nova branch enquanto há PR aberto com CI pendente ou falhando.**
- **Push manual obrigatório** — o hook `block-dangerous-git.sh` bloqueia `git push`
  de dentro do Claude Code; o usuário deve rodar `git push` no terminal (ou `! git push`
  no prompt do Claude Code).
- **CI verde = pré-requisito.** Se CI falha, investigar se é regressão introduzida
  (fix obrigatório) ou pre-existing no master (documentar, não bloquear).
- **Version bump** — release-please gerencia automaticamente após merge no master.
  Não publicar manualmente (`infra_npm_publish_pipeline.md`). Confirmar que o
  release PR foi criado ou que o bump aparece no CHANGELOG antes de prosseguir.
- **Branch cleanup** — após merge: `git branch -d <branch>` local +
  `git push origin --delete <branch>` remoto (ou via GitHub UI).

## Como verificar

```bash
# 1. CI status do PR
gh pr checks <PR_NUMBER>

# 2. Release-please PR (version bump)
gh pr list --label "autorelease: pending"

# 3. Branch limpa após merge
git branch | grep -v master
git branch -r | grep -v "master\|HEAD\|ai-shadow\|dependabot\|release-please"
```

## Por que

Derivado de git-workflow.md Rule 1 (Epic Branch Lifecycle) + observação de sessão
2026-05-11: branch com 9 commits ficou sem push enquanto nova task era puxada,
causando drift entre grafo e estado real do repositório.

**Why:** PRs não-merged = WIP = cycle time inflado = qualidade do fluxo degradada.
Versão bump confirma que o trabalho chegou ao produto — sem bump, o feature não
existe para os usuários.

**How to apply:** Ao receber `finish_task` com `epicPromotion` ou ao completar a
última task de um epic, parar e executar o ciclo completo acima antes de chamar
`start_task` para a próxima.
