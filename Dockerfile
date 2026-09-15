FROM node:22-alpine AS base
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --allow-build=prisma --allow-build=@prisma/engines --allow-build=@prisma/client --allow-build=unrs-resolver
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm exec prisma generate
RUN pnpm run build

FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --allow-build=prisma --allow-build=@prisma/engines --allow-build=@prisma/client --allow-build=unrs-resolver
COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
