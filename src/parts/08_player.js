// ============================================================================
// Part 08: Player — physics, input, interaction, survival stats
// ============================================================================
const KEYS = {};
const MOUSE = { left: false, right: false, dx: 0, dy: 0, wheel: 0 };

class Player {
  constructor(world, spawn) {
    this.world = world;
    this.x = spawn[0]; this.y = spawn[1]; this.z = spawn[2];
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = 0;
    this.onGround = false;
    this.w = 0.6; this.h = 1.8; this.eye = 1.62;
    this.gameMode = G.gameMode;
    this.flying = this.gameMode === 'creative' || this.gameMode === 'spectator';
    this.sneaking = false; this.sprinting = false;
    this.swingT = 0; this.prevSwingT = 0; this.swingTicks = 0; this.isSwinging = false;
    this.equipT = 0; this.bobPhase = 0; this.bobAmp = 0;
    this.walkDistO = 0; this.walkDist = 0; this.bobO = 0; this.bob = 0;
    this.breakProgress = 0; this.breakTarget = null; this.destroyTicks = 0;
    this.placeCooldown = 0; this.attackCooldown = 0; this.breakCooldownTick = 0;
    this.lastWTap = 0;
    this.health = 20; this.maxHealth = 20;
    this.absorption = 0;
    this.hunger = 20; this.saturation = 5; this.exhaustion = 0;
    this.air = 300; this.onFire = 0;
    this.xp = 0; this.xpLevel = 0; this.xpProgress = 0;
    this.armorVal = 0;
    this.dead = false;
    this.fallDistance = 0;
    this.eatTicks = 0; this.eating = false;
    this.bowCharge = 0; this.bowing = false;
    this.spawnPoint = [spawn[0], spawn[1], spawn[2]];
    this.lastSpaceTap = 0;
    this.spawnGrace = 100;
    this.climbBoost = 0;
    this.sprintToggled = false;
    this.effects = {};     // name -> { dur }
    this.riding = null;
    this.inWater = false; this.headInWater = false; this.inLava = false; this.onLadder = false;
    this.stepSoundDist = 0;
    this.hurtTime = 0; this.deathTime = 0;
    // inventory: 0-8 hotbar, 9-35 main, 36-39 armor (helmet..boots), 40 offhand
    this.slots = new Array(41).fill(null);
    this.held = 0;
    this.openContainer = null;
    this.reach = this.gameMode === 'creative' ? 5.0 : 4.5;
  }

  getHeldItem() { return this.slots[this.held]; }
  aabbBlocksSolidAt(x, y, z) {
    const id = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    if (id < 0) return true; // ungenerated = solid (prevents falling into void)
    return BLOCKS[id].solid;
  }

