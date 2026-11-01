// ============================================================================
// Part 09: Inventory, crafting, smelting, containers, UI wiring
// ============================================================================
const GROUPS = {
  PLANKS: WOODS.map(w => w + '_planks'),
  LOG: WOODS.map(w => w + '_log'),
  WOOL: WOOL_COLORS.map(c => c + '_wool'),
  STONE: ['stone', 'cobblestone'],
  COAL: ['coal', 'charcoal'],
};

const RECIPES = [];
function R(out, count, shape, keys) { RECIPES.push({ out, count, shape, keys }); }
function RS(out, count, ingredients) { RECIPES.push({ out, count, shapeless: ingredients }); }

// wood basics
for (const w of WOODS) {
  RS(w + '_planks', 4, [w + '_log']);
  RS('stick', 4, [w + '_planks', w + '_planks']); // shapeless approximation (2 planks)
}
R('crafting_table', 1, ['PP', 'PP'], { P: '@PLANKS' });
R('torch', 4, ['C', 'S'], { C: '@COAL', S: 'stick' });
R('chest', 1, ['PPP', 'P.P', 'PPP'], { P: '@PLANKS' });
R('furnace', 1, ['CCC', 'C.C', 'CCC'], { C: 'cobblestone' });
// tools per material
const TMATS = { wooden: '@PLANKS', stone: 'cobblestone', iron: 'iron_ingot', gold: 'gold_ingot', diamond: 'diamond' };
for (const [tier, mat] of Object.entries(TMATS)) {
  const t = tier === 'wooden' ? 'wood' : tier;
  R(`${t}_pickaxe`, 1, ['MMM', '.S.', '.S.'], { M: mat, S: 'stick' });
  R(`${t}_axe`, 1, ['MM', 'MS', '.S'], { M: mat, S: 'stick' });
  R(`${t}_shovel`, 1, ['M', 'S', 'S'], { M: mat, S: 'stick' });
  R(`${t}_hoe`, 1, ['MM', '.S', '.S'], { M: mat, S: 'stick' });
  R(`${t}_sword`, 1, ['M', 'M', 'S'], { M: mat, S: 'stick' });
}
// armor
const AMATS = { leather: 'leather', iron: 'iron_ingot', gold: 'gold_ingot', diamond: 'diamond' };
for (const [mat, m] of Object.entries(AMATS)) {
  R(`${mat}_helmet`, 1, ['MMM', 'M.M'], { M: m });
  R(`${mat}_chestplate`, 1, ['M.M', 'MMM', 'MMM'], { M: m });
  R(`${mat}_leggings`, 1, ['MMM', 'M.M', 'M.M'], { M: m });
  R(`${mat}_boots`, 1, ['M.M', 'M.M'], { M: m });
}
// netherite smithing / upgrade recipes
for (const tt of ['pickaxe', 'axe', 'shovel', 'sword', 'hoe']) {
  RS(`netherite_${tt}`, 1, [`diamond_${tt}`, 'netherite_ingot']);
}
for (const sl of ['helmet', 'chestplate', 'leggings', 'boots']) {
  RS(`netherite_${sl}`, 1, [`diamond_${sl}`, 'netherite_ingot']);
}
// utility
R('bucket', 1, ['I.I', '.I.'], { I: 'iron_ingot' });
RS('flint_and_steel', 1, ['iron_ingot', 'flint']);
R('shears', 1, ['.I', 'I.'], { I: 'iron_ingot' });
R('bow', 1, ['.SL', 'S.L', '.SL'], { S: 'stick', L: 'string' });
R('arrow', 4, ['F', 'S', 'E'], { F: 'flint', S: 'stick', E: 'feather' });
R('compass', 1, ['.I.', 'IRI', '.I.'], { I: 'iron_ingot', R: 'redstone' });
R('clock', 1, ['.G.', 'GRG', '.G.'], { G: 'gold_ingot', R: 'redstone' });
// wood constructs
R('oak_door_item', 3, ['PP', 'PP', 'PP'], { P: '@PLANKS' });
R('fence', 3, ['PSP', 'PSP'], { P: '@PLANKS', S: 'stick' });
R('ladder', 3, ['S.S', 'SSS', 'S.S'], { S: 'stick' });
R('bed_item', 1, ['WWW', 'PPP'], { W: '@WOOL', P: '@PLANKS' });
R('bookshelf', 1, ['PPP', 'BBB', 'PPP'], { P: '@PLANKS', B: 'book' });
R('note_block', 1, ['PPP', 'PRP', 'PPP'], { P: '@PLANKS', R: 'redstone' });
// stone
R('stone_bricks', 4, ['SS', 'SS'], { S: 'stone' });
R('stone_slab', 6, ['SSS'], { S: 'stone' });
R('cobblestone_slab', 6, ['SSS'], { S: 'cobblestone' });
R('oak_slab', 6, ['SSS'], { S: '@PLANKS' });
R('stone_brick_slab', 6, ['SSS'], { S: 'stone_bricks' });
R('bricks', 1, ['BB', 'BB'], { B: 'brick' });
R('sandstone', 1, ['SS', 'SS'], { S: 'sand' });
R('red_sandstone', 1, ['SS', 'SS'], { S: 'red_sand' });
R('glass_pane', 16, ['GGG', 'GGG'], { G: 'glass' });
// wool & carpet
R('white_wool', 1, ['SS', 'SS'], { S: 'string' });
R('white_carpet', 3, ['WW'], { W: 'white_wool' });
// redstone & pistons
R('redstone_torch', 1, ['R', 'S'], { R: 'redstone', S: 'stick' });
RS('lever', 1, ['stick', 'cobblestone']);
R('stone_button', 1, ['S'], { S: 'stone' });
R('stone_pressure_plate', 1, ['SS'], { S: 'stone' });
R('oak_pressure_plate', 1, ['SS'], { S: '@PLANKS' });
R('repeater', 1, ['TRT', 'SSS'], { T: 'redstone_torch', R: 'redstone', S: 'smooth_stone' });
R('redstone_lamp', 1, ['.R.', 'RGR', '.R.'], { R: 'redstone', G: 'glowstone' });
R('tnt', 1, ['GSG', 'SGS', 'GSG'], { G: 'gunpowder', S: 'sand' });
R('piston', 1, ['PPP', 'CIC', 'CRC'], { P: '@PLANKS', C: 'cobblestone', I: 'iron_ingot', R: 'redstone' });
RS('sticky_piston', 1, ['piston', 'slimeball']);
R('bowl', 4, ['P.P', '.P.'], { P: '@PLANKS' });
// enchant / misc
R('enchanting_table', 1, ['.B.', 'DOD', 'OOO'], { B: 'book', D: 'diamond', O: 'obsidian' });
R('paper', 3, ['SSS'], { S: 'sugar_cane_item' });
R('book', 1, ['PP', 'PL'], { P: 'paper', L: 'leather' });
R('sugar', 1, ['S'], { S: 'sugar_cane_item' });
RS('bone_meal_item', 3, ['bone']);
// storage blocks
R('coal_block', 1, ['CCC', 'CCC', 'CCC'], { C: 'coal' });
RS('coal', 9, ['coal_block']);
R('iron_block', 1, ['III', 'III', 'III'], { I: 'iron_ingot' });
RS('iron_ingot', 9, ['iron_block']);
R('gold_block', 1, ['GGG', 'GGG', 'GGG'], { G: 'gold_ingot' });
RS('gold_ingot', 9, ['gold_block']);
R('diamond_block', 1, ['DDD', 'DDD', 'DDD'], { D: 'diamond' });
RS('diamond', 9, ['diamond_block']);
R('emerald_block', 1, ['EEE', 'EEE', 'EEE'], { E: 'emerald' });
RS('emerald', 9, ['emerald_block']);
R('lapis_block', 1, ['LLL', 'LLL', 'LLL'], { L: 'lapis_lazuli' });
RS('lapis_lazuli', 9, ['lapis_block']);
R('redstone_block', 1, ['RRR', 'RRR', 'RRR'], { R: 'redstone' });
RS('redstone', 9, ['redstone_block']);
R('copper_block', 1, ['CCC', 'CCC', 'CCC'], { C: 'copper_ingot' });
RS('copper_ingot', 9, ['copper_block']);
RS('gold_nugget', 9, ['gold_ingot']); // shapeless (MC: 1 ingot → 9 nuggets) — was R with a bare string, which iterated its letters ('g' crash)
R('gold_ingot', 1, ['NNN', 'NNN', 'NNN'], { N: 'gold_nugget' });
RS('netherite_ingot', 1, ['netherite_scrap', 'netherite_scrap', 'netherite_scrap', 'netherite_scrap', 'gold_ingot', 'gold_ingot', 'gold_ingot', 'gold_ingot']);
// food
R('bread', 1, ['WWW'], { W: 'wheat_item' });
R('pumpkin_pie', 1, ['P', 'S', 'E'], { P: 'pumpkin', S: 'sugar', E: 'egg' });
RS('mushroom_stew', 1, ['bowl', 'red_mushroom', 'brown_mushroom']);
RS('mushroom_stew', 1, ['red_mushroom', 'brown_mushroom']);
R('golden_apple', 1, ['GGG', 'GAG', 'GGG'], { G: 'gold_ingot', A: 'apple' });
R('golden_carrot', 1, ['NNN', 'NCN', 'NNN'], { N: 'gold_nugget', C: 'carrot' });
R('cookie', 8, ['WSW'], { W: 'wheat_item', S: 'sugar' });
// quartz / end
R('quartz_block', 1, ['QQ', 'QQ'], { Q: 'quartz' });
R('end_stone_bricks', 4, ['SS', 'SS'], { S: 'end_stone' });

