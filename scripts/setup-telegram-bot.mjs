#!/usr/bin/env node
/**
 * Настройка Telegram-бота @MGIMOOUIZMODE_bot
 * Устанавливает: команды, описание, кнопку меню с Web App URL.
 *
 * Запуск:
 *   BOT_TOKEN=xxx APP_URL=https://mgimo-ochre.vercel.app node scripts/setup-telegram-bot.mjs
 */

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = (process.env.APP_URL || 'https://mgimo-ochre.vercel.app').replace(/\/$/, '');

if (!BOT_TOKEN) {
  console.error('Ошибка: задайте BOT_TOKEN');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function api(method, body = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || JSON.stringify(data));
  }
  return data;
}

async function main() {
  console.log('Настройка бота @MGIMOOUIZMODE_bot...\n');

  // 1. Команды бота
  await api('setMyCommands', {
    commands: [
      { command: 'start', description: '🚀 Открыть приложение' },
      { command: 'app', description: '📚 Словарь и обучение' },
      { command: 'word', description: '📖 Случайное слово' },
      { command: 'daily', description: '📖 Слово дня' },
      { command: 'words', description: '📖 Несколько слов (1–10)' },
      { command: 'tip', description: '💡 Случайный совет' },
      { command: 'remind', description: '🔔 Вкл/выкл напоминания' },
    ],
    scope: { type: 'default' },
  });
  console.log('✓ Команды установлены');

  // 2. Краткое описание (под именем бота)
  await api('setMyShortDescription', {
    short_description: 'Академическая лексика + AI-тьютор. Дипломатия, право, экономика — учись как профи.',
    language_code: 'ru',
  });
  console.log('✓ Краткое описание установлено');

  // 3. Полное описание (в профиле)
  await api('setMyDescription', {
    description: `🎓 МГИМО AI — твой личный тренажёр для академического английского

📖 Словарь с SRS — повторяй умно, не зубри
🤖 AI генерирует примеры, картинки и озвучку
📝 Истории и чат-тьютор — практика в контексте
📥 Импорт из CSV, JSON, botengl

Приложение открыто для всех, кто хочет прокачать профессиональную лексику. Нажми кнопку меню 👇`,
    language_code: 'ru',
  });
  console.log('✓ Описание установлено');

  // 4. Кнопка меню — Web App
  await api('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '📖 Открыть приложение',
      web_app: { url: APP_URL },
    },
  });
  console.log('✓ Кнопка меню (Web App) установлена →', APP_URL);

  console.log('\nГотово. Бот настроен.');
}

main().catch((e) => {
  console.error('Ошибка:', e.message);
  process.exit(1);
});
