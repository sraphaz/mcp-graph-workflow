# Kit de Registro — INPI Programa de Computador

Este diretório reúne os artefatos necessários para o registro do
software **MCP Graph Workflow** no INPI (Instituto Nacional da
Propriedade Industrial) como **Programa de Computador**, conforme
a Lei 9.609/1998 e a Resolução INPI/PR nº 06/2013.

O registro no INPI complementa o DOI do Zenodo (registro
internacional) com um registro nacional formal e data certa.
Dá prova de autoria oponível a terceiros em território brasileiro.

## Visão geral do processo

1. **Preparar artefatos** (conteúdo deste diretório).
2. **Gerar hash do código-fonte** — o INPI exige um resumo digital
   (SHA-512) do conteúdo depositado.
3. **Gerar PDF com trechos do código-fonte** (primeiras e últimas
   páginas, conforme Resolução 06/2013) — o INPI não quer o código
   inteiro, apenas amostras suficientes para identificação.
4. **Pagar a GRU** — R$ 140 (pessoa física) a R$ 185 (pessoa jurídica)
   para o serviço de registro (código 241).
5. **Protocolar via e-INPI** em https://www.gov.br/inpi
   (login com conta gov.br nível ouro).
6. **Acompanhar** — INPI emite o certificado em 6–12 meses. O número
   do processo fica válido desde a data de protocolo.

## Artefatos neste diretório

- [`FORM-cadastro-programa.md`](FORM-cadastro-programa.md) —
  preenchimento guiado do formulário eletrônico (Cadastro do
  Programa de Computador). Cópia os valores direto para o e-INPI.
- [`DECLARACAO-autoria.md`](DECLARACAO-autoria.md) — Declaração de
  Autoria e Titularidade assinada pelo autor. Gerar PDF assinado
  digitalmente (ICP-Brasil) ou imprimir, assinar, escanear.
- [`RESUMO-tecnico.md`](RESUMO-tecnico.md) — Resumo técnico em
  português (500–1000 palavras) descrevendo finalidade, linguagem,
  plataforma, arquitetura. É a descrição oficial consultável.
- [`gerar-amostra-codigo.sh`](gerar-amostra-codigo.sh) — script que
  gera o PDF de amostra (primeiras 20 + últimas 20 páginas do código
  concatenado) exigido pelo INPI.

## Custos e prazos

| Item | Custo | Prazo |
|------|-------|-------|
| GRU — Código 241 (registro) | R$ 185 (PJ) / R$ 140 (PF) | — |
| e-Docs (certificado digital, opcional) | Gratuito se via gov.br | — |
| Protocolo no e-INPI | Gratuito | Mesmo dia |
| Análise e emissão do certificado | — | 6–12 meses |
| Validade | — | 50 anos a partir do ano seguinte ao depósito |

## Notas importantes

- O INPI **não** avalia conteúdo do código. Registra a existência e
  autoria na data do depósito. É prova de autoria oponível a terceiros,
  não certificação técnica.
- O hash SHA-512 do código-fonte depositado deve ser **idêntico** ao
  que aparecer na declaração. Qualquer alteração posterior pressupõe
  um novo depósito.
- A titularidade pode ser pessoa física (autor) ou jurídica (empresa,
  universidade). Para um projeto acadêmico, **pessoa física com vínculo
  declarado ao programa de pós-graduação** é o padrão mais direto.
- Após registrado, o número INPI pode ser citado em CV Lattes (item
  "Propriedade Intelectual → Software") e em dissertações/artigos
  derivados.

## Sequência prática

1. Ler e preencher `FORM-cadastro-programa.md`.
2. Executar `bash scripts/gerar-amostra-codigo.sh` (será criado se
   houver demanda) para produzir o PDF de amostra.
3. Gerar hash SHA-512 do tarball do código-fonte:
   ```bash
   git archive --format=tar HEAD | sha512sum
   ```
4. Preencher a declaração com o hash, assinar, digitalizar.
5. Acessar https://www.gov.br/inpi, ir em "Registro de Programa de
   Computador", upload dos 3 documentos (formulário, declaração,
   amostra-código), pagar GRU, protocolar.
6. Guardar o número de processo e a data de protocolo — essa é a
   data de autoria oficial no Brasil.

## Relação com as outras camadas de autoria

| Camada | Escopo | Ativação |
|--------|--------|----------|
| MIT License | Concede uso do código | Já em `LICENSE` |
| NOTICE.md + CITATION.cff | Pedido de citação acadêmica | Já ativo |
| Commit signing (SSH/GPG) | Integridade criptográfica dos commits | Já ativo |
| Zenodo DOI | Registro internacional com DOI permanente | Pendente primeira release |
| INPI Programa de Computador | Registro nacional com data certa | **Este kit** |
| Preprint arXiv | Registro científico indexado no Google Scholar | `docs/preprint/` |
| Marca "MCP Graph Workflow" (INPI NCL 9+42) | Proteção do nome | Opcional, ~R$ 710, 1 ano análise |

As camadas se reforçam. Nenhuma sozinha é suficiente; juntas formam
um caso praticamente inatacável de autoria.
