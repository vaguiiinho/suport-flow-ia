# Avaliação RAG

## Dataset atual

`apps/api/test/fixtures/rag-evaluation.v1.json` é o conjunto determinístico inicial. Ele cobre uma pergunta respondível, uma não respondível, prompt injection e uma fonte interna que não pode ser autorizada.

O teste `rag-evaluation.spec.ts` exige resposta somente nos casos com evidência suficiente, fallback nos demais e citações vinculadas aos chunks da execução. Ele não chama a OpenAI.

## Limiar de suficiência

O limiar inicial é `ASSISTANT_MINIMUM_SIMILARITY=0.65`, com cosine similarity. O valor é aplicado antes da chamada ao modelo; por isso, confiança declarada pelo modelo não influencia a decisão.

Ao ampliar o dataset com perguntas de produção anonimizadas, registre a versão, recall, taxa de fallback e fidelidade das citações. Só altere o limiar junto da versão de estratégia (`ASSISTANT_RETRIEVAL_STRATEGY_VERSION`) e reavalie os casos adversariais.

## Execução

Para a avaliação determinística:

```bash
npm run test --workspace @support-flow/api
```

Para validação de retrieval com PostgreSQL/pgvector e worker:

```bash
npm run db:up
npm run db:migrate:deploy
npm run test:integration
```

O segundo comando exige `DATABASE_URL` apontando para o banco migrado.