// ---------- Stairs (MC: 4 per craft) ----------
R('oak_stairs', 4, ['P..', 'PP.', 'PPP'], { P: 'oak_planks' });
R('spruce_stairs', 4, ['P..', 'PP.', 'PPP'], { P: 'spruce_planks' });
R('birch_stairs', 4, ['P..', 'PP.', 'PPP'], { P: 'birch_planks' });
R('cobblestone_stairs', 4, ['C..', 'CC.', 'CCC'], { C: 'cobblestone' });
R('stone_brick_stairs', 4, ['S..', 'SS.', 'SSS'], { S: 'stone_bricks' });

// ---------- Dyes: primaries from flowers/materials ----------
RS('red_dye', 1, ['poppy']);
RS('red_dye', 1, ['red_tulip']);
RS('yellow_dye', 1, ['dandelion']);
RS('blue_dye', 1, ['blue_orchid']);
RS('blue_dye', 1, ['cornflower']);
RS('purple_dye', 1, ['allium']);
RS('light_gray_dye', 1, ['oxeye_daisy']);
RS('green_dye', 1, ['cactus']);
RS('white_dye', 1, ['bone_meal']);
// secondaries (MC mixing)
RS('orange_dye', 2, ['red_dye', 'yellow_dye']);
RS('pink_dye', 2, ['red_dye', 'white_dye']);
RS('lime_dye', 2, ['green_dye', 'white_dye']);
RS('cyan_dye', 2, ['blue_dye', 'green_dye']);
RS('magenta_dye', 2, ['purple_dye', 'pink_dye']);
RS('light_blue_dye', 2, ['blue_dye', 'white_dye']);
// ---------- Wool dyeing: white wool + dye → colored wool ----------
const WOOL_DYE_MAP = {
  red_dye: 'red_wool', yellow_dye: 'yellow_wool', blue_dye: 'blue_wool', purple_dye: 'purple_wool',
  light_gray_dye: 'light_gray_wool', green_dye: 'green_wool', white_dye: 'white_wool', orange_dye: 'orange_wool',
  pink_dye: 'pink_wool', lime_dye: 'lime_wool', cyan_dye: 'cyan_wool', magenta_dye: 'magenta_wool', light_blue_dye: 'light_blue_wool',
};
for (const [dye, wool] of Object.entries(WOOL_DYE_MAP)) {
  RS(wool, 1, [dye, 'white_wool']);
}
// carpets from any colored wool (white exists already)
for (const c of WOOL_COLORS) {
  if (c === 'white') continue;
  R(c + '_carpet', 3, ['WW'], { W: c + '_wool' });
}

// ---------- Potions / brewing / transport recipes ----------
R('glass_bottle', 3, ['G.G', '.G.'], { G: 'glass' });
RS('speckled_melon', 1, ['melon_slice', 'gold_nugget']);
RS('ender_eye', 1, ['ender_pearl', 'blaze_powder']);
RS('magma_cream', 1, ['slimeball', 'blaze_powder']);
RS('blaze_powder', 2, ['blaze_rod']);
R('boat', 1, ['P.P', 'PPP'], { P: '@PLANKS' });
R('minecart', 1, ['I.I', 'III'], { I: 'iron_ingot' });
R('rail', 16, ['I.I', 'ISI', 'I.I'], { I: 'iron_ingot', S: 'stick' });
R('brewing_stand', 1, ['.B.', 'CCC'], { B: 'blaze_rod', C: 'cobblestone' });
R('anvil', 1, ['III', '.I.', 'III'], { I: 'iron_block' });
R('oak_sign', 3, ['PPP', 'PPP', '.S.'], { P: '@PLANKS', S: 'stick' });


// clean zero-output placeholder recipes out
for (let i = RECIPES.length - 1; i >= 0; i--) if (!RECIPES[i].count) RECIPES.splice(i, 1);

// smelting
const SMELTING = {
  raw_iron: 'iron_ingot', raw_copper: 'copper_ingot', raw_gold: 'gold_ingot',
  sand: 'glass', red_sand: 'glass', cobblestone: 'stone', cobbled_deepslate: 'deepslate',
  stone: 'smooth_stone', clay_ball: 'brick',
  porkchop: 'cooked_porkchop', beef: 'cooked_beef', chicken: 'cooked_chicken',
  mutton: 'cooked_mutton', potato: 'baked_potato',
  oak_log: 'charcoal', spruce_log: 'charcoal', birch_log: 'charcoal', acacia_log: 'charcoal', dark_oak_log: 'charcoal',
};

function matchesIngredient(stackKey, spec) {
  if (typeof spec !== 'string') return false;
  if (spec[0] === '@') { const g = GROUPS[spec.slice(1)]; return !!(g && g.includes(stackKey)); }
  return stackKey === spec;
}

// match a crafting grid (array of stacks, w×w) against recipes
function matchRecipe(grid, size) {
  // normalize to minimal bounding box
  let minX = size, minY = size, maxX = -1, maxY = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (grid[y * size + x]) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }
  if (maxX < 0) return null;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = grid[(y + minY) * size + (x + minX)];
    cells.push(s ? ITEMS[s.id].key : null);
  }
  const cellAt = (x, y, flip) => cells[(flip ? w - 1 - x : x) + y * w];

  const itemCounts = new Map();
  for (const s of grid) if (s) itemCounts.set(ITEMS[s.id].key, (itemCounts.get(ITEMS[s.id].key) || 0) + 1);

  for (const r of RECIPES) {
    if (r.shapeless) {
      const need = new Map();
      for (const ing of r.shapeless) need.set(ing, (need.get(ing) || 0) + 1);
      let ok = itemCounts.size === need.size;
      if (ok) for (const [k, v] of need) if (itemCounts.get(k) !== v) { ok = false; break; }
      if (ok && itemCounts.size) return r;
      continue;
    }
    const rh = r.shape.length, rw = Math.max(...r.shape.map(s => s.length));
    if (rw !== w || rh !== h) continue;
    for (const flip of [false, true]) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) {
        const ch = (r.shape[y][flip ? rw - 1 - x : x] || '.');
        const cell = cellAt(x, y, false);
        if (ch === '.') { if (cell) ok = false; }
        else {
          if (!cell || !matchesIngredient(cell, r.keys[ch])) ok = false;
        }
      }
      if (ok) return r;
    }
  }
  return null;
}

