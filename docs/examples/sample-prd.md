# PRD: Login de Usuário

## Epic: Autenticação por Email e Senha

Permitir que usuários cadastrados façam login com email + senha e iniciem uma sessão autenticada de 24 horas. Implementar o fluxo completo: tela, endpoint, persistência da sessão e proteção contra força bruta.

### Task: Endpoint POST /auth/login

Recebe `{ email, senha }`, valida credenciais contra o banco, retorna token JWT e define cookie httpOnly. Rate-limited por IP a 5 tentativas por minuto.

### Task: Tela de login (frontend)

Formulário com campos email e senha, validação client-side básica de formato, exibe mensagem genérica em caso de erro (não confirma se o email existe).

### Task: Bloqueio após falhas consecutivas

Após 3 senhas erradas seguidas, conta é bloqueada por 15 minutos e usuário recebe email avisando da tentativa.

## Requirements

- Hash de senha com bcrypt (cost factor 12)
- JWT em cookie httpOnly, marcado Secure e SameSite=Strict
- Rate limiting de 5 tentativas por minuto por IP
- Mensagens de erro genéricas — nunca revelar se o email existe
- Token expira em 24 horas, renovado em cada request autenticado

## Constraints

- Não usar localStorage para token (risco de XSS)
- Não logar senhas em plaintext em nenhum nível, incluindo logs de erro
- Compatível com navegadores modernos (últimas duas versões de Chrome, Firefox, Safari, Edge)
