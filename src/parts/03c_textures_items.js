// ============================================================================
// Part 03c: item icon painters, HUD pixel icons, TextureManager
// ============================================================================
const ITEM_ICON_PAINTERS = {};
const IIP = (k, fn) => { ITEM_ICON_PAINTERS[k] = fn; };

const TIER_COLORS = {
  wood: [C('#8a6f45'), C('#a58a5c')], stone: [C('#7d7d7d'), C('#9a9a9a')],
  iron: [C('#d8d8d8'), C('#f5f5f5')], gold: [C('#f5d93f'), C('#fdf0a0')],
  diamond: [C('#4de0d8'), C('#a5f3ee')],
};
const HANDLE = [C('#6b5433'), C('#8a6f45')];

// generic diagonal handle from (3,12) to (9,6)
function toolHandle(t) {
  for (let i = 0; i < 8; i++) { t.px(4 + i, 12 - i, HANDLE[0]); t.px(5 + i, 12 - i, HANDLE[1]); }
}
const toolIcons = (type) => {
  for (const tier of Object.keys(TIER_COLORS)) {
    const [c1, c2] = TIER_COLORS[tier];
    IIP(`${tier}_${type}`, t => {
      t.clear();
      toolHandle(t);
      if (type === 'pickaxe') {
        // arc head across the top
        const arc = [[3, 4], [4, 3], [5, 2], [6, 2], [7, 1], [8, 1], [9, 1], [10, 2], [11, 2], [12, 3], [13, 4]];
        for (const [x, y] of arc) { t.px(x, y, c1); t.px(x, y + 1, c2); }
        t.px(5, 4, c1); t.px(11, 4, c1);
      } else if (type === 'axe') {
        t.rect(9, 2, 4, 6, c1); t.rect(8, 3, 1, 4, c2);
        t.px(10, 1, c2); t.px(11, 1, c2); t.px(9, 8, c1); t.px(8, 8, c2);
      } else if (type === 'shovel') {
        t.rect(9, 1, 4, 5, c1); t.rect(10, 0, 2, 1, c2); t.px(10, 6, c1); t.px(11, 6, c2);
      } else if (type === 'sword') {
        for (let i = 0; i < 8; i++) { t.px(6 + i, 9 - i, c2); t.px(7 + i, 9 - i, c1); }
        t.px(13, 2, c2); t.px(14, 1, c1);
        t.rect(4, 9, 4, 2, C('#5c4326')); t.px(3, 11, HANDLE[0]); t.px(5, 8, C('#3a2c17'));
      } else if (type === 'hoe') {
        t.rect(8, 2, 5, 2, c1); t.rect(8, 4, 2, 2, c2); t.px(12, 3, c1);
      }
    });
  }
};
toolIcons('pickaxe'); toolIcons('axe'); toolIcons('shovel'); toolIcons('sword'); toolIcons('hoe');

const armorColors = { leather: C('#a0662c'), iron: C('#d8d8d8'), gold: C('#f5d93f'), diamond: C('#4de0d8') };
const ARMOR_DEF = ['helmet', 'chestplate', 'leggings', 'boots'];
ARMOR_DEF.forEach((slot, i) => {
  for (const mat of Object.keys(armorColors)) {
    IIP(`${mat}_${slot}`, t => {
      t.clear();
      const c = armorColors[mat], hi = sh(c, 1.25), lo = sh(c, .7);
      if (slot === 'helmet') {
        t.rect(4, 3, 8, 6, c); t.rect(5, 2, 6, 1, hi);
        t.rect(4, 9, 3, 2, lo); t.rect(9, 9, 3, 2, lo);
        t.rect(6, 6, 4, 2, sh(c, .5));
      } else if (slot === 'chestplate') {
        t.rect(4, 2, 8, 9, c);
        t.rect(2, 3, 2, 4, lo); t.rect(12, 3, 2, 4, lo);   // shoulders
        t.rect(5, 1, 2, 1, lo); t.rect(9, 1, 2, 1, lo);
        t.rect(7, 4, 2, 6, hi); t.rect(5, 11, 2, 1, lo); t.rect(9, 11, 2, 1, lo);
      } else if (slot === 'leggings') {
        t.rect(4, 2, 8, 4, c); t.rect(5, 1, 6, 1, hi);
        t.rect(4, 6, 3, 7, c); t.rect(9, 6, 3, 7, c);
        t.rect(7, 6, 2, 2, lo);
      } else {
        t.rect(3, 8, 4, 4, c); t.rect(9, 8, 4, 4, c);
        t.rect(3, 12, 4, 2, lo); t.rect(9, 12, 4, 2, lo);
        t.rect(2, 9, 1, 2, hi); t.rect(8, 9, 1, 2, hi);
      }
    });
  }
});

