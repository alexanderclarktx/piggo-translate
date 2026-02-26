FROM oven/bun:1.3.9

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
COPY core ./core
COPY api ./api

RUN bun install --frozen-lockfile

EXPOSE 5001

CMD ["bun", "--cwd", "api", "src/Api.ts"]
