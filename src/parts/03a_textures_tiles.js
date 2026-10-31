// ============================================================================
// Part 03a: Procedural texture atlas — original pixel art painted by code
// Every texture in this game is generated at runtime. No external assets.
// ============================================================================
const C = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const sh = (c, f) => [clamp(c[0] * f, 0, 255) | 0, clamp(c[1] * f, 0, 255) | 0, clamp(c[2] * f, 0, 255) | 0];
const mixc = (a, b, t) => [lerp(a[0], b[0], t) | 0, lerp(a[1], b[1], t) | 0, lerp(a[2], b[2], t) | 0];

const TILE_SIZE = 16;
const ATLAS_COLS = 32, ATLAS_ROWS = 32;
const TILE = new Map();
function regTile(name) { if (!TILE.has(name)) TILE.set(name, TILE.size); return TILE.get(name); }

function makePaintCtx(img, seed) {
  const d = img.data, rng = mulberry32(seed);
  const api = {
    rng, w: TILE_SIZE, h: TILE_SIZE,
    px(x, y, c, a = 255) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x > 15 || y > 15) return;
      const i = (y * 16 + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a;
    },
    get(x, y) { const i = ((y & 15) * 16 + (x & 15)) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; },
    rect(x, y, w, h, c, a = 255) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) api.px(xx, yy, c, a); },
    fill(c, a = 255) { api.rect(0, 0, 16, 16, c, a); },
    clear() { api.rect(0, 0, 16, 16, [0, 0, 0], 0); },
    noise(c1, c2, p = 0.5) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) api.px(x, y, rng() < p ? c1 : c2); },
    vary(base, amt = 0.12) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) api.px(x, y, sh(base, 1 + (rng() - 0.5) * 2 * amt)); },
    specks(c, n, a = 255) { for (let i = 0; i < n; i++) api.px((rng() * 16) | 0, (rng() * 16) | 0, c, a); },
    borderShade(f1 = 1.18, f2 = 0.82) {
      for (let i = 0; i < 16; i++) {
        const t1 = api.get(i, 0), t2 = api.get(i, 15), l1 = api.get(0, i), l2 = api.get(15, i);
        api.px(i, 0, sh(t1, f1), t1[3]); api.px(i, 15, sh(t2, f2), t2[3]);
        const ll1 = api.get(0, i), ll2 = api.get(15, i);
        api.px(0, i, sh(ll1, f1), ll1[3]); api.px(15, i, sh(ll2, f2), ll2[3]);
      }
    },
    blobs(c, n, rMin, rMax, a = 255) {
      for (let i = 0; i < n; i++) {
        const cx = rng() * 16, cy = rng() * 16, r = rMin + rng() * (rMax - rMin);
        for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const dx = x + .5 - cx, dy = y + .5 - cy;
          if (dx * dx + dy * dy <= r * r + (rng() - .5)) api.px(x, y, sh(c, 1 + (rng() - .5) * .25), a);
        }
      }
    },
    hline(y, c, x0 = 0, x1 = 15) { for (let x = x0; x <= x1; x++) api.px(x, y, c); },
    vline(x, y0, y1, c) { for (let y = y0; y <= y1; y++) api.px(x, y, c); },
  };
  return api;
}

// ---------- Shared palettes ----------
const PAL = {
  stone: C('#7d7d7d'), deepslate: C('#4c4c50'), dirt: C('#866043'), grass: C('#7cbd4f'), grassDry: C('#9cbb58'),
  sand: C('#dbd3a0'), gravel: C('#847e7e'), wood: C('#9c7f4e'), woodDark: C('#6b5433'),
  oak: C('#a3824c'), spruce: C('#6e502f'), birch: C('#d7cb8d'), acacia: C('#b06434'), darkoak: C('#4f3722'),
  leafOak: C('#4a8f2e'), leafSpruce: C('#38603a'), leafBirch: C('#71a74d'), leafAcacia: C('#719a35'), leafDark: C('#3f6426'),
  water: C('#3f76e4'), lava: C('#d96415'), snow: C('#f2fbfb'), bedrock: C('#565656'),
  obsid: C('#1b1123'), nether: C('#7a3535'), end: C('#dbe08f'),
  coalG: C('#2e2e2e'), ironG: C('#d8af93'), copperG: C('#e07a4f'), goldG: C('#fcee4b'), redG: C('#ff2020'),
  lapisG: C('#2b53c9'), diaG: C('#4de0d8'), emG: C('#41f384'), quartzG: C('#ece9e2'),
};