// ---------- Materials ----------
const ingot = (c) => t => { t.clear(); t.rect(3, 8, 10, 4, c); t.rect(4, 6, 10, 4, sh(c, 1.15)); t.rect(5, 7, 8, 2, sh(c, 1.3)); t.px(5, 10, sh(c, .8)); t.px(13, 9, sh(c, .8)); };
IIP('iron_ingot', ingot(C('#d8d8d8'))); IIP('gold_ingot', ingot(C('#f5d93f'))); IIP('copper_ingot', ingot(C('#e07a4f')));
IIP('netherite_ingot', ingot(C('#5c5558'))); IIP('brick', ingot(C('#9c5a50')));
const gem = (c) => t => { t.clear(); const hi = sh(c, 1.4), lo = sh(c, .6); const cx = 7.5, cy = 7.5; const pts = [[7, 2], [8, 2], [4, 5], [11, 5], [7, 12], [8, 12]]; for (let y = 2; y <= 12; y++) { const w = y < 5 ? (y - 1) : (13 - y) * .8; for (let x = 8 - w; x <= 7 + w; x++) t.px(x, y, c); } t.px(6, 4, hi); t.px(5, 5, hi); t.px(7, 3, hi); t.px(8, 11, lo); t.px(7, 11, lo); };
IIP('diamond', gem(C('#4de0d8'))); IIP('emerald', gem(C('#41f384'))); IIP('lapis_lazuli', gem(C('#2b53c9'))); IIP('quartz', gem(C('#ece9e2')));
const dust = (c) => t => { t.clear(); const rng = t.rng; for (let i = 0; i < 26; i++) { const x = 3 + rng() * 10, y = 8 + rng() * 5; t.px(x, y, sh(c, .8 + rng() * .4)); } t.px(5, 9, sh(c, 1.3)); t.px(9, 10, sh(c, 1.3)); };
IIP('redstone', dust(C('#ff2b2b'))); IIP('glowstone_dust', dust(C('#f9e75a'))); IIP('sugar', dust(C('#f5f5f5')));
IIP('gunpowder', dust(C('#7d7d7d'))); IIP('blaze_powder', dust(C('#ffb92e'))); IIP('bone_meal_item', dust(C('#f0eede')));
IIP('spectral_dust', dust(C('#c8e8f0')));
const nugget = (c) => t => { t.clear(); t.rect(5, 6, 5, 4, c); t.rect(6, 5, 3, 1, sh(c, 1.3)); t.px(5, 9, sh(c, .7)); };
IIP('gold_nugget', nugget(C('#f5d93f'))); IIP('iron_nugget', nugget(C('#d8d8d8')));
IIP('coal', t => { t.clear(); t.blobs(C('#191919'), 3, 2, 3.5); t.px(5, 5, C('#3a3a3a')); t.px(9, 8, C('#3a3a3a')); });
IIP('charcoal', t => { t.clear(); t.blobs(C('#2e2e2e'), 3, 2, 3.5); t.px(5, 5, C('#4a4a4a')); t.px(9, 8, C('#4a4a4a')); });
const rawOre = (c) => t => { t.clear(); t.blobs(c, 3, 2.5, 3.5); t.px(6, 5, sh(c, 1.3)); t.px(9, 9, sh(c, 1.2)); };
IIP('raw_iron', rawOre(C('#d8af93'))); IIP('raw_copper', rawOre(C('#e07a4f'))); IIP('raw_gold', rawOre(C('#fcee4b')));
IIP('netherite_scrap', rawOre(C('#8a7060')));
IIP('stick', t => { t.clear(); for (let i = 0; i < 9; i++) { t.px(4 + i, 12 - i, HANDLE[0]); t.px(5 + i, 12 - i, HANDLE[1]); } });
IIP('bone', t => { t.clear(); for (let i = 0; i < 7; i++) t.px(5 + i, 10 - i, C('#f0eede')); t.rect(3, 10, 3, 2, C('#f0eede')); t.px(3, 9, C('#f0eede')); t.px(11, 3, C('#f0eede')); t.px(12, 3, C('#f0eede')); t.px(11, 4, C('#e0dcc8')); });
IIP('flint', t => { t.clear(); t.blobs(C('#3a3a3a'), 2, 3, 4); t.px(6, 5, C('#5a5a5a')); });
IIP('clay_ball', t => { t.clear(); t.blobs(C('#a4a8b8'), 2, 3, 4); t.px(6, 5, C('#c8ccd8')); });
IIP('string', t => { t.clear(); for (let y = 1; y < 15; y++) { const x = 7 + Math.sin(y * .9) * 2.5; t.px(x, y, C('#e8e8e8')); t.px(x + 1, y, C('#c8c8c8')); } });
IIP('feather', t => { t.clear(); for (let i = 0; i < 11; i++) { t.px(4 + i, 13 - i, C('#c8c8c8')); } for (let i = 2; i < 11; i++) { t.px(4 + i, 13 - i - 1, C('#f0f0f0')); t.px(4 + i, 13 - i + 1, C('#e8e8e8')); } t.px(4, 13, C('#a8a8a8')); });
IIP('leather', t => { t.clear(); t.rect(3, 4, 10, 9, C('#a0662c')); t.rect(4, 3, 8, 1, C('#8a5a26')); t.px(5, 5, C('#b8782f')); t.px(9, 9, C('#8a5a26')); });
IIP('paper', t => { t.clear(); t.rect(4, 2, 8, 12, C('#f5f5f0')); t.rect(5, 3, 6, 1, C('#e0e0d8')); t.px(5, 11, C('#e0e0d8')); });
IIP('book', t => { t.clear(); t.rect(3, 2, 10, 12, C('#8a4a2a')); t.rect(5, 3, 7, 10, C('#f5f5f0')); t.rect(4, 2, 1, 12, C('#6e3a1e')); t.rect(5, 7, 7, 1, C('#8a4a2a')); });
IIP('spider_eye', t => { t.clear(); t.blobs(C('#7a1a1a'), 2, 3, 4); t.px(7, 7, C('#c22a2a')); t.px(8, 7, C('#2e2e2e')); t.px(7, 8, C('#2e2e2e')); });
IIP('blaze_rod', t => { t.clear(); for (let i = 0; i < 11; i++) { t.px(4 + i * .7, 12 - i, C('#ffb92e')); t.px(5 + i * .7, 12 - i, C('#e8801a')); } });
IIP('ender_pearl', t => { t.clear(); t.rect(5, 4, 6, 8, C('#0f5a4a')); t.rect(4, 5, 8, 6, C('#0f5a4a')); t.px(6, 6, C('#1fa88a')); t.px(7, 5, C('#1fa88a')); t.px(9, 9, C('#0a3a30')); });
IIP('ender_pearl_throw', ITEM_ICON_PAINTERS['ender_pearl']);
IIP('ender_eye', t => { t.clear(); t.rect(5, 3, 6, 10, C('#1a4a3a')); t.rect(4, 5, 8, 6, C('#1a4a3a')); t.rect(7, 5, 2, 4, C('#8ac8a0')); t.px(7, 6, C('#2e2e2e')); t.px(8, 6, C('#2e2e2e')); t.px(6, 3, C('#2fa88a')); });
IIP('slimeball', t => { t.clear(); t.rect(4, 4, 8, 8, C('#6ec84a')); t.rect(5, 3, 6, 10, C('#6ec84a')); t.px(6, 5, C('#a5e88a')); t.px(7, 6, C('#a5e88a')); t.px(9, 9, C('#4a8f2e')); });
IIP('magma_cream', t => { t.clear(); t.rect(4, 5, 8, 7, C('#e85a0a')); t.rect(5, 4, 6, 9, C('#e85a0a')); t.px(6, 6, C('#ffb92e')); t.px(8, 8, C('#8a2504')); });
IIP('ghast_tear', t => { t.clear(); t.rect(6, 4, 4, 8, C('#d8f0e8')); t.rect(5, 6, 6, 4, C('#d8f0e8')); t.px(6, 5, C('#f5fffb')); t.px(9, 10, C('#a8c8c0')); });
IIP('wheat_item', t => { t.clear(); for (const x of [5, 8, 11]) { t.vline(x, 3, 13, C('#d8c24a')); t.px(x - 1, 4, C('#e8d95c')); t.px(x + 1, 5, C('#e8d95c')); t.px(x - 1, 7, C('#e8d95c')); t.px(x + 1, 8, C('#e8d95c')); } });
IIP('wheat_seeds', t => { t.clear(); for (let i = 0; i < 8; i++) { const x = 4 + t.rng() * 8, y = 6 + t.rng() * 6; t.px(x, y, C('#8a7a2a')); t.px(x + 1, y, C('#a89a3a')); } });
IIP('sugar_cane_item', t => { t.clear(); for (const x of [6, 9]) { t.vline(x, 1, 14, C('#8fd06a')); t.vline(x + 1, 1, 14, C('#6eb84a')); } });

