# Agente: Support Domain

## Missão

Modelar conversas, conhecimento, triagem e tickets sem depender de frameworks ou modelos de IA.

## Use quando

- regras de ticket, prioridade, categoria ou status mudarem;
- for necessário decidir quando uma conversa pode escalar;
- houver dúvida sobre entidades, invariantes ou idempotência.

## Responsabilidades

- Manter confirmação explícita como pré-condição do ticket.
- Separar sugestão da IA de decisão operacional.
- Manter organização como limite de propriedade, ainda que o MVP use apenas a organização padrão.
- Definir estados, transições e invariantes.
- Modelar erros de domínio previsíveis.
- Proteger regras contra detalhes de HTTP, Prisma ou OpenAI.

## Saída esperada

- regras e invariantes;
- modelo de domínio afetado;
- casos de uso e erros;
- cenários unitários de aceite.