const TILE_PAINTERS = {};
const TP = (n, fn) => { regTile(n); TILE_PAINTERS[n] = fn; };

// ---------- Stone family ----------
TP('stone', t => { t.vary(PAL.stone, .1); t.specks(sh(PAL.stone, .85), 22); t.specks(sh(PAL.stone, 1.1), 14); });
TP('granite', t => { t.fill(C('#956953')); t.blobs(C('#a57860'), 7, 1.5, 3); t.blobs(C('#8a5f4b'), 6, 1, 2.5); });
TP('diorite', t => { t.fill(C('#c9c9cd')); t.blobs(C('#a8a8ad'), 6, 1, 3); t.specks(C('#88888d'), 14); });
TP('andesite', t => { t.fill(C('#8c8c8f')); t.blobs(C('#9a9a9e'), 6, 1.5, 3); t.specks(C('#77777b'), 16); });
TP('deepslate', t => { t.vary(PAL.deepslate, .12); t.specks(sh(PAL.deepslate, .8), 18); for (let y = 2; y < 16; y += 5) t.hline(y + ((t.rng() * 2) | 0), sh(PAL.deepslate, .72)); });
TP('cobbled_deepslate', t => { t.fill(sh(PAL.deepslate, .55)); t.blobs(PAL.deepslate, 9, 1.5, 2.8); t.borderShade(1.2, .8); });
TP('cobblestone', t => { t.fill(sh(PAL.stone, .55)); t.blobs(PAL.stone, 9, 1.5, 3); t.borderShade(1.25, .8); });
TP('mossy_cobblestone', t => { t.fill(sh(PAL.stone, .55)); t.blobs(PAL.stone, 9, 1.5, 3); t.blobs(C('#5c7a3a'), 5, 1, 2.2); t.borderShade(1.2, .8); });
TP('smooth_stone', t => { t.vary(PAL.stone, .05); t.hline(0, sh(PAL.stone, 1.15)); t.hline(15, sh(PAL.stone, .8)); });
TP('stone_bricks', t => {
  t.fill(PAL.stone); t.rect(0, 0, 16, 8, sh(PAL.stone, 1.04)); t.rect(0, 8, 8, 8, sh(PAL.stone, .97));
  t.vary(PAL.stone, .06); const dk = sh(PAL.stone, .6);
  t.hline(7, dk); t.hline(15, dk); t.vline(7, 0, 7, dk); t.vline(15, 0, 7, dk); t.vline(3, 8, 15, dk); t.vline(11, 8, 15, dk);
  t.hline(0, sh(PAL.stone, 1.2)); t.vline(0, 0, 7, sh(PAL.stone, 1.15));
});
TP('mossy_stone_bricks', t => { TILE_PAINTERS['stone_bricks'](t); t.blobs(C('#5c7a3a'), 5, 1, 2.4); });
TP('cracked_stone_bricks', t => { TILE_PAINTERS['stone_bricks'](t); const dk = sh(PAL.stone, .5); let x = 3, y = 1; for (let i = 0; i < 14; i++) { t.px(x, y, dk); t.px(x + 1, y, dk); x += t.rng() < .6 ? 1 : 0; y += 1; if (x > 14) x = 3; } });
TP('chiseled_stone_bricks', t => { t.fill(sh(PAL.stone, .9)); t.rect(2, 2, 12, 12, sh(PAL.stone, 1.05)); t.rect(4, 4, 8, 8, sh(PAL.stone, .8)); t.rect(5, 5, 6, 6, sh(PAL.stone, 1.1)); t.borderShade(1.15, .85); });
TP('bricks', t => {
  const b = C('#9c5a50'), m = C('#b8b1a5');
  t.fill(m);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 0 : 4;
    for (let bx = -1; bx < 3; bx++) t.rect(bx * 8 + off + 1, row * 4 + 1, 7, 3, sh(b, .95 + t.rng() * .15));
  }
});
TP('bedrock', t => { t.fill(sh(PAL.bedrock, .5)); t.blobs(PAL.bedrock, 12, 1, 3); t.blobs(sh(PAL.bedrock, 1.4), 8, 1, 2); });
TP('obsidian', t => { t.vary(PAL.obsid, .25); t.specks(C('#3a2a55'), 18); t.specks(C('#5842a0'), 6); });
TP('crying_obsidian', t => { t.vary(PAL.obsid, .2); t.specks(C('#6a3fd1'), 12); t.vline(4, 3, 9, C('#9d6bff')); t.vline(10, 5, 13, C('#9d6bff')); t.px(4, 10, C('#cbb0ff')); t.px(10, 14, C('#cbb0ff')); });