// ---------- Foods ----------
IIP('apple', t => { t.clear(); t.rect(4, 4, 8, 8, C('#d43a2a')); t.rect(3, 5, 10, 6, C('#d43a2a')); t.px(5, 5, C('#e86a5a')); t.px(6, 5, C('#e86a5a')); t.px(8, 3, C('#6b5433')); t.px(8, 2, C('#4a8f2e')); t.px(9, 2, C('#4a8f2e')); });
IIP('golden_apple', t => { t.clear(); t.rect(4, 4, 8, 8, C('#f5d93f')); t.rect(3, 5, 10, 6, C('#f5d93f')); t.px(5, 5, C('#fdf0a0')); t.px(6, 5, C('#fdf0a0')); t.px(8, 3, C('#6b5433')); t.px(9, 2, C('#4de0d8')); });
IIP('bread', t => { t.clear(); t.rect(3, 5, 10, 6, C('#b8863a')); t.rect(4, 4, 8, 1, C('#d1a850')); t.px(5, 6, C('#d1a850')); t.px(8, 7, C('#d1a850')); t.px(11, 6, C('#9a6e2a')); });
const meat = (rawC, cookedC, boneEnd) => t => { t.clear(); t.rect(5, 3, 7, 7, rawC); t.rect(4, 4, 9, 5, rawC); t.px(6, 5, sh(rawC, 1.25)); t.px(7, 6, sh(rawC, 1.15)); t.px(10, 7, sh(rawC, .8)); if (boneEnd) { t.rect(2, 9, 3, 3, C('#f0eede')); t.px(3, 8, C('#f0eede')); } };
IIP('porkchop', t => meat(C('#f5a0a8'), null, true));
IIP('cooked_porkchop', t => meat(C('#c88a5c'), null, true));
IIP('beef', t => meat(C('#c25a5a'), null, false));
IIP('cooked_beef', t => meat(C('#8a5a3a'), null, false));
IIP('chicken', t => { t.clear(); t.rect(5, 4, 7, 6, C('#f5c8c0')); t.px(6, 5, C('#f5e0d8')); t.rect(3, 8, 3, 3, C('#f0eede')); });
IIP('cooked_chicken', t => { t.clear(); t.rect(5, 4, 7, 6, C('#c8905c')); t.px(6, 5, C('#e0b078')); t.rect(3, 8, 3, 3, C('#f0eede')); });
IIP('mutton', t => meat(C('#d86a6a'), null, false));
IIP('cooked_mutton', t => meat(C('#9a6242'), null, false));
IIP('carrot', t => { t.clear(); for (let i = 0; i < 8; i++) { t.px(5 + i * .6, 13 - i, C('#e87a1f')); t.px(6 + i * .6, 13 - i, C('#d86a0f')); } t.px(10, 4, C('#4a8f2e')); t.px(11, 3, C('#4a8f2e')); t.px(11, 5, C('#4a8f2e')); });
IIP('golden_carrot', t => { t.clear(); for (let i = 0; i < 8; i++) { t.px(5 + i * .6, 13 - i, C('#f5d93f')); t.px(6 + i * .6, 13 - i, C('#e8c42a')); } t.px(10, 4, C('#4de0d8')); t.px(11, 3, C('#4de0d8')); });
IIP('potato', t => { t.clear(); t.blobs(C('#d1a850'), 2, 3, 4); t.px(6, 6, C('#b8863a')); t.px(9, 9, C('#b8863a')); });
IIP('baked_potato', t => { t.clear(); t.blobs(C('#c8905c'), 2, 3, 4); t.px(6, 5, C('#f5e8c8')); t.px(7, 6, C('#f5e8c8')); });
IIP('melon_slice', t => { t.clear(); for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const d = Math.hypot(x - 8, y - 8); if (d < 8 && d > 6.2) t.px(x + 3, y + 3, C('#9db51a')); else if (d <= 6.2) t.px(x + 3, y + 3, d > 5 ? C('#d43a2a') : C('#e86a5a')); } t.px(6, 6, C('#2e2e2e')); t.px(8, 8, C('#2e2e2e')); });
IIP('cookie', t => { t.clear(); t.rect(4, 5, 8, 7, C('#b8863a')); t.rect(5, 4, 6, 9, C('#b8863a')); t.px(6, 6, C('#4a2e1a')); t.px(9, 7, C('#4a2e1a')); t.px(7, 9, C('#4a2e1a')); t.px(10, 5, C('#4a2e1a')); });
IIP('pumpkin_pie', t => { t.clear(); t.rect(3, 7, 10, 4, C('#e8a44a')); t.rect(4, 6, 8, 1, C('#d1a850')); t.rect(5, 4, 6, 2, C('#f5e8c8')); });
IIP('rotten_flesh', t => { t.clear(); t.rect(3, 5, 10, 7, C('#8a5a3a')); t.px(5, 6, C('#6e8a10')); t.px(9, 9, C('#6e8a10')); t.px(7, 7, C('#5c4326')); t.px(11, 6, C('#5c4326')); });
IIP('sweet_berries', t => { t.clear(); t.blobs(C('#d43a2a'), 2, 2.5, 3); t.blobs(C('#e86a5a'), 1, 2, 2.5); t.px(5, 6, C('#4a8f2e')); t.px(9, 4, C('#4a8f2e')); });
IIP('mushroom_stew', t => { t.clear(); t.rect(3, 7, 10, 5, C('#a0662c')); t.rect(4, 12, 8, 1, C('#8a5a26')); t.rect(5, 5, 6, 2, C('#c8c8c8')); t.px(6, 5, C('#c62d2d')); t.px(9, 6, C('#9a7450')); });
IIP('milk_bucket', t => { t.clear(); bucketPaint(t, C('#f5f5f0')); });

