# Plano de Ação — SupportFlow AI

## 1. Visão do produto

O SupportFlow AI é uma central de suporte que, no MVP, opera com uma organização padrão. Clientes conversam com um assistente que consulta uma base de conhecimento aprovada, responde com fontes verificáveis e oferece abertura de chamado quando a dúvida não é resolvida. Atendentes administram conhecimento, acompanham conversas e operam tickets em uma área protegida.

A arquitetura mantém explícito o limite de propriedade por organização para permitir evolução futura para multi-tenant sem ativar essa complexidade no MVP.

O projeto deve demonstrar uma aplicação realista de RAG, arquitetura full-stack, processamento assíncrono, segurança de dados e limites claros de autonomia.

## 2. Problema

Centrais de suporte repetem respostas, espalham conhecimento em documentos e deixam clientes sem transparência sobre a origem da informação. Assistentes genéricos podem responder sem evidência, acessar conteúdo inadequado ou executar ações sem consentimento.

O SupportFlow AI resolve esse problema com recuperação restrita por visibilidade, respostas citadas, fallback seguro e escalonamento confirmado pelo cliente.

## 3. Público

- Clientes que buscam respostas rápidas e abertura de chamado quando necessário.
- Atendentes que mantêm a base e tratam tickets.
- Avaliadores técnicos do portfólio, interessados em arquitetura, IA aplicada e qualidade.

## 4. Objetivos do MVP

- Permitir conversa anônima entre cliente e assistente.
- Responder com base em artigos e PDFs públicos, sempre indicando fontes.
- Informar quando a evidência recuperada for insuficiente.
- Criar ticket somente depois da confirmação explícita do cliente.
- Sugerir resumo, categoria e prioridade sem executar ações operacionais autônomas.
- Permitir que atendentes autenticados gerenciem conhecimento e tickets.
- Processar e reprocessar fontes com rastreabilidade e idempotência.
- Medir qualidade de retrieval, fidelidade da resposta, latência e fallback.

## 5. Fora de escopo

- Operação multi-tenant, incluindo cadastro de organizações, troca de contexto, convite de equipes, planos e cobrança.
- Integrações com Google Drive, Notion, CRM ou canais externos.
- Voz, telefone ou transcrição.
- Treinamento ou fine-tuning de modelos.
- Alteração automática de status, responsável ou fila de ticket.
- Resposta do assistente baseada em fontes internas para clientes.
- Aplicativo móvel nativo e analytics avançado.

## 6. Stack e topologia planejadas

```text
apps/web       Next.js App Router, chatbot e painel de atendimento
apps/api       NestJS, casos de uso, contratos HTTP e integrações
apps/worker    ingestão, extração, chunking, embeddings e reindexação
packages/shared contratos puros quando compartilhamento for necessário
```

- Linguagem: TypeScript.
- Gerenciamento: npm workspaces.
- Banco: PostgreSQL com pgvector.
- ORM: Prisma, isolado na infraestrutura.
- Desenvolvimento: Docker Compose.
- Arquivos: adaptador de armazenamento; disco local no desenvolvimento e armazenamento de objetos em produção.
- IA: portas `ChatModelPort` e `EmbeddingProviderPort`.
- Primeiro adaptador: OpenAI Responses API e Embeddings API.

## 7. Limites dos componentes

### Web

- Renderiza chatbot público e painel protegido.
- Mantém estado de apresentação, não regras de domínio.
- Exibe estados de carregamento, falha, fallback, fontes e confirmação de ticket.

### API

- Autentica atendentes e autoriza recursos.
- Mantém conversas, mensagens, tickets e fontes.
- Recupera contexto autorizado antes de chamar o modelo.
- Valida a confirmação de criação do ticket.
- Expõe contratos HTTP versionados.

### Worker

- Consome trabalhos persistidos em `IngestionJob`.
- Extrai texto, normaliza, fragmenta, gera embeddings e atualiza o índice.
- Usa hash do conteúdo e versão da estratégia para evitar processamento duplicado.
- Registra progresso, tentativas e erro sanitizado.

### Dados e IA

- PostgreSQL guarda dados transacionais, trabalhos e metadados.
- pgvector guarda embeddings associados a chunks e fontes.
- Conteúdo recuperado é dado não confiável e nunca substitui instruções do sistema.
- Adaptadores de IA não vazam tipos do SDK para domínio ou aplicação.

