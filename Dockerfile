FROM node:20.5-alpine AS base
WORKDIR /workspace
RUN apk add --no-cache git
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG SERVICE_NAME
RUN if [ -n "$SERVICE_NAME" ]; then pnpm --filter "$SERVICE_NAME" build; fi
ENV NODE_ENV=production
EXPOSE 3000
EXPOSE 4000
