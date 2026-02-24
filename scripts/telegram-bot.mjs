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

// In-memory state для ролевых сценариев и квиза
// chatId -> { mode: 'diplomat' | 'exam', history: { role, text }[] }
const roleplayState = new Map();
// chatId -> { questions: QuizQuestion[], index: number, score: number }
const quizState = new Map();

function loadReminders() {
  try {
    if (existsSync(REMINDERS_FILE)) {
      const data = JSON.parse(readFileSync(REMINDERS_FILE, 'utf8'));
      // Поддержка старого формата { chatIds: [] } или просто массива
      if (!data || Array.isArray(data)) {
        return { chatIds: Array.isArray(data) ? data : [], missions: {} };
      }
      if (!data.chatIds) data.chatIds = [];
      if (!data.missions) data.missions = {};
      return data;
    }
  } catch {}
  return { chatIds: [], missions: {} };
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

const MISSIONS = [
  'Возьми 5 сложных слов из своего словаря и составь по одному предложению к каждому. Можешь прислать их сюда — я дам фидбэк.',
  'Выбери тему (дипломатия, право, экономика) и напиши мини-абзац из 3–4 предложений, используя минимум 3 целевых слова.',
  'Опиши свой день в формате краткого брифинга для посла: 4–5 предложений, формальный стиль.',
  'Сформулируй позицию государства по одной актуальной теме (санкции, климат, безопасность) в 4–5 предложениях.',
  'Напиши письмо коллеге-дипломату с просьбой о встрече: приветствие, цель, время, вежливое завершение.',
];

const ROLEPLAY_SCENARIOS = {
  diplomat:
    'Ты экзаменатор на устном собеседовании в МГИМО по направлению «Международные отношения». Задавай вопросы на английском про дипломатию, переговоры, международные организации. По каждому ответу давай короткий фидбэк и оценку от 1 до 10. Не используй русский язык.',
  exam:
    'Ты строгий экзаменатор по международному праву на английском языке. Задавай по одному вопросу, проси приводить примеры и давать определения. Отвечай только на английском. После каждого ответа давай краткий комментарий и балл от 1 до 10.',
};

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

function getDailyMissionText() {
  const today = new Date().toISOString().split('T')[0];
  const seed = today
    .split('-')
    .map((x) => parseInt(x, 10) || 0)
    .reduce((a, b) => a + b, 0);
  const idx = Math.abs(seed) % MISSIONS.length;
  return `🎯 Миссия на сегодня (${today}):\n\n${MISSIONS[idx]}\n\nМожешь выполнить её прямо в чате или в приложении.`;
}

async function sendMission(chatId) {
  try {
    const text = getDailyMissionText();
    await api('sendMessage', {
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: '📖 Открыть приложение', web_app: { url: APP_URL } }]],
      },
    });
  } catch (e) {
    console.error('sendMission:', e.message);
  }
}

async function sendProfile(chatId) {
  try {
    const res = await fetch(`${API_URL}/api/stats`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const { total, due, streak, todayReviewed } = await res.json();
    const text = `📊 Профиль прогресса\n\n` +
      `Слов в словаре: ${total}\n` +
      `На повторение: ${due}\n` +
      `Серия дней (streak): ${streak} 🔥\n` +
      `Сегодня выучено / повторено: ${todayReviewed}\n\n` +
      `Продолжай в том же духе! Открой приложение, чтобы увидеть детальную аналитику.`;

    await api('sendMessage', {
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: '📖 Открыть приложение', web_app: { url: APP_URL } }]],
      },
    });
  } catch (e) {
    console.error('sendProfile:', e.message);
    await api('sendMessage', {
      chat_id: chatId,
      text: '⚠️ Не удалось загрузить профиль. Проверьте, что бэкенд (API_URL) запущен.',
    });
  }
}

