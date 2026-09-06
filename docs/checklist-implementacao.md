# Checklist de Implementação — SupportFlow AI

Legenda:

- `[x]` concluído e validado;
- `[~]` parcialmente concluído ou bloqueado por outra fase;
- `[ ]` pendente.

Marque um item como concluído somente quando implementação, testes e documentação correspondente estiverem alinhados.

## Fase 0 — Governança

Status: concluída em 30 de agosto de 2026.

- [x] registrar o plano de ação do MVP;
- [x] registrar o checklist de implementação;
- [x] criar `AGENTS.md` e roteamento de especialistas;
- [x] criar skills de resposta, ingestão e triagem;
- [x] criar ADRs para stack, autenticação, isolamento de fontes, jobs e provedores de IA antes do scaffold;
- [x] registrar em ADR a estratégia de organização padrão e evolução para multi-tenant;

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

## Fase 3 — Base de conhecimento

- [ ] modelar `KnowledgeSource` e visibilidade `PUBLIC|INTERNAL`;
- [ ] aplicar escopo de organização em fontes, arquivos e consultas administrativas;
- [ ] implementar CRUD protegido de artigos;
- [ ] implementar adaptador de armazenamento local;
- [ ] definir porta compatível com armazenamento de objetos em produção;
- [ ] implementar upload de PDF com limites de tamanho e páginas;
- [ ] validar MIME, assinatura, criptografia e conteúdo vazio;
- [ ] gerar nomes de arquivo e impedir path traversal;
- [ ] manter histórico de versão, hash e estado de indexação;
- [ ] garantir que uma fonte com falha não substitua a versão ativa;

## Fase 4 — Ingestão e reindexação

- [ ] modelar `IngestionJob` com status, tentativas, progresso e erro sanitizado;
- [ ] persistir trabalhos antes de responder ao upload;
- [ ] implementar polling e claim seguro de trabalhos pelo worker;
- [ ] extrair e normalizar texto de artigos e PDFs;
- [ ] definir estratégia versionada de chunking;
- [ ] implementar `EmbeddingProviderPort`;
- [ ] implementar adaptador inicial para OpenAI Embeddings API;
- [ ] persistir `KnowledgeChunk` e vetores no pgvector;
- [ ] usar hash e versão da estratégia para idempotência;
- [ ] implementar retry limitado e reindexação manual;
- [ ] remover ou substituir chunks obsoletos de forma atômica;
- [ ] testar interrupção, duplicidade, retry e preservação da versão ativa;
- [ ] testar que jobs não reivindicam nem gravam dados em outra organização;

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

## Fase 6 — Assistente do cliente

- [ ] implementar criação de conversa anônima;
- [ ] implementar envio e persistência de mensagens;
- [ ] exibir resposta, fontes e estado de fallback;
- [ ] oferecer escalonamento sem criar ticket automaticamente;
- [ ] preparar resumo, categoria e prioridade sugeridos;
- [ ] solicitar contato mínimo e confirmação explícita;
- [ ] garantir acessibilidade, responsividade e navegação por teclado;
- [ ] limitar tamanho, frequência e abuso de mensagens;
- [ ] testar conversa, fontes, fallback, falha do provedor e expiração da sessão;

## Fase 7 — Tickets e painel

- [ ] modelar `Ticket` e seus estados;
- [ ] implementar criação idempotente a partir de conversa confirmada;
- [ ] impedir que a IA altere status ou responsável;
- [ ] implementar listagem, filtros e detalhe para atendentes;
- [ ] implementar atualização manual de status, categoria e prioridade;
- [ ] exibir conversa e fontes relacionadas sem revelar dados indevidos;
- [ ] criar painel protegido para artigos, PDFs e ingestões;
- [ ] exibir falhas e permitir reprocessamento manual;
- [ ] registrar trilha mínima de mudanças operacionais;

## Fase 8 — Testes e avaliações de IA

- [ ] testar entidades, objetos de valor e casos de uso sem infraestrutura;
- [ ] testar repositórios Prisma com PostgreSQL e pgvector reais;
- [ ] testar contratos HTTP, validação, cookies e autorização;
- [ ] criar E2E do chat até abertura confirmada do ticket;
- [ ] criar E2E de artigo/PDF até recuperação pelo assistente;
- [ ] criar fixtures com duas organizações e testes de isolamento entre elas;
- [ ] montar dataset versionado com perguntas respondíveis e não respondíveis;
- [ ] medir recall do retrieval, fidelidade, citações e fallback;
- [ ] incluir casos adversariais de prompt injection e fonte interna;
- [ ] calibrar e documentar o limiar de suficiência;
- [ ] tornar falha crítica de avaliação bloqueante no CI;

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

## Fase 10 — Observabilidade e deploy

- [ ] adicionar correlação entre requisição, conversa, job e chamada de IA;
- [ ] medir latência, tokens, custo, fallback e erro por provedor;
- [ ] medir fila, tentativas, duração e falhas de ingestão;
- [ ] configurar logs estruturados e sanitizados;
- [ ] implementar adaptador de armazenamento de objetos;
- [ ] criar migrations e procedimento de deploy;
- [ ] criar backup e restauração de banco e arquivos;
- [ ] documentar runbook e rollback;
- [ ] validar Docker Compose do zero;
- [ ] executar lint, testes, avaliações e build de produção;

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
