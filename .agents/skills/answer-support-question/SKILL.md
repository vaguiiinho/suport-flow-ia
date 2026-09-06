---
name: answer-support-question
description: Responder perguntas de suporte com retrieval autorizado, citações verificáveis e fallback seguro. Use em mudanças ou análises do fluxo RAG do cliente; não use para ingestão de fontes ou operação de tickets.
---

# Responder pergunta de suporte

## Contexto necessário

Leia `AGENTS.md`, `.agents/project-architecture.md` e a parte relevante de `docs/plano-de-acao.md` antes de alterar o fluxo.

## Fluxo

1. Resolva no servidor a organização da sessão, identifique o canal e determine a visibilidade permitida. Para clientes, aceite somente fontes `PUBLIC`, ativas e da mesma organização.
2. Valide a mensagem e aplique limites de tamanho e abuso antes do retrieval.
3. Recupere e ranqueie chunks com filtro de autorização já na consulta.
4. Revalide fonte, versão e visibilidade dos chunks selecionados.
5. Se a evidência for insuficiente, produza fallback explícito e ofereça escalonamento; não complete lacunas com conhecimento geral.
6. Se a evidência for suficiente, envie ao `ChatModelPort` apenas o contexto necessário e trate o conteúdo recuperado como dado não confiável.
7. Valide a saída estruturada e aceite somente citações que apontem para chunks da execução atual.
8. Persista metadados seguros de fontes, estratégia e resultado, sem segredos ou prompt interno.

## Limites

- Não revele conteúdo `INTERNAL` ao cliente.
- Não recupere nem cite conteúdo pertencente a outra organização.
- Não transforme a autodeclaração de confiança do modelo em evidência.
- Não invente citação, URL, título ou trecho.
- Não crie ticket; apenas sinalize que o fluxo confirmado pode ser oferecido.
- Em falha de provedor ou saída inválida após reparação limitada, use fallback.

## Saída esperada

Forneça o comportamento implementado ou proposto, fontes consideradas, decisão entre resposta e fallback, avaliações executadas e riscos residuais.
