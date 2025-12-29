import express from 'express';
import cors from 'cors';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input'; 

// === КОНФИГ ===
const apiId = 0; // ЗАМЕНИТЕ НА ВАШ
const apiHash = 'URA_YA_NE_ZABYL_UDALIT)'; // ЗАМЕНИТЕ НА ВАШ
const stringSession = new StringSession('I DAZHE ETO NE ZABYL'); // Если пусто, будет вход через консоль
const CHANNEL_USERNAME = 'cue2a'; 
const EXTERNAL_API_URL = 'https://cue2a.spdrm.ru/api/messages';

const app = express();
const PORT = 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });

async function formatMessage(msg) {
    let senderName = "Channel";
    try {
        const sender = await msg.getSender();
        if (sender) {
            senderName = sender.title || sender.firstName || "Unknown";
        }
    } catch (e) {}

    let reactions = [];
    if (msg.reactions?.results) {
        reactions = msg.reactions.results.map(r => ({
            emoji: r.reaction.emoticon,
            count: r.count
        }));
    }

    return {
        id: msg.id,
        content: msg.message || '',
        date: msg.date * 1000,
        views: msg.views || 0,
        replies: msg.replies?.replies || 0,
        senderName: senderName,
        senderId: msg.senderId ? msg.senderId.toString() : '0',
        reactions: reactions
    };
}

// 1. Лента канала (с поддержкой загрузки истории)
app.get('/api/messages', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 30;
        const offsetId = parseInt(req.query.offsetId) || 0; // ID сообщения, от которого грузим старые

        const msgs = await client.getMessages(CHANNEL_USERNAME, { 
            limit,
            offsetId: offsetId // GramJS вернет сообщения СТАРШЕ этого ID
        });
        
        const formatted = await Promise.all(msgs.map(formatMessage));
        res.json(formatted);
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: e.message }); 
    }
});

// 2. Комментарии
app.get('/api/comments/:id', async (req, res) => {
    try {
        const msgs = await client.getMessages(CHANNEL_USERNAME, { 
            replyTo: parseInt(req.params.id), 
            limit: 50 
        });
        const formatted = await Promise.all(msgs.reverse().map(formatMessage));
        res.json(formatted);
    } catch (e) { res.json([]); }
});

// 3. Одиночное сообщение
app.get('/api/single/:id', async (req, res) => {
    try {
        const result = await client.getMessages(CHANNEL_USERNAME, { ids: [parseInt(req.params.id)] });
        if (!result[0]) return res.status(404).json({});
        res.json(await formatMessage(result[0]));
    } catch (e) { res.status(500).json({}); }
});

// 4. Отправка (API proxy)
app.post('/api/send', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "Empty text" });

        const response = await fetch(EXTERNAL_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: text })
        });

        if (!response.ok) throw new Error(`External API Error: ${response.statusText}`);
        res.json({ success: true });
    } catch (e) {
        console.error("Send Error:", e);
        res.status(500).json({ error: e.message });
    }
});

(async () => {
    await client.start({
        phoneNumber: async () => await input.text("Phone: "),
        password: async () => await input.text("Password: "),
        phoneCode: async () => await input.text("Code: "),
        onError: (err) => console.log(err),
    });
    app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on ${PORT}`));
})();