function bucketPaint(t, liquid) {
  t.clear();
  t.rect(4, 4, 8, 9, C('#a8a8a8'));
  t.rect(3, 5, 10, 8, C('#c8c8c8'));
  t.rect(5, 6, 6, 2, liquid || C('#8a8a8a'));
  t.rect(3, 13, 10, 1, C('#8a8a8a'));
}
IIP('bucket', t => { t.clear(); bucketPaint(t, null); });
IIP('water_bucket', t => { t.clear(); bucketPaint(t, C('#3f76e4')); });
IIP('lava_bucket', t => { t.clear(); bucketPaint(t, C('#e85a0a')); });
IIP('bow', t => {
  t.clear();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * .25 + (i / 9) * Math.PI * .5;
    const x = 10 - Math.cos(a) * 6, y = 12 - Math.sin(a) * 6;
    t.px(x, y, HANDLE[0]); t.px(x + 1, y, HANDLE[1]);
  }
  t.vline(3, 3, 10, C('#e8e8e8')); t.px(4, 4, C('#e8e8e8')); t.px(4, 9, C('#e8e8e8'));
});
IIP('arrow', t => {
  t.clear();
  for (let i = 0; i < 8; i++) t.px(4 + i, 12 - i, HANDLE[0]);
  t.px(12, 3, C('#d8d8d8')); t.px(11, 4, C('#d8d8d8')); t.px(13, 3, C('#b8b8b8')); t.px(12, 4, C('#b8b8b8'));
  t.px(4, 12, C('#f0f0f0')); t.px(5, 12, C('#e8e8e8')); t.px(4, 11, C('#e8e8e8')); t.px(3, 13, C('#f0f0f0'));
});
IIP('snowball', t => { t.clear(); t.rect(5, 5, 6, 6, C('#f2fbfb')); t.rect(4, 6, 8, 4, C('#f2fbfb')); t.px(6, 6, C('#ffffff')); t.px(9, 9, C('#c8d8d8')); });
IIP('egg', t => { t.clear(); t.rect(6, 3, 4, 2, C('#f0e8d8')); t.rect(5, 5, 6, 6, C('#f0e8d8')); t.rect(6, 11, 4, 2, C('#f0e8d8')); t.px(6, 4, C('#ffffff')); t.px(9, 10, C('#d8d0c0')); });
IIP('experience_bottle', t => { t.clear(); t.rect(6, 1, 4, 2, C('#a8c8a0')); t.rect(5, 3, 6, 10, C('#c8e8c0')); t.rect(6, 5, 4, 7, C('#8ae84a')); t.px(6, 6, C('#d1f58a')); });
IIP('flint_and_steel', t => { t.clear(); t.blobs(C('#3a3a3a'), 1, 3, 4); t.px(6, 5, C('#5a5a5a')); for (let i = 0; i < 6; i++) t.px(8 + i * .5, 6 + i, C('#c8c8c8')); t.px(9, 5, C('#e8e8e8')); });
IIP('shears', t => { t.clear(); for (let i = 0; i < 6; i++) { t.px(4 + i, 10 - i, C('#d8d8d8')); t.px(9 - i, 10 - i, C('#c8c8c8')); } t.rect(9, 9, 2, 4, C('#8a8a8a')); t.rect(3, 9, 2, 4, C('#8a8a8a')); });
IIP('compass', t => { t.clear(); t.rect(4, 4, 8, 8, C('#c6b7b7')); t.rect(5, 5, 6, 6, C('#2e2e2e')); t.px(7, 5, C('#d43a2a')); t.px(8, 6, C('#d43a2a')); t.px(7, 7, C('#f0f0f0')); t.px(8, 9, C('#f0f0f0')); t.px(7, 10, C('#f0f0f0')); });
IIP('clock', t => { t.clear(); t.rect(4, 4, 8, 8, C('#f5d93f')); t.rect(5, 5, 6, 6, C('#c8e8f0')); t.px(7, 6, C('#2e2e2e')); t.px(8, 7, C('#2e2e2e')); t.px(8, 9, C('#8a8a8a')); });
// fall back: ender_pearl_throw etc handled above