// ============================================================================
// Container / inventory UI
// ============================================================================
const UI = {
  cursor: null,            // held stack on mouse
  craftGrid: null,         // array 4 or 9
  craftSize: 2,
  openTE: null, openTEPos: null,
  containerEl: null,
  hovering: null,
  refreshHotbar() {
    if (!G.player) return;
    const hb = $('hotbar');
    if (hb.children.length !== 9) {
      hb.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        const s = mkEl('div', 'hotbar-slot', hb);
        mkEl('img', 'slot-icon', s);
        mkEl('div', 'slot-count', s);
        const dwrap = mkEl('div', 'slot-durability', s);
        mkEl('div', 'slot-durability-fill', dwrap);
      }
    }
    for (let i = 0; i < 9; i++) {
      const el = hb.children[i];
      el.classList.toggle('selected', i === G.player.held);
      this.fillSlotEl(el, G.player.slots[i]);
    }
    const oh = $('offhand-hud-slot');
    if (oh && !oh.querySelector('.slot-durability')) {
      oh.innerHTML = '';
      mkEl('img', 'slot-icon', oh);
      mkEl('div', 'slot-count', oh);
      const dwrap = mkEl('div', 'slot-durability', oh);
      mkEl('div', 'slot-durability-fill', dwrap);
    }
    if (oh) this.fillSlotEl(oh, G.player.slots[40]);
  },

  fillSlotEl(el, stack) {
    const img = el.querySelector('.slot-icon, img');
    const cnt = el.querySelector('.slot-count');
    const dur = el.querySelector('.slot-durability');
    if (!img) return;
    if (!stack) {
      img.style.display = 'none'; img.removeAttribute('src');
      if (cnt) cnt.textContent = '';
      if (dur) dur.style.display = 'none';
      el.classList.remove('slot-enchanted');
      el.title = '';
      return;
    }
    const def = ITEMS[stack.id];
    img.style.display = 'block';
    const src = TEX.itemURL(stack.id);
    if (img.getAttribute('src') !== src) img.src = src;
    if (cnt) cnt.textContent = stack.count > 1 ? stack.count : '';
    el.classList.toggle('slot-enchanted', !!(stack.ench && Object.keys(stack.ench).length > 0));
    el.title = def.name;
    if (dur) {
      const maxDur = def.tool ? def.tool.uses : (def.armor ? def.armor.uses : 0);
      if (stack.dur !== undefined && maxDur && stack.dur < maxDur) {
        dur.style.display = 'block';
        const p = clamp(stack.dur / maxDur, 0, 1);
        const fill = dur.querySelector('.slot-durability-fill');
        fill.style.width = Math.max(4, Math.round(p * 100)) + '%';
        fill.style.background = `hsl(${Math.round(p * 120)}, 100%, 48%)`;
      } else dur.style.display = 'none';
    }
  },

  mkSlot(parent, section, index, hint) {
    const s = mkEl('div', 'inv-slot', parent);
    if (hint) { s.dataset.hint = hint; s.classList.add('empty-hint'); }
    mkEl('img', 'slot-icon', s);
    mkEl('div', 'slot-count', s);
    const dwrap = mkEl('div', 'slot-durability', s);
    mkEl('div', 'slot-durability-fill', dwrap);
    s.dataset.section = section; s.dataset.index = index;
    s.addEventListener('mousedown', (e) => { e.preventDefault(); this.slotClick(section, index, e.button, e.shiftKey); });
    s.addEventListener('mouseenter', () => { this.hovering = { section, index, el: s }; this.showTooltip(s); });
    s.addEventListener('mouseleave', () => { this.hovering = null; this.hideTooltip(); });
    s.addEventListener('contextmenu', e => e.preventDefault());
    return s;
  },

  getSlot(section, index) {
    const p = G.player;
    switch (section) {
      case 'inv': return p.slots[9 + index];
      case 'hot': return p.slots[index];
      case 'armor': return p.slots[36 + index];
      case 'off': return p.slots[40];
      case 'craft': return this.craftGrid[index];
      case 'craftout': return this.craftResult;
      case 'chest': return this.openTE && this.openTE.items ? this.openTE.items[index] : null;
      case 'fin': return this.openTE ? this.openTE.input : null;
      case 'ffuel': return this.openTE ? this.openTE.fuel : null;
      case 'fout': return this.openTE ? this.openTE.output : null;
      case 'minput': return this.merchantInput ? this.merchantInput[index] : null;
      case 'mresult': return this.merchantResult;
      default: return null;
    }
  },
  setSlot(section, index, val) {
    const p = G.player;
    switch (section) {
      case 'inv': p.slots[9 + index] = val; break;
      case 'hot': p.slots[index] = val; break;
      case 'armor': p.slots[36 + index] = val; break;
      case 'off': p.slots[40] = val; break;
      case 'craft': this.craftGrid[index] = val; break;
      case 'chest': if (this.openTE) this.openTE.items[index] = val; break;
      case 'fin': if (this.openTE) this.openTE.input = val; break;
      case 'ffuel': if (this.openTE) this.openTE.fuel = val; break;
      case 'fout': if (this.openTE) this.openTE.output = val; break;
      case 'minput': if (this.merchantInput) this.merchantInput[index] = val; break;
      case 'mresult': this.merchantResult = val; break;
    }
  },
  slotMax(section, index) {
    if (section === 'armor') return 1;
    if (section === 'fout') return 64;
    const s = this.getSlot(section, index);
    return s ? ITEMS[s.id].stack : 64;
  },

  slotClick(section, index, button, shift) {
    if (section === 'craftout') { this.takeCraftResult(shift); this.refreshOpen(); return; }
    if (section === 'mresult') { this.takeMerchantResult(shift); this.refreshOpen(); return; }
    if (section === 'fout') {
      // furnace output: only take
      const out = this.getSlot('fout');
      if (!out) return;
      if (!this.cursor) { this.cursor = out; this.setSlot('fout', null); }
      else if (this.cursor.id === out.id && this.cursor.count + out.count <= ITEMS[out.id].stack) {
        this.cursor.count += out.count; this.setSlot('fout', null);
      }
      SFX.playClick();
      this.refreshOpen(); this.updateCursorEl();
      return;
    }
    // armor restriction
    if (section === 'armor') {
      if (this.cursor) {
        const a = ITEMS[this.cursor.id].armor;
        if (!a || a.slot !== index) return;
      }
    }
    // shift quick-move
    if (shift) {
      this.quickMove(section, index);
      this.refreshOpen(); this.refreshHotbar();
      return;
    }
    const cur = this.getSlot(section, index);
    if (button === 0) {
      // left: pick up / place / merge / swap
      if (!this.cursor) {
        if (cur) { this.cursor = cur; this.setSlot(section, index, null); SFX.playClick(); }
      } else {
        if (!cur) { this.setSlot(section, index, this.cursor); this.cursor = null; }
        else if (cur.id === this.cursor.id && !cur.ench && !this.cursor.ench) {
          const max = ITEMS[cur.id].stack;
          const add = Math.min(this.cursor.count, max - cur.count);
          cur.count += add; this.cursor.count -= add;
          if (this.cursor.count <= 0) this.cursor = null;
        } else {
          this.setSlot(section, index, this.cursor);
          this.cursor = cur;
        }
        SFX.playClick();
      }
    } else if (button === 2) {
      // right: split / place one
      if (!this.cursor) {
        if (cur && cur.count > 1) {
          const half = Math.ceil(cur.count / 2);
          this.cursor = { ...cur, count: half };
          cur.count -= half;
        } else if (cur) { this.cursor = cur; this.setSlot(section, index, null); }
      } else {
        if (!cur) {
          this.setSlot(section, index, { ...this.cursor, count: 1 });
          this.cursor.count--;
          if (this.cursor.count <= 0) this.cursor = null;
        } else if (cur.id === this.cursor.id && cur.count < ITEMS[cur.id].stack) {
          cur.count++; this.cursor.count--;
          if (this.cursor.count <= 0) this.cursor = null;
        }
      }
      SFX.playClick(false);
    }
    if (section === 'craft') this.updateCraftResult();
    if (section === 'minput') this.updateMerchantResult();
    this.refreshOpen(); this.refreshHotbar(); this.updateCursorEl();
  },

  quickMove(section, index) {
    const stack = this.getSlot(section, index);
    if (!stack) return;
    const p = G.player;
    const tryRange = (from, to, arr, setter) => {
      for (let i = from; i < to && stack.count > 0; i++) {
        const s = arr[i];
        if (s && s.id === stack.id && !s.ench && !stack.ench && s.count < ITEMS[s.id].stack) {
          const add = Math.min(stack.count, ITEMS[s.id].stack - s.count);
          s.count += add; stack.count -= add;
        }
      }
      for (let i = from; i < to && stack.count > 0; i++) {
        if (!arr[i]) { setter(i, { ...stack }); stack.count = 0; }
      }
    };
    if (section === 'chest') {
      tryRange(0, 36, p.slots, (i, v) => p.slots[i] = v);
    } else if (section === 'inv' || section === 'hot') {
      if (this.openTE && this.openTE.type === 'chest') {
        tryRange(0, 27, this.openTE.items, (i, v) => this.openTE.items[i] = v);
      } else if (this.openTE && this.openTE.type === 'furnace') {
        // smart: smeltable → input, fuel → fuel
        const key = ITEMS[stack.id].key;
        if (SMELTING[key] && !this.openTE.input) { this.openTE.input = { ...stack }; stack.count = 0; }
        else if (ITEMS[stack.id].fuel && !this.openTE.fuel) { this.openTE.fuel = { ...stack }; stack.count = 0; }
      } else {
        // armor auto-equip
        const a = ITEMS[stack.id].armor;
        if (a && !p.slots[36 + a.slot]) { p.slots[36 + a.slot] = { ...stack }; stack.count = 0; }
        // hotbar <-> main move
        if (stack.count > 0) {
          if (section === 'hot') tryRange(9, 36, p.slots, (i, v) => p.slots[i] = v);
          else {
            // merge into hotbar first
            for (let i = 0; i < 9 && stack.count > 0; i++) {
              const s = p.slots[i];
              if (s && s.id === stack.id && s.count < ITEMS[s.id].stack) {
                const add = Math.min(stack.count, ITEMS[s.id].stack - s.count);
                s.count += add; stack.count -= add;
              }
            }
            for (let i = 0; i < 9 && stack.count > 0; i++) if (!p.slots[i]) { p.slots[i] = { ...stack }; stack.count = 0; }
          }
        }
      }
    } else if (section === 'fin' || section === 'ffuel') {
      tryRange(0, 36, p.slots, (i, v) => p.slots[i] = v);
    } else if (section === 'craft') {
      tryRange(0, 36, p.slots, (i, v) => p.slots[i] = v);
    }
    if (stack.count <= 0) this.setSlot(section, index, null);
    if (section === 'craft') this.updateCraftResult();
    if (section === 'minput') this.updateMerchantResult();
  },

  updateCraftResult() {
    const r = matchRecipe(this.craftGrid, this.craftSize);
    if (r) {
      const id = I[r.out];
      this.craftResult = { id, count: r.count };
      this.craftRecipe = r;
    } else { this.craftResult = null; this.craftRecipe = null; }
  },

  takeCraftResult(shift) {
    if (!this.craftResult) return;
    const p = G.player;
    const make = () => {
      // consume one of each grid item
      for (let i = 0; i < this.craftGrid.length; i++) {
        const s = this.craftGrid[i];
        if (s) { s.count--; if (s.count <= 0) this.craftGrid[i] = null; }
      }
      G.stats.crafted += this.craftResult.count;
      Advancements.onCraft(this.craftResult.id);
      SFX.playDig('wood');
    };
    if (shift) {
      let guard = 0;
      while (this.craftResult && guard++ < 64) {
        const leftover = p.addItem(this.craftResult.id, this.craftResult.count);
        if (leftover > 0) { dropItem(p.x, p.y + 1, p.z, ITEMS[this.craftResult.id].key, leftover); }
        make();
        this.updateCraftResult();
      }
    } else {
      if (!this.cursor) { this.cursor = { ...this.craftResult }; make(); }
      else if (this.cursor.id === this.craftResult.id && this.cursor.count + this.craftResult.count <= ITEMS[this.cursor.id].stack) {
        this.cursor.count += this.craftResult.count; make();
      }
      this.updateCraftResult();
    }
    this.updateCursorEl();
  },

  // ---------- open/close containers ----------
  isOpen() { return G.state === 'container'; },

  openScreen(builder, dark) {
    G.state = 'container';
    document.exitPointerLock && document.exitPointerLock();
    const cs = $('container-screen');
    cs.innerHTML = '';
    cs.classList.add('active');
    const win = mkEl('div', 'mc-window' + (dark ? ' mc-window-dark' : ''), cs);
    this.containerEl = win;
    builder(win);
    this.refreshOpen();
  },

  buildInvGrids(win, withHotbarLabel) {
    const main = mkEl('div', 'inv-grid', win);
    for (let i = 0; i < 27; i++) this.mkSlot(main, 'inv', i);
    const hot = mkEl('div', 'inv-grid', win);
    hot.style.marginTop = '8px';
    for (let i = 0; i < 9; i++) this.mkSlot(hot, 'hot', i);
    return main;
  },

  openInventory() {
    this.craftSize = 2;
    this.craftGrid = new Array(4).fill(null);
    this.openTE = null;
    this.openScreen(win => {
      const title = mkEl('div', 'mc-window-title', win, 'Inventory');
      mkEl('span', '', title);
      // CREATIVE catalog: every block & item, click = stack in hand
      if (G.player.gameMode === 'creative') {
        const cat = mkEl('div', '', win);
        cat.style.cssText = 'max-height:210px;overflow-y:auto;margin-bottom:10px;border:2px solid #555;background:#262626;padding:4px;';
        mkEl('div', 'slot-label', cat, 'Creative Inventar — klicken für einen Stack (64)');
        const grid = mkEl('div', '', cat);
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(13,34px);gap:2px;justify-content:center;';
        const seen = new Set();
        for (const def of ITEMS) {
          if (!def || def.key === 'air') continue;
          if (/placeholder|dummy|skip|comparator/.test(def.key)) continue;
          if (seen.has(def.key)) continue;
          seen.add(def.key);
          const id = def.id;
          const cell = mkEl('div', 'inv-slot', grid);
          cell.style.cssText = 'width:34px;height:34px;';
          cell.title = def.name;
          const img = mkEl('img', 'slot-icon', cell);
          img.src = TEX.itemURL(id);
          img.style.cssText = 'width:26px;height:26px;pointer-events:none;image-rendering:pixelated;';
          cell.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const stack = def.stack > 1 ? 64 : 1;
            this.cursor = { id, count: stack };
            if (def.tool) this.cursor.dur = def.tool.uses;
            if (def.armor) this.cursor.dur = def.armor.uses;
            this.updateCursorEl();
            SFX.playClick();
          });
        }
      }
      // armor column + craft grid
      const row = mkEl('div', '', win);
      row.style.display = 'flex'; row.style.gap = '14px'; row.style.marginBottom = '10px';
      const armor = mkEl('div', 'inv-grid g1', row);
      for (let i = 0; i < 4; i++) this.mkSlot(armor, 'armor', i, ['H', 'C', 'L', 'B'][i]);
      const craftWrap = mkEl('div', '', row);
      craftWrap.style.display = 'flex'; craftWrap.style.alignItems = 'center'; craftWrap.style.gap = '8px';
      const cg = mkEl('div', 'inv-grid g2', craftWrap);
      for (let i = 0; i < 4; i++) this.mkSlot(cg, 'craft', i);
      const arrow = mkEl('div', 'craft-arrow', craftWrap);
      this.paintArrow(arrow);
      const out = mkEl('div', 'inv-grid g1', craftWrap);
      this.mkSlot(out, 'craftout', 0);
      this.buildInvGrids(win);
    });
  },

  openCrafting() {
    this.craftSize = 3;
    this.craftGrid = new Array(9).fill(null);
    this.openTE = null;
    this.openScreen(win => {
      const title = mkEl('div', 'mc-window-title', win, 'Crafting');
      const sp = mkEl('span', '', title);
      const closeBtn = mkEl('button', 'mc-btn', title, 'X');
      closeBtn.style.padding = '2px 10px';
      closeBtn.onclick = () => this.closeContainer();
      const row = mkEl('div', '', win);
      row.style.display = 'flex'; row.style.gap = '14px'; row.style.marginBottom = '10px';
      const left = mkEl('div', '', row);
      const cg = mkEl('div', 'inv-grid g3', left);
      for (let i = 0; i < 9; i++) this.mkSlot(cg, 'craft', i);
      const row2 = mkEl('div', '', left);
      row2.style.display = 'flex'; row2.style.alignItems = 'center'; row2.style.gap = '8px'; row2.style.marginTop = '8px';
      const arrow = mkEl('div', 'craft-arrow', row2);
      this.paintArrow(arrow);
      const out = mkEl('div', 'inv-grid g1', row2);
      this.mkSlot(out, 'craftout', 0);
      // recipe book
      const rb = mkEl('div', '', row);
      rb.id = 'recipe-book-panel';
      this.buildRecipeBook(rb, 3);
      this.buildInvGrids(win);
    });
  },

  openChest(x, y, z) {
    const key = x + ',' + y + ',' + z;
    let te = G.tileEntities.get(key);
    if (!te) { te = { type: 'chest', items: new Array(27).fill(null) }; G.tileEntities.set(key, te); }
    if (te.type !== 'chest') return;
    this.openTE = te; this.openTEPos = key;
    this.craftGrid = null;
    this.openScreen(win => {
      const title = mkEl('div', 'mc-window-title', win, 'Chest');
      mkEl('span', '', title);
      const grid = mkEl('div', 'inv-grid', win);
      for (let i = 0; i < 27; i++) this.mkSlot(grid, 'chest', i);
      mkEl('div', 'slot-label', win, 'Inventory');
      this.buildInvGrids(win);
    }, false);
  },

  openFurnace(x, y, z) {
    const key = x + ',' + y + ',' + z;
    let te = G.tileEntities.get(key);
    if (!te) { te = { type: 'furnace', input: null, fuel: null, output: null, burn: 0, burnMax: 0, cook: 0 }; G.tileEntities.set(key, te); }
    if (te.type !== 'furnace') return;
    this.openTE = te; this.openTEPos = key;
    this.craftGrid = null;
    this.openScreen(win => {
      const title = mkEl('div', 'mc-window-title', win, 'Furnace');
      mkEl('span', '', title);
      const row = mkEl('div', '', win);
      row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '14px'; row.style.marginBottom = '10px';
      const colL = mkEl('div', '', row);
      colL.style.display = 'flex'; colL.style.flexDirection = 'column'; colL.style.gap = '6px'; colL.style.alignItems = 'center';
      const inG = mkEl('div', 'inv-grid g1', colL);
      this.mkSlot(inG, 'fin', 0);
      this.flameEl = mkEl('div', 'furnace-flame', colL);
      const fuelG = mkEl('div', 'inv-grid g1', colL);
      this.mkSlot(fuelG, 'ffuel', 0);
      this.arrowEl = mkEl('div', 'furnace-arrow', row);
      const outG = mkEl('div', 'inv-grid g1', row);
      this.mkSlot(outG, 'fout', 0);
      this.buildInvGrids(win);
      this.paintFurnace();
    }, false);
  },

  paintArrow(el) {
    el.innerHTML = '';
    const c = document.createElement('canvas');
    c.width = 22; c.height = 16;
    const x = c.getContext('2d');
    x.fillStyle = '#8b8b8b';
    x.fillRect(0, 6, 16, 4);
    x.beginPath(); x.moveTo(16, 2); x.lineTo(22, 8); x.lineTo(16, 14); x.fill();
    el.appendChild(c);
  },

  paintFurnace() {
    if (!this.openTE || this.openTE.type !== 'furnace') return;
    const te = this.openTE;
    if (this.flameEl) {
      this.flameEl.innerHTML = '';
      const c = document.createElement('canvas');
      c.width = 14; c.height = 14;
      const x = c.getContext('2d');
      const p = te.burnMax > 0 ? clamp(te.burn / te.burnMax, 0, 1) : 0;
      x.fillStyle = '#555';
      x.fillRect(2, 2, 10, 10);
      if (p > 0) {
        const h = Math.ceil(p * 10);
        x.fillStyle = '#e8641f';
        x.fillRect(4, 12 - h, 6, h);
        x.fillStyle = '#ffd42e';
        x.fillRect(5, 12 - Math.ceil(h * .7), 4, Math.ceil(h * .7));
      }
      this.flameEl.appendChild(c);
    }
    if (this.arrowEl) {
      this.arrowEl.innerHTML = '';
      const c = document.createElement('canvas');
      c.width = 44; c.height = 20;
      const x = c.getContext('2d');
      const p = clamp(te.cook / 200, 0, 1);
      x.fillStyle = '#8b8b8b';
      x.fillRect(0, 8, 32, 4);
      x.beginPath(); x.moveTo(32, 3); x.lineTo(42, 10); x.lineTo(32, 17); x.fill();
      if (p > 0) {
        x.fillStyle = '#fff';
        x.fillRect(0, 8, Math.ceil(p * 32), 4);
      }
      this.arrowEl.appendChild(c);
    }
  },

  openEnchanting(x, y, z) {
    const key = x + ',' + y + ',' + z;
    let te = G.tileEntities.get(key);
    if (!te) { te = { type: 'enchant', item: null }; G.tileEntities.set(key, te); }
    this.openTE = te; this.openTEPos = key;
    this.openScreen(win => {
      const title = mkEl('div', 'mc-window-title', win, 'Enchant');
      mkEl('span', '', title);
      const row = mkEl('div', '', win);
      row.style.display = 'flex'; row.style.gap = '14px'; row.style.marginBottom = '10px';
      const col = mkEl('div', '', row);
      const itemG = mkEl('div', 'inv-grid g1', col);
      this.mkSlot(itemG, 'enchitem', 0);
      const opts = mkEl('div', '', col);
      opts.id = 'enchant-opt';
      const p = G.player;
      const offers = [];
      const allEnch = ['sharpness', 'efficiency', 'unbreaking', 'protection', 'fortune', 'power'];
      for (let i = 0; i < 3; i++) {
        const cost = [10, 20, 30][i] + randInt(-2, 4);
        const ench = allEnch[randInt(0, allEnch.length - 1)];
        const lvl = 1 + randInt(0, 2);
        offers.push({ cost, ench, lvl });
        const b = mkEl('div', 'enchant-btn', opts, '');
        mkEl('span', '', b, `${ench} ${['I', 'II', 'III'][lvl - 1]}`);
        mkEl('span', 'cost', b, cost + ' levels');
        b.onclick = () => {
          const te2 = this.openTE;
          const stack = te2.item;
          if (!stack) { Chat.add('§cPlace an item to enchant first.'); return; }
          if (p.xpLevel < cost) { Chat.add('§cNot enough levels!'); SFX.playClick(false); return; }
          p.xpLevel -= cost;
          stack.ench = stack.ench || {};
          stack.ench[ench] = Math.max(stack.ench[ench] || 0, lvl);
          SFX.playLevelUp();
          spawnParticles(x + .5, y + 1.2, z + .5, 20, [0.7, 0.4, 1.0]);
          this.refreshOpen();
        };
      }
      this.buildInvGrids(win);
    }, true);
    // patch getSlot for enchitem
    const origGet = this.getSlot.bind(this);
    this.getSlot = (section, index) => section === 'enchitem' ? (this.openTE ? this.openTE.item : null) : origGet(section, index);
    const origSet = this.setSlot.bind(this);
    this.setSlot = (section, index, val) => { if (section === 'enchitem') { if (this.openTE) this.openTE.item = val; } else origSet(section, index, val); };
  },

  buildRecipeBook(rb, size) {
    rb.innerHTML = '';
    mkEl('div', '', rb, 'Recipe Book').style.cssText = 'font-weight:bold;margin-bottom:6px;';
    const grid = mkEl('div', 'rb-grid', rb);
    const p = G.player;
    for (const r of RECIPES) {
      try {
        if (!r || r.out === undefined) continue;
        const outId = I[r.out];
        if (outId === undefined) continue;
        if (!r.shapeless && !Array.isArray(r.shape)) continue;
        const cell = mkEl('div', 'inv-slot recipe-entry-slot', grid);
        const img = mkEl('img', 'slot-icon', cell);
        img.src = TEX.itemURL(outId);
        cell.title = ITEMS[outId].name;
        let canCraft = false;
        // count available ingredients matching any group member
        const countAvail = (spec) => {
          if (typeof spec !== 'string') return 0;
          const keys = spec[0] === '@' ? (GROUPS[spec.slice(1)] || [spec]) : [spec];
          let n = 0;
          for (const s of p.slots) if (s && ITEMS[s.id] && keys.includes(ITEMS[s.id].key)) n += s.count;
          return n;
        };
        let totalNeed = new Map();
        if (r.shapeless) {
          for (const ing of r.shapeless) totalNeed.set(ing, (totalNeed.get(ing) || 0) + 1);
        } else {
          for (const rowS of r.shape) for (const ch of rowS) {
            if (ch === '.') continue;
            const spec = r.keys ? r.keys[ch] : undefined;
            totalNeed.set(spec, (totalNeed.get(spec) || 0) + 1);
          }
        }
        canCraft = true;
        for (const [spec, n] of totalNeed) if (countAvail(spec) < n) { canCraft = false; break; }
        cell.style.borderColor = canCraft ? '#55ff55' : '#555';
        cell.style.opacity = canCraft ? '1' : '0.45';
        cell.onclick = () => {
          if (!canCraft) { SFX.playClick(false); return; }
          this.fillRecipe(r, size);
        };
      } catch (e) {
        // one malformed recipe must NEVER kill the whole crafting screen
        console.warn('[recipebook] skipped malformed recipe:', r && r.out, e.message);
      }
    }
  },

  fillRecipe(r, size) {
    // return current grid items to inventory first
    this.returnCraftGrid();
    const p = G.player;
    const takeFromInv = (spec) => {
      if (typeof spec !== 'string') return null;
      const keys = spec[0] === '@' ? (GROUPS[spec.slice(1)] || [spec]) : [spec];
      for (let i = 0; i < 36; i++) {
        const s = p.slots[i];
        if (s && keys.includes(ITEMS[s.id].key)) {
          const st = { id: s.id, count: 1 };
          s.count--;
          if (s.count <= 0) p.slots[i] = null;
          return st;
        }
      }
      return null;
    };
    if (r.shapeless) {
      // place anywhere
      r.shapeless.forEach((ing, i) => {
        const st = takeFromInv(ing);
        if (st) this.craftGrid[i] = st;
      });
    } else {
      for (let y = 0; y < r.shape.length; y++) for (let x = 0; x < r.shape[y].length; x++) {
        const ch = r.shape[y][x];
        if (ch === '.') continue;
        const gi = y * size + x;
        const st = takeFromInv(r.keys[ch]);
        if (st) this.craftGrid[gi] = st;
      }
    }
    this.updateCraftResult();
    this.refreshOpen(); this.refreshHotbar();
    SFX.playClick();
  },

  returnCraftGrid() {
    if (!this.craftGrid) return;
    const p = G.player;
    for (let i = 0; i < this.craftGrid.length; i++) {
      const s = this.craftGrid[i];
      if (s) {
        const left = p.addItem(s.id, s.count, s.dur, s.ench);
        if (left > 0) dropItem(p.x, p.y + 1, p.z, ITEMS[s.id].key, left);
        this.craftGrid[i] = null;
      }
    }
  },

  // MC 1:1: hovering any slot and pressing 1-9 moves the item to that hotbar
  // slot (merge on same type, swap otherwise). Hovering the CRAFTING OUTPUT
  // crafts it straight into the hotbar slot (refused if it cannot fit).
  moveHoveredToHotbar(n) {
    if (G.state !== 'container' || !this.hovering) return;
    const { section, index } = this.hovering;
    const p = G.player;
    if (section === 'craftout') {
      if (!this.craftResult) return;
      const res = this.craftResult;
      const dest = this.getSlot('hot', n);
      const stack = ITEMS[res.id].stack;
      const fits = !dest ? stack : (dest.id === res.id ? stack - dest.count : 0);
      if (fits <= 0) return;
      if (!dest) this.setSlot('hot', n, { id: res.id, count: Math.min(res.count, stack), dur: res.dur, ench: res.ench });
      else dest.count += Math.min(res.count, fits);
      // consume one craft (same as takeCraftResult's make())
      for (let i = 0; i < this.craftGrid.length; i++) {
        const s = this.craftGrid[i];
        if (s) { s.count--; if (s.count <= 0) this.craftGrid[i] = null; }
      }
      G.stats.crafted += res.count;
      Advancements.onCraft(res.id);
      this.updateCraftResult();
      SFX.playDig('wood');
    } else {
      const src = this.getSlot(section, index);
      if (!src) return;
      const dest = this.getSlot('hot', n);
      if (!dest) { this.setSlot('hot', n, src); this.setSlot(section, index, null); }
      else if (dest.id === src.id && !src.ench && !dest.ench && dest.count < ITEMS[dest.id].stack) {
        const space = ITEMS[dest.id].stack - dest.count;
        const move = Math.min(space, src.count);
        dest.count += move;
        src.count -= move;
        if (src.count <= 0) this.setSlot(section, index, null);
      } else {
        this.setSlot(section, index, dest); // swap
        this.setSlot('hot', n, src);
      }
      if (section === 'craft') this.updateCraftResult();
    if (section === 'minput') this.updateMerchantResult();
    }
    this.refreshOpen();
    this.refreshHotbar();
    this.updateCursorEl();
  },

  // ---------- Villager trading (MC MerchantScreen, 1:1 aus den REA-Daten:
  // MerchantOffer.satisfiedBy/take + VillagerData-XP-Thresholds + 2×/Tag-Restock) ----------
  openTrading(v) {
    this.craftGrid = null; this.openTE = null;
    this.merchantVillager = v;
    getVillagerOffers(v);
    this.merchantInput = [null, null];
    this.selectedTradeIdx = null;
    this.merchantResult = null;
    this.openScreen(win => {
      const title = mkEl('div', 'mc-window-title', win, profName(v.profession) + ' · ' + levelName(v.villagerLevel));
      const sp = mkEl('span', '', title);
      const closeBtn = mkEl('button', 'mc-btn', title, 'X');
      closeBtn.style.padding = '2px 10px';
      closeBtn.onclick = () => this.closeContainer();
      const row = mkEl('div', '', win);
      row.style.display = 'flex'; row.style.gap = '14px';
      const list = mkEl('div', '', row);
      list.id = 'merchant-trade-list';
      list.style.cssText = 'max-height:240px;overflow-y:auto;width:250px;';
      this.buildTradeList(list);
      const right = mkEl('div', '', row);
      right.style.cssText = 'display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;';
      const irow = mkEl('div', '', right);
      irow.style.cssText = 'display:flex;gap:6px;align-items:center;';
      this.mkSlot(irow, 'minput', 0);
      this.mkSlot(irow, 'minput', 1);
      const arrow = mkEl('div', 'craft-arrow', irow);
      this.paintArrow(arrow);
      this.mkSlot(right, 'mresult', 0);
      this.buildInvGrids(win);
      this.refreshOpen();
    });
  },

  buildTradeList(list) {
    list.innerHTML = '';
    const v = this.merchantVillager;
    if (!v) return;
    const offers = getVillagerOffers(v);
    offers.forEach((o, i) => {
      const selected = this.selectedTradeIdx === i;
      const cell = mkEl('div', 'merchant-trade', list);
      cell.style.cssText = 'display:flex;gap:5px;align-items:center;padding:4px 6px;border:2px solid ' +
        (selected ? '#55ff55' : '#555') + ';margin-bottom:4px;cursor:pointer;background:rgba(0,0,0,.25);' +
        (o.uses >= o.maxUses ? 'opacity:.4;' : '');
      const icon = (stack, big) => {
        const wrap = mkEl('div', '', cell);
        wrap.style.cssText = 'position:relative;width:24px;height:24px;';
        const im = mkEl('img', 'slot-icon', wrap);
        im.src = TEX.itemURL(I[stack.id]);
        im.style.cssText = 'width:22px;height:22px;image-rendering:pixelated;';
        if (stack.count > 1) { const c = mkEl('div', 'slot-count', wrap); c.textContent = stack.count; }
      };
      icon(o.buy);
      if (o.buyB) icon(o.buyB);
      mkEl('div', '', cell, '→').style.cssText = 'color:#aaa;font-size:14px;';
      icon(o.sell);
      const left = mkEl('div', '', cell, T('trade.uses_left', { n: (o.maxUses - o.uses) }));
      left.style.cssText = 'margin-left:auto;color:#8f8;font-size:11px;';
      cell.onclick = () => {
        this.selectedTradeIdx = i;
        this.updateMerchantResult();
        this.refreshOpen();
        this.buildTradeList(list);
      };
    });
  },

  updateMerchantResult() {
    this.merchantResult = null;
    const t = this.selectedTradeIdx !== null && this.merchantVillager ? this.merchantVillager.offers[this.selectedTradeIdx] : null;
    if (!t) return;
    const a = this.merchantInput[0], b = this.merchantInput[1];
    // MerchantOffer.satisfiedBy (1:1): input count >= cost, exact item; costB
    // present → must also match, otherwise slot B must stay empty
    const okA = !!a && ITEMS[a.id].key === t.buy.id && a.count >= t.buy.count;
    const okB = t.buyB ? (!!b && ITEMS[b.id].key === t.buyB.id && b.count >= t.buyB.count) : !b;
    if (okA && okB && t.uses < t.maxUses) this.merchantResult = { id: I[t.sell.id], count: t.sell.count };
  },

  takeMerchantResult(shift) {
    const t = this.selectedTradeIdx !== null && this.merchantVillager ? this.merchantVillager.offers[this.selectedTradeIdx] : null;
    if (!t || !this.merchantResult) return;
    const p = G.player;
    const give = () => {
      // MerchantOffer.take (1:1): shrink inputs by cost, increaseUses
      const a = this.merchantInput[0];
      if (a) { a.count -= t.buy.count; if (a.count <= 0) this.merchantInput[0] = null; }
      if (t.buyB && this.merchantInput[1]) {
        const b = this.merchantInput[1];
        b.count -= t.buyB.count;
        if (b.count <= 0) this.merchantInput[1] = null;
      }
      t.uses++;
      this.merchantVillager.tradingXp = (this.merchantVillager.tradingXp || 0) + t.xp;
      // VillagerData level-up: thresholds [0, 10, 70, 150, 250] unlock the next trade tier
      while (this.merchantVillager.villagerLevel < 5 && this.merchantVillager.tradingXp >= NEXT_LEVEL_XP_THRESHOLDS[this.merchantVillager.villagerLevel]) {
        this.merchantVillager.villagerLevel++;
        const nt = (VILLAGER_TRADES[this.merchantVillager.profession][this.merchantVillager.villagerLevel] || []).map(mkOffer);
        this.merchantVillager.offers.push(...nt);
        Chat.add(T('chat.level_up', { prof: profName(this.merchantVillager.profession), level: levelName(this.merchantVillager.villagerLevel) }));
      }
      SFX.playDig('wood');
    };
    if (shift) {
      let guard = 0;
      while (this.merchantResult && guard++ < 64) {
        const left = p.addItem(this.merchantResult.id, this.merchantResult.count);
        if (left > 0) { dropItem(p.x, p.y + 1, p.z, ITEMS[this.merchantResult.id].key, left); break; }
        give();
        this.updateMerchantResult();
      }
    } else {
      if (!this.cursor) this.cursor = { ...this.merchantResult };
      else if (this.cursor.id === this.merchantResult.id && this.cursor.count + this.merchantResult.count <= ITEMS[this.merchantResult.id].stack) this.cursor.count += this.merchantResult.count;
      else return;
      give();
    }
    this.updateCursorEl();
  },

  closeContainer() {
    if (G.state !== 'container') return;
    this.returnCraftGrid();
    // trading screen: return any goods placed in the merchant input slots
    if (this.merchantInput) {
      const p = G.player;
      for (let i = 0; i < this.merchantInput.length; i++) {
        const s = this.merchantInput[i];
        if (s) {
          const left = p.addItem(s.id, s.count, s.dur, s.ench);
          if (left > 0) dropItem(p.x, p.y + 1, p.z, ITEMS[s.id].key, left);
          this.merchantInput[i] = null;
        }
      }
    }
    this.merchantVillager = null;
    this.selectedTradeIdx = null;
    this.merchantResult = null;
    if (this.cursor) {
      const p = G.player;
      const left = p.addItem(this.cursor.id, this.cursor.count, this.cursor.dur, this.cursor.ench);
      if (left > 0) dropItem(p.x, p.y + 1, p.z, ITEMS[this.cursor.id].key, left);
      this.cursor = null;
      this.updateCursorEl();
    }
    // restore getSlot/setSlot overrides
    delete this._origPatch;
    this.openTE = null; this.craftGrid = null;
    $('container-screen').classList.remove('active');
    $('container-screen').innerHTML = '';
    this.hideTooltip();
    G.state = 'playing';
    this.refreshHotbar();
    requestPointerLock();
  },

  refreshOpen() {
    const cs = $('container-screen');
    if (!cs.classList.contains('active')) return;
    for (const el of cs.querySelectorAll('.inv-slot')) {
      const section = el.dataset.section;
      const index = Number(el.dataset.index);
      if (!section) continue;
      this.fillSlotEl(el, this.getSlot(section, index));
      if (section === 'craft' || section === 'craftout') {
        if (section === 'craftout') this.fillSlotEl(el, this.craftResult);
      }
      if (section === 'mresult') this.fillSlotEl(el, this.merchantResult);
    }
    // recipe book updates IN REAL TIME: re-evaluate craftability on every
    // inventory/grid change (MC grays/un-grays recipes live as materials change)
    const rb = document.getElementById('recipe-book-panel');
    if (rb) this.buildRecipeBook(rb, this.craftSize || 3);
    // trade list refreshes live too (stock counters + selected highlight)
    const ml = document.getElementById('merchant-trade-list');
    if (ml && this.merchantVillager) this.buildTradeList(ml);
    if (this.openTE && this.openTE.type === 'furnace') this.paintFurnace();
  },

  updateCursorEl() {
    const el = $('cursor-item');
    if (!this.cursor) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = '';
    const img = mkEl('img', 'slot-icon', el);
    img.src = TEX.itemURL(this.cursor.id);
    img.style.width = '32px'; img.style.height = '32px';
    if (this.cursor.count > 1) mkEl('div', 'slot-count', el, this.cursor.count);
  },

  showTooltip(slotEl) {
    const section = slotEl.dataset.section;
    const index = Number(slotEl.dataset.index);
    let stack = section === 'craftout' ? this.craftResult : this.getSlot(section, index);
    if (!stack) { this.hideTooltip(); return; }
    const def = ITEMS[stack.id];
    const tt = $('item-tooltip');
    tt.innerHTML = '';
    mkEl('div', 'tt-name', tt, def.name);
    if (stack.ench) for (const [k, v] of Object.entries(stack.ench)) mkEl('div', 'tt-lore', tt, `${k} ${['I', 'II', 'III', 'IV', 'V'][v - 1]}`);
    if (def.tool) mkEl('div', 'tt-stat', tt, `Attack: ${def.damage}`);
    if (def.armor) mkEl('div', 'tt-stat', tt, `Defense: +${def.armor.defense}`);
    if (def.food) mkEl('div', 'tt-stat', tt, `Restores ${def.food.food} hunger`);
    if (stack.dur !== undefined && def.tool) mkEl('div', 'tt-stat', tt, `Durability: ${stack.dur}/${def.tool.uses}`);
    tt.style.display = 'block';
    const move = () => {
      const r = slotEl.getBoundingClientRect();
      tt.style.left = (r.right + 8) + 'px';
      tt.style.top = (r.top - 6) + 'px';
    };
    move();
  },
  hideTooltip() { $('item-tooltip').style.display = 'none'; },

  damageFlash() {
    const v = $('damage-vignette');
    v.style.opacity = '0.9';
    setTimeout(() => v.style.opacity = '0', 180);
  },

  showDeathScreen(cause) {
    G.state = 'dead';
    document.exitPointerLock && document.exitPointerLock();
    $('death-score').textContent = 'Score: ' + (G.stats.mined + G.stats.kills * 5 + G.player.xpLevel * 10);
    $('death-screen').classList.add('active');
    if (G.gameMode === 'hardcore') {
      $('btn-respawn').disabled = true;
      $('btn-respawn').textContent = 'Hardcore — World Over';
    }
    // the death overlay appears with the cursor parked at the CENTER of the
    // screen — exactly on the respawn button. Arm the buttons only after a
    // short grace so a reflex/re-focus click can NEVER respawn instantly.
    const arm = () => { $('btn-respawn').disabled = false; $('btn-death-title').disabled = false; };
    $('btn-respawn').disabled = true;
    $('btn-death-title').disabled = true;
    setTimeout(arm, 400);
  },
};

