// ============================================================================
// MINECRAFT 1:1 WEBGL2 EDITION - OFFICIAL 26.2 TEXTURE ATLAS & ICON ENGINE
// Uses REA-extracted official Minecraft 26.2 PNGs with biome tinting & procedural fallback
// ============================================================================

const ATLAS_COLS = 16;
const ATLAS_ROWS = 16;
const TILE_SIZE = 16;
const ATLAS_WIDTH = ATLAS_COLS * TILE_SIZE;  // 256
const ATLAS_HEIGHT = ATLAS_ROWS * TILE_SIZE; // 256

// Tile index mapping in the 16x16 atlas (0..255)
const TEX = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  BEDROCK: 5,
  SAND: 6,
  GRAVEL: 7,
  OAK_LOG_SIDE: 8,
  OAK_LOG_TOP: 9,
  OAK_PLANKS: 10,
  OAK_LEAVES: 11,
  SPRUCE_LOG_SIDE: 12,
  SPRUCE_LOG_TOP: 13,
  SPRUCE_PLANKS: 14,
  SPRUCE_LEAVES: 15,

  BIRCH_LOG_SIDE: 16,
  BIRCH_LOG_TOP: 17,
  BIRCH_PLANKS: 18,
  BIRCH_LEAVES: 19,
  WATER: 20,
  LAVA: 21,
  GLASS: 22,
  SNOW: 23,
  GRASS_SNOW_SIDE: 24,
  ICE: 25,
  COAL_ORE: 26,
  IRON_ORE: 27,
  GOLD_ORE: 28,
  DIAMOND_ORE: 29,
  REDSTONE_ORE: 30,
  EMERALD_ORE: 31,

  LAPIS_ORE: 32,
  COPPER_ORE: 33,
  COAL_BLOCK: 34,
  IRON_BLOCK: 35,
  GOLD_BLOCK: 36,
  DIAMOND_BLOCK: 37,
  EMERALD_BLOCK: 38,
  LAPIS_BLOCK: 39,
  REDSTONE_BLOCK: 40,
  NETHERITE_BLOCK: 41,
  CRAFTING_TOP: 42,
  CRAFTING_FRONT: 43,
  CRAFTING_SIDE: 44,
  FURNACE_FRONT: 45,
  FURNACE_FRONT_ON: 46,
  FURNACE_SIDE: 47,

  FURNACE_TOP: 48,
  CHEST_TOP: 49,
  CHEST_FRONT: 50,
  CHEST_SIDE: 51,
  TNT_SIDE: 52,
  TNT_TOP: 53,
  TNT_BOTTOM: 54,
  BOOKSHELF: 55,
  OBSIDIAN: 56,
  GLOWSTONE: 57,
  TORCH: 58,
  REDSTONE_DUST: 59,
  REDSTONE_TORCH_ON: 60,
  REDSTONE_TORCH_OFF: 61,
  REDSTONE_LAMP_OFF: 62,
  REDSTONE_LAMP_ON: 63,

  PISTON_SIDE: 64,
  PISTON_TOP: 65,
  PISTON_BOTTOM: 66,
  LEVER: 67,
  NOTE_BLOCK: 68,
  ENCHANT_TOP: 69,
  ENCHANT_SIDE: 70,
  ENCHANT_BOTTOM: 71,
  ANVIL: 72,
  BREWING_STAND: 73,
  NETHERRACK: 74,
  SOUL_SAND: 75,
  NETHER_BRICKS: 76,
  QUARTZ_BLOCK: 77,
  NETHER_PORTAL: 78,
  END_STONE: 79,

  END_STONE_BRICKS: 80,
  PURPUR_BLOCK: 81,
  STONE_BRICKS: 82,
  MOSSY_COBBLESTONE: 83,
  BRICKS: 84,
  SANDSTONE_SIDE: 85,
  SANDSTONE_TOP: 86,
  SANDSTONE_BOTTOM: 87,
  CLAY: 88,
  FARMLAND_DRY: 89,
  FARMLAND_WET: 90,
  WHEAT_STAGE0: 91,
  WHEAT_STAGE3: 92,
  WHEAT_STAGE7: 93,
  CACTUS_SIDE: 94,
  CACTUS_TOP: 95,

  SUGAR_CANE: 96,
  PUMPKIN_SIDE: 97,
  PUMPKIN_TOP: 98,
  CARVED_PUMPKIN: 99,
  JACK_O_LANTERN: 100,
  MELON_SIDE: 101,
  MELON_TOP: 102,
  HAY_SIDE: 103,
  HAY_TOP: 104,
  DANDELION: 105,
  POPPY: 106,
  SHORT_GRASS: 107,
  RED_MUSHROOM: 108,
  BROWN_MUSHROOM: 109,
  DEAD_BUSH: 110,
  OAK_SAPLING: 111,

  WOOL_WHITE: 112,
  WOOL_RED: 113,
  WOOL_BLUE: 114,
  WOOL_GREEN: 115,
  WOOL_YELLOW: 116,
  WOOL_BLACK: 117,
  WOOL_PURPLE: 118,
  WOOL_CYAN: 119,
  WOOL_ORANGE: 120,
  DEEPSLATE: 121,
  GRANITE: 122,
  DIORITE: 123,
  ANDESITE: 124,
  LADDER: 125,
  RAIL: 126,
  COBWEB: 127,

  SPAWNER: 128,
  OAK_DOOR_TOP: 129,
  OAK_DOOR_BOTTOM: 130,
  LANTERN: 131,
  SEA_LANTERN: 132,
  ANCIENT_DEBRIS_SIDE: 133,
  ANCIENT_DEBRIS_TOP: 134,
  CRYING_OBSIDIAN: 135,
  REPEATER_OFF: 136,
  REPEATER_ON: 137,

  // Destroy stages 0..9 -> 240..249
  DESTROY_0: 240,
  DESTROY_1: 241,
  DESTROY_2: 242,
  DESTROY_3: 243,
  DESTROY_4: 244,
  DESTROY_5: 245,
  DESTROY_6: 246,
  DESTROY_7: 247,
  DESTROY_8: 248,
  DESTROY_9: 249,
};

