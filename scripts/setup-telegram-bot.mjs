#!/usr/bin/env node
/**
 * Настройка Telegram-бота @MGIMOOUIZMODE_bot
 * Устанавливает: команды, описание, кнопку меню с Web App URL.
 *
 * Запуск:
 *   BOT_TOKEN=xxx APP_URL=https://your-app.vercel.app node scripts/setup-telegram-bot.mjs
 */

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;

if (!BOT_TOKEN) {
  console.error('Ошибка: задайте BOT_TOKEN');
  process.exit(1);
}

if (!APP_URL) {
  console.error('Ошибка: задайте APP_URL (URL развёрнутого приложения на Vercel)');
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
      { command: 'start', description: 'Запустить приложение МГИМО AI' },
      { command: 'app', description: 'Открыть словарь и обучение' },
    ],
    scope: { type: 'default' },
  });
  console.log('✓ Команды установлены');

  // 2. Краткое описание (под именем бота)
  await api('setMyShortDescription', {
    short_description: 'Изучайте академическую лексику по стандартам МГИМО с AI-тьютором',
    language_code: 'ru',
  });
  console.log('✓ Краткое описание установлено');

  // 3. Полное описание (в профиле)
  await api('setMyDescription', {
    description: `МГИМО AI — платформа для изучения иностранной лексики.

• Словарь с категориями и SRS-повторениями
• AI-генерация примеров, картинок и озвучки
• Квизы, истории и чат-тьютор
• Импорт из CSV, JSON, botengl

Нажмите кнопку меню или /start для запуска.`,
    language_code: 'ru',
  });
  console.log('✓ Описание установлено');

  // 4. Кнопка меню — Web App
  await api('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Открыть МГИМО AI',
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
