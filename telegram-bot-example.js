/**
 * Пример Telegram-бота для открытия Mini App.
 * Установите: npm install node-telegram-bot-api
 * Запуск: BOT_TOKEN=xxx APP_URL=https://your-app.com node telegram-bot-example.js
 */

// const TelegramBot = require('node-telegram-bot-api');
// const token = process.env.BOT_TOKEN;
// const appUrl = process.env.APP_URL || 'https://your-app.com';

// const bot = new TelegramBot(token, { polling: true });

// bot.onText(/\/start/, (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(chatId, 'Откройте приложение МГИМО AI:', {
//     reply_markup: {
//       inline_keyboard: [[
//         { text: 'Открыть МГИМО AI', web_app: { url: appUrl } }
//       ]]
//     }
//   });
// });

// bot.setChatMenuButton({
//   menu_button: {
//     type: 'web_app',
//     text: 'МГИМО AI',
//     web_app: { url: appUrl }
//   }
// }).catch(console.error);

// console.log('Bot started. Set BOT_TOKEN and APP_URL env vars.');
