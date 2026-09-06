# Runbook operacional

## Subida e validação

1. Configure os segredos e variáveis descritos em [ambiente.md](ambiente.md).
2. Gere o cliente Prisma e aplique somente migrations versionadas:

   ```bash
   npm run db:generate
   npm run db:migrate:deploy
   ```

3. Suba a pilha e confira os endpoints `/api/health`, `/api/v1/health` e `/health`.
4. Execute `npm run test:integration` contra PostgreSQL/pgvector migrado antes de promover uma imagem.

## Backup e restauração

O backup precisa incluir PostgreSQL e os arquivos da base de conhecimento. Para PostgreSQL, execute no ambiente autorizado:

```bash
pg_dump --format=custom --file=support-flow.dump "$DATABASE_URL"
pg_restore --clean --if-exists --dbname="$DATABASE_URL" support-flow.dump
```

Para armazenamento local, copie o diretório configurado em `FILE_STORAGE_ROOT` com permissões preservadas. Restaure o banco antes dos arquivos e valide uma fonte PDF e uma recuperação pública antes de reabrir o tráfego.

## Rollback

Não use rollback automático de migrations em produção. Se uma versão falhar:

1. Pare a promoção e volte a imagem da API/web/worker anterior.
2. Preserve logs correlacionados pelo `X-Request-Id` e o estado dos jobs.
3. Restaure backup somente quando a migration tiver alterado dados de forma incompatível.
4. Registre uma migration corretiva para o próximo deploy; nunca edite uma migration já aplicada.

## Incidentes

- Provedor de IA indisponível: o assistente deve retornar fallback, sem inventar resposta; acompanhe taxa de fallback e ofereça ticket confirmado.
- Ingestão falha: consulte o job e use o reprocessamento administrativo após corrigir a causa.
- Suspeita de vazamento: suspenda a fonte, preserve evidências mínimas e revise os filtros de organização/visibilidade antes de reativá-la.