// ---------- Potions, bottles, boats, carts, skulls ----------
const potionBottle = (liquid) => t => {
  t.clear();
  t.rect(6, 0, 4, 2, C('#a8a8a8'));           // cork
  t.rect(5, 2, 6, 2, C('#c8e8f0'), 160);      // neck
  t.rect(4, 4, 8, 9, C('#c8e8f0'), 150);      // glass
  t.rect(3, 6, 10, 6, C('#c8e8f0'), 150);
  if (liquid) { t.rect(4, 8, 8, 6, liquid, 230); t.rect(3, 9, 10, 4, liquid, 230); t.px(5, 9, sh(liquid, 1.4), 255); }
  t.rect(3, 13, 10, 1, C('#a8a8a8'));
};
IIP('glass_bottle', potionBottle(null));
IIP('water_bottle', potionBottle(C('#3f76e4')));
IIP('awkward_potion', potionBottle(C('#a8a8b8')));
IIP('potion_healing', potionBottle(C('#ff3a3a')));
IIP('potion_regen', potionBottle(C('#ff6a9a')));
IIP('potion_speed', potionBottle(C('#7ae0ff')));
IIP('potion_strength', potionBottle(C('#c83a1a')));
IIP('potion_fire_res', potionBottle(C('#ff9a2a')));
IIP('potion_night_vision', potionBottle(C('#2a3ab8')));
IIP('potion_water_breathing', potionBottle(C('#3a7ac8')));
IIP('potion_poison', potionBottle(C('#4a8f2e')));
IIP('speckled_melon', t => { t.clear(); t.rect(4, 5, 8, 7, C('#9db51a')); t.px(6, 7, C('#f5d93f')); t.px(9, 9, C('#f5d93f')); t.px(7, 10, C('#f5d93f')); t.px(5, 6, C('#c8d84a')); });
IIP('nether_wart', t => { t.clear(); for (const [x, y] of [[6, 9], [8, 8], [10, 10], [7, 11], [9, 12]]) { t.rect(x, y, 2, 2, C('#8a2a2a')); t.px(x, y, C('#b84a4a')); } t.px(7, 7, C('#5a8f2e')); });
IIP('boat', t => {
  t.clear();
  t.rect(3, 7, 10, 5, C('#9c7f4e'));
  t.rect(2, 9, 12, 3, C('#8a6f45'));
  t.rect(3, 6, 10, 1, C('#b8945f'));
  t.rect(4, 8, 8, 2, C('#6b5433'));
  t.px(3, 6, C('#5c4326')); t.px(12, 6, C('#5c4326'));
});
IIP('minecart', t => {
  t.clear();
  t.rect(3, 5, 10, 6, C('#8a8a8e'));
  t.rect(4, 6, 8, 4, C('#55555a'));
  t.rect(2, 11, 3, 3, C('#3a3a3e')); t.rect(11, 11, 3, 3, C('#3a3a3e'));
  t.px(3, 12, C('#8a8a8e')); t.px(12, 12, C('#8a8a8e'));
});
IIP('wither_skull_item', t => {
  t.clear();
  t.rect(4, 4, 8, 8, C('#3a3a3e'));
  t.rect(5, 3, 6, 1, C('#4a4a4e'));
  t.rect(5, 6, 2, 2, [0, 0, 0]); t.rect(9, 6, 2, 2, [0, 0, 0]);
  t.rect(6, 10, 4, 1, [0, 0, 0]);
  t.px(5, 6, C('#8a8a8e')); t.px(10, 6, C('#8a8a8e'));
});
IIP('saddle', t => {
  t.clear();
  t.rect(3, 5, 10, 6, C('#8a5a26'));
  t.rect(4, 4, 8, 1, C('#a0662c'));
  t.rect(2, 8, 3, 2, C('#6e451e')); t.rect(11, 8, 3, 2, C('#6e451e'));
  t.px(7, 7, C('#c89858'));
});
IIP('bone_meal', ITEM_ICON_PAINTERS['bone_meal_item'] || (t => dust(C('#f0eede'))));
// ---------- Dyes (pigment piles) ----------
const DYE_HEX = {
  red_dye: '#d43a2a', yellow_dye: '#f5d93f', blue_dye: '#2b53c9', purple_dye: '#792aac',
  light_gray_dye: '#9a9a9a', green_dye: '#546d1b', white_dye: '#f0f0f0', orange_dye: '#f07613',
  pink_dye: '#ed8dac', lime_dye: '#70b919', cyan_dye: '#158991', magenta_dye: '#bd44b3', light_blue_dye: '#3aafd9',
};
for (const [k, hex] of Object.entries(DYE_HEX)) {
  IIP(k, t => {
    t.clear();
    const c = C(hex), hi = sh(c, 1.35), lo = sh(c, .65);
    for (let i = 0; i < 30; i++) t.px(4 + t.rng() * 8, 7 + t.rng() * 6, t.rng() < .3 ? hi : c);
    for (let i = 0; i < 10; i++) t.px(3 + t.rng() * 10, 11 + t.rng() * 3, lo);
    t.px(6, 8, hi); t.px(9, 9, hi);
  });
}

