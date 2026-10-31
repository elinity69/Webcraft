// ============================================================================
// Part 12: Multiplayer — BroadcastChannel (same browser), WebRTC P2P,
// WebSocket relay (internet code-join via our own relay server).
// ============================================================================
// Internet relay endpoint (our own Render Web Service; override via
// localStorage 'wc_signal_url' for self-hosting/testing). Empty string
// disables the internet path entirely.
const SIGNAL_URL = (function () {
  try { return localStorage.getItem('wc_signal_url') || 'wss://webcraft-qkwp.onrender.com'; } catch (e) { return ''; }
})();
const Chat = {
  history: [],
  add(text, color) {
    const hist = $('chat-history');
    const el = mkEl('div', 'chat-msg', hist);
    if (color) el.style.color = color;
    // basic MC color code support: §a green etc.
    el.innerHTML = '';
    let buf = '', curColor = color || '';
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '§' && i + 1 < text.length) {
        if (buf) { const s = mkEl('span', '', el, buf); if (curColor) s.style.color = curColor; buf = ''; }
        const code = text[++i];
        const map = { a: '#55FF55', b: '#55FFFF', c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF', 7: '#AAAAAA', 8: '#555555', 6: '#FFAA00', '9': '#5555FF', '1': '#0000AA' };
        curColor = map[code] || curColor;
      } else buf += text[i];
    }
    if (buf) { const s = mkEl('span', '', el, buf); if (curColor) s.style.color = curColor; }
    this.history.push(text);
    if (this.history.length > 100) this.history.shift();
    while (hist.children.length > 14) hist.removeChild(hist.firstChild);
    hist.scrollTop = hist.scrollHeight;
    // reveal chat briefly
    $('chat-container').classList.remove('hidden-chat');
    clearTimeout(this._hideT);
    this._hideT = setTimeout(() => { if (!$('chat-input-wrap').style.display.includes('flex')) $('chat-container').classList.add('hidden-chat'); }, 8000);
  },
  actionBar(text) {
    const el = $('action-bar-msg');
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(this._abT);
    this._abT = setTimeout(() => el.style.opacity = '0', 2200);
  },
  open() {
    $('chat-container').classList.remove('hidden-chat');
    $('chat-input-wrap').style.display = 'flex';
    const inp = $('chat-input');
    inp.value = '';
    document.exitPointerLock && document.exitPointerLock();
    setTimeout(() => inp.focus(), 0);
  },
  close() {
    $('chat-input-wrap').style.display = 'none';
    $('chat-input').blur();
    requestPointerLock();
  },
  submit() {
    const inp = $('chat-input');
    const text = inp.value.trim();
    this.close();
    if (!text) return;
    if (text[0] === '/') Commands.run(text);
    else {
      const name = (G.net && G.net.myName) || 'Player';
      const msg = '<' + name + '> ' + text;
      Chat.add(msg);
      if (G.net) G.net.sendAll({ t: 'chat', msg });
    }
  },
};

const COMMANDS_HELP = [
  '/help — list commands',
  '/gamemode <survival|creative|spectator> — switch mode',
  '/difficulty <peaceful|easy|normal|hard> — set difficulty',
  '/time set <day|night|noon|midnight|N> — set world time',
  '/tp <x> <y> <z> — teleport',
  '/give <item> [count] — give item',
  '/seed — show world seed',
  '/weather <clear|rain|thunder> — change weather',
  '/summon <mob> [x y z] — spawn entity',
  '/kill — kill yourself',
  '/clear — clear inventory',
  '/spawnpoint — set respawn here',
  '/xp <n> — add experience',
  '/say <msg> — broadcast a message',
  '/dimension <overworld|nether|end> — travel',
  '/save — save the world now',
];

