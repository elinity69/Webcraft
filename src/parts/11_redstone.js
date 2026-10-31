// ============================================================================
// Part 11: Redstone power system, TNT/explosions, block interactions
// (doors, levers, buttons, plates, note blocks, beds, bone meal, portals)
// ============================================================================
const Redstone = {
  // Meta layouts:
  // redstone_wire: high nibble = power (0-15), low nibble = connection mask (mesh time)
  // lever: bit0 = on
  // button: bit0 = pressed (timed)
  // repeater: bits0-1 delay, bit2 = powered out
  // redstone_lamp / redstone_torch: bit0 lit
  pendingUpdates: new Set(),
  buttonTimers: [],   // [x,y,z,ticksLeft]

  isPowerSource(id, meta, world, x, y, z) {
    if (id === B.redstone_block) return 15;
    if (id === B.lever && (meta & 1)) return 15;
    if (id === B.stone_button && (meta & 1)) return 15;
    if (id === B.redstone_torch && !(meta & 1)) return 15;
    if (id === B.repeater && (meta & 4)) return 15;
    return 0;
  },

  // compute emitted power into a wire from adjacent sources
  wirePower(world, x, y, z) {
    let p = 0;
    for (const [dx, dy, dz] of NEIGH6) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const nid = world.getBlock(nx, ny, nz);
      if (nid <= 0) continue;
      const nm = world.getMeta(nx, ny, nz);
      if (nid === B.redstone_wire) {
        p = Math.max(p, (nm >> 4) - 1);
      } else {
        p = Math.max(p, this.isPowerSource(nid, nm, world, nx, ny, nz));
        // strong power from repeater facing into this wire
        if (nid === B.repeater && (nm & 4)) {
          const facing = nm & 3;
          const off = [[0, 1], [-1, 0], [0, -1], [1, 0]][facing];
          if (dx === off[0] && dz === off[1] && dy === 0) p = 15;
        }
        // strong power from an opaque block directly above an active redstone torch
        if (BLOCKS[nid] && BLOCKS[nid].opaque) {
          const belowN = world.getBlock(nx, ny - 1, nz);
          const belowM = world.getMeta(nx, ny - 1, nz);
          if (belowN === B.redstone_torch && !(belowM & 1)) p = 15;
        }
      }
    }
    return clamp(p, 0, 15);
  },

  // flood-fill recompute of wire network around a change point
  updateNetwork(world, x, y, z) {
    if (this._inUpdate) return; // recursion guard: setBlock inside triggers neighbor updates
    this._inUpdate = true;
    try { this._updateNetworkInner(world, x, y, z); }
    finally { this._inUpdate = false; }
  },
  _updateNetworkInner(world, x, y, z) {
    // collect wire network via BFS from any wire at/adjacent to (x,y,z)
    const seeds = [];
    if (world.getBlock(x, y, z) === B.redstone_wire) seeds.push([x, y, z]);
    for (const [dx, dy, dz] of NEIGH6) {
      if (world.getBlock(x + dx, y + dy, z + dz) === B.redstone_wire) seeds.push([x + dx, y + dy, z + dz]);
    }
    const network = new Set();
    const q = [...seeds];
    while (q.length) {
      const [cx2, cy2, cz2] = q.pop();
      const k = cx2 + ',' + cy2 + ',' + cz2;
      if (network.has(k)) continue;
      network.add(k);
      for (const [dx, dy, dz] of NEIGH6) {
        const nx = cx2 + dx, ny = cy2 + dy, nz = cz2 + dz;
        if (world.getBlock(nx, ny, nz) === B.redstone_wire) q.push([nx, ny, nz]);
      }
    }
    // iterate to fixed point (max 16 passes)
    let changed = true, pass = 0;
    while (changed && pass++ < 16) {
      changed = false;
      for (const k of network) {
        const [cx2, cy2, cz2] = k.split(',').map(Number);
        const m = world.getMeta(cx2, cy2, cz2);
        const cur = m >> 4;
        let target;
        if (network.size === 1) target = this.wirePower(world, cx2, cy2, cz2);
        else target = this.wirePower(world, cx2, cy2, cz2);
        if (target !== cur) {
          world.setBlock(cx2, cy2, cz2, B.redstone_wire, (target << 4) | (m & 15), { noUpdate: true, noLight: true });
          changed = true;
        }
      }
    }
    // update consumers adjacent to network
    const consumers = new Set();
    for (const k of network) {
      const [cx2, cy2, cz2] = k.split(',').map(Number);
      const m = world.getMeta(cx2, cy2, cz2);
      const pow = m >> 4;
      for (const [dx, dy, dz] of NEIGH6) {
        const nx = cx2 + dx, ny = cy2 + dy, nz = cz2 + dz;
        const nid = world.getBlock(nx, ny, nz);
        if (nid <= 0) continue;
        consumers.add(nx + ',' + ny + ',' + nz);
      }
    }
    // also consumers adjacent to the original change
    for (const [dx, dy, dz] of NEIGH6) consumers.add((x + dx) + ',' + (y + dy) + ',' + (z + dz));
    consumers.add(x + ',' + y + ',' + z);
    for (const k of consumers) this.updateConsumer(world, ...k.split(',').map(Number));
  },

  isBlockPowered(world, x, y, z) {
    // is this position receiving power from adjacent wires/sources?
    for (const [dx, dy, dz] of NEIGH6) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const nid = world.getBlock(nx, ny, nz);
      if (nid <= 0) continue;
      const nm = world.getMeta(nx, ny, nz);
      if (nid === B.redstone_wire && (nm >> 4) > 0) return true;
      const src = this.isPowerSource(nid, nm, world, nx, ny, nz);
      if (src > 0 && nid !== B.redstone_torch) return true;
    }
    return false;
  },

  updateConsumer(world, x, y, z) {
    const id = world.getBlock(x, y, z);
    if (id <= 0) return;
    const m = world.getMeta(x, y, z);
    switch (id) {
      case B.redstone_lamp: {
        const powered = this.isBlockPowered(world, x, y, z);
        if (powered !== !!(m & 1)) world.setBlock(x, y, z, id, (m & ~1) | (powered ? 1 : 0), { noUpdate: true });
        break;
      }
      case B.redstone_torch: {
        // torch turns off when its support block is powered
        const supportPowered = this.isBlockPowered(world, x, y - 1, z);
        const lit = !supportPowered;
        if (lit !== !(m & 1)) world.setBlock(x, y, z, id, (m & ~1) | (lit ? 0 : 1), { noUpdate: true });
        break;
      }
      case B.tnt: {
        if (this.isBlockPowered(world, x, y, z)) igniteTNT(world, x, y, z);
        break;
      }
      case B.piston:
      case B.sticky_piston: {
        // 1:1 PistonBaseBlock.checkIfExtend & PistonStructureResolver (MAX_PUSH_DEPTH = 12)
        const powered = this.isBlockPowered(world, x, y, z);
        const extended = !!(m & 4);
        const facing = m & 3; // 0=south(+z), 1=west(-x), 2=north(-z), 3=east(+x)
        const dir = [[0, 0, 1], [-1, 0, 0], [0, 0, -1], [1, 0, 0]][facing];
        if (powered && !extended) {
          // Resolve line of up to 12 pushable blocks
          const line = [];
          let canPush = true;
          for (let step = 1; step <= 13; step++) {
            const tx = x + dir[0] * step, ty = y + dir[1] * step, tz = z + dir[2] * step;
            const tid = world.getBlock(tx, ty, tz);
            if (tid === 0 || (BLOCKS[tid] && BLOCKS[tid].fluid)) break;
            if (tid < 0 || BLOCKS[tid].hardness < 0 || tid === B.obsidian || tid === B.crying_obsidian || BLOCKS[tid].tileEntity) {
              canPush = false;
              break;
            }
            if (step > 12) { canPush = false; break; }
            line.push([tx, ty, tz, tid, world.getMeta(tx, ty, tz)]);
          }
          if (canPush) {
            for (let i = line.length - 1; i >= 0; i--) {
              const [tx, ty, tz, tid, tm] = line[i];
              world.setBlock(tx + dir[0], ty + dir[1], tz + dir[2], tid, tm, { noUpdate: true });
              if (i === 0) world.setBlock(tx, ty, tz, 0, 0, { noUpdate: true });
            }
            world.setBlock(x, y, z, id, m | 4, { noUpdate: true });
            SFX.playClick(true);
          }
        } else if (!powered && extended) {
          world.setBlock(x, y, z, id, m & ~4, { noUpdate: true });
          // Sticky piston pulls the block at distance 2 back to distance 1
          if (id === B.sticky_piston) {
            const fx1 = x + dir[0], fy1 = y + dir[1], fz1 = z + dir[2];
            const fx2 = x + dir[0] * 2, fy2 = y + dir[1] * 2, fz2 = z + dir[2] * 2;
            const id1 = world.getBlock(fx1, fy1, fz1);
            const id2 = world.getBlock(fx2, fy2, fz2);
            if (id1 === 0 && id2 > 0 && BLOCKS[id2].hardness >= 0 && id2 !== B.obsidian && id2 !== B.crying_obsidian && !BLOCKS[id2].tileEntity) {
              const m2 = world.getMeta(fx2, fy2, fz2);
              world.setBlock(fx1, fy1, fz1, id2, m2, { noUpdate: true });
              world.setBlock(fx2, fy2, fz2, 0, 0, { noUpdate: true });
            }
          }
          SFX.playClick(false);
        }
        break;
      }
      case B.repeater: {
        // input from behind → output after delay
        const facing = m & 3;
        const back = [[0, -1], [1, 0], [0, 1], [-1, 0]][facing]; // opposite of facing dir
        const bx = x - back[0] * 0 + (facing === 0 ? 0 : facing === 1 ? 1 : facing === 2 ? 0 : -1);
        const bz = z + (facing === 0 ? -1 : facing === 2 ? 1 : 0);
        const inId = world.getBlock(bx, y, bz);
        const inM = world.getMeta(bx, y, bz);
        let input = false;
        if (inId === B.redstone_wire && (inM >> 4) > 0) input = true;
        if (this.isPowerSource(inId, inM, world, bx, y, bz) > 0) input = true;
        const out = input;
        if (out !== !!(m & 4)) {
          this.repeaterTimers = this.repeaterTimers || [];
          this.repeaterTimers.push({ x, y, z, target: out, delay: 1 + (m & 3) * 2 });
        }
        break;
      }
      default: break;
    }
  },

  tickRepeaters() {
    if (!this.repeaterTimers) return;
    const next = [];
    for (const t of this.repeaterTimers) {
      t.delay--;
      if (t.delay <= 0) {
        const m = G.world.getMeta(t.x, t.y, t.z);
        const id = G.world.getBlock(t.x, t.y, t.z);
        if (id === B.repeater) {
          G.world.setBlock(t.x, t.y, t.z, id, (m & ~4) | (t.target ? 4 : 0), { noUpdate: true });
          this.updateNetwork(G.world, t.x, t.y, t.z);
        }
      } else next.push(t);
    }
    this.repeaterTimers = next;
  },

  tickButtons() {
    const next = [];
    for (const [x, y, z, t] of this.buttonTimers) {
      if (t - 1 <= 0) {
        const m = G.world.getMeta(x, y, z);
        if (G.world.getBlock(x, y, z) === B.stone_button) {
          G.world.setBlock(x, y, z, B.stone_button, m & ~1, { noUpdate: true });
          this.updateNetwork(G.world, x, y, z);
        }
      } else next.push([x, y, z, t - 1]);
    }
    this.buttonTimers = next;
  },

  tickPlates() {
    // scan loaded pressure plates near player & check entity overlap
    const p = G.player;
    if (!p) return;
    const cx0 = Math.floor((p.x - 24) / CH), cx1 = Math.floor((p.x + 24) / CH);
    const cz0 = Math.floor((p.z - 24) / CH), cz1 = Math.floor((p.z + 24) / CH);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const c = G.world.getChunk(cx, cz);
      if (!c || !c.generated) continue;
      // cheap scan: only the vertical range around the player (plates live near ground)
      const yLo = Math.max(0, Math.floor(p.y) - 16), yHi = Math.min(WORLD_H - 1, Math.floor(p.y) + 16);
      for (let y = yLo; y <= yHi; y += 1) {
        for (let lz = 0; lz < CH; lz += 2) for (let lx = 0; lx < CH; lx += 2) {
          const id = c.blocks[idx3(lx, y, lz)];
          if (id !== B.stone_pressure_plate && id !== B.oak_pressure_plate) continue;
          const wx = cx * CH + lx, wz = cz * CH + lz;
          const m = c.meta[idx3(lx, y, lz)];
          // any entity/player standing on it?
          let pressed = false;
          const check = (e) => {
            if (e.dead || !e.hittable) return;
            if (e.x + e.w / 2 > wx && e.x - e.w / 2 < wx + 1 && e.z + e.w / 2 > wz && e.z - e.w / 2 < wz + 1 && Math.abs(e.y - (y + 1)) < 0.3) pressed = true;
          };
          check(p);
          if (!pressed) for (const e of G.entities) { check(e); if (pressed) break; }
          if (pressed !== !!(m & 1)) {
            G.world.setBlock(wx, y, wz, id, (m & ~1) | (pressed ? 1 : 0), { noUpdate: true });
            SFX.playClick(pressed);
            this.updateNetwork(G.world, wx, y, wz);
          }
        }
      }
    }
  },

  onNeighborChanged(wx, wy, wz) {
    // recompute wire network when any neighbor changes
    this.updateNetwork(G.world, wx, wy, wz);
  },
};

