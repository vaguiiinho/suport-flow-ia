# ADR 0004 — Jobs persistentes de ingestão

## Status

Aceito em 30 de agosto de 2026.

## Contexto

Extração de PDF, chunking e geração de embeddings não devem bloquear requisições HTTP. O MVP precisa sobreviver a reinícios e permitir retry e auditoria, sem adicionar Redis antes de existir volume que justifique outro serviço.

## Decisão

Usar PostgreSQL como fila persistente inicial por meio de `IngestionJob`. A API criará a fonte e o job na mesma fronteira transacional. O worker fará polling e reivindicará trabalhos com bloqueio concorrente, usando `FOR UPDATE SKIP LOCKED` ou mecanismo equivalente seguro no Prisma.

O job registrará, no mínimo:

- organização, fonte, operação e chave de idempotência;
- status `PENDING`, `PROCESSING`, `SUCCEEDED` ou `FAILED`;
- `availableAt`, número de tentativas, progresso e timestamps;
- identidade e instante do claim;
- erro sanitizado e versão da estratégia de ingestão.

Falhas transitórias usarão backoff e limite configurável de tentativas, com padrão inicial de três. Claims abandonados poderão ser recuperados após timeout configurável. Reprocessamento manual criará uma nova execução idempotente. A versão pesquisável atual só será trocada pela nova após sucesso integral e atômico.

## Alternativas consideradas

- Processar na requisição HTTP: mais simples, mas vulnerável a timeout e perda de progresso.
- Redis com BullMQ: bom para maior volume, porém adiciona infraestrutura e duas fontes de estado no MVP.
- Broker dedicado: confiável em escala, mas operacionalmente excessivo para o objetivo atual.
- Cron sem entidade de job: não oferece claim, progresso, idempotência ou diagnóstico adequados.

## Consequências

- Banco transacional também suporta a fila enquanto o volume for moderado.
- Índices de status e `availableAt` são necessários para polling eficiente.
- Worker deve implementar heartbeat ou renovação para tarefas longas.
- Métricas devem indicar profundidade da fila, tempo de espera, tentativas e falhas.
- Uma futura migração para BullMQ ou broker preservará o contrato do caso de uso e o histórico de ingestão.