const Commands = {
  run(line) {
    const parts = line.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const p = G.player;
    const requireHost = () => {
      if (G.net && !G.net.isHostOrSingle) { Chat.add('§cOnly the host can use this command.'); return false; }
      return true;
    };
    switch (cmd) {
      case 'help': COMMANDS_HELP.forEach(h => Chat.add('§7' + h)); break;
      case 'gamemode': {
        const gm = parts[1];
        if (!['survival', 'creative', 'spectator', 'hardcore'].includes(gm)) { Chat.add('§cUsage: /gamemode <survival|creative|spectator>'); break; }
        p.gameMode = gm;
        p.flying = gm === 'creative' || gm === 'spectator';
        Chat.add('Game mode set to ' + gm);
        break;
      }
      case 'difficulty': {
        const df = parts[1];
        if (!['peaceful', 'easy', 'normal', 'hard'].includes(df)) { Chat.add('§cUsage: /difficulty <peaceful|easy|normal|hard>'); break; }
        G.difficulty = df;
        Chat.add('§7Schwierigkeit: §f' + df);
        // host authority: guests adopt the new difficulty at once
        if (G.net && G.net.mode !== null) G.net.sendAll({ t: 'difficulty', d: df });
        break;
      }
      case 'time': {
        if (parts[1] === 'set') {
          const map = { day: 1000, noon: 6000, night: 13000, midnight: 18000 };
          const t = map[parts[2]] !== undefined ? map[parts[2]] : parseInt(parts[2]);
          if (isNaN(t)) { Chat.add('§cUsage: /time set <day|night|noon|midnight|ticks>'); break; }
          G.world.time = t;
          if (G.net && G.net.isHostOrSingle) G.net.broadcastTime();
          Chat.add('Time set to ' + t);
        }
        break;
      }
      case 'tp': {
        const [x, y, z] = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
        if (isNaN(x) || isNaN(y) || isNaN(z)) { Chat.add('§cUsage: /tp <x> <y> <z>'); break; }
        TeleportPlayer(x, y, z);
        Chat.add(`Teleported to ${x} ${y} ${z}`);
        break;
      }
      case 'give': {
        const key = parts[1];
        if (I[key] === undefined) { Chat.add('§cUnknown item: ' + key + ' (use registry keys like iron_pickaxe)'); break; }
        const n = parseInt(parts[2]) || 1;
        p.addItem(I[key], n);
        Chat.add(`Gave ${n} × ${key}`);
        break;
      }
      case 'seed': Chat.add('Seed: ' + G.seed); break;
      case 'weather': {
        if (!requireHost()) break;
        const w = parts[1];
        if (w === 'clear') { G.rain = 0; G.thunder = 0; }
        else if (w === 'rain') { G.rain = .7; G.thunder = 0; }
        else if (w === 'thunder') { G.rain = 1; G.thunder = 1; }
        else { Chat.add('§cUsage: /weather <clear|rain|thunder>'); break; }
        Chat.add('Weather: ' + w);
        if (G.net) G.net.sendAll({ t: 'weather', rain: G.rain, thunder: G.thunder });
        break;
      }
      case 'summon': {
        const type = parts[1];
        if (!MOB_DEFS[type] || ['item', 'xp', 'arrow'].includes(type)) { Chat.add('§cUnknown mob: ' + type); break; }
        let x = p.x, y = p.y, z = p.z;
        if (parts[2] !== undefined) { x = +parts[2]; y = +parts[3]; z = +parts[4]; }
        spawnEntity(type, x, y, z);
        Chat.add('Summoned ' + type);
        break;
      }
      case 'kill': p.damage(1000, 'command'); break;
      case 'clear': p.slots.fill(null); UI.refreshHotbar(); Chat.add('Inventory cleared'); break;
      case 'spawnpoint': p.spawnPoint = [p.x, p.y, p.z]; Chat.add('Spawn point set'); break;
      case 'xp': { const n = parseInt(parts[1]) || 0; p.addXP(n); Chat.add('Added ' + n + ' XP'); break; }
      case 'say': Chat.add('§e[Server] ' + parts.slice(1).join(' ')); break;
      case 'dimension': {
        const map = { overworld: 0, nether: 1, end: 2 };
        const d = map[parts[1]];
        if (d === undefined) { Chat.add('§cUsage: /dimension <overworld|nether|end>'); break; }
        TeleportDimension(d, p.x, p.z);
        break;
      }
      case 'save': SaveSystem.save(); Chat.add('World saved'); break;
      default: Chat.add('§cUnknown command. Try /help');
    }
  },
};

