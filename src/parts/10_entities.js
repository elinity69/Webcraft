// ============================================================================
// Part 10: Entities — mobs with AI & box models, items, XP orbs, projectiles,
// particles, spawning system
// ============================================================================
function spawnEntity(type, x, y, z, opts = {}) {
  const def = MOB_DEFS[type] || {};
  const e = new Entity(type, x, y, z, def, opts);
  G.entities.push(e);
  return e;
}
function dropItem(x, y, z, itemKey, count, dur, ench) {
  const id = I[itemKey];
  if (id === undefined) return null;
  const e = new Entity('item', x, y, z, { w: .25, h: .25, gravity: true }, { itemStack: { id, count, dur, ench } });
  // MC-authentic drop pop: tiny hop (0.2), gentle scatter, falls with gravity
  e.vx = (rand() - .5) * 0.4; e.vy = 0.2 + rand() * 0.1; e.vz = (rand() - .5) * 0.4;
  e.age = 0; // aggressive magnet: block drops become collectible almost instantly (Q-throws keep their own longer delay)
  G.entities.push(e);
  return e;
}
function spawnXPOrbs(x, y, z, amount) {
  while (amount > 0) {
    const take = Math.min(amount, randInt(1, 5));
    amount -= take;
    const e = new Entity('xp', x, y, z, { w: .25, h: .25, gravity: true }, { value: take });
    e.vx = (rand() - .5) * 3; e.vy = 3 + rand() * 2; e.vz = (rand() - .5) * 3;
    G.entities.push(e);
  }
}
function spawnParticles(x, y, z, n, rgb, up) {
  if (!G.settings.particles) return;
  for (let i = 0; i < n; i++) {
    G.particles.push({
      x: x + (rand() - .5) * .6, y: y + (rand() - .5) * .6, z: z + (rand() - .5) * .6,
      vx: (rand() - .5) * 2, vy: up ? rand() * 2.5 : (rand() - .5) * 2, vz: (rand() - .5) * 2,
      r: rgb[0], g: rgb[1], b: rgb[2], a: 1,
      size: .06 + rand() * .05, life: .5 + rand() * .6, gravity: up ? -.6 : 3,
    });
  }
  if (G.particles.length > 800) G.particles.splice(0, G.particles.length - 800);
}
function spawnBlockParticles(bx, by, bz, blockId, n) {
  if (!G.settings.particles) return;
  const palette = TEX.particleColor(blockId);
  const bl = BLOCKS[blockId] || {};
  let h1 = 1, inset = 0;
  if (bl.shape === 'slab') h1 = 0.5;
  else if (bl.shape === 'farmland') h1 = 15 / 16;
  else if (bl.shape === 'snow') h1 = 2 / 16;
  else if (bl.shape === 'chestbox') { h1 = 14 / 16; inset = 1 / 16; }
  else if (bl.shape === 'enchant') h1 = 12 / 16;
  else if (bl.shape === 'carpet' || bl.shape === 'wire' || bl.shape === 'plate') h1 = 2 / 16;

  // 1:1 Port of ClientLevel.addDestroyBlockEffect (ClientLevel.java lines 1084-1114):
  // Subdivide block AABB into a 3D grid (density 0.25 -> up to 4x4x4 sub-voxel particles)
  const widthX = 1 - inset * 2, widthY = h1, widthZ = 1 - inset * 2;
  const gridN = n && n <= 8 ? 2 : 3;
  const countX = Math.max(2, Math.min(4, Math.ceil(widthX * gridN)));
  const countY = Math.max(2, Math.min(4, Math.ceil(widthY * gridN)));
  const countZ = Math.max(2, Math.min(4, Math.ceil(widthZ * gridN)));

  for (let xx = 0; xx < countX; xx++) {
    for (let yy = 0; yy < countY; yy++) {
      for (let zz = 0; zz < countZ; zz++) {
        const relX = (xx + 0.5) / countX;
        const relY = (yy + 0.5) / countY;
        const relZ = (zz + 0.5) / countZ;
        const px = bx + inset + relX * widthX + (rand() - 0.5) * 0.08;
        const py = by + relY * widthY + (rand() - 0.5) * 0.08;
        const pz = bz + inset + relZ * widthZ + (rand() - 0.5) * 0.08;
        const vx = (relX - 0.5) * 3.2 + (rand() - 0.5) * 1.4;
        const vy = (relY - 0.5) * 2.4 + rand() * 2.2 + 0.6;
        const vz = (relZ - 0.5) * 3.2 + (rand() - 0.5) * 1.4;
        const c = palette[(xx + yy + zz + ((rand() * palette.length) | 0)) % palette.length];
        const shade = 0.82 + rand() * 0.24;
        G.particles.push({
          x: px, y: py, z: pz,
          vx, vy, vz,
          r: clamp(c[0] * shade, 0, 1), g: clamp(c[1] * shade, 0, 1), b: clamp(c[2] * shade, 0, 1), a: 1,
          size: 0.065 + rand() * 0.035,
          life: 0.45 + rand() * 0.45,
          gravity: 9.8,
        });
      }
    }
  }
  if (G.particles.length > 900) G.particles.splice(0, G.particles.length - 900);
}

// 1:1 Port of ClientLevel.addBreakingBlockEffect (ClientLevel.java lines 1117-1154):
// Spawns directional block-chipping particles on the hit face while mining
function spawnBlockCrackParticle(bx, by, bz, blockId, faceDir) {
  if (!G.settings.particles || blockId <= 0) return;
  const palette = TEX.particleColor(blockId);
  const bl = BLOCKS[blockId] || {};
  const minX = 0, maxX = 1, minY = 0, maxY = bl.shape === 'slab' ? 0.5 : 1, minZ = 0, maxZ = 1;
  const [fx, fy, fz] = faceDir || [0, 1, 0];
  let xp = bx + rand() * (maxX - minX - 0.2) + 0.1 + minX;
  let yp = by + rand() * (maxY - minY - 0.2) + 0.1 + minY;
  let zp = bz + rand() * (maxZ - minZ - 0.2) + 0.1 + minZ;
  if (fy === -1) yp = by + minY - 0.08;
  else if (fy === 1) yp = by + maxY + 0.08;
  else if (fz === -1) zp = bz + minZ - 0.08;
  else if (fz === 1) zp = bz + maxZ + 0.08;
  else if (fx === -1) xp = bx + minX - 0.08;
  else if (fx === 1) xp = bx + maxX + 0.08;

  const c = palette[(rand() * palette.length) | 0];
  const shade = 0.8 + rand() * 0.25;
  G.particles.push({
    x: xp, y: yp, z: zp,
    vx: fx * (0.6 + rand() * 0.6) + (rand() - 0.5) * 0.8,
    vy: fy * 0.5 + rand() * 0.9,
    vz: fz * (0.6 + rand() * 0.6) + (rand() - 0.5) * 0.8,
    r: clamp(c[0] * shade, 0, 1), g: clamp(c[1] * shade, 0, 1), b: clamp(c[2] * shade, 0, 1), a: 1,
    size: 0.048 + rand() * 0.025,
    life: 0.25 + rand() * 0.3,
    gravity: 9.8,
  });
  if (G.particles.length > 900) G.particles.splice(0, G.particles.length - 900);
}
function spawnHeartParticles(x, y, z) {
  if (!G.settings.particles) return;
  for (let i = 0; i < 3; i++) {
    G.particles.push({
      x: x + (rand() - .5), y: y + rand() * .8, z: z + (rand() - .5),
      vx: 0, vy: .8, vz: 0,
      r: 1, g: .3, b: .4, a: 1, size: .12, life: .9, gravity: 0,
    });
  }
}
function spawnSmoke(x, y, z, n = 1, gray = .25) {
  if (!G.settings.particles) return;
  for (let i = 0; i < n; i++) {
    G.particles.push({
      x: x + (rand() - .5) * .3, y, z: z + (rand() - .5) * .3,
      vx: (rand() - .5) * .3, vy: .5 + rand() * .5, vz: (rand() - .5) * .3,
      r: gray, g: gray, b: gray, a: .8, size: .07, life: 1 + rand(), gravity: -.2,
    });
  }
}
function spawnFlame(x, y, z) {
  if (!G.settings.particles) return;
  G.particles.push({
    x: x + (rand() - .5) * .2, y, z: z + (rand() - .5) * .2,
    vx: 0, vy: .3 + rand() * .3, vz: 0,
    r: 1, g: .6 + rand() * .3, b: .1, a: 1, size: .06, life: .4, gravity: -.5,
  });
}