// ---------- TNT & explosions ----------
function igniteTNT(world, x, y, z) {
  world.setBlock(x, y, z, 0, 0, { noUpdate: false });
  const e = new Entity('tnt', x + .5, y, z + .5, MOB_DEFS.tnt, {});
  e.fuse = 80;
  G.entities.push(e);
  SFX.playFuse();
}

function explode(x, y, z, power) {
  SFX.playExplosion();
  const world = G.world;
  const r = Math.ceil(power);
  // block destruction with falloff
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
    const d = Math.hypot(dx, dy, dz);
    if (d > power * (0.8 + rand() * 0.35)) continue;
    const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz;
    const id = world.getBlock(bx, by, bz);
    if (id <= 0) continue;
    const bl = BLOCKS[id];
    if (bl.hardness < 0) continue; // bedrock/obsidian resist
    if (bl.key === 'obsidian' || bl.key === 'crying_obsidian') continue;
    // water dampens
    if (world.getBlock(bx, by + 1, bz) === B.water) continue;
    world.setBlock(bx, by, bz, 0, 0, { noUpdate: true });
    if (bl.fluid) world.setBlock(bx, by, bz, 0, 0, { noUpdate: true });
    if (chance(.28) && bl.drops !== null) {
      const drops = resolveDrops(id, 0, null, 0);
      for (const [key, n] of drops) if (chance(.3)) dropItem(bx + .5, by + .5, bz + .5, key, n);
    }
    // chain reaction
    if (bl.key === 'tnt') igniteTNT(world, bx, by, bz);
  }
  // particles
  spawnParticles(x, y, z, 60, [.45, .42, .4], true);
  spawnParticles(x, y, z, 30, [1, .7, .3], true);
  spawnSmoke(x, y + 1, z, 24, .35);
  // entity damage & knockback (explosion damage is difficulty-scaled for players)
  const hurt = (e, isP) => {
    const d = Math.hypot(e.x - x, (e.y + (isP ? 1 : e.h / 2)) - y, e.z - z);
    if (d > power * 2) return;
    const raw = (1 - d / (power * 2)) * power * 3.5;
    if (isP) {
      const dmg = mobDmg(Math.max(1, Math.round(raw)));
      if (dmg > 0) e.damage(dmg, 'explosion');
    }
    else e.damage(Math.max(1, Math.round(raw)), null, 'explosion');
    const kx = (e.x - x) / (d || 1), ky = ((e.y + 1) - y) / (d || 1), kz = (e.z - z) / (d || 1);
    const kb = (1 - d / (power * 2)) * 1.2;
    e.vx += kx * kb; e.vy += ky * kb * .8 + .2; e.vz += kz * kb;
  };
  for (const e of G.entities) {
    if (e.dead || !e.hittable || e.type === 'item' || e.type === 'xp' || e.type === 'arrow') continue;
    hurt(e, false);
  }
  if (G.player && !G.player.dead) hurt(G.player, true);
}

