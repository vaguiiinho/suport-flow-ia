# Checklist de Implementação — SupportFlow AI

Legenda:

- `[x]` concluído e validado;
- `[~]` parcialmente concluído ou bloqueado por outra fase;
- `[ ]` pendente.

Marque um item como concluído somente quando implementação, testes e documentação correspondente estiverem alinhados.

## Gate de saída de cada fase

Toda fase só pode ser marcada como concluída após evidenciar, no escopo que ela altera:

- testes de unidade dos casos de uso e regras críticas;
- testes de integração para persistência, contratos HTTP, arquivos, jobs ou vetores quando aplicáveis;
- testes de autorização, isolamento de organização, validação de entrada e falhas seguras quando houver dados, acesso ou IA;
- `npm run format:check`, `npm run lint`, `npm run test` e `npm run build` passando; executar também `npm run test:integration` quando a fase afetar a API ou infraestrutura PostgreSQL, com `DATABASE_URL` e banco migrado conforme [ambiente](ambiente.md);
- atualização da documentação e revisão de segurança proporcional ao risco.

Cobertura segura significa cobrir caminhos críticos e negativos, não apenas atingir uma porcentagem. A instrumentação, o limiar de cobertura e o bloqueio no CI são entregas explícitas da Fase 8. No estado atual, formatação, lint, testes unitários e build passam; a execução local de integração exige o ambiente de banco configurado.

## Fase 0 — Governança

Status: concluída em 30 de agosto de 2026.

- [x] registrar o plano de ação do MVP;
- [x] registrar o checklist de implementação;
- [x] criar `AGENTS.md` e roteamento de especialistas;
- [x] criar skills de resposta, ingestão e triagem;
- [x] criar ADRs para stack, autenticação, isolamento de fontes, jobs e provedores de IA antes do scaffold;
- [x] registrar em ADR a estratégia de organização padrão e evolução para multi-tenant;
- [x] executar o gate de saída da fase para a documentação e o baseline do monorepo;

## Fase 1 — Fundação do monorepo

Status: concluída em 30 de agosto de 2026.

- [x] iniciar npm workspaces;
- [x] criar `apps/web`, `apps/api`, `apps/worker` e `packages/shared`;
- [x] configurar TypeScript, ESLint, Prettier e scripts raiz;
- [x] configurar Next.js App Router;
- [x] configurar NestJS com separação de domínio, aplicação, infraestrutura e apresentação;
- [x] configurar PostgreSQL, Prisma e pgvector;
- [x] criar `Organization` e a organização padrão na primeira migration;
- [x] incluir `organizationId` nos agregados e restrições únicas de negócio;
- [x] criar Dockerfiles e Docker Compose para desenvolvimento;
- [x] documentar variáveis de ambiente sem valores secretos;
- [x] adicionar health checks para web, API, worker e banco;
- [x] executar o gate de saída da fase para o scaffold, banco e Docker Compose;

## Fase 2 — Identidade e acesso

Status: concluída em 30 de agosto de 2026.

- [x] modelar `User`, papel de atendente e estado da conta;
- [x] implementar hash de senha e bootstrap seguro do primeiro atendente;
- [x] implementar login, logout e sessão em cookie `httpOnly`;
- [x] adicionar proteção CSRF às mutações autenticadas;
- [x] limitar tentativas de login e registrar eventos sem dados sensíveis;
- [x] criar sessão anônima opaca para conversas de clientes;
- [x] resolver `OrganizationContext` no servidor a partir da sessão ou conversa;
- [x] testar autenticação, expiração, autorização e acesso negado;
- [x] executar o gate de saída da fase, incluindo testes de sessão, CSRF, autorização e isolamento entre organizações;

## Fase 3 — Base de conhecimento

Status: concluída em 6 de setembro de 2026.

- [x] modelar `KnowledgeSource` e visibilidade `PUBLIC|INTERNAL`;
- [x] aplicar escopo de organização em fontes, arquivos e consultas administrativas;
- [x] implementar CRUD protegido de artigos;
- [x] implementar adaptador de armazenamento local;
- [x] definir porta compatível com armazenamento de objetos em produção;
- [x] implementar upload de PDF com limites de tamanho e páginas;
- [x] validar MIME, assinatura, criptografia e conteúdo vazio;
- [x] gerar nomes de arquivo e impedir path traversal;
- [x] manter histórico de versão, hash e estado de indexação;
- [x] garantir que uma fonte com falha não substitua a versão ativa;
- [x] executar o gate de saída da fase, incluindo validação de PDF, armazenamento, autorização e isolamento entre organizações;

