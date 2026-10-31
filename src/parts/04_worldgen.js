// ============================================================================
// Part 04: World generation — biomes, terrain, caves, ores, features
// Fully deterministic from seed (multiplayer peers generate identical worlds)
// ============================================================================
const BIOMES = {
  ocean:       { name: 'Ocean', surface: ['sand', 'gravel', 'dirt'], tree: null, snow: false, waterTint: 1 },
  beach:       { name: 'Beach', surface: ['sand'], under: 'sandstone', tree: null, snow: false },
  plains:      { name: 'Plains', surface: ['grass_block'], tree: 'oak', treeChance: .05, flowers: 8, grass: 22, snow: false },
  forest:      { name: 'Forest', surface: ['grass_block'], tree: 'oak', treeChance: .5, flowers: 5, grass: 18, snow: false },
  birch_forest:{ name: 'Birch Forest', surface: ['grass_block'], tree: 'birch', treeChance: .45, flowers: 5, grass: 16, snow: false },
  taiga:       { name: 'Taiga', surface: ['grass_block', 'podzol'], tree: 'spruce', treeChance: .45, grass: 8, snow: false },
  snowy_plains:{ name: 'Snowy Plains', surface: ['grass_block'], tree: 'spruce', treeChance: .08, grass: 2, snow: true },
  snowy_taiga: { name: 'Snowy Taiga', surface: ['grass_block', 'podzol'], tree: 'spruce', treeChance: .4, grass: 2, snow: true },
  desert:      { name: 'Desert', surface: ['sand'], under: 'sandstone', tree: 'cactus', treeChance: .18, deadBush: 4, snow: false },
  savanna:     { name: 'Savanna', surface: ['grass_block'], tree: 'acacia', treeChance: .12, grass: 28, snow: false },
  mountains:   { name: 'Mountains', surface: ['grass_block', 'stone'], tree: 'spruce', treeChance: .15, snow: false, rocky: true },
  snowy_mountains: { name: 'Snowy Mountains', surface: ['grass_block', 'stone', 'snow_block'], tree: 'spruce', treeChance: .05, snow: true, rocky: true },
  river:       { name: 'River', surface: ['sand', 'dirt', 'gravel'], tree: null, snow: false },
  nether:      { name: 'Nether', surface: ['netherrack'], tree: null, snow: false },
  end:         { name: 'The End', surface: ['end_stone'], tree: null, snow: false },
};

class WorldGen {
  constructor(seed, dim = 0) {
    this.seed = seed | 0;
    this.dim = dim;
    this.nContinent = new Noise2D(seed ^ 0x1);
    this.nDetail = new Noise2D(seed ^ 0x2);
    this.nTemp = new Noise2D(seed ^ 0x3);
    this.nHum = new Noise2D(seed ^ 0x4);
    this.nWeird = new Noise2D(seed ^ 0x5);
    this.nMount = new Noise2D(seed ^ 0x6);
    this.nRiver = new Noise2D(seed ^ 0x7);
    this.nCaveA = new Noise3D(seed ^ 0x11);
    this.nCaveB = new Noise3D(seed ^ 0x12);
    this.nCavern = new Noise3D(seed ^ 0x13);
    this.nNether = new Noise3D(seed ^ 0x21);
    this.nNether2 = new Noise3D(seed ^ 0x22);
    this._colCache = new Map();
    this._featCache = new Map();
  }

