// WebCraft relay/signaling server — deploys as a Render Web Service.
// Room-scoped message relay: clients join a room with a 6-char code
// ({t:'join-room', room, id}), every later message is forwarded raw to the
// OTHER members of that room. Game data stays end-to-end (JSON in, JSON out);
// this server only fans frames out. Docs: WebSocket per WHATWG/MDN, ws lib.
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const rooms = new Map(); // room -> Map<ws, {id}>

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }
  // Friendly info page: people who open the relay URL directly land here —
  // point them to the actual game instead of showing bare status text.
  if (req.url === '/' || req.url.startsWith('/?') || req.url === '') {
    const GAME = 'https://webcraft-qb1q.zai-ai.site';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>WebCraft Relay</title>
<meta http-equiv="refresh" content="6;url=${GAME}">
<style>body{background:#0d0d14;color:#eee;font-family:monospace;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}
.box{max-width:560px;padding:32px;border:3px solid #55ff55;background:#1a1a2e}
h1{color:#55ff55;letter-spacing:3px}a{color:#7fff3f}p{line-height:1.6;color:#ccc}</style></head>
<body><div class="box"><h1>WebCraft Relay</h1>
<p>Diese Adresse ist der <b>Verbindungsserver</b> (Relay) für den Multiplayer-Code-Join —<br>Spieler öffnen hier nichts im Browser.</p>
<p><b>Das Spiel spielst du hier:</b><br><a href="${GAME}">${GAME}</a></p>
<p style="color:#8f8">Du wirst in wenigen Sekunden automatisch dorthin weitergeleitet …</p>
</div></body></html>`);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.room = null;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch (e) { return; }
    if (msg.t === 'join-room' && msg.room) {
      const room = String(msg.room).slice(0, 64);
      if (ws.room && rooms.get(ws.room)) rooms.get(ws.room).delete(ws);
      ws.room = room; ws.id = String(msg.id || '').slice(0, 32);
      if (!rooms.has(room)) rooms.set(room, new Map());
      rooms.get(room).set(ws, { id: ws.id });
      try { ws.send(JSON.stringify({ t: 'room-joined', room })); } catch (e) { }
      return;
    }
    if (!ws.room || !rooms.has(ws.room)) return;
    for (const [peer] of rooms.get(ws.room)) {
      if (peer !== ws && peer.readyState === 1) {
        try { peer.send(data.toString()); } catch (e) { }
      }
    }
  });
  ws.on('close', () => {
    if (ws.room && rooms.get(ws.room)) {
      rooms.get(ws.room).delete(ws);
      if (rooms.get(ws.room).size === 0) rooms.delete(ws.room);
    }
  });
  ws.on('error', () => { });
});

setInterval(() => {
  for (const [, room] of rooms) for (const [peer] of room) {
    if (peer.isAlive === false) { try { peer.terminate(); } catch (e) { } continue; }
    peer.isAlive = false;
    try { peer.ping(); } catch (e) { }
  }
}, 30000);

server.listen(PORT, () => console.log('WebCraft relay listening on :' + PORT));