// ---------- Interactions ----------
function toggleDoor(world, x, y, z) {
  const id = world.getBlock(x, y, z);
  if (BLOCKS[id].shape !== 'door') return;
  const m = world.getMeta(x, y, z);
  const open = (m & 4) ? 0 : 4;
  world.setBlock(x, y, z, id, (m & ~4) | open, { noUpdate: true });
  // other half
  const oy = (m & 8) ? y - 1 : y + 1;
  if (world.getBlock(x, oy, z) === id) {
    const om = world.getMeta(x, oy, z);
    world.setBlock(x, oy, z, id, (om & ~4) | open, { noUpdate: true });
  }
  SFX.playDig('wood');
}

function toggleLever(world, x, y, z) {
  const m = world.getMeta(x, y, z);
  const on = (m & 1) ? 0 : 1;
  world.setBlock(x, y, z, B.lever, (m & ~1) | on, { noUpdate: true });
  SFX.playClick(!!on);
  Redstone.updateNetwork(world, x, y, z);
}

function pressButton(world, x, y, z) {
  const m = world.getMeta(x, y, z);
  world.setBlock(x, y, z, B.stone_button, m | 1, { noUpdate: true });
  SFX.playClick(true);
  Redstone.buttonTimers.push([x, y, z, 20]);
  Redstone.updateNetwork(world, x, y, z);
}