  collides(px, py, pz) {
    const hw = this.w / 2;
    const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw);
    const y0 = Math.floor(py), y1 = Math.floor(py + this.h - 0.001);
    const z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const id = this.world.getBlock(x, y, z);
      if (id < 0) return true;
      if (id === 0) continue;
      const bl = BLOCKS[id];
      if (!bl.solid) continue;
      if (bl.shape === 'door') {
        const m = this.world.getMeta(x, y, z);
        if (m & 4) continue; // open door not solid
      }
      if (bl.shape === 'snow') continue;
      return true;
    }
    return false;
  }

  move(dx, dy, dz) {
    // axis-separated collision; horizontal velocity is PRESERVED on wall hits
    // (MC-style momentum: you keep your swing and clear the ledge on the way up)
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) * 2);
    const sx = dx / steps, sy = dy / steps, sz = dz / steps;
    let hitX = false, hitY = false, hitZ = false;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0) {
        if (!this.collides(this.x + sx, this.y, this.z)) this.x += sx;
        else hitX = true;
      }
      if (sy !== 0) {
        if (!this.collides(this.x, this.y + sy, this.z)) this.y += sy;
        else {
          hitY = true;
          if (sy < 0) this.onGround = true;
          this.vy = 0;
        }
      }
      if (sz !== 0) {
        if (!this.collides(this.x, this.y, this.z + sz)) this.z += sz;
        else hitZ = true;
      }
    }
    return { hitX, hitY, hitZ };
  }

  tick() {
    if (this.dead) { this.deathTime++; return; }
    const w = this.world;
    this.tickEnvironmental();
    // flying is ONLY legal in creative/spectator — kill stale/corrupt flying state
    if (this.flying && this.gameMode !== 'creative' && this.gameMode !== 'spectator') {
      this.flying = false;
      this.vy = 0;
    }
    if (this.riding) { this.tickRiding(); return; }
    if (this.gameMode === 'spectator') { this.tickSpectator(); return; }
    this.tickEffects();

    // input direction
    let ix = 0, iz = 0;
    if (KEYS['KeyW']) iz += 1;
    if (KEYS['KeyS']) iz -= 1;
    if (KEYS['KeyA']) ix -= 1;
    if (KEYS['KeyD']) ix += 1;
    const len = Math.hypot(ix, iz) || 1; ix /= len; iz /= len;
    this.sneaking = !!(KEYS['ShiftLeft'] || KEYS['ShiftRight']) && !this.flying;
    if (iz <= 0) this.sprintToggled = false; // sprint ends when you stop moving forward
    const wantSprint = this.sprintToggled && iz > 0 && !this.sneaking && this.hunger > 6;
    this.sprinting = wantSprint;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const fx = -sin, fz = -cos, rx = cos, rz = -sin;
    let dx = fx * iz + rx * ix, dz = fz * iz + rz * ix;

    // environment states
    const feetBlock = w.getBlock(Math.floor(this.x), Math.floor(this.y + 0.2), Math.floor(this.z));
    this.inWater = feetBlock === B.water || w.getBlock(Math.floor(this.x), Math.floor(this.y + 1), Math.floor(this.z)) === B.water;
    this.headInWater = w.getBlock(Math.floor(this.x), Math.floor(this.y + this.eye), Math.floor(this.z)) === B.water;
    this.inLava = feetBlock === B.lava;
    if (this.inLava && !this.effects.fire_res) this.lavaHarm = true; else this.lavaHarm = false;
    this.onLadder = false;
    {
      const hw = this.w / 2 + 0.1;
      outer: for (let y = Math.floor(this.y); y <= Math.floor(this.y + this.h); y++)
        for (const [ox, oz] of [[hw, 0], [-hw, 0], [0, hw], [0, -hw]]) {
          const id = w.getBlock(Math.floor(this.x + ox), y, Math.floor(this.z + oz));
          if (id === B.ladder) { this.onLadder = true; break outer; }
        }
    }
    const onSoulSand = feetBlock === B.soul_sand;
    const inCobweb = w.getBlock(Math.floor(this.x), Math.floor(this.y + 0.5), Math.floor(this.z)) === B.cobweb;

    // 1:1 LivingEntity.java movement physics (travelInAir / getFrictionInfluencedSpeed)
    this.walkDistO = this.walkDist;
    this.bobO = this.bob;
    this.prevSwingT = this.swingT;

    const groundBlockId = this.onGround
      ? w.getBlock(Math.floor(this.x), Math.floor(this.y - 0.500001), Math.floor(this.z))
      : 0;
    const blockFriction = (this.onGround && groundBlockId > 0)
      ? (BLOCKS[groundBlockId].friction || 0.6)
      : 1.0;

    // Base attribute movementSpeed = 0.1 (4.317 m/s on normal 0.6 friction blocks)
    let baseSpeed = 0.1;
    if (this.effects.speed) baseSpeed *= 1 + 0.2 * (this.effects.speed.lvl || 1);
    if (this.sprinting) baseSpeed *= 1.3; // SPRINTING_MODIFIER +30% (5.612 m/s)
    if (this.sneaking) baseSpeed *= 0.3;  // Sneak factor 0.3 (1.295 m/s)
    if (onSoulSand) baseSpeed *= 0.4;

    if (this.flying) {
      const flyAccel = this.sprinting ? 0.09 : 0.05;
      this.vx = (this.vx + dx * flyAccel) * 0.91;
      this.vz = (this.vz + dz * flyAccel) * 0.91;
    } else if (this.inWater || this.inLava) {
      const fluidAccel = 0.02;
      this.vx += dx * fluidAccel;
      this.vz += dz * fluidAccel;
    } else {
      // getFrictionInfluencedSpeed(blockFriction) from LivingEntity.java line 2721:
      // onGround: speed * (0.21600002 / blockFriction^3); air: sprinting ? 0.026 : 0.02
      const moveInputSpeed = this.onGround
        ? baseSpeed * (0.21600002 / (blockFriction * blockFriction * blockFriction))
        : (this.sprinting ? 0.026 : 0.02);
      this.vx += dx * moveInputSpeed;
      this.vz += dz * moveInputSpeed;
    }

    // vertical & jump (before or integrated with move)
    if (this.flying) {
      let fy = 0;
      if (KEYS['Space']) fy += 1;
      if (KEYS['ShiftLeft'] || KEYS['ShiftRight']) fy -= 1;
      this.vy = (this.vy + fy * 0.15) * 0.6;
      this.fallDistance = 0;
    } else if (this.inWater) {
      if (!this.wasInWater) { this.vy *= 0.35; this.fallDistance = 0; }
      if (KEYS['Space']) {
        if (this.onGround) this.vy = 0.42;
        else if (this.headInWater) this.vy = Math.min(this.vy + 0.04, 0.14);
        else this.vy = Math.min(this.vy + 0.04, 0.06);
      }
      this.fallDistance = 0;
    } else if (this.inLava) {
      if (KEYS['Space']) this.vy += 0.04;
      this.fallDistance = 0;
    } else if (this.onLadder) {
      // handleOnClimbable (LivingEntity.java line 2704): clamp horizontal to [-0.15, 0.15], yd >= -0.15
      this.vx = clamp(this.vx, -0.15, 0.15);
      this.vz = clamp(this.vz, -0.15, 0.15);
      this.vy = Math.max(this.vy, -0.15);
      if (KEYS['Space'] || (iz > 0 && Math.hypot(dx, dz) > 0.01)) this.vy = 0.2;
      if (this.sneaking) this.vy = 0;
      this.fallDistance = 0;
    } else if (inCobweb) {
      this.vx *= 0.25; this.vy = -0.05; this.vz *= 0.25;
      this.fallDistance = 0;
    } else {
      if (KEYS['Space'] && this.onGround && this.hunger > 0) {
        this.vy = 0.42; // BASE_JUMP_POWER = 0.42f
        if (this.sprinting) {
          this.vx += fx * 0.2;
          this.vz += fz * 0.2;
        }
        this.addExhaustion(this.sprinting ? 0.2 : 0.05);
        this.onGround = false;
      }
    }

    // MC-style sneak edge protection: clamp horizontal movement BEFORE it is applied
    const wasOnGround = this.onGround;
    if (this.sneaking && wasOnGround && !this.flying && !this.inWater) {
      if (this.vx !== 0 && !this.groundBelowBox(this.x + this.vx, this.y, this.z)) this.vx = 0;
      if (this.vz !== 0 && !this.groundBelowBox(this.x, this.y, this.z + this.vz)) this.vz = 0;
    }
    const prevX = this.x, prevZ = this.z;
    this.onGround = false;
    const hit = this.move(this.vx, this.vy, this.vz) || {};
    if ((hit.hitX || hit.hitZ) && this.onLadder) {
      this.vy = 0.2;
    }
    if (hit.hitX) this.vx = 0;
    if (hit.hitZ) this.vz = 0;
    if ((hit.hitX || hit.hitZ) && this.sprinting) {
      this.sprinting = false;
      this.sprintToggled = false;
    }
    this.wasInWater = this.inWater;
    if (this.inWater && !this.headInWater && KEYS['Space'] && (hit.hitX || hit.hitZ)) {
      this.vy = 0.42;
    }

    // Post-move gravity & drag (LivingEntity.java lines 2482-2497 & 2541):
    if (!this.flying) {
      if (this.inWater) {
        const waterDrag = this.sprinting ? 0.9 : 0.8;
        this.vx *= waterDrag;
        this.vy = (this.vy - 0.02) * 0.8;
        this.vz *= waterDrag;
      } else if (this.inLava) {
        this.vx *= 0.5;
        this.vy = (this.vy - 0.02) * 0.8;
        this.vz *= 0.5;
      } else if (!inCobweb) {
        this.vy -= 0.08; // DEFAULT_BASE_GRAVITY = 0.08d
        this.vy *= 0.98; // BASE_VERTICAL_AIR_DRAG = 0.98f
        const horizFriction = blockFriction * 0.91; // BASE_HORIZONTAL_AIR_DRAG = 0.91f (0.546 on normal blocks)
        this.vx *= horizFriction;
        this.vz *= horizFriction;
      }
    }
    // MIN_MOVEMENT_DISTANCE = 0.003d
    if (Math.abs(this.vx) < 0.003) this.vx = 0;
    if (Math.abs(this.vy) < 0.003) this.vy = 0;
    if (Math.abs(this.vz) < 0.003) this.vz = 0;

    // fall damage (with spawn grace period)
    if (!this.onGround && this.vy < 0 && !this.flying && !this.inWater && !this.onLadder) {
      if (this.spawnGrace > 0) { this.fallDistance = 0; }
      else this.fallDistance += -this.vy;
    }
    if (this.onGround) {
      if (this.fallDistance > 3.2 && this.gameMode !== 'creative' && !this.inWater && this.spawnGrace <= 0) {
        const dmg = Math.floor(this.fallDistance - 3);
        if (dmg > 0) this.damage(dmg, 'fall');
      }
      this.fallDistance = 0;
    }
    if (this.spawnGrace > 0) this.spawnGrace--;

    // 1:1 Step sounds, walkDist & GameRenderer.bobView state
    const movedH = Math.hypot(this.x - prevX, this.z - prevZ);
    this.walkDist += movedH * 0.6;
    if (this.onGround && !this.dead) {
      const targetBob = Math.min(0.1, movedH * 0.45);
      this.bob += (targetBob - this.bob) * 0.4;
      this.bobAmp = lerp(this.bobAmp, Math.min(1, movedH / 0.215), 0.35);
      this.bobPhase = this.walkDist * Math.PI;
      if (movedH > 0.005) {
        this.stepSoundDist += movedH * 0.6;
        G.stats.walked += movedH;
        this.addExhaustion(this.sprinting ? movedH * 0.1 : 0);
        if (this.stepSoundDist > 1.0) {
          this.stepSoundDist -= 1.0;
          const gid = w.getBlock(Math.floor(this.x), Math.floor(this.y - 0.3), Math.floor(this.z));
          if (gid > 0) SFX.playStep(BLOCKS[gid].material);
        }
      }
    } else {
      this.bob += (0 - this.bob) * 0.4;
      this.bobAmp = lerp(this.bobAmp, 0, 0.3);
    }

    // 1:1 6-tick arm swing animation (LivingEntity.updateSwingTime)
    if (this.isSwinging) {
      this.swingTicks++;
      if (this.swingTicks >= 6) {
        this.swingTicks = 0;
        this.isSwinging = false;
        this.swingT = 0;
      } else {
        this.swingT = 1 - this.swingTicks / 6;
      }
    } else {
      this.swingT = 0;
    }

    // survival ticking
    if (this.gameMode === 'survival' || this.gameMode === 'hardcore') this.tickHunger();
    this.tickAir();
    if (this.onFire > 0) {
      this.onFire--;
      if (this.onFire % 20 === 0) this.damage(1, 'fire');
      if (this.headInWater || this.inWater) this.onFire = 0;
    }
    if (this.inLava && this.lavaHarm) { this.damage(4, 'lava'); this.onFire = 300; }
    if (this.y < -10) this.damage(6, 'void');
    if (this.hurtTime > 0) this.hurtTime--;
    if (this.attackCooldown > 0) this.attackCooldown -= DT;
    if (this.placeCooldown > 0) this.placeCooldown -= DT;
    if (this.equipT > 0) this.equipT = Math.max(0, this.equipT - DT * 4);

    // cactus contact damage
    {
      const hw = this.w / 2 + 0.05;
      for (const [ox, oz] of [[hw, 0], [-hw, 0], [0, hw], [0, -hw], [0, 0]]) {
        const id = w.getBlock(Math.floor(this.x + ox), Math.floor(this.y + 0.5), Math.floor(this.z + oz));
        if (id === B.cactus) { this.damage(1, 'cactus'); break; }
        const id2 = w.getBlock(Math.floor(this.x + ox), Math.floor(this.y + 1.2), Math.floor(this.z + oz));
        if (id2 === B.cactus) { this.damage(1, 'cactus'); break; }
      }
    }

    // interaction: breaking & using
    this.updateTarget();
    this.tickBreaking();
    this.tickUse();
  }

  // ---------- status effects ----------
  applyEffect(name, dur, lvl) {
    this.effects[name] = { dur: dur || 600, lvl: lvl || 1 };
    UI.refreshEffects && UI.refreshEffects();
  }
  tickEffects() {
    for (const [name, eff] of Object.entries(this.effects)) {
      eff.dur--;
      if (eff.dur <= 0) { delete this.effects[name]; continue; }
      if (name === 'regen' && this.health < this.maxHealth && G.stats.playedTicks % 50 === 0) {
        this.health = Math.min(this.maxHealth, this.health + 1);
        spawnHeartParticles(this.x, this.y + 1.8, this.z);
      }
      if (name === 'poison' && G.stats.playedTicks % 25 === 0 && this.health > 1) {
        this.health -= 1;
        this.hurtTime = 8;
        SFX.playHurt();
      }
    }
    if (this.effects.fire_res && this.onFire) this.onFire = 0;
    if (this.effects.water_breathing && this.air < 300) this.air = 300;
  }
  tickRiding() {
    const e = this.riding;
    if (!e || e.dead) { this.riding = null; return; }
    let ix = 0, iz = 0;
    if (KEYS['KeyW']) iz += 1;
    if (KEYS['KeyS']) iz -= 1;
    if (KEYS['KeyA']) ix -= 1;
    if (KEYS['KeyD']) ix += 1;
    if (KEYS['ShiftLeft']) { // dismount
      this.riding = null;
      e.rider = null;
      this.y = e.y + e.h + 0.1;
      this.vx = this.vy = this.vz = 0;
      return;
    }
    if (e.controls) e.controls(ix, iz, !!KEYS['Space']);
    this.x = e.x; this.y = e.y + (e.rideOffset !== undefined ? e.rideOffset : 0.3); this.z = e.z;
    this.px = this.x; this.py = this.y; this.pz = this.z;
    this.vx = e.vx; this.vy = e.vy; this.vz = e.vz;
  }

  tickSpectator() {
    let fy = 0;
    if (KEYS['Space']) fy += 1;
    if (KEYS['ShiftLeft']) fy -= 1;
    const speed = KEYS['ControlLeft'] ? 0.8 : 0.3;
    let ix = 0, iz = 0;
    if (KEYS['KeyW']) iz += 1;
    if (KEYS['KeyS']) iz -= 1;
    if (KEYS['KeyA']) ix -= 1;
    if (KEYS['KeyD']) ix += 1;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const fx = -sin, fz = -cos, rx = cos, rz = -sin;
    const tvx = (fx * iz + rx * ix) * speed, tvz = (fz * iz + rz * ix) * speed, tvy = fy * speed;
    this.vx += (tvx - this.vx) * 0.4; this.vy += (tvy - this.vy) * 0.4; this.vz += (tvz - this.vz) * 0.4;
    this.x += this.vx; this.y += this.vy; this.z += this.vz;
  }

  // true if any solid block sits directly under the player's AABB corners
  groundBelowBox(px, py, pz) {
    const hw = this.w / 2;
    const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw);
    const z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw);
    const by = Math.floor(py - 0.35);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const id = this.world.getBlock(x, by, z);
      if (id > 0 && BLOCKS[id].solid) return true;
    }
    return false;
  }

  hasSupport() {
    const hw = this.w / 2;
    for (const [ox, oz] of [[hw, hw], [-hw, hw], [hw, -hw], [-hw, -hw]]) {
      if (this.aabbBlocksSolidAt(this.x + ox, this.y - 0.35, this.z + oz)) return true;
    }
    return false;
  }

  tickEnvironmental() {
    // portal teleport check
    const body = this.world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.5), Math.floor(this.z));
    if (body === B.nether_portal) {
      this.portalTime = (this.portalTime || 0) + 1;
      $('portal-overlay').style.opacity = '0.8';
      if (this.portalTime > 60 || this.gameMode === 'creative') {
        this.portalTime = 0;
        TeleportDimension(G.dimension === 1 ? 0 : 1, this.x, this.z);
      }
    } else { this.portalTime = 0; $('portal-overlay').style.opacity = '0'; }
  }

  tickHunger() {
    // MC peaceful difficulty: hunger never drains and health regenerates
    // fast (1 HP per 0.5 s) — the food bar stays full
    if (G.difficulty === 'peaceful') {
      this.hunger = 20; this.saturation = Math.max(this.saturation, 5);
      if (this.health < this.maxHealth && this.hurtTime <= 0) {
        this.peaceRegen = (this.peaceRegen || 0) + 1;
        if (this.peaceRegen >= 10) { this.peaceRegen = 0; this.health = Math.min(this.maxHealth, this.health + 1); }
      }
      return;
    }
    if (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.hunger = Math.max(0, this.hunger - 1);
    }
    // regen
    if (this.health < this.maxHealth && this.hunger >= 18 && this.hurtTime <= 0) {
      this.regenTimer = (this.regenTimer || 0) + 1;
      if (this.regenTimer >= 80) { this.regenTimer = 0; this.health = Math.min(this.maxHealth, this.health + 1); this.addExhaustion(6.0); } // FoodData.java: 1:1
    }
    // starvation
    if (this.hunger <= 0) {
      this.starveTimer = (this.starveTimer || 0) + 1;
      if (this.starveTimer >= 80) {
        this.starveTimer = 0;
        const min = G.gameMode === 'hardcore' ? 0 : 1;
        if (this.health > min) this.damage(1, 'starve');
      }
    }
  }

  tickAir() {
    if (this.headInWater && this.gameMode !== 'creative' && !this.effects.water_breathing) {
      this.air--;
      if (this.air <= 0 && this.air % 20 === 0) this.damage(2, 'drown');
      if (this.air < -200) this.air = -200;
    } else this.air = Math.min(300, this.air + 4);
  }

  addExhaustion(v) { if (this.gameMode === 'survival' || this.gameMode === 'hardcore') this.exhaustion += v; }

  updateTarget() {
    const t = raycast(this.world, this.x, this.y + this.eye, this.z, this.yaw, this.pitch, this.reach);
    this.targetBlock = t ? t.block : null;
    this.targetFace = t ? t.face : null;
    this.targetHitY = t ? t.hitY : 0.5;
    this.targetEntity = null;
    // entity hit: ray vs entity AABBs closer than block
    if (G.entities) {
      const dir = fwdFromYawPitch(this.yaw, this.pitch, [0, 0, 0]);
      let best = null, bestT = t ? t.dist : this.reach;
      for (const e of G.entities) {
        if (!e.hittable || e.dead) continue;
        const hit = rayAABB(this.x, this.y + this.eye, this.z, dir, e);
        if (hit !== null && hit < bestT) { bestT = hit; best = e; }
      }
      if (best && bestT < (t ? t.dist : this.reach)) { this.targetEntity = best; this.targetBlock = null; this.targetFace = null; }
    }
  }

  triggerSwing() {
    if (!this.isSwinging || this.swingTicks >= 3) {
      this.swingTicks = 0;
      this.isSwinging = true;
      this.prevSwingT = 1;
      this.swingT = 1;
    }
  }

  // 1:1 Port of MultiPlayerGameMode.continueDestroyBlock & BlockBehaviour.getDestroyProgress
  tickBreaking() {
    if (G.state !== 'playing' || this.dead) { this.resetBreaking(); return; }
    if (!MOUSE.left || this.targetBlock === null || this.openContainer) {
      this.resetBreaking();
      this.breakCooldownTick = 0;
      return;
    }
    if (this.targetEntity) { this.resetBreaking(); return; }
    if (this.breakCooldownTick > 0) {
      this.breakCooldownTick--;
      this.triggerSwing();
      return;
    }
    const [bx, by, bz] = this.targetBlock;
    const id = this.world.getBlock(bx, by, bz);
    if (id <= 0) { this.resetBreaking(); return; }
    const bl = BLOCKS[id];
    if (bl.hardness < 0 && this.gameMode !== 'creative') { this.resetBreaking(); return; }

    this.triggerSwing();

    if (this.gameMode === 'creative') {
      this.finishBreak(bx, by, bz, id, true);
      this.breakCooldownTick = 5; // destroyDelay = 5 ticks in MultiPlayerGameMode.java
      return;
    }

    // Instant break for hardness === 0 blocks (tall grass, flowers, torches, redstone dust, crops)
    if (bl.hardness === 0) {
      this.finishBreak(bx, by, bz, id, false);
      this.resetBreaking();
      return;
    }

    const tKey = bx + ',' + by + ',' + bz;
    if (this.breakTarget !== tKey) {
      this.breakTarget = tKey;
      this.breakProgress = 0;
      this.destroyTicks = 0;
    }

    // Compute player.getDestroySpeed(state) (Player.java & ToolMaterial.java)
    const item = this.getHeldItem();
    const def = item ? ITEMS[item.id] : null;
    const tool = def ? def.tool : null;
    let speed = 1.0;
    if (tool) {
      if (bl.tool && tool.type === bl.tool) {
        speed = tool.speed;
      } else if (tool.type === 'shears') {
        if (bl.key === 'cobweb' || bl.key.endsWith('_leaves')) speed = 15.0;
        else if (bl.key.endsWith('_wool')) speed = 5.0;
        else if (bl.material === 'plant') speed = 2.0;
      } else if (tool.type === 'sword') {
        if (bl.key === 'cobweb') speed = 15.0;
        else if (bl.material === 'plant' || bl.key.endsWith('_leaves') || bl.key === 'pumpkin' || bl.key === 'melon') speed = 1.5;
      }
    }
    if (speed > 1.0 && item && item.ench && item.ench.efficiency) {
      const eff = item.ench.efficiency;
      speed += eff * eff + 1;
    }
    if (this.effects.haste) speed *= 1 + 0.2 * (this.effects.haste.lvl || 1);
    if (this.effects.mining_fatigue) speed *= Math.pow(0.3, this.effects.mining_fatigue.lvl || 1);
    if (this.headInWater) speed *= 0.2;
    if (!this.onGround && !this.flying) speed *= 0.2;

    // BlockBehaviour.getDestroyProgress: modifier = hasCorrectToolForDrops ? 30 : 100
    const canH = canHarvest(id, tool);
    const divisor = canH ? 30.0 : 100.0;
    const progressDelta = speed / bl.hardness / divisor;
    this.breakProgress += progressDelta;

    // ClientLevel.addBreakingBlockEffect: spawn directional chipping particle on the hit face every tick
    spawnBlockCrackParticle(bx, by, bz, id, this.targetFaceDir());

    // MultiPlayerGameMode.java line 248: play hit sound every 4 ticks
    if (this.destroyTicks % 4 === 0) {
      SFX.playDig(bl.material);
    }
    this.destroyTicks++;

    if (this.breakProgress >= 1.0) {
      this.finishBreak(bx, by, bz, id, false);
      this.resetBreaking();
      this.breakCooldownTick = 5; // destroyDelay = 5 ticks (0.25s)
    }
  }

  resetBreaking() { this.breakProgress = 0; this.breakTarget = null; this.destroyTicks = 0; }

  finishBreak(bx, by, bz, id, creative) {
    const bl = BLOCKS[id];
    const w = this.world;
    // special cases
    if (bl.bed) { // remove both halves
      const m = w.getMeta(bx, by, bz);
      const dir = m & 3;
      const headBit = m & 4;
      const off = [[0, 1], [-1, 0], [0, -1], [1, 0]][dir];
      const other = [bx + (headBit ? off[0] : -off[0]), by, bz + (headBit ? off[1] : -off[1])];
      w.setBlock(bx, by, bz, 0);
      if (w.getBlock(...other) === id) w.setBlock(...other, 0);
      if (!creative) dropItem(bx + .5, by + .3, bz + .5, bl.key === 'red_bed' ? 'red_bed_item' : 'bed_item', 1);
      SFX.playBreak(bl.material);
      return;
    }
    if (bl.shape === 'door') {
      const m = w.getMeta(bx, by, bz);
      const other = [bx, (m & 8) ? by - 1 : by + 1, bz];
      w.setBlock(bx, by, bz, 0);
      if (w.getBlock(...other) === id) w.setBlock(...other, 0);
      if (!creative) {
        const key = bl.key.includes('spruce') ? 'spruce_door_item' : bl.key.includes('birch') ? 'birch_door_item' : 'oak_door_item';
        dropItem(bx + .5, by + .3, bz + .5, key, 1);
      }
      SFX.playBreak(bl.material);
      return;
    }
    w.setBlock(bx, by, bz, 0);
    G.stats.mined++;
    SFX.playBreak(bl.material);
    spawnBlockParticles(bx, by, bz, id, creative ? 4 : 14);
    this.addExhaustion(0.005);

    if (!creative) {
      const item = this.getHeldItem();
      const tool = item ? ITEMS[item.id].tool : null;
      const ench = item && item.ench || {};
      const fortune = ench.fortune || 0;
      const drops = resolveDrops(id, w.getMeta(bx, by, bz), tool, fortune);
      for (const [key, count] of drops) dropItem(bx + .5, by + .3, bz + .5, key, count);
      // container contents drop
      const tek = bx + ',' + by + ',' + bz;
      const te = G.tileEntities.get(tek);
      if (te) {
        if (te.items) for (const s of te.items) if (s) dropItem(bx + .5, by + .5, bz + .5, s.key, s.count);
        if (te.type === 'furnace') {
          for (const slot of ['input', 'fuel', 'output']) if (te[slot]) dropItem(bx + .5, by + .5, bz + .5, te[slot].key, te[slot].count);
        }
        G.tileEntities.delete(tek);
      }
      // XP from ores
      if (bl.oreXP && canHarvest(id, tool)) { const [mn, mx] = bl.oreXP; spawnXPOrbs(bx + .5, by + .5, bz + .5, randInt(mn, mx)); }
      // 1:1 ToolMaterial.java durability loss:
      // Mining a hardness > 0 block with a sword costs 2 durability; mining tools & shears cost 1 durability
      if (tool) {
        if (bl.hardness > 0) {
          this.damageTool(tool.type === 'sword' ? 2 : 1);
        } else if (tool.type === 'shears' && (bl.key.endsWith('_leaves') || bl.key === 'short_grass' || bl.key === 'fern')) {
          this.damageTool(1);
        }
      }
      // leaves decay support & ice water conversion
      if (bl.key === 'ice') w.setBlock(bx, by, bz, B.water);
    }
    if (bl.light > 0 || BLOCKS[0].light >= 0) { /* light auto-handled in setBlock */ }
    Advancements.onMine(id);
  }

  damageTool(amount) {
    if (this.gameMode === 'creative') return;
    const item = this.getHeldItem();
    if (!item) return;
    const def = ITEMS[item.id];
    if (!def || (!def.tool && !def.armor)) return;
    const maxUses = def.tool ? def.tool.uses : def.armor.uses;
    if (!maxUses) return;
    const unb = (item.ench && item.ench.unbreaking) || 0;
    let actualLoss = 0;
    for (let i = 0; i < amount; i++) {
      if (unb > 0 && chance(unb / (unb + 1))) continue;
      actualLoss++;
    }
    if (actualLoss <= 0) return;
    item.dur = (item.dur === undefined ? maxUses : item.dur) - actualLoss;
    if (item.dur <= 0) {
      this.slots[this.held] = null;
      SFX.playBreak('metal');
      const dir = fwdFromYawPitch(this.yaw, this.pitch, [0, 0, 0]);
      spawnParticles(this.x + dir[0] * 0.6, this.y + this.eye + dir[1] * 0.6, this.z + dir[2] * 0.6, 12, [0.55, 0.55, 0.55]);
    }
    UI.refreshHotbar();
  }

  tickUse() {
    if (G.state !== 'playing' || this.dead) return;
    // eating & drinking (food, potions, milk_bucket)
    const item = this.getHeldItem();
    if (this.eating && item && (ITEMS[item.id].food || ITEMS[item.id].potion || ITEMS[item.id].milk)) {
      this.eatTicks++;
      if (this.eatTicks % 4 === 0) SFX.playEat();
      if (this.eatTicks % 8 === 0) this.triggerSwing();
      if (this.eatTicks % 5 === 0) {
        const mx = this.x - Math.sin(this.yaw) * 0.5;
        const mz = this.z - Math.cos(this.yaw) * 0.5;
        spawnParticles(mx, this.y + 1.45, mz, 2, ITEMS[item.id].milk ? [0.95, 0.95, 0.98] : [0.72, 0.52, 0.3]);
      }
      if (this.eatTicks >= 32) {
        if (ITEMS[item.id].milk) {
          // 1:1 MilkBucketItem.java: clears all active status effects and returns empty bucket
          this.effects = {};
          UI.refreshEffects && UI.refreshEffects();
          if (this.gameMode !== 'creative') this.replaceHeld({ id: I.bucket, count: 1 });
          SFX.playBurp();
          this.eating = false; this.eatTicks = 0;
          return;
        }
        const f = ITEMS[item.id].food;
        if (f) {
          this.hunger = Math.min(20, this.hunger + f.food);
          this.saturation = Math.min(this.hunger, this.saturation + f.sat);
          if (f.bad && chance(0.6)) { this.exhaustion += 10; }
        }
        const pot = item.pot || ITEMS[item.id].potion;
        if (pot && pot.effect && pot.effect !== 'water' && pot.effect !== 'base') {
          if (pot.effect === 'healing') this.health = Math.min(this.maxHealth, this.health + 4 * (pot.lvl || 1));
          else this.applyEffect(pot.effect, pot.dur, pot.lvl);
          SFX.playLevelUp();
        }
        if (ITEMS[item.id].golden) { this.absorption = Math.min(10, this.absorption + 4); this.health = Math.min(this.maxHealth, this.health + 4); }
        // bottles & bowls come back empty
        if (ITEMS[item.id].potion) {
          if (this.gameMode !== 'creative') this.replaceHeld({ id: I.glass_bottle, count: 1 });
          else this.replaceHeld(null);
        }
        else if (ITEMS[item.id].key === 'mushroom_stew') {
          if (this.gameMode !== 'creative') this.replaceHeld({ id: I.bowl, count: 1 });
          else this.consumeHeld();
        }
        else this.consumeHeld();
        SFX.playBurp();
        this.eating = false; this.eatTicks = 0;
      }
      return;
    } else { this.eating = false; this.eatTicks = 0; }

    // bow charging
    if (this.bowing && item && ITEMS[item.id].bow) {
      this.bowCharge = Math.min(1, this.bowCharge + DT / 1.0);
      return;
    } else if (this.bowCharge > 0.1 && item && ITEMS[item.id].bow) {
      // release
      const hasArrow = this.gameMode === 'creative' || this.hasItem('arrow');
      if (hasArrow) {
        const arrow = spawnEntity('arrow', this.x, this.y + this.eye - .1, this.z, { owner: this });
        const dir = fwdFromYawPitch(this.yaw, this.pitch, [0, 0, 0]);
        const sp = 8 + this.bowCharge * 45;
        arrow.vx = dir[0] * sp; arrow.vy = dir[1] * sp; arrow.vz = dir[2] * sp;
        if (this.gameMode !== 'creative') this.consumeItem('arrow', 1);
        const it = ITEMS[item.id];
        this.damageTool(1);
        SFX.playBowShoot();
      }
      this.bowCharge = 0;
    } else this.bowCharge = 0;

    if (!MOUSE.right || this.placeCooldown > 0 || this.openContainer) return;
    this.placeCooldown = 0.22;
    this.useItem();
  }

  useItem() {
    const w = this.world;
    const item = this.getHeldItem();
    const def = item ? ITEMS[item.id] : null;

    // 0) villager trading (MC: right-click a villager opens the trade screen)
    if (this.targetEntity && !this.targetEntity.dead && this.targetEntity.type === 'villager') {
      UI.openTrading(this.targetEntity);
      return;
    }

    // 1) interactive block unless sneaking
    if (this.targetBlock && !this.sneaking) {
      const [bx, by, bz] = this.targetBlock;
      const id = w.getBlock(bx, by, bz);
      const bl = BLOCKS[id];
      if (bl.tileEntity === 'crafting') { UI.openCrafting(); return; }
      if (bl.tileEntity === 'furnace') { UI.openFurnace(bx, by, bz); return; }
      if (bl.tileEntity === 'chest') { UI.openChest(bx, by, bz); return; }
      if (bl.tileEntity === 'enchant') { UI.openEnchanting(bx, by, bz); return; }
      if (bl.tileEntity === 'sign') { UI.openSignEdit(bx, by, bz); return; }
      if (bl.tileEntity === 'brewing') { UI.openBrewing(bx, by, bz); return; }
      if (bl.tileEntity === 'anvil') { UI.openAnvil(bx, by, bz); return; }
      if (bl.shape === 'door') { toggleDoor(w, bx, by, bz); return; }
      if (bl.bed) { trySleep(bx, by, bz); return; }
      if (bl.key === 'lever') { toggleLever(w, bx, by, bz); return; }
      if (bl.shape === 'button') { pressButton(w, bx, by, bz); return; }
      if (bl.key === 'note_block') { playNoteBlock(w, bx, by, bz); return; }
      if (bl.key === 'tnt' && def && def.igniter) { igniteTNT(w, bx, by, bz); this.damageTool(1); return; }
      if (bl.key === 'repeater') { bumpRepeater(w, bx, by, bz); return; }
    }

    if (!def) return;

    // 2) food, potions & milk bucket
    if (def.milk) {
      this.eating = true; this.eatTicks = 0;
      return;
    }
    if (def.food && (this.hunger < 20 || def.golden)) {
      this.eating = true; this.eatTicks = 0;
      return;
    }
    if (def.potion && def.potion.effect && def.potion.effect !== 'water') {
      this.eating = true; this.eatTicks = 0;
      return;
    }
    // 2a) compass & clock right-click info readout
    if (def.key === 'compass') {
      const [sx, sy, sz] = this.spawnPoint || [0, 64, 0];
      const dist = Math.round(Math.hypot(sx - this.x, sz - this.z));
      Chat.actionBar(`§eSpawn Point: ${Math.floor(sx)}, ${Math.floor(sy)}, ${Math.floor(sz)} (${dist} blocks away)`);
      SFX.playClick(true);
      return;
    }
    if (def.key === 'clock') {
      const tod = Math.floor(w.time % DAY_TICKS);
      const hrs = Math.floor(((tod + 6000) % 24000) / 1000);
      const mins = Math.floor((((tod + 6000) % 1000) / 1000) * 60);
      Chat.actionBar(`§eWorld Time: ${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')} (${isDaytime() ? 'Day' : 'Night'})`);
      SFX.playClick(true);
      return;
    }
    // 2a-2) Eye of Ender (ender_eye): fill end_portal_frame or float toward Stronghold
    if (def.enderEye) {
      if (this.targetBlock) {
        const [bx, by, bz] = this.targetBlock;
        if (w.getBlock(bx, by, bz) === B.end_portal_frame) {
          const m = w.getMeta(bx, by, bz);
          if (!(m & 4)) {
            w.setBlock(bx, by, bz, B.end_portal_frame, m | 4);
            this.consumeHeld();
            this.triggerSwing();
            SFX.playPortalTrigger();
            // Activate adjacent 3x3 End Portal interior if surrounded or filled
            for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
              if (w.getBlock(bx + dx, by, bz + dz) === 0) {
                w.setBlock(bx + dx, by, bz + dz, B.end_portal, 0);
              }
            }
            return;
          }
        }
      }
      const dir = fwdFromYawPitch(this.yaw, -0.35, [0, 0, 0]);
      spawnParticles(this.x + dir[0] * 2, this.y + this.eye + dir[1] * 2, this.z + dir[2] * 2, 14, [0.4, 0.95, 0.75], true);
      SFX.playBowShoot();
      this.triggerSwing();
      return;
    }
    // 2b) glass bottle → fill with water
    if (def.key === 'glass_bottle') {
      const t2 = raycastFluid(w, this.x, this.y + this.eye, this.z, this.yaw, this.pitch, this.reach);
      if (t2 && w.getBlock(t2[0], t2[1], t2[2]) === B.water) {
        this.replaceHeld({ id: I.water_bottle, count: 1 });
        SFX.playSplash();
        return;
      }
      return;
    }
    // 2c) wither ritual: skull on soul sand
    if (def.witherSkull && this.targetBlock) {
      const [sx2, sy2, sz2] = this.targetBlock;
      if (w.getBlock(sx2, sy2, sz2) === B.soul_sand) {
        if (trySpawnWither(w, sx2, sy2, sz2)) {
          this.consumeItem('wither_skull_item', 1);
          return;
        }
      }
      // place nothing — skull needs the ritual
      return;
    }
    // 3) bucket
    if (def.bucket) {
      if (def.bucket === 'empty') {
        const t = raycastFluid(w, this.x, this.y + this.eye, this.z, this.yaw, this.pitch, this.reach);
        if (t) {
          const [fx, fy, fz] = t;
          const fid = w.getBlock(fx, fy, fz);
          if (fid === B.water && w.getMeta(fx, fy, fz) === 0) {
            w.setBlock(fx, fy, fz, 0);
            this.replaceHeld({ id: I.water_bucket, count: 1 });
            SFX.playSplash();
            return;
          }
          if (fid === B.lava && w.getMeta(fx, fy, fz) === 0) {
            w.setBlock(fx, fy, fz, 0);
            this.replaceHeld({ id: I.lava_bucket, count: 1 });
            SFX.playSplash();
            return;
          }
        }
      } else {
        if (this.targetBlock && this.targetFace) {
          const [fx, fy, fz] = this.targetFace;
          if (fy >= 0 && fy < WORLD_H) {
            const cur = w.getBlock(fx, fy, fz);
            if (cur === 0 || !BLOCKS[cur].solid) {
              w.setBlock(fx, fy, fz, def.bucket === 'water' ? B.water : B.lava, 0);
              this.replaceHeld({ id: I.bucket, count: 1 });
              SFX.playSplash();
              return;
            }
          }
        }
      }
      return;
    }
    // 4) flint and steel
    if (def.igniter && this.targetBlock && this.targetFace) {
      const [fx, fy, fz] = this.targetFace;
      const id = w.getBlock(fx, fy, fz);
      // portal ignition: fire on obsidian frame inner
      if (id === 0) {
        if (tryIgnitePortal(w, fx, fy, fz)) { this.damageTool(1); return; }
        w.setBlock(fx, fy, fz, B.fire, 0);
        this.damageTool(1);
        SFX.playDig('grass');
        return;
      }
      return;
    }
    // 5) hoe → farmland (or coarse_dirt → dirt), shovel → dirt_path
    if (def.tool && def.tool.type === 'hoe' && this.targetBlock) {
      const [bx, by, bz] = this.targetBlock;
      const id = w.getBlock(bx, by, bz);
      if (id === B.coarse_dirt && w.getBlock(bx, by + 1, bz) === 0) {
        w.setBlock(bx, by, bz, B.dirt, 0);
        this.triggerSwing();
        SFX.playDig('gravel');
        this.damageTool(1);
        return;
      }
      if ((id === B.grass_block || id === B.dirt || id === B.dirt_path) && w.getBlock(bx, by + 1, bz) === 0) {
        w.setBlock(bx, by, bz, B.farmland, 0);
        this.triggerSwing();
        SFX.playDig('grass');
        this.damageTool(1);
        return;
      }
    }
    if (def.tool && def.tool.type === 'shovel' && this.targetBlock) {
      const [bx, by, bz] = this.targetBlock;
      const id = w.getBlock(bx, by, bz);
      if ((id === B.grass_block || id === B.dirt || id === B.coarse_dirt || id === B.podzol) && w.getBlock(bx, by + 1, bz) === 0) {
        w.setBlock(bx, by, bz, B.dirt_path, 0);
        this.triggerSwing();
        SFX.playDig('grass');
        this.damageTool(1);
        return;
      }
    }
    // 6) seeds / plant
    if (def.plant && this.targetBlock) {
      const [bx, by, bz] = this.targetBlock;
      const id = w.getBlock(bx, by, bz);
      if (def.plant.on === 'farmland' && id === B.farmland && w.getBlock(bx, by + 1, bz) === 0) {
        w.setBlock(bx, by + 1, bz, B[def.plant.block], 0);
        this.consumeHeld();
        SFX.playDig('grass');
        return;
      }
      if (def.plant.on === 'any' && BLOCKS[id].solid && w.getBlock(bx, by + 1, bz) === 0) {
        w.setBlock(bx, by + 1, bz, B[def.plant.block], 0);
        this.consumeHeld();
        return;
      }
    }
    // 7) bone meal
    if (def.boneMeal && this.targetBlock) {
      const [bx, by, bz] = this.targetBlock;
      if (applyBoneMeal(w, bx, by, bz)) { this.consumeHeld(); spawnParticles(bx + .5, by + .5, bz + .5, 12, [0.3, 0.9, 0.3], true); SFX.playDig('grass'); return; }
    }
    // 8) throwables
    if (def.projectile) {
      const dir = fwdFromYawPitch(this.yaw, this.pitch, [0, 0, 0]);
      if (def.projectile === 'arrow') return;
      const e = spawnEntity(def.projectile, this.x, this.y + this.eye - .1, this.z, { owner: this });
      e.vx = dir[0] * 22; e.vy = dir[1] * 22 + 2; e.vz = dir[2] * 22;
      SFX.playBowShoot();
      this.consumeHeld();
      return;
    }
    // 8b) boat on water / cart on rail
    if (def.boat || def.cart) {
      if (def.boat) {
        const t3 = raycastFluid(w, this.x, this.y + this.eye, this.z, this.yaw, this.pitch, this.reach);
        if (t3) {
          const b = spawnEntity('boat_ent', t3[0] + .5, t3[1] + .3, t3[2] + .5);
          b.yaw = this.yaw;
          this.consumeHeld();
          SFX.playSplash();
          return;
        }
      } else if (this.targetBlock) {
        const [rx, ry, rz] = this.targetBlock;
        if (w.getBlock(rx, ry, rz) === B.rail) {
          const c = spawnEntity('cart_ent', rx + .5, ry + .1, rz + .5);
          c.railAxis = (w.getBlock(rx + 1, ry, rz) === B.rail || w.getBlock(rx - 1, ry, rz) === B.rail) ? 'x' : 'z';
          this.consumeHeld();
          SFX.playPlace('metal');
          return;
        }
      }
      return;
    }
    // 9) ender pearl teleport handled in projectile entity
    // 10) block placement
    if (def.placeBlock !== null && def.placeBlock !== undefined && this.targetBlock && this.targetFace) {
      this.placeBlock(def);
      return;
    }
  }

  placeBlock(def) {
    const w = this.world;
    const item = this.getHeldItem();
    let [bx, by, bz] = this.targetBlock;
    const face = this.targetFaceDir();
    let px = bx + face[0], py = by + face[1], pz = bz + face[2];
    const bl = BLOCKS[def.placeBlock];

    // slab top/bottom by hit position
    // door: place on floor
    if (bl.shape === 'door') {
      if (face[1] !== 1 && !(w.getBlock(px, py - 1, pz) > 0 && BLOCKS[w.getBlock(px, py - 1, pz)].solid)) {
        // must place on ground
      }
      if (w.getBlock(px, py + 1, pz) !== 0) return;
      if (!canPlaceAt(w, px, py, pz, this)) return;
      const facing = dirFromYaw(this.yaw);
      w.setBlock(px, py, pz, def.placeBlock, facing);       // bottom half
      w.setBlock(px, py + 1, pz, def.placeBlock, facing | 8); // top half
      this.consumeHeld();
      SFX.playPlace(bl.material);
      G.stats.placed++;
      return;
    }
    if (bl.bed) {
      const facing = dirFromYaw(this.yaw);
      const off = [[0, 1], [-1, 0], [0, -1], [1, 0]][facing];
      const hx = px + off[0], hz = pz + off[1];
      if (w.getBlock(hx, py, hz) !== 0) return;
      if (!canPlaceAt(w, px, py, pz, this) || !canPlaceAt(w, hx, py, hz, this)) return;
      const below1 = w.getBlock(px, py - 1, pz), below2 = w.getBlock(hx, py - 1, hz);
      if (!((below1 >= 0 && BLOCKS[below1].solid) && (below2 >= 0 && BLOCKS[below2].solid))) return;
      w.setBlock(px, py, pz, def.placeBlock, facing);
      w.setBlock(hx, py, hz, def.placeBlock, facing | 4);
      this.consumeHeld();
      SFX.playPlace(bl.material);
      G.stats.placed++;
      return;
    }
    // orientation metas
    let meta = 0;
    if (bl.key.includes('_log') || bl.key === 'basalt') {
      if (face[1] !== 0) meta = 0;
      else meta = face[0] !== 0 ? 1 : 2;
    } else if (bl.shape === 'torch') {
      if (face[1] === 1) meta = 0;
      else if (face[0] === 1) meta = 2;
      else if (face[0] === -1) meta = 1;
      else if (face[2] === 1) meta = 4;
      else meta = 3;
    } else if (bl.shape === 'ladder') {
      meta = (dirFromYaw(this.yaw) + 2) & 3;
    } else if (bl.key === 'pumpkin' || bl.key === 'jack_o_lantern' || bl.key === 'furnace' || bl.key === 'chest' || bl.key === 'anvil' || bl.key === 'piston' || bl.key === 'sticky_piston') {
      // Face toward the player who placed it (opposite of player look direction)
      meta = (dirFromYaw(this.yaw) + 2) & 3;
    } else if (bl.shape === 'slab') {
      // top half if clicked top face or upper part of side
      meta = (face[1] === 1) ? 8 : (face[1] === -1 ? 0 : (this.targetHitY > 0.5 ? 8 : 0));
    } else if (bl.shape === 'stairs') {
      meta = dirFromYaw(this.yaw); // ascend in player's look direction
    } else if (bl.key === 'oak_sign') {
      meta = (dirFromYaw(this.yaw) + 2) & 3; // board faces the player
    } else if (bl.key === 'repeater') {
      meta = dirFromYaw(this.yaw);
    } else if (bl.key === 'rail') {
      // rail orientation: connect along the axis the player faces (or side connects later)
      meta = (face[0] !== 0) ? 1 : 0;
    } else if (bl.shape === 'pane') {
      meta = 0;
    }

    // support requirements
    if (bl.shape === 'cross' || bl.shape === 'reed' || bl.shape === 'crop' || bl.shape === 'sign') {
      const below = w.getBlock(px, py - 1, pz);
      if (!(below >= 0 && BLOCKS[below].solid)) return;
      if (bl.cactus || bl.key === 'sugar_cane') {
        const bkey = BLOCKS[below].key;
        if (bl.cactus && bkey !== 'sand' && bkey !== 'cactus') return;
        if (bl.key === 'sugar_cane' && bkey !== 'sugar_cane' && bkey !== 'grass_block' && bkey !== 'dirt' && bkey !== 'sand') return;
      }
    }
    if (bl.shape === 'torch' && meta > 0) {
      // wall torch needs solid wall behind
      const wx2 = px - face[0], wz2 = pz - face[2];
      const wallB = w.getBlock(wx2, py, wz2);
      if (!(wallB >= 0 && BLOCKS[wallB].solid)) meta = 0;
    }
    if (bl.shape === 'ladder') {
      const off = [[0, 1], [-1, 0], [0, -1], [1, 0]][meta];
      const wallB = w.getBlock(px + off[0], py, pz + off[1]);
      if (!(wallB >= 0 && BLOCKS[wallB].solid)) return;
    }
    if (bl.shape === 'wire' || bl.shape === 'plate' || bl.shape === 'repeater' || bl.shape === 'button' || bl.shape === 'lever' || bl.key === 'snow_layer') {
      const below = w.getBlock(px, py - 1, pz);
      if (!(below >= 0 && BLOCKS[below].solid)) return;
    }

    // replace plants & snow when placing into them
    const cur = w.getBlock(px, py, pz);
    if (cur > 0) {
      const curBl = BLOCKS[cur];
      const replaceable = curBl.shape === 'cross' || curBl.shape === 'snow' || cur === B.water;
      if (!replaceable) {
        if (curBl.fluid && bl.solid) { /* allow replacing fluid */ }
        else return;
      }
    }
    if (!canPlaceAt(w, px, py, pz, this)) return;
    w.setBlock(px, py, pz, def.placeBlock, meta);
    this.triggerSwing();
    G.stats.placed++;
    Advancements.onPlace(def.placeBlock);
    if (this.gameMode !== 'creative') this.consumeHeld();
    SFX.playPlace(bl.material);
    // tile entity init
    if (bl.tileEntity && !G.tileEntities.has(px + ',' + py + ',' + pz)) {
      const te = { type: bl.tileEntity };
      if (bl.tileEntity === 'chest') te.items = new Array(27).fill(null);
      if (bl.tileEntity === 'furnace') { te.input = null; te.fuel = null; te.output = null; te.burn = 0; te.burnMax = 0; te.cook = 0; }
      if (bl.tileEntity === 'crafting') te.grid = new Array(9).fill(null);
      if (bl.tileEntity === 'brewing') { te.bottles = [null, null, null]; te.ingredient = null; te.fuel = 0; te.fuelItem = null; te.brew = 0; }
      if (bl.tileEntity === 'anvil') { te.item = null; te.mat = null; te.name = ''; }
      if (bl.tileEntity === 'sign') te.lines = ['', ''];
      G.tileEntities.set(px + ',' + py + ',' + pz, te);
    }
  }

  targetFaceDir() {
    if (!this.targetFace) return [0, 1, 0];
    return this.targetFace;
  }

  consumeHeld() {
    if (this.gameMode === 'creative') return;
    const item = this.slots[this.held];
    if (!item) return;
    item.count--;
    if (item.count <= 0) this.slots[this.held] = null;
    UI.refreshHotbar();
  }
  replaceHeld(stack) {
    this.slots[this.held] = stack;
    UI.refreshHotbar();
  }
  consumeItem(key, count) {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s && ITEMS[s.id].key === key) {
        const take = Math.min(count, s.count);
        s.count -= take; count -= take;
        if (s.count <= 0) this.slots[i] = null;
        if (count <= 0) break;
      }
    }
    UI.refreshHotbar();
  }
  countItem(key) {
    let n = 0;
    for (const s of this.slots) if (s && ITEMS[s.id].key === key) n += s.count;
    return n;
  }
  hasItem(key) {
    for (const s of this.slots) if (s && ITEMS[s.id].key === key) return true;
    return false;
  }

  addItem(id, count, dur, ench) {
    // returns leftover count
    const def = ITEMS[id];
    const max = def.stack;
    // merge into existing
    if (max > 1) {
      for (let i = 0; i < 36 && count > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && !s.ench && (s.dur === undefined || dur === undefined) && s.count < max) {
          const add = Math.min(count, max - s.count);
          s.count += add; count -= add;
        }
      }
    }
    // fill empty (hotbar first for pickup feel: MC fills hotbar first actually main first; do hotbar 0-8 then 9-35)
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(count, max);
        this.slots[i] = { id, count: add };
        if (dur !== undefined) this.slots[i].dur = dur;
        if (ench) this.slots[i].ench = ench;
        count -= add;
      }
    }
    UI.refreshHotbar();
    return count;
  }

  addXP(amount) {
    this.xp += amount;
    let need = this.xpLevel < 16 ? 2 * this.xpLevel + 7 : this.xpLevel < 31 ? 5 * this.xpLevel - 38 : 9 * this.xpLevel - 158;
    let prog = this.xp;
    while (prog >= need) {
      prog -= need;
      this.xpLevel++;
      SFX.playLevelUp();
      need = this.xpLevel < 16 ? 2 * this.xpLevel + 7 : this.xpLevel < 31 ? 5 * this.xpLevel - 38 : 9 * this.xpLevel - 158;
    }
    this.xp = prog;
    this.xpProgress = prog / Math.max(1, need);
  }

  computeArmor() {
    let total = 0, dur = 0;
    for (let i = 36; i < 40; i++) {
      const s = this.slots[i];
      if (s && ITEMS[s.id].armor) { total += ITEMS[s.id].armor.defense; dur++; }
    }
    this.armorVal = total;
    return total;
  }

  damage(amount, cause) {
    if (this.dead) return;
    if (this.gameMode === 'creative' || this.gameMode === 'spectator') return;
    // enterprise guard: a corrupt/NaN amount must never poison health
    if (!isFinite(amount) || amount <= 0) return;
    if (cause !== 'starve' && cause !== 'drown' && cause !== 'void') {
      const armor = this.computeArmor();
      const prot = this.slots[36] && this.slots[36].ench && this.slots[36].ench.protection || 0;
      const reduction = Math.min(0.8, armor * 0.04 + prot * 0.04);
      amount = Math.max(1, Math.round(amount * (1 - reduction)));
      // armor durability
      for (let i = 36; i < 40; i++) {
        const s = this.slots[i];
        if (s && ITEMS[s.id].armor) {
          s.dur = (s.dur === undefined ? ITEMS[s.id].armor.uses : s.dur) - 1;
          if (s.dur <= 0) this.slots[i] = null;
        }
      }
    }
    this.health -= amount;
    this.hurtTime = 10;
    SFX.playHurt();
    UI.damageFlash();
    if (this.health <= 0) this.die(cause);
  }

  die(cause) {
    this.dead = true;
    this.deathTime = 0;
    G.stats.deaths++;
    // MC death message: cause visible in chat for EVERYONE (and broadcast in MP)
    const name = (G.net && G.net.myName) || 'Spieler';
    const msg = deathMessage(cause, name);
    Chat.add(msg);
    if (G.net && G.net.mode !== null) G.net.sendAll({ t: 'chat', msg });
    G.lastDeath = { cause: cause || 'unknown', pos: [Math.round(this.x), Math.round(this.y), Math.round(this.z)], tick: G.stats.playedTicks };
    // MC flow: the world keeps ticking and the camera tips over sideways for
    // ~1 s BEFORE the death screen appears — the main tick() advances
    // deathTime and calls UI.showDeathScreen then. Closing open overlays now
    // (e.g. the pause menu) so nothing fights the upcoming death screen.
    G.state = 'dead';
    showScreen(null);
    // drop inventory
    if (this.gameMode !== 'hardcore' && this.gameMode !== 'creative') {
      for (let i = 0; i < this.slots.length; i++) {
        const s = this.slots[i];
        if (s) { dropItem(this.x, this.y + 1, this.z, ITEMS[s.id].key, s.count); this.slots[i] = null; }
      }
      spawnXPOrbs(this.x, this.y + 1, this.z, Math.min(50, this.xpLevel * 5));
    }
    this.xp = 0; this.xpLevel = 0; this.xpProgress = 0;
    // the death screen is NOT shown here — the main tick() shows it after the
    // 1 s MC death animation (deathTime 20)
  }

  respawn() {
    const [sx, sy, sz] = this.spawnPoint;
    this.x = sx; this.y = sy; this.z = sz;
    this.vx = this.vy = this.vz = 0;
    this.health = this.maxHealth;
    this.hunger = 20; this.saturation = 5; this.exhaustion = 0;
    this.air = 300; this.onFire = 0; this.fallDistance = 0;
    this.dead = false;
    this.hurtTime = 0;
    this.spawnGrace = 100;
    // find safe ground at spawn
    let y = Math.min(WORLD_H - 3, Math.max(1, Math.floor(this.y)));
    while (y < WORLD_H - 2 && this.world.getBlock(Math.floor(sx), y, Math.floor(sz)) === 0) y++;
    const groundId = this.world.getBlock(Math.floor(sx), y, Math.floor(sz));
    if (groundId > 0 && BLOCKS[groundId].solid) this.y = y + 1.01;
  }
}

