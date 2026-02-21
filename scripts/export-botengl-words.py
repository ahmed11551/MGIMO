#!/usr/bin/env python3
"""
Экспорт слов из botengl (PostgreSQL) в JSON для импорта в МГИМО AI.

Использование:
  1. Установите зависимости: pip install sqlalchemy asyncpg python-dotenv
  2. Настройте .env из botengl (DATABASE_*)
  3. Запустите: python scripts/export-botengl-words.py > words.json
  4. В МГИМО: Словарь → Импорт → вставьте содержимое words.json, формат JSON
"""

import asyncio
import json
import os
from pathlib import Path

# Загружаем .env из botengl (../botengl) или текущей директории
for env_path in [
    Path(__file__).resolve().parent.parent.parent / "botengl" / ".env",
    Path(__file__).resolve().parent.parent / ".env",
    Path.cwd() / ".env",
]:
    if env_path.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_path)
        except ImportError:
            pass
        break

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql+asyncpg://{os.getenv('DATABASE_USER', 'postgres')}:{os.getenv('DATABASE_PASSWORD', '')}@{os.getenv('DATABASE_HOST', 'localhost')}:{os.getenv('DATABASE_PORT', '5432')}/{os.getenv('DATABASE_NAME', os.getenv('DATABASE_USERNAME', 'postgres'))}"
)


async def export_words():
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import text
    except ImportError:
        print('{"error": "Установите: pip install sqlalchemy[asyncio] asyncpg"}', file=__import__('sys').stderr)
        return []

    engine = create_async_engine(DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"))
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(text("""
            SELECT w.word, w.translation, w.sentence, w.url_audio
            FROM words w
            ORDER BY w.word
        """))
        rows = result.fetchall()

    words = [
        {
            "word": r[0],
            "translation": r[1] or "",
            "sentence": r[2] or "",
            "url_audio": r[3] or None,
        }
        for r in rows
    ]
    return words


if __name__ == "__main__":
    words = asyncio.run(export_words())
    if isinstance(words, list) and words:
        print(json.dumps(words, ensure_ascii=False, indent=2))
    elif isinstance(words, list):
        print("[]")
    else:
        print(json.dumps(words))