// ---------- Soils ----------
TP('dirt', t => { t.vary(PAL.dirt, .14); t.specks(sh(PAL.dirt, .75), 16); t.specks(C('#9b7350'), 10); });
TP('coarse_dirt', t => { t.vary(PAL.dirt, .16); t.specks(sh(PAL.dirt, .65), 24); });
TP('grass_top', t => { t.vary(PAL.grass, .12); t.specks(sh(PAL.grass, .85), 18); t.specks(C('#94d160'), 12); });
TP('grass_side', t => {
  TILE_PAINTERS['dirt'](t);
  for (let x = 0; x < 16; x++) {
    const h = 2 + ((t.rng() * 3) | 0);
    for (let y = 0; y < h; y++) t.px(x, y, sh(PAL.grass, .92 + t.rng() * .2));
  }
});
TP('grass_snow_side', t => {
  TILE_PAINTERS['dirt'](t);
  for (let x = 0; x < 16; x++) { const h = 3 + ((t.rng() * 2) | 0); for (let y = 0; y < h; y++) t.px(x, y, sh(PAL.snow, .95 + t.rng() * .08)); }
});
TP('podzol_top', t => { t.vary(C('#7a5a33'), .12); t.specks(C('#8f6c3e'), 16); t.specks(C('#5e441f'), 12); });
TP('podzol_side', t => { TILE_PAINTERS['dirt'](t); for (let x = 0; x < 16; x++) { const h = 2 + ((t.rng() * 2) | 0); for (let y = 0; y < h; y++) t.px(x, y, sh(C('#7a5a33'), .9 + t.rng() * .2)); } });
TP('farmland', t => { t.vary(sh(PAL.dirt, .8), .12); for (let y = 1; y < 16; y += 4) t.hline(y, sh(PAL.dirt, .55)); t.specks(sh(PAL.dirt, .6), 8); });
TP('farmland_moist', t => { t.vary(sh(PAL.dirt, .55), .1); for (let y = 1; y < 16; y += 4) t.hline(y, sh(PAL.dirt, .35)); });
TP('dirt_path_top', t => { t.vary(C('#98824c'), .08); t.specks(C('#87713d'), 14); });
TP('dirt_path_side', t => { TILE_PAINTERS['dirt'](t); t.rect(0, 0, 16, 3, C('#98824c')); t.hline(3, sh(C('#98824c'), .8)); });
TP('sand', t => { t.vary(PAL.sand, .06); t.specks(C('#c9c090'), 12); });
TP('red_sand', t => { t.vary(C('#bd6c3a'), .08); t.specks(C('#a85c2e'), 14); });
TP('gravel', t => { t.vary(PAL.gravel, .2); t.blobs(sh(PAL.gravel, 1.15), 8, 1, 2); t.blobs(sh(PAL.gravel, .7), 8, 1, 2); });
TP('clay', t => { t.vary(C('#a4a8b8'), .07); t.specks(C('#b8bcc9'), 10); });
TP('sandstone', t => { t.vary(C('#d8cf9e'), .05); t.hline(0, C('#e2dab0')); for (let y = 4; y < 16; y += 4) t.hline(y, C('#cdc38e')); });
TP('sandstone_top', t => { t.vary(C('#dad1a0'), .04); t.borderShade(1.08, .9); });
TP('sandstone_bottom', t => { t.vary(C('#cfc48f'), .05); });
TP('chiseled_sandstone', t => { t.fill(C('#d8cf9e')); t.rect(2, 2, 12, 12, C('#c5ba84')); t.rect(4, 4, 8, 8, C('#ddd4a6')); t.borderShade(1.1, .88); });
TP('cut_sandstone', t => { t.vary(C('#d8cf9e'), .04); t.hline(7, C('#bfb37c')); t.hline(15, C('#bfb37c')); t.hline(0, C('#e5ddae')); t.hline(8, C('#e5ddae')); });
TP('red_sandstone', t => { t.vary(C('#bd6c3a'), .06); for (let y = 4; y < 16; y += 4) t.hline(y, C('#a85c2e')); });