// ============================================================================
// Net — transport-agnostic host/peer mesh
// ============================================================================
class Net {
  constructor() {
    this.mode = null;            // 'single' | 'bc-host' | 'bc-join' | 'rtc-host' | 'rtc-join' | 'ws'
    this.isHostOrSingle = true;
    this.myName = 'Player' + randInt(100, 999);
    this.myId = 'p' + Math.random().toString(36).slice(2, 9);
    this.peers = new Map();      // id -> {send(fn), name, entity, lastSeen, pos info}
    this.bc = null;
    this.dc = null;              // WebRTC datachannel (single peer P2P)
    this.ws = null;
    this.hostId = null;
    this.snapshotT = 0;
    this.posT = 0;
  }

  log(msg, err) {
    const el = $('net-log');
    if (el) { const d = mkEl('div', err ? 'err' : '', el, msg); el.scrollTop = el.scrollHeight; }
    console.log('[net]', msg);
  }

  // ---------- transport: send to all connected peers ----------
  sendAll(obj) {
    this._midSeq = (this._midSeq || 0) + 1;
    obj._mid = this._midSeq; // dedup id — a dual-transport (BC + WS) client receives every frame twice
    const s = JSON.stringify(obj);
    this.bytesOut = (this.bytesOut || 0) + s.length; // F3 traffic meter
    if (this.bc) this.bc.postMessage({ ...obj, _from: this.myId });
    if (this.dc && this.dc.readyState === 'open') { try { this.dc.send(s); } catch (e) { } }
    if (this.ws && this.ws.readyState === 1) { try { this.ws.send(s); } catch (e) { } }
    for (const [, p] of this.peers) { if (p.send) { try { p.send(s); } catch (e) { } } }
  }

  broadcastBlock(x, y, z, id, m) {
    if (!this || this.mode === null) return;
    this.sendAll({ t: 'block', d: G.dimension, x, y, z, id, m });
  }
  broadcastTime() { this.sendAll({ t: 'time', time: G.world.time, dim: G.dimension }); }