  col(wx, wz) {
    const key = wx + ',' + wz;
    let c = this._colCache.get(key);
    if (c) return c;
    const s = 1 / 340;
    const cont = this.nContinent.fbm(wx * s, wz * s, 5, 2, .5);          // -1..1
    const temp = this.nTemp.fbm(wx * s * .65, wz * s * .65, 3, 2, .5);
    const hum = this.nHum.fbm(wx * s * .8, wz * s * .8, 3, 2, .5);
    const weird = this.nWeird.fbm(wx * s * 1.3, wz * s * 1.3, 2, 2, .5);
    const ds = 1 / 55;
    const detail = this.nDetail.fbm(wx * ds, wz * ds, 4, 2, .5);
    const ms = 1 / 210;
    const mount = Math.abs(this.nMount.fbm(wx * ms, wz * ms, 4, 2, .55));

    let biome, h;
    if (cont < -0.26) { // ocean
      const d = (-0.26 - cont);
      h = Math.round(SEA_LEVEL - 6 - d * 52);
      biome = d > 0.42 ? 'ocean' : 'ocean';
    } else if (cont < -0.185) { // beach
      h = Math.round(SEA_LEVEL + 1 + detail * 2);
      biome = 'beach';
    } else {
      const land = cont + 0.185;
      h = Math.round(SEA_LEVEL + 2 + land * 22 + detail * 6);
      const isMount = mount > 0.62 && land > 0.1;
      if (isMount) {
        h += Math.round((mount - 0.62) * 130 * (0.5 + land));
        h = Math.min(h, WORLD_H - 12);
      }
      // rivers carve through land
      const rv = Math.abs(this.nRiver.fbm(wx * (1 / 620), wz * (1 / 620), 2, 2, .5));
      if (rv < 0.035 && !isMount) {
        const t = 1 - rv / 0.035;
        h = Math.round(lerp(h, SEA_LEVEL - 3, Math.min(1, t * 1.6)));
        if (h < SEA_LEVEL + 1) biome = 'river';
      }
      if (!biome) {
        if (temp < -0.42) biome = isMount ? 'snowy_mountains' : (hum > 0 ? 'snowy_taiga' : 'snowy_plains');
        else if (isMount) biome = 'mountains';
        else if (temp > 0.5 && hum < -0.12) biome = 'desert';
        else if (temp > 0.32 && hum < 0.15) biome = 'savanna';
        else if (hum > 0.16) biome = weird > 0.25 ? 'birch_forest' : 'forest';
        else biome = 'plains';
      }
      if (biome === 'snowy_mountains') { /* keep */ }
      else if (isMount && biome !== 'desert' && h > 92 && temp < -0.1) biome = 'snowy_mountains';
    }
    h = clamp(h, 4, WORLD_H - 8);
    c = { h, biome, temp, hum };
    this._colCache.set(key, c);
    if (this._colCache.size > 60000) { // simple reset to bound memory
      const it = this._colCache.keys();
      for (let i = 0; i < 5000; i++) this._colCache.delete(it.next().value);
    }
    return c;
  }

  heightAt(wx, wz) { return this.col(wx, wz).h; }
  biomeAt(wx, wz) { return this.col(wx, wz).biome; }

  // ---------- Ore veins ----------
  static ORES(dim) {
    if (dim === 1) return [
      { block: 'nether_quartz_ore', tries: 12, minY: 8, maxY: 110, size: 12 },
      { block: 'nether_gold_ore', tries: 4, minY: 8, maxY: 110, size: 8 },
      { block: 'ancient_debris', tries: 1, minY: 8, maxY: 22, size: 2 },
    ];
    return [
      { block: 'coal_ore', tries: 16, minY: 5, maxY: 110, size: 14 },
      { block: 'iron_ore', tries: 14, minY: 2, maxY: 66, size: 9 },
      { block: 'copper_ore', tries: 9, minY: 40, maxY: 72, size: 11 },
      { block: 'gold_ore', tries: 3, minY: 2, maxY: 34, size: 8 },
      { block: 'redstone_ore', tries: 6, minY: 2, maxY: 17, size: 8 },
      { block: 'lapis_ore', tries: 2, minY: 2, maxY: 32, size: 6 },
      { block: 'diamond_ore', tries: 2, minY: 2, maxY: 17, size: 7 },
      { block: 'emerald_ore', tries: 3, minY: 60, maxY: 120, size: 1, mountainOnly: true },
      { block: 'granite', tries: 6, minY: 2, maxY: 110, size: 30 },
      { block: 'diorite', tries: 6, minY: 2, maxY: 110, size: 30 },
      { block: 'andesite', tries: 6, minY: 2, maxY: 110, size: 30 },
      { block: 'gravel', tries: 3, minY: 4, maxY: 110, size: 26 },
      { block: 'dirt', tries: 6, minY: 4, maxY: 110, size: 28 },
    ];
  }