// furnace ticking for all loaded furnaces
function tickFurnaces() {
  for (const [key, te] of G.tileEntities) {
    if (te.type !== 'furnace') continue;
    const [x, y, z] = key.split(',').map(Number);
    if (dist2d(x, z, G.player.x, G.player.z) > 128) continue;
    let changed = false;
    const inputKey = te.input ? ITEMS[te.input.id].key : null;
    const smeltOut = inputKey ? SMELTING[inputKey] : null;
    const canSmelt = smeltOut && (!te.output || (te.output.id === I[smeltOut] && te.output.count < ITEMS[te.output.id].stack));
    if (te.burn > 0) { te.burn--; changed = true; }
    if (te.burn <= 0 && canSmelt && te.fuel) {
      const f = ITEMS[te.fuel.id].fuel;
      if (f > 0) {
        te.burn = f / 100 * 200 / 1600 * 1600; // fuel ticks scaled: coal=1600 → 1600 ticks burn
        te.burn = Math.round(f * 1.0);
        te.burnMax = te.burn;
        te.fuel.count--;
        if (te.fuel.count <= 0) te.fuel = null;
        changed = true;
      }
    }
    if (te.burn > 0 && canSmelt) {
      te.cook++;
      if (te.cook >= 200) {
        te.cook = 0;
        if (te.output) te.output.count++;
        else te.output = { id: I[smeltOut], count: 1 };
        te.input.count--;
        if (te.input.count <= 0) te.input = null;
        // furnace XP: collect when player takes output
        te.storedXP = (te.storedXP || 0) + 1;
        changed = true;
      }
    } else if (!canSmelt) te.cook = Math.max(0, te.cook - 2);
    // lit state → meta bit
    const world = G.world;
    const id = world.getBlock(x, y, z);
    if (id === B.furnace) {
      const m = world.getMeta(x, y, z);
      const lit = te.burn > 0 ? 8 : 0;
      const facing = m & 7;
      if ((m & 8) !== lit) world.setBlock(x, y, z, B.furnace, facing | lit, { noEdit: false });
    }
    if (changed && UI.isOpen() && UI.openTE === te) UI.paintFurnace();
  }
}