  // ---------- receive dispatcher ----------
  onMessage(obj, reply) {
    if (obj._from === this.myId) return;
    // dedup for dual-transport clients (BC + relay deliver the same frame twice)
    if (obj._mid) {
      this._seen = this._seen || new Map();
      if (this._seen.has(obj._mid)) return;
      this._seen.set(obj._mid, performance.now());
      if (this._seen.size > 400) { const it = this._seen.keys(); for (let i = 0; i < 200; i++) this._seen.delete(it.next().value); }
    }
    switch (obj.t) {
      case 'host-here': {
        // discovery announce (BroadcastChannel)
        if (this.mode === 'bc-join' && !this.joined) {
          this.hostId = obj.id;
          reply({ t: 'join', id: this.myId, name: this.myName });
          this.log('Found host — joining...');
        }
        break;
      }
      case 'join': {
        if (!this.isHostOrSingle) break;
        if (this.peers.has(obj.id)) break; // join retries must not spam the chat
        this.peers.set(obj.id, { name: obj.name, send: reply ? (s) => reply(JSON.parse(s) ? s : s) : null, lastSeen: performance.now(), bcReply: reply });
        // send welcome with full state
        const welcome = {
          t: 'welcome', to: obj.id, id: this.myId, name: this.myName,
          seed: G.seed, time: G.world.time, mode: G.gameMode, difficulty: G.difficulty || 'normal',
          edits: [...G.world.edits.entries()],
          tes: this.serializeTEs(),
          rain: G.rain, thunder: G.thunder,
        };
        if (reply) reply(welcome);
        Chat.add('§e' + obj.name + ' hat das Spiel betreten');
        // create remote player entity
        this.ensureRemotePlayer(obj.id, obj.name);
        break;
      }
      case 'welcome': {
        if (obj.to !== this.myId && obj.to !== undefined) { /* broadcast welcome to all — ignore others */ }
        this.hostId = obj.id;
        this.isHostOrSingle = false;
        this.joined = true;
        // build (or rebuild) the world deterministically from the host's data —
        // a guest can join straight from the title screen, no local world needed.
        // Same seed + already playing → keep the local world, only adopt state.
        if (!G.world || (G.seed >>> 0) !== (obj.seed >>> 0)) {
          joinWorldFromHost(obj);
        } else {
          G.world.edits = new Map(obj.edits);
          // apply the host's edits into the generated chunks (setBlock handles
          // heightmap, light and remesh; noEdit — the map already has them)
          for (const [k, v] of G.world.edits) {
            const [ex, ey, ez] = k.split(',').map(Number);
            G.world.setBlock(ex, ey, ez, v[0], v[1], { noEdit: true, noNet: true });
          }
          G.world.time = obj.time;
          G.rain = obj.rain; G.thunder = obj.thunder;
          G.gameMode = obj.mode || G.gameMode;
          if (G.player) G.player.gameMode = G.gameMode;
          if (obj.difficulty) G.difficulty = obj.difficulty;
          // same world already here (quit to title earlier) → drop back into
          // the game, otherwise the guest stays stuck on the title screen
          if (G.state === 'title') {
            showScreen(null);
            G.state = 'playing';
            if (G.player) G.player.spawnGrace = 100;
            UI.refreshHotbar();
            requestPointerLock();
          }
        }
        this.deserializeTEs(obj.tes);
        // guests see the code in the ESC menu too (badge value only; showScreen toggles visibility)
        const val = document.getElementById('mp-code-value');
        if (val) val.textContent = this.roomCode;
        this.log('Connected! World seed: ' + obj.seed);
        Chat.add('§aConnected to ' + obj.name + "'s world");
        Chat.add('§7Modus: §f' + (G.gameMode || 'survival') + ' §7· Schwierigkeit: §f' + (G.difficulty || 'normal'));
        break;
      }
      case 'pos': {
        if (obj.id === this.myId) break;
        const ent = this.ensureRemotePlayer(obj.id, obj.name);
        if (ent) {
          ent.dead = !!obj.d; // MC: the remote model tips over when the player dies
          if (!ent.dead) ent.deathTime = 0;
          // MC-style snapshot interpolation: keep the last two received
          // positions and slide between them at a fixed delay. A per-tick
          // lerp toward the target instead leaves an exponential tail (the
          // avatar "ice-skates" after the sender stopped) and steps at 10 Hz.
          ent.sx = ent.tx !== undefined ? ent.tx : obj.x;
          ent.sy = ent.ty !== undefined ? ent.ty : obj.y;
          ent.sz = ent.tz !== undefined ? ent.tz : obj.z;
          ent.tx = obj.x; ent.ty = obj.y; ent.tz = obj.z;
          ent.snapT = performance.now();
          // yaw along the shortest arc between snapshots
          ent.syaw = ent.tyaw !== undefined ? ent.tyaw : obj.yaw;
          ent.tyaw = obj.yaw;
          ent.tpitch = obj.pitch;
          ent.walkSpeed = obj.sp || 0;
          ent.swingT2 = obj.sw ? 10 : (ent.swingT2 || 0);
          ent.lastSeen = performance.now(); // stale watchdog reference
          if (ent.swingT2 > 0) ent.swingT2--;
        }
        const peer = this.peers.get(obj.id) || this.bcPeers?.get(obj.id);
        break;
      }
      case 'block': {
        // cooperative model: remote edits are always applied (the sender's
        // own world already has them; the host is not an authority filter)
        applyRemoteBlock(obj);
        break;
      }
      case 'chat': Chat.add(obj.msg); break;
      // the host's clock wins (host authority); a guest's local /time set is
      // overridden at the next 5s sync
      case 'time': if (!this.isHostOrSingle) G.world.time = obj.time; break;
      // difficulty changes from the host apply instantly (peaceful despawns etc.)
      case 'difficulty':
        if (!this.isHostOrSingle && ['peaceful', 'easy', 'normal', 'hard'].includes(obj.d)) {
          G.difficulty = obj.d;
          Chat.add('§7Schwierigkeit: §f' + obj.d);
        }
        break;
      case 'weather': G.rain = obj.rain; G.thunder = obj.thunder; break;
      case 'te': this.applyTE(obj.k, obj.te); break;
      case 'left': {
        const e = this.remotePlayers?.get(obj.id);
        if (e) {
          e.dead = true;
          const i = G.entities.indexOf(e);
          if (i >= 0) G.entities.splice(i, 1); // fully despawn — a dead corpse must not linger
          this.remotePlayers.delete(obj.id);
        }
        this.peers.delete(obj.id);
        Chat.add('§e' + (obj.name || 'Ein Spieler') + ' hat das Spiel verlassen');
        break;
      }
    }
  }