  // ---------- Features (trees, plants, dungeons) — deterministic per chunk ----------
  featuresOf(cx, cz) {
    const key = cx + ',' + cz;
    let f = this._featCache.get(key);
    if (f) return f;
    f = [];
    if (this.dim === 0) {
      const rng = mulberry32((Math.imul(cx, 341873128) ^ Math.imul(cz, 132897987) ^ this.seed ^ 0x5BD1) >>> 0);
      const centerX = cx * CH + 8, centerZ = cz * CH + 8;
      const { biome, h: ch } = this.col(centerX, centerZ);
      const bio = BIOMES[biome];
      // trees
      if (bio.tree && bio.tree !== 'cactus') {
        const attempts = biome === 'forest' || biome === 'birch_forest' || biome === 'taiga' ? 9 : (biome === 'snowy_taiga' ? 7 : 4);
        for (let i = 0; i < attempts; i++) {
          if (rng() > (bio.treeChance ?? .1)) continue;
          const tx = cx * CH + (rng() * CH) | 0, tz = cz * CH + (rng() * CH) | 0;
          const col = this.col(tx, tz);
          if (!BIOMES[col.biome].tree || col.biome === 'desert') continue;
          const type = BIOMES[col.biome].tree === 'oak' && rng() < .1 ? 'dark_oak' : BIOMES[col.biome].tree;
          const th = type === 'spruce' ? 6 + (rng() * 4) | 0 : type === 'birch' ? 5 + (rng() * 3) | 0 : 4 + (rng() * 3) | 0;
          f.push({ type: 'tree', x: tx, y: col.h + 1, z: tz, tree: type, h: th, seedR: (rng() * 1e9) | 0 });
        }
      }
      if (biome === 'desert') {
        for (let i = 0; i < 4; i++) if (rng() < .45) {
          const tx = cx * CH + (rng() * CH) | 0, tz = cz * CH + (rng() * CH) | 0;
          const col = this.col(tx, tz);
          if (col.biome === 'desert') f.push({ type: 'cactus', x: tx, y: col.h + 1, z: tz, h: 1 + (rng() * 3) | 0 });
        }
        for (let i = 0; i < 3; i++) if (rng() < .5) {
          const tx = cx * CH + (rng() * CH) | 0, tz = cz * CH + (rng() * CH) | 0;
          const col = this.col(tx, tz);
          if (col.biome === 'desert') f.push({ type: 'dead_bush', x: tx, y: col.h + 1, z: tz });
        }
      }
      // grass & flowers
      const gr = bio.grass ?? 0, fl = bio.flowers ?? 0;
      for (let i = 0; i < gr; i++) if (rng() < .8) {
        const tx = cx * CH + (rng() * CH) | 0, tz = cz * CH + (rng() * CH) | 0;
        const col = this.col(tx, tz);
        if (BIOMES[col.biome].surface?.[0] === 'grass_block') f.push({ type: rng() < .15 ? 'fern' : 'short_grass', x: tx, y: col.h + 1, z: tz });
      }
      const FLOWERS = ['dandelion', 'poppy', 'blue_orchid', 'allium', 'cornflower', 'oxeye_daisy', 'red_tulip'];
      for (let i = 0; i < fl; i++) if (rng() < .5) {
        const tx = cx * CH + (rng() * CH) | 0, tz = cz * CH + (rng() * CH) | 0;
        const col = this.col(tx, tz);
        if (BIOMES[col.biome].surface?.[0] === 'grass_block') f.push({ type: 'flower', block: FLOWERS[(rng() * FLOWERS.length) | 0], x: tx, y: col.h + 1, z: tz });
      }
      // pumpkins & melons rare
      if (rng() < .04) {
        const tx = cx * CH + (rng() * CH) | 0, tz = cz * CH + (rng() * CH) | 0;
        const col = this.col(tx, tz);
        if (BIOMES[col.biome].surface?.[0] === 'grass_block') f.push({ type: rng() < .6 ? 'pumpkin' : 'melon', x: tx, y: col.h + 1, z: tz });
      }
      // dungeons
      for (let i = 0; i < 3; i++) if (rng() < .5) {
        const tx = cx * CH + 2 + (rng() * 12) | 0, tz = cz * CH + 2 + (rng() * 12) | 0;
        const ty = 8 + (rng() * 32) | 0;
        f.push({ type: 'dungeon', x: tx, y: ty, z: tz, seedR: (rng() * 1e9) | 0 });
      }
      // villages: rare hut with a resident (plains/savanna/desert only)
      if ((biome === 'plains' || biome === 'savanna' || biome === 'desert') && rng() < 0.018) {
        const tx = cx * CH + 4 + (rng() * 8) | 0, tz = cz * CH + 4 + (rng() * 8) | 0;
        const col = this.col(tx, tz);
        if (col.h > SEA_LEVEL + 1 && !BIOMES[col.biome].snow) {
          f.push({ type: 'village', x: tx, y: col.h + 1, z: tz, seedR: (rng() * 1e9) | 0 });
        }
      }
    }
    this._featCache.set(key, f);
    if (this._featCache.size > 4000) this._featCache.clear();
    return f;
  }

