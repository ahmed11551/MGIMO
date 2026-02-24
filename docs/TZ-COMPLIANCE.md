# Соответствие ТЗ (TZ-FULL-2026) текущему состоянию проекта

**Дата:** 24.02.2026  
**Ссылка на ТЗ:** [docs/TZ-FULL-2026.md](TZ-FULL-2026.md)

ТЗ написано под стек Next.js + Supabase/PostgreSQL + OpenAI. Фактический проект реализован на **React + Vite + Express + SQLite + Google Gemini**. Ниже — что уже есть, что частично закрыто и что остаётся по ТЗ.

---

## 1. Фронтенд

| Требование ТЗ | Статус | Реализация в проекте |
|---------------|--------|------------------------|
| Адаптивный дизайн | ✅ | Tailwind, max-w-md, responsive |
| Локализация RU/EN (i18n) | ❌ | Только русский интерфейс |
| Тёмная/светлая тема, localStorage | ✅ | `mgimo-dark`, переключатель в Настройках |
| Главная: счётчики из бэкенда | ✅ | Слов в базе, на сегодня, цель дня, streak |
| Академический срез: карточки, SRS | ✅ | Флэш-карты, 4 кнопки SRS (Again/Hard/Good/Easy) |
| Quiz: мульти-выбор, 5–10 вопросов | ✅ | Режимы: Слово→перевод, Перевод→слово, Заполни пропуск (Cloze) |
| Quiz: ввод текста | ❌ | Только выбор из 4 вариантов (см. TZ-UNIQUE-FEATURES — режим ввода планировался) |
| Новый термин: ручной ввод + AI | ✅ | Одно слово + генерация по 7 темам (Gemini) |
| AI: термин, перевод, примеры | ✅ | word-details, words-by-topic (перевод, транскрипция, пример, мнемоника) |
| Словарь: Все, Избранные, Архив | ⚠️ | Есть «Все», поиск и фильтр по категории; нет «Избранные»/«Архив» |
| Словарь: поиск, фильтры | ✅ | Поиск, сортировка (А–Я, уровень, к повтору), категории |
| Экспорт CSV/PDF | ⚠️ | CSV и JSON; PDF нет |
| Аутентификация | ❌ | Нет логина/регистрации |
| Прогресс: графики, ежедневные цели | ⚠️ | Цель дня (N слов), streak; графиков (Chart.js) нет |
| Push-уведомления | ✅ | Browser Notification API, напоминания в боте (/remind) |
| Глобальный поиск | ✅ | Поиск в разделе «Весь словарь» |
| Next.js | ❌ | Используется **Vite + React** |
| Redux/Context | ⚠️ | Локальный state (useState), без глобального стора |
| Tailwind CSS | ✅ | Tailwind 4 |
| Lazy loading, code splitting | ⚠️ | Частично (один бандл), PWA-плагин есть |

---

## 2. Бэкенд

| Требование ТЗ | Статус | Реализация в проекте |
|---------------|--------|------------------------|
| Serverless (Vercel/Lambda) | ❌ | **Express** (деплой на Railway/аналог) |
| PostgreSQL/MongoDB (Supabase и т.п.) | ❌ | **SQLite** (lingoflow.db) |
| Таблица users | ❌ | Нет |
| Таблица terms (user_id, word, translation, …) | ⚠️ | Есть таблица **words** (без user_id): word, translation, transcription, example, category_id, level, next_review |
| Таблица progress | ⚠️ | Есть **stats** (date, words_learned, streak), без привязки к user |
| GET /api/terms с пагинацией | ⚠️ | GET /api/words (без пагинации), GET /api/words/random |
| POST /api/terms | ✅ | POST /api/words |
| PUT /api/terms/:id (review) | ✅ | POST /api/words/:id/review |
| GET /api/quiz | ⚠️ | Квиз считается на фронте из /api/words |
| POST /api/auth | ❌ | Нет |
| AI: OpenAI GPT | ❌ | Используется **Google Gemini API** |
| Приватность (GDPR) | ⚠️ | Нет персональных данных без auth |

