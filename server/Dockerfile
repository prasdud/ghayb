FROM oven/bun:1.2-alpine
WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY tsconfig.json ./

ENV NODE_ENV=production

CMD ["bun", "run", "src/index.ts"]
