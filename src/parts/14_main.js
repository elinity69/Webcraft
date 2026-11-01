// ============================================================================
// Part 14: Main — game loop, chunk manager, weather, random ticks, HUD,
// save/load, settings, title flow, input, boot
// ============================================================================
function requestPointerLock() {
  if (G.state !== 'playing') return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const c = $('game-canvas');
  if (!c.requestPointerLock) return;
  try {
    const r = c.requestPointerLock();
    if (r && r.catch) r.catch(() => { /* browser cooldown — canvas click retries */ });
  } catch (e) { /* ignore */ }
}

// ---------- Input ----------
function setupInput() {
  const canvas = $('game-canvas');
  // clicking any button blurs it so Space/Enter can't re-trigger it mid-game
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('button');
    if (b) b.blur();
  }, true);
  window.addEventListener('keydown', (e) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      if (e.code === 'Enter') Chat.submit();
      if (e.code === 'Escape') Chat.close();
      return;
    }
    if (G.state === 'playing' && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown')) e.preventDefault();
    KEYS[e.code] = true;
    if (e.code === 'F3' || e.code === 'F11' || e.code === 'F5') e.preventDefault();
    if (G.state === 'playing' || G.state === 'container' || G.state === 'paused') {
      const p = G.player;
      if (e.code === 'Escape') {
        if (G.state === 'container') { UI.closeContainer(); return; }
        if (G.state === 'paused') { resumeGame(); return; } // ESC toggles the pause screen away
        pauseGame();
        return;
      }
      if (G.state === 'container') {
        // MC 1:1: hovering a slot and pressing 1-9 moves that item to the
        // matching hotbar slot (no hotbar-switch while inside a container)
        if (/^Digit[1-9]$/.test(e.code) && UI.hovering) {
          e.preventDefault();
          UI.moveHoveredToHotbar(parseInt(e.code.slice(5), 10) - 1);
        }
        return;
      }
      if (G.state !== 'playing') return;
      if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && !e.repeat) {
        p.sprintToggled = !p.sprintToggled; // sprint is a TOGGLE (MC toggle-sprint)
      }
      if (e.code === 'KeyW' && !e.repeat) {
        const nowW = performance.now();
        if (nowW - (p.lastWTap || 0) < 300) {
          p.sprintToggled = true; // MC double-tap W to sprint
        }
        p.lastWTap = nowW;
      }
      switch (e.code) {
        case 'KeyE': UI.openInventory(); break;
        case 'KeyT': e.preventDefault(); Chat.open(); break;
        case 'Slash': e.preventDefault(); Chat.open(); $('chat-input').value = '/'; break;
        case 'F3': G.f3 = !G.f3; $('f3-debug').style.display = G.f3 ? 'flex' : 'none'; break;
        case 'F11': document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); break;
        case 'KeyQ': {
          const s = p.getHeldItem();
          if (s) {
            const drop = { ...s, count: e.ctrlKey ? s.count : 1 };
            s.count -= drop.count;
            if (s.count <= 0) p.slots[p.held] = null;
            const dir = fwdFromYawPitch(p.yaw, p.pitch, [0, 0, 0]);
            const ent = dropItem(p.x + dir[0] * .5, p.y + 1.3, p.z + dir[2] * .5, ITEMS[drop.id].key, drop.count, drop.dur, drop.ench);
            if (ent) { ent.vx = dir[0] * 6; ent.vy = dir[1] * 6 + 1.5; ent.vz = dir[2] * 6; ent.age = -30; }
            UI.refreshHotbar();
          }
          break;
        }
        case 'KeyF': { // swap offhand
          const t = p.slots[40];
          p.slots[40] = p.slots[p.held];
          p.slots[p.held] = t;
          p.equipT = 1;
          UI.refreshHotbar();
          break;
        }
        case 'Space': {
          const now = performance.now();
          if (p.gameMode === 'creative' && now - p.lastSpaceTap < 280) {
            p.flying = !p.flying;
            if (p.flying) p.vy = 0.1;
          }
          p.lastSpaceTap = now;
          break;
        }
      }
      if (/^Digit[1-9]$/.test(e.code)) {
        p.held = parseInt(e.code.slice(5)) - 1;
        p.equipT = 1;
        UI.refreshHotbar();
        UI.updateHotbarItemName();
      }
    } else if (G.state === 'dead') {
      // NO Enter-to-respawn — Minecraft only respawns via the button (an Enter
      // reflex / chat habit caused instant "invisible" respawns)
    }
  });
  window.addEventListener('keyup', (e) => { KEYS[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; MOUSE.left = MOUSE.right = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (G.state === 'title' || G.state === 'loading' || G.state === 'dead') return;
    if (G.state === 'playing' && document.pointerLockElement !== canvas) { requestPointerLock(); return; }
    if (G.state !== 'playing') return;
    SFX.init();
    if (e.button === 0) {
      MOUSE.left = true;
      attackClick();
    } else if (e.button === 2) {
      MOUSE.right = true;
      const p = G.player;
      // begin eating/bow handled in tick; instant interactions here:
      p.useItem();
      p.placeCooldown = 0.25;
    } else if (e.button === 1) {
      e.preventDefault();
      // pick block
      const p = G.player;
      if (p.targetBlock) {
        const id = G.world.getBlock(...p.targetBlock);
        if (id > 0) {
          const key = BLOCK_KEYS[id];
          if (I[key] !== undefined) {
            for (let i = 0; i < 9; i++) if (p.slots[i] && p.slots[i].id === I[key]) { p.held = i; UI.refreshHotbar(); return; }
            if (p.gameMode === 'creative') { p.slots[p.held] = { id: I[key], count: 64 }; UI.refreshHotbar(); }
          }
        }
      }
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) { MOUSE.left = false; }
    if (e.button === 2) { MOUSE.right = false; }
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) { G._hadLock = true; return; }
    // pause only when a previously HELD lock is lost (ESC / tab switch);
    // a lock that was never acquired (no user gesture yet) must not pause
    if (G._hadLock && G.state === 'playing') { G._hadLock = false; pauseGame(); }
  });
  document.addEventListener('pointerlockerror', () => {
    // request denied (cooldown): stay in playing state; next canvas click retries
  });
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== $('game-canvas')) return;
    const sens = 0.0023 * G.settings.sensitivity;
    G.player.yaw -= e.movementX * sens;
    G.player.pitch += e.movementY * sens; // movementY>0 = mouse down = look down (pitch>0)
    G.player.pitch = clamp(G.player.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  });
  window.addEventListener('wheel', (e) => {
    if (G.state !== 'playing') return;
    const d = Math.sign(e.deltaY);
    G.player.held = (G.player.held + d + 9) % 9;
    G.player.equipT = 1;
    UI.refreshHotbar();
    UI.updateHotbarItemName();
  }, { passive: true });

  // chat input
  $('chat-input').addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Enter') Chat.submit();
    if (e.code === 'Escape') Chat.close();
  });

  // cursor item follows mouse
  window.addEventListener('mousemove', (e) => {
    const el = $('cursor-item');
    if (el.style.display !== 'none') {
      el.style.left = e.clientX + 'px';
      el.style.top = e.clientY + 'px';
    }
  });
}

function attackClick() {
  const p = G.player;
  p.triggerSwing();
  SFX.playSwing();
  if (p.targetEntity && p.attackCooldown <= 0) {
    const e = p.targetEntity;
    const item = p.getHeldItem();
    const def = item ? ITEMS[item.id] : null;
    let dmg = def ? def.damage : 1;
    const ench = (item && item.ench) || {};
    if (ench.sharpness) dmg += 0.5 * ench.sharpness + 0.5;
    if (p.effects && p.effects.strength) dmg += 3 * (p.effects.strength.lvl || 1);
    // 1:1 Attack cooldown charge (Player.getAttackStrengthScale)
    const charge = clamp(1 - p.attackCooldown / 0.62, 0.2, 1);
    dmg = Math.max(1, Math.round(dmg * (0.2 + charge * charge * 0.8)));
    // Critical hit when falling in air
    let crit = false;
    if (p.fallDistance > 0 && !p.onGround && !p.inWater && !p.onLadder && !p.sprinting) {
      dmg = Math.round(dmg * 1.5);
      crit = true;
    }
    p.attackCooldown = 0.62;
    e.damage(dmg, p);
    SFX.playHit(crit);
    p.addExhaustion(0.1);
    if (crit) spawnParticles(e.x, e.y + e.h * 0.7, e.z, 10, [1, 0.92, 0.45], true);
    // 1:1 ToolMaterial.java weapon durability loss:
    // Sword costs 1 durability on entity hit; mining tools (pickaxe/axe/shovel/hoe) cost 2 durability
    if (def && def.tool) {
      const durCost = def.tool.type === 'sword' ? 1 : (def.tool.type === 'pickaxe' || def.tool.type === 'axe' || def.tool.type === 'shovel' || def.tool.type === 'hoe' ? 2 : 1);
      p.damageTool(durCost);
    }
    // anger neutral mobs
    if (e.def && e.def.neutralInLight) e.angerTime = 400;
  }
}

// entity right-click interactions (shear, breed, milk)
Player.prototype.tryInteractEntity = function () {
  const p = this;
  if (!p.targetEntity) return false;
  const e = p.targetEntity;
  if (e.dead || e.isRemotePlayer) return false;
  const item = p.getHeldItem();
  const def = item ? ITEMS[item.id] : null;
  const d = e.def || {};
  // equip saddle on pig, or ride boats, carts & saddled pigs
  if (def && def.key === 'saddle' && e.type === 'pig' && !e.saddled) {
    e.saddled = true;
    p.consumeHeld();
    SFX.playClick(true);
    return true;
  }
  if ((d.ridable || (e.type === 'pig' && e.saddled)) && !p.riding) {
    p.riding = e;
    e.rider = p;
    p.eating = false;
    SFX.playClick(true);
    return true;
  }
  // shear sheep
  if (def && def.tool && def.tool.type === 'shears' && d.shearable && !e.sheared) {
    e.sheared = true;
    const color = e.woolColor || 'white';
    dropItem(e.x, e.y + .5, e.z, color + '_wool', randInt(1, 3));
    SFX.playDig('wool');
    p.damageTool(1);
    return true;
  }
  // milk cow
  if (def && def.bucket === 'empty' && e.type === 'cow') {
    p.replaceHeld({ id: I.milk_bucket, count: 1 });
    SFX.playSplash();
    return true;
  }
  // breed
  if (def && def.food && d.breedItem === ITEMS[item.id].key && e.babyAge >= 0 && e.inLove <= 0) {
    e.inLove = 600;
    spawnHeartParticles(e.x, e.y + e.h, e.z);
    SFX.playDig('grass');
    p.consumeHeld();
    return true;
  }
  return false;
};
const _origUseItem = Player.prototype.useItem;
Player.prototype.useItem = function () { if (this.tryInteractEntity()) return; _origUseItem.call(this); };
// crystal death explodes
const _origEntDie = Entity.prototype.die;
Entity.prototype.die = function (attacker) {
  if (this.type === 'crystal') {
    this.dead = true;
    explode(this.x, this.y + 1, this.z, 3);
    if (G.settings.particles) spawnParticles(this.x, this.y + 1, this.z, 30, [1, .95, .8], true);
    return;
  }
  _origEntDie.call(this, attacker);
};

