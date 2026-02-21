# МГИМО AI — Языковая платформа

Профессиональная платформа для изучения иностранных языков по стандартам МГИМО. Поддержка Telegram Mini App.

## Возможности

- **Академический срез** — SRS-карточки для повторения терминов
- **Quiz Mode** — быстрый тест на знание слов
- **AI генерация** — новые термины через Gemini (перевод, транскрипция, примеры, мнемоника)
- **Smart Story** — истории с вашими словами
- **AI Тьютор** — диалог с виртуальным преподавателем
- **Произношение** — проверка через Web Speech API
- **Импорт/экспорт** — CSV, JSON, текст (для переноса из @mgimomobot и др.)
- **Поиск и сортировка** — словарь с фильтрами

## Перенос слов

### Из @mgimomobot
1. Экспортируйте слова в боте (если есть команда экспорта)
2. Словарь → Импорт → вставьте данные

### Из [botengl](https://github.com/ahmed11551/botengl)
См. [docs/BOTENGL-MIGRATION.md](docs/BOTENGL-MIGRATION.md) — экспорт из PostgreSQL и импорт в МГИМО.

### Поддерживаемые форматы импорта
   - **Текст:** `слово — перевод` (каждое с новой строки)
   - **CSV:** `word,translation,transcription,example` (первая строка — заголовок)
   - **JSON:** `[{"word":"...","translation":"..."}]`

## Запуск локально

**Требования:** Node.js 18+

1. Установить зависимости:
   ```bash
   npm install
   ```

2. Создать `.env` из примера и указать ключ Gemini:
   ```bash
   cp .env.example .env
   # Отредактировать .env: GEMINI_API_KEY="ваш_ключ"
   ```

3. Запустить:
   ```bash
   npm run dev
   ```

4. Открыть http://localhost:3000

## Сборка для production

```bash
npm run build
NODE_ENV=production npm run dev
```

## Telegram Mini App

1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Настройте Web App: `/newapp` или через BotFather → Bot Settings → Menu Button
3. Укажите URL вашего приложения (например, `https://your-domain.com`)
4. Приложение автоматически:
   - подключает Telegram Web App SDK
   - разворачивается на весь экран
   - применяет тему (header/background)

## Структура API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/words` | Список слов |
| POST | `/api/words` | Добавить слово |
| DELETE | `/api/words/:id` | Удалить слово |
| POST | `/api/words/:id/review` | Обновить SRS (quality: 0–3) |
| POST | `/api/words/import` | Импорт (format: json/csv/text, data) |
| GET | `/api/words/export?format=json\|csv` | Экспорт словаря |
| GET | `/api/stats` | Статистика |
| POST | `/api/ai/word-details` | AI: детали слова |
| POST | `/api/ai/word-image` | AI: картинка для слова |
| POST | `/api/ai/speech` | AI: озвучка |
| POST | `/api/ai/story` | AI: история |
| POST | `/api/ai/chat` | AI: чат-тьютор |
| POST | `/api/ai/words-by-topic` | AI: слова по теме |

## Технологии

- **Frontend:** React 19, Vite, Tailwind CSS, Motion
- **Backend:** Express, SQLite (better-sqlite3)
- **AI:** Google Gemini API
