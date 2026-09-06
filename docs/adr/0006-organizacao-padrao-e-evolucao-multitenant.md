# ADR 0006 — Organização padrão e evolução multi-tenant

## Status

Aceito em 30 de agosto de 2026.

## Contexto

O MVP será demonstrado por uma única empresa, mas há intenção explícita de permitir multi-tenant futuramente. Implementar onboarding, convites, cobrança e troca de contexto agora aumentaria o escopo; ignorar organização no schema criaria uma migração arriscada depois.

## Decisão

Criar `Organization` na primeira migration e provisionar uma organização padrão de forma idempotente no bootstrap ou seed controlado. Todos os dados de negócio serão associados a ela no servidor durante o MVP.

Interfaces públicas não receberão `organizationId` como fonte de autorização. O `OrganizationContext` virá:

- da sessão autenticada do atendente;
- da conversa anônima previamente criada;
- da fonte ou job já autorizado durante processamento assíncrono.

O MVP não terá cadastro de organizações, seletor de tenant, convites, papéis multi-organização, customização, quotas ou cobrança. A configuração de IA será global, mas os contratos não impedirão configuração por organização no futuro.

Uma futura ativação multi-tenant deverá adicionar gestão de organizações e associações de usuários, preservando IDs, propriedades e limites já existentes.

## Alternativas consideradas

- Não criar `Organization` no MVP: reduz uma tabela, mas obriga backfill e revisão ampla de unicidade, vetores, arquivos e jobs.
- Implementar multi-tenant completo agora: atende o futuro antecipadamente, mas desvia do valor principal do assistente.
- Usar apenas uma constante global sem entidade: não fornece integridade referencial nem caminho seguro de migração.
- Banco ou schema por tenant: isolamento forte, porém complexidade operacional incompatível com o MVP.

## Consequências

- O modelo e as portas carregam contexto de organização desde o primeiro release.
- Seeds, migrações e testes precisam manter uma organização padrão conhecida por configuração, não por ID fixo no código.
- Testes usam uma segunda organização inacessível pela interface para provar isolamento.
- A ativação futura não exigirá backfill de proprietário para os agregados principais.
- Recursos multi-tenant continuam formalmente em backlog e exigirão novas decisões sobre associação, papéis, quotas e cobrança.
