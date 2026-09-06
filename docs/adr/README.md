# Registros de Decisão Arquitetural

Este diretório registra decisões relevantes do SupportFlow AI que afetam mais de um componente, criam restrições duradouras ou exigiriam migração para serem alteradas.

## Convenção

- Arquivos usam numeração sequencial e nome descritivo.
- Cada ADR registra status, contexto, decisão, alternativas e consequências.
- Uma decisão aceita não é reescrita para representar uma nova escolha; outro ADR deve substituí-la.
- O código e a documentação devem apontar divergências entre decisão aceita e implementação real.

## Decisões aceitas

- [`0001-stack-e-topologia-do-monorepo.md`](0001-stack-e-topologia-do-monorepo.md): stack, aplicações e dependências principais.
- [`0002-autenticacao-e-sessoes.md`](0002-autenticacao-e-sessoes.md): autenticação de atendentes e sessões anônimas.
- [`0003-isolamento-de-organizacao-e-fontes.md`](0003-isolamento-de-organizacao-e-fontes.md): organização, visibilidade e autorização de conhecimento.
- [`0004-jobs-persistentes-de-ingestao.md`](0004-jobs-persistentes-de-ingestao.md): fila inicial baseada em PostgreSQL.
- [`0005-portas-de-ia-e-adaptador-openai.md`](0005-portas-de-ia-e-adaptador-openai.md): desacoplamento dos provedores de chat e embeddings.
- [`0006-organizacao-padrao-e-evolucao-multitenant.md`](0006-organizacao-padrao-e-evolucao-multitenant.md): preparação estrutural para multi-tenant sem ativá-lo no MVP.