function bumpRepeater(world, x, y, z) {
  const m = world.getMeta(x, y, z);
  const delay = ((m & 3) + 1) & 3;
  world.setBlock(x, y, z, B.repeater, (m & ~3) | delay, { noUpdate: true });
  Chat.actionBar('Repeater delay: ' + (1 + delay * 2) + ' ticks');
  SFX.playClick();
}

function playNoteBlock(world, x, y, z) {
  const m = world.getMeta(x, y, z);
  const semis = (m >> 4) & 15;
  SFX.playNoteBlock(semis - 6);
  // cycle pitch on sneak+use? attack cycles: use breaks. Shift+use cycles handled in useItem? keep: each play cycles
  world.setBlock(x, y, z, B.note_block, ((semis + 1) & 15) << 4, { noUpdate: true });
  spawnParticles(x + .5, y + 1.2, z + .5, 4, [.7, .7, 1], true);
}

function trySleep(x, y, z) {
  const t = ((G.world.time % DAY_TICKS) + DAY_TICKS) % DAY_TICKS;
  const isNight = t >= 12500 || t < 500;
  if (!isNight) { Chat.actionBar('You can only sleep at night'); return; }
  G.player.spawnPoint = [x + .5, y + 1, z + .5];
  Chat.actionBar('Respawn point set. Sleeping...');
  G.world.time = Math.ceil(G.world.time / DAY_TICKS) * DAY_TICKS + 500; // morning
  // clear rain
  G.rain = 0; G.thunder = 0;
  // update all players via net
  if (G.net && G.net.isHostOrSingle) G.net.broadcastTime();
}

