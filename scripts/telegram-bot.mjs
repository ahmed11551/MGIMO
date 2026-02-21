#!/usr/bin/env node
/**
 * Telegram-бот @MGIMOOUIZMODE_bot — живой и интересный.
 * Отвечает на /start, /app, /tip. Кнопка меню открывает приложение.
 *
 * Запуск: BOT_TOKEN=xxx APP_URL=https://mgimo-ochre.vercel.app node scripts/telegram-bot.mjs
 * Деплой: можно запустить на Railway как отдельный worker.
 */

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = (process.env.APP_URL || 'https://mgimo-ochre.vercel.app').replace(/\/$/, '');

if (!BOT_TOKEN) {
  console.error('Ошибка: задайте BOT_TOKEN');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const TIPS = [
  'Повторяй слова в контексте — одно предложение лучше десяти карточек.',
  'SRS работает: не пропускай дни, даже 5 минут в день дают результат.',
  'Используй AI-тьютора: задавай вопросы по своим словам, практикуй диалог.',
  'Генерируй истории — мозг запоминает через нарратив.',
  'Озвучка помогает: слушай и повторяй вслух.',
  'Добавляй слова по темам: дипломатия, право, экономика — учи блоками.',
  'Quiz Mode прокачивает узнавание: делай перед сном.',
  'Импортируй старые списки — не начинай с нуля.',
  'Категории — твой друг: фокус на одной области за раз.',
  'Streak мотивирует: не рви цепочку 🔥',
];

async function api(method, body = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || JSON.stringify(data));
  return data;
}

function sendWelcome(chatId) {
  return api('sendMessage', {
    chat_id: chatId,
    text: `Привет! 👋

Я — МГИМО AI. Помогаю учить академическую лексику: дипломатия, право, экономика, политология.

📖 Словарь с умными повторениями
🤖 AI генерирует примеры, картинки, озвучку
📝 Истории и чат-тьютор для практики

Приложение открыто для всех — не только для студентов МГИМО. Нажми кнопку ниже и начни учиться!`,
    reply_markup: {
      inline_keyboard: [[
        { text: '📖 Открыть приложение', web_app: { url: APP_URL } },
      ]],
    },
  });
}

function sendTip(chatId) {
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  return api('sendMessage', {
    chat_id: chatId,
    text: `💡 Совет:\n\n${tip}\n\n📖 Открыть приложение и применить?`,
    reply_markup: {
      inline_keyboard: [[
        { text: '📖 Открыть', web_app: { url: APP_URL } },
      ]],
    },
  });
}

async function poll() {
  let offset = 0;
  console.log('Бот запущен. Ожидание сообщений...\n');
  while (true) {
    try {
      const { result } = await api('getUpdates', { offset, timeout: 30 });
      for (const u of result) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (!msg?.text) continue;
        const chatId = msg.chat.id;
        const text = msg.text.trim().toLowerCase();
        if (text === '/start' || text === '/start start') {
          await sendWelcome(chatId);
        } else if (text === '/app') {
          await api('sendMessage', {
            chat_id: chatId,
            text: 'Открываю приложение 👇',
            reply_markup: {
              inline_keyboard: [[
                { text: '📖 Открыть МГИМО AI', web_app: { url: APP_URL } },
              ]],
            },
          });
        } else if (text === '/tip') {
          await sendTip(chatId);
        } else if (text.startsWith('/')) {
          await api('sendMessage', {
            chat_id: chatId,
            text: 'Используй /start чтобы начать, /app чтобы открыть приложение, /tip для совета по изучению.',
          });
        }
      }
    } catch (e) {
      console.error('Poll error:', e.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

poll();
