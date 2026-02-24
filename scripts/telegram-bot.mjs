#!/usr/bin/env node
/**
 * Telegram-бот @MGIMOOUIZMODE_bot — живой и интересный.
 * Отвечает на /start, /app, /tip, /remind. Расписание напоминаний каждые 6 ч.
 *
 * Запуск: BOT_TOKEN=xxx APP_URL=https://mgimo-ochre.vercel.app node scripts/telegram-bot.mjs
 * Деплой: можно запустить на Railway как отдельный worker.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REMINDERS_FILE = join(__dirname, '..', 'data', 'reminders.json');

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = (process.env.APP_URL || 'https://mgimo-ochre.vercel.app').replace(/\/$/, '');
const API_URL = (process.env.API_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

if (!BOT_TOKEN) {
  console.error('Ошибка: задайте BOT_TOKEN');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

function loadReminders() {
  try {
    if (existsSync(REMINDERS_FILE)) {
      return JSON.parse(readFileSync(REMINDERS_FILE, 'utf8'));
    }
  } catch {}
  return { chatIds: [] };
}

function saveReminders(data) {
  try {
    const dir = join(__dirname, '..', 'data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(REMINDERS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('saveReminders:', e.message);
  }
}

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

function sendWelcome(chatId, startPayload = '') {
  const refNote = startPayload.startsWith('ref_') ? `\n\n👥 Реферальная ссылка: ${startPayload}` : '';
  return api('sendMessage', {
    chat_id: chatId,
    text: `Привет! 👋

Я — МГИМО AI. Помогаю учить академическую лексику: дипломатия, право, экономика, политология.

📖 Словарь с умными повторениями
🤖 AI генерирует примеры, картинки, озвучку
📝 Истории и чат-тьютор для практики

Приложение открыто для всех — не только для студентов МГИМО. Нажми кнопку ниже и начни учиться!${refNote}`,
    reply_markup: {
      inline_keyboard: [[
        { text: '📖 Открыть приложение', web_app: { url: startPayload ? `${APP_URL}?ref=${encodeURIComponent(startPayload)}` : APP_URL } },
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

const CATEGORY_ALIASES = {
  'право': 1, 'международное право': 1, 'дипломатия': 2, 'макроэкономика': 3,
  'политология': 4, 'общая': 5, 'лексика': 5, 'бизнес': 6, 'медиа': 7,
};

function formatWord(w) {
  let text = `📖 ${w.word}\n\n`;
  if (w.transcription) text += `${w.transcription}\n\n`;
  if (w.translation) text += `${w.translation}\n\n`;
  if (w.example) {
    text += `Пример: "${w.example}"\n`;
    if (w.example_translation) text += `"${w.example_translation}"\n`;
  }
  if (w.category_name) text += `\n🏷 ${w.category_name}`;
  return text.trim();
}

async function sendWords(chatId, count = 1, categoryId = null) {
  try {
    let url = `${API_URL}/api/words/random?count=${count}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const { words } = await res.json();
    if (!words || words.length === 0) {
      return api('sendMessage', {
        chat_id: chatId,
        text: '📭 Словарь пуст. Добавьте слова в приложении — нажмите кнопку ниже.',
        reply_markup: { inline_keyboard: [[{ text: '📖 Открыть приложение', web_app: { url: APP_URL } }]] },
      });
    }
    for (const w of words) {
      await api('sendMessage', {
        chat_id: chatId,
        text: formatWord(w),
        reply_markup: { inline_keyboard: [[{ text: '📖 Открыть приложение', web_app: { url: APP_URL } }]] },
      });
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (e) {
    console.error('sendWords:', e.message);
    await api('sendMessage', {
      chat_id: chatId,
      text: '⚠️ Не удалось загрузить слова. Проверьте, что бэкенд запущен (API_URL).',
      reply_markup: { inline_keyboard: [[{ text: '📖 Открыть приложение', web_app: { url: APP_URL } }]] },
    });
  }
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
        const startPayload = msg.text?.startsWith('/start ') ? msg.text.slice(7).trim() : '';
        if (text === '/start' || text.startsWith('/start ')) {
          await sendWelcome(chatId, startPayload);
        } else if (text === '/remind') {
          const r = loadReminders();
          const idx = r.chatIds.indexOf(chatId);
          if (idx >= 0) {
            r.chatIds.splice(idx, 1);
            saveReminders(r);
            await api('sendMessage', { chat_id: chatId, text: '🔕 Напоминания отключены.' });
          } else {
            r.chatIds.push(chatId);
            saveReminders(r);
            await api('sendMessage', {
              chat_id: chatId,
              text: '🔔 Напоминания включены! Буду напоминать каждые 6 часов. Нажми кнопку ниже, чтобы открыть приложение.',
              reply_markup: { inline_keyboard: [[{ text: '📖 Открыть', web_app: { url: APP_URL } }]] },
            });
          }
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
        } else if (text === '/word' || text === '/daily') {
          await sendWords(chatId, 1);
        } else if (text === '/words' || text.startsWith('/words ')) {
          const arg = text.slice(6).trim();
          let count = 3;
          let categoryId = null;
          if (/^\d+$/.test(arg)) {
            count = Math.min(10, Math.max(1, parseInt(arg, 10)));
          } else if (arg) {
            const cat = CATEGORY_ALIASES[arg.toLowerCase()];
            if (cat) categoryId = cat;
          }
          await sendWords(chatId, count, categoryId);
        } else if (text.startsWith('/')) {
          await api('sendMessage', {
            chat_id: chatId,
            text: 'Команды: /start — приветствие, /app — открыть приложение, /word или /daily — слово дня, /words [N] — N слов, /tip — совет, /remind — вкл/выкл напоминания.',
          });
        }
      }
    } catch (e) {
      console.error('Poll error:', e.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function sendScheduledReminders() {
  const r = loadReminders();
  if (r.chatIds.length === 0) return;
  let dailyWord = null;
  try {
    const res = await fetch(`${API_URL}/api/words/random?count=1`);
    if (res.ok) {
      const data = await res.json();
      if (data.words?.length > 0) dailyWord = data.words[0];
    }
  } catch (e) {
    console.error('sendScheduledReminders: fetch word:', e.message);
  }
  for (const chatId of r.chatIds) {
    try {
      if (dailyWord) {
        await api('sendMessage', {
          chat_id: chatId,
          text: `📖 Слово дня\n\n${formatWord(dailyWord)}`,
          reply_markup: { inline_keyboard: [[{ text: '📖 Открыть приложение', web_app: { url: APP_URL } }]] },
        });
        await new Promise((x) => setTimeout(x, 400));
      }
      await api('sendMessage', {
        chat_id: chatId,
        text: '⏰ Пора повторить слова! Даже 5 минут в день дают результат.',
        reply_markup: { inline_keyboard: [[{ text: '📖 Открыть МГИМО AI', web_app: { url: APP_URL } }]] },
      });
    } catch (e) {
      if (e.message?.includes('blocked') || e.message?.includes('deactivated')) {
        r.chatIds = r.chatIds.filter((id) => id !== chatId);
        saveReminders(r);
      }
    }
    await new Promise((x) => setTimeout(x, 500));
  }
}

setInterval(sendScheduledReminders, 6 * 60 * 60 * 1000);
poll();