async function startRoleplay(chatId, rawMode) {
  const mode = rawMode === 'exam' ? 'exam' : 'diplomat';
  const systemPrompt = ROLEPLAY_SCENARIOS[mode];
  roleplayState.set(chatId, { mode, history: [] });
  try {
    const res = await fetch(`${API_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message:
          `Начни ролевую игру в режиме "${mode}". Дай первое задание или вопрос только на английском, максимум в двух-трёх предложениях. Не пиши перевод и не используй русский язык.`,
        history: [],
        targetWords: [],
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    const reply = json.response || 'Let\'s start our roleplay. Please answer in English.';
    const state = roleplayState.get(chatId);
    if (state) {
      state.history.push({ role: 'assistant', text: reply, system: systemPrompt });
      roleplayState.set(chatId, state);
    }
    await api('sendMessage', {
      chat_id: chatId,
      text: `🎭 Ролевой режим: ${mode === 'diplomat' ? 'дипломатическое собеседование' : 'экзамен по праву'}.\n\n` +
        `Отвечай на английском. Чтобы выйти, набери /stop.\n\n` +
        reply,
    });
  } catch (e) {
    console.error('startRoleplay:', e.message);
    await api('sendMessage', {
      chat_id: chatId,
      text: '⚠️ Не удалось запустить ролевой режим. Проверьте, что AI API доступен (GEMINI_API_KEY, API_URL).',
    });
  }
}

async function continueRoleplay(chatId, userText) {
  const state = roleplayState.get(chatId);
  if (!state) return;
  try {
    const history = state.history || [];
    history.push({ role: 'user', text: userText });
    const trimmedHistory = history.slice(-10);
    const res = await fetch(`${API_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        history: trimmedHistory,
        targetWords: [],
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    const reply = json.response || 'Thank you. Please continue.';
    trimmedHistory.push({ role: 'assistant', text: reply });
    state.history = trimmedHistory;
    roleplayState.set(chatId, state);
    await api('sendMessage', { chat_id: chatId, text: reply });
  } catch (e) {
    console.error('continueRoleplay:', e.message);
    await api('sendMessage', {
      chat_id: chatId,
      text: '⚠️ Не удалось получить ответ от AI. Попробуй ещё раз чуть позже или выйди из режима командой /stop.',
    });
  }
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

Приложение открыто для всех — не только для студентов МГИМО.

Команды бота:
/profile — твой прогресс
/mission — миссия дня
/word или /daily — слово дня
/words [N] — N случайных слов
/words дипломатия — слова по теме международных отношений
/quiz — мини-квиз по лексике
/tip — совет по обучению
/roleplay — ролевая практика (дипломат / экзамен)
/remind — вкл/выкл напоминания

Нажми кнопку ниже и начни учиться!${refNote}`,
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

async function sendQuiz(chatId, questionsCount = 3) {
  try {
    const poolCount = Math.max(questionsCount * 3, 8);
    const res = await fetch(`${API_URL}/api/words/random?count=${poolCount}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const words = data.words || [];
    if (!words || words.length < 4) {
      return api('sendMessage', {
        chat_id: chatId,
        text: 'Для квиза нужно как минимум 4 слова в словаре. Добавь ещё слова в приложении.',
        reply_markup: { inline_keyboard: [[{ text: '📖 Открыть приложение', web_app: { url: APP_URL } }]] },
      });
    }

    const shuffled = [...words].sort(() => 0.5 - Math.random());
    const qCount = Math.min(questionsCount, Math.floor(shuffled.length / 4) || 1);
    const letters = ['A', 'B', 'C', 'D'];
    const questions = [];

    for (let i = 0; i < qCount; i++) {
      const correct = shuffled[i];
      const others = shuffled
        .filter((w) => w.word !== correct.word)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      const optionsPool = [correct, ...others].sort(() => 0.5 - Math.random());
      const options = optionsPool.map((w, idx) => ({
        letter: letters[idx],
        translation: w.translation || '—',
        isCorrect: w.word === correct.word,
      }));
      questions.push({ word: correct.word, options });
    }

    quizState.set(chatId, { questions, index: 0, score: 0 });

    await api('sendMessage', {
      chat_id: chatId,
      text: '🧠 Мини-квиз по дипломатической лексике. Отвечай, нажимая на кнопки A/B/C/D.',
    });

    await sendQuizQuestion(chatId);
  } catch (e) {
    console.error('sendQuiz:', e.message);
    await api('sendMessage', {
      chat_id: chatId,
      text: '⚠️ Не удалось собрать квиз. Проверь, что бэкенд запущен и в словаре есть слова.',
    });
  }
}

async function sendQuizQuestion(chatId) {
  const state = quizState.get(chatId);
  if (!state) return;
  const { questions, index } = state;
  const question = questions[index];
  if (!question) return;

  const keyboard = [
    question.options.map((opt) => ({
      text: `${opt.letter}) ${opt.translation}`,
      callback_data: `quiz:${index}:${opt.letter}`,
    })),
  ];

  const text = `Вопрос ${index + 1}/${questions.length}\n\n` +
    `${question.word} — выбери правильный перевод:`;

  await api('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: { inline_keyboard: keyboard },
  });
}

