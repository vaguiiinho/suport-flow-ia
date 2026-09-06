---
name: ingest-support-knowledge
description: Ingerir ou reindexar artigos e PDFs de suporte com validação, chunking, embeddings, versionamento e idempotência. Use no pipeline do worker; não use para responder perguntas ou gerir tickets.
---

# Ingerir conhecimento de suporte

## Contexto necessário

Leia `AGENTS.md`, `.agents/project-architecture.md` e as regras de ingestão em `docs/plano-de-acao.md`.

## Fluxo

1. Confirme que a operação é autenticada, resolva a organização no servidor e valide tipo, visibilidade e limites da fonte.
2. Para PDF, valide assinatura, MIME, tamanho, quantidade de páginas, criptografia e presença de conteúdo extraível.
3. Calcule hash do conteúdo e combine-o com a versão da estratégia de extração, chunking e embeddings.
4. Reutilize resultado compatível ou crie `IngestionJob` idempotente; não duplique jobs equivalentes ativos.
5. Faça claim concorrente do job, registre progresso e limite tentativas.
6. Extraia e normalize texto preservando referências úteis como página, seção e posição.
7. Gere chunks rastreáveis e embeddings por `EmbeddingProviderPort`.
8. Grave a nova versão sem remover a versão pesquisável atual.
9. Ative a nova versão e desative a anterior em uma troca atômica somente após sucesso integral.
10. Em falha, preserve a versão válida, sanitize o erro e permita reprocessamento controlado.

## Limites

- Não confiar em nome ou caminho fornecido pelo usuário.
- Não tornar chunks parciais pesquisáveis.
- Não misturar conteúdo `PUBLIC` e `INTERNAL`.
- Não misturar fontes, jobs, chunks ou caminhos de arquivo entre organizações.
- Não registrar conteúdo integral, credenciais ou dados pessoais em logs.
- Não repetir indefinidamente chamadas a parser ou provedor.

## Saída esperada

Informe fonte, versão, estratégia, estado final, contagens relevantes, falhas sanitizadas e testes de idempotência, interrupção e troca de versão.