## Fase 4 — Ingestão e reindexação

Status: concluída em 6 de setembro de 2026.

- [x] modelar `IngestionJob` com status, tentativas, progresso e erro sanitizado;
- [x] persistir trabalhos antes de responder ao upload;
- [x] implementar polling e claim seguro de trabalhos pelo worker;
- [x] extrair e normalizar texto de artigos e PDFs;
- [x] definir estratégia versionada de chunking;
- [x] implementar `EmbeddingProviderPort`;
- [x] implementar adaptador inicial para OpenAI Embeddings API;
- [x] persistir `KnowledgeChunk` e vetores no pgvector;
- [x] usar hash e versão da estratégia para idempotência;
- [x] implementar retry limitado e reindexação manual;
- [x] remover ou substituir chunks obsoletos de forma atômica;
- [x] testar interrupção, duplicidade, retry e preservação da versão ativa;
- [x] testar que jobs não reivindicam nem gravam dados em outra organização;
- [x] executar o gate de saída da fase, incluindo testes de worker, pgvector, reprocessamento e isolamento de jobs;

## Fase 5 — Retrieval e RAG

- [ ] implementar busca vetorial com filtro obrigatório de visibilidade;
- [ ] aplicar filtro obrigatório de organização na busca vetorial;
- [ ] adicionar ranking e diversidade de fontes;
- [ ] validar novamente a autorização dos chunks selecionados;
- [ ] implementar `ChatModelPort`;
- [ ] implementar adaptador inicial para OpenAI Responses API;
- [ ] definir resposta estruturada com texto e referências de chunk;
- [ ] vincular citações somente a chunks realmente recuperados;
- [ ] implementar fallback para evidência insuficiente;
- [ ] tratar timeout, rate limit, indisponibilidade e saída inválida;
- [ ] impedir que conteúdo recuperado altere políticas ou ferramentas;
- [ ] versionar prompts, estratégia de retrieval e configuração de modelo;
- [ ] executar o gate de saída da fase, incluindo avaliações de recuperação, citações, fallback, fonte interna e prompt injection;

## Fase 6 — Assistente do cliente

- [x] implementar criação de conversa anônima; a criação de sessão anônima também cria a conversa vinculada em transação e é coberta por testes de unidade, integração e contrato HTTP;
- [ ] implementar envio e persistência de mensagens;
- [ ] exibir resposta, fontes e estado de fallback;
- [ ] oferecer escalonamento sem criar ticket automaticamente;
- [ ] preparar resumo, categoria e prioridade sugeridos;
- [ ] solicitar contato mínimo e confirmação explícita;
- [ ] garantir acessibilidade, responsividade e navegação por teclado;
- [ ] limitar tamanho, frequência e abuso de mensagens;
- [ ] testar conversa, fontes, fallback, falha do provedor e expiração da sessão;
- [ ] executar o gate de saída da fase, incluindo fluxo anônimo, acessibilidade e abuso;

## Fase 7 — Tickets e painel

- [~] modelar `Ticket` e seus estados; o schema e os enums existem desde a fundação, mas faltam entidade/caso de uso, contratos HTTP e testes do fluxo;
- [ ] implementar criação idempotente a partir de conversa confirmada;
- [ ] impedir que a IA altere status ou responsável;
- [ ] implementar listagem, filtros e detalhe para atendentes;
- [ ] implementar atualização manual de status, categoria e prioridade;
- [ ] exibir conversa e fontes relacionadas sem revelar dados indevidos;
- [ ] criar painel protegido para artigos, PDFs e ingestões;
- [ ] exibir falhas e permitir reprocessamento manual;
- [ ] registrar trilha mínima de mudanças operacionais;
- [~] executar o gate de saída da fase; a modelagem inicial existe, mas o fluxo de tickets e painel ainda não possui testes nem contratos;

## Fase 8 — Testes e avaliações de IA