// ---------- Chunk manager ----------
const ChunkManager = {
  update(budgetGen = 2, budgetMesh = 3, meshTimeMs = 6) {
    const w = G.world, p = G.player;
    if (!w || !p) return;
    const pcx = Math.floor(p.x / CH), pcz = Math.floor(p.z / CH);
    const R = G.settings.renderDist;
    // generate nearest missing chunks (spiral by distance)
    let gen = 0;
    for (let r = 0; r <= R && gen < budgetGen; r++) {
      for (let dx = -r; dx <= r && gen < budgetGen; dx++) for (let dz = -r; dz <= r && gen < budgetGen; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = pcx + dx, cz = pcz + dz;
        const c = w.getChunk(cx, cz);
        if (!c || !c.generated) { w.ensureChunk(cx, cz); gen++; }
      }
    }
    // unload far chunks
    for (const [key, c] of w.chunks) {
      if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > R + 3) {
        G.renderer.removeChunkGL(key + ':' + G.dimension);
        w.chunks.delete(key);
        w._lcKey = null;
      }
    }
    // light queue processing
    w.processLightQueue(4000);
    // mesh dirty chunks nearest first
    const dirty = [];
    for (const [key, c] of w.chunks) {
      if (c.generated && c.dirty) {
        const dist = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
        if (dist <= R) dirty.push([dist, key, c]);
      }
    }
    dirty.sort((a, b) => a[0] - b[0]);
    let meshed = 0;
    const meshT0 = performance.now();
    for (const [, key, c] of dirty) {
      if (meshed >= budgetMesh || (meshed > 0 && performance.now() - meshT0 > meshTimeMs)) break;
      // require 4 neighbors generated for correct culling
      const n1 = w.getChunk(c.cx + 1, c.cz), n2 = w.getChunk(c.cx - 1, c.cz),
        n3 = w.getChunk(c.cx, c.cz + 1), n4 = w.getChunk(c.cx, c.cz - 1);
      if (n1?.generated && n2?.generated && n3?.generated && n4?.generated) {
        const m = Mesher.build(w, c);
        const glKey = key + ':' + G.dimension;
        G.renderer.uploadChunkMesh(glKey, m.opaque, 'opaque');
        G.renderer.uploadChunkMesh(glKey, m.trans, 'trans');
        c.dirty = false;
        meshed++;
      }
    }
  },
  remeshAll() {
    for (const [key, c] of G.world.chunks) c.dirty = true;
  }
};

// ---------- Random ticks (grass, crops, growth, leaf decay) ----------
const RandomTicks = {
  run() {
    const w = G.world, p = G.player;
    const pcx = Math.floor(p.x / CH), pcz = Math.floor(p.z / CH);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const c = w.getChunk(pcx + dx, pcz + dz);
      if (!c || !c.generated) continue;
      for (let n = 0; n < 3; n++) {
        const lx = randInt(0, 15), lz = randInt(0, 15), y = randInt(1, WORLD_H - 2);
        this.tickBlock(w, (pcx + dx) * CH + lx, y, (pcz + dz) * CH + lz);
      }
    }
  },
  tickBlock(w, x, y, z) {
    const id = w.getBlock(x, y, z);
    if (id <= 0) return;
    const bl = BLOCKS[id];
    const m = w.getMeta(x, y, z);
    // grass spread / die
    if (id === B.grass_block) {
      const above = w.getBlock(x, y + 1, z);
      if (above > 0 && BLOCKS[above].opaque) { w.setBlock(x, y, z, B.dirt, 0); return; }
      // spread to nearby dirt
      const sx = x + randInt(-1, 1), sy = y + randInt(-1, 1), sz = z + randInt(-1, 1);
      if (w.getBlock(sx, sy, sz) === B.dirt && w.getBlock(sx, sy + 1, sz) === 0 && w.skyLight(sx, sy + 1, sz) > 8) {
        w.setBlock(sx, sy, sz, B.grass_block, 0);
      }
      return;
    }
    // sapling growth
    for (const wd of WOODS) {
      if (id === B[wd + '_sapling']) {
        if (w.skyLight(x, y, z) > 8 && chance(.12)) {
          w.setBlock(x, y, z, 0, 0);
          growTree(w, x, y, z, wd);
        }
        return;
      }
    }
    // crops
    if (id === B.wheat) {
      if ((m & 7) < 7 && w.skyLight(x, y, z) > 8) {
        // farmland hydration boost
        const fm = w.getMeta(x, y - 1, z);
        if (chance(fm > 0 ? .35 : .15)) w.setBlock(x, y, z, B.wheat, (m & 7) + 1, { noUpdate: true });
      }
      return;
    }
    // farmland hydration
    if (id === B.farmland) {
      let near = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        if (w.getBlock(x + dx, y, z + dz) === B.water || w.getBlock(x + dx, y + 1, z + dz) === B.water) { near = true; break; }
      }
      if (near && (m & 7) < 7) w.setBlock(x, y, z, B.farmland, 7, { noUpdate: true });
      else if (!near && m > 0 && chance(.3)) w.setBlock(x, y, z, B.farmland, Math.max(0, m - 1), { noUpdate: true });
      else if (!near && m === 0 && chance(.04)) w.setBlock(x, y, z, B.dirt, 0);
      return;
    }
    // sugar cane & cactus growth
    if (id === B.sugar_cane || id === B.cactus) {
      let h = 1;
      while (w.getBlock(x, y - h, z) === id && h < 4) h++;
      if (h < 3 && w.getBlock(x, y + 1, z) === 0 && chance(.18)) w.setBlock(x, y + 1, z, id, 0, { noUpdate: true });
      return;
    }
    // fire burnout
    if (id === B.fire) {
      // fire adjacent to a lit portal = leftover from failed ignitions → extinguish
      for (const [dx2, dy2, dz2] of NEIGH6) {
        if (w.getBlock(x + dx2, y + dy2, z + dz2) === B.nether_portal) { w.setBlock(x, y, z, 0, 0, { noUpdate: true }); return; }
      }
      const below = w.getBlock(x, y - 1, z);
      if (below !== B.netherrack && chance(.25)) w.setBlock(x, y, z, 0, 0);
      return;
    }
    // ice melting near warm light
    if (id === B.ice && w.blockLight(x, y + 1, z) > 11) { w.setBlock(x, y, z, B.water, 0); return; }
    // leaf decay
    if (bl.key.includes('_leaves') && !(m & 1)) {
      if (this.noWoodNear(w, x, y, z)) {
        w.setBlock(x, y, z, 0, 0);
        if (chance(.05)) dropItem(x + .5, y, z + .5, bl.key.replace('_leaves', '_sapling'), 1);
        if (bl.key === 'oak_leaves' && chance(.05)) dropItem(x + .5, y, z + .5, 'apple', 1);
      }
      return;
    }
  },
  noWoodNear(w, x, y, z) {
    // small BFS for logs within distance 4
    const seen = new Set([x + ',' + y + ',' + z]);
    const q = [[x, y, z, 0]];
    while (q.length) {
      const [cx, cy, cz, d] = q.shift();
      if (d >= 4) continue;
      for (const [dx, dy, dz] of NEIGH6) {
        const nx = cx + dx, ny = cy + dy, nz = cz + dz;
        const k = nx + ',' + ny + ',' + nz;
        if (seen.has(k)) continue;
        seen.add(k);
        const nid = w.getBlock(nx, ny, nz);
        if (nid < 0) continue;
        if (nid > 0 && BLOCK_KEYS[nid].includes('_log')) return false;
        if (nid > 0 && (BLOCKS[nid].opaque || BLOCKS[nid].key.includes('_leaves'))) continue;
        q.push([nx, ny, nz, d + 1]);
      }
    }
    return true;
  },
};

// ---------- Weather ----------
const Weather = {
  timer: randInt(3000, 12000),
  tick() {
    if (--this.timer <= 0) {
      if (G.rain > 0) { G.rain = 0; G.thunder = 0; this.timer = randInt(6000, 20000); Chat.actionBar('The weather has cleared.'); }
      else { G.rain = .4 + rand() * .6; this.timer = randInt(2000, 8000); Chat.actionBar('It starts to rain...'); }
      if (G.net && G.net.isHostOrSingle) G.net.sendAll({ t: 'weather', rain: G.rain, thunder: G.thunder });
    }
    if (G.rain > 0 && G.dimension === 0) {
      // particles around player
      const p = G.player;
      const biome = G.world.gen.biomeAt(Math.floor(p.x), Math.floor(p.z));
      const snowy = BIOMES[biome]?.snow;
      const n = snowy ? 6 : 10;
      if (G.settings.particles) {
        for (let i = 0; i < n; i++) {
          const rx = p.x + (rand() - .5) * 24, rz = p.z + (rand() - .5) * 24, ry = p.y + 8 + rand() * 6;
          // don't spawn indoors: check sky
          if (G.world.skyLight(Math.floor(rx), Math.floor(ry), Math.floor(rz)) < 12) continue;
          if (snowy) {
            G.particles.push({ x: rx, y: ry, z: rz, vx: (rand() - .5) * .3, vy: -1.2, vz: (rand() - .5) * .3, r: .95, g: .97, b: 1, a: .9, size: .06, life: 4, gravity: 0 });
          } else {
            G.particles.push({ x: rx, y: ry, z: rz, vx: 0, vy: -18, vz: 0, r: .35, g: .45, b: .85, a: .55, size: .045, life: .55, gravity: 0 });
          }
        }
      }
      // thunder (rare lightning strike, subtle sky illumination without blinding screen flash)
      if (G.thunder || (G.rain > .85 && chance(.0005))) {
        G.thunder = 1;
        if (chance(.0004)) {
          this.flash = 0.35;
          SFX.playExplosion();
          const lx = Math.floor(p.x + (rand() - .5) * 40), lz = Math.floor(p.z + (rand() - .5) * 40);
          for (let y = WORLD_H - 1; y > 0; y--) {
            if (G.world.getBlock(lx, y, lz) > 0) {
              if (chance(.5)) G.world.setBlock(lx, y + 1, lz, B.fire, 0);
              spawnParticles(lx + .5, y + 1, lz + .5, 20, [1, 1, 1], true);
              break;
            }
          }
        }
      }
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.05);
    const nv = $('night-vignette');
    if (nv) {
      const targetOp = G.rain > 0 ? (0.22 + G.rain * 0.18).toFixed(2) : '0';
      if (nv._lastOp !== targetOp) { nv._lastOp = targetOp; nv.style.opacity = targetOp; }
      const targetBg = this.flash > 0 ? 'rgba(220,230,255,' + (this.flash * 0.35).toFixed(2) + ')' : '';
      if (nv._lastBg !== targetBg) { nv._lastBg = targetBg; nv.style.background = targetBg; }
    }
  }
};

