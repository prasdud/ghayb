FROM oven/bun:1.2-alpine
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY drizzle ./drizzle
COPY tsconfig.json drizzle.config.ts ./

ENV NODE_ENV=production

CMD ["sh", "-c", "bun run src/db/migrate.ts && bun run src/index.ts"]
