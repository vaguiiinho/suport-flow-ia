FROM node:24-alpine AS base
WORKDIR /app

FROM base AS dependencies

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run db:generate && npm run build:shared && npm run build:api

FROM base AS production-dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
RUN npm ci --omit=dev \
      --workspace @support-flow/api \
      --workspace @support-flow/shared \
      --include-workspace-root=false \
    && npm cache clean --force

FROM node:24-alpine AS runtime
WORKDIR /app/apps/api
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules /app/node_modules
COPY --from=production-dependencies /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/healthcheck.mjs ./healthcheck.mjs
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads /app/apps/api
USER node
EXPOSE 3001
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma && node ./prisma/seed.mjs && node ./dist/main.js"]