// ---------- HUD ----------
UI.updateBossBar = function (name, frac) {
  const el = $('boss-bar-container');
  if (!name || frac === null || frac === undefined) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  $('boss-name').textContent = name;
  $('boss-bar-fill').style.width = (clamp(frac, 0, 1) * 100) + '%';
};
UI.updateHotbarItemName = function () {
  const p = G.player;
  const el = $('hotbar-item-name');
  const s = p.getHeldItem();
  el.textContent = s ? ITEMS[s.id].name : '';
  el.style.opacity = '1';
  clearTimeout(this._hnT);
  this._hnT = setTimeout(() => el.style.opacity = '0', 1400);
};

function setImgSrcIfChanged(img, src) {
  if (!img) return;
  if (img._curSrc !== src) {
    img._curSrc = src;
    if (src) img.src = src;
    else img.removeAttribute('src');
  }
}

function updateHUD() {
  const p = G.player;
  if (!p) return;
  // hearts
  const hc = $('health-icons');
  if (hc.children.length !== 10) {
    hc.innerHTML = '';
    for (let i = 0; i < 10; i++) { const d = mkEl('div', 'stat-icon', hc); mkEl('img', '', d); }
  }
  const surv = p.gameMode === 'survival' || p.gameMode === 'hardcore';
  const hcDisp = surv ? 'flex' : 'none';
  if (hc.style.display !== hcDisp) hc.style.display = hcDisp;
  if (surv) {
    const lowHp = p.health <= 4 && !p.dead;
    hc.classList.toggle('low-health-shake', lowHp);
    for (let i = 0; i < 10; i++) {
      const img = hc.children[i].querySelector('img');
      const hp = p.health - i * 2;
      const src = hp >= 2 ? HUD_ICONS.heart_full : hp >= 1 ? HUD_ICONS.heart_half : HUD_ICONS.heart_empty;
      setImgSrcIfChanged(img, src);
    }
  }
  // food
  const fc = $('food-icons');
  if (fc.children.length !== 10) {
    fc.innerHTML = '';
    for (let i = 0; i < 10; i++) { const d = mkEl('div', 'stat-icon', fc); mkEl('img', '', d); }
    fc.style.flexDirection = 'row-reverse';
  }
  if (fc.style.display !== hcDisp) fc.style.display = hcDisp;
  if (surv) {
    for (let i = 0; i < 10; i++) {
      const img = fc.children[i].querySelector('img');
      const f = p.hunger - i * 2;
      const src = f >= 2 ? HUD_ICONS.food_full : f >= 1 ? HUD_ICONS.food_half : HUD_ICONS.food_empty;
      setImgSrcIfChanged(img, src);
    }
  }
  // armor
  const ac = $('armor-icons');
  const armor = p.computeArmor();
  if (ac.children.length !== 10) {
    ac.innerHTML = '';
    for (let i = 0; i < 10; i++) { const d = mkEl('div', 'stat-icon', ac); mkEl('img', '', d); }
  }
  const acDisp = armor > 0 ? 'flex' : 'none';
  if (ac.style.display !== acDisp) ac.style.display = acDisp;
  if (armor > 0) {
    for (let i = 0; i < 10; i++) {
      const img = ac.children[i].querySelector('img');
      const a = armor - i * 2;
      const src = a >= 2 ? HUD_ICONS.armor_full : a >= 1 ? HUD_ICONS.armor_half : HUD_ICONS.armor_empty;
      setImgSrcIfChanged(img, src);
    }
  }
  // air
  const aic = $('air-icons');
  if (aic.children.length !== 10) {
    aic.innerHTML = '';
    for (let i = 0; i < 10; i++) { const d = mkEl('div', 'stat-icon', aic); mkEl('img', '', d); }
    aic.style.flexDirection = 'row-reverse';
  }
  const showAir = p.air < 300 && surv;
  const aicDisp = showAir ? 'flex' : 'none';
  if (aic.style.display !== aicDisp) aic.style.display = aicDisp;
  if (showAir) {
    const bubbles = Math.ceil(p.air / 30);
    for (let i = 0; i < 10; i++) {
      const img = aic.children[i].querySelector('img');
      setImgSrcIfChanged(img, i < bubbles ? HUD_ICONS.bubble : '');
      const vis = i < bubbles ? 'visible' : 'hidden';
      if (img.style.visibility !== vis) img.style.visibility = vis;
    }
  }
  // xp (dirty-checked)
  const xpW = (p.xpProgress * 100).toFixed(1) + '%';
  const xpFill = $('xp-bar-fill');
  if (xpFill._lastW !== xpW) { xpFill._lastW = xpW; xpFill.style.width = xpW; }
  const xpLvlStr = p.xpLevel > 0 ? String(p.xpLevel) : '';
  const xpLvlEl = $('xp-level');
  if (xpLvlEl.textContent !== xpLvlStr) xpLvlEl.textContent = xpLvlStr;
  // overlays (dirty-checked)
  const uwOp = p.headInWater ? '0.55' : '0';
  const uwEl = $('underwater-overlay');
  if (uwEl.style.opacity !== uwOp) uwEl.style.opacity = uwOp;
  const foOp = p.onFire > 0 ? '0.85' : '0';
  const foEl = $('fire-overlay');
  if (foEl.style.opacity !== foOp) foEl.style.opacity = foOp;
  // attack indicator
  const ai = $('attack-indicator');
  if (p.attackCooldown > 0) {
    if (ai.style.display !== 'block') ai.style.display = 'block';
    $('attack-indicator-bar').style.width = (clamp(1 - p.attackCooldown / 0.62, 0, 1) * 100).toFixed(0) + '%';
  } else if (ai.style.display !== 'none') ai.style.display = 'none';
  // status effect badges (dirty-checked)
  const eh = $('active-effects-hud');
  const effKeys = Object.keys(p.effects || {});
  const effSig = effKeys.map(k => k + ':' + Math.ceil(p.effects[k].dur / 20)).join('|');
  if (eh._lastSig !== effSig) {
    eh._lastSig = effSig;
    if (effKeys.length) {
      eh.style.display = 'flex';
      eh.innerHTML = '';
      for (const name of effKeys) {
        const eff = p.effects[name];
        const b = mkEl('div', 'effect-badge', eh);
        b.textContent = `${name[0].toUpperCase()}${name.slice(1)} ${Math.ceil(eff.dur / 20)}s`;
      }
    } else {
      eh.innerHTML = '';
      eh.style.display = 'none';
    }
  }
}

function updateF3() {
  if (!G.f3 || G.state === 'title' || G.state === 'loading') return;
  const now = performance.now();
  if (updateF3._lastT && now - updateF3._lastT < 100) return;
  updateF3._lastT = now;
  const p = G.player, w = G.world;
  if (!p || !w) return;
  const left = $('f3-left'), right = $('f3-right');
  const fps = G.fps || 0;
  const biome = w.gen.biomeAt(Math.floor(p.x), Math.floor(p.z));
  // yaw=0 -> north (-Z), yaw=90° -> west (-X), yaw=180° -> south (+Z), yaw=270° -> east (+X)
  const dirs = ['north (-Z)', 'west (-X)', 'south (+Z)', 'east (+X)'];
  const facing = dirs[Math.round(((p.yaw * 180 / Math.PI) % 360 + 360) % 360 / 90) % 4];
  left.innerHTML = '';
  right.innerHTML = '';
  const L = (t) => mkEl('div', 'f3-line', left, t);
  const R = (t) => mkEl('div', 'f3-line', right, t);
  L(`Minecraft 26.2 WebGL2 (${fps} fps, ${G.tickTimes?.toFixed?.(1) || '-'} ms/tick)`);
  L(`XYZ: ${p.x.toFixed(3)} / ${p.y.toFixed(5)} / ${p.z.toFixed(3)}`);
  L(`Block: ${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)}`);
  L(`Chunk: ${Math.floor(p.x / 16)} ${Math.floor(p.z / 16)} (${Math.floor(p.x) & 15} ${Math.floor(p.z) & 15})`);
  L(`Facing: ${facing} (yaw ${(p.yaw * 180 / Math.PI % 360).toFixed(1)}° pitch ${(p.pitch * 180 / Math.PI).toFixed(1)}°)`);
  L(`Biome: ${BIOMES[biome]?.name || biome}`);
  L(`Dimension: ${['Overworld', 'Nether', 'The End'][G.dimension]}`);
  R(`REA Decompiled: 7055 Java classes (26.2.jar) + 1845 C funcs (lwjgl.dll)`);
  R(`Light: sky ${w.skyLight(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z))} block ${w.blockLight(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z))}`);
  R(`Chunks: ${w.chunks.size} loaded, ${G.renderer?.chunksGL?.size || 0} meshed`);
  R(`Entities: ${G.entities.length}, Particles: ${G.particles.length}`);
  R(`Time: ${Math.floor(w.time % DAY_TICKS)} (${w.time > 0 && w.time % DAY_TICKS < 12500 ? 'day' : 'night'}), Seed: ${G.seed}`);
  R(`Mode: ${p.gameMode}${p.flying ? ' (flying)' : ''}`);
  R(`Edits: ${w.edits.size}, TEs: ${G.tileEntities.size}`);
  if (G.net && G.net.mode) {
    const bps = (G.net.bytesOut || 0) / Math.max(0.001, (performance.now() - (G.net._bornT || (G.net._bornT = performance.now()))) / 1000);
    R(`Net: ${G.net.mode} peers:${G.net.peers.size} out:${(bps / 1024).toFixed(2)} KB/s`);
  }
  if (G.lastDeath) R(`Last death: ${G.lastDeath.cause} @ ${G.lastDeath.pos.join(' ')} (t=${G.lastDeath.tick})`);
}

