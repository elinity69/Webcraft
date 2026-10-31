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
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebCraft relay — WebSocket endpoint at ws://<host>/');
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
