FROM node:22-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

FROM base AS dependencies

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY apps/api apps/api

RUN pnpm --filter api build

FROM base AS production-dependencies

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --filter api --prod --frozen-lockfile

FROM node:22-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PROMPT_REGISTRY_PATH=/app/apps/api/dist/shared/application/prompts/issue-triage
ENV API_VERSION_FILE=/app/apps/api/package.json

RUN apk add --no-cache curl && addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=production-dependencies /workspace/node_modules /app/node_modules
COPY --from=production-dependencies /workspace/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /workspace/apps/api/dist /app/apps/api/dist
COPY --from=build /workspace/apps/api/package.json /app/apps/api/package.json

WORKDIR /app/apps/api

USER appuser

EXPOSE 3000

CMD ["node", "dist/src/index.js"]
