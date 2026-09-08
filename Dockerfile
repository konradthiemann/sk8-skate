# syntax=docker/dockerfile:1

# ---- Stage 1: build the static bundle -------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

RUN npm install -g pnpm@10.18.3

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build-time configuration (Railway passes service variables as build args)
ARG VITE_API_URL
ARG VITE_API_KEY
ARG VITE_TELEMETRY=on
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_API_KEY=${VITE_API_KEY} \
    VITE_TELEMETRY=${VITE_TELEMETRY}

RUN pnpm build

# ---- Stage 2: serve with Caddy ---------------------------------------------
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