function applyBoneMeal(world, x, y, z) {
  const id = world.getBlock(x, y, z);
  const m = world.getMeta(x, y, z);
  if (id === B.wheat) {
    if ((m & 7) >= 7) return false;
    world.setBlock(x, y, z, B.wheat, Math.min(7, (m & 7) + randInt(2, 4)), { noUpdate: true });
    return true;
  }
  for (const w of WOODS) {
    if (id === B[w + '_sapling']) {
      if (chance(.45)) {
        world.setBlock(x, y, z, 0, 0, { noUpdate: true });
        growTree(world, x, y, z, w);
      }
      return true;
    }
    if (id === B[w + '_leaves']) return false;
  }
  if (id === B.grass_block) {
    // grow grass & flowers around
    let did = false;
    for (let i = 0; i < 14; i++) {
      const ox = randInt(-3, 3), oz = randInt(-3, 3);
      const tx = x + ox, tz = z + oz;
      const ty = world.heightAt ? null : null;
      // find surface
      for (let yy = y + 2; yy >= y - 2; yy--) {
        const gid = world.getBlock(tx, yy, tz);
        if (gid === B.grass_block && world.getBlock(tx, yy + 1, tz) === 0) {
          const r = rand();
          if (r < .5) world.setBlock(tx, yy + 1, tz, B.short_grass, 0);
          else if (r < .75) world.setBlock(tx, yy + 1, tz, B.fern, 0);
          else {
            const flowers = ['dandelion', 'poppy', 'cornflower', 'oxeye_daisy', 'red_tulip'];
            world.setBlock(tx, yy + 1, tz, B[flowers[randInt(0, 4)]], 0);
          }
          did = true;
          break;
        }
        if (gid > 0 && BLOCKS[gid].opaque) break;
      }
    }
    return did;
  }
  if (id === B.pumpkin || id === B.melon) return false;
  return false;
}