// Map each atlas tile ID to its official 26.2 PNG key and optional biome tint
const TILE_OFFICIAL_MAP = {
  [TEX.GRASS_TOP]: { key: 'grass_block_top', tint: [124, 189, 107] },
  [TEX.GRASS_SIDE]: { key: 'grass_block_side', overlay: 'grass_block_side_overlay', overlayTint: [124, 189, 107] },
  [TEX.DIRT]: { key: 'dirt' },
  [TEX.STONE]: { key: 'stone' },
  [TEX.COBBLESTONE]: { key: 'cobblestone' },
  [TEX.BEDROCK]: { key: 'bedrock' },
  [TEX.SAND]: { key: 'sand' },
  [TEX.GRAVEL]: { key: 'gravel' },
  [TEX.OAK_LOG_SIDE]: { key: 'oak_log' },
  [TEX.OAK_LOG_TOP]: { key: 'oak_log_top' },
  [TEX.OAK_PLANKS]: { key: 'oak_planks' },
  [TEX.OAK_LEAVES]: { key: 'oak_leaves', tint: [110, 178, 86], opaqueAlpha: true },
  [TEX.SPRUCE_LOG_SIDE]: { key: 'spruce_log' },
  [TEX.SPRUCE_LOG_TOP]: { key: 'spruce_log_top' },
  [TEX.SPRUCE_PLANKS]: { key: 'spruce_planks' },
  [TEX.SPRUCE_LEAVES]: { key: 'spruce_leaves', tint: [97, 153, 97], opaqueAlpha: true },
  [TEX.BIRCH_LOG_SIDE]: { key: 'birch_log' },
  [TEX.BIRCH_LOG_TOP]: { key: 'birch_log_top' },
  [TEX.BIRCH_PLANKS]: { key: 'birch_planks' },
  [TEX.BIRCH_LEAVES]: { key: 'birch_leaves', tint: [128, 167, 85], opaqueAlpha: true },
  [TEX.WATER]: { key: 'water_still', tint: [63, 118, 228], alpha: 0.78 },
  [TEX.LAVA]: { key: 'lava_still' },
  [TEX.GLASS]: { key: 'glass' },
  [TEX.SNOW]: { key: 'snow' },
  [TEX.GRASS_SNOW_SIDE]: { key: 'grass_block_snow' },
  [TEX.ICE]: { key: 'ice', alpha: 0.85 },
  [TEX.COAL_ORE]: { key: 'coal_ore' },
  [TEX.IRON_ORE]: { key: 'iron_ore' },
  [TEX.GOLD_ORE]: { key: 'gold_ore' },
  [TEX.DIAMOND_ORE]: { key: 'diamond_ore' },
  [TEX.REDSTONE_ORE]: { key: 'redstone_ore' },
  [TEX.EMERALD_ORE]: { key: 'emerald_ore' },
  [TEX.LAPIS_ORE]: { key: 'lapis_ore' },
  [TEX.COPPER_ORE]: { key: 'copper_ore' },
  [TEX.COAL_BLOCK]: { key: 'coal_block' },
  [TEX.IRON_BLOCK]: { key: 'iron_block' },
  [TEX.GOLD_BLOCK]: { key: 'gold_block' },
  [TEX.DIAMOND_BLOCK]: { key: 'diamond_block' },
  [TEX.EMERALD_BLOCK]: { key: 'emerald_block' },
  [TEX.LAPIS_BLOCK]: { key: 'lapis_block' },
  [TEX.REDSTONE_BLOCK]: { key: 'redstone_block' },
  [TEX.NETHERITE_BLOCK]: { key: 'netherite_block' },
  [TEX.CRAFTING_TOP]: { key: 'crafting_table_top' },
  [TEX.CRAFTING_FRONT]: { key: 'crafting_table_front' },
  [TEX.CRAFTING_SIDE]: { key: 'crafting_table_side' },
  [TEX.FURNACE_FRONT]: { key: 'furnace_front' },
  [TEX.FURNACE_FRONT_ON]: { key: 'furnace_front_on' },
  [TEX.FURNACE_SIDE]: { key: 'furnace_side' },
  [TEX.FURNACE_TOP]: { key: 'furnace_top' },
  [TEX.TNT_SIDE]: { key: 'tnt_side' },
  [TEX.TNT_TOP]: { key: 'tnt_top' },
  [TEX.TNT_BOTTOM]: { key: 'tnt_bottom' },
  [TEX.BOOKSHELF]: { key: 'bookshelf' },
  [TEX.OBSIDIAN]: { key: 'obsidian' },
  [TEX.GLOWSTONE]: { key: 'glowstone' },
  [TEX.TORCH]: { key: 'torch' },
  [TEX.REDSTONE_DUST]: { key: 'redstone_dust_line0', tint: [235, 30, 15] },
  [TEX.REDSTONE_TORCH_ON]: { key: 'redstone_torch' },
  [TEX.REDSTONE_TORCH_OFF]: { key: 'redstone_torch_off' },
  [TEX.REDSTONE_LAMP_OFF]: { key: 'redstone_lamp' },
  [TEX.REDSTONE_LAMP_ON]: { key: 'redstone_lamp_on' },
  [TEX.PISTON_SIDE]: { key: 'piston_side' },
  [TEX.PISTON_TOP]: { key: 'piston_top' },
  [TEX.PISTON_BOTTOM]: { key: 'piston_bottom' },
  [TEX.LEVER]: { key: 'lever' },
  [TEX.NOTE_BLOCK]: { key: 'note_block' },
  [TEX.ENCHANT_TOP]: { key: 'enchanting_table_top' },
  [TEX.ENCHANT_SIDE]: { key: 'enchanting_table_side' },
  [TEX.ENCHANT_BOTTOM]: { key: 'enchanting_table_bottom' },
  [TEX.ANVIL]: { key: 'anvil_top' },
  [TEX.BREWING_STAND]: { key: 'brewing_stand' },
  [TEX.NETHERRACK]: { key: 'netherrack' },
  [TEX.SOUL_SAND]: { key: 'soul_sand' },
  [TEX.NETHER_BRICKS]: { key: 'nether_bricks' },
  [TEX.QUARTZ_BLOCK]: { key: 'quartz_block_side' },
  [TEX.NETHER_PORTAL]: { key: 'nether_portal', alpha: 0.82 },
  [TEX.END_STONE]: { key: 'end_stone' },
  [TEX.END_STONE_BRICKS]: { key: 'end_stone_bricks' },
  [TEX.PURPUR_BLOCK]: { key: 'purpur_block' },
  [TEX.STONE_BRICKS]: { key: 'stone_bricks' },
  [TEX.MOSSY_COBBLESTONE]: { key: 'mossy_cobblestone' },
  [TEX.BRICKS]: { key: 'bricks' },
  [TEX.SANDSTONE_SIDE]: { key: 'sandstone' },
  [TEX.SANDSTONE_TOP]: { key: 'sandstone_top' },
  [TEX.SANDSTONE_BOTTOM]: { key: 'sandstone_bottom' },
  [TEX.CLAY]: { key: 'clay' },
  [TEX.FARMLAND_DRY]: { key: 'farmland' },
  [TEX.FARMLAND_WET]: { key: 'farmland_moist' },
  [TEX.WHEAT_STAGE0]: { key: 'wheat_stage0' },
  [TEX.WHEAT_STAGE3]: { key: 'wheat_stage3' },
  [TEX.WHEAT_STAGE7]: { key: 'wheat_stage7' },
  [TEX.CACTUS_SIDE]: { key: 'cactus_side' },
  [TEX.CACTUS_TOP]: { key: 'cactus_top' },
  [TEX.SUGAR_CANE]: { key: 'sugar_cane' },
  [TEX.PUMPKIN_SIDE]: { key: 'pumpkin_side' },
  [TEX.PUMPKIN_TOP]: { key: 'pumpkin_top' },
  [TEX.CARVED_PUMPKIN]: { key: 'carved_pumpkin' },
  [TEX.JACK_O_LANTERN]: { key: 'jack_o_lantern' },
  [TEX.MELON_SIDE]: { key: 'melon_side' },
  [TEX.MELON_TOP]: { key: 'melon_top' },
  [TEX.HAY_SIDE]: { key: 'hay_block_side' },
  [TEX.HAY_TOP]: { key: 'hay_block_top' },
  [TEX.DANDELION]: { key: 'dandelion' },
  [TEX.POPPY]: { key: 'poppy' },
  [TEX.SHORT_GRASS]: { key: 'short_grass', tint: [124, 189, 107] },
  [TEX.RED_MUSHROOM]: { key: 'red_mushroom' },
  [TEX.BROWN_MUSHROOM]: { key: 'brown_mushroom' },
  [TEX.DEAD_BUSH]: { key: 'dead_bush' },
  [TEX.OAK_SAPLING]: { key: 'oak_sapling' },
  [TEX.WOOL_WHITE]: { key: 'white_wool' },
  [TEX.WOOL_RED]: { key: 'red_wool' },
  [TEX.WOOL_BLUE]: { key: 'blue_wool' },
  [TEX.WOOL_GREEN]: { key: 'green_wool' },
  [TEX.WOOL_YELLOW]: { key: 'yellow_wool' },
  [TEX.WOOL_BLACK]: { key: 'black_wool' },
  [TEX.WOOL_PURPLE]: { key: 'purple_wool' },
  [TEX.WOOL_CYAN]: { key: 'cyan_wool' },
  [TEX.WOOL_ORANGE]: { key: 'orange_wool' },
  [TEX.DEEPSLATE]: { key: 'deepslate' },
  [TEX.GRANITE]: { key: 'granite' },
  [TEX.DIORITE]: { key: 'diorite' },
  [TEX.ANDESITE]: { key: 'andesite' },
  [TEX.LADDER]: { key: 'ladder' },
  [TEX.RAIL]: { key: 'rail' },
  [TEX.COBWEB]: { key: 'cobweb' },
  [TEX.SPAWNER]: { key: 'spawner' },
  [TEX.OAK_DOOR_TOP]: { key: 'oak_door_top' },
  [TEX.OAK_DOOR_BOTTOM]: { key: 'oak_door_bottom' },
  [TEX.LANTERN]: { key: 'lantern' },
  [TEX.SEA_LANTERN]: { key: 'sea_lantern' },
  [TEX.ANCIENT_DEBRIS_SIDE]: { key: 'ancient_debris_side' },
  [TEX.ANCIENT_DEBRIS_TOP]: { key: 'ancient_debris_top' },
  [TEX.CRYING_OBSIDIAN]: { key: 'crying_obsidian' },
  [TEX.REPEATER_OFF]: { key: 'repeater' },
  [TEX.REPEATER_ON]: { key: 'repeater_on' },
};

