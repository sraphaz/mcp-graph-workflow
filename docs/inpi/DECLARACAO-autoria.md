# DECLARAÇÃO DE AUTORIA E TITULARIDADE

**Programa de Computador:** MCP Graph Workflow (mcp-graph)

---

Eu, **Diego Lima Nogueira de Paula**, brasileiro, portador do CPF
`[PREENCHER]` e RG `[PREENCHER]` (`[órgão emissor]`), residente e
domiciliado em `[ENDEREÇO]`, **DECLARO**, sob as penas da lei, que:

## 1. Autoria

Sou o **único autor** do programa de computador denominado
**MCP Graph Workflow** (nome curto: `mcp-graph`), desenvolvido de
forma independente no contexto da minha pesquisa de mestrado no
**Programa de Pós-Graduação em Engenharia da Computação da
Universidade Norte do Paraná (UNOPAR)**, em andamento desde o
ano de 2025.

A pesquisa teve início em caráter privado em **2025**; a
**divulgação pública** do código-fonte e da documentação ocorreu
em **9 de março de 2026** através do repositório público
https://github.com/DiegoNogueiraDev/mcp-graph-workflow.

## 2. Titularidade

Declaro ser o **único titular** dos direitos patrimoniais sobre o
programa, nos termos dos artigos 3º, 4º e 6º da Lei 9.609/1998.

Não há cessão, licenciamento exclusivo ou outra forma de
transferência de titularidade para terceiros. A licença de uso
pública do software é **MIT License** (permissiva), conforme
arquivo `LICENSE` disponível no repositório público. A licença MIT
concede direitos de uso, modificação e redistribuição, mas **não
transfere titularidade** — a titularidade permanece com o autor.

## 3. Originalidade

O programa foi desenvolvido a partir de pesquisa e implementação
próprias. Utiliza bibliotecas de terceiros sob licenças permissivas
compatíveis (MIT, Apache 2.0, ISC), devidamente reconhecidas nos
arquivos `package.json` e `package-lock.json` do repositório.

Nenhuma parte do código foi copiada ou derivada diretamente de
outros programas sem atribuição apropriada.

## 4. Contribuições metodológicas originais

Os seguintes conceitos, métodos e implementações são **contribuições
originais do autor**, fruto da pesquisa de mestrado, e estão
embutidos no programa:

- **Harnessability Score** — métrica composta de sete dimensões
  (0–100) para medir o grau em que uma base de código está
  estruturada para uso efetivo por agentes de inteligência
  artificial.
- **Anti-Vibe-Coding** — metodologia de desenvolvimento em nove
  fases com phase gates determinísticos, combinando disciplina
  XP/TDD com execução ancorada em grafo persistente.
- **Task Readiness Score + Model Router** — função composta de
  cinco sinais que seleciona dinamicamente o modelo de linguagem
  mais econômico capaz de executar uma tarefa atômica, com
  arquitetura de daemon compartilhado para redução de uso de
  memória.
- **Pipeline de nove fases** (ANALYZE → DESIGN → PLAN → IMPLEMENT
  → VALIDATE → REVIEW → HANDOFF → DEPLOY → LISTENING) com
  Definition of Ready (7 checks) e Definition of Done (8 checks)
  aplicáveis ao trabalho de agentes de IA.

Esses conceitos são documentados de forma detalhada nos arquivos:

- `NOTICE.md` — declaração formal de autoria das contribuições
- `docs/architecture/adrs/ADR-001-model-router.md` — decisão
  arquitetural do Model Router
- `docs/guides/HARNESS-ENGINEERING.md` — guia completo da métrica
- `CLAUDE.md` — especificação evolutiva da metodologia

## 5. Hash de integridade do código depositado

O conteúdo do código-fonte depositado neste registro corresponde
ao estado do repositório identificado pelo seguinte hash SHA-512
do tarball do commit `[PREENCHER — SHA do commit HEAD no momento
do protocolo]`:

```
SHA-512: [PREENCHER — gerar com:
         git archive --format=tar HEAD | sha512sum]
```

Qualquer alteração posterior ao código-fonte não invalida o
registro, que se refere especificamente à versão identificada pelo
hash acima.

## 6. Declaração de veracidade

Declaro, sob as penas da lei, que todas as informações acima são
verdadeiras e que assumo total responsabilidade por seu conteúdo.

---

**Local e data:** `[CIDADE]`, `[DATA POR EXTENSO]`.

---

_______________________________________________

**Diego Lima Nogueira de Paula**

CPF: `[PREENCHER]`

E-mail: devnogueiradiego@gmail.com

GitHub: https://github.com/DiegoNogueiraDev

---

**Instruções para assinatura e protocolo:**

1. Preencher os campos marcados `[PREENCHER]`.
2. Gerar o hash SHA-512 do tarball:
   ```bash
   git archive --format=tar HEAD | sha512sum
   ```
3. Preencher o hash na seção 5 e anotar o SHA do commit HEAD.
4. Assinar digitalmente com certificado ICP-Brasil (preferível) ou
   imprimir, assinar à caneta, e digitalizar.
5. Converter para PDF:
   ```bash
   pandoc DECLARACAO-autoria.md -o declaracao-assinada.pdf
   ```
6. Anexar ao protocolo no e-INPI junto com o formulário de cadastro,
   o resumo técnico, e a amostra do código-fonte.