// furnace output pickup grants XP
const origSlotClickFurnace = UI.slotClick.bind(UI);
UI.slotClick = function (section, index, button, shift) {
  const wasOutput = section === 'fout';
  const out = wasOutput ? this.getSlot('fout') : null;
  origSlotClickFurnace(section, index, button, shift);
  if (wasOutput && out && !this.getSlot('fout') && this.openTE && this.openTE.storedXP) {
    G.player.addXP(this.openTE.storedXP);
    this.openTE.storedXP = 0;
  }
};

// ============================================================================
// Advancements (achievements) with toast popups
// ============================================================================
const Advancements = {
  defs: [
    { key: 'mine_stone', title: 'Stone Age', desc: 'Mine stone with a pickaxe', test: s => s.mined > 0 },
    { key: 'craft_table', title: 'Benchmarking', desc: 'Craft a crafting table', test: () => G.advancements.has('mine_stone') },
    { key: 'wood', title: 'Getting Wood', desc: 'Punch a tree', test: () => G.stats.mined > 0 },
    { key: 'iron', title: 'Acquire Hardware', desc: 'Smelt an iron ingot', test: s => false },
    { key: 'diamond', title: 'DIAMONDS!', desc: 'Mine a diamond', test: s => false },
    { key: 'kill', title: 'Monster Hunter', desc: 'Slay a hostile mob', test: s => s.kills > 0 },
    { key: 'walk_km', title: 'Traveler', desc: 'Walk 500 blocks', test: s => s.walked > 500 },
  ],
  unlock(key) {
    if (G.advancements.has(key)) return;
    G.advancements.add(key);
    const d = this.defs.find(x => x.key === key);
    if (!d) return;
    $('adv-toast-desc').textContent = d.title + ' — ' + d.desc;
    const t = $('advancement-toast');
    t.classList.add('visible');
    SFX.playXPOrb();
    setTimeout(() => t.classList.remove('visible'), 3500);
  },
  onMine(blockId) {
    const bl = BLOCKS[blockId];
    this.unlock('wood');
    if (bl.key.includes('_log')) this.unlock('wood');
    if (bl.key === 'stone' || bl.key === 'cobblestone') this.unlock('mine_stone');
    if (bl.key === 'diamond_ore' || bl.key === 'deepslate_diamond_ore') this.unlock('diamond');
  },
  onPlace(blockId) {
    const bl = BLOCKS[blockId];
    if (!bl) return;
    if (bl.key === 'crafting_table') this.unlock('craft_table');
    if (bl.key === 'furnace') this.unlock('hot_topic');
    if (bl.key === 'enchanting_table') this.unlock('enchanter');
  },
  onCraft(itemId) {
    if (ITEMS[itemId].key === 'crafting_table') this.unlock('craft_table');
    if (ITEMS[itemId].key === 'iron_ingot') this.unlock('iron');
  },
  onKill(hostile) { if (hostile) this.unlock('kill'); },
  tick() { if (G.stats.walked > 500) this.unlock('walk_km'); },
};