  serializeTEs() {
    const out = [];
    for (const [k, te] of G.tileEntities) {
      const [d] = [0];
      out.push([k, te]);
    }
    return out;
  }
  deserializeTEs(arr) {
    for (const [k, te] of arr) G.tileEntities.set(k, te);
  }
  applyTE(k, te) {
    G.tileEntities.set(k, te);
    // remesh chunk
    const [x, y, z] = k.split(',').map(Number);
    const c = G.world.getChunk(x >> 4, z >> 4);
    if (c) c.dirty = true;
  }

  ensureRemotePlayer(id, name) {
    this.remotePlayers = this.remotePlayers || new Map();
    let e = this.remotePlayers.get(id);
    if (!e) {
      // a stale fallen model must never linger as a ghost in G.entities
      if (e) { const i = G.entities.indexOf(e); if (i >= 0) G.entities.splice(i, 1); }
      const def = Object.assign({}, MOB_DEFS.player_remote, { model: 'humanoid' });
      e = new Entity('player_remote', G.player.x, G.player.y, G.player.z, def, {});
      e.nameTag = name;
      e.remoteId = id;
      e.hittable = false;
      e.isRemotePlayer = true;
      e.noAI = true; // position/animation come purely from snapshots — local mob AI would fight them
      e.tx = e.x; e.ty = e.y; e.tz = e.z;
      G.entities.push(e);
      this.remotePlayers.set(id, e);
    }
    return e;
  }