// ============================================================================
// HUD pixel icons (hearts, food, armor, air) — original 9x9 pixel sprites
// ============================================================================
const HUD_ICONS = {};
function pixSprite(rows, palette, scale = 1) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const cx = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    if (ch === '.' || ch === ' ') continue;
    const col = palette[ch];
    if (!col) continue;
    cx.fillStyle = col;
    cx.fillRect(x * scale, y * scale, scale, scale);
  }
  return c.toDataURL();
}
function buildHudIcons() {
  const P = { o: '#1a0a0a', r: '#e8342a', R: '#ff6a5a', d: '#8a1410', e: '#3a3a3a', f: '#b8782f', F: '#d89a4f', D: '#7a4e1e', b: '#c8c8c8', B: '#e8e8e8', a: '#3a76e4', A: '#7aa8f0', w: '#f5f5f5', g: '#9a9a9a' };
  const heart = [
    '.oo.oo...',
    'orRorrRo.',
    'orrrrrrdo',
    'orrrrrrdo',
    '.orrrrdo.',
    '..ordo...',
    '...oo....',
    '.........',
    '.........',
  ];
  const heartE = [
    '.oo.oo...',
    'oeeoeeeo.',
    'oeeeeeeo.',
    'oeeeeeeo.',
    '.oeeeeo..',
    '..oeo....',
    '...oo....',
    '.........',
    '.........',
  ];
  const heartH = [
    '.oo.oo...',
    'orrooreo.',
    'orrrreeo.',
    'orrrreeo.',
    '.orrreo..',
    '..oreo...',
    '...oo....',
    '.........',
    '.........',
  ];
  const food = [
    '.....oo..',
    '....oFFo.',
    '...oFfFo.',
    '..oFffDo.',
    '.oBfffo..',
    'oBBooo...',
    'oBo......',
    '.o.......',
    '.........',
  ];
  const foodE = [
    '.....oo..',
    '....oeeo.',
    '...oeeeo.',
    '..oeeeeo.',
    '.oeeeo...',
    'ooo......',
    '.o.......',
    '.........',
    '.........',
  ];
  const armorI = [
    '.oooooo..',
    'obbbbbo..',
    'obwbwbo..',
    'obbbbbo..',
    'obbbbbo..',
    '.obobo...',
    '.o.o.o...',
    '.........',
    '.........',
  ];
  const armorE = [
    '.oooooo..',
    'oeeeeeeo.',
    'oeeeeeeo.',
    'oeeeeeeo.',
    'oeeeeeeo.',
    '.oeeeo...',
    '.o.e.o...',
    '.........',
    '.........',
  ];
  const bubble = [
    '..ooo....',
    '.oAAAo...',
    'oAwAAAo..',
    'oAAAAAo..',
    'oAAAAAo..',
    '.oAAAo...',
    '..ooo....',
    '.........',
    '.........',
  ];
  HUD_ICONS.heart_full = pixSprite(heart, P);
  HUD_ICONS.heart_empty = pixSprite(heartE, P);
  HUD_ICONS.heart_half = pixSprite(heartH, P);
  HUD_ICONS.food_full = pixSprite(food, P);
  HUD_ICONS.food_empty = pixSprite(foodE, P);
  HUD_ICONS.food_half = pixSprite([
    '.....oo..',
    '....oeeo.',
    '...oFFeo.',
    '..oFFfeo.',
    '.oBfffo..',
    'oBBooo...',
    'oBo......',
    '.o.......',
    '.........',
  ], P);
  HUD_ICONS.armor_full = pixSprite(armorI, P);
  HUD_ICONS.armor_empty = pixSprite(armorE, P);
  HUD_ICONS.armor_half = pixSprite([
    '.oooooo..',
    'obbbbbo..',
    'obeeebe..',
    'obbbbbo..',
    'obbbbbo..',
    '.obobo...',
    '.o.o.o...',
    '.........',
    '.........',
  ], P);
  HUD_ICONS.bubble = pixSprite(bubble, P);
}

