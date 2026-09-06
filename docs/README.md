# Documentação do SupportFlow AI

Este diretório concentra as decisões de produto e a ordem de implementação do projeto.

## Documentos principais

- [`plano-de-acao.md`](plano-de-acao.md): problema, público, escopo, arquitetura, fluxos, contratos, riscos e fases.
- [`checklist-implementacao.md`](checklist-implementacao.md): tarefas rastreáveis para construir e validar o MVP.
- [`ambiente.md`](ambiente.md): requisitos, comandos, variáveis e endpoints de saúde.
- [`autenticacao.md`](autenticacao.md): bootstrap, sessões, CSRF, endpoints e limites de segurança.
- [`conhecimento.md`](conhecimento.md): contrato HTTP administrativo, versionamento e armazenamento de artigos e PDFs.
- [`adr/`](adr/README.md): decisões arquiteturais aceitas e suas consequências.

## Documentos futuros

Criar somente quando a implementação exigir:

- `api.md`: contratos HTTP estabilizados;
- `runbook.md`: operação, incidentes, backup e recuperação;
- `avaliacoes-ia.md`: dataset, métricas e resultados das avaliações de RAG.

## Regra de manutenção

- Atualize o plano quando o escopo ou uma decisão estrutural mudar.
- Marque o checklist apenas após implementação e validação.
- Não use o checklist como substituto de uma ADR.
- Mantenha a documentação alinhada ao comportamento real; itens futuros devem continuar claramente identificados como planejados.