// direction index from yaw: 0=south(+z) 1=west(-x) 2=north(-z) 3=east(+x)
// Camera forward is (-sin(yaw), 0, -cos(yaw)):
// yaw=0 -> north(-z)=2, yaw=90° -> west(-x)=1, yaw=180° -> south(+z)=0, yaw=270° -> east(+x)=3
function dirFromYaw(yaw) {
  const deg = ((yaw * 180 / Math.PI) % 360 + 360) % 360;
  if (deg >= 315 || deg < 45) return 2;    // north (-z)
  if (deg >= 45 && deg < 135) return 1;    // west  (-x)
  if (deg >= 135 && deg < 225) return 0;   // south (+z)
  return 3;                                // east  (+x)
}

function canPlaceAt(w, x, y, z, player) {
  const id = w.getBlock(x, y, z);
  if (id > 0 && BLOCKS[id].solid) return false;
  // player AABB overlap (for solid blocks)
  const bl = BLOCKS[w.getBlock(x, y, z) === 0 ? 0 : w.getBlock(x, y, z)];
  const placing = arguments.length > 3 && player ? null : null;
  if (player && player.gameMode !== 'spectator') {
    const hw = player.w / 2;
    const overlap = x + 1 > player.x - hw && x < player.x + hw &&
      y + 1 > player.y && y < player.y + player.h &&
      z + 1 > player.z - hw && z < player.z + hw;
    if (overlap) {
      // check the actual block about to be placed is solid
      // (non-solid blocks like torches can be placed)
      return false;
    }
  }
  // entity overlap check
  for (const e of G.entities) {
    if (!e.hittable || e.dead) continue;
    if (x + 1 > e.x - e.w && x < e.x + e.w && y + 1 > e.y && y < e.y + e.h && z + 1 > e.z - e.w && z < e.z + e.w) {
      if (e.itemEntity) continue;
      return false;
    }
  }
  return true;
}