// ---------- Brewing: water_bottle + nether_wart → awkward; awkward + ing → potion ----------
const BREWING_MAP = {
  sugar: 'potion_speed', blaze_powder: 'potion_strength', ghast_tear: 'potion_regen',
  magma_cream: 'potion_fire_res', golden_carrot: 'potion_night_vision', speckled_melon: 'potion_healing',
  spider_eye: 'potion_poison',
};
const BREW_FUEL = 'blaze_powder';

// ---------- Sign edit / anvil / brewing UIs ----------
UI.openSignEdit = function (x, y, z) {
  const key = x + ',' + y + ',' + z;
  let te = G.tileEntities.get(key);
  if (!te) { te = { type: 'sign', lines: ['', ''] }; G.tileEntities.set(key, te); }
  this.openTE = te; this.openTEPos = key;
  this.openScreen(win => {
    mkEl('div', 'mc-window-title', win, 'Edit Sign');
    const wrap = mkEl('div', '', win);
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:6px 2px;';
    te.lines.forEach((line, i) => {
      const inp = mkEl('input', 'mc-input', wrap);
      inp.maxLength = 20;
      inp.value = line;
      inp.oninput = () => { te.lines[i] = inp.value; };
    });
    const done = mkEl('button', 'mc-btn', win, 'Done');
    done.style.marginTop = '10px';
    done.onclick = () => { this.closeContainer(); };
  });
};