// ---------- Snow / ice ----------
TP('snow', t => { t.vary(PAL.snow, .03); t.specks(C('#e8f4f4'), 8); });
TP('snow_block', t => { t.vary(PAL.snow, .03); });
TP('ice', t => { t.vary(C('#7daaf0'), .06, ); for (let i = 0; i < 4; i++) { const x = (t.rng() * 12) | 0, y = (t.rng() * 12) | 0; t.rect(x, y, 3, 1, C('#a9c8f5')); } t.borderShade(1.1, .9); });
TP('packed_ice', t => { t.vary(C('#8fb6f2'), .05); t.blobs(C('#a9c8f5'), 5, 1, 2); });
TP('blue_ice', t => { t.vary(C('#74a2f7'), .05); t.blobs(C('#91baf9'), 5, 1, 2); });

// ---------- Ores ----------
const oreTile = (name, gem, dark) => TP(name, t => {
  const base = name.startsWith('deepslate') ? 'deepslate' : 'stone';
  TILE_PAINTERS[base](t);
  for (let i = 0; i < 5; i++) {
    const cx = 2 + t.rng() * 12, cy = 2 + t.rng() * 12;
    const pts = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]];
    const n = 3 + ((t.rng() * 3) | 0);
    for (let p = 0; p < n; p++) {
      const dx = pts[p][0], dy = pts[p][1];
      t.px(cx + dx, cy + dy, sh(gem, .92 + t.rng() * .18));
      t.px(cx + dx + (t.rng() < .4 ? 1 : 0), cy + dy, dark || sh(gem, .7));
    }
  }
});
oreTile('coal_ore', PAL.coalG); oreTile('iron_ore', PAL.ironG); oreTile('copper_ore', PAL.copperG);
oreTile('gold_ore', PAL.goldG); oreTile('redstone_ore', PAL.redG); oreTile('lapis_ore', PAL.lapisG);
oreTile('diamond_ore', PAL.diaG); oreTile('emerald_ore', PAL.emG);
oreTile('deepslate_coal_ore', PAL.coalG); oreTile('deepslate_iron_ore', PAL.ironG); oreTile('deepslate_copper_ore', PAL.copperG);
oreTile('deepslate_gold_ore', PAL.goldG); oreTile('deepslate_redstone_ore', PAL.redG); oreTile('deepslate_lapis_ore', PAL.lapisG);
oreTile('deepslate_diamond_ore', PAL.diaG); oreTile('deepslate_emerald_ore', PAL.emG);
TP('nether_quartz_ore', t => { TILE_PAINTERS['netherrack'](t); for (let i = 0; i < 5; i++) { const cx = 2 + t.rng() * 12, cy = 2 + t.rng() * 12; t.rect(cx, cy, 2, 2, sh(PAL.quartzG, .9 + t.rng() * .2)); } });
TP('nether_gold_ore', t => { TILE_PAINTERS['netherrack'](t); for (let i = 0; i < 5; i++) { const cx = 2 + t.rng() * 12, cy = 2 + t.rng() * 12; t.rect(cx, cy, 2, 2, sh(PAL.goldG, .9 + t.rng() * .2)); } });
TP('ancient_debris', t => { t.vary(C('#5c4033'), .12); t.borderShade(1.15, .8); t.specks(C('#7a5a45'), 10); });

// ---------- Mineral blocks ----------
TP('coal_block', t => { t.vary(C('#191919'), .18); t.borderShade(1.3, .75); });
TP('iron_block', t => { t.vary(C('#d8d8d8'), .03); t.hline(0, C('#fff')); t.hline(15, C('#9a9a9a')); t.vline(0, 0, 15, C('#efefef')); t.vline(15, 0, 15, C('#aaa')); });
TP('copper_block', t => { t.vary(C('#e07a4f'), .05); t.blobs(C('#c96a41'), 4, 1, 2); t.borderShade(1.1, .85); });
TP('gold_block', t => { t.vary(C('#fcee4b'), .04); t.hline(0, C('#fff9ae')); t.hline(15, C('#c8a51f')); t.vline(0, 0, 15, C('#fdf68a')); t.vline(15, 0, 15, C('#d4b028')); });
TP('redstone_block', t => { t.vary(C('#a41313'), .12); t.specks(C('#ff2b2b'), 14); t.borderShade(1.2, .8); });
TP('lapis_block', t => { t.vary(C('#2b53c9'), .12); t.specks(C('#1a3a99'), 12); t.specks(C('#4d76e0'), 8); });
TP('diamond_block', t => { t.vary(C('#68e4dc'), .06); t.hline(0, C('#a5f3ee')); t.hline(15, C('#3aa8a0')); t.rect(3, 3, 2, 2, C('#c9fbf8')); t.rect(10, 8, 2, 2, C('#c9fbf8')); });
TP('emerald_block', t => { t.vary(C('#41f384'), .07); t.rect(4, 3, 3, 2, C('#a0fbc7')); t.rect(9, 9, 3, 2, C('#a0fbc7')); });
TP('netherite_block', t => { t.vary(C('#443f41'), .1); t.specks(C('#5c5558'), 12); t.borderShade(1.2, .8); });

