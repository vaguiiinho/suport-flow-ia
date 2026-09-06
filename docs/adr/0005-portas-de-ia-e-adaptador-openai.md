# ADR 0005 — Portas de IA e adaptador OpenAI

## Status

Aceito em 30 de agosto de 2026.

## Contexto

O assistente precisa de geração de resposta e embeddings. Acoplar casos de uso ao SDK, aos modelos ou aos formatos de um provedor dificultaria testes, controle de falhas e substituição futura.

## Decisão

Definir duas portas independentes na aplicação:

- `ChatModelPort`: recebe instruções, pergunta, contexto autorizado e schema esperado; devolve resultado estruturado e metadados seguros.
- `EmbeddingProviderPort`: recebe textos normalizados; devolve vetores, dimensões e identidade versionada do modelo.

O primeiro adaptador real usará OpenAI Responses API para chat e OpenAI Embeddings API para vetores. Nomes de modelos, timeout e limites serão configuração de ambiente validada no startup, sem defaults silenciosos de produção. Tipos do SDK não atravessarão a infraestrutura.

O pipeline validará a saída estruturada e aceitará citações apenas para chunks recuperados na mesma execução. Timeout, rate limit, indisponibilidade ou saída inválida resultarão em retry limitado quando seguro e, depois, fallback. Testes comuns usarão fakes determinísticos; chamadas reais serão opt-in.

## Alternativas consideradas

- Usar o SDK diretamente nos casos de uso: menos interfaces, mas forte acoplamento e testes frágeis.
- LangChain como abstração central: útil para fluxos complexos, porém adiciona uma camada antes de existir necessidade concreta.
- Groq para chat e OpenAI para embeddings: viável por adaptadores futuros, mas cria dois contratos externos no primeiro release.
- Ollama local: reduz dependência externa, porém exige recursos e modelos locais não garantidos no ambiente de demonstração.

## Consequências

- Chat e embeddings podem mudar de provedor independentemente.
- Alterar modelo de embeddings exige nova versão e reindexação compatível.
- Observabilidade deve registrar provedor, modelo, latência, tokens e custo sem salvar segredos ou prompts completos.
- O domínio permanece funcional em testes sem rede.
- Adicionar um novo provedor exige contract tests contra as mesmas portas.