// ---------- Mob definitions (1:1 Minecraft per-tick speeds & anatomy) ----------
const MOB_DEFS = {
  zombie:   { w: .6, h: 1.9, health: 20, speed: .115, hostile: true, damage: 3, xp: 5, burnsInDay: true, model: 'humanoid', colors: { skin: [0.28, 0.48, 0.25], shirt: [0.20, 0.56, 0.64], pants: [0.28, 0.24, 0.52], hair: [0.18, 0.33, 0.16] }, drops: [['rotten_flesh', 0, 2]], sound: 'zombie' },
  skeleton: { w: .6, h: 1.95, health: 20, speed: .125, hostile: true, damage: 2, xp: 5, burnsInDay: true, ranged: true, model: 'humanoid', colors: { skin: [0.82, 0.82, 0.78], shirt: [0.76, 0.76, 0.72], pants: [0.72, 0.72, 0.68] }, drops: [['bone', 0, 2], ['arrow', 0, 2]], sound: 'skeleton' },
  creeper:  { w: .6, h: 1.7, health: 20, speed: .115, hostile: true, damage: 0, xp: 5, creeper: true, model: 'creeper', colors: { body: [0.36, 0.74, 0.30], dark: [0.22, 0.52, 0.18] }, drops: [['gunpowder', 0, 2]], sound: 'creeper' },
  spider:   { w: 1.3, h: .85, health: 16, speed: .15, hostile: true, damage: 2, xp: 5, neutralInLight: true, model: 'spider', colors: { body: [0.22, 0.18, 0.20], head: [0.26, 0.21, 0.23] }, drops: [['string', 0, 2], ['spider_eye', 0, 1]], sound: null },
  pig:      { w: .9, h: .9, health: 10, speed: .10, passive: true, xp: 2, breedItem: 'carrot', model: 'quad', colors: { body: [0.95, 0.64, 0.66], head: [0.95, 0.64, 0.66], legs: [0.86, 0.54, 0.57] }, drops: [['porkchop', 1, 3]], sound: 'pig' },
  cow:      { w: .9, h: 1.4, health: 10, speed: .095, passive: true, xp: 2, breedItem: 'wheat_item', model: 'quad', colors: { body: [0.38, 0.26, 0.18], head: [0.42, 0.29, 0.21], legs: [0.33, 0.22, 0.15], spots: [0.88, 0.86, 0.82] }, drops: [['beef', 1, 3], ['leather', 0, 2]], sound: 'cow' },
  sheep:    { w: .9, h: 1.25, health: 8, speed: .095, passive: true, xp: 2, breedItem: 'wheat_item', shearable: true, model: 'quad', colors: { body: [0.92, 0.92, 0.90], head: [0.86, 0.76, 0.66], legs: [0.78, 0.68, 0.58] }, drops: [['mutton', 1, 2]], sound: 'sheep' },
  chicken:  { w: .5, h: .75, health: 4, speed: .095, passive: true, xp: 1, slowFall: true, breedItem: 'wheat_seeds', laysEggs: true, model: 'chicken', colors: { body: [0.96, 0.96, 0.94], head: [0.96, 0.96, 0.94], beak: [0.95, 0.68, 0.18], legs: [0.92, 0.68, 0.18] }, drops: [['chicken', 1, 1], ['feather', 0, 2]], sound: 'chicken' },
  ghast:    { w: 4, h: 4, health: 10, speed: .08, hostile: true, flies: true, xp: 5, shootsFireball: true, model: 'ghast', colors: { body: [0.92, 0.92, 0.92] }, drops: [['gunpowder', 0, 2]], sound: null },
  enderman: { w: .6, h: 2.9, health: 40, speed: .14, hostile: true, damage: 7, xp: 5, avoidsWater: true, model: 'humanoid', colors: { skin: [0.07, 0.07, 0.09], shirt: [0.06, 0.06, 0.08], pants: [0.05, 0.05, 0.07] }, drops: [['ender_pearl', 0, 1]], sound: 'enderman' },
  dragon:   { w: 4, h: 3, health: 200, speed: .35, hostile: true, damage: 10, xp: 500, flies: true, dragon: true, model: 'dragon', colors: { body: [0.12, 0.10, 0.16], wing: [0.22, 0.16, 0.28] }, drops: [], sound: 'dragon' },
  item:     { w: .25, h: .25, gravity: true },
  xp:       { w: .25, h: .25, gravity: true },
  arrow:    { w: .25, h: .25 },
  snowball: { w: .25, h: .25 },
  egg:      { w: .25, h: .25 },
  pearl:    { w: .25, h: .25 },
  fireball: { w: .9, h: .9, hostile: true },
  tnt:      { w: .98, h: .98, gravity: true },
  falling:  { w: .98, h: .98, gravity: true },
  player_remote: { w: .6, h: 1.8, model: 'humanoid', colors: { skin: [0.87, 0.68, 0.52], shirt: [0.15, 0.5, 0.85], pants: [0.2, 0.25, 0.55] } },
  villager:  { w: .6, h: 1.9, health: 20, speed: .12, passive: true, noDespawn: true, xp: 0, model: 'humanoid', colors: { skin: [0.78, 0.58, 0.44], shirt: [0.55, 0.32, 0.22], pants: [0.42, 0.24, 0.16] }, drops: [], sound: 'villager' },
  wither_skeleton: { w: .6, h: 2.2, health: 20, speed: .17, hostile: true, damage: 4, xp: 5, model: 'humanoid', colors: { skin: [0.12, 0.12, 0.12], shirt: [0.08, 0.08, 0.08], pants: [0.06, 0.06, 0.06] }, drops: [['wither_skull_item', 0, 1]], sound: 'skeleton' },
  wither:    { w: 1.4, h: 3.5, health: 300, speed: .3, hostile: true, damage: 8, xp: 200, flies: true, wither: true, model: 'wither', colors: { body: [0.15, 0.15, 0.17] }, drops: [], sound: null },
  boat_ent:  { w: 1.3, h: .6, health: 20, ridable: true, model: 'boat', gravity: true, drops: [['boat', 1, 1]] },
  cart_ent:  { w: 1.1, h: .8, health: 20, ridable: true, model: 'cart', gravity: true, drops: [['minecart', 1, 1]] },
  wither_skull_proj: { w: .4, h: .4 },
};

// Mob jump velocity (blocks/tick) — calibrated for 1-block step clearance
const MOB_JUMP = .5;

class Entity {
  constructor(type, x, y, z, def, opts = {}) {
    this.type = type;
    this.def = def;
    this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.rx = x; this.ry = y; this.rz = z;
    this.yaw = rand() * Math.PI * 2; this.pitch = 0;
    this.w = def.w || .5; this.h = def.h || .5;
    this.health = def.health || 1;
    this.maxHealth = this.health;
    this.dead = false; this.deathTime = 0; this.hurtTime = 0;
    this.hittable = true;
    this.renderParts = true; // every entity renders (items via drawItem, mobs via drawBoxes)
    this.onGround = false;
    this.age = 0;
    this.gravity = !!def.gravity;
    this.hostile = !!def.hostile;
    this.itemEntity = type === 'item';
    this.xpEntity = type === 'xp';
    this.walkAnim = 0; this.walkSpeed = 0;
    this.attackCD = 0;
    this.fuse = -1;
    this.inLove = 0; this.babyAge = 0;
    this.soundCD = randInt(40, 200);
    this.ai = { wanderT: 0, wx: 0, wz: 0, target: null, panicT: 0 };
    Object.assign(this, opts);
    if (def.dragon) { this.orbit = 0; this.orbitR = 38; this.orbitY = 80; }
  }