// ---------- Wood ----------
const logSide = (name, barkC) => TP(name, t => {
  for (let x = 0; x < 16; x++) {
    const f = .88 + t.rng() * .28;
    for (let y = 0; y < 16; y++) t.px(x, y, sh(barkC, f * (.95 + t.rng() * .12)));
  }
  for (let x = 2; x < 16; x += 5) t.vline(x, 0, 15, sh(barkC, .7));
});
const logTop = (name, barkC, innerC) => TP(name, t => {
  t.fill(barkC);
  t.rect(1, 1, 14, 14, innerC);
  t.rect(2, 2, 12, 12, sh(innerC, .9));
  for (let r = 2; r < 7; r += 2) {
    for (let a = 0; a < 64; a++) {
      const ang = a / 64 * Math.PI * 2;
      t.px(7.5 + Math.cos(ang) * r, 7.5 + Math.sin(ang) * r, sh(innerC, r % 4 ? 1.05 : .82));
    }
  }
});
logSide('oak_log', PAL.oak); logTop('oak_log_top', PAL.oak, C('#b8945f'));
logSide('spruce_log', PAL.spruce); logTop('spruce_log_top', PAL.spruce, C('#7d5c37'));
logSide('birch_log', C('#d7cb8d')); TP('birch_log_top', t => { TILE_PAINTERS['oak_log_top'](t); });
logSide('acacia_log', PAL.acacia); logTop('acacia_log_top', PAL.acacia, C('#c07547'));
logSide('dark_oak_log', PAL.darkoak); logTop('dark_oak_log_top', PAL.darkoak, C('#5c4128'));
TP('birch_log', t => { // birch: pale with dark patches
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) t.px(x, y, sh(C('#d7cb8d'), .93 + t.rng() * .14));
  for (let i = 0; i < 7; i++) { const x = (t.rng() * 14) | 0, y = (t.rng() * 14) | 0; t.rect(x, y, 2 + (t.rng() * 2 | 0), 1, C('#3a3a33')); }
});

const planksTile = (name, base) => TP(name, t => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.px(x, y, sh(base, .93 + t.rng() * .14));
  for (let row = 0; row < 4; row++) {
    const y0 = row * 4;
    t.hline(y0 + 3, sh(base, .6));
    const off = row % 2 ? 4 : 11;
    t.vline(off, y0, y0 + 3, sh(base, .68));
    t.px(off + (row % 2 ? 1 : -1), y0 + 1, sh(base, 1.15));
  }
});
planksTile('oak_planks', PAL.oak); planksTile('spruce_planks', PAL.spruce); planksTile('birch_planks', PAL.birch);
planksTile('acacia_planks', C('#b06434')); planksTile('dark_oak_planks', PAL.darkoak);

const leavesTile = (name, leafC) => TP(name, t => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const r = t.rng();
    if (r < .12) t.px(x, y, [0, 0, 0], 0);
    else t.px(x, y, sh(leafC, .8 + t.rng() * .45));
  }
});
leavesTile('oak_leaves', PAL.leafOak); leavesTile('spruce_leaves', PAL.leafSpruce);
leavesTile('birch_leaves', PAL.leafBirch); leavesTile('acacia_leaves', PAL.leafAcacia); leavesTile('dark_oak_leaves', PAL.leafDark);

