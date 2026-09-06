# Revisão de segurança

## Evidências executadas

- `npm audit --omit=dev --audit-level=high`: nenhuma vulnerabilidade de produção encontrada em 6 de setembro de 2026.
- Testes de contrato exercitam autenticação, cookie `httpOnly`, CSRF, origem confiável, limites de PDF e escopo de organização.
- O retrieval pgvector é testado contra fonte `INTERNAL`, organização divergente e fonte inativa.
- A avaliação RAG inclui tentativa de prompt injection e exige contexto tratado como dado não confiável.

## Controles atuais

- Sessões de atendente e anônimas são resolvidas no servidor.
- Operações mutáveis autenticadas exigem CSRF e origem confiável.
- Tickets exigem confirmação explícita e chave de idempotência.
- API e web enviam headers defensivos; a web aplica CSP.
- Logs e metadados de execução preservam correlação, sem cookies, prompts secretos ou conteúdo completo.

## Pendências para produção

Uma revisão independente de segurança ainda deve validar configuração de produção, proxy/TLS, secret manager, políticas de retenção aprovadas e o adaptador de armazenamento de objetos. Essa revisão não pode ser substituída por testes automatizados locais.
