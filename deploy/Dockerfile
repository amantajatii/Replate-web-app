FROM node:24-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/prisma.config.ts
RUN pnpm install --frozen-lockfile
COPY backend backend
COPY frontend frontend
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm build

FROM build AS api
WORKDIR /app/backend
ENV NODE_ENV=production PORT=5000 UPLOAD_DIR=/data/uploads MENU_UPLOAD_DIR=/data/menu-uploads
RUN mkdir -p /data/uploads /data/menu-uploads && chown -R node:node /data
USER node
EXPOSE 5000
CMD ["node", "dist/server.js"]

FROM caddy:2 AS web
COPY --from=build /app/frontend/out /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