const saplingTile = (name, leafC) => TP(name, t => {
  t.clear();
  t.vline(7, 9, 15, sh(C('#6b5433'), 1));
  t.vline(8, 9, 14, C('#7d6340'));
  const lc = leafC;
  t.rect(4, 3, 8, 6, sh(lc, .95));
  t.px(4, 2, lc); t.px(11, 2, lc); t.px(5, 2, sh(lc, 1.1)); t.px(7, 2, sh(lc, 1.1)); t.px(9, 2, sh(lc, 1.1));
  t.px(4, 9, sh(lc, .8)); t.px(11, 9, sh(lc, .8));
  for (let i = 0; i < 10; i++) t.px(4 + t.rng() * 8, 3 + t.rng() * 6, sh(lc, .75 + t.rng() * .5));
});
saplingTile('oak_sapling', PAL.leafOak); saplingTile('spruce_sapling', PAL.leafSpruce);
saplingTile('birch_sapling', PAL.leafBirch); saplingTile('acacia_sapling', PAL.leafAcacia); saplingTile('dark_oak_sapling', PAL.leafDark);

// ---------- Utility blocks ----------
TP('crafting_top', t => {
  TILE_PAINTERS['oak_planks'](t);
  t.rect(1, 1, 14, 14, C('#8f6b3d')); t.borderShade(1.05, .9);
  t.hline(5, C('#5c4326')); t.hline(10, C('#5c4326')); t.vline(5, 1, 14, C('#5c4326')); t.vline(10, 1, 14, C('#5c4326'));
  t.rect(2, 2, 3, 3, C('#c39a62')); t.rect(6, 6, 3, 3, C('#c39a62')); t.rect(11, 2, 3, 3, C('#c39a62')); t.rect(2, 11, 3, 3, C('#c39a62')); t.rect(11, 11, 3, 3, C('#c39a62'));
});
TP('crafting_side', t => {
  TILE_PAINTERS['oak_planks'](t);
  t.rect(2, 2, 5, 4, C('#8f6b3d')); t.rect(9, 2, 5, 4, C('#8f6b3d'));
  t.rect(3, 3, 3, 2, C('#3a2c17')); t.rect(10, 3, 3, 2, C('#3a2c17'));
  t.rect(0, 8, 16, 8, sh(C('#8f6b3d'), .9));
});
TP('crafting_front', t => {
  TILE_PAINTERS['crafting_side'](t);
});
TP('furnace_side', t => { t.vary(C('#6e6e6e'), .07); t.borderShade(1.1, .8); t.hline(0, C('#7c7c7c')); });
TP('furnace_top', t => { t.vary(C('#6e6e6e'), .07); t.rect(3, 3, 10, 10, sh(C('#6e6e6e'), .88)); t.borderShade(1.1, .8); });
TP('furnace_front', t => {
  TILE_PAINTERS['furnace_side'](t);
  t.rect(4, 8, 8, 6, C('#232323'));
  t.rect(5, 9, 6, 4, C('#151515'));
});
TP('furnace_front_lit', t => {
  TILE_PAINTERS['furnace_side'](t);
  t.rect(4, 8, 8, 6, C('#232323'));
  t.rect(5, 9, 6, 4, C('#3a3a3a'));
  t.rect(5, 11, 6, 2, C('#ff9a1f')); t.rect(6, 10, 4, 3, C('#ffd42e'));
  t.px(6, 12, C('#fff2a8')); t.px(9, 11, C('#ff6a00'));
});
TP('piston_bottom', t => { TILE_PAINTERS['cobblestone'](t); });
TP('piston_side', t => { TILE_PAINTERS['cobblestone'](t); t.rect(0, 0, 16, 4, PAL.oak); });
TP('piston_top', t => { TILE_PAINTERS['oak_planks'](t); t.borderShade(1.15, 0.82); });
TP('piston_top_sticky', t => { TILE_PAINTERS['piston_top'](t); t.rect(4, 4, 8, 8, C('#71c850')); });
TP('chest_top', t => { t.fill(C('#9c6e30')); t.borderShade(1.15, .75); t.rect(6, 6, 4, 4, C('#3b270c')); });
TP('chest_side', t => { t.fill(C('#a47228')); t.borderShade(1.12, .78); t.hline(6, C('#5c3d13')); });
TP('chest_front', t => {
  t.fill(C('#a47228')); t.borderShade(1.12, .78);
  t.hline(6, C('#5c3d13')); t.hline(7, C('#5c3d13'));
  t.rect(6, 5, 4, 5, C('#8a8a8a')); t.rect(7, 7, 2, 2, C('#4a4a4a'));
});
TP('bookshelf', t => {
  TILE_PAINTERS['oak_planks'](t);
  const cols = [C('#a03030'), C('#3a6a3a'), C('#3a4a9a'), C('#a08030'), C('#803a80'), C('#c07040')];
  for (const y of [1, 9]) for (let x = 1; x < 15; x += 2) { t.rect(x, y, 2, 6, cols[(t.rng() * 6) | 0]); }
  t.rect(0, 0, 16, 1, sh(PAL.oak, .7)); t.rect(0, 8, 16, 1, sh(PAL.oak, .8)); t.rect(0, 7, 16, 1, sh(PAL.oak, .55));
});
TP('tnt_side', t => {
  t.fill(C('#b5302a')); t.rect(0, 0, 16, 4, C('#8a8a8a')); t.rect(0, 5, 16, 6, C('#d9d9d9'));
  t.rect(0, 10, 16, 6, C('#b5302a'));
  const dk = C('#6a1a16'); t.hline(4, dk); t.hline(10, dk);
  t.rect(1, 6, 14, 4, C('#2e2e2e'));
  t.rect(3, 6, 10, 1, C('#d42a2a')); t.rect(3, 9, 10, 1, C('#d42a2a'));
  // "TNT" blocky letters
  t.rect(4, 7, 8, 2, C('#e8e8e8'));
});
TP('tnt_top', t => { t.fill(C('#8a8a8a')); t.vary(C('#8a8a8a'), .08); t.rect(3, 3, 10, 10, C('#b5302a')); t.rect(6, 6, 4, 4, C('#d9d9d9')); });
TP('tnt_bottom', t => { t.fill(C('#8a8a8a')); t.vary(C('#8a8a8a'), .08); });
TP('torch', t => {
  t.clear();
  t.rect(7, 6, 2, 10, C('#6b5433')); t.px(7, 8, C('#8a6f45')); t.px(8, 11, C('#8a6f45'));
  t.rect(7, 4, 2, 2, C('#ffd42e')); t.px(7, 3, C('#fff2a8')); t.px(8, 3, C('#ffb81f'));
  t.px(6, 5, C('#c87f1a')); t.px(9, 5, C('#c87f1a'));
});
TP('ladder', t => {
  t.clear();
  t.rect(2, 0, 2, 16, C('#8a6f45')); t.rect(12, 0, 2, 16, C('#8a6f45'));
  t.rect(2, 0, 2, 1, C('#a58a5c')); t.rect(12, 0, 2, 1, C('#a58a5c'));
  for (const y of [2, 7, 12]) t.rect(4, y, 8, 2, C('#9c7f4e'));
});
TP('door_top', t => { TILE_PAINTERS['door_bottom'](t); });
TP('door_bottom', t => {
  t.fill(C('#a3824c')); t.borderShade(1.08, .8);
  t.rect(3, 2, 10, 5, sh(C('#a3824c'), .9)); t.rect(3, 9, 10, 5, sh(C('#a3824c'), .9));
  t.px(11, 11, C('#3a3a3a'));
});
TP('spruce_door_top', t => { TILE_PAINTERS['door_bottom'](t); });
TP('spruce_door_bottom', t => { t.fill(PAL.spruce); t.borderShade(1.08, .8); t.rect(3, 2, 10, 5, sh(PAL.spruce, .88)); t.rect(3, 9, 10, 5, sh(PAL.spruce, .88)); t.px(11, 11, C('#2e2318')); });
TP('birch_door_top', t => { TILE_PAINTERS['door_bottom'](t); });
TP('birch_door_bottom', t => { t.fill(PAL.birch); t.borderShade(1.08, .8); t.rect(3, 2, 10, 5, sh(PAL.birch, .88)); t.rect(3, 9, 10, 5, sh(PAL.birch, .88)); t.px(11, 11, C('#3a3a33')); });
TP('glass', t => {
  t.clear();
  const c = C('#c8e8f0');
  t.rect(0, 0, 16, 1, c, 190); t.rect(0, 15, 16, 1, c, 190); t.rect(0, 0, 1, 16, c, 190); t.rect(15, 0, 1, 16, c, 190);
  t.px(3, 2, c, 150); t.px(4, 3, c, 120); t.px(2, 3, c, 120); t.px(11, 9, c, 100); t.px(12, 10, c, 80);
  t.px(5, 2, [255, 255, 255], 140); t.px(6, 3, [255, 255, 255], 110);
});
TP('enchant_top', t => {
  t.fill(C('#c6b7b7')); t.borderShade(1.1, .8);
  t.rect(3, 3, 10, 10, C('#8a7f9a'));
  t.rect(5, 5, 6, 6, C('#b03ad0')); t.specks(C('#e88cf5'), 6);
});
TP('enchant_side', t => {
  t.fill(C('#c6b7b7')); t.rect(0, 0, 16, 3, C('#2b1b3a')); t.rect(2, 3, 3, 10, C('#8a7f9a'));
  t.specks(C('#e88cf5'), 5);
});
TP('noteblock_top', t => { t.vary(C('#6e502f'), .1); t.rect(3, 3, 10, 10, C('#4f3722')); t.rect(6, 6, 4, 4, C('#2b1b10')); });
TP('noteblock_side', t => { planksPaint(t, PAL.spruce); t.rect(4, 4, 8, 8, sh(C('#6e502f'), .8)); });
function planksPaint(t, base) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.px(x, y, sh(base, .93 + t.rng() * .14)); for (let row = 0; row < 4; row++) t.hline(row * 4 + 3, sh(base, .6)); }
TP('spawner', t => {
  t.clear();
  t.fill(C('#25312f')); t.borderShade(1.2, .7);
  t.rect(2, 2, 12, 12, [20, 30, 28], 200);
  for (let i = 0; i < 5; i++) { const x = 2 + t.rng() * 10, y = 2 + t.rng() * 10; t.rect(x, y, 2, 2, C('#3a5a56')); }
  t.rect(0, 0, 16, 1, C('#31423f')); t.rect(0, 15, 16, 1, C('#31423f'));
});
TP('cobweb', t => {
  t.clear();
  const c = [235, 235, 235, 220];
  for (let i = 0; i < 16; i++) { t.px(i, i, c); t.px(15 - i, i, c); t.px(i, 8, c); t.px(8, i, c); }
  for (let i = 0; i < 8; i++) { t.px(i + 8, i, c); t.px(7 - i + 0, i, c); }
});
TP('pumpkin_top', t => { t.vary(C('#c07615'), .08); t.rect(6, 6, 4, 4, C('#8a5410')); });
TP('pumpkin_side', t => {
  t.fill(C('#c07615'));
  for (const x of [3, 7, 11]) t.vline(x, 0, 15, C('#9a5c0e'));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.rng() < .2) t.px(x, y, sh(C('#c07615'), .9 + t.rng() * .2));
});
TP('pumpkin_face', t => {
  TILE_PAINTERS['pumpkin_side'](t);
  const d = C('#3f2506');
  t.rect(3, 4, 3, 3, d); t.rect(10, 4, 3, 3, d);           // eyes
  t.rect(5, 4, 1, 1, C('#e8d95c')); t.rect(12, 4, 1, 1, C('#e8d95c'));
  t.rect(6, 9, 4, 3, d); t.px(5, 9, d); t.px(11, 9, d);    // jagged mouth
  t.rect(6, 10, 4, 1, C('#e8861f'));
});
TP('jack_side', t => { TILE_PAINTERS['pumpkin_side'](t); });
TP('jack_face', t => {
  TILE_PAINTERS['pumpkin_face'](t);
  t.rect(3, 4, 3, 3, C('#ffd42e')); t.rect(10, 4, 3, 3, C('#ffd42e'));
  t.px(4, 5, C('#fff2a8')); t.px(11, 5, C('#fff2a8'));
  t.rect(6, 10, 4, 1, C('#ffd42e')); t.px(5, 9, C('#ff9a1f')); t.px(11, 9, C('#ff9a1f'));
});
TP('melon_top', t => { t.vary(C('#9db51a'), .1); });
TP('melon_side', t => {
  t.fill(C('#9db51a'));
  for (const x of [2, 6, 10, 14]) t.vline(x, 0, 15, sh(C('#6e8a10'), .9 + 0));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.rng() < .25) t.px(x, y, sh(C('#9db51a'), .88 + t.rng() * .3));
});
TP('hay_top', t => { t.vary(C('#a68b2c'), .1); t.rect(5, 5, 6, 6, C('#8a7222')); });
TP('hay_side', t => {
  t.fill(C('#d1a83a'));
  for (const y of [1, 5, 9, 13]) t.hline(y, sh(C('#b18a2a'), .95));
  for (const y of [3, 7, 11, 15]) { for (let x = 2; x < 16; x += 4) t.px(x, y, C('#8a6c1e')); }
});
