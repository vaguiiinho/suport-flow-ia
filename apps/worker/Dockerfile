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
RUN npm run build:shared && npm run build:worker

FROM node:24-alpine AS runtime
WORKDIR /app/apps/worker
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/worker/package.json ./package.json
COPY --from=build /app/apps/worker/dist ./dist
COPY --from=build /app/apps/worker/healthcheck.mjs ./healthcheck.mjs
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads /app/apps/worker
USER node
EXPOSE 3002
CMD ["npm", "run", "start"]