  collides(px, py, pz) {
    const hw = this.w / 2;
    const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw);
    const y0 = Math.floor(py), y1 = Math.floor(py + this.h - 0.001);
    const z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const id = G.world.getBlock(x, y, z);
      if (id < 0) return true;
      if (id > 0 && BLOCKS[id].solid) return true;
    }
    return false;
  }

  move(dx, dy, dz) {
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) * 3);
    if (steps <= 0) return;
    const sx = dx / steps, sy = dy / steps, sz = dz / steps;
    let hitX = false, hitY = false, hitZ = false;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0) { if (!this.collides(this.x + sx, this.y, this.z)) this.x += sx; else hitX = true; }
      if (sy !== 0) { if (!this.collides(this.x, this.y + sy, this.z)) this.y += sy; else { hitY = true; if (sy < 0) this.onGround = true; } }
      if (sz !== 0) { if (!this.collides(this.x, this.y, this.z + sz)) this.z += sz; else hitZ = true; }
    }
    return { hitX, hitY, hitZ };
  }

  setVelocityFromKnockback(kx, kz, strength) {
    this.vx += kx * strength; this.vz += kz * strength; this.vy = Math.max(this.vy, 0.36);
  }

  damage(amount, attacker, cause) {
    if (this.dead || this.type === 'item' || this.type === 'xp') return;
    this.health -= amount;
    this.hurtTime = 10;
    SFX.playHit();
    if (attacker && (attacker.isPlayer || attacker === G.player)) {
      const dx = this.x - attacker.x, dz = this.z - attacker.z;
      const l = Math.hypot(dx, dz) || 1;
      this.setVelocityFromKnockback(dx / l, dz / l, .35);
      this.ai.target = attacker;
      this.ai.panicT = 100;
      // sprint knockback
      if (attacker.sprinting) { this.vx += dx / l * .5; this.vz += dz / l * .5; }
    }
    if (this.health <= 0) this.die(attacker);
  }

  die(attacker) {
    this.dead = true;
    this.deathTime = 0;
    const d = this.def;
    if (d.drops) {
      for (const [key, mn, mx] of d.drops) {
        const n = randInt(mn, mx);
        if (n > 0) dropItem(this.x, this.y + .5, this.z, key, n);
      }
    }
    if (this.type === 'item' || this.type === 'xp') return;
    if (d.xp) spawnXPOrbs(this.x, this.y + .5, this.z, d.xp);
    if (attacker === G.player) {
      G.stats.kills++;
      Advancements.onKill(!!d.hostile);
    }
    if (d.dragon) {
      spawnXPOrbs(this.x, this.y + 1, this.z, 120);
      WinDragonFight();
    }
    if (d.wither) {
      spawnXPOrbs(this.x, this.y + 1, this.z, 100);
      dropItem(this.x, this.y + 1, this.z, 'glass_bottle', 1);
      UI.updateBossBar(null);
      Chat.add('§dThe Wither has been slain!');
    }
  }

  tick() {
    this.age++;
    // remote players are driven entirely by snapshot interpolation (Net.tick)
    if (this.noAI) { this.px = this.x; this.py = this.y; this.pz = this.z; return; }
    this.yawO = this.yaw; // kept for the render-alpha yaw interpolation
    if (this.attackCD > 0) this.attackCD--; // unified cooldown (MC: 20 ticks = 1 s between melee hits)
    if (this.hurtTime > 0) this.hurtTime--;
    if (this.dead) { this.deathTime++; return; }
    // Villager.java restock(): offers reset 2× per day (morning + afternoon)
    if (this.type === 'villager') villagerRestock(this);
    switch (this.type) {
      case 'item': this.tickItem(); return;
      case 'xp': this.tickXP(); return;
      case 'arrow': this.tickArrow(); return;
      case 'snowball': case 'egg': case 'pearl': case 'xp_bottle': this.tickThrowable(); return;
      case 'fireball': this.tickFireball(); return;
      case 'wither_skull_proj': this.tickWitherSkull(); return;
      case 'tnt': this.tickTNT(); return;
      case 'falling': this.tickFalling(); return;
      case 'boat_ent': this.tickBoat(); return;
      case 'cart_ent': this.tickCart(); return;
      default: this.tickMob(); return;
    }
  }

  tickWitherSkull() {
    this.vy -= 0.01;
    const id = G.world.getBlock(Math.floor(this.x + this.vx * DT * 3), Math.floor(this.y + this.vy * DT * 3), Math.floor(this.z + this.vz * DT * 3));
    const p = G.player;
    let hit = (id > 0 && BLOCKS[id].solid);
    if (!hit && p && !p.dead) {
      if (Math.hypot(p.x - this.x, p.y + 1 - this.y, p.z - this.z) < 1.3) hit = true;
    }
    if (hit) { explode(this.x, this.y, this.z, 1.6); this.dead = true; return; }
    this.x += this.vx * DT; this.y += this.vy * DT; this.z += this.vz * DT;
    if (this.age > 300) this.dead = true;
  }

  controls(ix, iz, jump) {
    if (this.type === 'boat_ent') {
      if (ix) this.yaw += ix * 0.08;
      const th = iz * 0.055;
      this.vx += -Math.sin(this.yaw) * th;
      this.vz += -Math.cos(this.yaw) * th;
    } else if (this.type === 'cart_ent') {
      const bx = Math.floor(this.x), by = Math.round(this.y - 0.1), bz = Math.floor(this.z);
      const onRail = G.world.getBlock(bx, by, bz) === B.rail;
      if (onRail) {
        this.railAxis = this.railAxis || ((G.world.getBlock(bx + 1, by, bz) === B.rail || G.world.getBlock(bx - 1, by, bz) === B.rail) ? 'x' : 'z');
        if (iz) this.railVel = (this.railVel || 0) + iz * 0.02;
        this.railVel = clamp((this.railVel || 0) * 0.98, -0.5, 0.5);
        if (this.railAxis === 'x') { this.vx = this.railVel; this.vz = 0; }
        else { this.vz = this.railVel; this.vx = 0; }
      } else {
        this.vx *= 0.9; this.vz *= 0.9;
      }
    }
  }

  tickBoat() {
    const inWater = G.world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.1), Math.floor(this.z)) === B.water;
    if (inWater) { this.vy = Math.max(this.vy - 0.02, -0.05); this.y += (63.9 - this.y) * 0.08; }
    else this.vy -= 0.04;
    this.vx *= 0.92; this.vz *= 0.92;
    this.move(this.vx * 20 * DT, this.vy, this.vz * 20 * DT);
    if (this.y < -20) this.dead = true;
  }

  tickCart() {
    const bx = Math.floor(this.x), by = Math.round(this.y - 0.1), bz = Math.floor(this.z);
    const onRail = G.world.getBlock(bx, by, bz) === B.rail;
    if (onRail) {
      if (this.railAxis === 'x') { this.z = bz + 0.5; this.vz = 0; }
      else if (this.railAxis === 'z') { this.x = bx + 0.5; this.vx = 0; }
      this.y = by + 0.06;
      this.move(this.vx, 0, this.vz);
      const aheadX = Math.floor(this.x + Math.sign(this.vx) * 0.6), aheadZ = Math.floor(this.z + Math.sign(this.vz) * 0.6);
      const ahead = this.railAxis === 'x' ? G.world.getBlock(aheadX, by, bz) : G.world.getBlock(bx, by, aheadZ);
      if (ahead !== B.rail) {
        if (G.world.getBlock(bx, by, bz + 1) === B.rail || G.world.getBlock(bx, by, bz - 1) === B.rail) { this.railAxis = 'z'; this.vx = 0; }
        else if (G.world.getBlock(bx + 1, by, bz) === B.rail || G.world.getBlock(bx - 1, by, bz) === B.rail) { this.railAxis = 'x'; this.vz = 0; }
        else { this.vx = 0; this.vz = 0; }
      }
    } else {
      this.vy -= 0.04;
      this.move(this.vx, this.vy, this.vz);
      if (this.onGround) { this.vy = 0; this.vx *= 0.9; this.vz *= 0.9; }
    }
    if (this.y < -20) this.dead = true;
  }

  tickItem() {
    // item physics in TICK units (velocities are blocks/tick, like the player):
    // gravity 0.08, air drag 0.98 — items land fast and snappy
    this.vy -= 0.08;
    this.vy *= 0.98;
    this.vx *= 0.98;
    this.vz *= 0.98;
    const inW = G.world.getBlock(Math.floor(this.x), Math.floor(this.y + .3), Math.floor(this.z)) === B.water;
    if (inW) { this.vy = Math.min(this.vy + 0.04, 0.1); this.fallDistance = 0; }
    this.vx *= .9; this.vz *= .9;
    this.onGround = false;
    this.move(this.vx, this.vy, this.vz);
    if (this.onGround) this.vy = 0;
    // merge
    if (this.age % 10 === 0) {
      for (const o of G.entities) {
        if (o !== this && !o.dead && o.type === 'item' && o.itemStack && this.itemStack &&
          o.itemStack.id === this.itemStack.id && !o.itemStack.ench && !this.itemStack.ench &&
          Math.hypot(o.x - this.x, o.y - this.y, o.z - this.z) < 1.5 &&
          this.itemStack.count + o.itemStack.count <= ITEMS[this.itemStack.id].stack) {
          this.itemStack.count += o.itemStack.count;
          o.dead = true;
        }
      }
    }
    if (this.age > 6000) { this.dead = true; return; }
    // aggressive magnet + pickup: a sprinting player must collect a drop the
    // moment he passes over it — no trailing behind
    const p = G.player;
    if (p && !p.dead && this.age > 2) {
      const dx = p.x - this.x, dy = (p.y + .8) - this.y, dz = p.z - this.z;
      const dh = Math.hypot(dx, dz);
      // MC-AABB-style pickup: whenever the player is standing OVER the drop
      // (horizontal contact), it is collected instantly — a spherical check
      // against the body center alone misses it because of the height offset
      if (dh < 0.8 && Math.abs(dy) < 1.3) {
        const left = p.addItem(this.itemStack.id, this.itemStack.count, this.itemStack.dur, this.itemStack.ench);
        if (left === 0) { this.dead = true; SFX.playPop(); return; }
        else this.itemStack.count = left;
      }
      const d = Math.hypot(dx, dy, dz) || .001;
      if (d < 3.5) {
        // strong pull that outruns the friction (0.9 drag per tick)
        this.vx += dx / d * .22; this.vy += dy / d * .22; this.vz += dz / d * .22;
      }
      if (d < 1.1) {
        // final snap: fly straight at the player at up to 0.6 blocks/tick
        const sp = Math.min(.6, d * .3 + .15);
        this.vx = dx / d * sp; this.vy = dy / d * sp; this.vz = dz / d * sp;
      }
      if (d < 0.7) {
        const left = p.addItem(this.itemStack.id, this.itemStack.count, this.itemStack.dur, this.itemStack.ench);
        if (left === 0) { this.dead = true; SFX.playPop(); return; }
        else this.itemStack.count = left;
      }
    }
  }

  tickXP() {
    this.physics(.04);
    this.vx *= .9; this.vz *= .9;
    if (this.age > 6000) { this.dead = true; return; }
    const p = G.player;
    if (p && !p.dead) {
      const dx = p.x - this.x, dy = (p.y + .8) - this.y, dz = p.z - this.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 4) { this.vx += dx / d * .14; this.vy += dy / d * .14; this.vz += dz / d * .14; }
      if (d < 0.8) { p.addXP(this.value); this.dead = true; SFX.playXPOrb(); }
    }
  }

  tickArrow() {
    if (this.inGround) {
      this.age++;
      const p = G.player;
      if (p && !p.dead && this.age > 20 && Math.hypot(p.x - this.x, p.y + 1 - this.y, p.z - this.z) < 1.2) {
        if (p.addItem(I.arrow, 1) === 0) { this.dead = true; SFX.playPop(); }
      }
      if (this.age > 1200) this.dead = true;
      return;
    }
    this.vy -= .05;
    this.vx *= .99; this.vz *= .99; this.vy *= .99;
    const speed = Math.hypot(this.vx, this.vy, this.vz);
    if (speed < 0.1) { this.inGround = true; return; }
    // sample along path
    const steps = Math.ceil(speed * 2);
    for (let i = 0; i < steps; i++) {
      this.x += this.vx / steps; this.y += this.vy / steps; this.z += this.vz / steps;
      const id = G.world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
      if (id > 0 && BLOCKS[id].solid) { this.inGround = true; this.vx = this.vy = this.vz = 0; SFX.playDig('stone'); return; }
      // entity hit
      for (const e of G.entities) {
        if (e === this || e.dead || !e.hittable || e.type === 'item' || e.type === 'xp' || e.type === 'arrow') continue;
        if (this.owner === e) continue;
        const hw = e.w / 2;
        if (this.x > e.x - hw && this.x < e.x + hw && this.y > e.y && this.y < e.y + e.h && this.z > e.z - hw && this.z < e.z + hw) {
          const dmg = Math.max(1, Math.round(speed * 1.2));
          e.damage(dmg, this.owner);
          this.dead = true;
          return;
        }
      }
      // player hit
      const p = G.player;
      if (p && !p.dead && this.owner !== p && this.x > p.x - .4 && this.x < p.x + .4 && this.y > p.y && this.y < p.y + 1.9 && this.z > p.z - .4 && this.z < p.z + .4) {
        const ad = mobDmg(Math.max(1, Math.round(speed)));
        if (ad > 0) p.damage(ad, 'arrow:' + this.type);
        this.dead = true;
        return;
      }
    }
  }

  tickThrowable() {
    this.vy -= .05;
    const id = G.world.getBlock(Math.floor(this.x + this.vx * .1), Math.floor(this.y + this.vy * .1), Math.floor(this.z + this.vz * .1));
    let hitEnt = null;
    for (const e of G.entities) {
      if (e === this || e.dead || !e.hittable || e.type === 'item' || e.type === 'xp') continue;
      const hw = e.w / 2;
      if (this.x > e.x - hw - .2 && this.x < e.x + hw + .2 && this.y > e.y - .2 && this.y < e.y + e.h + .2 && this.z > e.z - hw - .2 && this.z < e.z + hw + .2) { hitEnt = e; break; }
    }
    if (id > 0 && BLOCKS[id].solid || hitEnt) {
      if (this.type === 'snowball') { spawnParticles(this.x, this.y, this.z, 8, [.9, .95, 1]); }
      else if (this.type === 'egg') {
        spawnParticles(this.x, this.y, this.z, 6, [.9, .85, .7]);
        if (chance(.2)) spawnEntity('chicken', this.x, this.y, this.z);
      } else if (this.type === 'pearl') {
        const owner = this.owner;
        if (owner === G.player) {
          TeleportPlayer(this.x, this.y + .5, this.z);
          G.player.damage(5, 'pearl');
        }
      } else if (this.type === 'xp_bottle') {
        spawnParticles(this.x, this.y, this.z, 12, [0.35, 0.75, 1.0], true);
        SFX.playBreak('glass');
        spawnXPOrbs(this.x, this.y + 0.2, this.z, randInt(3, 11));
      }
      if (hitEnt && this.type === 'snowball') hitEnt.damage(1, this.owner);
      this.dead = true;
      return;
    }
    this.x += this.vx * DT; this.y += this.vy * DT; this.z += this.vz * DT;
    this.yaw = Math.atan2(this.vx, this.vz);
    if (this.age > 600) this.dead = true;
  }

  tickFireball() {
    this.vy -= .01;
    const id = G.world.getBlock(Math.floor(this.x + this.vx * DT), Math.floor(this.y + this.vy * DT), Math.floor(this.z + this.vz * DT));
    const p = G.player;
    let hitP = false;
    if (p && !p.dead) {
      const d = Math.hypot(p.x - this.x, p.y + 1 - this.y, p.z - this.z);
      if (d < 1.2) hitP = true;
    }
    if (id > 0 && BLOCKS[id].solid || hitP) {
      explode(this.x, this.y, this.z, 1.8);
      this.dead = true;
      return;
    }
    this.x += this.vx * DT; this.y += this.vy * DT; this.z += this.vz * DT;
    if (G.settings.particles && this.age % 2 === 0) spawnSmoke(this.x, this.y, this.z, 1, .5);
    if (this.age > 1200) this.dead = true;
  }

  tickTNT() {
    this.physics(.04);
    this.fuse--;
    if (G.settings.particles && this.age % 3 === 0) spawnSmoke(this.x, this.y + 1, this.z, 1);
    if (this.fuse <= 0) {
      this.dead = true;
      explode(this.x, this.y + .5, this.z, 4.2);
    }
  }

  tickFalling() {
    this.vy -= .04;
    const hit = this.move(0, this.vy * DT * 20 * DT * 0 + this.vy, 0);
    // use direct velocity integration per tick
    this.x += this.vx * DT; this.z += this.vz * DT;
    const below = G.world.getBlock(Math.floor(this.x), Math.floor(this.y - .05), Math.floor(this.z));
    if (this.onGround || (below > 0 && BLOCKS[below].solid)) {
      this.dead = true;
      const bx = Math.floor(this.x), by = Math.round(this.y), bz = Math.floor(this.z);
      G.world.setBlock(bx, by, bz, this.blockId, 0);
      SFX.playPlace('sand');
    } else if (this.y < -20) this.dead = true;
  }

  // MC LivingEntity.jumpFromGround: 0.42 blocks/tick — our drag curve needs 0.5
  // for a reliable 1-block step clearance (measured apex: 0.42→0.83, 0.5→1.2)
  // const MOB_JUMP lives below as a module constant
  physics(gravity = .08) {
    if (this.def.flies) { this.vy *= .95; return; }
    this.vy -= gravity;
    this.vy *= 0.98;
    if (this.vy < -3.5) this.vy = -3.5;
    const inWater = G.world.getBlock(Math.floor(this.x), Math.floor(this.y + .3), Math.floor(this.z)) === B.water;
    if (inWater) { this.vy = Math.min(this.vy + .08, .2); }
    this.onGround = false;
    const hit = this.move(this.vx, this.vy, this.vz) || {};
    if (this.onGround) this.vy = 0;
    // Automatic 1-block obstacle jump for all walking mobs when blocked horizontally
    if ((hit.hitX || hit.hitZ) && this.onGround && !inWater) {
      this.vy = MOB_JUMP;
      this.onGround = false;
    }
  }

  tickMob() {
    const d = this.def;
    const p = G.player;
    // ambient sounds
    if (d.sound && --this.soundCD <= 0) {
      this.soundCD = randInt(150, 500);
      const dist = p ? Math.hypot(p.x - this.x, p.y - this.y, p.z - this.z) : 999;
      if (dist < 18) SFX.playMobSound(d.sound);
    }
    // burning in daylight
    if (d.burnsInDay && G.dimension === 0) {
      const sky = G.world.skyLight(Math.floor(this.x), Math.floor(this.y + d.h * .8), Math.floor(this.z));
      const day = isDaytime();
      if (sky >= 14 && day) {
        this.burnTime = (this.burnTime || 0) + 1;
        if (G.settings.particles && this.burnTime % 4 === 0) spawnFlame(this.x, this.y + rand() * d.h, this.z);
        if (this.burnTime % 20 === 0) this.damage(1);
      }
    }
    // breeding hearts
    if (this.inLove > 0) {
      this.inLove--;
      if (this.age % 10 === 0) spawnHeartParticles(this.x, this.y + this.h, this.z);
      // find partner
      for (const o of G.entities) {
        if (o !== this && !o.dead && o.type === this.type && o.inLove > 0 && Math.hypot(o.x - this.x, o.z - this.z) < 2.5) {
          this.inLove = 0; o.inLove = 0;
          const baby = spawnEntity(this.type, this.x, this.y, this.z);
          baby.babyAge = -1200; // 60s baby
          spawnHeartParticles(this.x, this.y + 1, this.z);
          spawnXPOrbs(this.x, this.y + .5, this.z, randInt(1, 7));
          break;
        }
      }
    }
    if (this.babyAge < 0) this.babyAge++;
    // egg laying
    if (d.laysEggs && this.age % 6000 === 0 && chance(.5)) dropItem(this.x, this.y + .3, this.z, 'egg', 1);

    const distP = p ? Math.hypot(p.x - this.x, p.y - this.y, p.z - this.z) : 999;

    // ---------- AI ----------
    let moveX = 0, moveZ = 0, speed = d.speed || .1;
    let wantJump = false;

    if (d.dragon) { this.tickDragon(p); this.physics(0); return; }
    if (d.wither) { this.tickWither(p); return; }

    if (d.hostile && p && !p.dead && G.gameMode !== 'creative' && G.gameMode !== 'spectator' && distP < (d.ranged ? 18 : 16)) {
      // chase
      const dx = p.x - this.x, dz = p.z - this.z;
      const l = Math.hypot(dx, dz) || 1;
      this.yaw = Math.atan2(dx, dz);
      if (d.neutralInLight && isDaytime() && G.world.skyLight(Math.floor(this.x), Math.floor(this.y + 1), Math.floor(this.z)) > 12 && !this.angerTime) {
        // passive in daylight
        [moveX, moveZ] = this.wander();
      } else if (d.ranged) {
        // skeleton keeps distance & shoots
        if (distP < 6) { moveX = -dx / l; moveZ = -dz / l; }
        else if (distP > 10) { moveX = dx / l; moveZ = dz / l; }
        else { moveX = -dz / l * .4; moveZ = dx / l * .4; }
        if (this.attackCD <= 0 && distP < 15) {
          this.attackCD = 40;
          const arrow = spawnEntity('arrow', this.x, this.y + this.h * .8, this.z, { owner: this });
          const tx = p.x + p.vx * 8 - this.x, ty = (p.y + 1.2) - (this.y + this.h * .8), tz = p.z + p.vz * 8 - this.z;
          const tl = Math.hypot(tx, ty, tz) || 1;
          const inacc = .08;
          arrow.vx = tx / tl * 22 * (1 + (rand() - .5) * inacc);
          arrow.vy = ty / tl * 22 + 2 * (1 + (rand() - .5) * inacc);
          arrow.vz = tz / tl * 22 * (1 + (rand() - .5) * inacc);
          SFX.playBowShoot();
        }
      } else if (d.creeper) {
        if (distP > 2.2) { moveX = dx / l; moveZ = dz / l; }
        if (distP < 3) {
          if (this.fuse < 0) { this.fuse = 30; SFX.playFuse(); }
        } else if (distP > 6 && this.fuse >= 0) this.fuse = -1;
        if (this.fuse >= 0) {
          this.fuse--;
          speed = 0;
          if (this.fuse <= 0) {
            this.dead = true;
            explode(this.x, this.y + .5, this.z, 3.2);
            return;
          }
        }
      } else if (d.shootsFireball) {
        // ghast
        this.hoverY = this.hoverY === undefined ? this.y : this.hoverY;
        if (distP < 24) {
          if (this.attackCD <= 0) {
            this.attackCD = 80;
            const fb = spawnEntity('fireball', this.x, this.y + this.h / 2, this.z, { owner: this });
            const tx = p.x - fb.x, ty = (p.y + 1) - fb.y, tz = p.z - fb.z;
            const tl = Math.hypot(tx, ty, tz) || 1;
            fb.vx = tx / tl * 9; fb.vy = ty / tl * 9; fb.vz = tz / tl * 9;
            SFX.playMobSound('ghast');
          }
          const l2 = Math.hypot(dx, dz) || 1;
          if (distP > 20) { moveX = dx / l2; moveZ = dz / l2; }
          else if (distP < 10) { moveX = -dx / l2; moveZ = -dz / l2; }
        }
        this.vy += ((this.hoverY - this.y) * .02 + Math.sin(this.age * .05) * .01);
        this.vx = lerp(this.vx, moveX * speed, .05);
        this.vz = lerp(this.vz, moveZ * speed, .05);
        this.yaw = Math.atan2(this.vx, this.vz);
        this.move(this.vx * DT, this.vy * DT, this.vz * DT);
        return;
      } else {
        moveX = dx / l; moveZ = dz / l;
        // melee attack
        if (distP < 1.8 && this.attackCD <= 0) {
          this.attackCD = 20;
          const md = mobDmg(d.damage || 2);
          if (md > 0) p.damage(md, 'mob:' + this.type);
          const kb = .3;
          p.vx += dx / l * kb * 4; p.vz += dz / l * kb * 4; p.vy = Math.max(p.vy, .3);
        }
      }
      wantJump = true;
    } else if (this.angerTime > 0 && p) {
      this.angerTime--;
      const dx = p.x - this.x, dz = p.z - this.z;
      const l = Math.hypot(dx, dz) || 1;
      moveX = dx / l; moveZ = dz / l; wantJump = true;
      if (distP < 1.8 && this.attackCD <= 0) { this.attackCD = 20; const md = mobDmg(d.damage || 2); if (md > 0) p.damage(md, 'mob:' + this.type); }
    } else if (d.passive) {
      // panic when hurt
      if (this.ai.panicT > 0) {
        this.ai.panicT--;
        speed *= 1.8;
        moveX = this.ai.wx; moveZ = this.ai.wz;
      }
      // follow player holding breeding food
      else if (p && !p.dead) {
        const held = p.getHeldItem();
        if (held && ITEMS[held.id].key === d.breedItem && distP < 8) {
          const dx = p.x - this.x, dz = p.z - this.z;
          const l = Math.hypot(dx, dz) || 1;
          if (distP > 1.8) { moveX = dx / l; moveZ = dz / l; }
        } else [moveX, moveZ] = this.wander();
      } else [moveX, moveZ] = this.wander();
    } else {
      [moveX, moveZ] = this.wander();
    }

    // Smooth yaw turn toward movement direction + movement integration (per-tick units)
    if (Math.hypot(moveX, moveZ) > 0.01) {
      const targetYaw = Math.atan2(moveX, moveZ);
      let diff = targetYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * 0.28;
    }
    this.vx = lerp(this.vx, moveX * speed, .25);
    this.vz = lerp(this.vz, moveZ * speed, .25);
    this.walkSpeed = Math.hypot(this.vx, this.vz);
    // previous values kept so drawBoxes can interpolate the leg swing with the
    // render alpha — without this the legs jump in visible 20 Hz steps
    this.walkAnimO = this.walkAnim;
    this.walkSpeedO = this.walkSpeed;
    this.walkAnim += this.walkSpeed * 3.2;

    // jump if blocked horizontally (both passive and hostile mobs jump 1-block steps)
    if (this.onGround && this.walkSpeed > .015) {
      const aheadX = Math.floor(this.x + moveX * (this.w * 0.5 + 0.35));
      const aheadZ = Math.floor(this.z + moveZ * (this.w * 0.5 + 0.35));
      const ahead = G.world.getBlock(aheadX, Math.floor(this.y + .1), aheadZ);
      const aheadUp = G.world.getBlock(aheadX, Math.floor(this.y + 1.1), aheadZ);
      if (ahead > 0 && BLOCKS[ahead].solid && !(aheadUp > 0 && BLOCKS[aheadUp].solid)) this.vy = MOB_JUMP;
    }
    // avoid walking into water/lava/deep cliffs (passives)
    if (d.passive && this.onGround && this.walkSpeed > .015) {
      const ax = Math.floor(this.x + Math.sign(moveX) * .8), az = Math.floor(this.z + Math.sign(moveZ) * .8);
      const below1 = G.world.getBlock(ax, Math.floor(this.y - 1), az);
      const below2 = G.world.getBlock(ax, Math.floor(this.y - 2), az);
      const at = G.world.getBlock(ax, Math.floor(this.y), az);
      if ((below1 === 0 && below2 === 0) || at === B.water || at === B.lava) {
        this.vx = 0; this.vz = 0;
        this.ai.wx = -this.ai.wx; this.ai.wz = -this.ai.wz;
      }
    }
    // water float
    const inWater = G.world.getBlock(Math.floor(this.x), Math.floor(this.y + .3), Math.floor(this.z)) === B.water;
    if (d.flies) {
      this.vy = lerp(this.vy, Math.sin(this.age * .04) * .05, .1);
      this.move(this.vx, this.vy, this.vz);
    } else if (inWater) {
      this.vy = Math.min(this.vy + .06, .14);
      this.move(this.vx * .6, this.vy, this.vz * .6);
    } else {
      if (d.slowFall && this.vy < -.12) this.vy = -.12;
      this.physics(.08);
    }
    if (this.y < -30) this.dead = true;
  }

  tickWither(p) {
    // fly toward the player, keep 8 blocks distance, shoot skulls
    const dx = p ? p.x - this.x : 0, dy = p ? (p.y + 1) - this.y : 0, dz = p ? p.z - this.z : 0;
    const l = Math.hypot(dx, dy, dz) || 1;
    const dir = l > 8 ? 1 : -0.5;
    this.vx = lerp(this.vx, (dx / l) * 0.18 * dir, 0.05);
    this.vy = lerp(this.vy, (dy / l) * 0.18 * dir + Math.sin(this.age * 0.05) * 0.01, 0.05);
    this.vz = lerp(this.vz, (dz / l) * 0.18 * dir, 0.05);
    this.yaw = Math.atan2(dx, dz);
    this.move(this.vx, this.vy, this.vz);
    if (p && this.attackCD <= 0 && !p.dead) {
      this.attackCD = 55;
      const sk = spawnEntity('wither_skull_proj', this.x, this.y + 2.6, this.z, { owner: this });
      const tx = p.x + p.vx * 10 - sk.x, ty = (p.y + 1.2) - sk.y, tz = p.z + p.vz * 10 - sk.z;
      const tl = Math.hypot(tx, ty, tz) || 1;
      sk.vx = tx / tl * 14; sk.vy = ty / tl * 14; sk.vz = tz / tl * 14;
      SFX.playMobSound('zombie');
    }
    if (G.settings.particles && this.age % 6 === 0) spawnSmoke(this.x, this.y + 2, this.z, 2, 0.1);
    UI.updateBossBar('Wither', this.health / this.maxHealth);
  }

  wander() {
    this.ai.wanderT--;
    if (this.ai.wanderT <= 0) {
      this.ai.wanderT = randInt(40, 160);
      if (chance(.55)) { this.ai.wx = 0; this.ai.wz = 0; }
      else {
        const a = rand() * Math.PI * 2;
        this.ai.wx = Math.sin(a); this.ai.wz = Math.cos(a);
      }
    }
    if (this.ai.wx || this.ai.wz) this.yaw = Math.atan2(this.ai.wx, this.ai.wz);
    return [this.ai.wx, this.ai.wz];
  }

  tickDragon(p) {
    this.orbit += .008;
    const tx = Math.cos(this.orbit) * this.orbitR, tz = Math.sin(this.orbit) * this.orbitR;
    const ty = this.orbitY + Math.sin(this.orbit * 3) * 6;
    if (p && !p.dead && chance(.006)) {
      // swoop at player
      this.swoopTarget = [p.x, p.y + 2, p.z];
      this.swoopT = 60;
    }
    let gx = tx, gy = ty, gz = tz;
    if (this.swoopT > 0) {
      this.swoopT--;
      if (this.swoopTarget) { gx = this.swoopTarget[0]; gy = this.swoopTarget[1] + 6; gz = this.swoopTarget[2]; }
    }
    const dx = gx - this.x, dy = gy - this.y, dz = gz - this.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    this.vx = lerp(this.vx, dx / l * .5, .04);
    this.vy = lerp(this.vy, dy / l * .5, .04);
    this.vz = lerp(this.vz, dz / l * .5, .04);
    this.x += this.vx; this.y += this.vy; this.z += this.vz;
    this.yaw = Math.atan2(this.vx, this.vz);
    // contact damage
    if (p && !p.dead) {
      const d = Math.hypot(p.x - this.x, p.y + 1 - this.y, p.z - this.z);
      if (d < 4) { const dd = mobDmg(8); if (dd > 0) p.damage(dd, 'dragon'); const kb = 1.2; p.vx += (p.x - this.x) * kb; p.vy = Math.max(p.vy, .5); p.vz += (p.z - this.z) * kb; }
    }
    // healing from crystals
    if (this.age % 50 === 0 && this.health < this.maxHealth) {
      for (const e of G.entities) {
        if (e.type === 'crystal' && !e.dead) { this.health = Math.min(this.maxHealth, this.health + 1); break; }
      }
    }
    // wing particles
    if (G.settings.particles && this.age % 4 === 0) spawnParticles(this.x, this.y + 1, this.z, 2, [.5, .2, .7]);
    UI.updateBossBar('Ender Dragon', this.health / this.maxHealth);
  }

  // ---------- Rendering: box models ----------
  drawBoxes(verts, cam, alpha, tmp) {
    if (this.type === 'item' || this.type === 'tnt' || this.type === 'falling') return;
    if (this.type === 'xp') { this.drawXPOrb(verts, alpha); return; }
    if (this.type === 'arrow') { this.drawArrow(verts, alpha); return; }
    if (this.type === 'snowball' || this.type === 'egg') { this.drawTinyBox(verts, alpha, this.type === 'egg' ? [.9, .85, .7] : [.95, .97, 1]); return; }
    if (this.type === 'pearl') { this.drawTinyBox(verts, alpha, [.1, .4, .35]); return; }
    if (this.type === 'xp_bottle') { this.drawTinyBox(verts, alpha, [.35, .85, .95]); return; }
    if (this.type === 'wither_skull_proj') { this.drawTinyBox(verts, alpha, [.15, .15, .18], .24); return; }
    if (this.type === 'fireball') { this.drawTinyBox(verts, alpha, [1, .6, .15], .9); return; }
    if (this.type === 'crystal') { this.drawCrystal(verts, alpha); return; }

    const l = this.lightAt();
    const hurt = this.hurtTime > 0 ? 1 : 0;
    const deathRot = this.dead ? Math.min(1, this.deathTime / 15) * Math.PI / 2 : 0;
    const scale = this.babyAge < 0 ? .55 : 1;
    // leg swing interpolated between the last two ticks (see tick(): walkAnimO)
    const wa = this.walkAnimO === undefined ? this.walkAnim : this.walkAnimO + (this.walkAnim - this.walkAnimO) * alpha;
    const ws = this.walkSpeedO === undefined ? this.walkSpeed : this.walkSpeedO + (this.walkSpeed - this.walkSpeedO) * alpha;
    const swing = Math.sin(wa) * Math.min(1, ws * 6);
    const m = this.def.model;
    const C = this.def.colors || {};

    // push rotated+translated colored boxes
    const emit = (parts) => {
      for (const part of parts) this.emitPart(verts, part, alpha, l, hurt, deathRot, scale);
    };

    if (m === 'humanoid') {
      const skin = C.skin, shirt = C.shirt, pants = C.pants;
      const armSwing = this.type === 'zombie' ? -1.4 : swing * .8;
      emit([
        { x: 0, y: 1.5 * scale, z: 0, w: .5 * scale, h: .5 * scale, d: .5 * scale, c: skin, head: true },
        { x: 0, y: .95 * scale, z: 0, w: .56 * scale, h: .66 * scale, d: .3 * scale, c: shirt },
        { x: -.36 * scale, y: 1.06 * scale, z: 0, w: .22 * scale, h: .62 * scale, d: .22 * scale, c: this.type === 'zombie' ? skin : shirt, rx: armSwing },
        { x: .36 * scale, y: 1.06 * scale, z: 0, w: .22 * scale, h: .62 * scale, d: .22 * scale, c: this.type === 'zombie' ? skin : shirt, rx: this.type === 'zombie' ? armSwing : -armSwing },
        { x: -.14 * scale, y: .33 * scale, z: 0, w: .22 * scale, h: .62 * scale, d: .22 * scale, c: pants, rx: swing },
        { x: .14 * scale, y: .33 * scale, z: 0, w: .22 * scale, h: .62 * scale, d: .22 * scale, c: pants, rx: -swing },
      ]);
      // eyes
      emit([
        { x: -.12 * scale, y: 1.58 * scale, z: -.26 * scale, w: .1, h: .06, d: .02, c: [0.05, 0.05, 0.08] },
        { x: .12 * scale, y: 1.58 * scale, z: -.26 * scale, w: .1, h: .06, d: .02, c: [0.05, 0.05, 0.08] },
      ]);
      // MC villager: the signature big nose under the eye line (1:1 look)
      if (this.type === 'villager') emit([
        { x: 0, y: 1.52 * scale, z: -.28 * scale, w: .08, h: .18, d: .07, c: [0.71, 0.52, 0.38] },
      ]);
    } else if (m === 'creeper') {
      const swell = this.fuse >= 0 ? 1 + Math.sin(this.age * .8) * .08 : 1;
      emit([
        { x: 0, y: 1.44 * scale, z: 0, w: .5 * scale, h: .5 * scale, d: .5 * scale, c: C.body, head: true },
        { x: 0, y: .85 * scale, z: 0, w: .46 * scale * swell, h: .8 * scale, d: .3 * scale * swell, c: C.body },
        { x: -.16 * scale, y: .24 * scale, z: -.16 * scale, w: .22 * scale, h: .5 * scale, d: .22 * scale, c: C.dark },
        { x: .16 * scale, y: .24 * scale, z: -.16 * scale, w: .22 * scale, h: .5 * scale, d: .22 * scale, c: C.dark },
        { x: -.16 * scale, y: .24 * scale, z: .16 * scale, w: .22 * scale, h: .5 * scale, d: .22 * scale, c: C.dark },
        { x: .16 * scale, y: .24 * scale, z: .16 * scale, w: .22 * scale, h: .5 * scale, d: .22 * scale, c: C.dark },
      ]);
      // creeper face
      emit([
        { x: -.12 * scale, y: 1.52 * scale, z: -.26 * scale, w: .1, h: .1, d: .02, c: [0, 0, 0] },
        { x: .12 * scale, y: 1.52 * scale, z: -.26 * scale, w: .1, h: .1, d: .02, c: [0, 0, 0] },
        { x: 0, y: 1.36 * scale, z: -.26 * scale, w: .14, h: .16, d: .02, c: [0, 0, 0] },
      ]);
    } else if (m === 'quad') {
      const bodyC = this.sheared && this.type === 'sheep' ? C.head : (this.woolColor ? WOOL_RGB[this.woolColor] : C.body);
      emit([
        { x: 0, y: (this.h * .78) * scale, z: -.42 * scale, w: .42 * scale, h: .42 * scale, d: .42 * scale, c: C.head, head: true },
        { x: 0, y: (this.h * .62) * scale, z: .1 * scale, w: .5 * scale, h: .5 * scale, d: .85 * scale, c: bodyC },
        { x: -.16 * scale, y: .22 * scale, z: -.32 * scale, w: .16 * scale, h: .44 * scale, d: .16 * scale, c: C.legs, rx: swing },
        { x: .16 * scale, y: .22 * scale, z: -.32 * scale, w: .16 * scale, h: .44 * scale, d: .16 * scale, c: C.legs, rx: -swing },
        { x: -.16 * scale, y: .22 * scale, z: .42 * scale, w: .16 * scale, h: .44 * scale, d: .16 * scale, c: C.legs, rx: -swing },
        { x: .16 * scale, y: .22 * scale, z: .42 * scale, w: .16 * scale, h: .44 * scale, d: .16 * scale, c: C.legs, rx: swing },
      ]);
      if (this.type === 'cow') emit([{ x: 0, y: this.h * .62 * scale, z: .1 * scale, w: .52, h: .3, d: .6, c: C.spots }]);
      if (this.type === 'pig') emit([
        { x: 0, y: this.h * .78 * scale, z: -.68 * scale, w: .16, h: .12, d: .06, c: [0.95, 0.7, 0.75] },
      ]);
      // eyes on the head's front face — same dark-box style as the humanoid
      // avatar eyes. MC placement: pig high above the snout, sheep/cow upper sides
      const eyeY = this.type === 'pig' ? (this.h * .78 + .12) * scale : (this.h * .78 + .08) * scale;
      const eyeX = this.type === 'pig' ? .12 * scale : .15 * scale;
      emit([
        { x: -eyeX, y: eyeY, z: -.64 * scale, w: .09, h: .07, d: .03, c: [0.04, 0.04, 0.07] },
        { x: eyeX, y: eyeY, z: -.64 * scale, w: .09, h: .07, d: .03, c: [0.04, 0.04, 0.07] },
      ]);
    } else if (m === 'chicken') {
      emit([
        { x: 0, y: .58 * scale, z: -.18 * scale, w: .24 * scale, h: .3 * scale, d: .24 * scale, c: C.head, head: true },
        { x: 0, y: .56 * scale, z: -.36 * scale, w: .1, h: .08, d: .12, c: C.beak },
        { x: 0, y: .3 * scale, z: 0, w: .3 * scale, h: .3 * scale, d: .4 * scale, c: C.body },
        { x: -.12 * scale, y: .3 * scale, z: .28 * scale, w: .1 * scale, h: .1 * scale, d: .34, c: [0.85, 0.55, 0.3], rx: -swing },
        { x: .12 * scale, y: .3 * scale, z: .28 * scale, w: .1 * scale, h: .1 * scale, d: .34, c: [0.85, 0.55, 0.3], rx: -swing },
        { x: -.08 * scale, y: .08 * scale, z: 0, w: .06, h: .16, d: .06, c: C.legs },
        { x: .08 * scale, y: .08 * scale, z: 0, w: .06, h: .16, d: .06, c: C.legs },
      ]);
      // chicken eyes sit on the SIDES of the head just above the beak (MC)
      emit([
        { x: -.125 * scale, y: .62 * scale, z: -.26 * scale, w: .02, h: .04, d: .05, c: [0.06, 0.06, 0.09] },
        { x: .125 * scale, y: .62 * scale, z: -.26 * scale, w: .02, h: .04, d: .05, c: [0.06, 0.06, 0.09] },
      ]);
    } else if (m === 'spider') {
      emit([
        { x: 0, y: .45 * scale, z: -.5 * scale, w: .4 * scale, h: .4 * scale, d: .4 * scale, c: this.def.colors.head, head: true },
        { x: 0, y: .5 * scale, z: .25 * scale, w: .55 * scale, h: .42 * scale, d: .7 * scale, c: C.body },
      ]);
      for (let i = 0; i < 4; i++) {
        const zz = -.2 + i * .22;
        const ph = swing * (i % 2 ? 1 : -1);
        emit([
          { x: -.5 * scale, y: .4 * scale, z: zz, w: .55 * scale, h: .1, d: .1, c: C.body, rz: .5 + ph * .3, pivot: [-.25, 0, 0] },
          { x: .5 * scale, y: .4 * scale, z: zz, w: .55 * scale, h: .1, d: .1, c: C.body, rz: -.5 - ph * .3, pivot: [.25, 0, 0] },
        ]);
      }
      // red eyes
      emit([
        { x: -.1, y: .52, z: -.71, w: .06, h: .06, d: .02, c: [.8, 0, 0] },
        { x: .1, y: .52, z: -.71, w: .06, h: .06, d: .02, c: [.8, 0, 0] },
      ]);
    } else if (m === 'ghast') {
      const flap = Math.sin(this.age * .15) * .1;
      emit([{ x: 0, y: 2 * scale, z: 0, w: 4 * scale, h: 3.6 * scale, d: 4 * scale, c: C.body }]);
      // tentacles
      for (let i = 0; i < 9; i++) {
        const ox = ((i % 3) - 1) * 1.2, oz = ((i / 3 | 0) - 1) * 1.2;
        emit([{ x: ox * scale, y: (-0.2 + flap) * scale, z: oz * scale, w: .3, h: 1.4, d: .3, c: [0.85, 0.85, 0.85] }]);
      }
      emit([
        { x: -.7, y: 2.4, z: -2.05, w: .3, h: .3, d: .05, c: [.1, .1, .1] },
        { x: .7, y: 2.4, z: -2.05, w: .3, h: .3, d: .05, c: [.1, .1, .1] },
      ]);
    } else if (m === 'dragon') {
      const flap = Math.sin(this.age * .12);
      emit([
        { x: 0, y: 1.2, z: 0, w: 1.6, h: 1.2, d: 3.4, c: C.body },
        { x: 0, y: 1.4, z: -2.1, w: .8, h: .7, d: 1.2, c: C.body, head: true },
        { x: 0, y: 1.4, z: -2.9, w: .4, h: .3, d: .8, c: [.3, .1, .1] },
        { x: -1.4, y: 1.6, z: .2, w: 2.6, h: .15, d: 2.2, c: C.wing, rz: flap * .5, pivot: [1.3, 0, 0] },
        { x: 1.4, y: 1.6, z: .2, w: 2.6, h: .15, d: 2.2, c: C.wing, rz: -flap * .5, pivot: [-1.3, 0, 0] },
        { x: 0, y: 1.1, z: 2.2, w: .5, h: .4, d: 2.4, c: C.body },
      ]);
      emit([
        { x: -.25, y: 1.6, z: -2.7, w: .15, h: .15, d: .05, c: [1, .3, .3] },
        { x: .25, y: 1.6, z: -2.7, w: .15, h: .15, d: .05, c: [1, .3, .3] },
      ]);
    } else if (m === 'wither') {
      emit([
        { x: 0, y: 2.4, z: 0, w: .5, h: .5, d: .5, c: C.body, head: true },
        { x: -.6, y: 2.2, z: 0, w: .4, h: .4, d: .4, c: C.body, head: true },
        { x: .6, y: 2.2, z: 0, w: .4, h: .4, d: .4, c: C.body, head: true },
        { x: 0, y: 1.2, z: 0, w: .35, h: 1.2, d: .3, c: C.body },
        { x: -.7, y: 1.7, z: 0, w: 1.1, h: .12, d: .12, c: C.body, rz: .5 },
        { x: .7, y: 1.7, z: 0, w: 1.1, h: .12, d: .12, c: C.body, rz: -.5 },
      ]);
      emit([
        { x: -.6, y: 2.24, z: -.21, w: .08, h: .08, d: .02, c: [0, 0, 0] },
        { x: .6, y: 2.24, z: -.21, w: .08, h: .08, d: .02, c: [0, 0, 0] },
        { x: 0, y: 2.5, z: -.26, w: .3, h: .1, d: .02, c: [0, 0, 0] },
      ]);
    } else if (m === 'boat') {
      const c = [0.55, 0.42, 0.26];
      emit([
        { x: 0, y: .25, z: -.55, w: 1.1, h: .3, d: .15, c },
        { x: 0, y: .25, z: .55, w: 1.1, h: .3, d: .15, c },
        { x: -.55, y: .25, z: 0, w: .15, h: .3, d: 1.1, c },
        { x: .55, y: .25, z: 0, w: .15, h: .3, d: 1.1, c },
        { x: 0, y: .1, z: 0, w: .9, h: .12, d: .95, c: [0.4, 0.3, 0.18] },
      ]);
    } else if (m === 'cart') {
      const c = [0.5, 0.5, 0.53];
      emit([
        { x: 0, y: .3, z: 0, w: .9, h: .4, d: 1.1, c },
        { x: 0, y: .3, z: 0, w: .75, h: .25, d: .95, c: [0.25, 0.25, 0.27] },
        { x: -.4, y: .08, z: -.35, w: .12, h: .16, d: .12, c: [.2, .2, .2] },
        { x: .4, y: .08, z: -.35, w: .12, h: .16, d: .12, c: [.2, .2, .2] },
        { x: -.4, y: .08, z: .35, w: .12, h: .16, d: .12, c: [.2, .2, .2] },
        { x: .4, y: .08, z: .35, w: .12, h: .16, d: .12, c: [.2, .2, .2] },
      ]);
    } else if (m === 'player_model') {
      emit([{ x: 0, y: 1.5, z: 0, w: .5, h: .5, d: .5, c: C.skin, head: true }]);
    }
  }

  lightAt() {
    const l = G.world.getLight(Math.floor(this.rx), Math.floor(this.ry + 1), Math.floor(this.rz));
    const sky = (l >> 4) / 15, blk = (l & 15) / 15;
    const dayBr = G.dimension === 1 ? 0.12 : (G.dimension === 2 ? 0.4 : dayBrightness());
    return clamp(0.1 + 0.9 * Math.max(sky * dayBr, blk), 0.12, 1);
  }

  emitPart(verts, part, alpha, light, hurt, deathRot, bodyScale) {
    // builds 6 faces of a rotated box, position interpolated in entity local space then rotated by entity yaw
    const hw = (part.w || .3) / 2, hh = (part.h || .3) / 2, hd = (part.d || .3) / 2;
    const c = part.c || [1, 1, 1];
    const rr = hurt ? Math.min(1, c[0] + .5) : c[0], rg = hurt ? c[1] * .5 : c[1], rb = hurt ? c[2] * .5 : c[2];
    // body yaw interpolated between ticks (shortest arc) — no 20 Hz turn snapping
    const ryaw = this.yawO === undefined ? (this.yaw || 0)
      : this.yawO + (() => { let d = (this.yaw || 0) - this.yawO; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d * alpha; })();
    const bodyYaw = ryaw + Math.PI;
    const partYaw = part.ry || 0;
    const pitch = part.head ? (this.pitch || 0) : (part.rx || 0);
    const zrot = part.rz || 0;
    const bcs = Math.cos(bodyYaw), bsn = Math.sin(bodyYaw);
    const pcs = Math.cos(partYaw), psn = Math.sin(partYaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cz = Math.cos(zrot), sz = Math.sin(zrot);
    const cdr = Math.cos(deathRot || 0), sdr = Math.sin(deathRot || 0);
    const ox = part.x || 0, oy = part.y || 0, oz = part.z || 0;
    const pvx = part.pivot ? part.pivot[0] : 0, pvy = part.pivot ? part.pivot[1] : 0, pvz = part.pivot ? part.pivot[2] : 0;
    const tf = (x, y, z) => {
      // 1. rotate around part pivot (local pitch/roll/yaw)
      let ax = x - pvx, ay = y - pvy, az = z - pvz;
      if (zrot) { const t = cz * ax - sz * ay; ay = sz * ax + cz * ay; ax = t; }
      if (pitch) { const t = cp * ay - sp * az; az = sp * ay + cp * az; ay = t; }
      if (partYaw) { const t = pcs * ax + psn * az; az = -psn * ax + pcs * az; ax = t; }
      ax += pvx + ox; ay += pvy + oy; az += pvz + oz;
      // 2. death fall-over rotation
      if (deathRot) { const t = cdr * ax - sdr * ay; ay = sdr * ax + cdr * ay; ax = t; }
      // 3. rotate entire entity by bodyYaw around (this.rx, this.ry, this.rz)
      const wx = bcs * ax + bsn * az;
      const wz = -bsn * ax + bcs * az;
      return [this.rx + wx, this.ry + ay, this.rz + wz];
    };
    const faces = [
      { n: 'top', pts: [[-hw, hh, -hd], [hw, hh, -hd], [hw, hh, hd], [-hw, hh, hd]], s: 1 },
      { n: 'bottom', pts: [[-hw, -hh, hd], [hw, -hh, hd], [hw, -hh, -hd], [-hw, -hh, -hd]], s: .55 },
      { n: 'north', pts: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, hh, -hd], [-hw, hh, -hd]], s: .8 },
      { n: 'south', pts: [[hw, -hh, hd], [-hw, -hh, hd], [-hw, hh, hd], [hw, hh, hd]], s: .8 },
      { n: 'east', pts: [[hw, -hh, -hd], [hw, -hh, hd], [hw, hh, hd], [hw, hh, -hd]], s: .65 },
      { n: 'west', pts: [[-hw, -hh, hd], [-hw, -hh, -hd], [-hw, hh, -hd], [-hw, hh, hd]], s: .65 },
    ];
    for (const f of faces) {
      const P = f.pts.map(p => tf(p[0], p[1], p[2]));
      const shade = f.s * light;
      const R = rr * shade, Gg = rg * shade, Bb = rb * shade;
      const idxs = [0, 1, 2, 2, 3, 0];
      for (const i of idxs) verts.push(P[i][0], P[i][1], P[i][2], R, Gg, Bb, 1);
    }
  }

  drawItem(verts, alpha) {
    const t = this.age * .05;
    const bob = Math.sin(t * 2) * .06;
    const y = this.ry + .25 + bob;
    const bl = ITEMS[this.itemStack.id];
    // MC: block drops are spinning mini-cubes with the block's own colors
    if (bl && bl.placeBlock != null) {
      const pal = TEX.particleColor(bl.placeBlock);
      if (!this._color) {
        let r = 0, g = 0, b = 0;
        for (const c of pal) { r += c[0]; g += c[1]; b += c[2]; }
        this._color = [r / pal.length, g / pal.length, b / pal.length];
      }
      this.emitTinyBox(verts, this.rx, y, this.rz, 0.2, this._color, alpha, t);
      return;
    }
    // non-block items: flat spinning sprite with the item's true icon colors
    if (!this._color) {
      const def2 = ITEMS[this.itemStack.id];
      const painter = ITEM_ICON_PAINTERS[def2.key];
      let col = [0.7, 0.7, 0.7];
      if (painter) {
        const img = new ImageData(16, 16);
        const t2 = makePaintCtx(img, hashStr('item:' + def2.key));
        painter(t2);
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 3; i < img.data.length; i += 4) {
          if (img.data[i] > 100) { r += img.data[i - 3]; g += img.data[i - 2]; b += img.data[i - 1]; n++; }
        }
        if (n) col = [r / n / 255, g / n / 255, b / n / 255];
      } else if (def2.placeBlock != null) {
        const pal = TEX.particleColor(def2.placeBlock);
        const c2 = pal[0];
        col = c2;
      }
      this._color = col;
    }
    const c = this._color;
    const s = .18;
    const csp = Math.cos(t), snp = Math.sin(t);
    const P = [];
    for (const X of [-s, s]) for (const Y of [-s, s]) P.push([this.rx + X * csp, y + Y, this.rz + X * snp]);
    const q = (a, b, c2, d2, sh) => {
      for (const p of [a, b, c2, a, c2, d2]) verts.push(p[0], p[1], p[2], c[0] * sh, c[1] * sh, c[2] * sh, alpha);
    };
    q(P[0], P[1], P[3], P[2], 1);
    q(P[1], P[0], P[2], P[3], .7);
  }

  drawXPOrb(verts, alpha) {
    const t = this.age * .1 + this.x;
    const r = .5 + Math.sin(t) * .5;
    const g = 1, b = .2 + Math.sin(t * 1.3) * .2;
    const s = .09 + (this.value > 3 ? .05 : 0);
    const y = this.ry + .2 + Math.sin(t * 1.5) * 0.04;
    const c = [r, g, b];
    this.emitTinyBox(verts, this.rx, y, this.rz, s, c, 1, t * 0.5);
  }

  drawArrow(verts, alpha) {
    const yaw = this.inGround ? this.yaw : Math.atan2(this.vx, this.vz);
    const pitch = this.inGround ? this.pitch : -Math.atan2(this.vy, Math.hypot(this.vx, this.vz));
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const tf = (x, y, z) => {
      const ay = cp * y - sp * z;
      const az1 = sp * y + cp * z;
      const ax = cs * x + sn * az1;
      const az = -sn * x + cs * az1;
      return [this.rx + ax, this.ry + .1 + ay, this.rz + az];
    };
    const hw = 0.035, hh = 0.035, hd = 0.24;
    const c = [.6, .45, .25];
    const quads = [
      [[-hw, hh, -hd], [hw, hh, -hd], [hw, hh, hd], [-hw, hh, hd], 1],
      [[-hw, -hh, hd], [hw, -hh, hd], [hw, -hh, -hd], [-hw, -hh, -hd], .6],
      [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, hh, -hd], [-hw, hh, -hd], .85],
      [[hw, -hh, hd], [-hw, -hh, hd], [-hw, hh, hd], [hw, hh, hd], .85],
      [[hw, -hh, -hd], [hw, -hh, hd], [hw, hh, hd], [hw, hh, -hd], .7],
      [[-hw, -hh, hd], [-hw, -hh, -hd], [-hw, hh, -hd], [-hw, hh, hd], .7],
    ];
    for (const q of quads) {
      const P = [tf(q[0][0], q[0][1], q[0][2]), tf(q[1][0], q[1][1], q[1][2]), tf(q[2][0], q[2][1], q[2][2]), tf(q[3][0], q[3][1], q[3][2])];
      const sh = q[4];
      for (const i of [0, 1, 2, 2, 3, 0]) verts.push(P[i][0], P[i][1], P[i][2], c[0] * sh, c[1] * sh, c[2] * sh, 1);
    }
  }

  emitTinyBox(verts, x, y, z, s, c, alpha, yaw = 0) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const tf = (X, Y, Z) => [x + cs * X + sn * Z, y + Y, z + -sn * X + cs * Z];
    const h = s, w = s;
    const quads = [
      [[-w, h, -w], [w, h, -w], [w, h, w], [-w, h, w], 1],
      [[-w, -h, w], [w, -h, w], [w, -h, -w], [-w, -h, -w], .6],
      [[-w, -h, -w], [w, -h, -w], [w, h, -w], [-w, h, -w], .85],
      [[w, -h, w], [-w, -h, w], [-w, h, w], [w, h, w], .85],
      [[w, -h, -w], [w, -h, w], [w, h, w], [w, h, -w], .7],
      [[-w, -h, w], [-w, -h, -w], [-w, h, -w], [-w, h, w], .7],
    ];
    for (const q of quads) {
      const P = [tf(q[0][0], q[0][1], q[0][2]), tf(q[1][0], q[1][1], q[1][2]), tf(q[2][0], q[2][1], q[2][2]), tf(q[3][0], q[3][1], q[3][2])];
      const sh = q[4];
      for (const i of [0, 1, 2, 2, 3, 0]) verts.push(P[i][0], P[i][1], P[i][2], c[0] * sh, c[1] * sh, c[2] * sh, 1);
    }
  }

  drawTinyBox(verts, alpha, c, scale = .18) {
    this.emitTinyBox(verts, this.rx, this.ry + scale, this.rz, scale, c, alpha);
  }

  drawTNT(verts, alpha) {
    const flash = Math.floor(this.age / 5) % 2 === 0;
    const c = flash ? [1, 1, 1] : [.7, .18, .15];
    this.emitTinyBox(verts, this.rx, this.ry + .49, this.rz, .49, c, alpha);
  }

  drawFalling(verts, alpha) {
    const pal = TEX.particleColor(this.blockId);
    const c = pal[(Math.random() * pal.length) | 0];
    this.emitTinyBox(verts, this.rx, this.ry + .49, this.rz, .49, c, alpha);
  }

  drawCrystal(verts, alpha) {
    const t = this.age * .04;
    const bob = Math.sin(t) * .15;
    const c = [1, .95, .8];
    this.emitTinyBox(verts, this.rx, this.ry + 1.6 + bob, this.rz, .45, c, alpha * (.8 + Math.sin(t * 2) * .2));
  }
}

