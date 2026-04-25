# Documento de Requisitos de Produto
## Sistema de Gestão de Pedidos — Versão 2.0

**Elaborado por:** Gerência de Produto  
**Aprovado por:** Diretoria de Tecnologia  
**Data:** Abril 2026  
**Confidencialidade:** Interno

---

## 1. Objetivo

Modernizar o sistema legado de gestão de pedidos para suportar operações multicanal (web, mobile, API B2B), integração com ERP corporativo e rastreamento em tempo real de entregas.

---

## 2. Escopo

O escopo deste projeto contempla:

- Desenvolvimento de novo módulo de recepção de pedidos multicanal
- Integração bidirecional com ERP via API REST
- Dashboard operacional para equipe de logística
- Notificações automáticas para clientes via SMS e e-mail

---

## 3. Requisitos Funcionais

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-001 | O sistema deve aceitar pedidos via web, mobile e API B2B no mesmo fluxo unificado | Alta |
| RF-002 | Cada pedido deve receber número único rastreável | Alta |
| RF-003 | Integração com ERP deve sincronizar estoque em tempo real | Alta |
| RF-004 | O dashboard deve exibir pedidos por status em tempo real | Média |
| RF-005 | Clientes devem receber notificação em cada mudança de status | Média |
| RF-006 | Sistema deve suportar cancelamento com devolução automática ao estoque | Média |

---

## 4. Requisitos Não-Funcionais

- O sistema deve processar até 10.000 pedidos/hora sem degradação
- Disponibilidade mínima de 99,5% em horário comercial
- Tempo de resposta da API inferior a 300ms no percentil 95

---

## 5. Entregas e Marcos

### Marco 1 — Fundação (Sprint 1-3)

**Entregas:**
- Modelagem de domínio e esquema de banco de dados
- API REST de pedidos com autenticação JWT
- Integração ERP — módulo de estoque

**Critérios de Aceite:**
- API aceita payload de pedido e retorna ID único
- Estoque no ERP é decrementado em menos de 2 segundos
- Testes de integração cobrem fluxo completo de criação

### Marco 2 — Canais e Notificações (Sprint 4-6)

**Entregas:**
- Adaptadores para canais web, mobile e B2B
- Serviço de notificação (SMS + e-mail)
- Dashboard operacional v1

**Critérios de Aceite:**
- Pedido criado em qualquer canal aparece no dashboard em menos de 5 segundos
- Notificação entregue em até 30 segundos após mudança de status
- Dashboard suporta filtros por status, data e canal

---

## 6. Restrições

- O sistema legado não pode ser desativado durante a migração
- Budget técnico limitado a R$ 150.000 para licenças de software
- Prazo final de entrega: 6 meses a partir da aprovação

---

## 7. Riscos

- Risco: Complexidade da integração ERP pode exceder estimativa. Impacto: Alto. Probabilidade: Média.
- Risco: Indisponibilidade do fornecedor de SMS em picos de demanda. Impacto: Médio. Probabilidade: Baixa.