function growTree(world, x, y, z, woodType) {
  const logId = B[woodType + '_log'], leafId = B[woodType + '_leaves'];
  const h = woodType === 'spruce' ? randInt(6, 9) : randInt(4, 6);
  for (let i = 0; i < h; i++) {
    if (world.getBlock(x, y + i, z) !== 0) return;
  }
  for (let i = 0; i < h; i++) world.setBlock(x, y + i, z, logId, 0, { noUpdate: true });
  const top = y + h - 1;
  if (woodType === 'spruce') {
    let r = 2;
    for (let yy = y + 2; yy <= top; yy += 2) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= r + 1 && !(dx === 0 && dz === 0)) {
          if (world.getBlock(x + dx, yy, z + dz) === 0) world.setBlock(x + dx, yy, z + dz, leafId, 1, { noUpdate: true });
        }
      }
      r = r === 2 ? 1 : 2;
    }
    world.setBlock(x, top + 1, z, leafId, 1, { noUpdate: true });
  } else {
    for (let dy = -2; dy <= 0; dy++) {
      const r = dy === 0 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && chance(.5)) continue;
        if (!(dx === 0 && dz === 0 && dy < 0) && world.getBlock(x + dx, top + dy, z + dz) === 0)
          world.setBlock(x + dx, top + dy, z + dz, leafId, 1, { noUpdate: true });
      }
    }
    world.setBlock(x, top + 1, z, leafId, 1, { noUpdate: true });
    if (chance(.5)) { world.setBlock(x + 1, top + 1, z, leafId, 1, { noUpdate: true }); world.setBlock(x, top + 1, z + 1, leafId, 1, { noUpdate: true }); }
  }
}

