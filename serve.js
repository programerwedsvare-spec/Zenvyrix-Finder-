const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
app.use(express.json());
app.use(express.text({ type: '*/*' }));

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || './data';
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Erro ao ler DB:', e);
  }
  return { users: [], blacklist: [], announcement: '', logs: [] };
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Erro ao salvar DB:', e);
  }
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/status', (req, res) => {
  const db = readDB();
  res.json({
    name: 'Zenvyrix Finder API',
    status: 'online',
    users: db.users.length,
    blacklisted: db.blacklist.length,
    logs: db.logs.length,
    uptime: process.uptime()
  });
});

app.post('/zenvyrix/usernames', (req, res) => {
  const db = readDB();
  const name = typeof req.body === 'string' ? req.body.trim() : '';
  if (name && !db.users.includes(name)) {
    db.users.push(name);
    writeDB(db);
  }
  res.send('ok');
});

app.get('/zenvyrix/usernames', (req, res) => {
  const db = readDB();
  res.type('text/plain').send(db.users.join('\n'));
});

app.delete('/zenvyrix/usernames', (req, res) => {
  const db = readDB();
  const name = typeof req.body === 'string' ? req.body.trim() : '';
  db.users = db.users.filter(n => n !== name);
  writeDB(db);
  res.send('ok');
});

app.get('/zenvyrix/blacklisted', (req, res) => {
  const db = readDB();
  res.type('text/plain').send(db.blacklist.join('\n'));
});

app.post('/zenvyrix/blacklisted', (req, res) => {
  const db = readDB();
  const name = typeof req.body === 'string' ? req.body.trim() : '';
  if (name && !db.blacklist.includes(name)) {
    db.blacklist.push(name);
    writeDB(db);
  }
  res.send('ok');
});

app.delete('/zenvyrix/blacklisted', (req, res) => {
  const db = readDB();
  const name = typeof req.body === 'string' ? req.body.trim() : '';
  db.blacklist = db.blacklist.filter(n => n !== name);
  writeDB(db);
  res.send('ok');
});

app.get('/zenvyrix/announcements', (req, res) => {
  const db = readDB();
  res.type('text/plain').send(db.announcement || '');
});

app.post('/zenvyrix/announcements', (req, res) => {
  const db = readDB();
  db.announcement = typeof req.body === 'string' ? req.body : '';
  writeDB(db);
  res.send('ok');
});

app.post('/zenvyrix/logs', (req, res) => {
  const db = readDB();
  const line = typeof req.body === 'string' ? req.body : '';
  if (line) {
    db.logs.push({ time: Date.now(), line });
    if (db.logs.length > 1000) db.logs.shift();
    writeDB(db);
  }
  res.send('ok');
});

app.get('/zenvyrix/logs', (req, res) => {
  const db = readDB();
  res.json(db.logs);
});

app.delete('/zenvyrix/logs', (req, res) => {
  const db = readDB();
  db.logs = [];
  writeDB(db);
  res.send('ok');
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/zenvyrix/ws' });

wss.on('connection', (ws) => {
  ws.send('connected');
  ws.on('message', (data) => {
    const text = data.toString();
    wss.clients.forEach(client => {
      if (client.readyState === 1) client.send(text);
    });
  });
});

app.post('/zenvyrix/broadcast', (req, res) => {
  const msg = typeof req.body === 'string' ? req.body : '';
  if (msg) {
    wss.clients.forEach(client => {
      if (client.readyState === 1) client.send(msg);
    });
  }
  res.send('ok');
});

server.listen(PORT, () => {
  console.log(`Zenvyrix Finder API rodando na porta ${PORT}`);
  console.log(`Dados salvos em: ${DB_FILE}`);
});
