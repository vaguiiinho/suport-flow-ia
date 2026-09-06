# ADR 0002 — Autenticação e sessões

## Status

Aceito em 30 de agosto de 2026.

## Contexto

Atendentes acessam conhecimento interno, uploads e operação de tickets. Clientes precisam iniciar conversas sem criar conta. JWT armazenado no navegador ampliaria a superfície de vazamento e dificultaria revogação de sessões administrativas.

## Decisão

Atendentes usarão e-mail e senha com hash forte. Após autenticação, a API criará uma sessão opaca persistida no banco e enviará somente seu identificador de alta entropia em cookie `httpOnly`.

O cookie administrativo será `Secure` em produção, terá `SameSite` apropriado, escopo restrito e expiração. O valor persistido será protegido para que um vazamento do banco não produza uma sessão utilizável. Logout e bloqueio de usuário revogarão sessões ativas. Mutações autenticadas terão proteção CSRF e login terá limitação de tentativas.

Clientes usarão uma sessão anônima distinta, também opaca, vinculada no servidor a `Conversation` e `organizationId`. Essa sessão não concede acesso ao painel nem aceita organização escolhida pelo cliente.

## Alternativas consideradas

- JWT em `localStorage`: simples de consumir, mas expõe o token a scripts e dificulta revogação imediata.
- JWT em cookie: reduz exposição ao JavaScript, porém ainda adiciona rotação e revogação sem necessidade no MVP.
- Conta obrigatória para clientes: melhora identidade, mas cria fricção e amplia o escopo.
- Autenticação terceirizada: útil futuramente, mas desnecessária para uma organização padrão.

## Consequências

- A API precisa persistir, expirar e revogar sessões.
- Todas as decisões de autorização permanecem no servidor.
- Cookies exigem tratamento explícito de CSRF, origem e ambiente HTTPS.
- A sessão anônima deve usar endpoints e permissões diferentes da sessão do atendente.
- Uma futura federação de identidade poderá substituir o login sem alterar as regras do domínio.