const WOOL_RGB = {
  white: [.91, .93, .93], orange: [.94, .46, .08], magenta: [.74, .27, .7], light_blue: [.23, .69, .85],
  yellow: [.97, .77, .15], lime: [.44, .73, .1], pink: [.93, .55, .67], gray: [.24, .27, .28],
  light_gray: [.56, .56, .53], cyan: [.08, .54, .57], purple: [.47, .16, .67], blue: [.21, .22, .62],
  brown: [.45, .28, .16], green: [.33, .43, .11], red: [.63, .15, .13], black: [.08, .08, .1],
};

// ---------- natural spawning ----------
// Villager.java restock(): every offer's uses reset — MC restocks 2× per day
// (morning + afternoon at the workstation); we key it off the world clock
function villagerRestock(v) {
  const t = Math.floor(G.world.time % DAY_TICKS);
  const day = Math.floor(G.world.time / DAY_TICKS);
  const key = day * 2 + (t < DAY_TICKS / 2 ? 0 : 1);
  if (v._restockKey !== key) {
    const first = v._restockKey === undefined;
    v._restockKey = key;
    if (!first && v.offers) for (const o of v.offers) o.uses = 0; // MerchantOffer.resetUses()
  }
}

const SpawnSystem = {
  timer: 0,
  tick() {
    if (--this.timer > 0) return;
    this.timer = 20;
    const p = G.player;
    if (!p) return;
    let hostiles = 0, passives = 0;
    for (const e of G.entities) {
      if (e.dead || !e.def) continue;
      if (e.def.hostile && !e.def.dragon) hostiles++;
      else if (e.def.passive) passives++;
    }
    const isNight = !isDaytime();
    // MC: peaceful difficulty spawns NO hostile mobs and existing ones
    // despawn instantly (that was a game-mode check before — a dead branch,
    // since 'peaceful' is a difficulty, not a game mode)
    if (G.difficulty === 'peaceful') {
      for (const e of G.entities) {
        if (!e.dead && e.def && e.def.hostile && !e.def.noDespawn) e.dead = true;
      }
    }
    // hostile spawn attempts — MC spreads spawns out (packs over time, most
    // attempts fail on light/space): 2 attempts per second-cycle, caps scaled
    // by difficulty so Easy never floods the night
    const hostileCap = isNight ? (G.difficulty === 'easy' ? 8 : G.difficulty === 'hard' ? 16 : 12) : 4;
    if (G.difficulty !== 'peaceful' && hostiles < hostileCap && G.dimension === 0) {
      for (let i = 0; i < 2; i++) this.trySpawn(p, true);
    }
    if (G.dimension === 1) {
      if (G.difficulty !== 'peaceful' && hostiles < 6) for (let i = 0; i < 2; i++) this.trySpawnNether(p);
    }
    if (passives < 12 && G.dimension === 0) this.trySpawn(p, false);
    // despawn far mobs
    for (const e of G.entities) {
      if (e.dead || !e.def.model || e.def.dragon || e.def.noDespawn) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d > 110 && (e.def.hostile || e.type === 'ghast')) e.dead = true;
      else if (d > 140) e.dead = true;
    }
  },
  findGround(x, z, minY, maxY) {
    for (let y = maxY; y > minY; y--) {
      const id = G.world.getBlock(Math.floor(x), y, Math.floor(z));
      if (id > 0 && BLOCKS[id].solid) return y + 1;
    }
    return -1;
  },
  trySpawn(p, hostile) {
    const ang = rand() * Math.PI * 2;
    const dist = 24 + rand() * 30;
    const x = Math.floor(p.x + Math.cos(ang) * dist);
    const z = Math.floor(p.z + Math.sin(ang) * dist);
    const y = this.findGround(x, z, 8, WORLD_H - 2);
    if (y < 0) return;
    const ground = G.world.getBlock(x, y - 1, z);
    if (ground <= 0 || !BLOCKS[ground].solid) return;
    const sky = G.world.skyLight(x, y, z);
    const blk = G.world.blockLight(x, y, z);
    if (hostile) {
      if (Math.max(sky * (isDaytime() ? 1 : 0), blk) > 7) return;
      const types = ['zombie', 'zombie', 'skeleton', 'creeper', 'spider'];
      if (rand() < .04) types.push('enderman');
      const type = types[(rand() * types.length) | 0];
      // space check
      const d = MOB_DEFS[type];
      if (G.world.getBlock(x, y + Math.ceil(d.h) - 1, z) !== 0) return;
      spawnEntity(type, x + .5, y, z + .5);
    } else {
      if (sky < 9) return;
      if (ground !== B.grass_block && ground !== B.podzol) return;
      const types = ['pig', 'cow', 'sheep', 'chicken'];
      const type = types[(rand() * types.length) | 0];
      const n = randInt(2, 4);
      for (let i = 0; i < n; i++) spawnEntity(type, x + .5 + (rand() - .5) * 3, y + 1, z + .5 + (rand() - .5) * 3);
    }
  },
  trySpawnNether(p) {
    const ang = rand() * Math.PI * 2;
    const dist = 24 + rand() * 30;
    const x = Math.floor(p.x + Math.cos(ang) * dist);
    const z = Math.floor(p.z + Math.sin(ang) * dist);
    for (let y = 36; y < 100; y++) {
      if (G.world.getBlock(x, y, z) === 0 && G.world.getBlock(x, y + 4, z) === 0 && G.world.getBlock(x, y - 1, z) === B.netherrack) {
        spawnEntity(rand() < .3 ? 'ghast' : 'zombie', x + .5, y, z + .5);
        return;
      }
    }
  },
};