UI.openAnvil = function (x, y, z) {
  const key = x + ',' + y + ',' + z;
  let te = G.tileEntities.get(key);
  if (!te) { te = { type: 'anvil', item: null, mat: null, name: '' }; G.tileEntities.set(key, te); }
  this.openTE = te; this.openTEPos = key;
  this.openScreen(win => {
    mkEl('div', 'mc-window-title', win, 'Repair & Name');
    const row = mkEl('div', '', win);
    row.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:10px;';
    const g1 = mkEl('div', 'inv-grid g1', row);
    this.mkSlot(g1, 'anvitem', 0, 'Tool');
    const plus = mkEl('div', '', row, '+');
    plus.style.cssText = 'font-size:20px;font-weight:bold;';
    const g2 = mkEl('div', 'inv-grid g1', row);
    this.mkSlot(g2, 'anvmat', 0, 'Mat.');
    const eq = mkEl('div', '', row, '=');
    eq.style.cssText = 'font-size:20px;font-weight:bold;';
    const g3 = mkEl('div', 'inv-grid g1', row);
    this.mkSlot(g3, 'anvout', 0);
    const nameRow = mkEl('div', '', win);
    nameRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:10px;';
    mkEl('div', 'slot-label', nameRow, 'Name:');
    const nameInp = mkEl('input', 'mc-input', nameRow);
    nameInp.maxLength = 24;
    nameInp.placeholder = 'custom name...';
    nameInp.oninput = () => { te.name = nameInp.value; this.updateAnvilOutput(); };
    const info = mkEl('div', 'slot-label', win, 'Tool + its material repairs 25% durability per material.');
    this.buildInvGrids(win);
    // hook the anvil slots
    const origGet = this.getSlot.bind(this);
    this.getSlot = (sec, i) => sec === 'anvitem' ? te.item : sec === 'anvmat' ? te.mat : sec === 'anvout' ? this.anvilOut : origGet(sec, i);
    const origSet = this.setSlot.bind(this);
    this.setSlot = (sec, i, v) => {
      if (sec === 'anvitem') { te.item = v; this.updateAnvilOutput(); }
      else if (sec === 'anvmat') { te.mat = v; this.updateAnvilOutput(); }
      else if (sec === 'anvout') { }
      else origSet(sec, i, v);
    };
    const origClick = this.slotClick.bind(this);
    this.slotClick = (sec, index, button, shift) => {
      if (sec === 'anvout') {
        if (this.anvilOut && !this.cursor) { this.cursor = this.anvilOut; this.anvilOut = null; te.item = null; SFX.playClick(); }
        this.refreshOpen(); this.updateCursorEl();
        return;
      }
      origClick(sec, index, button, shift);
      this.updateAnvilOutput();
    };
    this.updateAnvilOutput();
  }, false);
};

