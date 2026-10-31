// ============================================================================
// Part 05: World & Chunk storage, lighting engine (sky+block BFS), ticking
// ============================================================================
class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.blocks = new Uint16Array(CHUNK_VOL);
    this.meta = new Uint8Array(CHUNK_VOL);
    this.light = new Uint8Array(CHUNK_VOL);   // high nibble sky, low nibble block
    this.biomes = null;
    this.heightmap = null;
    this.dirty = true;       // needs remesh
    this.lightDirty = true;
    this.generated = false;
    this.mesh = null;        // renderer data
    this.taccess = new Map(); // pendingTE storage
  }
  get(lx, y, lz) { return this.blocks[idx3(lx, y, lz)]; }
  set(lx, y, lz, id, m = 0) {
    const i = idx3(lx, y, lz);
    this.blocks[i] = id; this.meta[i] = m;
  }
}

class World {
  constructor(seed, dim = 0) {
    this.seed = seed;
    this.dim = dim;
    this.gen = new WorldGen(seed, dim);
    this.chunks = new Map();         // "cx,cz" -> Chunk
    this.chunkQueue = [];            // gen queue sorted by priority
    this.lightQueue = [];            // [add] BFS light updates
    this.lightRemoveQueue = [];      // [remove] BFS
    this.fluidQueue = new Set();     // fluid update positions
    this.fluidQueueArr = [];
    this.tickChunks = new Set();     // chunks eligible for random ticks
    this._lcKey = null; this._lcChunk = null; // 1-entry chunk lookup cache
    this.edits = new Map();          // "x,y,z" -> [id, meta] applied overrides (gen deltas)
    this.time = 6000;
  }
  key(cx, cz) { return cx + ',' + cz; }
  getChunk(cx, cz, create = false) {
    const k = this.key(cx, cz);
    let c = this.chunks.get(k);
    if (!c && create) { c = new Chunk(cx, cz); this.chunks.set(k, c); }
    return c;
  }
  chunkAt(wx, wz) { return this.getChunk(Math.floor(wx / CH), Math.floor(wz / CH)); }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_H) return 0;
    const k = (wx >> 4) + ',' + (wz >> 4);
    if (k !== this._lcKey) { this._lcKey = k; this._lcChunk = this.chunks.get(k); }
    const c = this._lcChunk;
    if (!c || !c.generated) return -1;   // unknown
    return c.blocks[idx3(wx & 15, wy, wz & 15)];
  }
  getMeta(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_H) return 0;
    const k = (wx >> 4) + ',' + (wz >> 4);
    if (k !== this._lcKey) { this._lcKey = k; this._lcChunk = this.chunks.get(k); }
    const c = this._lcChunk;
    if (!c || !c.generated) return 0;
    return c.meta[idx3(wx & 15, wy, wz & 15)];
  }
  getLight(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_H) return wy >= WORLD_H ? 0xF0 : 0;
    const k = (wx >> 4) + ',' + (wz >> 4);
    if (k !== this._lcKey) { this._lcKey = k; this._lcChunk = this.chunks.get(k); }
    const c = this._lcChunk;
    if (!c || !c.generated) return 0xF0;
    return c.light[idx3(wx & 15, wy, wz & 15)];
  }
  skyLight(wx, wy, wz) { return this.getLight(wx, wy, wz) >> 4; }
  blockLight(wx, wy, wz) { return this.getLight(wx, wy, wz) & 15; }

  ensureChunk(cx, cz) {
    this._lcKey = null;
    const c = this.getChunk(cx, cz, true);
    if (!c.generated) {
      const g = this.gen.generateChunk(cx, cz);
      c.blocks = g.blocks; c.meta = g.meta; c.biomes = g.biomes; c.heightmap = g.heights;
      c.generated = true; c.dirty = true; c.lightDirty = true;
      // apply saved edits for this chunk — WITH heightmap update, or player
      // builds above the natural terrain are invisible after every reload
      if (this.edits.size) {
        const x0 = cx * CH, z0 = cz * CH;
        for (const [k, v] of this.edits) {
          const [ex, ey, ez] = k.split(',').map(Number);
          if (ex >= x0 && ex < x0 + CH && ez >= z0 && ez < z0 + CH) {
            const li = idx3(ex - x0, ey, ez - z0);
            c.blocks[li] = v[0];
            c.meta[li] = v[1];
            const hi = (ez & 15) * 16 + (ex & 15);
            if (v[0] !== 0 && ey > c.heightmap[hi]) c.heightmap[hi] = ey;
          }
        }
      }
      // pending tile entities from gen (dungeon chests, villages)
      for (const te of g.pendingTE || []) {
        const wk = te.x + ',' + te.y + ',' + te.z;
        if (te.type === 'village') {
          // spawn residents once per village
          if (!G.spawnedVillages) G.spawnedVillages = new Set();
          if (!G.spawnedVillages.has(wk)) {
            G.spawnedVillages.add(wk);
            for (let v = 0; v < (te.villagers || 2); v++) {
              const vil = spawnEntity('villager', te.x + .5 + (rand() - .5) * 3, te.y + 1, te.z + .5 + (rand() - .5) * 3);
              vil.noDespawn = true;
            }
          }
          continue;
        }
        if (!G.tileEntities.has(wk)) G.tileEntities.set(wk, { type: 'chest', items: te.items.map(o => ({ id: I[o.item] !== undefined ? I[o.item] : 0, count: o.count })) });
      }
      // initial skylight fill
      this.initChunkLight(c);
      // queue neighbors remesh (their cull borders changed)
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = this.getChunk(cx + dx, cz + dz);
        if (n && n.generated) n.dirty = true;
      }
    }
    return c;
  }

  initChunkLight(c) {
    // Sky light: column fill from top, then BFS lateral spread happens lazily via queue
    const b = c.blocks;
    for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
      let lv = 15;
      for (let y = WORLD_H - 1; y >= 0; y--) {
        const i = idx3(lx, y, lz);
        const id = b[i];
        if (id !== 0) {
          const bl = BLOCKS[id];
          if (bl.opaque) lv = 0;
          else if (id === B.water) lv = Math.max(0, lv - 2);
          else if (bl.shape === 'cross' || bl.key.includes('leaves')) lv = Math.max(0, lv - 1);
        }
        c.light[i] = (lv << 4);
        if (lv > 0 && lv < 15) this.lightQueue.push([c.cx * CH + lx, y, c.cz * CH + lz, lv, true]);
      }
      // block light sources from generation
      for (let y = 0; y < WORLD_H; y++) {
        const i = idx3(lx, y, lz);
        const em = BLOCKS[b[i]].light;
        if (em > 0) { c.light[i] = (c.light[i] & 0xF0) | em; this.lightQueue.push([c.cx * CH + lx, y, c.cz * CH + lz, em, false]); }
      }
    }
    c.lightDirty = false;
  }

  setBlock(wx, wy, wz, id, m = 0, opts = {}) {
    if (wy < 0 || wy >= WORLD_H) return false;
    const c = this.getChunk(wx >> 4, wz >> 4);
    if (!c || !c.generated) return false;
    const lx = wx & 15, lz = wz & 15;
    const i = idx3(lx, wy, lz);
    const oldId = c.blocks[i];
    if (oldId === id && c.meta[i] === m) return false;
    c.blocks[i] = id; c.meta[i] = m;
    c.dirty = true;
    if (!opts.noEdit) this.edits.set(wx + ',' + wy + ',' + wz, [id, m]);
    // broadcast in EVERY networked mode — the host's edits AND the guest's own
    // edits must reach the other side (a guest that never sends looks frozen
    // to everyone else; the sender's world already has the block, and
    // applyRemoteBlock uses noNet so there is no echo loop)
    if (!opts.noNet && G.net && G.net.mode !== null) G.net.broadcastBlock(wx, wy, wz, id, m);

    // heightmap update
    if (c.heightmap) {
      const hi = lz * CH + lx;
      if (id !== 0 && wy > c.heightmap[hi]) c.heightmap[hi] = wy;
      else if (id === 0 && wy === c.heightmap[hi]) {
        let ny = wy - 1;
        while (ny > 0 && c.blocks[idx3(lx, ny, lz)] === 0) ny--;
        c.heightmap[hi] = ny;
      }
    }
    // ---- lighting updates ----
    const oldEmit = BLOCKS[oldId].light, newEmit = BLOCKS[id].light;
    if (oldEmit > 0 && newEmit < oldEmit) this.removeBlockLight(wx, wy, wz);
    if (!BLOCKS[id].opaque) {
      // if sky column changed, recompute vertical
      this.updateSkyColumn(c, lx, wy, lz);
    } else {
      this.removeSkyBelow(c, lx, wy, lz);
    }
    if (newEmit > 0) {
      c.light[i] = (c.light[i] & 0xF0) | newEmit;
      this.lightQueue.push([wx, wy, wz, newEmit, false]);
    }
    // re-seed neighbor lights: freshly exposed faces must pick up lateral
    // sky/block light immediately (prevents black "shadows" under mined blocks)
    for (const [dx, dy, dz] of NEIGH6) {
      const nx = wx + dx, ny = wy + dy, nz = wz + dz;
      const nl = this.getLight(nx, ny, nz);
      if ((nl >> 4) > 1) this.lightQueue.push([nx, ny, nz, nl >> 4, true]);
      if ((nl & 15) > 1) this.lightQueue.push([nx, ny, nz, nl & 15, false]);
    }
    if (!opts.noLight) this.lightQueue.push([wx, wy, wz, Math.max(this.skyLight(wx, wy, wz), this.blockLight(wx, wy, wz)), this.skyLight(wx, wy, wz) >= this.blockLight(wx, wy, wz)]);

    // neighbor remesh (borders)
    if (lx === 0) { const n = this.getChunk(c.cx - 1, c.cz); if (n) n.dirty = true; }
    if (lx === 15) { const n = this.getChunk(c.cx + 1, c.cz); if (n) n.dirty = true; }
    if (lz === 0) { const n = this.getChunk(c.cx, c.cz - 1); if (n) n.dirty = true; }
    if (lz === 15) { const n = this.getChunk(c.cx, c.cz + 1); if (n) n.dirty = true; }

    // fluid scheduling
    if (BLOCKS[oldId]?.fluid || BLOCKS[id]?.fluid) this.queueFluid(wx, wy, wz);
    for (const [dx, dy, dz] of NEIGH6) {
      const nb = this.getBlock(wx + dx, wy + dy, wz + dz);
      if (nb >= 0 && BLOCKS[nb].fluid) this.queueFluid(wx + dx, wy + dy, wz + dz);
    }
    // redstone / neighbor updates
    if (!opts.noUpdate) World_updateNeighbors(wx, wy, wz, this);
    return true;
  }

  queueFluid(wx, wy, wz) {
    const k = wx + ',' + wy + ',' + wz;
    if (!this.fluidQueue.has(k)) { this.fluidQueue.add(k); this.fluidQueueArr.push([wx, wy, wz]); }
  }

  updateSkyColumn(c, lx, wy, lz) {
    // recompute sky light for the column from top to bottom
    let lv = 15;
    const start = Math.min(WORLD_H - 1, Math.max(wy, 0));
    for (let y = WORLD_H - 1; y >= 0; y--) {
      const i = idx3(lx, y, lz);
      const id = c.blocks[i];
      if (id !== 0) {
        const bl = BLOCKS[id];
        if (bl.opaque) lv = 0;
        else if (id === B.water) lv = Math.max(0, lv - 2);
        else if (bl.shape === 'cross' || bl.key.includes('leaves')) lv = Math.max(0, lv - 1);
      }
      const cur = (c.light[i] >> 4);
      if (cur !== lv) {
        c.light[i] = (lv << 4) | (c.light[i] & 15);
        if (lv > 1) this.lightQueue.push([c.cx * CH + lx, y, c.cz * CH + lz, lv, true]);
      }
    }
  }
  removeSkyBelow(c, lx, wy, lz) { this.updateSkyColumn(c, lx, wy, lz); }

  removeBlockLight(wx, wy, wz) {
    // standard removal BFS for block light
    const c = this.getChunk(wx >> 4, wz >> 4);
    if (!c) return;
    const i = idx3(wx & 15, wy, wz & 15);
    const lvl = c.light[i] & 15;
    if (lvl === 0) return;
    c.light[i] = c.light[i] & 0xF0;
    let lastKey = null, lastChunk = null;
    const q = [[wx, wy, wz, lvl]];
    while (q.length) {
      const [x, y, z, l] = q.pop();
      for (const [dx, dy, dz] of NEIGH6) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (ny < 0 || ny >= WORLD_H) continue;
        const nk = (nx >> 4) + ',' + (nz >> 4);
        if (nk !== lastKey) { lastKey = nk; lastChunk = this.getChunk(nx >> 4, nz >> 4); }
        const nc = lastChunk;
        if (!nc || !nc.generated) continue;
        const ni = idx3(nx & 15, ny, nz & 15);
        const nl = nc.light[ni] & 15;
        if (nl !== 0 && nl < l) {
          nc.light[ni] = nc.light[ni] & 0xF0;
          nc.dirty = true;
          q.push([nx, ny, nz, nl]);
        } else if (nl >= l) {
          this.lightQueue.push([nx, ny, nz, nl, false]);
        }
      }
    }
  }

  processLightQueue(budget = 20000, timeMs = 6) {
    let n = 0;
    const t0 = performance.now();
    let lastKey = null, lastChunk = null;
    while (this.lightQueue.length && n < budget) {
      if (n > 0 && performance.now() - t0 > timeMs) break;
      const [x, y, z, lv, isSky] = this.lightQueue.shift();
      // spatially coherent queue: cache the last chunk lookup
      const ck = (x >> 4) + ',' + (z >> 4);
      if (ck !== lastKey) { lastKey = ck; lastChunk = this.getChunk(x >> 4, z >> 4); }
      const c = lastChunk;
      n++;
      if (!c || !c.generated) continue;
      const i = idx3(x & 15, y, z & 15);
      const cur = isSky ? (c.light[i] >> 4) : (c.light[i] & 15);
      if (cur > lv) continue; // stale (something brighter already lit it) — equal values still propagate
      // propagate
      for (const [dx, dy, dz] of NEIGH6) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (ny < 0 || ny >= WORLD_H) continue;
        const nid = this.getBlock(nx, ny, nz);
        if (nid < 0) continue;
        const nbl = BLOCKS[nid];
        let nlv = lv - 1;
        if (nbl.opaque) continue;
        if (nid === B.water) nlv = lv - 3;
        else if (isSky && dy === -1 && nbl.shape === 'none') nlv = lv; // sky goes straight down undimmed
        if (nlv <= 0) continue;
        const nc = this.getChunk(nx >> 4, nz >> 4);
        const ni = idx3(nx & 15, ny, nz & 15);
        const ncur = isSky ? (nc.light[ni] >> 4) : (nc.light[ni] & 15);
        if (ncur < nlv) {
          nc.light[ni] = isSky ? (nlv << 4) | (nc.light[ni] & 15) : (nc.light[ni] & 0xF0) | nlv;
          nc.dirty = true;
          this.lightQueue.push([nx, ny, nz, nlv, isSky]);
          if (++n > budget) break;
        }
      }
    }
  }

  // Fluid cellular simulation — process a few per tick
  tickFluids(maxN = 60) {
    if (!this.fluidQueueArr.length) return;
    // take ownership of the current queue; new schedules during processing
    // land in a fresh array so iteration cannot grow unbounded
    const arr = this.fluidQueueArr;
    this.fluidQueueArr = [];
    this.fluidQueue.clear();
    let processed = 0;
    const next = [];
    for (const [x, y, z] of arr) {
      if (processed >= maxN) { next.push([x, y, z]); continue; }
      processed++;
      const id = this.getBlock(x, y, z);
      if (id < 0) continue;
      const bl = BLOCKS[id];
      if (!bl.fluid) continue;
      const m = this.getMeta(x, y, z);
      const isSource = m === 0;
      const level = isSource ? 0 : (m & 7);
      const isWater = bl.fluid === 'water';
      // decay: non-source fluid with no source neighbor
      if (!isSource) {
        let fed = false;
        for (const [dx, dy, dz] of NEIGH6) {
          if (dy === -1) continue;
          const nid = this.getBlock(x + dx, y + dy, z + dz);
          if (nid < 0) continue;
          const nbl = BLOCKS[nid];
          const nm = this.getMeta(x + dx, y + dy, z + dz);
          if (nbl.fluid === bl.fluid) {
            if (nm === 0 || (dy === 1 && (nm & 8))) { fed = true; break; }
            if (dy === 0 && (nm & 7) < level) { fed = true; break; }
          }
          if (dy === 1 && nid === B.ice && isWater) { fed = true; break; }
        }
        if (!fed) {
          // check infinite water rule: 2+ adjacent sources
          let srcs = 0;
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nid = this.getBlock(x + dx, y, z + dz);
            if (nid >= 0 && BLOCKS[nid].fluid === bl.fluid && this.getMeta(x + dx, y, z + dz) === 0) srcs++;
          }
          const belowSolid = (() => { const b2 = this.getBlock(x, y - 1, z); return b2 >= 0 && BLOCKS[b2].solid && !BLOCKS[b2].fluid; })();
          if (isWater && srcs >= 2 && belowSolid) {
            this.setBlock(x, y, z, id, 0, { noUpdate: true });
            continue;
          }
          if (level >= 7) { this.setBlock(x, y, z, 0, 0, { noUpdate: true }); }
          else this.setBlock(x, y, z, id, level + 1, { noUpdate: true });
          continue;
        }
      }
      // lava+water interactions
      const other = isWater ? B.lava : B.water;
      for (const [dx, dy, dz] of NEIGH6) {
        const nid = this.getBlock(x + dx, y + dy, z + dz);
        if (nid === other) {
          if (isWater) this.setBlock(x + dx, y + dy, z + dz, this.getMeta(x + dx, y + dy, z + dz) === 0 ? B.obsidian : B.cobblestone, 0);
          else this.setBlock(x + dx, y + dy, z + dz, this.getMeta(x + dx, y + dy, z + dz) === 0 ? B.stone : B.cobblestone, 0);
          SFX.playNoiseBurst && SFX.playNoiseBurst(0.3, 600, 'lowpass', 0.3);
        }
      }
      // flow down
      const belowId = this.getBlock(x, y - 1, z);
      if (y > 0 && belowId >= 0) {
        const bbl = BLOCKS[belowId];
        if (belowId === 0) {
          this.setBlock(x, y - 1, z, id, 8 | 1, { noUpdate: true });
          continue;
        } else if (bbl.fluid === bl.fluid && this.getMeta(x, y - 1, z) !== 0) {
          this.setBlock(x, y - 1, z, id, 8 | 1, { noUpdate: true });
        } else if (!bbl.solid && !bbl.fluid && belowId !== 0) {
          // destroy plant below (flow through)
          this.setBlock(x, y - 1, z, id, 8 | 1, { noUpdate: true });
        }
      }
      // spread sideways
      const nextLevel = isSource ? 1 : level + 1;
      if (nextLevel <= 7 && (!isWater || G.dimension !== 1 ? true : false) && (this.dim === 1 ? isWater ? false : nextLevel <= 3 : true)) {
        // spread only if not falling
        if (!(m & 8) || isSource) {
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nid = this.getBlock(x + dx, y, z + dz);
            if (nid < 0) continue;
            const nbl = BLOCKS[nid];
            if (nid === 0) {
              this.setBlock(x + dx, y, z + dz, id, nextLevel, { noUpdate: true });
            } else if (nbl.fluid === bl.fluid) {
              const nm = this.getMeta(x + dx, y, z + dz);
              if (nm !== 0 && (nm & 7) > nextLevel) this.setBlock(x + dx, y, z + dz, id, nextLevel, { noUpdate: true });
            } else if (!nbl.solid && nbl.shape === 'cross') {
              this.setBlock(x + dx, y, z + dz, id, nextLevel, { noUpdate: true });
            }
          }
        }
      }
    }
    this.fluidQueueArr = next.concat(this.fluidQueueArr).slice(-4000);
  }
}

const NEIGH6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// Neighbor-update dispatch (redstone, plants supported, doors, etc.)
function World_updateNeighbors(wx, wy, wz, world) {
  for (const [dx, dy, dz] of NEIGH6) {
    const nx = wx + dx, ny = wy + dy, nz = wz + dz;
    const id = world.getBlock(nx, ny, nz);
    if (id <= 0) continue;
    const bl = BLOCKS[id];
    if (bl.key.includes('sapling') || bl.key === 'sugar_cane' || bl.key === 'wheat' || bl.shape === 'cross') {
      // support check: plants need solid ground below
      const below = world.getBlock(nx, ny - 1, nz);
      if (below >= 0 && !BLOCKS[below].solid) world.setBlock(nx, ny, nz, 0, 0, { noUpdate: false });
    }
  }
  // redstone network update
  if (typeof Redstone !== 'undefined') Redstone.onNeighborChanged(wx, wy, wz);
}