// ---------- Save / Load ----------
const SaveSystem = {
  keyFor(name) { return 'webcraft_world_' + name; },
  list() {
    try { return JSON.parse(localStorage.getItem('webcraft_worlds') || '[]'); } catch (e) { return []; }
  },
  save() {
    if (!G.worldName || !G.player) return;
    const p = G.player;
    const dimEdits = { [G.dimension]: [...G.world.edits.entries()] };
    for (const [dim, w] of DIM_WORLDS) if (dim !== G.dimension) dimEdits[dim] = [...w.edits.entries()];
    const data = {
      v: 2, name: G.worldName, seed: G.seed, mode: G.gameMode, hardcore: G.hardcore, difficulty: G.difficulty || 'normal',
      time: G.world.time, dimension: G.dimension, rain: G.rain, thunder: G.thunder,
      dragonKilled: G._dragonDefeated || false, endInit: G._endInit || false,
      player: {
        x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, held: p.held,
        health: p.health, hunger: p.hunger, saturation: p.saturation,
        xp: p.xp, xpLevel: p.xpLevel, slots: p.slots, spawn: p.spawnPoint, gameMode: p.gameMode,
      },
      edits: dimEdits,
      tes: [...G.tileEntities.entries()],
      adv: [...G.advancements],
      stats: G.stats,
    };
    try {
      localStorage.setItem(this.keyFor(G.worldName), JSON.stringify(data));
      const names = this.list();
      if (!names.includes(G.worldName)) { names.push(G.worldName); localStorage.setItem('webcraft_worlds', JSON.stringify(names)); }
      // track the last played world — the multiplayer host re-opens it
      try { localStorage.setItem('wc_lastworld', G.worldName); } catch (e) { }
    } catch (e) {
      Chat.add('§cSave failed: ' + e.message);
    }
  },
  load(name) {
    const raw = localStorage.getItem(this.keyFor(name));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  },
  delete(name) {
    localStorage.removeItem(this.keyFor(name));
    localStorage.setItem('webcraft_worlds', JSON.stringify(this.list().filter(n => n !== name)));
  },
};

// ---------- Settings ----------
const Settings = {
  save() { try { localStorage.setItem('webcraft_settings', JSON.stringify(G.settings)); } catch (e) { } },
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('webcraft_settings') || '{}');
      Object.assign(G.settings, s);
      if (!G.settings.fpsCap) G.settings.fpsCap = '240';
    } catch (e) { }
  },
  buildUI() {
    const body = $('options-body');
    body.innerHTML = '';
    const slider = (label, min, max, step, get, set, fmt) => {
      const wrap = mkEl('div', 'mc-slider-wrap', body);
      mkEl('div', '', wrap, label + ': ' + (fmt ? fmt(get()) : get()));
      const inp = mkEl('input', '', wrap);
      inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = get();
      inp.oninput = () => { set(parseFloat(inp.value)); wrap.firstChild.textContent = label + ': ' + (fmt ? fmt(get()) : get()); Settings.save(); };
    };
    const toggle = (label, get, set) => {
      const btn = mkEl('button', 'mc-btn', body, label + ': ' + (get() ? 'ON' : 'OFF'));
      btn.onclick = () => { set(!get()); btn.textContent = label + ': ' + (get() ? 'ON' : 'OFF'); Settings.save(); SFX.playClick(); };
    };
    slider('FOV', 30, 110, 1, () => G.settings.fov, v => G.settings.fov = v);
    slider('Render Distance', 2, 16, 1, () => G.settings.renderDist, v => { G.settings.renderDist = v; }, v => v + ' chunks');
    slider('Master Volume', 0, 1, .05, () => G.settings.volume, v => { G.settings.volume = v; SFX.masterVol = v; }, v => Math.round(v * 100) + '%');
    slider('Music Volume', 0, 1, .05, () => G.settings.music, v => { G.settings.music = v; SFX.musicVol = v; }, v => Math.round(v * 100) + '%');
    slider('Mouse Sensitivity', .2, 3, .05, () => G.settings.sensitivity, v => G.settings.sensitivity = v);
    slider('GUI Scale', 1, 3, 1, () => G.settings.guiScale, v => { G.settings.guiScale = v; document.documentElement.style.setProperty('--gui-scale', v); });
    const fpsSel = mkEl('select', 'mc-input', body);
    fpsSel.style.width = '100%';
    for (const opt of ['vsync', 'unlimited', '240', '120', '60', '30']) {
      const o = mkEl('option', '', fpsSel, opt === 'vsync' ? 'VSync (display rate)' : opt === 'unlimited' ? 'Unlimited (max render rate)' : opt + ' fps');
      o.value = opt;
      if (G.settings.fpsCap === opt) o.selected = true;
    }
    fpsSel.onchange = () => { G.settings.fpsCap = fpsSel.value; Settings.save(); };
    toggle('Clouds', () => G.settings.clouds, v => G.settings.clouds = v);
    toggle('Particles', () => G.settings.particles, v => G.settings.particles = v);
    toggle('View Bobbing', () => G.settings.bobbing, v => G.settings.bobbing = v);
    // texture pack loader (user-provided 16×16 PNGs override the procedural atlas)
    const packRow = mkEl('div', 'menu-row', body);
    const packBtn = mkEl('button', 'mc-btn', packRow, 'Load Texture Pack...');
    const resetBtn = mkEl('button', 'mc-btn', packRow, 'Reset Textures');
    const fileInp = mkEl('input', '', body);
    fileInp.type = 'file';
    fileInp.accept = 'image/png';
    fileInp.multiple = true;
    fileInp.style.display = 'none';
    packBtn.onclick = () => fileInp.click();
    resetBtn.onclick = () => {
      SFX.playClick();
      localStorage.removeItem('webcraft_texpack');
      TEX.resetPack();
      Chat.add('§aTextures reset to procedural defaults.');
    };
    fileInp.onchange = async () => {
      const pack = {};
      for (const f of fileInp.files) {
        const name = f.name.replace(/\.png$/i, '');
        if (!TILE.has(name)) continue;
        pack[name] = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
      }
      if (!Object.keys(pack).length) { Chat.add('§cNo matching PNGs found (names must match block keys like stone.png).'); return; }
      try { localStorage.setItem('webcraft_texpack', JSON.stringify(pack)); } catch (e) { }
      const n = await TEX.applyPack(new Map(Object.entries(pack)));
      Chat.add(`§aTexture pack applied: ${n} tiles.`);
      SFX.playClick();
    };
  },
};

async function loadPersistedTexturePack() {
  try {
    const raw = localStorage.getItem('webcraft_texpack');
    if (!raw) return;
    const pack = JSON.parse(raw);
    await TEX.applyPack(new Map(Object.entries(pack)));
    console.log('[tex] persisted pack applied:', Object.keys(pack).length);
  } catch (e) { }
}