UI.updateAnvilOutput = function () {
  const te = this.openTE;
  this.anvilOut = null;
  if (!te || te.type !== 'anvil' || !te.item) { if (this.containerEl) this.refreshOpen(); return; }
  const def = ITEMS[te.item.id];
  const src = { id: te.item.id, count: 1, dur: te.item.dur, ench: te.item.ench, customName: te.name || te.item.customName };
  const maxDur = def.tool ? def.tool.uses : (def.armor ? def.armor.uses : 0);
  const curDur = te.item.dur === undefined ? maxDur : te.item.dur;
  // repair with matching material
  const MATS = { wood: '@PLANKS', stone: 'cobblestone', iron: 'iron_ingot', gold: 'gold_ingot', diamond: 'diamond' };
  const matSpec = def.tool ? MATS[def.tool.type === 'pickaxe' || def.tool.type === 'axe' || def.tool.type === 'shovel' || def.tool.type === 'hoe' ? tierOfMaterial(def) : ''] : null;
  function tierOfMaterial(def2) { return 'stone'; } // material tier mapping below
  if (te.mat && maxDur && curDur < maxDur) {
    const matKey = ITEMS[te.mat.id].key;
    const needMat = { wood: ['oak_planks', 'spruce_planks', 'birch_planks', 'acacia_planks', 'dark_oak_planks'], stone: ['cobblestone'], iron: ['iron_ingot'], gold: ['gold_ingot'], diamond: ['diamond'] };
    const tierKey = def.tool ? (def.tool.tier === 0 ? (def.tool.speed >= 12 ? 'gold' : 'wood') : def.tool.tier === 1 ? 'stone' : def.tool.tier === 2 ? 'iron' : 'diamond') : null;
    const list = tierKey ? needMat[tierKey] : null;
    if (list && list.includes(matKey)) {
      src.dur = Math.min(maxDur, curDur + Math.ceil(maxDur * 0.25));
    }
  }
  if (te.name) src.customName = te.name;
  this.anvilOut = src;
  if (this.containerEl) this.refreshOpen();
};

UI.openBrewing = function (x, y, z) {
  const key = x + ',' + y + ',' + z;
  let te = G.tileEntities.get(key);
  if (!te) { te = { type: 'brewing', bottles: [null, null, null], ingredient: null, fuel: 0, brew: 0 }; G.tileEntities.set(key, te); }
  this.openTE = te; this.openTEPos = key;
  this.openScreen(win => {
    mkEl('div', 'mc-window-title', win, 'Brewing Stand');
    const row = mkEl('div', '', win);
    row.style.cssText = 'display:flex;align-items:center;gap:14px;margin-bottom:10px;';
    const col = mkEl('div', '', row);
    col.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:center;';
    const fuelG = mkEl('div', 'inv-grid g1', col);
    this.mkSlot(fuelG, 'brewfuel', 0, 'Fuel');
    this.brewFlame = mkEl('div', 'furnace-flame', col);
    const g1 = mkEl('div', 'inv-grid g1', col);
    this.mkSlot(g1, 'brewing', 0);
    const g2 = mkEl('div', 'inv-grid g1', col);
    this.mkSlot(g2, 'brewing', 1);
    const g3 = mkEl('div', 'inv-grid g1', col);
    this.mkSlot(g3, 'brewing', 2);
    this.brewArrow = mkEl('div', 'furnace-arrow', row);
    const ingG = mkEl('div', 'inv-grid g1', row);
    this.mkSlot(ingG, 'brewing', 3, 'Ing.');
    this.buildInvGrids(win);
    const origGet = this.getSlot.bind(this);
    this.getSlot = (sec, i) => sec === 'brewing' ? te.bottles[i] : sec === 'brewfuel' ? (te.fuelItem || null) : origGet(sec, i);
    const origSet = this.setSlot.bind(this);
    this.setSlot = (sec, i, v) => {
      if (sec === 'brewing') te.bottles[i] = v;
      else if (sec === 'brewfuel') { te.fuelItem = v; }
      else origSet(sec, i, v);
    };
  }, true);
};

function tickBrewing() {
  for (const [key, te] of G.tileEntities) {
    if (te.type !== 'brewing') continue;
    const [x, y, z] = key.split(',').map(Number);
    if (dist2d(x, z, G.player.x, G.player.z) > 128) continue;
    let changed = false;
    const ingKey = te.ingredient ? ITEMS[te.ingredient.id].key : null;
    // what would we brew into each bottle?
    let canBrew = false;
    const results = te.bottles.map(b => {
      if (!b) return null;
      const bk = ITEMS[b.id].key;
      if (ingKey === 'nether_wart') return bk === 'water_bottle' ? { id: I.awkward_potion, count: 1 } : null;
      if (bk === 'awkward_potion' && BREWING_MAP[ingKey]) return { id: I[BREWING_MAP[ingKey]], count: 1 };
      // MC-style upgrades: redstone lengthens, glowstone empowers (stack-level override)
      const srcPot = ITEMS[b.id].potion;
      if (ingKey === 'redstone' && srcPot && srcPot.effect !== 'healing' && srcPot.dur > 0) return { id: b.id, count: 1, pot: { ...srcPot, dur: Math.round(srcPot.dur * 8 / 3) } };
      if (ingKey === 'glowstone_dust' && srcPot && srcPot.effect !== 'healing') return { id: b.id, count: 1, pot: { ...srcPot, lvl: 2 } };
      return null;
    });
    canBrew = te.ingredient && results.some(r => r);
    if (canBrew) {
      // fuel is consumed only while actively brewing; 1 blaze powder = 1600 ticks (20 potions)
      if (te.fuel <= 0) {
        if (te.fuelItem && ITEMS[te.fuelItem.id].key === BREW_FUEL) { te.fuel = 1600; te.fuelItem.count--; if (te.fuelItem.count <= 0) te.fuelItem = null; }
      }
      if (te.fuel > 0) { te.fuel--; te.brew++; }
      else canBrew = false;
      changed = true;
      if (te.brew >= 160) {
        te.brew = 0;
        te.bottles.forEach((b, i) => { if (results[i]) te.bottles[i] = { ...results[i] }; });
        te.ingredient.count--;
        if (te.ingredient.count <= 0) te.ingredient = null;
        SFX.playXPOrb();
      }
    } else te.brew = Math.max(0, te.brew - 2);
    if (changed && UI.isOpen() && UI.openTE === te) UI.paintBrewing();
  }
}
const _origTickFurnaces = tickFurnaces;
tickFurnaces = function () { _origTickFurnaces(); tickBrewing(); };

UI.paintBrewing = function () {
  const te = this.openTE;
  if (!te || te.type !== 'brewing' || !this.brewArrow) return;
  if (this.brewFlame) {
    this.brewFlame.innerHTML = '';
    const c = document.createElement('canvas');
    c.width = 14; c.height = 14;
    const x = c.getContext('2d');
    const p2 = te.fuel > 0 ? clamp(te.fuel / 20, 0, 1) : 0;
    x.fillStyle = '#555';
    x.fillRect(2, 2, 10, 10);
    if (p2 > 0) { const h = Math.ceil(p2 * 10); x.fillStyle = '#e8641f'; x.fillRect(4, 12 - h, 6, h); x.fillStyle = '#ffd42e'; x.fillRect(5, 12 - Math.ceil(h * .7), 4, Math.ceil(h * .7)); }
    this.brewFlame.appendChild(c);
  }
  this.brewArrow.innerHTML = '';
  const c = document.createElement('canvas');
  c.width = 44; c.height = 20;
  const x = c.getContext('2d');
  const p3 = clamp(te.brew / 160, 0, 1);
  x.fillStyle = '#8b8b8b';
  x.fillRect(0, 8, 32, 4);
  x.beginPath(); x.moveTo(32, 3); x.lineTo(42, 10); x.lineTo(32, 17); x.fill();
  if (p3 > 0) { x.fillStyle = '#fff'; x.fillRect(0, 8, Math.ceil(p3 * 32), 4); }
  this.brewArrow.appendChild(c);
};