**Реальные API:**  
`/api/categories`, `/api/words`, `/api/words/random`, `/api/words/import`, `/api/words/export`, `/api/words/:id/review`, `/api/stats`, `/api/health`, `/api/ai/word-details`, `/api/ai/word-image`, `/api/ai/speech`, `/api/ai/story`, `/api/ai/chat`, `/api/ai/words-by-topic`.

---

## 3. Интеграции

| Требование ТЗ | Статус | Реализация в проекте |
|---------------|--------|------------------------|
| AI (OpenAI/Gemini в env) | ✅ | **Gemini** (GEMINI_API_KEY), ключ только на бэкенде |
| Аутентификация (NextAuth/Firebase) | ❌ | Нет |
| Аналитика (GA, Vercel Analytics) | ❌ | Нет |
| Файлы (Blob/S3) | ⚠️ | Картинки/озвучка — base64 из AI, без отдельного хранилища |
| MGIMO API | ❌ | Нет |
| **Telegram Mini App + бот** | ✅ | Не в ТЗ, но есть: Web App, /start, /app, /word, /daily, /words, /tip, /remind, слово дня в рассылке |

---

## 4. Нефункциональные требования

| Требование ТЗ | Статус |
|---------------|--------|
| Загрузка < 2 с, API < 500 ms | ⚠️ | Зависит от хостинга; кэширования (Redis) нет |
| HTTPS, CORS | ✅ | CORS в Express, HTTPS на Vercel/Railway |
| Rate-limiting | ❌ | Нет |
| XSS/CSRF | ⚠️ | Защита фреймворка; явного CSRF нет |
| Пароли (bcrypt) | ❌ | Нет auth |
| WCAG, ARIA, клавиатура | ⚠️ | focus-visible, часть aria-label |
| Масштабируемость 1000+ | ⚠️ | SQLite и один инстанс — ограничение |
| PWA (manifest, offline) | ⚠️ | vite-plugin-pwa есть, manifest нужно проверить |

---

## 5. Тестирование

| Требование ТЗ | Статус |
|---------------|--------|
| Unit (Jest + RTL) | ❌ |
| Integration (Supertest) | ❌ |
| E2E (Cypress/Playwright) | ❌ |
| Load (Artillery) | ❌ |
| Security audit | ❌ |
| Seed 100+ терминов | ⚠️ | Есть начальный seed (10 слов МГИМО), не 100+ |

---

## 6. Deployment и поддержка

| Требование ТЗ | Статус |
|---------------|--------|
| Vercel | ✅ | Фронт на Vercel |
| Custom domain mgimo-ai.ru | ❌ | Используется mgimo-ochre.vercel.app |
| CI/CD (GitHub Actions) | ❌ |
| Sentry, мониторинг | ❌ |
| README, API docs (Swagger) | ⚠️ | README есть, Swagger нет |
| User guide | ⚠️ | Частично в README и docs |

---

## 7. Приоритеты доработки по ТЗ

Если ориентироваться на ТЗ как на целевое состояние, разумный порядок работ:

1. **Высокий приоритет**
   - Аутентификация (логин/регистрация или OAuth) и привязка слов к user_id.
   - Локализация (i18n, RU/EN).
   - Экспорт в PDF (или явное решение «только CSV/JSON» в ТЗ).

2. **Средний приоритет**
   - Вкладки «Избранные» и «Архив» в словаре.
   - Режим квиза «ввод текста» (перевод с клавиатуры).
   - Графики прогресса (Chart.js или аналог).
   - Unit/Integration тесты, CI (build + test).

3. **Низкий приоритет / опционально**
   - Миграция на Next.js (если нужны SSR/SSG и API routes в одном репо).
   - Миграция на PostgreSQL + serverless (если нужна мультитенантность и масштаб).
   - Swagger, Sentry, load-тесты.

Текущий проект уже даёт рабочий MVP: академическая лексика, SRS, квизы, AI (Gemini), Telegram, цель дня, слово дня. ТЗ описывает более «корпоративный» вариант с auth, мультипользователем и другим стеком.

**Объём работ под наш проект (без смены стека, хостинг play2go.cloud):** см. [TZ-SCOPE.md](TZ-SCOPE.md).