// ---------- Screens & flow ----------
function showScreen(id) {
  for (const s of document.querySelectorAll('.screen-overlay')) s.classList.remove('active');
  if (id) $(id).classList.add('active');
  const isMenuScreen = id === 'title-screen' || id === 'world-select-screen' || id === 'multiplayer-screen' || id === 'loading-screen' || (id === 'options-screen' && G.state === 'title');
  document.body.classList.toggle('in-menu', isMenuScreen || G.state === 'title' || G.state === 'loading');
  // MP-Code badge ONLY inside menu overlays (ESC menu / options / death) —
  // never floating over normal gameplay
  const badge = document.getElementById('mp-code-badge');
  if (badge) {
    const inMenuOverlay = G.net && G.net.roomCode && G.net.mode !== null &&
      (id === 'pause-screen' || id === 'options-screen' || id === 'death-screen');
    badge.style.display = inMenuOverlay ? 'block' : 'none';
  }
}
function pauseGame() {
  if (G.state !== 'playing') return;
  G.state = 'paused';
  // no ghost movement while the menu is open (a held key never sees its keyup)
  for (const k in KEYS) KEYS[k] = false;
  if (G.player) G.player.sprintToggled = false;
  SaveSystem.save();
  document.exitPointerLock && document.exitPointerLock();
  showScreen('pause-screen');
  // MC-authentic wording: singleplayer PAUSES the world, the multiplayer
  // menu does not (the server keeps running)
  const mp = G.net && G.net.mode !== null;
  const titleEl = document.getElementById('pause-title');
  if (titleEl) titleEl.textContent = mp ? 'Spielmenü' : 'Spiel pausiert';
  $('game-over-info').innerHTML = `Seed: ${G.seed}<br>Mode: ${G.gameMode}<br>Playtime: ${Math.floor(G.stats.playedTicks / 20 / 60)} min` + (mp ? '<br><span style="color:#8f8">Die Welt läuft im Multiplayer weiter</span>' : '');
}
function resumeGame() {
  showScreen(null);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  G.state = 'playing';
  requestPointerLock();
  // Chrome enforces a ~1.25 s pointer-lock cooldown after ESC-exits — the old
  // single 400 ms retry landed INSIDE the cooldown, so the cursor kept
  // floating over the screen until the player clicked. Retry until the lock
  // is REALLY held (max ~4 s) — the mouse grabs focus on its own.
  let tries = 0;
  const relock = () => {
    if (G.state !== 'playing') return; // user opened chat/menu again
    if (document.pointerLockElement === $('game-canvas')) return; // locked — done
    if (++tries > 16) return;
    requestPointerLock();
    setTimeout(relock, 250);
  };
  setTimeout(relock, 250);
}
// LocatorBar (1:1 aus LocatorBar.java): 182×5-Hintergrund über der XP-Bar
// (in unserer HUD-Skalierung 364×10), ein FARBIGER Dot (9×9 → 18×18) pro
// Spieler, dessen Farbe stabil aus der Spieler-ID gehasht wird
// (ARGB.color(255, uuid.hashCode()) mit Brightness 0.9), ±60°-Sichtbereich
// (dots außerhalb werden NICHT gezeichnet, kein Clamping), ↑/↓-Pfeile (7×5)
// wenn der Spieler deutlich über/unter dir ist, keine Kardinal-Buchstaben.
function updatePlayerCompass() {
  const cv = document.getElementById('player-compass');
  if (!cv) return;
  const active = G.state === 'playing' && G.net && G.net.mode !== null && G.net.remotePlayers && G.net.remotePlayers.size > 0;
  if (!active) { if (cv.style.display !== 'none') cv.style.display = 'none'; return; }
  if (cv.style.display !== 'block') cv.style.display = 'block';
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  // LocatorBar.extractBackground: 182×5-Sprite (2× HUD-Skala → 364×10), zentriert
  const barY = 14;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, barY, W, 10);
  const DOT = 18;                         // DOT_SIZE 9 in 2× HUD-Skalierung
  const dotTop = 10;                      // ragt 4px über/unter den schmalen Balken (MC-Look)
  const screenMiddle = Math.ceil((W - DOT) / 2);
  const VISIBLE_DEGREE_RANGE = 60;
  const dotLeftFor = (angleDeg) => screenMiddle + Math.floor(angleDeg * (W - DOT) / 2 / VISIBLE_DEGREE_RANGE);
  const norm = (a) => { let d = a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const hashHue = (str) => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h) % 360; };
  for (const e of G.net.remotePlayers.values()) {
    if (e.dead) continue;
    const dx = e.x - G.player.x, dz = e.z - G.player.z;
    if (Math.hypot(dx, dz) < 0.01) continue;
    const angleDeg = norm(Math.atan2(-dx, -dz) - G.player.yaw) * 180 / Math.PI;
    if (angleDeg <= -VISIBLE_DEGREE_RANGE || angleDeg > VISIBLE_DEGREE_RANGE) continue; // LocatorBar: außerhalb → kein Dot
    const dotLeft = dotLeftFor(angleDeg);
    // stable per-player color: ARGB.color(255, id-hash) at brightness 0.9
    const hue = hashHue(e.remoteId || e.nameTag || 'p');
    ctx.fillStyle = 'hsl(' + hue + ', 85%, 40%)';
    ctx.fillRect(dotLeft, dotTop, DOT, DOT);
    ctx.fillStyle = 'hsl(' + hue + ', 95%, 58%)';
    ctx.fillRect(dotLeft + 2, dotTop + 2, DOT - 4, DOT - 4);
    // pitch direction arrow (7×5 → 14×10): target clearly above/below the horizon
    const dy = (e.y + 0.9) - (G.player.y + G.player.eye);
    const pitchAngle = Math.atan2(Math.abs(dy), Math.max(0.01, Math.hypot(dx, dz)));
    if (pitchAngle > 0.52) { // ≈ ±30° — deutlich über/unter dem Horizont
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const ax = dotLeft + DOT / 2, up = dy > 0; // PitchDirection.UP = target above the camera horizon
      if (up) { ctx.moveTo(ax, 2); ctx.lineTo(ax - 7, 10); ctx.lineTo(ax + 7, 10); }
      else { ctx.moveTo(ax, 34); ctx.lineTo(ax - 7, 26); ctx.lineTo(ax + 7, 26); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
}

function respawnPlayer() {
  // only the dead may respawn — nothing may yank a living player back to spawn
  if (!G.player || (!G.player.dead && G.state !== 'dead')) return;
  showScreen(null);
  G.state = 'playing';
  if (G.hardcore) { quitToTitle(); return; }
  G.player.respawn();
  UI.refreshHotbar();
  requestPointerLock();
}
function quitToTitle() {
  SaveSystem.save();
  if (G.net) G.net.shutdown();
  G.net = null;
  G.state = 'title';
  // drop the loaded world so the title screen renders the MENU PANORAMA
  // again — otherwise the last in-game frame stayed frozen behind the menu
  G.world = null; G.player = null;
  G.entities = []; G.particles = [];
  DIM_WORLDS.clear();
  showScreen('title-screen');
  document.exitPointerLock && document.exitPointerLock();
}

function newWorld(name, seedStr, mode, difficulty) {
  let seed;
  if (seedStr && seedStr.trim()) {
    seed = /^[+-]?\d+$/.test(seedStr.trim()) ? parseInt(seedStr.trim()) : hashStr(seedStr.trim());
  } else seed = (Math.random() * 2 ** 31) | 0;
  G.worldName = name || 'New World';
  G.seed = seed >>> 0;
  G.gameMode = mode || 'survival';
  G.hardcore = mode === 'hardcore';
  G.difficulty = ['peaceful', 'easy', 'normal', 'hard'].includes(difficulty) ? difficulty : 'normal';
  G.dimension = 0;
  G.rng = mulberry32(G.seed);
  G.time = 6000;
  G.rain = 0; G.thunder = 0;
  G.entities = []; G.particles = [];
  G.tileEntities = new Map();
  G.advancements = new Set();
  G.stats = { mined: 0, placed: 0, crafted: 0, kills: 0, deaths: 0, walked: 0, playedTicks: 0 };
  G._endInit = false; G._dragonDefeated = false;
  DIM_WORLDS.clear();
  G.dimEdits = {};
  startGame(null);
}

function loadWorld(name) {
  const data = SaveSystem.load(name);
  if (!data) return;
  G.worldName = name;
  G.seed = data.seed;
  G.gameMode = data.mode;
  G.hardcore = data.mode === 'hardcore';
  G.difficulty = ['peaceful', 'easy', 'normal', 'hard'].includes(data.difficulty) ? data.difficulty : 'normal';
  G.dimension = data.dimension || 0;
  G.time = data.time;
  G.rain = data.rain || 0; G.thunder = data.thunder || 0;
  G._endInit = data.endInit || false;
  G._dragonDefeated = data.dragonKilled || false;
  G.advancements = new Set(data.adv || []);
  G.stats = data.stats || { mined: 0, placed: 0, crafted: 0, kills: 0, deaths: 0, walked: 0, playedTicks: 0 };
  G.tileEntities = new Map(data.tes || []);
  G.rng = mulberry32(G.seed);
  G.entities = []; G.particles = [];
  DIM_WORLDS.clear();
  G.dimEdits = data.edits || {};
  startGame(data.player);
}

// Gast: baut die Host-Welt lokal aus dem Willkommens-Paket auf. Der Seed ist
// deterministisch → identisches Terrain; Edits, Zeit, Wetter und Modus kommen
// vom Host. Ermöglicht Join direkt vom Titelbildschirm mit nur einem Klick.
function joinWorldFromHost(obj) {
  G.worldName = 'LAN Welt';
  G.seed = obj.seed >>> 0;
  G.gameMode = obj.mode || 'survival';
  G.difficulty = obj.difficulty || 'normal';
  G.hardcore = false;
  G.dimension = 0;
  G.rng = mulberry32(G.seed);
  G.time = obj.time || 6000;
  G.rain = obj.rain || 0; G.thunder = obj.thunder || 0;
  G.entities = []; G.particles = [];
  G.tileEntities = new Map();
  G.advancements = new Set();
  G.stats = { mined: 0, placed: 0, crafted: 0, kills: 0, deaths: 0, walked: 0, playedTicks: 0 };
  G._endInit = false; G._dragonDefeated = false;
  DIM_WORLDS.clear();
  G.dimEdits = {};
  startGame(null, { edits: obj.edits || [] });
  // startGame's sync part has created the world — World's constructor
  // hardcodes time=6000, so the host's clock is adopted here
  if (G.world) G.world.time = obj.time || 6000;
}

function startGame(savedPlayer, hostPayload) {
  showScreen('loading-screen');
  G.state = 'loading';
  const tips = ['Punch a tree to get wood!', 'Press E for inventory, T for chat.', 'Creepers explode — keep your distance!', 'Diamonds spawn below y=16.', 'Redstone dust needs a source like a lever.', 'Build a bed to set your respawn point.', 'Water buckets are great for lava.', 'Bone meal grows crops instantly.'];
  $('loading-tip').textContent = tips[randInt(0, tips.length - 1)];
  $('loading-status').textContent = 'Generating world...';
  $('loading-bar-fill').style.width = '0%';

  G.world = new World(G.seed, G.dimension);
  if (G.dimEdits && G.dimEdits[G.dimension]) G.world.edits = new Map(G.dimEdits[G.dimension]);
  // guest join: the HOST's edits must be in the map BEFORE chunks generate
  // (ensureChunk applies edits + updates the heightmap while building)
  if (hostPayload && hostPayload.edits) G.world.edits = new Map(hostPayload.edits);

  // spawn point
  let spawn;
  if (savedPlayer) spawn = [savedPlayer.x, savedPlayer.y, savedPlayer.z];
  else spawn = findSpawn(G.world.gen);

  G.player = new Player(G.world, spawn);
  if (savedPlayer) {
    const p = G.player;
    p.x = savedPlayer.x; p.y = savedPlayer.y; p.z = savedPlayer.z;
    p.yaw = savedPlayer.yaw || 0; p.pitch = savedPlayer.pitch || 0;
    p.held = savedPlayer.held || 0;
    p.health = savedPlayer.health ?? 20;
    p.hunger = savedPlayer.hunger ?? 20;
    p.saturation = savedPlayer.saturation ?? 5;
    p.xp = savedPlayer.xp || 0; p.xpLevel = savedPlayer.xpLevel || 0;
    p.slots = savedPlayer.slots || new Array(41).fill(null);
    p.spawnPoint = savedPlayer.spawn || spawn;
    p.gameMode = savedPlayer.gameMode || G.gameMode;
    // flying must never survive into survival mode from a save
    p.flying = p.gameMode === 'creative' || p.gameMode === 'spectator';
  }
  G.rng = mulberry32(G.seed ^ 0x51CE);

  // pregen spawn chunks with progress
  const pcx = Math.floor(G.player.x / CH), pcz = Math.floor(G.player.z / CH);
  const R = Math.min(4, G.settings.renderDist);
  const tasks = [];
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) tasks.push([pcx + dx, pcz + dz]);
  tasks.sort((a, b) => (Math.abs(a[0] - pcx) + Math.abs(a[1] - pcz)) - (Math.abs(b[0] - pcx) + Math.abs(b[1] - pcz)));
  let i = 0;
  const step = () => {
    const t0 = performance.now();
    while (i < tasks.length && performance.now() - t0 < 30) {
      G.world.ensureChunk(tasks[i][0], tasks[i][1]);
      i++;
    }
    $('loading-bar-fill').style.width = Math.round(i / tasks.length * 70) + '%';
    $('loading-status').textContent = `Generating terrain ${i}/${tasks.length}`;
    if (i < tasks.length) return true;
    // settle player safely on real ground (treat ungenerated/-1 as air, skip foliage)
    if (!savedPlayer) {
      const p = G.player;
      const bx = Math.floor(p.x), bz = Math.floor(p.z);
      let sy = WORLD_H - 2;
      while (sy > 1) {
        const id = G.world.getBlock(bx, sy, bz);
        if (id > 0 && BLOCKS[id].solid) break;
        sy--;
      }
      p.y = sy + 1.01;
      p.spawnPoint = [p.x, p.y, p.z];
      // MC spawn spread — runs HERE (after chunk generation; earlier attempts
      // in startGame saw ungenerated chunks where getBlock returns -1 and
      // never found a spot): multiplayer players scatter around world spawn
      // (solid ground + 2 free blocks) so two players never spawn overlapping
      if (G.net && G.net.mode !== null) {
        outer: for (let r = 2; r <= 12; r += 2) {
          for (let tries = 0; tries < 10; tries++) {
            const a = Math.random() * Math.PI * 2;
            const sx = Math.floor(bx + Math.cos(a) * r), sz = Math.floor(bz + Math.sin(a) * r);
            let sy2 = WORLD_H - 2;
            while (sy2 > 1 && G.world.getBlock(sx, sy2, sz) === 0) sy2--;
            const gnd = G.world.getBlock(sx, sy2, sz);
            const a1 = G.world.getBlock(sx, sy2 + 1, sz), a2 = G.world.getBlock(sx, sy2 + 2, sz);
            if (sy2 > 1 && gnd > 0 && BLOCKS[gnd].solid && a1 === 0 && a2 === 0) {
              p.x = sx + 0.5; p.z = sz + 0.5; p.y = sy2 + 1.02;
              p.spawnPoint = [p.x, p.y, p.z];
              break outer;
            }
          }
        }
      }
    }
    // validate saved player: corrupted saves (mid-air / dead / buried inside blocks) get resettled
    {
      const p = G.player;
      const bx = Math.floor(p.x), bz = Math.floor(p.z);
      const solidAt = (y) => { const id = G.world.getBlock(bx, y, bz); return id > 0 && BLOCKS[id].solid; };
      const feetBlocked = solidAt(Math.floor(p.y)) || solidAt(Math.floor(p.y) + 1);
      let supported = false;
      for (let dy = 0; dy <= 4; dy++) {
        if (solidAt(Math.floor(p.y) - dy)) { supported = true; break; }
      }
      if (!supported || feetBlocked || p.dead || p.health <= 0) {
        let sy = WORLD_H - 2;
        while (sy > 1) {
          const id = G.world.getBlock(bx, sy, bz);
          if (id > 0 && BLOCKS[id].solid) break;
          sy--;
        }
        p.y = sy + 1.01;
        p.dead = false;
        p.health = p.maxHealth;
        p.hunger = Math.max(p.hunger, 6);
        p.air = 300;
      }
      p.fallDistance = 0;
      p.vx = p.vy = p.vz = 0;
      p.spawnGrace = 100; // ~5s of fall-damage immunity after world entry
    }
    // initial meshes
    $('loading-status').textContent = 'Building meshes...';
    let j = 0;
    const meshStep = () => {
      const t1 = performance.now();
      while (j < tasks.length && performance.now() - t1 < 30) {
        const c = G.world.getChunk(tasks[j][0], tasks[j][1]);
        if (c && c.generated) {
          const m = Mesher.build(G.world, c);
          G.renderer.uploadChunkMesh(tasks[j][0] + ',' + tasks[j][1] + ':' + G.dimension, m.opaque, 'opaque');
          G.renderer.uploadChunkMesh(tasks[j][0] + ',' + tasks[j][1] + ':' + G.dimension, m.trans, 'trans');
          c.dirty = false;
        }
        j++;
      }
      $('loading-bar-fill').style.width = (70 + Math.round(j / tasks.length * 30)) + '%';
      if (j < tasks.length) return true;
      // drain remote edits that arrived while the guest world was building
      if (G.pendingRemoteEdits && G.pendingRemoteEdits.length) {
        for (const o of G.pendingRemoteEdits) applyRemoteBlock(o);
        G.pendingRemoteEdits = [];
      }
      G.state = 'playing';
      showScreen(null);
      UI.refreshHotbar();
      UI.updateHotbarItemName();
      Chat.add('§aWelcome to ' + (G.worldName || 'the world') + '!');
      Chat.add('§7Seed: ' + G.seed + ' — press T to chat, /help for commands.');
      requestPointerLock();
    };
    pumpTask(meshStep);
    return false;
  };
  pumpTask(step);
}

function refreshWorldList() {
  const list = $('world-list');
  list.innerHTML = '';
  const names = SaveSystem.list();
  if (!names.length) mkEl('div', '', list, 'No saved worlds yet — create one below!').style.cssText = 'color:#999;font-size:13px;padding:8px;';
  for (const n of names) {
    const d = SaveSystem.load(n);
    const entry = mkEl('div', 'world-entry', list);
    mkEl('div', 'we-name', entry, n);
    mkEl('div', 'we-meta', entry, d ? `${d.mode || 'survival'} · seed ${d.seed}` : '');
    const play = mkEl('button', 'mc-btn', entry, 'Play');
    play.style.padding = '4px 12px';
    play.onclick = () => { SFX.playClick(); loadWorld(n); };
    entry.onclick = (e) => { if (e.target === entry) entry.style.outline = '2px solid #fff'; };
    list.appendChild(entry);
  }
}

// ---------- Main loop (100% Flicker-Free Compositor-Synchronized rAF + Background MessageChannel Pump) ----------
const Game = {
  last: 0, acc: 0, fps: 0, frames: 0, fpsT: 0, lastRender: 0,
  tickTimes: 0,
  start() {
    this.last = performance.now();
    this.fpsT = performance.now();
    this._stop = false;
    // Primary render & tick loop synchronized with display compositor via requestAnimationFrame
    // (Eliminates all mid-frame gl.clear tearing / flashing!)
    const rafLoop = (now) => {
      if (this._stop) return;
      try {
        this.frame(now || performance.now());
      } catch (e) {
        console.error('raf frame:', e.message);
      }
      requestAnimationFrame(rafLoop);
    };
    requestAnimationFrame(rafLoop);

    // Simulation watchdog: Chrome throttles rAF (sometimes to ~0.2 Hz even
    // WITHOUT document.hidden) and timers in background/occluded tabs, so the
    // simulation would crawl at <1 TPS. This watchdog fires whenever NO loop
    // has ticked for >900 ms — regardless of WHY — and catches up the full
    // 20 TPS budget. In an active tab lastTickAt is always fresh → zero cost.
    // It must respect the SAME sim-gate as frameInner (a paused singleplayer
    // world stays paused even when rAF is dead).
    this.lastTickAt = performance.now();
    setInterval(() => {
      if (this._stop) return;
      const now = performance.now();
      if (now - (this.lastTickAt || 0) < 900) return; // a loop is ticking fine
      if (!this.simShouldRun()) return;               // world is (legit) paused
      try {
        this.last = now; this.acc = 0;
        for (let i = 0; i < 20; i++) this.tick();
        this.lastTickAt = now;
        this.render(1, 0.016);
        updatePlayerCompass(); // hidden tabs render via watchdog — HUD must update too
      } catch (e) {
        console.error('watchdog frame:', e.message);
      }
    }, 50);
  },
  // single source of truth for "does the 20 TPS simulation run right now?"
  simShouldRun() {
    if (G.state === 'playing' || G.state === 'container' || G.state === 'dead') return true;
    // MC-authentic: in multiplayer the menu NEVER pauses the world (a server
    // keeps running) — only singleplayer freezes on ESC
    return G.state === 'paused' && !!G.net && G.net.mode !== null;
  },
  frame(now) {
    try {
      this.frameInner(now);
    } catch (e) {
      // enterprise resilience: a single frame exception must NEVER kill the loop
      this._frameErrors = (this._frameErrors || 0) + 1;
      console.error('frame error #' + this._frameErrors + ':', e.message);
      if (this._frameErrors % 60 === 1) Chat.add('§c[engine] frame error: ' + e.message);
    }
  },
  frameInner(now) {
    // fps cap: vsync = rAF-paced with an ~90fps ceiling against uncapped rAF loops
    const cap = G.settings.fpsCap;
    if (cap !== 'unlimited') {
      const minFrame = cap === 'vsync' ? 11 : 1000 / parseFloat(cap);
      if (now - this.lastRender < minFrame * 0.98) return;
    }
    this.lastRender = now;
    // fps counter
    this.frames++;
    if (now - this.fpsT > 500) {
      G.fps = Math.round(this.frames * 1000 / (now - this.fpsT));
      this.frames = 0; this.fpsT = now;
    }
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = Math.min(dt, 0.25);

    // MC-authentic: in multiplayer the menu NEVER pauses the world (a server
    // keeps running) — only singleplayer freezes on ESC
    if (this.simShouldRun()) {
      this.acc += dt;
      let steps = 0;
      const t0 = performance.now();
      while (this.acc >= DT && steps < 4) {
        this.tick();
        this.acc -= DT;
        steps++;
      }
      if (steps === 4) this.acc = 0;
      this.lastTickAt = now; // heartbeat for the hidden-tab watchdog
      G.tickTimes = (performance.now() - t0) / Math.max(1, steps);
      this.render(clamp(this.acc / DT, 0, 1), dt);
      updatePlayerCompass();
    } else if (G.state === 'paused' || G.state === 'title' || G.state === 'loading') {
      if (G.world && G.player) {
        if (G.state === 'title') G.player.yaw += dt * 0.12; // gentle panorama rotation on title screen
        this.render(1, dt);
      } else if (G.renderer) {
        // Render animated sky & clouds panorama on title screen before any world is loaded
        const gl = G.renderer.gl;
        G.renderer.resize();
        gl.clearColor(0.36, 0.58, 0.92, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(G.renderer.progSky);
        gl.bindVertexArray(G.renderer.skyVAO);
        const t = now / 1000;
        M4.perspective(G.renderer.proj, rad(70), G.renderer.aspect, 0.06, 500);
        M4.view(G.renderer.view, 0, 72, 0, t * 0.12, -0.08, 0);
        M4.mul(G.renderer._tmp, G.renderer.proj, G.renderer.view);
        invertM4(G.renderer.invVP, G.renderer._tmp);
        gl.uniformMatrix4fv(G.renderer.U(G.renderer.progSky, 'uInvVP'), false, G.renderer.invVP);
        gl.uniform3fv(G.renderer.U(G.renderer.progSky, 'uSunDir'), [0.35, 0.82, 0.45]);
        gl.uniform3fv(G.renderer.U(G.renderer.progSky, 'uSkyTop'), [0.32, 0.54, 0.92]);
        gl.uniform3fv(G.renderer.U(G.renderer.progSky, 'uSkyHorizon'), [0.68, 0.78, 0.95]);
        gl.uniform1f(G.renderer.U(G.renderer.progSky, 'uStarVis'), 0);
        gl.uniform1f(G.renderer.U(G.renderer.progSky, 'uRain'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
      }
    }
  },

  tick() {
    G.stats.playedTicks++;
    G.world.time = (G.world.time + 1) % (DAY_TICKS * 100);
    // player physics: normal play AND the multiplayer menu (a server keeps
    // simulating you — gravity must never stop just because ESC is open)
    const mpMenu = G.state === 'paused' && G.net && G.net.mode !== null;
    if (G.state === 'playing' || mpMenu) {
      const p = G.player;
      p.px = p.x; p.py = p.y; p.pz = p.z; // previous tick position for render interpolation
      p.tick();
      // rubber-band watchdog: legit speeds can never exceed these per tick.
      // If this fires, something corrupted the position — log everything.
      if (!p.isTeleporting) {
        const dx = Math.abs(p.x - p.px), dy = Math.abs(p.y - p.py), dz = Math.abs(p.z - p.pz);
        if (dx > 3 || dz > 3 || dy > 6) {
          const msg = `[watchdog] position jump (${dx.toFixed(1)},${dy.toFixed(1)},${dz.toFixed(1)}) at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`;
          console.warn(msg, new Error().stack);
          if (!G._wdT || performance.now() - G._wdT > 10000) {
            G._wdT = performance.now();
            Chat.add('§c' + msg);
          }
          // snap the interpolation references so the camera doesn't glide across the world
          p.px = p.x; p.py = p.y; p.pz = p.z;
        }
      }
    }
    else if (G.state === 'container') { G.player.hurtTime > 0 && G.player.hurtTime--; }
    // MC death animation: state 'dead' → the world keeps ticking, the camera
    // tilts sideways (render), and the death screen appears only AFTER ~1 s —
    // reflex/focus clicks during it can never hit a respawn button
    if (G.state === 'dead' && G.player && G.player.dead) {
      G.player.deathTime = (G.player.deathTime || 0) + 1;
      if (G.player.deathTime === 20) UI.showDeathScreen(G.lastDeath ? G.lastDeath.cause : null);
      // MC: the dead body keeps falling with NORMAL-speed physics — the old
      // gated version froze the body, which read as slow-motion lag
      const dp = G.player;
      dp.px = dp.x; dp.py = dp.y; dp.pz = dp.z;
      dp.onGround = false; // the stale standing-flag zeroed vy every tick (slow motion)
      dp.vy -= 0.08; dp.vy *= 0.98;
      dp.move(dp.vx, dp.vy, dp.vz);
      if (dp.onGround) dp.vy = 0;
    }
    // entities
    for (const e of G.entities) {
      e.px = e.x; e.py = e.y; e.pz = e.z;
      e.tick();
    }
    for (let i = G.entities.length - 1; i >= 0; i--) {
      const e = G.entities[i];
      if (e.dead && (e.deathTime > 20 || e.type === 'item' || e.type === 'xp' || e.type === 'arrow' || e.type === 'snowball' || e.type === 'egg' || e.type === 'pearl' || e.type === 'fireball' || e.type === 'tnt' || e.type === 'falling' || e.type === 'crystal')) G.entities.splice(i, 1);
    }
    // systems
    ChunkManager.update(1, 4, 6);
    G.world.tickFluids(40);
    RandomTicks.run();
    tickFurnaces();
    Redstone.tickButtons();
    Redstone.tickRepeaters();
    if (G.stats.playedTicks % 4 === 0) Redstone.tickPlates();
    SpawnSystem.tick();
    Weather.tick();
    Advancements.tick();
    if (G.net) G.net.tick();
    // ambient torch flame particles near player
    if (G.settings.particles && G.stats.playedTicks % 8 === 0) this.ambientFX();
    // autosave
    if (G.stats.playedTicks % 1200 === 0) SaveSystem.save();
  },

  ambientFX() {
    const p = G.player;
    const cx = Math.floor(p.x), cy = Math.floor(p.y), cz = Math.floor(p.z);
    for (let i = 0; i < 6; i++) {
      const x = cx + randInt(-7, 7), y = cy + randInt(-4, 5), z = cz + randInt(-7, 7);
      const id = G.world.getBlock(x, y, z);
      if (id === B.torch) spawnFlame(x + .5, y + .6, z + .5);
      else if (id === B.nether_portal) spawnParticles(x + rand(), y + rand(), z + rand(), 1, [.6, .2, .9], true);
      else if (id === B.lava && G.world.getBlock(x, y + 1, z) === 0) spawnParticles(x + rand(), y + 1.05, z + rand(), 1, [1, .5, .1], true);
      else if (id === B.water && G.world.getBlock(x, y + 1, z) === 0 && G.rain > 0) {
        spawnParticles(x + rand(), y + 0.95, z + rand(), 1, [0.45, 0.65, 0.95], true);
      }
    }
  },

  render(alpha, dt) {
    const p = G.player;
    if (!p) return;
    // Kamera-Ruhe hinter Overlays (MC: mit offenem Menü/Tod steht die EIGENE
    // Sicht still — die Welt läuft im Multiplayer dahinter weiter). Läuft die
    // Player-Sim nicht (paused/dead/container), friert hurtTime > 0 ein und
    // das variierende Frame-Alpha würde bob/hurt-Roll DAUERHAFT schütteln.
    const camLive = G.state === 'playing' || (G.state === 'paused' && G.net && G.net.mode !== null);
    // 'dead' interpolates too — the death fall must be as smooth as the live
    // game (the old cAlpha=1 rendered the death fall in visible 20 Hz steps)
    const cAlpha = (camLive || G.state === 'dead') ? alpha : 1;
    // smooth sneak-eye and sprint-FOV transitions (frame-rate independent)
    if (camLive) {
      p.sneakSmooth = (p.sneakSmooth ?? 0) + ((p.sneaking ? 1 : 0) - (p.sneakSmooth ?? 0)) * Math.min(1, dt * 10);
      p.fovSmooth = (p.fovSmooth ?? 0) + ((p.sprinting ? 10 : 0) - (p.fovSmooth ?? 0)) * Math.min(1, dt * 8);
    }

    // 1:1 GameRenderer.bobView & bobHurt interpolation (GameRenderer.java lines 318-338)
    const walkDist = lerp(p.walkDistO ?? p.walkDist, p.walkDist ?? 0, cAlpha);
    const bob = G.settings.bobbing ? lerp(p.bobO ?? p.bob, p.bob ?? 0, cAlpha) : 0;
    const wPhase = walkDist * Math.PI;
    const bobX = Math.sin(wPhase) * bob * 0.5;
    const bobY = -Math.abs(Math.cos(wPhase) * bob);
    let camRoll = Math.sin(wPhase) * bob * rad(3.0);
    let camPitchAdd = Math.abs(Math.cos(wPhase - 0.2) * bob) * rad(5.0);
    if (p.hurtTime > 0 && camLive) {
      const hurtFrac = (p.hurtTime - cAlpha) / 10.0;
      if (hurtFrac > 0) {
        camRoll -= Math.sin(hurtFrac * hurtFrac * hurtFrac * hurtFrac * Math.PI) * rad(14.0);
      }
    }
    // MC death tilt (1:1): during the ~1 s death animation the camera tips
    // over sideways and sinks slightly — THEN the death screen appears.
    // The progress is FRAME-TIME based (not 20 Hz deathTime) so the animation
    // runs butter-smooth at full frame rate — no slow-motion look.
    let deathDrop = 0;
    if (p.dead) {
      p._deathMs = Math.min(1200, (p._deathMs || 0) + dt * 1000);
      const dp = Math.min(1, p._deathMs / 1000);
      camRoll += dp * dp * rad(90);
      deathDrop = dp * 0.35;
    } else p._deathMs = 0;

    const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const interpSwingT = p.isSwinging ? clamp(lerp(p.prevSwingT ?? p.swingT, p.swingT, cAlpha), 0, 1) : 0;

    // interpolate camera
    const cam = {
      x: lerp(p.px ?? p.x, p.x, cAlpha) + rx * bobX,
      y: lerp(p.py ?? p.y, p.y, cAlpha) + p.eye - 0.35 * (p.sneakSmooth ?? 0) + bobY - deathDrop,
      z: lerp(p.pz ?? p.z, p.z, cAlpha) + rz * bobX,
      yaw: p.yaw,
      pitch: clamp(p.pitch + camPitchAdd, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01),
      roll: camRoll,
      sprintBoost: p.fovSmooth ?? 0,
      targetBlock: G.state === 'playing' ? p.targetBlock : null,
      targetEntity: G.state === 'playing' ? p.targetEntity : null,
      breakProgress: G.state === 'playing' ? p.breakProgress : 0,
      bobPhase: G.settings.bobbing ? wPhase : 0,
      bobAmp: G.settings.bobbing ? p.bobAmp : 0,
      swingT: interpSwingT,
      equipT: p.equipT,
    };
    // interpolate entities render positions
    for (const e of G.entities) {
      e.rx = lerp(e.px ?? e.x, e.x, alpha);
      e.ry = lerp(e.py ?? e.y, e.y, alpha);
      e.rz = lerp(e.pz ?? e.z, e.z, alpha);
    }
    // particles
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const pt = G.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { G.particles.splice(i, 1); continue; }
      pt.vy -= (pt.gravity || 0) * dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt;
      // ground collide (cheap)
      if (pt.gravity > 0) {
        const id = G.world.getBlock(Math.floor(pt.x), Math.floor(pt.y), Math.floor(pt.z));
        if (id > 0 && BLOCKS[id].solid) { pt.vy = Math.abs(pt.vy) * .3; pt.y += .02; pt.vx *= .6; pt.vz *= .6; }
      }
    }
    G.renderer.render(cam, G.world, alpha);
    updateHUD();
    updateF3();
  },
};

// MessageChannel pump: runs at full speed even in throttled/background tabs
// (requestAnimationFrame dies and timers drop to 1Hz there; message ports don't)
function pumpTask(step) {
  const mc = new MessageChannel();
  mc.port1.onmessage = () => {
    let cont = false;
    try { cont = step(); } catch (e) { console.error('pumpTask:', e.message, e.stack); }
    if (cont) mc.port2.postMessage(0);
    else mc.port1.close();
  };
  mc.port2.postMessage(0);
}

// ---------- Boot ----------
function boot() {
  try {
    Settings.load();
    document.documentElement.style.setProperty('--gui-scale', G.settings.guiScale);
    TEX.init();
    G.renderer = new Renderer($('game-canvas'));
    SFX.masterVol = G.settings.volume;
    SFX.musicVol = G.settings.music;
    SFX.sfxVol = Math.min(1, G.settings.volume + .15);
    setupInput();
    setupMenus();
    loadPersistedTexturePack();

    // splash text
    const splashes = ['100% Procedural!', 'Also try the real thing!', 'Single file!', 'Punch trees!', 'Now with Creepers!', 'WebGL2 powered!', '20 TPS authentic!', 'No servers needed!', 'Redstone-ish!', 'Infinite-ish worlds!'];
    $('splash-text').textContent = splashes[randInt(0, splashes.length - 1)];

    Game.start();
    showScreen('title-screen');
    console.log('%cWebCraft booted — original engine, procedural assets.', 'color:#7bd44c');
  } catch (e) {
    console.error(e);
    document.body.innerHTML = '<div style="color:#fff;font-family:monospace;padding:40px;background:#200;"><h2>Failed to start WebCraft</h2><pre>' + (e.stack || e.message) + '</pre><p>You need a browser with WebGL2 (Chrome/Edge/Firefox).</p></div>';
  }
}

function setupMenus() {
  // language toggle (title screen): EN default, DE on click — persisted
  $('btn-lang').onclick = () => {
    SFX.playClick();
    G.lang = G.lang === 'en' ? 'de' : 'en';
    try { localStorage.setItem('wc_lang', G.lang); } catch (e) { }
    applyI18N();
    refreshWorldList && refreshWorldList();
  };
  applyI18N();
  $('btn-singleplayer').onclick = () => { SFX.playClick(); refreshWorldList(); showScreen('world-select-screen'); };
  $('btn-world-back').onclick = () => { SFX.playClick(); showScreen('title-screen'); };
  $('btn-create-world').onclick = () => {
    SFX.playClick();
    const name = $('new-world-name').value.trim() || 'New World';
    newWorld(name, $('new-world-seed').value, $('new-world-mode').value, $('new-world-difficulty').value);
  };
  $('btn-del-world').onclick = () => {
    SFX.playClick(false);
    const last = SaveSystem.list();
    if (last.length) { SaveSystem.delete(last[last.length - 1]); refreshWorldList(); }
  };
  $('btn-options-title').onclick = () => { SFX.playClick(); Settings.buildUI(); showScreen('options-screen'); };
  $('btn-pause-options').onclick = () => { SFX.playClick(); Settings.buildUI(); showScreen('options-screen'); };
  $('btn-options-done').onclick = () => {
    SFX.playClick();
    showScreen(null);
    if (G.state === 'paused') showScreen('pause-screen');
    else if (G.state === 'title') showScreen('title-screen');
    else if (G.state === 'container') { $('container-screen').classList.add('active'); }
  };
  $('btn-resume').onclick = () => { SFX.playClick(); resumeGame(); };
  $('btn-save-quit').onclick = () => { SFX.playClick(); quitToTitle(); };
  $('btn-respawn').onclick = () => { SFX.playClick(); respawnPlayer(); };
  $('btn-death-title').onclick = () => { SFX.playClick(); if (G.hardcore) SaveSystem.delete(G.worldName); quitToTitle(); };
  $('btn-win-continue').onclick = () => { SFX.playClick(); showScreen(null); G.state = 'playing'; G._dragonDefeated = true; requestPointerLock(); };

  // multiplayer
  $('btn-multiplayer').onclick = () => { SFX.playClick(); showScreen('multiplayer-screen'); };
  $('btn-mp-back').onclick = () => { SFX.playClick(); showScreen('title-screen'); };
  $('btn-host-lan').onclick = () => {
    SFX.playClick();
    G.net = new Net();
    G.net.startBC(true);
    // internet mode: the room is ALSO reachable by code from other networks
    // via our relay server (guests join the same room over WebSockets)
    if (SIGNAL_URL) {
      G.net.log(T('net.internet_active'));
      G.net.connectWS(SIGNAL_URL);
    }
    // the room code is the ONE thing a guest needs — show it huge
    const code = G.net.roomCode;
    const oldBox = document.getElementById('mp-code-display');
    if (oldBox) oldBox.remove();
    const codeBox = mkEl('div', '', document.getElementById('multiplayer-screen'));
    codeBox.id = 'mp-code-display';
    codeBox.style.cssText = 'margin:10px auto;padding:12px 20px;background:#1a1a2e;border:3px solid #55ff55;outline:2px solid #000;width:fit-content;text-align:center;';
    codeBox.innerHTML = '<div style="color:#55ff55;font-size:12px;">DEIN MULTIPLAYER-CODE</div><div style="color:#fff;font-size:34px;font-weight:bold;letter-spacing:8px;font-family:monospace;text-shadow:2px 2px 0 #000;">' + code + '</div><div style="color:#aaa;font-size:11px;">Gast: Multiplayer → Code eingeben</div>';
    Chat.add('§aMultiplayer-Code: §f' + code);
    if (!$('new-world-name').value) $('new-world-name').value = 'LAN World';
    const name = $('new-world-name').value.trim() || 'LAN World';
    // host needs a world: reuse current, or re-open the LAST PLAYED world
    // (persisted across browser restarts) so friends continue the same world,
    // or create a fresh one on first ever launch
    if (G.state === 'title') {
      const last = (() => { try { return localStorage.getItem('wc_lastworld'); } catch (e) { return null; } })();
      if (last && SaveSystem.list().includes(last)) {
        loadWorld(last);
        Chat.add('§aWelt §f' + last + ' §ageladen — weiter geht\'s!');
      } else {
        newWorld(name, $('new-world-seed').value, $('mp-host-mode').value, $('mp-host-difficulty').value);
      }
    }
  };
  // "Im selben Browser beitreten": no code needed — listen on the shared LAN
  // discovery channel and hop onto whatever host announces itself there
  $('btn-join-auto').onclick = () => {
    SFX.playClick();
    G.net = new Net();
    G.net.startBC(false, '');
    if (G.state === 'title') {
      showScreen('loading-screen');
      $('loading-status').textContent = 'Suche nach einem Spiel im selben Browser...';
      $('loading-bar-fill').style.width = '15%';
    }
  };
  $('btn-join-lan').onclick = () => {
    SFX.playClick();
    const code = ($('mp-code-input').value || '').trim();
    if (!code) {
      const nl = document.getElementById('net-log');
      if (nl) { mkEl('div', 'err', nl, 'Erst einen Raum-Code eingeben — der Host sieht ihn als grünes Banner oben!'); nl.scrollTop = nl.scrollHeight; }
      return;
    }
    G.net = new Net();
    G.net.startBC(false, code);
    // internet mode: the SAME code joins over the relay from other networks —
    // both transports run in parallel; the message dedup removes doubles
    if (SIGNAL_URL) {
      G.net.log(T('net.internet_connecting', { code }));
      G.net.connectWS(SIGNAL_URL);
    }
    if (G.state === 'title') {
      // keine Platzhalter-Welt nötig: die Welt wird beim 'welcome' direkt aus
      // den Host-Daten gebaut (joinWorldFromHost) — ein Klick, fertig.
      showScreen('loading-screen');
      $('loading-status').textContent = 'Suche nach Welt (Code ' + code + ')...';
      $('loading-bar-fill').style.width = '15%';
    }
    Chat.add('§7Suche nach Code §f' + code + '§7...');
  };
  $('btn-rtc-host').onclick = async () => {
    SFX.playClick();
    if (G.state === 'title') newWorld($('new-world-name').value || 'P2P World', $('new-world-seed').value, 'survival');
    G.net = new Net();
    await G.net.startRTC(true);
  };
  $('btn-rtc-join').onclick = async () => {
    SFX.playClick();
    G.net = new Net();
    await G.net.startRTC(false);
    G.net.log('Invite-Code des Hosts unten einfügen und Übernehmen drücken.');
  };
  $('btn-sdp-apply').onclick = async () => {
    SFX.playClick();
    const code = $('sdp-area').value.trim();
    if (!code || !G.net) return;
    try {
      if (G.net.mode === 'rtc-join') await G.net.rtcJoinWithCode(code);
      else if (G.net.mode === 'rtc-host') await G.net.rtcHostApplyCode(code);
    } catch (e) { G.net.log('Invalid code: ' + e.message, true); }
  };
  $('btn-sdp-copy').onclick = () => {
    SFX.playClick();
    $('sdp-area').select();
    document.execCommand && document.execCommand('copy');
  };
  $('btn-ws-connect').onclick = () => {
    SFX.playClick();
    const url = $('ws-relay-url').value.trim();
    if (!url) return;
    G.net = new Net();
    G.net.connectWS(url);
    if (G.state === 'title') newWorld($('new-world-name').value || 'Relay World', $('new-world-seed').value, 'survival');
  };
}

// make TeleportDimension rebuild world edits map per dimension
const _origGetWorldFor = getWorldFor;
getWorldFor = function (dim) {
  if (dim === G.dimension) return G.world;
  let w = DIM_WORLDS.get(dim);
  if (!w) {
    w = new World(G.seed, dim);
    if (G.dimEdits && G.dimEdits[dim]) w.edits = new Map(G.dimEdits[dim]);
    DIM_WORLDS.set(dim, w);
  }
  return w;
};

window.addEventListener('beforeunload', () => { SaveSystem.save(); if (G.net) G.net.shutdown(); });
// pagehide fires more reliably than beforeunload on tab close — the 'left'
// message must reach the other players so they despawn the avatar instantly
window.addEventListener('pagehide', () => { if (G.net) G.net.shutdown(); });
boot();