  // ---------- BroadcastChannel mode ----------
  startBC(host, code) {
    this.mode = host ? 'bc-host' : 'bc-join';
    this.isHostOrSingle = host;
    // room code: host generates a 6-char code, guests join by entering it
    if (host && !this.roomCode) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      this.roomCode = '';
      for (let i = 0; i < 6; i++) this.roomCode += chars[Math.floor(Math.random() * chars.length)];
    } else if (code) this.roomCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (!this.roomCode || this.roomCode.length < 4) {
      // guest without a code: listen on the shared LAN discovery channel and
      // hop onto whatever host announces itself there ("join same browser")
      if (!host) { this._discoveryJoin = true; this.roomCode = 'LAN'; }
      else this.roomCode = 'DEFAULT';
    }
    this.bc = new BroadcastChannel('webcraft-' + this.roomCode);
    this._bindChannel();
    if (host) {
      // announce on the private room channel AND the shared discovery channel;
      // also ANSWER discovery requests immediately (guest does not wait 1.5 s)
      this._disco = new BroadcastChannel('webcraft-LAN');
      this._disco.onmessage = (ev) => {
        const obj = ev.data;
        if (obj && obj.t === 'discover') {
          try { this._disco.postMessage({ t: 'host-here', id: this.myId, name: this.myName, ch: this.roomCode, playing: G.state === 'playing' }); } catch (e) { }
        }
      };
      this._announce = setInterval(() => {
        try {
          const m = { t: 'host-here', id: this.myId, name: this.myName, ch: this.roomCode, playing: G.state === 'playing' };
          this.bc.postMessage(m);
          this._disco.postMessage(m);
        } catch (e) { }
      }, 1500);
      this.log('Hosting on BroadcastChannel (open the page in another tab to join)');
      // the HUD badge is ONLY shown inside menu overlays (showScreen) — never during gameplay
      const val = document.getElementById('mp-code-value');
      if (val) val.textContent = this.roomCode;
      Chat.add('§aMultiplayer-Code: §f' + this.roomCode + ' §7— sichtbar im ESC-Menü');
    } else {
      this.log('Suche nach Host im selben Browser...');
      // instant discovery request instead of waiting for the next announce tick
      if (this._discoveryJoin) {
        setTimeout(() => { try { this.bc.postMessage({ t: 'discover', id: this.myId }); } catch (e) { } }, 120);
      } else {
        // coded join: request membership directly and retry every 1.5 s until
        // the host answers (no dependence on announce timing)
        this.sendAll({ t: 'join', id: this.myId, name: this.myName });
        this._joinRetry = setInterval(() => {
          if (this.joined || this.mode === null) { clearInterval(this._joinRetry); return; }
          this.sendAll({ t: 'join', id: this.myId, name: this.myName });
        }, 1500);
      }
      setTimeout(() => { if (!this.joined) this.log('Noch kein Host gefunden — Host-Tab geöffnet und Code korrekt?', true); }, 4000);
      // guest stuck on the search screen: send them back with a clear message
      setTimeout(() => {
        if (!this.joined && G.state === 'title') {
          showScreen('multiplayer-screen');
          Chat.add('§cKein Host gefunden — läuft das Host-Spiel im selben Browser, oder stimmt der Code?');
        }
      }, 8000);
    }
  }

  // channel message binding — re-runnable so a discovery guest can hop onto
  // the host's private room channel without losing the handler
  _bindChannel() {
    this.bc.onmessage = (ev) => {
      const obj = ev.data;
      const reply = (o) => { try { this.bc.postMessage({ ...o, _to: obj.id }); } catch (e) { } };
      if (obj._to && obj._to !== this.myId && obj.t !== 'welcome') return;
      // discovery guest: a host announced itself — hop onto his private room
      // channel and start the join handshake. Prefer hosts that are IN-GAME
      // (obj.playing); a host that already announced but never answers (stale
      // tab) is retried once, then the guest returns to the discovery channel.
      if (this._discoveryJoin && obj.t === 'host-here' && obj.ch && obj.ch !== this.roomCode) {
        if (this._triedHosts && this._triedHosts.has(obj.ch) && !obj.playing) return;
        this._triedHosts = this._triedHosts || new Set();
        this._discoveryJoin = false;
        try { this.bc.close(); } catch (e) { }
        this.roomCode = obj.ch;
        try { this.bc = new BroadcastChannel('webcraft-' + this.roomCode); } catch (e) { return; }
        this._bindChannel();
        this._triedHosts.add(this.roomCode);
        this.log('Host gefunden (' + this.roomCode + ') — Beitritt...');
        this.sendAll({ t: 'join', id: this.myId, name: this.myName });
        // fallback: no welcome within 2.5 s → this announce was stale; go back
        // to the discovery channel and keep searching
        setTimeout(() => {
          if (!this.joined && G.net === this && this.mode === 'bc-join') {
            this.log('Host antwortet nicht — Suche läuft weiter...');
            try { this.bc.close(); } catch (e) { }
            this.roomCode = 'LAN';
            this.bc = new BroadcastChannel('webcraft-LAN');
            this._bindChannel();
            this._discoveryJoin = true;
            setTimeout(() => { try { this.bc.postMessage({ t: 'discover', id: this.myId }); } catch (e) { } }, 120);
          }
        }, 2500);
        return;
      }
      this.onMessage(obj, reply);
    };
  }

  // ---------- WebRTC manual mode ----------
  async startRTC(host) {
    this.mode = host ? 'rtc-host' : 'rtc-join';
    this.isHostOrSingle = host;
    this.rtcPC = new RTCPeerConnection({
      // public STUN in the documented MDN RTCIceServer `urls` syntax (Google's
      // servers follow the webrtc.org samples convention). Host candidates
      // alone suffice inside one LAN; STUN covers most home-NAT topologies.
      // A TURN relay is the documented remedy for symmetric NATs (none free).
      iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
    });
    const area = $('sdp-area');
    this.rtcPC.ondatachannel = (ev) => this.setupDC(ev.channel);
    if (host) {
      this.dc = this.rtcPC.createDataChannel('game', { ordered: true });
      this.setupDC(this.dc);
      const offer = await this.rtcPC.createOffer();
      await this.rtcPC.setLocalDescription(offer);
      this.log('Creating invite code (gather ICE candidates)...');
      await this.waitForIce(this.rtcPC);
      area.value = btoa(JSON.stringify(this.rtcPC.localDescription));
      this.log('Invite code ready — copy it to your friend.');
    }
  }
  async rtcJoinWithCode(code) {
    const desc = JSON.parse(atob(code.trim()));
    await this.rtcPC.setRemoteDescription(desc);
    const answer = await this.rtcPC.createAnswer();
    await this.rtcPC.setLocalDescription(answer);
    await this.waitForIce(this.rtcPC);
    $('sdp-area').value = btoa(JSON.stringify(this.rtcPC.localDescription));
    this.log('Answer code generated — send it back to the host and let them press Apply.');
  }
  async rtcHostApplyCode(code) {
    const desc = JSON.parse(atob(code.trim()));
    await this.rtcPC.setRemoteDescription(desc);
    this.log('Connected! Applying world...');
    // send join+welcome
    setTimeout(() => {
      this.peers.set('rtc', { name: 'Friend', send: null, lastSeen: performance.now() });
      this.sendAll({ t: 'welcome', to: 'rtc', id: this.myId, name: this.myName, seed: G.seed, time: G.world.time, mode: G.gameMode, edits: [...G.world.edits.entries()], tes: this.serializeTEs(), rain: G.rain, thunder: G.thunder });
    }, 500);
  }
  waitForIce(pc) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const check = () => { if (pc.iceGatheringState === 'complete') { cleanup(); resolve(); } };
      const cleanup = () => { clearInterval(t); pc.removeEventListener('icegatheringstatechange', check); };
      const t = setInterval(check, 200);
      pc.addEventListener('icegatheringstatechange', check);
      setTimeout(() => { cleanup(); resolve(); }, 4000); // don't wait forever
    });
  }
  setupDC(dc) {
    this.dc = dc;
    dc.onmessage = (ev) => {
      try { this.onMessage(JSON.parse(ev.data)); } catch (e) { }
    };
    dc.onopen = () => this.log('DataChannel open — connected!');
    dc.onclose = () => this.log('DataChannel closed', true);
  }

  // ---------- WebSocket relay ----------
  connectWS(url) {
    try {
      this.ws = new WebSocket(url);
      if (!this.bc) { this.mode = 'ws'; this.isHostOrSingle = !this._wsJoinedAsClient; }
      this.ws.onopen = () => {
        this.log('Relay verbunden (Internet-Modus, Raum: ' + (this.roomCode || 'default') + ').');
        this.ws.send(JSON.stringify({ t: 'join-room', room: 'webcraft-' + (this.roomCode || 'default'), id: this.myId }));
        // hardening: OUR relay confirms with room-joined — anything else is a
        // foreign service on that URL (wrong Render service name)
        setTimeout(() => {
          if (this.ws && this.ws.readyState === 1 && !this._roomJoined) {
            this.log('§cRelay-Antwort unerwartet — das ist NICHT unser Relay-Server. Render-Service-Name/URL prüfen!', true);
          }
        }, 3000);
        // coded join over the relay: request membership immediately (no wait)
        if (!this.isHostOrSingle) this.sendAll({ t: 'join', id: this.myId, name: this.myName });
      };
      this.ws.onmessage = (ev) => {
        try {
          const obj = JSON.parse(ev.data);
          if (obj.t === 'room-joined') { this._roomJoined = true; this.log('Relay-Raum betreten — wartet auf Spieler...'); return; }
          this.onMessage(obj, (o) => { try { this.ws.send(JSON.stringify({ ...o, _to: obj.id })); } catch (e) { } });
        } catch (e) { }
      };
      this.ws.onclose = () => this.log('Relay disconnected', true);
      this.ws.onerror = () => this.log('Relay error — check the URL', true);
    } catch (e) { this.log('WS error: ' + e.message, true); }
  }

  // ---------- per-tick sync ----------
  tick() {
    if (this.mode === null) return;
    // periodic time sync — the host is the clock authority. Without this the
    // tabs' day/night cycles drift apart within minutes (measured: 8 min apart)
    this.timeT = (this.timeT || 0) + 1;
    if (this.timeT >= 100) { // every 5s at 20 TPS
      this.timeT = 0;
      if (this.isHostOrSingle) this.sendAll({ t: 'time', time: G.world.time, dim: G.dimension });
    }
    this.posT--;
    // also send from the multiplayer menu — the world (and gravity) keeps
    // running there, so the remote side must keep seeing us move
    if (this.posT <= 0 && G.player && (G.state === 'playing' || G.state === 'paused' || G.state === 'dead')) {
      this.posT = 1; // 20 Hz — Minecraft sends 20 positions/s
      const p = G.player;
      this.sendAll({
        t: 'pos', id: this.myId, name: this.myName,
        x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
        yaw: +p.yaw.toFixed(2), pitch: +p.pitch.toFixed(2),
        sp: +Math.hypot(p.vx, p.vz).toFixed(2), sw: p.swingT > .5,
        d: p.dead ? 1 : 0, // MC: the remote model tips over when you die
      });
    }
    // interpolate remote players — MC-style snapshots: slide at constant speed
    // between the last two received positions (20 Hz → 50 ms delay). The old
    // per-tick lerp(0.25) left an exponential tail (avatar "ice-skates" on
    // after the sender stopped) and visibly stepped at 10 Hz.
    if (this.remotePlayers) {
      const nowMs = performance.now();
      for (const [rid, e] of this.remotePlayers) {
        // stale watchdog: a page that closed without delivering its 'left'
        // message (unload quirk) despawns after 5 s of silence
        if (!e.dead && e.lastSeen && nowMs - e.lastSeen > 5000) {
          e.dead = true;
          const i = G.entities.indexOf(e);
          if (i >= 0) G.entities.splice(i, 1);
          this.remotePlayers.delete(rid);
          this.peers.delete(rid);
          Chat.add('§e' + (e.nameTag || 'Ein Spieler') + ' hat das Spiel verlassen');
          continue;
        }
        if (e.dead) { e.deathTime++; continue; } // tip the fallen model over
        const a = Math.min(1, (nowMs - (e.snapT || nowMs)) / 50); // 50 ms = one 20 Hz snapshot interval
        const sx = e.sx ?? e.tx ?? e.x, sy = e.sy ?? e.ty ?? e.y, sz = e.sz ?? e.tz ?? e.z;
        e.x = sx + ((e.tx ?? sx) - sx) * a;
        e.y = sy + ((e.ty ?? sy) - sy) * a;
        e.z = sz + ((e.tz ?? sz) - sz) * a;
        // yaw along the shortest arc
        e.yawO = e.yaw; // for emitPart's interpolated body yaw (keep BEFORE reassigning)
        let dyaw = (e.tyaw ?? e.yaw) - (e.syaw ?? e.yaw);
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        e.yaw = (e.syaw ?? e.yaw) + dyaw * a;
        e.pitch = e.tpitch ?? e.pitch;
        // animation phase: previous values kept for the render-alpha interpolation.
        // The phase constant MUST match local mobs (walkSpeed is in ticks-velocity
        // units ≈ 0.2 while walking; the old ×22 cycled the legs ~13 rad/s = shaking)
        e.walkAnimO = e.walkAnim;
        e.walkSpeedO = e.walkSpeed;
        e.walkAnim += (e.walkSpeed || 0) * 3.2;
      }
    }
  }

  shutdown() {
    const badge = document.getElementById('mp-code-badge');
    if (badge) badge.style.display = 'none';
    this.sendAll({ t: 'left', id: this.myId, name: this.myName });
    clearInterval(this._announce);
    clearInterval(this._joinRetry);
    try { this._disco && this._disco.close(); } catch (e) { }
    try { this.bc && this.bc.close(); } catch (e) { }
    try { this.dc && this.dc.close(); } catch (e) { }
    try { this.ws && this.ws.close(); } catch (e) { }
    this.mode = null;
    this.peers.clear();
  }
}