// gravity blocks: monkey-patch neighbor update to trigger falling sand/gravel
const _origWorldUpdateNeighbors = World_updateNeighbors;
World_updateNeighbors = function (wx, wy, wz, world) {
  _origWorldUpdateNeighbors(wx, wy, wz, world);
  // check block above the changed position for gravity blocks
  for (let y = wy + 1; y < WORLD_H; y++) {
    const id = world.getBlock(wx, y, wz);
    if (id <= 0) break;
    const bl = BLOCKS[id];
    if (bl.gravity) {
      const below = world.getBlock(wx, y - 1, wz);
      if (below === 0 || !BLOCKS[below].solid) {
        world.setBlock(wx, y, wz, 0, 0, { noUpdate: true, noNet: false });
        const e = new Entity('falling', wx + .5, y, wz + .5, MOB_DEFS.falling, {});
        e.blockId = id;
        G.entities.push(e);
      } else break;
    } else if (id > 0 && BLOCKS[id].solid) break;
  }
  // the changed block itself
  const id = world.getBlock(wx, wy, wz);
  if (id > 0 && BLOCKS[id].gravity) {
    const below = world.getBlock(wx, wy - 1, wz);
    if (below === 0 || !BLOCKS[below].solid) {
      world.setBlock(wx, wy, wz, 0, 0, { noUpdate: true });
      const e = new Entity('falling', wx + .5, wy, wz + .5, MOB_DEFS.falling, {});
      e.blockId = id;
      G.entities.push(e);
    }
  }
};

function isDaytime() {
  const t = ((G.world.time % DAY_TICKS) + DAY_TICKS) % DAY_TICKS;
  return t < 12500 && t > 1500;
}
function dayBrightness() {
  const t = ((G.world.time % DAY_TICKS) + DAY_TICKS) % DAY_TICKS;
  return clamp(Math.sin(t / DAY_TICKS * Math.PI * 2) * 1.4 + 0.6, 0.06, 1);
}
