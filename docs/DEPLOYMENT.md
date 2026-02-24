# Деплой МГИМО AI

## Архитектура

SQLite **не поддерживается** на Vercel (read-only FS в serverless). Рекомендуемая схема:

- **Frontend** → Vercel (статический билд)
- **Backend** (Express + SQLite) → Railway или Render

## 1. Backend на Railway

1. [Railway](https://railway.app) → New Project → Deploy from GitHub
2. Подключите репозиторий, выберите корень проекта
3. Railway определит Node.js. Настройте:
   - **Build Command:** `npm install`
   - **Start Command:** `npx tsx server.ts`
   - **Root Directory:** `/`
   - Railway подставит `PORT` автоматически

4. Переменные окружения:
   - `GEMINI_API_KEY` — ключ Google AI
   - `CORS_ORIGIN` — URL фронтенда (например `https://mgimo.vercel.app`), или `*` для разработки

5. После деплоя скопируйте URL бэкенда (например `https://mgimo-api.up.railway.app`)

**Важно:** SQLite хранит данные в файле `lingoflow.db`. На Railway без volume данные теряются при перезапуске. Для продакшена добавьте Volume и укажите путь к БД через переменную.

## 2. Frontend на Vercel

1. [Vercel](https://vercel.com) → Import Project → GitHub
2. Выберите репозиторий
3. Vercel определит Vite. Проверьте:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

4. Переменные окружения:
   - `VITE_API_URL` — URL бэкенда (например `https://mgimo-api.up.railway.app`)

5. Deploy

## 3. Локальная разработка

Без `VITE_API_URL` фронтенд использует относительные пути (`/api/...`) — запросы идут на тот же origin (Express в dev).

```bash
npm run dev   # Express + Vite
```

## 4. Ошибка 405 (Method Not Allowed)

Если в консоли браузера видите `POST .../api/ai/words-by-topic 405`:

- **Причина:** Vercel раздаёт только статику. API-маршрутов на Vercel нет.
- **Решение:** Разверните бэкенд на Railway (шаг 1), затем задайте `VITE_API_URL` на Vercel (шаг 2) и пересоберите проект.

## 5. Альтернативы

- **Render** — вместо Railway, бесплатный tier
- **Turso** — serverless SQLite, если нужен весь стек на Vercel (потребует миграции БД)
- **Vercel Postgres** — PostgreSQL вместо SQLite
