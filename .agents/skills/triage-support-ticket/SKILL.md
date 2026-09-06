---
name: triage-support-ticket
description: Sugerir resumo, categoria e prioridade para um ticket a partir de uma conversa de suporte, preservando revisão e confirmação humanas. Não use para criar, encaminhar ou alterar tickets autonomamente.
---

# Triar ticket de suporte

## Contexto necessário

Leia `AGENTS.md`, `.agents/project-architecture.md` e as regras de abertura de ticket em `docs/plano-de-acao.md`.

## Fluxo

1. Confirme que a conversa pertence à sessão solicitante, está associada à mesma organização e pode ser usada para escalonamento.
2. Use apenas mensagens relevantes e minimize dados pessoais na entrada do modelo.
3. Produza saída estruturada com resumo factual, descrição concisa, categoria permitida e prioridade sugerida.
4. Baseie urgência em sinais definidos pelo domínio; não trate linguagem enfática isolada como prioridade máxima.
5. Valide enumerações, tamanho e ausência de instruções ou fatos inventados.
6. Apresente a sugestão para revisão do cliente e solicite confirmação inequívoca.
7. Somente após confirmação, delegue a criação idempotente ao caso de uso de tickets.

## Limites

- A triagem é sugestão, não decisão operacional definitiva.
- Não criar ticket durante a análise ou preparação.
- Não escolher responsável, fila, SLA ou novo status.
- Não inferir identidade, impacto ou dados de contato ausentes.
- Em saída inválida, use valores seguros ou solicite informação em vez de inventar.

## Saída esperada

Entregue a sugestão estruturada, fatos que a sustentam, campos que exigem revisão e estado da confirmação. Registre testes para ausência de confirmação, duplicidade e conteúdo incompleto.