  // Apply a feature writing only blocks inside chunk bounds [cx*CH, cx*CH+16)
  applyFeature(feat, blocks, meta, cx, cz, setFn) {
    const x0 = cx * CH, z0 = cz * CH;
    const inCh = (x, y, z) => x >= x0 && x < x0 + CH && z >= z0 && z < z0 + CH && y >= 0 && y < WORLD_H;
    const put = (x, y, z, id, m = 0, force = false) => { if (inCh(x, y, z)) setFn(x - x0, y, z - z0, id, m, force); };
    const rng = mulberry32(feat.seedR || 1);

    if (feat.type === 'tree') {
      const logId = B[feat.tree === 'dark_oak' ? 'dark_oak_log' : feat.tree + '_log'];
      const leafId = B[feat.tree + '_leaves'];
      const h = feat.h;
      for (let i = 0; i < h; i++) put(feat.x, feat.y + i, feat.z, logId, 0, true);
      const top = feat.y + h - 1;
      if (feat.tree === 'spruce') {
        let r = 2;
        for (let y = feat.y + 2; y <= top; y += 2) {
          for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++)
            if (Math.abs(dx) + Math.abs(dz) <= r + 1 && !(dx === 0 && dz === 0)) put(feat.x + dx, y, feat.z + dz, leafId, 1);
          r = r === 2 ? 1 : 2;
        }
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (Math.abs(dx) + Math.abs(dz) <= 1) put(feat.x + dx, top + 1, feat.z + dz, leafId, 1);
        put(feat.x, top + 2, feat.z, leafId, 1);
      } else if (feat.tree === 'acacia') {
        for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (dx * dx + dz * dz <= 10) put(feat.x + dx, top, feat.z + dz, leafId, 1);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (Math.abs(dx) + Math.abs(dz) <= 1) put(feat.x + dx, top + 1, feat.z + dz, leafId, 1);
      } else {
        for (let dy = -2; dy <= 0; dy++) {
          const r = dy === 0 ? 1 : 2;
          for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
            if (Math.abs(dx) === r && Math.abs(dz) === r && rng() < .5) continue;
            if (!(dx === 0 && dz === 0 && dy < 0)) put(feat.x + dx, top + dy, feat.z + dz, leafId, 1);
          }
        }
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (Math.abs(dx) + Math.abs(dz) <= 1) put(feat.x + dx, top + 1, feat.z + dz, leafId, 1);
      }
    } else if (feat.type === 'cactus') {
      const cid = B.cactus;
      for (let i = 0; i < feat.h; i++) put(feat.x, feat.y + i, feat.z, cid);
    } else if (feat.type === 'dead_bush') {
      put(feat.x, feat.y, feat.z, B.dead_bush);
    } else if (feat.type === 'short_grass' || feat.type === 'fern') {
      put(feat.x, feat.y, feat.z, B[feat.type]);
    } else if (feat.type === 'flower') {
      put(feat.x, feat.y, feat.z, B[feat.block]);
    } else if (feat.type === 'pumpkin') {
      put(feat.x, feat.y, feat.z, B.pumpkin, 2);
    } else if (feat.type === 'melon') {
      put(feat.x, feat.y, feat.z, B.melon);
    } else if (feat.type === 'village') {
      // 5x5 hut: plank floor, log corners, plank walls, plank roof, doorway, torch, farm patch
      const floorId = B.oak_planks, wallId = B.oak_planks, logId = B.oak_log;
      const y0 = feat.y;
      // clear interior + floor
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        for (let dy = 0; dy < 5; dy++) put(feat.x + dx, y0 + dy, feat.z + dz, 0, 0, true);
        put(feat.x + dx, y0 - 1, feat.z + dz, floorId, 0, true);
      }
      // walls
      for (let dy = 0; dy < 3; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        if (!edge) continue;
        const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
        put(feat.x + dx, y0 + dy, feat.z + dz, corner ? logId : wallId, 0, true);
      }
      // roof
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) put(feat.x + dx, y0 + 3, feat.z + dz, logId, 0, true);
      // doorway (+z side)
      put(feat.x, y0, feat.z + 2, 0, 0, true);
      put(feat.x, y0 + 1, feat.z + 2, 0, 0, true);
      // torch inside
      put(feat.x - 1, y0 + 1, feat.z - 1, B.torch, 0, true);
      // farm patch beside the hut
      for (let dx = 3; dx <= 5; dx++) for (let dz = -1; dz <= 1; dz++) {
        put(feat.x + dx, y0 - 1, feat.z + dz, B.dirt, 0, true);
        put(feat.x + dx, y0, feat.z + dz, rng() < .8 ? B.wheat : B.water, rng() < .8 ? 7 : 0, true);
      }
      // register villagers to spawn when this chunk generates
      this._pendingTE = this._pendingTE || [];
      if (inCh(feat.x, y0, feat.z)) {
        this._pendingTE.push({ x: feat.x, y: y0, z: feat.z, type: 'village', villagers: 2 });
      }
    } else if (feat.type === 'dungeon') {
      const w = 3 + ((mulberry32(feat.seedR)() * 2) | 0), d = 3 + ((mulberry32(feat.seedR ^ 7)() * 2) | 0);
      const cobble = B.cobblestone, mossy = B.mossy_cobblestone;
      for (let dx = -w; dx <= w; dx++) for (let dz = -d; dz <= d; dz++) for (let dy = 0; dy < 5; dy++) {
        const isShell = Math.abs(dx) === w || Math.abs(dz) === d || dy === 0 || dy === 4;
        const x = feat.x + dx, y = feat.y + dy, z = feat.z + dz;
        if (isShell) put(x, y, z, rng() < .3 ? mossy : cobble, 0, true);
        else put(x, y, z, 0, 0, true);
      }
      put(feat.x, feat.y + 1, feat.z, B.spawner, 0, true);
      const chestSide = rng() < .5 ? 1 : -1;
      const cxp = feat.x + (rng() < .5 ? w - 1 : -(w - 1)) * 1, czp = feat.z + chestSide * (d - 1);
      put(cxp, feat.y + 1, czp, B.chest, rng() < .5 ? 0 : 2, true);
      // chest loot registered as tile entity by caller via pendingTE list
      this._pendingTE = this._pendingTE || [];
      if (inCh(cxp, feat.y + 1, czp)) {
        const loot = [];
        const lootTable = [['iron_ingot', 1, 4, .6], ['bread', 1, 3, .7], ['wheat_seeds', 2, 6, .5], ['gunpowder', 1, 4, .5], ['string', 1, 4, .5], ['bone', 1, 4, .6], ['redstone', 1, 4, .4], ['golden_apple', 1, 1, .06], ['bucket', 1, 1, .2], ['saddle', 1, 1, .25]];
        for (const [k, mn, mx, p] of lootTable) if (rng() < p) loot.push({ item: k, count: mn + ((rng() * (mx - mn + 1)) | 0) });
        this._pendingTE.push({ x: cxp, y: feat.y + 1, z: czp, type: 'chest', items: loot, facing: 2 });
      }
    }
  }

  // ---------- Main chunk generation ----------
  generateChunk(cx, cz) {
    const blocks = new Uint16Array(CHUNK_VOL);
    const meta = new Uint8Array(CHUNK_VOL);
    const biomes = new Array(256);
    const heights = new Uint8Array(256);
    const x0 = cx * CH, z0 = cz * CH;
    this._pendingTE = [];

    if (this.dim === 0) this.genOverworld(cx, cz, blocks, meta, biomes, heights);
    else if (this.dim === 1) this.genNether(cx, cz, blocks, meta);
    else this.genEnd(cx, cz, blocks, meta);

    // apply features from 3x3 neighborhood (trees can cross borders)
    if (this.dim === 0) {
      const setF = (lx, y, lz, id, m, force) => {
        const i = idx3(lx, y, lz);
        if (force || blocks[i] === 0) { blocks[i] = id; meta[i] = m; }
      };
      for (let nx = cx - 1; nx <= cx + 1; nx++) for (let nz = cz - 1; nz <= cz + 1; nz++) {
        for (const feat of this.featuresOf(nx, nz)) this.applyFeature(feat, blocks, meta, cx, cz, setF);
      }
      // features (trees!) grow ABOVE the recorded terrain height — recompute the
      // heightmap from the actual block data, or the mesher's heightmap skip
      // never meshes the canopy
      for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
        for (let y = WORLD_H - 1; y >= 0; y--) {
          if (blocks[idx3(lx, y, lz)] !== 0) { heights[lz * CH + lx] = y; break; }
        }
      }
    }
    return { blocks, meta, biomes, heights, pendingTE: this._pendingTE };
  }

  genOverworld(cx, cz, blocks, meta, biomes, heights) {
    const x0 = cx * CH, z0 = cz * CH;
    const stoneId = B.stone, deepId = B.deepslate, waterId = B.water, bedrockId = B.bedrock;
    for (let lz = 0; lz < CH; lz++) {
      for (let lx = 0; lx < CH; lx++) {
        const wx = x0 + lx, wz = z0 + lz;
        const { h, biome } = this.col(wx, wz);
        const bio = BIOMES[biome];
        biomes[lz * CH + lx] = biome;
        heights[lz * CH + lx] = h;
        const deepY = 6 + ((hash2i(wx, wz, this.seed ^ 0xABC) * 5) | 0);
        const underwater = h < SEA_LEVEL;
        const surfSet = bio.surface;
        // pick surface material per column (stable)
        const si = (hash2i(wx, wz, this.seed ^ 0x77) * surfSet.length) | 0;
        const surf = B[surfSet[si]];
        const under = bio.under ? B[bio.under] : B.dirt;
        const dirtDepth = 3 + ((hash2i(wx, wz, this.seed ^ 0x99) * 2) | 0);

        for (let y = 0; y <= Math.max(h, SEA_LEVEL); y++) {
          const i = idx3(lx, y, lz);
          let id = 0;
          if (y === 0 || (y < 3 && hash3i(wx, y, wz, this.seed ^ 0xBED) < 0.5 - y * 0.2)) id = bedrockId;
          else if (y <= h) {
            if (y === h) id = underwater ? (hash2i(wx, wz, this.seed ^ 0x31) < .5 ? surf : B.gravel) : surf;
            else if (y > h - dirtDepth) id = biome === 'desert' || biome === 'beach' ? under : (bio.rocky && h > 90 ? stoneId : B.dirt);
            else id = y < deepY ? deepId : stoneId;
          } else if (y <= SEA_LEVEL) id = waterId;
          blocks[i] = id;
        }
        // caves
        const caveTop = underwater ? h - 3 : h;
        for (let y = 1; y < caveTop; y++) {
          const i = idx3(lx, y, lz);
          if (blocks[i] === bedrockId) continue;
          if (blocks[i] === 0) continue;
          const cs = 1 / 42;
          const a = this.nCaveA.sample(wx * cs, y * cs * 1.6, wz * cs);
          const b = this.nCaveB.sample(wx * cs, y * cs * 1.6, wz * cs);
          const spaghetti = Math.abs(a) < 0.058 && Math.abs(b) < 0.072;
          const cavern = y < 38 && this.nCavern.fbm(wx * (1 / 58), y * (1 / 40), wz * (1 / 58), 2) > 0.66;
          if (spaghetti || cavern) {
            blocks[i] = y < 11 ? B.lava : 0;
            if (y < 11) meta[i] = 0;
          }
        }
        // snow overlay
        if (bio.snow && !underwater) {
          const i = idx3(lx, h + 1, lz);
          if (blocks[idx3(lx, h, lz)] !== 0 && blocks[i] === 0 && BLOCKS[blocks[idx3(lx, h, lz)]].solid) {
            blocks[i] = B.snow_layer;
          }
          if (bio.rocky && h > 96) { const j = idx3(lx, h, lz); if (blocks[j] !== 0) blocks[j] = B.snow_block; }
        }
        // freeze water surface in snowy biomes
        if (bio.snow && underwater === false && h === SEA_LEVEL - 1) { /* edge case skip */ }
        if (bio.snow) {
          const iw = idx3(lx, SEA_LEVEL, lz);
          if (blocks[iw] === waterId) blocks[iw] = B.ice;
        }
        // sugar cane near water
        if (!underwater && h >= SEA_LEVEL && h <= SEA_LEVEL + 2 && hash2i(wx, wz, this.seed ^ 0xCA4E) < 0.10) {
          let nearWater = false;
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (this.heightAt(wx + dx, wz + dz) < SEA_LEVEL) { nearWater = true; break; }
          }
          if (nearWater && (blocks[idx3(lx, h, lz)] === B.grass_block || blocks[idx3(lx, h, lz)] === B.sand || blocks[idx3(lx, h, lz)] === B.dirt)) {
            const caneH = 1 + ((hash2i(wx, wz, this.seed ^ 0xC2) * 3) | 0);
            for (let k = 1; k <= caneH; k++) { const ii = idx3(lx, h + k, lz); if (blocks[ii] === 0) blocks[ii] = B.sugar_cane; }
          }
        }
      }
    }
    // ores
    const rng = mulberry32((Math.imul(cx, 668265263) ^ Math.imul(cz, 374761393) ^ this.seed ^ 0x0BE5) >>> 0);
    for (const ore of WorldGen.ORES(0)) {
      for (let t = 0; t < ore.tries; t++) {
        const ox = (rng() * CH) | 0, oz = (rng() * CH) | 0;
        const oy = ore.minY + (rng() * (ore.maxY - ore.minY)) | 0;
        if (ore.mountainOnly) {
          const { biome } = this.col(x0 + ox, z0 + oz);
          if (!biome.includes('mountain')) continue;
        }
        const oreId = B[ore.block];
        let px = ox, py = oy, pz = oz;
        for (let s = 0; s < ore.size; s++) {
          if (px >= 0 && px < CH && pz >= 0 && pz < CH && py > 0 && py < WORLD_H) {
            const i = idx3(px, py, pz);
            const cur = blocks[i];
            if (cur === stoneId) blocks[i] = oreId;
            else if (cur === deepId && ore.block.includes('ore')) blocks[i] = B['deepslate_' + ore.block.split('_')[0] + '_ore'] || oreId;
          }
          px += (rng() * 3 | 0) - 1; py += (rng() * 3 | 0) - 1; pz += (rng() * 3 | 0) - 1;
        }
      }
    }
  }

  genNether(cx, cz, blocks, meta) {
    const x0 = cx * CH, z0 = cz * CH;
    const nr = B.netherrack, lavaId = B.lava;
    for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
      const wx = x0 + lx, wz = z0 + lz;
      for (let y = 0; y < WORLD_H; y++) {
        const i = idx3(lx, y, lz);
        let id = 0;
        if (y === 0 || y === 127) id = nr;
        else if (y < 32) id = nr;
        else if (y > 100) id = nr;
        else {
          const d1 = this.nNether.fbm(wx * (1 / 48), y * (1 / 30), wz * (1 / 48), 3);
          const d2 = this.nNether2.fbm(wx * (1 / 70), y * (1 / 44), wz * (1 / 70), 2);
          const density = d1 * .65 + d2 * .35 + (y < 40 ? (40 - y) * 0.012 : 0) + (y > 85 ? (y - 85) * 0.012 : 0);
          id = density > 0.08 ? nr : 0;
        }
        blocks[i] = id;
      }
      // lava sea
      for (let y = 1; y <= 31; y++) { const i = idx3(lx, y, lz); if (blocks[i] === 0) blocks[i] = lavaId; }
      // glowstone clusters hanging
      const gs = hash2i(wx, wz, this.seed ^ 0x610);
      if (gs < 0.008) {
        const gy = 96 + ((hash2i(wx, wz, this.seed ^ 0x611) * 24) | 0);
        for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 3; dy++) {
          const i = idx3(lx, gy - dy, lz);
          if (gy - dy > 32 && gy - dy < 127 && blocks[i] === 0) blocks[i] = B.glowstone;
        }
      }
      // soul sand & basalt patches on floor areas
      const ss = hash2i(wx, wz, this.seed ^ 0x501);
      for (let y = 32; y < 90; y++) {
        const i = idx3(lx, y, lz);
        if (blocks[i] === nr && blocks[idx3(lx, y + 1, lz)] === 0) {
          if (ss < 0.18) {
            blocks[i] = B.soul_sand;
            // nether wart patches grow on soul sand
            if (hash2i(wx, wz, this.seed ^ 0x5A2) < 0.12) blocks[idx3(lx, y + 1, lz)] = B.nether_wart;
          }
          else if (ss > 0.93) blocks[i] = B.basalt;
          break;
        }
      }
    }
    const rng = mulberry32((Math.imul(cx, 2246822519) ^ Math.imul(cz, 668265263) ^ this.seed ^ 0xE7) >>> 0);
    for (const ore of WorldGen.ORES(1)) {
      for (let t = 0; t < ore.tries; t++) {
        const ox = (rng() * CH) | 0, oz = (rng() * CH) | 0, oy = ore.minY + (rng() * (ore.maxY - ore.minY)) | 0;
        let px = ox, py = oy, pz = oz;
        for (let s = 0; s < ore.size; s++) {
          if (px >= 0 && px < CH && pz >= 0 && pz < CH && py > 0 && py < WORLD_H) {
            const i = idx3(px, py, pz);
            if (blocks[i] === nr) blocks[i] = B[ore.block];
          }
          px += (rng() * 3 | 0) - 1; py += (rng() * 3 | 0) - 1; pz += (rng() * 3 | 0) - 1;
        }
      }
    }
  }

  genEnd(cx, cz, blocks, meta) {
    const x0 = cx * CH, z0 = cz * CH;
    const es = B.end_stone;
    for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
      const wx = x0 + lx, wz = z0 + lz;
      const r = Math.hypot(wx, wz);
      if (r < 110) {
        const thick = (1 - r / 110) * 22 * (0.6 + this.nDetail.fbm(wx * (1 / 40), wz * (1 / 40), 3, 2, .5) * 0.4 + 0.2);
        const top = 66 + ((this.nDetail.sample(wx * (1 / 26), wz * (1 / 26)) * 5) | 0);
        for (let y = Math.max(1, top - thick) | 0; y <= top; y++) {
          if (r < 100 || this.nCaveA.sample(wx * (1 / 30), y * (1 / 30), wz * (1 / 30)) > 0.25) blocks[idx3(lx, y, lz)] = es;
        }
      }
    }
    // obsidian pillars (deterministic ring of 10)
    for (let p = 0; p < 10; p++) {
      const ang = p / 10 * Math.PI * 2;
      const pxw = Math.round(Math.cos(ang) * 42), pzw = Math.round(Math.sin(ang) * 42);
      const pcx = Math.floor(pxw / CH), pcz = Math.floor(pzw / CH);
      if (pcx === cx && pcz === cz) {
        const h = 78 + ((mulberry32(this.seed ^ (p * 7919))() * 18) | 0);
        const pr = 3;
        for (let dx = -pr; dx <= pr; dx++) for (let dz = -pr; dz <= pr; dz++) {
          if (dx * dx + dz * dz > pr * pr) continue;
          for (let y = 40; y <= h; y++) blocks[idx3(pxw + dx - x0, y, pzw + dz - z0)] = B.obsidian;
        }
      }
    }
  }
}

// Find a decent spawn point (land, not in water)
function findSpawn(gen) {
  for (let r = 0; r < 64; r += 4) {
    for (let a = 0; a < 12; a++) {
      const ang = a / 12 * Math.PI * 2;
      const x = Math.round(Math.cos(ang) * r * 8), z = Math.round(Math.sin(ang) * r * 8);
      const col = gen.col(x, z);
      if (col.h > SEA_LEVEL && col.biome !== 'ocean' && col.biome !== 'river' && col.biome !== 'beach') {
        return [x + .5, col.h + 2, z + .5];
      }
    }
  }
  return [0.5, gen.col(0, 0).h + 2, 0.5];
}
