# Base de conhecimento

## Limites implementados

- Artigos e PDFs pertencem à organização resolvida pela sessão do atendente. A API não aceita `organizationId` do cliente como autorização.
- Toda fonte possui tipo `ARTICLE` ou `PDF` e visibilidade `PUBLIC` ou `INTERNAL`.
- `id` identifica a família da fonte e permanece estável entre versões; `versionId` identifica uma versão específica.
- Alterar um artigo ou reenviar um PDF com `sourceId` cria uma versão quando título, visibilidade ou conteúdo mudam. Uma requisição sem mudanças devolve a versão atual.
- Versões novas começam com `indexingStatus=PENDING` e `active=false`. A ativação após indexação pertence à Fase 4.
- O histórico, o hash SHA-256 e a chave de armazenamento são persistidos, mas `contentHash` e `storageKey` não são expostos no contrato HTTP.
- A exclusão é lógica para todas as versões da família. Arquivos PDF são removidos do armazenamento local em melhor esforço.

## Proteção comum

Todos os caminhos abaixo usam o prefixo `/api/v1`, exigem cookie de sessão de atendente e operam somente na organização obtida no servidor. As mutações também exigem uma origem configurada em `WEB_ORIGIN` e o cabeçalho `x-csrf-token` emitido no login ou por `GET /api/v1/auth/csrf`.

Sessão ausente ou inválida retorna `401`; CSRF ausente ou origem não confiável retorna `403`. Uma fonte inexistente, excluída, de outro tipo ou de outra organização retorna `404`, sem revelar sua existência.

## Endpoints

| Método   | Caminho                          | Corpo ou filtro                    | Resultado                                                     |
| -------- | -------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `GET`    | `/knowledge/sources`             | Query opcional `type=ARTICLE\|PDF` | Versão mais recente de cada família                           |
| `GET`    | `/knowledge/sources/:id`         | `id` UUID v4 da família            | Versão mais recente da fonte                                  |
| `GET`    | `/knowledge/sources/:id/history` | `id` UUID v4 da família            | Histórico em ordem decrescente de versão                      |
| `GET`    | `/knowledge/articles`            | —                                  | Versão mais recente de cada artigo                            |
| `POST`   | `/knowledge/articles`            | JSON de criação                    | Cria artigo e versão 1; retorna `201`                         |
| `GET`    | `/knowledge/articles/:id`        | `id` UUID v4 da família            | Versão mais recente do artigo                                 |
| `PATCH`  | `/knowledge/articles/:id`        | JSON parcial de atualização        | Mantém ou cria a próxima versão                               |
| `DELETE` | `/knowledge/articles/:id`        | —                                  | Exclui logicamente a família; retorna `204`                   |
| `POST`   | `/knowledge/pdfs`                | `multipart/form-data`              | Cria um PDF ou uma nova versão; retorna `201`                 |
| `DELETE` | `/knowledge/pdfs/:id`            | —                                  | Exclui logicamente a família e remove arquivos; retorna `204` |

O filtro `type` com outro valor retorna `422` com código `TYPE_INVALID`. Campos desconhecidos são rejeitados pela validação global da API.

## Artigos

Criação:

```json
{
  "title": "Como redefinir a senha",
  "content": "Use o link de recuperação enviado por e-mail.",
  "visibility": "PUBLIC"
}
```

Atualização aceita qualquer subconjunto dos mesmos campos. O título, depois de remover espaços nas extremidades, deve ter de 3 a 160 caracteres. O conteúdo normaliza quebras de linha, remove espaços nas extremidades, deve conter ao menos uma letra ou número e respeitar `ARTICLE_MAX_CHARACTERS`.

## PDFs

O upload usa o campo binário `file` e os campos de texto `title` e `visibility`. O campo opcional `sourceId`, um UUID v4 de família, cria uma nova versão de um PDF já existente na mesma organização.

```text
Content-Type: multipart/form-data

file=<arquivo>
title=Guia de atendimento
visibility=INTERNAL
sourceId=<UUID opcional da família>
```

A API ignora o nome fornecido pelo cliente. Ela gera a chave `organizations/{organizationId}/knowledge/{familyId}/versions/{versionId}.pdf`, restringe leitura e remoção ao prefixo da organização, bloqueia escape da raiz e diretórios simbólicos e grava por arquivo temporário seguido de renomeação.

O PDF deve:

- não estar vazio e respeitar `PDF_MAX_BYTES`;
- declarar MIME `application/pdf` e começar com a assinatura `%PDF-`;
- ser analisável, não criptografado e respeitar `PDF_MAX_PAGES`;
- conter texto extraível com ao menos uma letra ou número.

## Resposta de fonte

```json
{
  "id": "4f8e8eec-2133-49e9-956c-00b994c58e71",
  "versionId": "c83f5729-e82e-4f36-8e57-6195d7593501",
  "type": "ARTICLE",
  "title": "Como redefinir a senha",
  "visibility": "PUBLIC",
  "content": "Use o link de recuperação enviado por e-mail.",
  "mimeType": null,
  "pageCount": null,
  "version": 1,
  "indexingStatus": "PENDING",
  "active": false,
  "createdAt": "2026-09-06T12:00:00.000Z",
  "updatedAt": "2026-09-06T12:00:00.000Z"
}
```

`content` é retornado somente para artigos. PDFs retornam `mimeType=application/pdf`, `pageCount` preenchido e não expõem os bytes pelo contrato atual.

## Erros de conteúdo

Erros de conteúdo retornam `422` no formato `{ "statusCode": 422, "code": "...", "message": "..." }`. Os códigos específicos são:

- artigos: `ARTICLE_EMPTY`, `ARTICLE_TOO_LARGE`, `TITLE_INVALID` e `VISIBILITY_INVALID`;
- PDFs: `PDF_REQUIRED`, `PDF_EMPTY`, `PDF_MIME_INVALID`, `PDF_SIGNATURE_INVALID`, `PDF_ENCRYPTED`, `PDF_TOO_MANY_PAGES`, `PDF_WITHOUT_EXTRACTABLE_TEXT` e `PDF_INVALID`;
- contrato: `TYPE_INVALID` e `PDF_MULTIPART_INVALID`.

Um PDF acima do limite retorna `413` e `PDF_TOO_LARGE`. Concorrência ao criar a mesma versão retorna `409` e `KNOWLEDGE_VERSION_CONFLICT`.

## Persistência e versionamento

O banco restringe a versão a valores positivos, mantém uma única combinação de organização, família e versão e permite no máximo uma versão ativa por família. Uma versão ativa obrigatoriamente possui `indexingStatus=SUCCEEDED`. Assim, uma versão pendente ou com falha não substitui automaticamente a versão ativa anterior; ao reduzir a visibilidade de `PUBLIC` para `INTERNAL`, porém, a versão pública ativa é desativada imediatamente para evitar exposição indevida.

O adaptador local implementa `FileStoragePort`, cujas operações recebem o escopo de organização. Um adaptador futuro de object storage pode substituir a infraestrutura sem alterar os casos de uso.

## Validação

```bash
npm test
npm run test:integration
npm run lint
npm run build
```

As suítes cobrem regras de artigo e PDF, path traversal e links simbólicos, restrições de versionamento, preservação da versão ativa, autenticação, CSRF e isolamento entre duas organizações.
