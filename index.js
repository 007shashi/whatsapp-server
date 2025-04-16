const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const app = express();
app.use(express.json());

let sock;

const path = require('path');

async function startBaileys() {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth'));
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      if ((lastDisconnect.error = new Boom(lastDisconnect?.error))?.output?.statusCode !== 401) {
        startBaileys();
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp connected');
    }
  });
}

startBaileys();

// 📩 API endpoint to receive message requests
app.post('/send-message', async (req, res) => {
  const { number, message } = req.body;

  if (!sock?.user) {
    return res.status(500).json({ error: 'WhatsApp not connected yet' });
  }

  try {
    const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
    res.json({ success: true, to: number, message });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// 📢 API endpoint to send group message
app.post('/send-group-message', async (req, res) => {
    const { groupId, message } = req.body;
  
    if (!sock?.user) {
      return res.status(500).json({ error: 'WhatsApp not connected yet' });
    }
  
    try {
      const jid = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
      await sock.sendMessage(jid, { text: message });
      res.json({ success: true, to: groupId, message });
    } catch (error) {
      console.error('❌ Error sending group message:', error);
      res.status(500).json({ error: 'Failed to send group message' });
    }
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`🚀 Server running on http://localhost:${PORT}`);
});
  
