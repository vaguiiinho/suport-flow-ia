# Orchestrator: Fluxo de Execução de Features e Tarefas

## Objetivo
Coordenar a execução de mudanças no projeto garantindo alta qualidade técnica, testes e rastreabilidade, otimizando o número de handoffs e evitando ciclos de rework desproporcionais.

## 1. Validação de Pré-requisitos e Modelos
1. **Verificação de Modelos:** Antes de iniciar a sequência, verifique a disponibilidade dos modelos configurados (`opus`/`sonnet`). Se houver indisponibilidade, acione o **fallback operacional** (utilizando o modelo disponível) e documente essa escolha no run.
2. **Definição de Escopo (Completo vs. Enxuto):**
   - **Caminho Completo (Features grandes, regras de domínio, segurança, migrações):** Aciona Planner $\rightarrow$ UI Designer (se houver impacto visual novo) $\rightarrow$ Frontend/Backend Dev $\rightarrow$ Tester $\rightarrow$ Reviewer.
   - **Caminho Enxuto (Ajustes pontuais, correções locais, refatorações menores ou bugs isolados):** Ignora Planner pesado e UI Designer se não houver criação de tela/componente estrutural. Vai direto para Spec Delta curta $\rightarrow$ Dev $\rightarrow$ Tester $\rightarrow$ Reviewer único.

## 2. Etapas de Execução
- **Etapa 1: Planejamento / Spec**
  - Crie ou ajuste a spec delta da tarefa em `docs/specs/`.
- **Etapa 2: Design (Condicional)**
  - Acionar o `ui-designer` apenas se houver criação de novas telas, fluxos de navegação ou componentes visuais inéditos.
- **Etapa 3: Implementação**
  - Executada pelo desenvolvedor responsável (`frontend-dev` ou `backend-dev`).
  - **Handoff Otimizado:** O agente deve retornar apenas: um resumo curto, a lista de arquivos alterados, comandos executados e eventuais bloqueadores. O orquestrador obtém os detalhes via diff do Git quando necessário.
- **Etapa 4: Verificação e Testes**
  - O `tester` executa as suítes relevantes (`npm test`, typecheck, linter).
  - Distinga claramente entre falhas de baseline pré-existentes e falhas geradas pela mudança atual.
- **Etapa 5: Revisão Final**
  - O `reviewer` audita o código em modo estrito.
  - **Regra de Ouro da Revisão:** Ciclos adicionais de correção são obrigatórios **apenas para bloqueadores** (bugs, riscos de segurança, regressões ou quebras arquiteturais). Sugestões cosméticas e itens amarelos devem ser aceitos ou convertidos em follow-up para evitar loops excessivos de custo.

## 3. Fechamento e Rastreabilidade
1. Garanta que a documentação em `docs/runs/` registre de forma concisa os agentes acionados, decisões alteradas e o resultado dos testes finais.
2. Confirme que o commit final consolida a entrega com os testes passando.