for (let i = 0; i < 10; i++) {
  TILE_OFFICIAL_MAP[TEX.DESTROY_0 + i] = { key: `destroy_stage_${i}` };
}

class TextureManager {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_WIDTH;
    this.canvas.height = ATLAS_HEIGHT;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.ctx.imageSmoothingEnabled = false;

    this.tileDataUrls = new Map();
    this.itemIconUrls = new Map();
    this.onAtlasUpdated = null;
    this.ready = false;
  }

  // Generate immediate procedural fallback pixels so the first frame renders without waiting,
  // then decode all official 26.2 PNGs and upload the exact official textures!
  async buildAtlas() {
    this.drawProceduralFallbackAll();
    await this.loadOfficialTexturesIntoAtlas();
    this.ready = true;
    if (this.onAtlasUpdated) this.onAtlasUpdated(this.canvas);
  }

  drawProceduralFallbackAll() {
    // Draw authentic Chest tiles (since Chest in Minecraft uses entity model, we craft crisp 16x16 block tiles for it)
    this.drawChestTiles();
    // Fill basic fallback colors for other tiles before async image load finishes
    for (const [tileIdStr] of Object.entries(TILE_OFFICIAL_MAP)) {
      const id = Number(tileIdStr);
      if (id === TEX.CHEST_TOP || id === TEX.CHEST_FRONT || id === TEX.CHEST_SIDE) continue;
      const tx = (id % ATLAS_COLS) * TILE_SIZE;
      const ty = Math.floor(id / ATLAS_COLS) * TILE_SIZE;
      this.ctx.fillStyle = '#777';
      this.ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
    }
  }

  drawChestTiles() {
    const drawTile = (id, fn) => {
      const tx = (id % ATLAS_COLS) * TILE_SIZE;
      const ty = Math.floor(id / ATLAS_COLS) * TILE_SIZE;
      fn(this.ctx, tx, ty);
      this.cacheTileDataUrl(id);
    };
    drawTile(TEX.CHEST_TOP, (ctx, x, y) => {
      ctx.fillStyle = '#9c6e27';
      ctx.fillRect(x, y, 16, 16);
      ctx.strokeStyle = '#3b270c';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, 14, 14);
    });
    drawTile(TEX.CHEST_SIDE, (ctx, x, y) => {
      ctx.fillStyle = '#a47228';
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = '#241707';
      ctx.fillRect(x, y + 5, 16, 2);
      ctx.strokeStyle = '#3b270c';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, 14, 14);
    });
    drawTile(TEX.CHEST_FRONT, (ctx, x, y) => {
      ctx.fillStyle = '#a47228';
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = '#241707';
      ctx.fillRect(x, y + 5, 16, 2);
      ctx.strokeStyle = '#3b270c';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, 14, 14);
      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(x + 6, y + 4, 4, 5);
      ctx.fillStyle = '#777';
      ctx.fillRect(x + 7, y + 6, 2, 2);
    });
  }

  loadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async loadOfficialTexturesIntoAtlas() {
    const tmp = document.createElement('canvas');
    tmp.width = TILE_SIZE;
    tmp.height = TILE_SIZE;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.imageSmoothingEnabled = false;

    const entries = Object.entries(TILE_OFFICIAL_MAP);
    await Promise.all(entries.map(async ([tileIdStr, spec]) => {
      const tileId = Number(tileIdStr);
      const b64 = OFFICIAL_BLOCK_PNGS[spec.key];
      if (!b64) return;
      const img = await this.loadImage(b64);
      if (!img) return;

      const tx = (tileId % ATLAS_COLS) * TILE_SIZE;
      const ty = Math.floor(tileId / ATLAS_COLS) * TILE_SIZE;

      tctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
      // Animated textures in Minecraft (like water_still, lava_still, nether_portal) are 16xN vertical strips;
      // draw the top 16x16 frame
      tctx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);

      if (spec.tint || spec.opaqueAlpha || spec.alpha !== undefined) {
        const imgData = tctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (spec.tint) {
            d[i]     = Math.min(255, (d[i]     * spec.tint[0]) / 255);
            d[i + 1] = Math.min(255, (d[i + 1] * spec.tint[1]) / 255);
            d[i + 2] = Math.min(255, (d[i + 2] * spec.tint[2]) / 255);
          }
          if (spec.opaqueAlpha && d[i + 3] < 128) {
            // Fill dark foliage interior for fast/fancy leaf clarity
            d[i] = 24; d[i + 1] = 48; d[i + 2] = 18; d[i + 3] = 255;
          } else if (spec.alpha !== undefined && d[i + 3] > 0) {
            d[i + 3] = Math.round(d[i + 3] * spec.alpha);
          }
        }
        tctx.putImageData(imgData, 0, 0);
      }

      if (spec.overlay && OFFICIAL_BLOCK_PNGS[spec.overlay]) {
        const ovImg = await this.loadImage(OFFICIAL_BLOCK_PNGS[spec.overlay]);
        if (ovImg) {
          const ovCanvas = document.createElement('canvas');
          ovCanvas.width = TILE_SIZE;
          ovCanvas.height = TILE_SIZE;
          const octx = ovCanvas.getContext('2d', { willReadFrequently: true });
          octx.drawImage(ovImg, 0, 0, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
          if (spec.overlayTint) {
            const od = octx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
            for (let i = 0; i < od.data.length; i += 4) {
              if (od.data[i + 3] > 0) {
                od.data[i]     = Math.min(255, (od.data[i]     * spec.overlayTint[0]) / 255);
                od.data[i + 1] = Math.min(255, (od.data[i + 1] * spec.overlayTint[1]) / 255);
                od.data[i + 2] = Math.min(255, (od.data[i + 2] * spec.overlayTint[2]) / 255);
              }
            }
            octx.putImageData(od, 0, 0);
          }
          tctx.drawImage(ovCanvas, 0, 0);
        }
      }

      this.ctx.clearRect(tx, ty, TILE_SIZE, TILE_SIZE);
      this.ctx.drawImage(tmp, tx, ty);
      this.cacheTileDataUrl(tileId);
    }));

    // Pre-populate item icons from OFFICIAL_ITEM_PNGS
    for (const [k, b64] of Object.entries(OFFICIAL_ITEM_PNGS)) {
      this.itemIconUrls.set(k, b64);
    }
  }

  cacheTileDataUrl(tileId) {
    const c = document.createElement('canvas');
    c.width = TILE_SIZE;
    c.height = TILE_SIZE;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    const tx = (tileId % ATLAS_COLS) * TILE_SIZE;
    const ty = Math.floor(tileId / ATLAS_COLS) * TILE_SIZE;
    cx.drawImage(this.canvas, tx, ty, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
    this.tileDataUrls.set(tileId, c.toDataURL());
  }

  getTileDataUrl(tileId) {
    if (!this.tileDataUrls.has(tileId)) {
      this.cacheTileDataUrl(tileId);
    }
    return this.tileDataUrls.get(tileId);
  }

  getIconForDef(def) {
    if (!def) return '';
    if (def.officialItemKey && OFFICIAL_ITEM_PNGS[def.officialItemKey]) {
      return OFFICIAL_ITEM_PNGS[def.officialItemKey];
    }
    if (def.officialBlockKey && OFFICIAL_BLOCK_PNGS[def.officialBlockKey]) {
      return OFFICIAL_BLOCK_PNGS[def.officialBlockKey];
    }
    if (def.faces) {
      const tileId = def.faces.front ?? def.faces.side ?? def.faces.top ?? def.faces.all ?? 0;
      return this.getTileDataUrl(tileId);
    }
    return '';
  }

  // Returns sample RGB color for a block's particle burst
  getBlockParticleColor(blockDef) {
    if (!blockDef || !blockDef.faces) return [0.6, 0.6, 0.6];
    const tileId = blockDef.faces.top ?? blockDef.faces.side ?? blockDef.faces.all ?? 0;
    const tx = (tileId % ATLAS_COLS) * TILE_SIZE + 8;
    const ty = Math.floor(tileId / ATLAS_COLS) * TILE_SIZE + 8;
    const p = this.ctx.getImageData(tx, ty, 1, 1).data;
    return [p[0] / 255, p[1] / 255, p[2] / 255];
  }
}

const TEXTURES = new TextureManager();