async function handleQuizCallback(callbackQuery) {
  const data = callbackQuery.data || '';
  if (!data.startsWith('quiz:')) return;
  const chatId = callbackQuery.message?.chat?.id;
  if (!chatId) return;

  const parts = data.split(':');
  const index = parseInt(parts[1] || '0', 10) || 0;
  const letter = parts[2];

  const state = quizState.get(chatId);
  if (!state) {
    await api('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: 'Квиз не найден. Набери /quiz, чтобы начать новый.',
      show_alert: false,
    });
    return;
  }

  const question = state.questions[index];
  if (!question) return;

  const chosen = question.options.find((o) => o.letter === letter);
  const correctOpt = question.options.find((o) => o.isCorrect);
  const isCorrect = !!chosen && chosen.isCorrect;

  if (isCorrect) state.score += 1;
  quizState.set(chatId, state);

  await api('answerCallbackQuery', {
    callback_query_id: callbackQuery.id,
    text: isCorrect ? 'Верно!' : 'Неверно',
    show_alert: false,
  });

  let feedback = isCorrect
    ? `✅ Верно! "${question.word}" — ${chosen.translation}.`
    : `❌ Неверно. "${question.word}" — ${correctOpt ? correctOpt.translation : 'правильный ответ'}.`;

  const isLast = index >= state.questions.length - 1;

  if (isLast) {
    quizState.delete(chatId);
    feedback += `\n\nКвиз завершён: ${state.score}/${state.questions.length}.`;
    await api('sendMessage', { chat_id: chatId, text: feedback });
  } else {
    state.index = index + 1;
    quizState.set(chatId, state);
    await api('sendMessage', { chat_id: chatId, text: feedback });
    await sendQuizQuestion(chatId);
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
        if (u.callback_query) {
          await handleQuizCallback(u.callback_query);
          continue;
        }
        const msg = u.message;
        if (!msg?.text) continue;
        const chatId = msg.chat.id;
        const originalText = msg.text.trim();
        const text = originalText.toLowerCase();
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
        } else if (text === '/profile') {
          await sendProfile(chatId);
        } else if (text === '/mission' || text === '/quest') {
          await sendMission(chatId);
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
        } else if (text === '/quiz') {
          await sendQuiz(chatId);
        } else if (text === '/roleplay' || text.startsWith('/roleplay ')) {
          const modeArg = text.split(' ')[1] || 'diplomat';
          await startRoleplay(chatId, modeArg);
        } else if (text === '/stop') {
          if (roleplayState.has(chatId)) {
            roleplayState.delete(chatId);
            await api('sendMessage', {
              chat_id: chatId,
              text: 'Ролевой режим остановлен. Можно вернуться к обычным командам.',
            });
          } else {
            await api('sendMessage', {
              chat_id: chatId,
              text: 'Сейчас ролевой режим не активен. Чтобы начать, используй /roleplay.',
            });
          }
        } else if (text.startsWith('/')) {
          await api('sendMessage', {
            chat_id: chatId,
            text: 'Команды: /start — приветствие, /app — открыть приложение, /profile — профиль, /mission — миссия дня, /word или /daily — слово дня, /words [N] — N слов, /words дипломатия — дипломатическая лексика, /quiz — мини-квиз, /tip — совет, /roleplay — ролевая практика, /remind — вкл/выкл напоминания.',
          });
        } else {
          // Обычное сообщение: если активен ролевой режим — продолжаем диалог
          if (roleplayState.has(chatId)) {
            await continueRoleplay(chatId, originalText);
          }
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
      // Добавляем миссию дня в напоминание
      const missionText = getDailyMissionText();
      await api('sendMessage', {
        chat_id: chatId,
        text: missionText,
        reply_markup: { inline_keyboard: [[{ text: '📖 Открыть МГИМО AI', web_app: { url: APP_URL } }]] },
      });
      await new Promise((x) => setTimeout(x, 400));
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
