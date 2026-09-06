FROM node:24-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run db:generate && npm run build:shared && npm run build:api

FROM node:24-alpine AS runtime
WORKDIR /app/apps/api
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/healthcheck.mjs ./healthcheck.mjs
EXPOSE 3001
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma && node ./prisma/seed.mjs && node ./dist/main.js"]
