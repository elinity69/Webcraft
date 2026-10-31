#!/usr/bin/env node
// Build script: extracts official REA-decompiled Minecraft 26.2 textures, HUD sprites & OGG sounds
// from rea_decompiled/minecraft_26.2_src and .minecraft/assets into src/parts/03d_official_26_2_assets.js,
// then concatenates src/parts/* + src/styles.css + src/audio.js into ONE self-contained index.html
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const PARTS = path.join(SRC, 'parts');
const OUT = path.join(__dirname, 'index.html');

const DECOMP_DIR = path.join(__dirname, 'rea_decompiled/minecraft_26.2_src');
const BLOCK_TEX_DIR = path.join(DECOMP_DIR, 'assets/minecraft/textures/block');
const ITEM_TEX_DIR = path.join(DECOMP_DIR, 'assets/minecraft/textures/item');
const HUD_TEX_DIR = path.join(DECOMP_DIR, 'assets/minecraft/textures/gui/sprites/hud');
const MC_ASSETS_DIR = path.join(process.env.APPDATA || '', '.minecraft/assets');

function readPngB64(fullPath) {
  if (!fs.existsSync(fullPath)) return null;
  return 'data:image/png;base64,' + fs.readFileSync(fullPath).toString('base64');
}

if (fs.existsSync(BLOCK_TEX_DIR)) {
  const tileAlias = {
    grass_top: 'grass_block_top',
    grass_side: 'grass_block_side',
    grass_snow_side: 'grass_block_snow',
    snow_block: 'snow',
    crafting_top: 'crafting_table_top',
    crafting_side: 'crafting_table_side',
    crafting_front: 'crafting_table_front',
    furnace_front_lit: 'furnace_front_on',
    door_top: 'oak_door_top',
    door_bottom: 'oak_door_bottom',
    enchant_top: 'enchanting_table_top',
    enchant_side: 'enchanting_table_side',
    enchant_bottom: 'enchanting_table_bottom',
    noteblock_top: 'note_block',
    noteblock_side: 'note_block',
    pumpkin_face: 'carved_pumpkin',
    jack_side: 'pumpkin_side',
    jack_face: 'jack_o_lantern',
    melon_top: 'melon_top',
    melon_side: 'melon_side',
    hay_top: 'hay_block_top',
    hay_side: 'hay_block_side',
    water: 'water_still',
    lava: 'lava_still',
    fire: 'fire_0',
    endframe_top: 'end_portal_frame_top',
    endframe_side: 'end_portal_frame_side',
    quartz_block: 'quartz_block_side',
    magma_block: 'magma',
    redstone_dot: 'redstone_dust_dot',
    redstone_dot_on: 'redstone_dust_dot',
    redstone_line: 'redstone_dust_line0',
    redstone_line_on: 'redstone_dust_line0',
    redstone_lamp_lit: 'redstone_lamp_on',
    stone_button: 'stone',
    stone_plate: 'stone',
    oak_plate: 'oak_planks',
    repeater_top: 'repeater',
    repeater_front: 'repeater_on',
    anvil_side: 'anvil',
    anvil_base: 'anvil',
    rail_flat: 'rail',
    ancient_debris: 'ancient_debris_side',
  };

  const allPossibleTiles = [
    'stone','granite','diorite','andesite','deepslate','cobbled_deepslate','cobblestone','mossy_cobblestone','smooth_stone',
    'stone_bricks','mossy_stone_bricks','cracked_stone_bricks','chiseled_stone_bricks','bricks','bedrock','obsidian','crying_obsidian',
    'dirt','coarse_dirt','grass_top','grass_side','grass_snow_side','podzol_top','podzol_side','farmland','farmland_moist','dirt_path_top','dirt_path_side',
    'sand','red_sand','gravel','clay','sandstone','sandstone_top','sandstone_bottom','chiseled_sandstone','cut_sandstone','red_sandstone',
    'snow','snow_block','ice','packed_ice','blue_ice',
    'coal_ore','iron_ore','copper_ore','gold_ore','redstone_ore','lapis_ore','diamond_ore','emerald_ore',
    'deepslate_coal_ore','deepslate_iron_ore','deepslate_copper_ore','deepslate_gold_ore','deepslate_redstone_ore','deepslate_lapis_ore','deepslate_diamond_ore','deepslate_emerald_ore',
    'nether_quartz_ore','nether_gold_ore','ancient_debris',
    'coal_block','iron_block','copper_block','gold_block','redstone_block','lapis_block','diamond_block','emerald_block','netherite_block',
    'oak_log','oak_log_top','oak_planks','oak_leaves','oak_sapling',
    'spruce_log','spruce_log_top','spruce_planks','spruce_leaves','spruce_sapling',
    'birch_log','birch_log_top','birch_planks','birch_leaves','birch_sapling',
    'acacia_log','acacia_log_top','acacia_planks','acacia_leaves','acacia_sapling',
    'dark_oak_log','dark_oak_log_top','dark_oak_planks','dark_oak_leaves','dark_oak_sapling',
    'crafting_top','crafting_side','crafting_front','furnace_side','furnace_top','furnace_front','furnace_front_lit',
    'bookshelf','tnt_side','tnt_top','tnt_bottom','torch','ladder',
    'door_top','door_bottom','spruce_door_top','spruce_door_bottom','birch_door_top','birch_door_bottom',
    'glass','enchant_top','enchant_side','noteblock_top','noteblock_side','spawner','cobweb',
    'pumpkin_top','pumpkin_side','pumpkin_face','jack_side','jack_face','melon_top','melon_side','hay_top','hay_side',
    'short_grass','fern','dead_bush','dandelion','poppy','blue_orchid','allium','oxeye_daisy','cornflower','red_mushroom','brown_mushroom',
    'cactus_top','cactus_bottom','cactus_side','sugar_cane',
    'wheat_stage0','wheat_stage1','wheat_stage2','wheat_stage3','wheat_stage4','wheat_stage5','wheat_stage6','wheat_stage7',
    'white_wool','orange_wool','magenta_wool','light_blue_wool','yellow_wool','lime_wool','pink_wool','gray_wool','light_gray_wool','cyan_wool','purple_wool','blue_wool','brown_wool','green_wool','red_wool','black_wool',
    'water','lava','fire','nether_portal','endframe_top','endframe_side','dragon_egg',
    'netherrack','soul_sand','soul_soil','nether_bricks','quartz_block','basalt_side','basalt_top','glowstone','sea_lantern','magma_block',
    'end_stone','end_stone_bricks','purpur_block',
    'redstone_dot','redstone_dot_on','redstone_line','redstone_line_on','redstone_torch','redstone_torch_off','redstone_lamp','redstone_lamp_lit',
    'lever','stone_button','stone_plate','oak_plate','repeater_top','repeater_front','brewing_stand','anvil_top','anvil_side','anvil_base','rail_flat',
    'piston_top','piston_top_sticky','piston_side','piston_bottom',
    'nether_wart_stage0','nether_wart_stage1','nether_wart_stage2','nether_wart_stage3',
    'destroy_stage_0','destroy_stage_1','destroy_stage_2','destroy_stage_3','destroy_stage_4','destroy_stage_5','destroy_stage_6','destroy_stage_7','destroy_stage_8','destroy_stage_9',
  ];

  const tileToPngKey = {};
  const selectedBlockPngs = {};
  for (const t of allPossibleTiles) {
    const pngKey = tileAlias[t] || t;
    const fp = path.join(BLOCK_TEX_DIR, pngKey + '.png');
    if (fs.existsSync(fp)) {
      tileToPngKey[t] = pngKey;
      selectedBlockPngs[pngKey] = readPngB64(fp);
    }
  }
  selectedBlockPngs['grass_block_side_overlay'] = readPngB64(path.join(BLOCK_TEX_DIR, 'grass_block_side_overlay.png'));

  const itemAlias = {
    wood_pickaxe: 'wooden_pickaxe', wood_axe: 'wooden_axe', wood_shovel: 'wooden_shovel', wood_sword: 'wooden_sword', wood_hoe: 'wooden_hoe',
    gold_pickaxe: 'golden_pickaxe', gold_axe: 'golden_axe', gold_shovel: 'golden_shovel', gold_sword: 'golden_sword', gold_hoe: 'golden_hoe',
    gold_helmet: 'golden_helmet', gold_chestplate: 'golden_chestplate', gold_leggings: 'golden_leggings', gold_boots: 'golden_boots',
    oak_door_item: 'oak_door', spruce_door_item: 'spruce_door', birch_door_item: 'birch_door',
    bed_item: 'white_bed', red_bed_item: 'red_bed',
    slimeball: 'slime_ball', spectral_dust: 'glowstone_dust', ender_pearl_throw: 'ender_pearl',
    compass: 'compass_16', clock: 'clock_00',
    wheat_item: 'wheat', sugar_cane_item: 'sugar_cane', bone_meal_item: 'bone_meal',
    water_bottle: 'potion', awkward_potion: 'potion',
    potion_healing: 'potion', potion_regen: 'potion', potion_speed: 'potion', potion_strength: 'potion',
    potion_fire_res: 'potion', potion_night_vision: 'potion', potion_water_breathing: 'potion', potion_poison: 'potion',
    speckled_melon: 'glistering_melon_slice', boat: 'oak_boat',
  };

  const allItemKeys = [
    'wood_pickaxe','stone_pickaxe','iron_pickaxe','gold_pickaxe','diamond_pickaxe','netherite_pickaxe',
    'wood_axe','stone_axe','iron_axe','gold_axe','diamond_axe','netherite_axe',
    'wood_shovel','stone_shovel','iron_shovel','gold_shovel','diamond_shovel','netherite_shovel',
    'wood_sword','stone_sword','iron_sword','gold_sword','diamond_sword','netherite_sword',
    'wood_hoe','stone_hoe','iron_hoe','gold_hoe','diamond_hoe','netherite_hoe',
    'leather_helmet','leather_chestplate','leather_leggings','leather_boots',
    'iron_helmet','iron_chestplate','iron_leggings','iron_boots',
    'gold_helmet','gold_chestplate','gold_leggings','gold_boots',
    'diamond_helmet','diamond_chestplate','diamond_leggings','diamond_boots',
    'netherite_helmet','netherite_chestplate','netherite_leggings','netherite_boots',
    'oak_door_item','spruce_door_item','birch_door_item','bed_item','red_bed_item',
    'stick','bowl','coal','charcoal','raw_iron','iron_ingot','raw_copper','copper_ingot','raw_gold','gold_ingot','gold_nugget','iron_nugget',
    'diamond','emerald','lapis_lazuli','redstone','quartz','netherite_scrap','netherite_ingot','clay_ball','brick','flint','string','feather',
    'gunpowder','bone','bone_meal','bone_meal_item','leather','paper','book','glowstone_dust','sugar','spider_eye','blaze_rod','blaze_powder',
    'ender_pearl','ender_pearl_throw','ender_eye','slimeball','magma_cream','ghast_tear','spectral_dust',
    'flint_and_steel','shears','bucket','water_bucket','lava_bucket','milk_bucket','bow','arrow','snowball','egg','experience_bottle',
    'compass','clock','wheat_item','wheat_seeds','sugar_cane_item','glass_bottle','water_bottle','awkward_potion',
    'potion_healing','potion_regen','potion_speed','potion_strength','potion_fire_res','potion_night_vision','potion_water_breathing','potion_poison',
    'speckled_melon','nether_wart','boat','minecart','saddle',
    'apple','golden_apple','bread','porkchop','cooked_porkchop','beef','cooked_beef','chicken','cooked_chicken','mutton','cooked_mutton',
    'carrot','golden_carrot','potato','baked_potato','melon_slice','cookie','pumpkin_pie','rotten_flesh','sweet_berries','mushroom_stew',
  ];

  const selectedItemPngs = {};
  for (const k of allItemKeys) {
    const pngKey = itemAlias[k] || k;
    const fp = path.join(ITEM_TEX_DIR, pngKey + '.png');
    if (fs.existsSync(fp)) {
      selectedItemPngs[k] = readPngB64(fp);
    }
  }

  const hudMap = {
    heart_full: readPngB64(path.join(HUD_TEX_DIR, 'heart/full.png')),
    heart_half: readPngB64(path.join(HUD_TEX_DIR, 'heart/half.png')),
    heart_empty: readPngB64(path.join(HUD_TEX_DIR, 'heart/container.png')),
    food_full: readPngB64(path.join(HUD_TEX_DIR, 'food_full.png')),
    food_half: readPngB64(path.join(HUD_TEX_DIR, 'food_half.png')),
    food_empty: readPngB64(path.join(HUD_TEX_DIR, 'food_empty.png')),
    armor_full: readPngB64(path.join(HUD_TEX_DIR, 'armor_full.png')),
    armor_half: readPngB64(path.join(HUD_TEX_DIR, 'armor_half.png')),
    armor_empty: readPngB64(path.join(HUD_TEX_DIR, 'armor_empty.png')),
    bubble: readPngB64(path.join(HUD_TEX_DIR, 'air.png')),
  };

  const soundOggs = {};
  const idx32Path = path.join(MC_ASSETS_DIR, 'indexes/32.json');
  if (fs.existsSync(idx32Path)) {
    const idx32 = JSON.parse(fs.readFileSync(idx32Path, 'utf8')).objects;
    const soundSpec = {
      step_grass: 'minecraft/sounds/step/grass1.ogg',
      step_stone: 'minecraft/sounds/step/stone1.ogg',
      step_wood: 'minecraft/sounds/step/wood1.ogg',
      step_sand: 'minecraft/sounds/step/sand1.ogg',
      step_gravel: 'minecraft/sounds/step/gravel1.ogg',
      step_snow: 'minecraft/sounds/step/snow1.ogg',
      dig_grass: 'minecraft/sounds/dig/grass1.ogg',
      dig_stone: 'minecraft/sounds/dig/stone1.ogg',
      dig_wood: 'minecraft/sounds/dig/wood1.ogg',
      explode: 'minecraft/sounds/random/explode1.ogg',
      fuse: 'minecraft/sounds/random/fuse.ogg',
      eat: 'minecraft/sounds/random/eat1.ogg',
      burp: 'minecraft/sounds/random/burp.ogg',
      orb: 'minecraft/sounds/random/orb.ogg',
      levelup: 'minecraft/sounds/random/levelup.ogg',
      splash: 'minecraft/sounds/random/splash.ogg',
      bow: 'minecraft/sounds/random/bow.ogg',
      click: 'minecraft/sounds/random/click.ogg',
      pop: 'minecraft/sounds/random/pop.ogg',
      hit: 'minecraft/sounds/damage/hit1.ogg',
      zombie: 'minecraft/sounds/mob/zombie/say1.ogg',
      skeleton: 'minecraft/sounds/mob/skeleton/say1.ogg',
      pig: 'minecraft/sounds/mob/pig/say1.ogg',
      cow: 'minecraft/sounds/mob/cow/say1.ogg',
      sheep: 'minecraft/sounds/mob/sheep/say1.ogg',
      chicken: 'minecraft/sounds/mob/chicken/say1.ogg',
      enderman: 'minecraft/sounds/mob/endermen/idle1.ogg',
      dragon: 'minecraft/sounds/mob/enderdragon/growl1.ogg',
      portal: 'minecraft/sounds/portal/trigger.ogg',
    };
    for (const [k, sKey] of Object.entries(soundSpec)) {
      const obj = idx32[sKey];
      if (obj && obj.hash) {
        const p = path.join(MC_ASSETS_DIR, 'objects', obj.hash.slice(0, 2), obj.hash);
        if (fs.existsSync(p)) {
          soundOggs[k] = fs.readFileSync(p).toString('base64');
        }
      }
    }
  }

  // Extract official 454 splashes from assets/minecraft/texts/splashes.txt
  const splashesPath = path.join(DECOMP_DIR, 'assets/minecraft/texts/splashes.txt');
  const officialSplashes = fs.existsSync(splashesPath)
    ? fs.readFileSync(splashesPath, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    : [];

  // Extract official en_us.json names for our blocks & items
  const langPath = path.join(DECOMP_DIR, 'assets/minecraft/lang/en_us.json');
  const officialLang = {};
  if (fs.existsSync(langPath)) {
    const rawLang = JSON.parse(fs.readFileSync(langPath, 'utf8'));
    for (const [k, v] of Object.entries(rawLang)) {
      if (k.startsWith('block.minecraft.') || k.startsWith('item.minecraft.') || k.startsWith('entity.minecraft.') || k.startsWith('advancements.')) {
        if (!k.includes('.', 18)) officialLang[k] = v;
      }
    }
  }

  const outJs = [
    '// ============================================================================',
    '// Part 03d: REA Decompiled Official Minecraft 26.2 Textures, HUD, Lang, Splashes & OGG Sounds',
    '// Automatically generated from rea_decompiled/minecraft_26.2_src & .minecraft/assets',
    '// ============================================================================',
    'const OFFICIAL_26_2_TILE_MAP = ' + JSON.stringify(tileToPngKey) + ';',
    'const OFFICIAL_26_2_BLOCK_PNGS = ' + JSON.stringify(selectedBlockPngs) + ';',
    'const OFFICIAL_26_2_ITEM_PNGS = ' + JSON.stringify(selectedItemPngs) + ';',
    'const OFFICIAL_26_2_HUD_PNGS = ' + JSON.stringify(hudMap) + ';',
    'const OFFICIAL_26_2_OGG_SOUNDS = ' + JSON.stringify(soundOggs) + ';',
    'const OFFICIAL_26_2_SPLASHES = ' + JSON.stringify(officialSplashes) + ';',
    'const OFFICIAL_26_2_LANG = ' + JSON.stringify(officialLang) + ';',
    '',
    'const OFFICIAL_BIOME_TINTS = {',
    '  grass_top: [124, 189, 107],',
    '  oak_leaves: [110, 178, 86],',
    '  spruce_leaves: [97, 153, 97],',
    '  birch_leaves: [128, 167, 85],',
    '  acacia_leaves: [158, 182, 68],',
    '  dark_oak_leaves: [89, 148, 66],',
    '  short_grass: [124, 189, 107],',
    '  fern: [124, 189, 107],',
    '  sugar_cane: [135, 198, 105],',
    '  water: [63, 118, 228],',
    '  redstone_dot: [110, 12, 8],',
    '  redstone_line: [110, 12, 8],',
    '  redstone_dot_on: [245, 32, 16],',
    '  redstone_line_on: [245, 32, 16],',
    '};',
    '',
    '(function installOfficial26_2Assets() {',
    '  const origInit = TEX.init.bind(TEX);',
    '  TEX.init = function() {',
    '    origInit();',
    '    for (const [k, url] of Object.entries(OFFICIAL_26_2_HUD_PNGS)) {',
    '      if (url) HUD_ICONS[k] = url;',
    '    }',
    '    this.loadOfficial26_2Atlas();',
    '  };',
    '',
    '  const origItemURL = TEX.itemURL.bind(TEX);',
    '  TEX.itemURL = function(itemId) {',
    '    const it = ITEMS[itemId];',
    '    if (it && OFFICIAL_26_2_ITEM_PNGS[it.key]) {',
    '      return OFFICIAL_26_2_ITEM_PNGS[it.key];',
    '    }',
    '    return origItemURL(itemId);',
    '  };',
    '',
    '  TEX.loadOfficial26_2Atlas = async function() {',
    '    if (this._officialPromise) return this._officialPromise;',
    '    this._officialPromise = (async () => {',
    '      const loadImg = (src) => new Promise((res) => {',
    '        if (!src) return res(null);',
    '        const img = new Image();',
    '        img.onload = () => res(img);',
    '        img.onerror = () => res(null);',
    '        img.src = src;',
    '      });',
    '',
    '      const staging = document.createElement("canvas");',
    '      staging.width = this.canvas.width;',
    '      staging.height = this.canvas.height;',
    '      const sctx = staging.getContext("2d", { willReadFrequently: true });',
    '      sctx.imageSmoothingEnabled = false;',
    '      sctx.drawImage(this.canvas, 0, 0);',
    '',
    '      const tmp = document.createElement("canvas");',
    '      tmp.width = TILE_SIZE;',
    '      tmp.height = TILE_SIZE;',
    '      const tctx = tmp.getContext("2d", { willReadFrequently: true });',
    '      tctx.imageSmoothingEnabled = false;',
    '',
    '      const ovImg = await loadImg(OFFICIAL_26_2_BLOCK_PNGS["grass_block_side_overlay"]);',
    '',
    '      const entries = Object.entries(OFFICIAL_26_2_TILE_MAP);',
    '      await Promise.all(entries.map(async ([tileName, pngKey]) => {',
    '        const idx = TILE.get(tileName);',
    '        if (idx === undefined) return;',
    '        const b64 = OFFICIAL_26_2_BLOCK_PNGS[pngKey];',
    '        if (!b64) return;',
    '        const img = await loadImg(b64);',
    '        if (!img) return;',
    '',
    '        const tx = (idx % ATLAS_COLS) * TILE_SIZE;',
    '        const ty = Math.floor(idx / ATLAS_COLS) * TILE_SIZE;',
    '',
    '        tctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);',
    '        tctx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);',
    '',
    '        const tint = OFFICIAL_BIOME_TINTS[tileName];',
    '        const isLeaves = tileName.endsWith("_leaves");',
    '        const isWater = tileName === "water";',
    '',
    '        if (tint || isLeaves || isWater) {',
    '          const idata = tctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);',
    '          const d = idata.data;',
    '          for (let i = 0; i < d.length; i += 4) {',
    '            if (tint && d[i + 3] > 0) {',
    '              d[i]     = Math.min(255, (d[i]     * tint[0]) / 255);',
    '              d[i + 1] = Math.min(255, (d[i + 1] * tint[1]) / 255);',
    '              d[i + 2] = Math.min(255, (d[i + 2] * tint[2]) / 255);',
    '            }',
    '            if (isLeaves && d[i + 3] < 128) {',
    '              d[i] = 22; d[i + 1] = 44; d[i + 2] = 16; d[i + 3] = 255;',
    '            } else if (isWater && d[i + 3] > 0) {',
    '              d[i + 3] = Math.round(d[i + 3] * 0.78);',
    '            }',
    '          }',
    '          tctx.putImageData(idata, 0, 0);',
    '        }',
    '',
    '        if (tileName === "grass_side" && ovImg) {',
    '          const ovC = document.createElement("canvas");',
    '          ovC.width = TILE_SIZE; ovC.height = TILE_SIZE;',
    '          const octx = ovC.getContext("2d", { willReadFrequently: true });',
    '          octx.drawImage(ovImg, 0, 0, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);',
    '          const od = octx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);',
    '          for (let i = 0; i < od.data.length; i += 4) {',
    '            if (od.data[i + 3] > 0) {',
    '              od.data[i]     = Math.min(255, (od.data[i]     * 124) / 255);',
    '              od.data[i + 1] = Math.min(255, (od.data[i + 1] * 189) / 255);',
    '              od.data[i + 2] = Math.min(255, (od.data[i + 2] * 107) / 255);',
    '            }',
    '          }',
    '          octx.putImageData(od, 0, 0);',
    '          tctx.drawImage(ovC, 0, 0);',
    '        }',
    '',
    '        sctx.clearRect(tx, ty, TILE_SIZE, TILE_SIZE);',
    '        sctx.drawImage(tmp, tx, ty);',
    '      }));',
    '',
    '      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);',
    '      this.ctx.drawImage(staging, 0, 0);',
    '      this.refreshAfterPack();',
    '      if (typeof UI !== "undefined" && UI.refreshHotbar) UI.refreshHotbar();',
    '    })();',
    '    return this._officialPromise;',
    '  };',
    '',
    '  SFX._oggBuffers = {};',
    '  SFX._oggDecoding = false;',
    '  SFX._ensureOggsDecoded = function() {',
    '    if (!this.ctx || this._oggDecoding) return;',
    '    this._oggDecoding = true;',
    '    for (const [key, b64] of Object.entries(OFFICIAL_26_2_OGG_SOUNDS)) {',
    '      try {',
    '        const bin = atob(b64);',
    '        const bytes = new Uint8Array(bin.length);',
    '        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);',
    '        this.ctx.decodeAudioData(bytes.buffer.slice(0), (buf) => {',
    '          this._oggBuffers[key] = buf;',
    '        }, () => {});',
    '      } catch (e) {}',
    '    }',
    '  };',
    '',
    '  SFX._playOgg = function(key, vol = 0.5, rate = 1.0) {',
    '    this.init();',
    '    this._ensureOggsDecoded();',
    '    const buf = this._oggBuffers[key];',
    '    if (!buf || !this.ctx || this.masterVol <= 0 || this.sfxVol <= 0) return false;',
    '    const src = this.ctx.createBufferSource();',
    '    src.buffer = buf;',
    '    src.playbackRate.setValueAtTime(rate * (0.92 + Math.random() * 0.16), this.ctx.currentTime);',
    '    const gain = this.ctx.createGain();',
    '    gain.gain.setValueAtTime(Math.min(1, vol * this.masterVol * this.sfxVol), this.ctx.currentTime);',
    '    src.connect(gain);',
    '    gain.connect(this.ctx.destination);',
    '    src.start(0);',
    '    return true;',
    '  };',
    '',
    '  const origStep = SFX.playStep.bind(SFX);',
    '  SFX.playStep = function(mat = "grass") {',
    '    const map = { grass: "step_grass", dirt: "step_grass", plant: "step_grass", stone: "step_stone", metal: "step_stone", glass: "step_stone", wood: "step_wood", sand: "step_sand", gravel: "step_gravel", snow: "step_snow" };',
    '    if (!this._playOgg(map[mat] || "step_stone", 0.35, 1.0)) origStep(mat);',
    '  };',
    '',
    '  const origDig = SFX.playDig.bind(SFX);',
    '  SFX.playDig = function(mat = "stone") {',
    '    const map = { grass: "dig_grass", dirt: "dig_grass", plant: "dig_grass", wood: "dig_wood", stone: "dig_stone", metal: "dig_stone" };',
    '    if (!this._playOgg(map[mat] || "dig_stone", 0.45, 0.95)) origDig(mat);',
    '  };',
    '',
    '  const origBreak = SFX.playBreak.bind(SFX);',
    '  SFX.playBreak = function(mat = "stone") {',
    '    const map = { grass: "dig_grass", dirt: "dig_grass", plant: "dig_grass", wood: "dig_wood", stone: "dig_stone", metal: "dig_stone" };',
    '    if (!this._playOgg(map[mat] || "dig_stone", 0.65, 0.85)) origBreak(mat);',
    '  };',
    '',
    '  const origPlace = SFX.playPlace.bind(SFX);',
    '  SFX.playPlace = function(mat = "stone") {',
    '    const map = { grass: "dig_grass", dirt: "dig_grass", plant: "dig_grass", wood: "dig_wood", stone: "dig_stone", metal: "dig_stone" };',
    '    if (!this._playOgg(map[mat] || "dig_stone", 0.55, 1.05)) origPlace(mat);',
    '  };',
    '',
    '  const origExplode = SFX.playExplosion.bind(SFX);',
    '  SFX.playExplosion = function() { if (!this._playOgg("explode", 0.85, 1.0)) origExplode(); };',
    '',
    '  const origFuse = SFX.playFuse.bind(SFX);',
    '  SFX.playFuse = function() { if (!this._playOgg("fuse", 0.65, 1.0)) origFuse(); };',
    '',
    '  const origEat = SFX.playEat.bind(SFX);',
    '  SFX.playEat = function() { if (!this._playOgg("eat", 0.55, 1.0)) origEat(); };',
    '',
    '  const origBurp = SFX.playBurp.bind(SFX);',
    '  SFX.playBurp = function() { if (!this._playOgg("burp", 0.6, 1.0)) origBurp(); };',
    '',
    '  const origOrb = SFX.playXPOrb.bind(SFX);',
    '  SFX.playXPOrb = function() { if (!this._playOgg("orb", 0.45, 1.0 + Math.random() * 0.25)) origOrb(); };',
    '',
    '  const origLevelUp = SFX.playLevelUp.bind(SFX);',
    '  SFX.playLevelUp = function() { if (!this._playOgg("levelup", 0.7, 1.0)) origLevelUp(); };',
    '',
    '  const origSplash = SFX.playSplash.bind(SFX);',
    '  SFX.playSplash = function() { if (!this._playOgg("splash", 0.65, 1.0)) origSplash(); };',
    '',
    '  const origBow = SFX.playBowShoot.bind(SFX);',
    '  SFX.playBowShoot = function() { if (!this._playOgg("bow", 0.6, 1.0)) origBow(); };',
    '',
    '  const origClick = SFX.playClick.bind(SFX);',
    '  SFX.playClick = function(high = true) { if (!this._playOgg("click", 0.45, high ? 1.0 : 0.85)) origClick(high); };',
    '',
    '  const origPop = SFX.playPop.bind(SFX);',
    '  SFX.playPop = function() { if (!this._playOgg("pop", 0.5, 1.1)) origPop(); };',
    '',
    '  const origHit = SFX.playHit.bind(SFX);',
    '  SFX.playHit = function(isCrit = false) { if (!this._playOgg("hit", 0.65, isCrit ? 1.15 : 1.0)) origHit(isCrit); };',
    '',
    '  const origHurt = SFX.playHurt.bind(SFX);',
    '  SFX.playHurt = function() { if (!this._playOgg("hit", 0.75, 0.9)) origHurt(); };',
    '',
    '  const origPortal = SFX.playPortalTrigger.bind(SFX);',
    '  SFX.playPortalTrigger = function() { if (!this._playOgg("portal", 0.55, 1.0)) origPortal(); };',
    '',
    '  const origMob = SFX.playMobSound.bind(SFX);',
    '  SFX.playMobSound = function(type) {',
    '    if (!this._playOgg(type, 0.55, 1.0)) origMob(type);',
    '  };',
    '  for (const bl of BLOCKS) {',
    '    if (!bl || !bl.key) continue;',
    '    const lk = OFFICIAL_26_2_LANG["block.minecraft." + bl.key];',
    '    if (lk) bl.name = lk;',
    '  }',
    '  for (const it of ITEMS) {',
    '    if (!it || !it.key) continue;',
    '    const lk = OFFICIAL_26_2_LANG["item.minecraft." + it.key] || OFFICIAL_26_2_LANG["block.minecraft." + it.key];',
    '    if (lk) it.name = lk;',
    '  }',
    '  window.addEventListener("DOMContentLoaded", () => {',
    '    const sp = document.getElementById("splash-text");',
    '    if (sp && OFFICIAL_26_2_SPLASHES.length > 0) {',
    '      sp.textContent = OFFICIAL_26_2_SPLASHES[Math.floor(Math.random() * OFFICIAL_26_2_SPLASHES.length)];',
    '    }',
    '  });',
    '})();',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(PARTS, '03d_official_26_2_assets.js'), outJs, 'utf8');
  console.log(
    'Generated 03d_official_26_2_assets.js:',
    (outJs.length / 1024).toFixed(1) + ' KB',
    '| Block tiles:', Object.keys(tileToPngKey).length,
    '| Item icons:', Object.keys(selectedItemPngs).length,
    '| HUD icons:', Object.keys(hudMap).length,
    '| OGG sounds:', Object.keys(soundOggs).length
  );
}

const files = fs.readdirSync(PARTS).filter(f => !f.startsWith('_')).sort();
let css = '';
try { css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8'); } catch {}
let audio = '';
try { audio = fs.readFileSync(path.join(SRC, 'audio.js'), 'utf8'); } catch {}

let out = '';
for (const f of files) {
  const p = path.join(PARTS, f);
  const c = fs.readFileSync(p, 'utf8');
  if (f.endsWith('.html')) out += c;
  else if (f.endsWith('.js')) {
    if (out.includes('<script>')) out += c + '\n';
    else out += c + '\n';
  }
}
out = out.replace('/*__CSS__*/', () => css);
out = out.replace('/*__AUDIO__*/', () => audio);
fs.writeFileSync(OUT, out);
console.log('Built', OUT, (out.length / 1024).toFixed(1) + ' KB from', files.length, 'parts:', files.join(', '));

// Extract JS for syntax check
const m = out.match(/<script>([\s\S]*)<\/script>/);
if (m) {
  fs.writeFileSync(path.join(__dirname, '.bundle_check.js'), m[1]);
  try {
    require('child_process').execSync('node --check .bundle_check.js', { cwd: __dirname, stdio: 'pipe' });
    console.log('JS syntax check: OK');
  } catch (e) {
    console.error('JS SYNTAX ERROR:\n' + e.stderr.toString().slice(0, 4000));
    process.exit(1);
  }
}
