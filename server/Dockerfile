# MeshVoice backend — многостадийная сборка.
# Node 22.5+ обязателен: сервер использует встроенный node:sqlite (DatabaseSync),
# никаких нативных зависимостей компилировать не нужно.

# ---- Стадия сборки: ставим все зависимости и компилируем TS → dist/ ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Стадия рантайма: только прод-зависимости + собранный dist/ ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Только production-зависимости (без typescript и @types)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Собранный код
COPY --from=build /app/dist ./dist

# Каталоги данных: БД (через DB_PATH) кладём в /data, загрузки — в /app/uploads.
# Оба монтируются томами в docker-compose, чтобы данные переживали пересборку.
RUN mkdir -p /data /app/uploads

# По умолчанию база лежит на persistent-томе, а не рядом с кодом.
ENV DB_PATH=/data/meshvoice.db
ENV PORT=3000
EXPOSE 3000

# Работаем под непривилегированным пользователем node (есть в базовом образе).
# Права на каталоги данных выдаёт docker-compose/volume; на всякий случай chown.
RUN chown -R node:node /data /app/uploads
USER node

CMD ["node", "dist/index.js"]
