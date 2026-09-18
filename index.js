const TelegramBot = require('node-telegram-bot-api');

// ============ DÁN TOKEN VÀO ĐÂY ============
const TOKEN = 'DÁN_TOKEN_BOT_CỦA_BẠN_VÀO_ĐÂY';
// ==========================================

const bot = new TelegramBot(TOKEN, { polling: true });
console.log('🤖 Bot SAMM.NET đang chạy...');

// ============ DỮ LIỆU ============
const players = {};       // { userId: { name, balance } }
const games = {};         // { chatId: { bets, timeLeft, session } }
const lixis = {};         // { code: { amount, remaining, total, owner, claimed } }

// ============ KHỞI TẠO NGƯỜI CHƠI ============
function initPlayer(msg) {
  const userId = msg.from.id;
  if (!players[userId]) {
    players[userId] = {
      name: msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : ''),
      username: msg.from.username || '',
      balance: 0
    };
  }
  return players[userId];
}

// ============ /start ============
bot.onText(/\/start/, (msg) => {
  const p = initPlayer(msg);
  bot.sendMessage(msg.chat.id,
    '🤖 <b>BOT SAMM.NET</b>\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    'Xin chào <b>' + p.name + '</b>!\n\n' +
    '📌 <b>Lệnh chính:</b>\n' +
    '/lixi 1000000 5 – Tạo lì xì 1M cho 5 người\n' +
    '/sodu – Xem số dư\n' +
    '/taixiu – Bắt đầu ván Tài Xỉu\n' +
    '/tai 2000000 – Cược Tài\n' +
    '/xiu 2000000 – Cược Xỉu\n' +
    '/chan 2000000 – Cược Chẵn\n' +
    '/le 2000000 – Cược Lẻ\n' +
    '/help – Hướng dẫn',
    { parse_mode: 'HTML' }
  );
});

// ============ /lixi [số tiền] [số người] ============
bot.onText(/\/lixi(?:\s+(\d+))?(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const p = initPlayer(msg);

  const amount = parseInt(match[1] || '0');
  const count = parseInt(match[2] || '1');

  if (!amount || amount < 1000) {
    bot.sendMessage(chatId,
      '⚠️ Cú pháp: <code>/lixi 1000000 5</code>\n' +
      '(1,000,000 Mcoin cho 5 người)',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Tạo mã lì xì
  const code = 'LIXI' + Math.random().toString(36).substring(2, 8).toUpperCase();
  lixis[code] = {
    amount,           // Số tiền mỗi người nhận
    total: count,     // Tổng số người
    remaining: count, // Còn lại bao nhiêu người
    owner: p.name,
    ownerId: userId,
    claimed: []       // Danh sách người đã nhận
  };

  // Gửi tin nhắn lì xì với NÚT BẤM
  bot.sendMessage(chatId,
    '🧧 <b>LÌ XÌ VIP TOÀN SERVER</b> 🧧\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '👤 <b>Người tặng:</b> ' + p.name + '\n' +
    '💰 <b>Mỗi người nhận:</b> ' + amount.toLocaleString('en-US') + ' Mcoin\n' +
    '👥 <b>Số lượng:</b> ' + count + ' người\n' +
    '🔑 <b>Mã:</b> <code>' + code + '</code>\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '⏰ ' + new Date().toLocaleString('vi-VN'),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '🧧 Nhận Lì Xì', callback_data: 'claim_' + code }
        ]]
      }
    }
  );
});