## 8. Modelo de domínio inicial

- `Organization`: limite de propriedade dos dados; no MVP existe apenas a organização padrão criada pelo sistema.
- `User`: atendente autenticado, papel, estado da conta e organização.
- `Conversation`: sessão anônima, estado e datas.
- `Message`: papel, conteúdo, fontes usadas e metadados de execução.
- `Ticket`: número, resumo, descrição, categoria, prioridade, status e conversa de origem.
- `KnowledgeSource`: tipo `ARTICLE` ou `PDF`, visibilidade, versão, hash e estado de indexação.
- `KnowledgeChunk`: trecho, posição, referência de origem, embedding e visibilidade herdada.
- `IngestionJob`: fonte, operação, status, tentativas, progresso e erro sanitizado.

`User`, `Conversation`, `Ticket`, `KnowledgeSource` e `IngestionJob` pertencem diretamente a uma organização. `Message` e `KnowledgeChunk` herdam esse limite de seus agregados, mas consultas sensíveis devem continuar aplicando o filtro de organização explicitamente. Chaves únicas de negócio devem incluir `organizationId` quando o valor puder se repetir entre organizações.

Estados iniciais:

- Ticket: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`.
- Prioridade sugerida: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- Ingestão: `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`.

## 9. Contratos HTTP iniciais

Todos os contratos ficam sob `/api/v1`.

- `POST /conversations`: cria sessão anônima e devolve identificador opaco.
- `POST /conversations/:id/messages`: recebe mensagem e devolve `answer`, `citations`, `fallback`, `canOpenTicket` e metadados seguros.
- `POST /tickets`: exige `conversationId`, confirmação explícita e dados de contato mínimos; impede ticket duplicado para a mesma confirmação.
- `POST /auth/login` e `POST /auth/logout`: gerenciam sessão do atendente em cookie `httpOnly`.
- `GET|POST|PATCH|DELETE /knowledge/articles`: CRUD protegido de artigos.
- `POST /knowledge/pdfs`: upload protegido de PDF e criação do trabalho de ingestão.
- `POST /knowledge/:id/reindex`: agenda reindexação idempotente.
- `GET /ingestion-jobs/:id`: consulta estado e erro sanitizado.
- `GET /tickets`, `GET /tickets/:id` e `PATCH /tickets/:id`: operação manual do atendente.

Os DTOs validam formato e tamanho. A API não devolve prompts, vetores, chaves, stack traces ou conteúdo interno a clientes.

## 10. Fluxos principais

### Pergunta ao assistente

1. A API valida a sessão e a mensagem.
2. A aplicação resolve a organização no servidor e recupera apenas chunks `PUBLIC`, ativos e pertencentes a ela.
3. O pipeline aplica ranking e verifica suficiência da evidência.
4. Sem evidência suficiente, responde com fallback e oferece escalonamento.
5. Com evidência, o modelo produz resposta estruturada limitada ao contexto.
6. A API valida a estrutura, vincula citações reais e persiste os metadados.

### Abertura de ticket

1. O assistente oferece escalonamento, sem criar registro.
2. A aplicação prepara resumo, categoria e prioridade sugeridos.
3. O cliente revisa e confirma o envio.
4. A API valida contato, conversa e chave de idempotência.
5. O ticket é criado como `OPEN`; alterações posteriores são humanas.

### Ingestão de conhecimento

1. O atendente cria artigo ou envia PDF válido.
2. A API associa a organização autenticada, grava a fonte e agenda `IngestionJob` no mesmo contexto.
3. O worker valida conteúdo e hash, extrai texto e cria chunks.
4. O adaptador gera embeddings e atualiza os chunks em transação controlada.
5. A fonte só se torna pesquisável após sucesso integral.
6. Falhas preservam a última versão válida e permitem nova tentativa.

## 11. Falhas e comportamento esperado

- Provedor indisponível: não inventar resposta; registrar falha sanitizada e oferecer ticket.
- Evidência insuficiente: usar fallback explícito, sem completar lacunas por conhecimento geral.
- Fonte sem permissão: excluir antes do ranking e validar novamente antes da resposta.
- Organização divergente ou ausente: negar a operação sem revelar a existência do recurso.
- PDF inválido, criptografado, vazio ou acima do limite: rejeitar com erro acionável, sem agendar processamento.
- Job interrompido: manter estado recuperável, limitar tentativas e permitir reprocessamento manual.
- Conteúdo duplicado: reutilizar ou substituir a versão conforme hash e versão da estratégia, sem duplicar chunks ativos.
- Ticket repetido: retornar o ticket já criado para a mesma chave de idempotência.
- Saída inválida do modelo: rejeitar a estrutura, tentar uma reparação limitada e então usar fallback.

## 12. Segurança e privacidade

- Cookie `httpOnly`, `Secure` em produção, `SameSite` apropriado e proteção CSRF nas mutações autenticadas.
- Senhas com hash forte e limitação de tentativas de login.
- Validação de MIME, assinatura, tamanho e páginas dos PDFs.
- Nomes de arquivo gerados pelo sistema; nunca confiar em caminhos enviados.
- Separação de conteúdo `PUBLIC` e `INTERNAL` no armazenamento e no retrieval.
- Isolamento por `organizationId` em repositórios, busca vetorial, jobs e prefixos de armazenamento.
- O contexto da organização vem da sessão, conversa ou job validado; nunca de um campo confiado diretamente ao cliente.
- Proteção contra prompt injection: fontes não podem redefinir política, ferramentas ou autorização.
- Minimização de PII em mensagens, telemetria e logs.
- Segredos somente por variáveis de ambiente ou secret manager.

## 13. Qualidade e critérios de sucesso

- Toda afirmação factual da resposta possui ao menos uma citação válida ou o fluxo retorna fallback.
- Nenhum teste de cliente recupera fonte interna.
- Nenhum teste recupera ou altera dados de outra organização.
- A criação de ticket nunca ocorre antes de confirmação explícita.
- Reenvios com a mesma chave não duplicam ticket nem trabalho de ingestão.
- O dataset de avaliação mede recuperação, fidelidade, citações, fallback e resistência a prompt injection.
- Fluxos críticos possuem testes unitários, integração e E2E.
- O projeto executa por Docker Compose e possui documentação suficiente para demonstração.

O limiar de suficiência do retrieval será calibrado com o dataset de avaliação, versionado por estratégia e configurável; não deve ser baseado apenas em uma autodeclaração de confiança do modelo.

## 14. Fases de implementação

1. Fundação do monorepo, ambiente, contratos e ADRs.
2. Autenticação do atendente e sessões anônimas.
3. Domínio de conhecimento, upload seguro e armazenamento.
4. Worker, extração, chunking, embeddings e reindexação.
5. Retrieval autorizado, resposta estruturada, citações e avaliações.
6. Chat público, fallback e confirmação de abertura de ticket.
7. Domínio de tickets e painel do atendente.
8. Testes, segurança, observabilidade e deploy.

## 15. Riscos e mitigação

- Alucinação: resposta limitada ao contexto, validação de citações e fallback.
- Vazamento de fonte interna: filtro por visibilidade em duas etapas e testes de autorização.
- Prompt injection em documentos: conteúdo tratado como dado, prompts com limites e avaliações adversariais.
- Custo e latência: limites de contexto, cache seguro, métricas e adaptadores substituíveis.
- PDFs ruins: validação prévia, erros acionáveis e rastreabilidade do processamento.
- Complexidade prematura: uma organização padrão, dois tipos de fonte e nenhuma interface operacional multi-tenant no MVP.

## 16. Evolução futura para multi-tenant

O MVP não expõe cadastro, seleção ou administração de organizações. Para manter a evolução aberta:

- criar `Organization` e uma organização padrão na primeira migration;
- carregar `OrganizationContext` a partir de sessão, conversa ou job validado;
- exigir `organizationId` nas portas de repositório e nas consultas vetoriais;
- particionar caminhos de arquivos por organização;
- incluir organização em idempotência, unicidade e telemetria;
- manter configurações de IA globais no MVP, sem impedir configuração por organização no futuro;
- testar isolamento com duas organizações em fixtures, mesmo que apenas uma seja acessível pela interface.

Uma fase futura poderá adicionar onboarding, convites, papéis por organização, troca de contexto, limites de uso, personalização e cobrança sem redefinir os agregados principais.