// ---- Voxel raycast (Amanatides & Woo) ----
function raycast(world, ox, oy, oz, yaw, pitch, reach) {
  const dir = fwdFromYawPitch(yaw, pitch, [0, 0, 0]);
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const stepX = dir[0] > 0 ? 1 : -1, stepY = dir[1] > 0 ? 1 : -1, stepZ = dir[2] > 0 ? 1 : -1;
  const tDeltaX = Math.abs(1 / (dir[0] || 1e-10)), tDeltaY = Math.abs(1 / (dir[1] || 1e-10)), tDeltaZ = Math.abs(1 / (dir[2] || 1e-10));
  const distToBound = (o, d, s) => d > 0 ? (Math.floor(o) + 1 - o) : (o - Math.floor(o));
  let tMaxX = distToBound(ox, dir[0], stepX) * tDeltaX;
  let tMaxY = distToBound(oy, dir[1], stepY) * tDeltaY;
  let tMaxZ = distToBound(oz, dir[2], stepZ) * tDeltaZ;
  let face = [0, 0, 0], t = 0;
  for (let i = 0; i < 256; i++) {
    const id = world.getBlock(x, y, z);
    if (id > 0) {
      const bl = BLOCKS[id];
      if (bl.hardness >= 0 || bl.shape !== 'none') {
        if (!bl.fluid && bl.shape !== 'none') {
          return { block: [x, y, z], face, dist: t, hitY: oy + dir[1] * t - y, id };
        }
      }
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0]; }
    else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0]; }
    else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ]; }
    if (t > reach) return null;
  }
  return null;
}

function raycastFluid(world, ox, oy, oz, yaw, pitch, reach) {
  const dir = fwdFromYawPitch(yaw, pitch, [0, 0, 0]);
  for (let t = 0; t < reach; t += 0.25) {
    const x = Math.floor(ox + dir[0] * t), y = Math.floor(oy + dir[1] * t), z = Math.floor(oz + dir[2] * t);
    const id = world.getBlock(x, y, z);
    if (id === B.water || id === B.lava) return [x, y, z];
    if (id > 0 && BLOCKS[id].solid) return null;
  }
  return null;
}

function rayAABB(ox, oy, oz, dir, e) {
  const hw = e.w / 2;
  const min = [e.x - hw, e.y, e.z - hw], max = [e.x + hw, e.y + e.h, e.z + hw];
  let tmin = 0, tmax = 1e9;
  const o = [ox, oy, oz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-9) {
      if (o[i] < min[i] || o[i] > max[i]) return null;
    } else {
      let t1 = (min[i] - o[i]) / dir[i], t2 = (max[i] - o[i]) / dir[i];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
