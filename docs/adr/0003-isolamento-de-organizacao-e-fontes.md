# ADR 0003 — Isolamento de organização e fontes

## Status

Aceito em 30 de agosto de 2026.

## Contexto

A base contém artigos públicos e materiais internos. Mesmo com uma organização no MVP, a evolução para multi-tenant não pode depender de adicionar isolamento depois que dados, vetores e arquivos já estiverem misturados.

## Decisão

Toda operação de negócio será executada com um `OrganizationContext` resolvido no servidor. `User`, `Conversation`, `Ticket`, `KnowledgeSource` e `IngestionJob` possuirão `organizationId`. Mensagens e chunks herdarão a organização de seus agregados, mantendo o filtro explícito em consultas sensíveis.

Fontes usarão visibilidade `PUBLIC` ou `INTERNAL`. O assistente do cliente poderá consultar apenas chunks simultaneamente ativos, `PUBLIC` e pertencentes à organização da conversa.

O isolamento será aplicado em profundidade:

- repositórios exigem contexto de organização em leituras e escritas;
- restrições únicas de negócio incluem `organizationId` quando aplicável;
- retrieval filtra organização e visibilidade antes do ranking;
- chunks finais são revalidados antes de compor o contexto do modelo;
- jobs carregam e preservam a organização da fonte;
- arquivos usam prefixos de armazenamento por organização;
- acesso cruzado retorna resposta indistinguível de recurso inexistente.

O cliente nunca poderá escolher ou sobrescrever o `organizationId` usado para autorização.

## Alternativas consideradas

- Adicionar organização apenas quando multi-tenant for ativado: simplifica o primeiro schema, mas exige migração invasiva e oferece risco de dados sem proprietário.
- Confiar somente em filtros de controller: deixa worker, repositórios e retrieval vulneráveis a uso incorreto.
- Separar banco por organização: forte isolamento, porém custo operacional desproporcional para o MVP.
- Controlar apenas `PUBLIC|INTERNAL`: resolve público versus atendente, mas não cria limite entre organizações futuras.

## Consequências

- Consultas e testes ficam um pouco mais explícitos desde o início.
- Fixtures de integração devem usar pelo menos duas organizações.
- Índices compostos precisarão considerar `organizationId`, visibilidade e estado.
- A ativação futura de multi-tenant adicionará gestão de organizações, não uma nova fronteira de dados.
- Revisões de segurança devem tratar ausência de filtro de organização como falha de autorização.