- [~] testar entidades, objetos de valor e casos de uso sem infraestrutura; há cobertura unitária para autenticação, conhecimento, validação de PDF, armazenamento e configuração, mas não para os módulos futuros;
- [ ] testar repositórios Prisma com PostgreSQL e pgvector reais;
- [~] testar contratos HTTP, validação, cookies e autorização; autenticação e conhecimento possuem testes de integração/contrato, enquanto os contratos de chat, ingestão e tickets dependem das fases correspondentes;
- [ ] criar E2E do chat até abertura confirmada do ticket;
- [ ] criar E2E de artigo/PDF até recuperação pelo assistente;
- [~] criar fixtures com duas organizações e testes de isolamento entre elas; autenticação e conhecimento exercitam duas organizações, mas jobs, vetores, retrieval e tickets ainda dependem de implementação;
- [ ] montar dataset versionado com perguntas respondíveis e não respondíveis;
- [ ] medir recall do retrieval, fidelidade, citações e fallback;
- [ ] incluir casos adversariais de prompt injection e fonte interna;
- [ ] calibrar e documentar o limiar de suficiência;
- [ ] instrumentar cobertura de testes, definir limiares por caminho crítico e torná-los bloqueantes no CI;
- [ ] tornar falha crítica de avaliação bloqueante no CI;
- [ ] executar o gate de saída da fase com dataset de avaliação versionado e ambiente PostgreSQL/pgvector real;

## Fase 9 — Segurança e privacidade

- [ ] revisar autenticação, autorização e CSRF;
- [ ] revisar upload, parser e armazenamento de PDFs;
- [ ] revisar isolamento `PUBLIC|INTERNAL` em consulta e resposta;
- [ ] revisar isolamento por organização em banco, vetor, jobs e armazenamento;
- [ ] revisar proteção contra prompt injection e exfiltração;
- [ ] remover PII, segredos e conteúdo integral dos logs;
- [ ] definir retenção e exclusão de conversas e tickets;
- [ ] configurar headers de segurança e limites de requisição;
- [ ] executar análise de dependências e revisão do agente `security`;
- [ ] executar o gate de saída da fase com revisão de segurança independente e testes adversariais;

## Fase 10 — Observabilidade e deploy

- [ ] adicionar correlação entre requisição, conversa, job e chamada de IA;
- [ ] medir latência, tokens, custo, fallback e erro por provedor;
- [ ] medir fila, tentativas, duração e falhas de ingestão;
- [ ] configurar logs estruturados e sanitizados;
- [ ] implementar adaptador de armazenamento de objetos;
- [~] criar migrations e procedimento de deploy; as migrations das Fases 1 a 3 existem e são executáveis pelos scripts documentados, mas o procedimento completo de deploy e rollback depende das funcionalidades restantes;
- [ ] criar backup e restauração de banco e arquivos;
- [ ] documentar runbook e rollback;
- [ ] validar Docker Compose do zero;
- [~] executar lint, testes, avaliações e build de produção; lint, testes e build foram executados para as Fases 1 a 3, mas avaliações de IA e a validação final do MVP dependem das fases seguintes;
- [~] executar o gate de saída da fase; os comandos locais de formatação, lint e build passam, enquanto CI, avaliações, deploy e rollback dependem do MVP completo;

## Critérios de encerramento do MVP

- [ ] cliente recebe respostas citadas ou fallback seguro;
- [ ] cliente nunca recebe conteúdo `INTERNAL`;
- [ ] ticket só é criado após confirmação explícita;
- [ ] reenvio idempotente não duplica tickets ou ingestões;
- [ ] atendente gerencia conhecimento e tickets em área protegida;
- [ ] avaliações de RAG e testes críticos passam no CI;
- [ ] ambiente e operação estão documentados para demonstração.

## Backlog futuro — Ativação multi-tenant

- [ ] implementar criação e administração de organizações;
- [ ] implementar convites e associação de usuários por organização;
- [ ] definir papéis e permissões no contexto da organização;
- [ ] adicionar seleção segura de organização para usuários com múltiplos vínculos;
- [ ] permitir configurações e identidade visual por organização;
- [ ] definir quotas, medição de uso, planos e cobrança;
- [ ] planejar migração de dados e rollout sem interromper a organização padrão.