// ============ XỬ LÝ BẤM NÚT NHẬN LÌ XÌ ============
bot.on('callback_query', async (query) => {
  const data = query.data;
  const userId = query.from.id;
  const chatId = query.message.chat.id;

  if (!data.startsWith('claim_')) return;

  const code = data.replace('claim_', '');
  const lixi = lixis[code];

  if (!lixi) {
    bot.answerCallbackQuery(query.id, { text: '❌ Lì xì không tồn tại!', show_alert: true });
    return;
  }

  if (lixi.remaining <= 0) {
    bot.answerCallbackQuery(query.id, { text: '😢 Lì xì đã hết lượt!', show_alert: true });
    return;
  }

  if (lixi.claimed.includes(userId)) {
    bot.answerCallbackQuery(query.id, { text: '⚠️ Bạn đã nhận lì xì này rồi!', show_alert: true });
    return;
  }

  // Random số tiền (từ 50% đến 150% của amount)
  const min = Math.floor(lixi.amount * 0.5);
  const max = Math.floor(lixi.amount * 1.5);
  const received = Math.floor(Math.random() * (max - min + 1)) + min;

  // Cộng tiền cho người nhận
  const p = initPlayer(query);
  p.balance += received;

  // Cập nhật lì xì
  lixi.remaining--;
  lixi.claimed.push(userId);

  // Trả lời callback
  bot.answerCallbackQuery(query.id, {
    text: '🧧 Bạn nhận được ' + received.toLocaleString('en-US') + ' Mcoin!',
    show_alert: true
  });

  // Gửi tin nhắn thông báo
  bot.sendMessage(chatId,
    '🧧 <b>' + p.name + '</b> vừa nhận được <b>' + received.toLocaleString('en-US') + ' Mcoin</b>!\n' +
    '👥 Còn lại: <b>' + lixi.remaining + '/' + lixi.total + '</b> lượt\n' +
    '💵 Số dư: <b>' + p.balance.toLocaleString('en-US') + ' Mcoin</b>',
    { parse_mode: 'HTML' }
  );

  // Nếu hết lượt, cập nhật lại tin nhắn gốc (xóa nút)
  if (lixi.remaining <= 0) {
    bot.editMessageReplyMarkup(
      { inline_keyboard: [[{ text: '🎉 Lì xì đã hết', callback_data: 'done' }]] },
      { chat_id: chatId, message_id: query.message.message_id }
    ).catch(() => {});
  }
});

// ============ /sodu ============
bot.onText(/\/sodu/, (msg) => {
  const p = initPlayer(msg);
  bot.sendMessage(msg.chat.id,
    '💰 <b>SỐ DƯ CỦA BẠN</b>\n' +
    '👤 ' + p.name + '\n' +
    '💵 <b>' + p.balance.toLocaleString('en-US') + ' Mcoin</b>',
    { parse_mode: 'HTML' }
  );
});

// ============ /taixiu ============
bot.onText(/\/taixiu/, (msg) => {
  const chatId = msg.chat.id;
  if (games[chatId]) {
    bot.sendMessage(chatId, '⚠️ Ván đang diễn ra! Chờ kết thúc.');
    return;
  }

  const session = Math.floor(Math.random() * 90000) + 10000;
  games[chatId] = { bets: {}, timeLeft: 39, session };

  bot.sendMessage(chatId,
    '🎲 <b>TÀI XỈU #' + session + '</b>\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '<b>Tỉ lệ cược:</b>\n' +
    '• Tài - Xỉu: x1.9\n' +
    '• Chẵn - Lẻ: x1.9\n\n' +
    '📌 <b>Cách cược:</b>\n' +
    '<code>/tai 2000000</code> – Tài\n' +
    '<code>/xiu 2000000</code> – Xỉu\n' +
    '<code>/chan 2000000</code> – Chẵn\n' +
    '<code>/le 2000000</code> – Lẻ\n\n' +
    '⏰ Kết thúc sau <b>39 giây</b>!',
    { parse_mode: 'HTML' }
  );

  const interval = setInterval(() => {
    if (!games[chatId]) return clearInterval(interval);
    games[chatId].timeLeft--;
    if (games[chatId].timeLeft <= 0) {
      clearInterval(interval);
      endGame(chatId);
    }
  }, 1000);
});