// ---------- Nether portal ----------
function tryIgnitePortal(world, x, y, z) {
  // find rectangle of air enclosed by obsidian, then fill it with portal blocks
  const validate = (dx, dz) => {
    // scan width along (dx,dz)
    let minX = 0, maxX = 0;
    while (isValidPortalSpot(world, x + (minX - 1) * dx, y, z + (minX - 1) * dz)) minX--;
    while (isValidPortalSpot(world, x + (maxX + 1) * dx, y, z + (maxX + 1) * dz)) maxX++;
    const w = maxX - minX + 1;
    if (w < 2 || w > 21) return null;
    // scan height
    let minY = y, maxY = y;
    let ok = true;
    for (let ix = minX; ix <= maxX; ix++) {
      const px = x + ix * dx, pz = z + ix * dz;
      let yy = y;
      while (isValidPortalSpot(world, px, yy - 1, pz)) yy--;
      if (ix === minX) minY = yy; else if (yy !== minY) { ok = false; break; }
      let y2 = y;
      while (isValidPortalSpot(world, px, y2 + 1, pz)) y2++;
      if (ix === minX) maxY = y2; else if (y2 !== maxY) { ok = false; break; }
    }
    if (!ok) return null;
    const h = maxY - minY + 1;
    if (h < 3 || h > 21) return null;
    // frame check
    for (let ix = minX; ix <= maxX; ix++) {
      if (world.getBlock(x + ix * dx, minY - 1, z + ix * dz) !== B.obsidian) return null;
      if (world.getBlock(x + ix * dx, maxY + 1, z + ix * dz) !== B.obsidian) return null;
    }
    for (let iy = minY; iy <= maxY; iy++) {
      if (world.getBlock(x + (minX - 1) * dx, iy, z + (minX - 1) * dz) !== B.obsidian) return null;
      if (world.getBlock(x + (maxX + 1) * dx, iy, z + (maxX + 1) * dz) !== B.obsidian) return null;
    }
    return { minX, maxX, minY, maxY, dx, dz };
  };
  const horiz = validate(1, 0) || validate(0, 1);
  if (!horiz) return false;
  const { minX, maxX, minY, maxY, dx, dz } = horiz;
  const axis = dx === 1 ? 0 : 1;
  for (let ix = minX; ix <= maxX; ix++) for (let iy = minY; iy <= maxY; iy++) {
    world.setBlock(x + ix * dx, iy, z + ix * dz, B.nether_portal, axis, { noUpdate: true });
  }
  SFX.playPortalTrigger();
  return true;
}
function isValidPortalSpot(world, x, y, z) {
  const id = world.getBlock(x, y, z);
  return id === 0 || id === B.fire || id === B.nether_portal;
}

// ---------- Wither boss ritual: skull on soul sand T ----------
function trySpawnWither(world, x, y, z) {
  // clicked block must be the TOP-CENTER soul sand of a T:
  // row of 3 soul sand at y (x-1..x+1 or z-1..z+1) + center below at y-1
  const isSoul = (sx, sy, sz) => world.getBlock(sx, sy, sz) === B.soul_sand;
  const axisOK = (isSoul(x - 1, y, z) && isSoul(x + 1, y, z)) || (isSoul(x, y, z - 1) && isSoul(x, y, z + 1));
  if (!axisOK || !isSoul(x, y - 1, z)) return false;
  const p = G.player;
  if (!p || p.countItem('wither_skull_item') < 2) { Chat.actionBar('The Wither needs 3 skulls!'); return false; }
  p.consumeItem('wither_skull_item', 1);
  p.consumeItem('wither_skull_item', 1);
  spawnEntity('wither', x + .5, y + 1, z + .5);
  Chat.add('§dThe Wither has been awakened!');
  SFX.playExplosion();
  spawnParticles(x + .5, y + 1.5, z + .5, 60, [.2, .2, .2], true);
  return true;
}

// ---------- End portal frame ----------
function WinDragonFight() {
  // called when dragon dies
  UI.updateBossBar(null);
  $('win-screen').classList.add('active');
  G.state = 'dead';
  setTimeout(() => {
    $('win-screen').classList.remove('active');
    G.state = 'playing';
    requestPointerLock();
  }, 6000);
  // place exit portal at (0, y, 0)
  const world = G.world;
  if (G.dimension === 2) {
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) === 2 || Math.abs(dz) === 2 || (dx === 0 && dz === 0)) {
        const y = 70;
        world.setBlock(dx, y, dz, B.bedrock, 0, { noUpdate: true });
        if (Math.abs(dx) < 2 && Math.abs(dz) < 2 && !(dx === 0 && dz === 0)) world.setBlock(dx, y + 1, dz, B.end_portal, 0, { noUpdate: true });
      }
    }
    world.setBlock(0, 71, 0, B.dragon_egg, 0, { noUpdate: true });
  }
}
