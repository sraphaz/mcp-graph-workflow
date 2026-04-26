# Migração: `mg` → `mcp-graph`

> **TL;DR**: o comando `mg` está sendo descontinuado. Use `mcp-graph <subcomando>` no lugar. Mesmos handlers, mesmo comportamento — só o nome muda.

## Por que estamos removendo `mg`

Dois problemas técnicos justificam a unificação sob `mcp-graph`:

1. **Conflito no macOS** — `/usr/bin/mg` é o editor **MicroEmacs**, pré-instalado em todo macOS moderno. Quem digita `mg` esperando o nosso CLI cai no editor — UX confusa, especialmente pra novos usuários.
2. **EEXIST no install** — os dois pacotes (`@mcp-graph-workflow/mcp-graph` e `@mcp-graph-workflow/cli`) reivindicam o mesmo bin `mcp-graph`, causando erro de instalação. A unificação resolve essa colisão.

A v12.0 marca a unificação completa: um único bin `mcp-graph` com todos os 24 subcomandos (8 do servidor v10 + 16 do CLI v11).

## Timeline

| Versão | O que muda | Estado |
|---|---|---|
| **v11.2.0-beta.0** | Status atual: `mg` e `mcp-graph` (do cli) coexistem | ✅ Live |
| **v11.3.0-beta.0** | `mg` printa deprecation banner | 🚧 Esta release |
| **v12.0.0** | `mg` **removido**. Só `mcp-graph` funciona | 🔮 Planejada |

A janela entre v11.3.0-beta e v12.0 dá pelo menos um ciclo de release pra você migrar scripts/CI/aliases.

## Mapeamento 1-pra-1

Todos os subcomandos têm equivalente direto. **Apenas o prefixo do comando muda.**

| Antes | Depois |
|---|---|
| `mg init` | `mcp-graph init` |
| `mg start <id>` | `mcp-graph start <id>` |
| `mg finish` | `mcp-graph finish` |
| `mg next` | `mcp-graph next` |
| `mg list` | `mcp-graph list` |
| `mg status` | `mcp-graph status` |
| `mg add task --title "..."` | `mcp-graph add task --title "..."` |
| `mg hooks install --profile balanced` | `mcp-graph hooks install --profile balanced` |
| `mg hooks status` | `mcp-graph hooks status` |
| `mg ui` | `mcp-graph ui` |
| `mg demo` | `mcp-graph demo` |
| `mg login` | `mcp-graph login` |
| `mg set-phase IMPLEMENT` | `mcp-graph set-phase IMPLEMENT` |
| `mg lang en` | `mcp-graph lang en` |
| `mg config sync` | `mcp-graph config sync` |
| `mg log` | `mcp-graph log` |
| `mg harness` | `mcp-graph harness` |
| `mg` (REPL) | `mcp-graph repl` |
| `mg --version` | `mcp-graph --version` |
| `mg --help` | `mcp-graph --help` |

## Como atualizar seus scripts

### Bash / zsh

```bash
# Buscar usos de mg em scripts
grep -rn '\bmg\b' ~/scripts/ ~/dotfiles/ 2>/dev/null

# Substituir em massa (revise antes de aceitar):
sed -i '' 's/\bmg \([a-z]\)/mcp-graph \1/g' arquivo.sh
```

### CI (GitHub Actions, GitLab CI, etc.)

```yaml
# Antes
- run: mg init && mg add task --title "$TITLE"

# Depois
- run: mcp-graph init && mcp-graph add task --title "$TITLE"
```

### Aliases pessoais (~/.zshrc, ~/.bashrc)

Se você criou um alias `mg=...` (ex: pra resolver o conflito MicroEmacs no macOS), pode remover:

```bash
# Remova qualquer linha tipo:
alias mg="/opt/homebrew/bin/mg"
# Não precisa mais: o conflito desaparece quando v12 tira o bin mg
```

### Skills do Claude Code (`.claude/skills/`)

Os skill files que `mcp-graph init` instala referem `mg` no corpo. Re-rode o init pra atualizar:

```bash
mcp-graph init --force
```

Isso reescreve `.claude/skills/*.md` com `mcp-graph` no lugar de `mg`.

## Silenciar o banner

Se você precisa de `mg` rodando até v12 (ex: CI antigo que ainda não foi migrado), exporte:

```bash
export MG_NO_DEPRECATION_WARNING=1
```

Recomendamos **não silenciar** — o banner é seu lembrete de migrar. Use só em ambientes onde a saída em stderr quebraria pipelines.

## FAQ

### "Tenho `mg` no PATH apontando pra mcp-graph CLI. Funciona ainda?"

Sim, até v12.0. Daí em diante o bin `mg` deixa de existir — o comando vira `command not found`.

### "Preciso reinstalar alguma coisa?"

Em v11.3.0-beta, **não**. O CLI v11 (`@mcp-graph-workflow/cli@beta`) continua funcionando com os dois nomes (`mg` e `mcp-graph`). O banner é só notificação.

Em v12.0, sim — `npm install -g @mcp-graph-workflow/mcp-graph@12` vai instalar o pacote unificado, e o pacote `@mcp-graph-workflow/cli` será deprecado no npm.

### "Tenho documentação interna usando `mg`. O que faço?"

Atualize quando tiver oportunidade. Não tem urgência até v12.0. O mapeamento acima cobre 100% dos casos.

### "E se eu quiser adiantar a migração agora?"

Já dá. Use `mcp-graph` no lugar de `mg` em tudo — todos os subcomandos já existem desde v11.0.0-beta sob o nome `mcp-graph`. O banner é só pra quem ainda usa o nome curto.

## Próximos passos

- Após v12.0 ship: este doc continua aqui como referência histórica
- Issues sobre a migração: <https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues>
- CHANGELOG da v12: ver [CHANGELOG.md](../../CHANGELOG.md)
