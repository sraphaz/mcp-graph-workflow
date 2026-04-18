# Formulário e-INPI — Cadastro do Programa de Computador

Valores pré-preenchidos para copiar direto no formulário eletrônico
em https://www.gov.br/inpi (Registro de Programa de Computador →
Novo Pedido).

Os campos marcados com `[PREENCHER]` dependem de decisão ou dado que
só o titular tem. Os demais já estão prontos.

---

## 1. Dados do Titular

| Campo | Valor |
|-------|-------|
| Tipo de titular | Pessoa Física |
| Nome completo | Diego Lima Nogueira de Paula |
| CPF | `[PREENCHER]` |
| RG / Órgão Emissor | `[PREENCHER]` |
| Endereço residencial | `[PREENCHER]` |
| E-mail | devnogueiradiego@gmail.com |
| Telefone | `[PREENCHER]` |
| Nacionalidade | Brasileira |

> Se optar por registrar em nome da UNOPAR, trocar o tipo para
> "Pessoa Jurídica" e preencher CNPJ + endereço institucional.
> Nesse caso, pedir ao coordenador do programa de pós-graduação a
> emissão de Termo de Cessão de Titularidade assinado pelo autor.

## 2. Dados do Autor (obrigatório mesmo quando titular é PJ)

| Campo | Valor |
|-------|-------|
| Nome completo | Diego Lima Nogueira de Paula |
| CPF | `[PREENCHER — mesmo que o do titular]` |
| Nacionalidade | Brasileira |
| Vínculo acadêmico | Mestrando em Engenharia da Computação — UNOPAR (Universidade Norte do Paraná) |

## 3. Dados do Programa

| Campo | Valor |
|-------|-------|
| Título do programa | MCP Graph Workflow |
| Título alternativo / comercial | mcp-graph |
| Ano de criação | 2025 |
| Data de primeira publicação | 2026-03-09 (abertura do repositório público) |
| Tipo de programa | Aplicativo / ferramenta de linha de comando |
| Natureza | Derivada (baseada no Model Context Protocol da Anthropic, licença MIT) |

> "Derivada" aqui é no sentido de "baseada em biblioteca/protocolo
> MIT pré-existente", não de "fork de outro programa". O INPI aceita
> essa categorização e é a mais honesta tecnicamente.

## 4. Classificações obrigatórias

### 4.1. Linguagem(ns) de programação

- TypeScript (linguagem principal — ~90% do código)
- JavaScript (scripts de build e benchmark)
- SQL (migrações SQLite)

### 4.2. Plataforma(s) de execução

- Node.js ≥ 18 (plataforma primária)
- Sistemas operacionais: Linux, macOS, Windows (portabilidade via
  Node)
- Integração com Model Context Protocol (MCP) 2025-06-18

### 4.3. Campo de aplicação / Objetivo

Ferramenta local-first para **orquestração de desenvolvimento de
software assistido por agentes de inteligência artificial**. Converte
documentos de requisitos (PRD) em grafos de execução persistentes
em SQLite, integra pipeline de Retrieval-Augmented Generation (RAG),
e coordena múltiplos agentes de IA através do Model Context Protocol.

## 5. Resumo do programa

Ver [`RESUMO-tecnico.md`](RESUMO-tecnico.md). Copiar o conteúdo
integral no campo "Descrição Funcional" do e-INPI (máx. 8000
caracteres, se exceder, cortar na seção "Implementação").

## 6. Documentação técnica

| Documento | Arquivo | Tamanho aprox. |
|-----------|---------|----------------|
| Formulário preenchido | Este arquivo (em PDF) | ~3 páginas |
| Declaração de autoria | `DECLARACAO-autoria.md` (em PDF assinado) | ~1 página |
| Resumo técnico | `RESUMO-tecnico.md` (em PDF) | ~4 páginas |
| Amostra do código-fonte | Gerar via `gerar-amostra-codigo.sh` | ~40 páginas |

Converter tudo para PDF antes do upload. Exemplo:

```bash
pandoc FORM-cadastro-programa.md -o form-cadastro.pdf
pandoc DECLARACAO-autoria.md -o declaracao.pdf
pandoc RESUMO-tecnico.md -o resumo-tecnico.pdf
```

## 7. Hash do código-fonte (obrigatório na declaração)

Gerar ANTES de submeter, registrar na Declaração de Autoria:

```bash
cd /caminho/para/o/repo
git archive --format=tar HEAD | sha512sum
```

O valor tem que bater com o estado do repo na data do protocolo.
Se o repo mudar depois, o hash depositado continua válido para
aquela data — representa o "snapshot" registrado.

## 8. GRU (Guia de Recolhimento da União)

| Campo | Valor |
|-------|-------|
| Código do serviço | 241 (Registro de Programa de Computador) |
| Beneficiário | INPI |
| Valor | R$ 140,00 (pessoa física) |
| Validade da GRU | 60 dias |

Gerada em https://www.gov.br/inpi → "Pagamento de GRU". Anexar o
comprovante pago ao processo.

## 9. Protocolo

Após tudo no carrinho do e-INPI:

1. Revisar — qualquer rejeição por erro formal custa nova GRU.
2. Submeter.
3. Guardar o **número do processo** (formato BR51 202Z XXXXXX X) e
   a **data do protocolo**.
4. A partir desse momento, pode citar o pedido em CV Lattes, em
   publicações, em README.

## Campos opcionais úteis

- **Palavras-chave**: agentic AI, Model Context Protocol, task graph,
  PRD, RAG, SQLite, local-first, multi-agent orchestration, anti-vibe
  coding, harnessability.
- **URL de referência**: https://github.com/DiegoNogueiraDev/mcp-graph-workflow
- **Publicação associada** (quando o preprint sair): arXiv:XXXX.XXXXX
