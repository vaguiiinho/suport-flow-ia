1. Visão Geral e Princípios Fundamentais

Qualidade Pragmática: Mantenha forte isolamento arquitetural e alta cobertura de testes, mas minimize handoffs, loops de revisão e burocracia documental desnecessária.

Preservação de Camadas:

Domínio (domain): Regras de negócio puras, entidades e invariantes. Livre de frameworks (NestJS, Express, React, Prisma, etc.).

Aplicação (application): Casos de uso, orquestração e interfaces/portas.

Infraestrutura (infrastructure): Implementação de repositórios (ORMs/SQL), adapters externos e publishers de eventos.

Apresentação (presentation / UI): Controllers, APIs e Server/Client Components.

Voz e Contexto do Projeto: Respeite a estrutura existente e convenções de nomenclatura estabelecidas no repositório.

2. Padrões Técnicos Recomendados

Backend (NestJS / Node / TS)

Invariantes de negócio são validadas sempre dentro do domínio (Aggregates, Value Objects ou Domain Services).

Mantenha o acesso a banco encapsulado na infraestrutura. Prefira ORM para operações CRUD e reserva SQL explícito/parâmetros raw apenas para agregações complexas, locks (FOR UPDATE) ou performance crítica.

Publique eventos ou acione filas apenas se houver consumidores ativos ou necessidade explicitada de envio assíncrono (evite publicar eventos em memória sem assinantes).

Frontend (Next.js App Router)

Server Components por Padrão: Busque dados no servidor perto da fonte.

Client Components Localizados: Utilize 'use client' apenas na folha da árvore de componentes (para eventos de ponteiro, foco, formulários e APIs de DOM/navegador).

Chamadas de API e Segurança: Centralize o acesso a dados externos em módulos server-only e utilize Server Actions validadas para mutações. A autorização principal deve ocorrer no backend/servidor.

3. Orquestração de Subagentes e Workflows

Para otimizar o consumo de tokens e tempo de execução, utilize o fluxo adequado ao tamanho da tarefa:

A. Fluxo Enxuto (Lightweight)

Usado para: correções de bugs, ajustes de componentes existentes, pequenas refatorações ou tarefas de baixo impacto.

Spec Delta: Breve descrição do problema e do comportamento esperado.

Desenvolvimento (Dev): Implementação direta respeitando as convenções.

Verificação (QA): Execução de linter, typecheck e testes afetados.

Revisão: Leitura rápida. Apenas bloqueadores reais impedem o merge.

B. Fluxo Completo (Full Feature)

Usado para: novas funcionalidades transversais, mudanças em regras de domínio, segurança ou alterações arquiteturais.

Planner: Mapeamento de impactos nas camadas e definição de tarefas testáveis.

UI Designer (se houver UI nova): Definição de layout, estados de tela e acessibilidade.

Dev (Frontend/Backend): Implementação iterativa orientada por testes.

Tester: Garantia de cobertura unitária/integração e validação de regressões.

Reviewer: Auditoria estrita em modo leitura.

4. Regras de Handoff e Revisão (Anti-Looping)

Handoffs Concisos: Em cada transição entre agentes, envie apenas:

Resumo curto do que foi feito (max. 3 parágrafos).

Lista de arquivos criados/alterados.

Comandos executados e status dos testes (PASS/FAIL).

Bloqueadores ou dúvidas remanescentes.
(Não duplique código extenso nem relatórios completos no chat; use o diff do Git).

Critério de Rework na Revisão:

Itens Vermelhos (Bloqueadores): Quebra de arquitetura, vulnerabilidades de segurança, testes falhando ou regras de negócio violadas. Obrigatório corrigir antes de prosseguir.

Itens Amarelos / Verdes (Sugestões/Melhorias): Detalhes cosméticos ou refatorações opcionais. Aceitar a mudança, criar um ticket/note de follow-up e concluir o workflow.

Fallback de Modelos: Se o modelo primário configurado (opus/sonnet) estiver indisponível ou lento, utilize o modelo secundário disponível e registre a alteração no histórico do workflow sem interromper a entrega.

5. Estrutura de Documentação de Execuções (docs/)

docs/specs/: Especificações de produto e técnicas (o que fazer).

docs/adr/: Decisões de Arquitetura (o porquê de escolhas estruturais duradouras).

docs/runs/: Registro de execuções de tarefas complexas (quais agentes atuaram, divergências aceitas e estado final dos testes). Evite duplicar requisitos ou specs nos arquivos de run.

6. Comandos Utilitários de Verificação

Substitua os comandos abaixo pelos equivalentes no repositório atual:

# Execução de testes unitários e de integração
npm run test

# Verificação de tipos
npm run typecheck

# Análise estática / Linter
npm run lint

# Cobertura de testes
npm run test:cov