// ============ KẾT THÚC VÁN ============
function endGame(chatId) {
  const game = games[chatId];
  if (!game) return;

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const d3 = Math.floor(Math.random() * 6) + 1;
  const total = d1 + d2 + d3;
  const isTai = total >= 11;
  const isChan = total % 2 === 0;

  let text =
    '🎲 <b>KẾT QUẢ #' + game.session + '</b>\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '🎯 Xúc xắc: ' + d1 + ' + ' + d2 + ' + ' + d3 + ' = <b>' + total + '</b>\n' +
    '📊 <b>' + (isTai ? 'TÀI' : 'XỈU') + ' - ' + (isChan ? 'CHẴN' : 'LẺ') + '</b>\n' +
    '━━━━━━━━━━━━━━━━━━\n';

  const results = [];
  for (const uid in game.bets) {
    const bet = game.bets[uid];
    const p = players[uid];
    if (!p) continue;

    let win = false;
    if (bet.type === 'tai' && isTai) win = true;
    if (bet.type === 'xiu' && !isTai) win = true;
    if (bet.type === 'chan' && isChan) win = true;
    if (bet.type === 'le' && !isChan) win = true;

    if (win) {
      const payout = Math.floor(bet.amount * 1.9);
      p.balance += payout;
      results.push('✅ ' + p.name + ' +' + payout.toLocaleString('en-US'));
    } else {
      results.push('❌ ' + p.name + ' -' + bet.amount.toLocaleString('en-US'));
    }
  }

  text += results.length ? '<b>Danh sách:</b>\n' + results.join('\n') : '<i>Không ai cược.</i>';
  bot.sendMessage(chatId, text, { parse_mode: 'HTML' });

  delete games[chatId];
  setTimeout(() => {
    bot.sendMessage(chatId, '💡 Gõ /taixiu để bắt đầu ván mới!');
  }, 3000);
}

// ============ LỆNH CƯỢC ============
bot.onText(/^\/(tai|xiu|chan|le)(?:\s+(\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const type = match[1];
  const amount = parseInt(match[2] || '0');

  const p = initPlayer(msg);

  if (!games[chatId]) {
    bot.sendMessage(chatId, '⚠️ Chưa có ván! Gõ /taixiu để bắt đầu.');
    return;
  }

  if (!amount || amount < 2000000) {
    bot.sendMessage(chatId,
      '⚠️ Cược tối thiểu 2,000,000!\nCú pháp: <code>/' + type + ' 2000000</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  if (p.balance < amount) {
    bot.sendMessage(chatId,
      '❌ Không đủ Mcoin!\n💵 Số dư: <b>' + p.balance.toLocaleString('en-US') + '</b>\n' +
      '💡 Dùng /lixi để nhận thêm.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  p.balance -= amount;
  games[chatId].bets[userId] = { type, amount };

  const names = { tai: 'TÀI', xiu: 'XỈU', chan: 'CHẴN', le: 'LẺ' };
  bot.sendMessage(chatId,
    '✅ <b>ĐÃ ĐẶT CƯỢC</b>\n' +
    '👤 ' + p.name + '\n' +
    '🎲 Cửa: <b>' + names[type] + '</b>\n' +
    '💰 Số tiền: <b>' + amount.toLocaleString('en-US') + ' Mcoin</b>\n' +
    '💵 Số dư còn: ' + p.balance.toLocaleString('en-US'),
    { parse_mode: 'HTML' }
  );
});

// ============ /help ============
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '📖 <b>HƯỚNG DẪN</b>\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '🧧 /lixi 1000000 5 – Tạo lì xì 1M cho 5 người\n' +
    '💰 /sodu – Xem số dư\n' +
    '🎲 /taixiu – Bắt đầu ván Tài Xỉu\n' +
    '🎯 /tai 2000000 – Cược Tài\n' +
    '🎯 /xiu 2000000 – Cược Xỉu\n' +
    '🎯 /chan 2000000 – Cược Chẵn\n' +
    '🎯 /le 2000000 – Cược Lẻ',
    { parse_mode: 'HTML' }
  );
});

// ============ XỬ LÝ LỖI ============
bot.on('polling_error', (e) => console.log('Polling:', e.message));
process.on('uncaughtException', (e) => console.log('Lỗi:', e.message));
