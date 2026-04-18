# ORCID — setup e integração ao repositório

**ORCID** (Open Researcher and Contributor ID) é um identificador
persistente de 16 dígitos que distingue você de outros pesquisadores
com nome similar. É praticamente universal em submissões acadêmicas
(arXiv, Zenodo, PubMed, Crossref, periódicos, CNPq Lattes, etc.) —
uma vez criado, cola em você para sempre.

Grátis, 2 minutos para criar. Ligado ao `CITATION.cff` deste repo,
vira parte do registro canônico de autoria.

## Criar o ORCID

1. Acessar https://orcid.org/register
2. Preencher: nome completo (**Diego Lima Nogueira de Paula**),
   e-mail primário (devnogueiradiego@gmail.com — usar o mesmo do
   git e do GitHub para facilitar correlação), senha.
3. Confirmar e-mail.
4. Completar perfil:
   - **Employment / Educação:** adicionar UNOPAR — Universidade Norte
     do Paraná, Programa de Pós-Graduação em Engenharia da Computação.
   - **Biografia:** breve texto mencionando foco em agentic AI +
     engenharia de software.
   - **Visibilidade:** deixar pública (padrão). ORCID público é
     essencial para indexação.
5. Copiar o ID no formato `0000-0000-0000-0000` da URL
   `https://orcid.org/0000-XXXX-XXXX-XXXX`.

## Aplicar no repositório

Depois de gerar o ID, atualizar três pontos:

### 1. `CITATION.cff`

Descomentar e preencher a linha `orcid:`:

```yaml
authors:
  - family-names: "Lima Nogueira de Paula"
    given-names: "Diego"
    orcid: "https://orcid.org/0000-XXXX-XXXX-XXXX"  # ← preencher
    affiliation: >-
      UNOPAR — Universidade Norte do Paraná,
      Programa de Pós-Graduação em Engenharia da Computação
```

### 2. `NOTICE.md` (opcional mas recomendado)

Adicionar na seção Contact:

```markdown
## Contact

- GitHub: https://github.com/DiegoNogueiraDev
- ORCID: https://orcid.org/0000-XXXX-XXXX-XXXX
- Repository: https://github.com/DiegoNogueiraDev/mcp-graph-workflow
```

### 3. Conexão com GitHub (opcional, recomendado)

Em https://orcid.org → Account settings → Connect other accounts →
**GitHub**. ORCID passa a mostrar este repo automaticamente como uma
"works" no perfil. Reforça a cadeia de atribuição.

### 4. Preprint e Zenodo

Quando submeter o preprint no arXiv, informar o ORCID no formulário
de autores. O arXiv cria link bidirecional. O mesmo vale para o
Zenodo: na primeira release automática, já passa a metadata.

## Conexão com INPI

O formulário de registro do INPI Programa de Computador **não pede**
ORCID especificamente, mas o campo "E-mail" aceita o ORCID como URL
adicional no campo de observações. Pode anexar no final da declaração
de autoria.

## Nível de verificação no CITATION.cff

Uma vez o ORCID estiver no `CITATION.cff`, ferramentas como Zotero,
Mendeley, EndNote e Crossref puxam automaticamente o identificador
quando alguém cita o repo. Isso fecha o loop: citação automatizada
→ cita o ORCID → linka de volta ao seu perfil público.

## Checklist de 2 minutos

1. [ ] Criar ORCID em https://orcid.org/register
2. [ ] Confirmar e-mail
3. [ ] Adicionar Employment/Education (UNOPAR)
4. [ ] Conectar GitHub (opcional)
5. [ ] Copiar o ID
6. [ ] Abrir um PR:
       - Editar `CITATION.cff` descomentando linha `orcid:`
       - Editar `NOTICE.md` adicionando ORCID no contact
       - Commit + PR → merge
7. [ ] Pronto. Commits futuros + preprint + Zenodo + INPI ficam
       todos cross-linkados.

Me passa o ORCID quando tiver, aí eu já aplico as edições em um PR
dedicado.
