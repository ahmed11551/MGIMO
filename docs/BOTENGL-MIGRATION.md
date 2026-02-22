# Миграция из botengl в МГИМО AI

[botengl](https://github.com/ahmed11551/botengl) — Telegram-бот для изучения английского с квизами, темами и подпиской. Ниже — как перенести слова в МГИМО AI.

## Структура данных botengl

| botengl (PostgreSQL) | МГИМО AI (SQLite) |
|----------------------|-------------------|
| `words.word`         | `word`            |
| `words.translation`  | `translation`     |
| `words.sentence`     | `example`         |
| `words.url_audio`    | `audio_url`       |
| `levels` / `categories` | — (не переносятся) |

## Способ 1: Экспорт через Python

1. Клонируйте botengl рядом с MGIMO:
   ```bash
   cd ..
   git clone https://github.com/ahmed11551/botengl.git
   cd botengl && cp env.example .env  # настройте DATABASE_*
   ```

2. Экспорт слов:
   ```bash
   cd MGIMO
   pip install sqlalchemy[asyncio] asyncpg python-dotenv
   python scripts/export-botengl-words.py > words.json
   ```

3. Импорт в МГИМО:
   - Откройте приложение → Словарь → Импорт
   - Формат: JSON
   - Вставьте содержимое `words.json`

## Способ 2: Прямой SQL-экспорт

Если есть доступ к PostgreSQL botengl:

```sql
COPY (
  SELECT json_agg(json_build_object(
    'word', word,
    'translation', translation,
    'sentence', sentence,
    'url_audio', url_audio
  ))
  FROM words
) TO STDOUT;
```

Сохраните вывод в файл и импортируйте в МГИМО как JSON.

## Что можно взять из botengl

| Функция botengl | В МГИМО AI |
|-----------------|------------|
| Квиз (word, translation, options) | ✅ Quiz Mode + 2 режима (слово→перевод, перевод→слово) |
| Аудио (gTTS) | ✅ Gemini TTS |
| Темы/теория | ✅ Smart Story, AI Тьютор |
| Уровни/категории | ✅ 7 категорий + темы для AI |
| Подписка/платежи | — |
| LearnWord (прогресс) | ✅ SRS (level, next_review) |
| WordDeliveryService (напоминания) | ✅ /remind в боте, каждые 6 ч |
| Рефералы | ✅ t.me/bot?start=ref_XXX |

## Формат JSON для импорта

МГИМО принимает массив объектов:

```json
[
  {"word": "hello", "translation": "привет", "sentence": "Hello, world!", "url_audio": "https://..."},
  {"word": "bilateral", "translation": "двусторонний", "example": "Bilateral agreement."}
]
```

Поддерживаемые поля: `word`, `translation`, `transcription`/`ipa`, `example`/`sentence`, `audio_url`/`url_audio`.