// ============================================================================
// TextureManager
// ============================================================================
const TEX = {
  canvas: null, ctx: null, data: null, ready: false,
  _tileURLs: new Map(), _itemURLs: new Map(), _particleCache: new Map(),

  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_COLS * TILE_SIZE;
    this.canvas.height = ATLAS_ROWS * TILE_SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.data = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    const d = this.data.data;
    d.fill(0);
    // paint every registered tile
    for (const [name, idx] of TILE.entries()) {
      const painter = TILE_PAINTERS[name];
      const tx = (idx % ATLAS_COLS) * TILE_SIZE, ty = Math.floor(idx / ATLAS_COLS) * TILE_SIZE;
      const sub = new ImageData(TILE_SIZE, TILE_SIZE);
      if (painter) {
        const t = makePaintCtx(sub, hashStr(name));
        painter(t);
      } else {
        // fallback checker
        const t = makePaintCtx(sub, 1);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.px(x, y, (x + y) % 2 ? C('#f0f') : C('#000'));
      }
      // copy tile row-by-row into the atlas (a flat d.set would compress all
      // 16 tile rows into the first two atlas rows)
      for (let row = 0; row < TILE_SIZE; row++) {
        d.set(sub.data.subarray(row * TILE_SIZE * 4, (row + 1) * TILE_SIZE * 4),
          ((ty + row) * this.canvas.width + tx) * 4);
      }
    }
    this.ctx.putImageData(this.data, 0, 0);
    buildHudIcons();
    this.ready = true;
  },

  tileIndex(name) { const i = TILE.get(name); return i === undefined ? 0 : i; },
  // uv rect of a tile (with tiny inset to prevent bleeding)
  tileUV(name) {
    const idx = this.tileIndex(name);
    const s = 1 / ATLAS_COLS;
    const u0 = (idx % ATLAS_COLS) * s, v0 = Math.floor(idx / ATLAS_COLS) * s;
    return [u0, v0, u0 + s, v0 + s];
  },

  _tileCanvas(name) {
    const idx = this.tileIndex(name);
    const c = document.createElement('canvas');
    c.width = TILE_SIZE; c.height = TILE_SIZE;
    const cx = c.getContext('2d');
    cx.drawImage(this.canvas, (idx % ATLAS_COLS) * TILE_SIZE, Math.floor(idx / ATLAS_COLS) * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
    return c;
  },
  tileURL(name) {
    if (!this._tileURLs.has(name)) this._tileURLs.set(name, this._tileCanvas(name).toDataURL());
    return this._tileURLs.get(name);
  },

  itemURL(itemId) {
    if (this._itemURLs.has(itemId)) return this._itemURLs.get(itemId);
    const it = ITEMS[itemId];
    let url = null;
    const special = { oak_door_item: 'door_bottom', spruce_door_item: 'spruce_door_bottom', birch_door_item: 'birch_door_bottom', bed_item: 'bed_top_white', red_bed_item: 'bed_top_red' };
    if (special[it.key]) url = this.tileURL(special[it.key]);
    else if (ITEM_ICON_PAINTERS[it.key]) {
      const c = document.createElement('canvas');
      c.width = TILE_SIZE; c.height = TILE_SIZE;
      const img = new ImageData(TILE_SIZE, TILE_SIZE);
      const t = makePaintCtx(img, hashStr('item:' + it.key));
      ITEM_ICON_PAINTERS[it.key](t);
      c.getContext('2d').putImageData(img, 0, 0);
      url = c.toDataURL();
    } else if (it.placeBlock !== null && it.placeBlock !== undefined) {
      const bl = BLOCKS[it.placeBlock];
      const tile = bl.faces.front || bl.faces.top || bl.faces.side || bl.faces.all || bl.key;
      url = this.tileURL(tile);
    } else {
      url = this.tileURL('stone');
    }
    this._itemURLs.set(itemId, url);
    return url;
  },

  particleColor(blockId) {
    if (this._particleCache.has(blockId)) return this._particleCache.get(blockId);
    const bl = BLOCKS[blockId];
    let tileName = bl.faces.top || bl.faces.side || bl.faces.all || bl.key;
    if (bl.shape === 'cross') tileName = bl.faces.all || bl.key;
    const idx = this.tileIndex(tileName);
    const tx = (idx % ATLAS_COLS) * TILE_SIZE, ty = Math.floor(idx / ATLAS_COLS) * TILE_SIZE;
    const d = this.data.data;
    // multi-sample the tile so break particles show varied, true block colors
    const samples = [];
    for (const [sx, sy] of [[4, 4], [11, 5], [5, 11], [12, 12], [8, 8]]) {
      const i = ((ty + sy) * this.canvas.width + (tx + sx)) * 4;
      if (d[i + 3] > 60) samples.push([d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]);
    }
    const c = samples.length ? samples : [[0.5, 0.5, 0.5]];
    this._particleCache.set(blockId, c);
    return c;
  },

  // Resolve the atlas tile name for a block face considering meta state
  faceTile(blockId, face /* 'top'|'bottom'|'side'|'front' */, meta = 0) {
    const bl = BLOCKS[blockId];
    const f = bl.faces || {};
    switch (bl.key) {
      case 'grass_block':
        if (meta === 1 && face !== 'bottom' && face !== 'top') return 'grass_snow_side';
        if (meta === 1 && face === 'top') return 'snow';
        break;
      case 'farmland': if (face === 'top' && meta > 0) return 'farmland_moist'; break;
      case 'furnace': if (face === 'front' && (meta & 8)) return 'furnace_front_lit'; break;
      case 'redstone_lamp': if (meta & 1) return 'redstone_lamp_lit'; break;
      case 'redstone_torch': if (!(meta & 1)) return 'redstone_torch_off'; break;
      case 'wheat': return 'wheat_stage' + clamp(meta & 7, 0, 7);
      case 'nether_wart': return 'nether_wart_stage' + clamp(meta & 3, 0, 3);
      case 'redstone_wire': {
        const on = (meta >> 4) > 0;
        const conn = meta & 15;
        return conn === 0 ? (on ? 'redstone_dot_on' : 'redstone_dot') : (on ? 'redstone_line_on' : 'redstone_line');
      }
      default: break;
    }
    if (bl.variant && bl.shape === 'slab') {
      const vb = BLOCKS[B[bl.variant.type]];
      return this.faceTile(vb.id, face, bl.variant.meta);
    }
    if (face === 'front' && f.front) return f.front;
    if (face === 'top' && f.top) return f.top;
    if (face === 'bottom' && f.bottom) return f.bottom;
    if (f.side) return f.side;
    return f.all || bl.key;
  },

  // ---------- User texture pack support ----------
  // Applies user-provided 16×16 PNGs (Map<tileName, dataURL>) over the atlas tiles.
  // Names follow the block keys (stone.png, grass_block_side.png, dirt.png …).
  async applyPack(files) {
    let applied = 0;
    for (const [name, url] of files) {
      const idx = TILE.get(name.replace(/\.png$/i, ''));
      if (idx === undefined) continue;
      const img = new Image();
      await new Promise(res => { img.onload = res; img.onerror = res; img.src = url; });
      if (!img.width) continue;
      const tx = (idx % ATLAS_COLS) * TILE_SIZE, ty = Math.floor(idx / ATLAS_COLS) * TILE_SIZE;
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(img, 0, 0, img.width, img.height, tx, ty, TILE_SIZE, TILE_SIZE);
      applied++;
    }
    this.refreshAfterPack();
    return applied;
  },
  refreshAfterPack() {
    this.data = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this._tileURLs.clear(); this._itemURLs.clear(); this._particleCache.clear();
    if (G.renderer) G.renderer.uploadAtlas();
  },
  resetPack() {
    this.init();
    if (G.renderer) G.renderer.uploadAtlas();
  },
};