function applyRemoteBlock(obj) {
  // world not built yet (guest is still joining) → queue; drained after the
  // welcome rebuild (see startGame's mesh completion)
  if (!G.world) { G.pendingRemoteEdits = G.pendingRemoteEdits || []; G.pendingRemoteEdits.push(obj); return; }
  // blocks for OTHER dimensions: apply to the cached dimension world, or park
  // them in its edit list so nothing is lost when the player travels there
  if (obj.d !== G.dimension) {
    const dw = (typeof DIM_WORLDS !== 'undefined') && DIM_WORLDS.get(obj.d);
    if (dw) dw.setBlock(obj.x, obj.y, obj.z, obj.id, obj.m, { noNet: true });
    else {
      G.dimEdits = G.dimEdits || {};
      G.dimEdits[obj.d] = (G.dimEdits[obj.d] || []).concat([[obj.x + ',' + obj.y + ',' + obj.z, [obj.id, obj.m || 0]]]);
    }
    return;
  }
  // record FIRST — the edits map is the source of truth for chunk generation
  // (ensureChunk applies it); setBlock then applies into the chunk right away
  // if it exists (heightmap, light, remesh). noEdit avoids double-recording.
  G.world.edits.set(obj.x + ',' + obj.y + ',' + obj.z, [obj.id, obj.m || 0]);
  G.world.setBlock(obj.x, obj.y, obj.z, obj.id, obj.m, { noEdit: true, noNet: true });
}

// tile entity change broadcast (called on container close)
function broadcastTE(key) {
  if (G.net && G.net.mode !== null) {
    const te = G.tileEntities.get(key);
    if (te) G.net.sendAll({ t: 'te', k: key, te });
  }
}
