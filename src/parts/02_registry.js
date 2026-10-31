// ============================================================================
// Part 02: Block & Item Registry — data-driven definitions
// ============================================================================
const BLOCKS = [];            // by numeric id
const B = { air: 0 };         // key -> id lookup
const BLOCK_KEYS = [];        // id -> key (filled by defBlock; index aligns with BLOCKS)

// shape: cube, cross, torch, slab, liquid, farmland, snow, chestbox, ladder, fence, door_lower/upper handled by meta, bed, pane, carpet, wire, plate, fire, portal, reed, cactus_full
function defBlock(key, def) {
  const id = BLOCKS.length;
  const d = Object.assign({
    id, key, name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    shape: 'cube', solid: true, opaque: true, hardness: 1, tool: null, minTier: 0,
    drops: 'self', light: 0, material: 'stone', faces: { all: key },
    gravity: false, fluid: null, flammable: false, placeable: true, stack: 64, friction: 0.6,
  }, def);
  BLOCKS.push(d); B[key] = id; BLOCK_KEYS.push(key);
  return id;
}

defBlock('air', { shape: 'none', solid: false, opaque: false, placeable: false, hardness: 0 });

// ---- Natural stone ----
defBlock('stone', { hardness: 1.5, tool: 'pickaxe', drops: 'cobblestone', material: 'stone' });
defBlock('granite', { hardness: 1.5, tool: 'pickaxe', material: 'stone' });
defBlock('diorite', { hardness: 1.5, tool: 'pickaxe', material: 'stone' });
defBlock('andesite', { hardness: 1.5, tool: 'pickaxe', material: 'stone' });
defBlock('deepslate', { hardness: 3, tool: 'pickaxe', drops: 'cobbled_deepslate', material: 'stone' });
defBlock('cobbled_deepslate', { hardness: 3.5, tool: 'pickaxe', material: 'stone' });
defBlock('cobblestone', { hardness: 2, tool: 'pickaxe', material: 'stone' });
defBlock('mossy_cobblestone', { hardness: 2, tool: 'pickaxe', material: 'stone' });
defBlock('smooth_stone', { hardness: 2, tool: 'pickaxe', material: 'stone' });
defBlock('stone_bricks', { hardness: 1.5, tool: 'pickaxe', material: 'stone' });
defBlock('mossy_stone_bricks', { hardness: 1.5, tool: 'pickaxe', material: 'stone' });
defBlock('cracked_stone_bricks', { hardness: 1.5, tool: 'pickaxe', material: 'stone' });
defBlock('chiseled_stone_bricks', { hardness: 1.5, tool: 'pickaxe', material: 'stone' });
defBlock('bricks', { hardness: 2, tool: 'pickaxe', material: 'stone' });
defBlock('bedrock', { hardness: -1, tool: 'pickaxe', material: 'stone' });
defBlock('obsidian', { hardness: 50, tool: 'pickaxe', minTier: 3, material: 'stone' });
defBlock('crying_obsidian', { hardness: 50, tool: 'pickaxe', minTier: 3, light: 10, material: 'stone' });

// ---- Soils ----
defBlock('dirt', { hardness: .5, tool: 'shovel', material: 'dirt' });
defBlock('coarse_dirt', { hardness: .5, tool: 'shovel', drops: 'coarse_dirt', material: 'dirt' });
defBlock('grass_block', { hardness: .6, tool: 'shovel', drops: 'dirt', material: 'grass', flammable: true, faces: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' } });
defBlock('podzol', { hardness: .5, tool: 'shovel', drops: 'dirt', material: 'dirt', faces: { top: 'podzol_top', side: 'podzol_side', bottom: 'dirt' } });
defBlock('sand', { hardness: .5, tool: 'shovel', gravity: true, material: 'sand' });
defBlock('red_sand', { hardness: .5, tool: 'shovel', gravity: true, material: 'sand' });
defBlock('gravel', { hardness: .6, tool: 'shovel', gravity: true, drops: { self: 1, flint: .1 }, material: 'gravel' });
defBlock('clay', { hardness: .6, tool: 'shovel', drops: { clay_ball: 4 }, material: 'dirt' });
defBlock('farmland', { shape: 'farmland', hardness: .6, tool: 'shovel', drops: 'dirt', opaque: false, solid: true, material: 'dirt', faces: { top: 'farmland', side: 'dirt', bottom: 'dirt' } });
defBlock('dirt_path', { shape: 'farmland', hardness: .6, tool: 'shovel', drops: 'dirt', opaque: false, material: 'dirt', faces: { top: 'dirt_path_top', side: 'dirt_path_side', bottom: 'dirt' } });

// ---- Sandstone ----
defBlock('sandstone', { hardness: .8, tool: 'pickaxe', material: 'stone', faces: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone' } });
defBlock('chiseled_sandstone', { hardness: .8, tool: 'pickaxe', material: 'stone' });
defBlock('cut_sandstone', { hardness: .8, tool: 'pickaxe', material: 'stone' });
defBlock('red_sandstone', { hardness: .8, tool: 'pickaxe', material: 'stone' });

// ---- Ice/snow ----
defBlock('snow_block', { hardness: .2, tool: 'shovel', material: 'snow' });
defBlock('snow_layer', { shape: 'snow', solid: false, opaque: false, hardness: .1, tool: 'shovel', drops: 'snowball', material: 'snow', faces: { all: 'snow' } });
defBlock('ice', { hardness: .5, tool: 'pickaxe', opaque: false, drops: null, material: 'glass', faces: { all: 'ice' }, friction: 0.98 });
defBlock('packed_ice', { hardness: .5, tool: 'pickaxe', material: 'glass', friction: 0.98 });
defBlock('blue_ice', { hardness: 2.8, tool: 'pickaxe', material: 'glass', friction: 0.989 });

// ---- Ores ----
const ORE = (key, drop, xp, opts = {}) => defBlock(key, Object.assign({
  hardness: 3, tool: 'pickaxe', minTier: 1, drops: drop, oreXP: xp, material: 'stone',
}, opts));
ORE('coal_ore', { coal: 1 }, [0, 2]);
ORE('iron_ore', { raw_iron: 1 }, null, { minTier: 1 });
ORE('copper_ore', { raw_copper: 2 }, null, { minTier: 1 });
ORE('gold_ore', { raw_gold: 1 }, [0, 1], { minTier: 2 });
ORE('redstone_ore', { redstone: 4 }, [1, 5]);
ORE('lapis_ore', { lapis_lazuli: 5 }, [2, 5]);
ORE('diamond_ore', { diamond: 1 }, [3, 7], { minTier: 2 });
ORE('emerald_ore', { emerald: 1 }, [3, 7], { minTier: 2 });
ORE('deepslate_coal_ore', { coal: 1 }, [0, 2]);
ORE('deepslate_iron_ore', { raw_iron: 1 }, null);
ORE('deepslate_copper_ore', { raw_copper: 2 }, null);
ORE('deepslate_gold_ore', { raw_gold: 1 }, [0, 1], { minTier: 2 });
ORE('deepslate_redstone_ore', { redstone: 4 }, [1, 5]);
ORE('deepslate_lapis_ore', { lapis_lazuli: 5 }, [2, 5]);
ORE('deepslate_diamond_ore', { diamond: 1 }, [3, 7], { minTier: 2 });
ORE('deepslate_emerald_ore', { emerald: 1 }, [3, 7], { minTier: 2 });
ORE('nether_quartz_ore', { quartz: 1 }, [2, 5], { hardness: 3 });
ORE('nether_gold_ore', { gold_nugget: 6 }, [0, 1], { hardness: 3 });
defBlock('ancient_debris', { hardness: 30, tool: 'pickaxe', minTier: 3, material: 'stone' });

// ---- Mineral blocks ----
defBlock('coal_block', { hardness: 5, tool: 'pickaxe', material: 'stone' });
defBlock('iron_block', { hardness: 5, tool: 'pickaxe', minTier: 1, material: 'metal' });
defBlock('copper_block', { hardness: 3, tool: 'pickaxe', minTier: 1, material: 'metal' });
defBlock('gold_block', { hardness: 3, tool: 'pickaxe', minTier: 2, material: 'metal' });
defBlock('redstone_block', { hardness: 5, tool: 'pickaxe', material: 'stone' });
defBlock('lapis_block', { hardness: 3, tool: 'pickaxe', minTier: 1, material: 'stone' });
defBlock('diamond_block', { hardness: 5, tool: 'pickaxe', minTier: 2, material: 'metal' });
defBlock('emerald_block', { hardness: 5, tool: 'pickaxe', minTier: 2, material: 'metal' });
defBlock('netherite_block', { hardness: 50, tool: 'pickaxe', minTier: 3, material: 'metal' });

// ---- Wood: oak, spruce, birch, acacia, dark_oak ----
const WOODS = ['oak', 'spruce', 'birch', 'acacia', 'dark_oak'];
for (const w of WOODS) {
  defBlock(`${w}_log`, {
    hardness: 2, tool: 'axe', material: 'wood', flammable: true,
    faces: { top: `${w}_log_top`, bottom: `${w}_log_top`, side: `${w}_log` },
  });
  defBlock(`${w}_planks`, { hardness: 2, tool: 'axe', material: 'wood', flammable: true });
  defBlock(`${w}_leaves`, {
    hardness: .2, tool: 'shears', opaque: false, material: 'grass', flammable: true,
    drops: { sapling5: 1, apple1: 1 }, leafColor: w,
    faces: { all: `${w}_leaves` },
  });
  defBlock(`${w}_sapling`, {
    shape: 'cross', solid: false, opaque: false, hardness: 0, material: 'plant',
    flammable: true, faces: { all: `${w}_sapling` },
  });
}

// ---- Utility blocks ----
defBlock('crafting_table', { hardness: 2.5, tool: 'axe', material: 'wood', flammable: true, faces: { top: 'crafting_top', side: 'crafting_side', front: 'crafting_front', bottom: 'oak_planks' }, tileEntity: 'crafting' });
defBlock('furnace', { hardness: 3.5, tool: 'pickaxe', material: 'stone', tileEntity: 'furnace', faces: { top: 'furnace_top', side: 'furnace_side', bottom: 'furnace_top', front: 'furnace_front' } });
defBlock('chest', { shape: 'chestbox', hardness: 2.5, tool: 'axe', opaque: false, material: 'wood', flammable: true, tileEntity: 'chest', faces: { top: 'chest_top', side: 'chest_side', bottom: 'chest_top', front: 'chest_front' } });
defBlock('bookshelf', { hardness: 1.5, tool: 'axe', material: 'wood', flammable: true, drops: { book: 3 }, faces: { top: 'oak_planks', bottom: 'oak_planks', side: 'bookshelf' } });
defBlock('tnt', { hardness: 0, material: 'grass', faces: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' } });
defBlock('torch', { shape: 'torch', solid: false, opaque: false, hardness: 0, light: 14, material: 'wood', faces: { all: 'torch' } });
defBlock('ladder', { shape: 'ladder', solid: false, opaque: false, hardness: .4, tool: 'axe', material: 'wood', flammable: true, faces: { all: 'ladder' } });
defBlock('fence', { shape: 'fence', opaque: false, hardness: 2, tool: 'axe', material: 'wood', flammable: true, faces: { all: 'oak_planks' } });
defBlock('oak_door', { shape: 'door', opaque: false, solid: true, hardness: 3, tool: 'axe', material: 'wood', flammable: true, faces: { top: 'door_top', bottom: 'door_bottom' } });
defBlock('spruce_door', { shape: 'door', opaque: false, solid: true, hardness: 3, tool: 'axe', material: 'wood', faces: { top: 'spruce_door_top', bottom: 'spruce_door_bottom' } });
defBlock('birch_door', { shape: 'door', opaque: false, solid: true, hardness: 3, tool: 'axe', material: 'wood', faces: { top: 'birch_door_top', bottom: 'birch_door_bottom' } });
defBlock('glass', { hardness: .3, opaque: false, drops: null, material: 'glass' });
defBlock('glass_pane', { shape: 'pane', opaque: false, solid: true, hardness: .3, drops: null, material: 'glass', faces: { all: 'glass' } });
defBlock('stone_slab', { shape: 'slab', opaque: false, solid: true, hardness: 2, tool: 'pickaxe', material: 'stone', variant: { type: 'stone', meta: 0 } });
defBlock('cobblestone_slab', { shape: 'slab', opaque: false, solid: true, hardness: 2, tool: 'pickaxe', material: 'stone', variant: { type: 'cobblestone', meta: 0 } });
defBlock('oak_slab', { shape: 'slab', opaque: false, solid: true, hardness: 2, tool: 'axe', material: 'wood', variant: { type: 'oak_planks', meta: 0 } });
defBlock('stone_brick_slab', { shape: 'slab', opaque: false, solid: true, hardness: 2, tool: 'pickaxe', material: 'stone', variant: { type: 'stone_bricks', meta: 0 } });
defBlock('enchanting_table', { shape: 'enchant', hardness: 5, tool: 'pickaxe', opaque: false, material: 'stone', light: 7, tileEntity: 'enchant', faces: { top: 'enchant_top', side: 'enchant_side', bottom: 'obsidian' } });
defBlock('note_block', { hardness: .8, tool: 'axe', material: 'wood', faces: { top: 'noteblock_top', side: 'noteblock_side' } });
defBlock('spawner', { hardness: 5, tool: 'pickaxe', drops: null, opaque: false, material: 'metal' });
defBlock('cobweb', { shape: 'cross', solid: false, opaque: false, hardness: 4, tool: 'shears', drops: { string: 1 }, material: 'wool', faces: { all: 'cobweb' } });
defBlock('jack_o_lantern', { hardness: 1, tool: 'axe', light: 15, material: 'grass', faces: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'jack_side', front: 'jack_face' } });
defBlock('pumpkin', { hardness: 1, tool: 'axe', material: 'grass', faces: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face' } });
defBlock('melon', { hardness: 1, tool: 'axe', drops: { melon_slice: 5 }, material: 'grass', faces: { top: 'melon_top', bottom: 'melon_top', side: 'melon_side' } });
defBlock('hay_block', { hardness: .5, material: 'grass', faces: { top: 'hay_top', bottom: 'hay_top', side: 'hay_side' } });

// ---- Redstone ----
defBlock('redstone_wire', { shape: 'wire', solid: false, opaque: false, hardness: 0, drops: 'redstone', material: 'plant', faces: { all: 'redstone_dot' } });
defBlock('redstone_torch', { shape: 'torch', solid: false, opaque: false, hardness: 0, light: 7, material: 'wood', faces: { all: 'redstone_torch' } });
defBlock('redstone_lamp', { hardness: .3, material: 'glass', faces: { all: 'redstone_lamp' } });
defBlock('lever', { shape: 'lever', solid: false, opaque: false, hardness: .5, material: 'wood', faces: { all: 'lever' } });
defBlock('stone_button', { shape: 'button', solid: false, opaque: false, hardness: .5, material: 'stone', faces: { all: 'stone_button' } });
defBlock('stone_pressure_plate', { shape: 'plate', solid: false, opaque: false, hardness: .5, material: 'stone', faces: { all: 'stone_plate' } });
defBlock('oak_pressure_plate', { shape: 'plate', solid: false, opaque: false, hardness: .5, material: 'wood', faces: { all: 'oak_plate' } });
defBlock('repeater', { shape: 'repeater', solid: false, opaque: false, hardness: 0, material: 'stone', faces: { top: 'repeater_top', side: 'smooth_stone', bottom: 'smooth_stone', front: 'repeater_front' } });
defBlock('comparator_skip', { placeable: false, shape: 'none', solid: false, opaque: false, hardness: 0 });
defBlock('piston', { shape: 'cube', hardness: 1.5, tool: 'pickaxe', material: 'stone', faces: { top: 'piston_top', bottom: 'piston_bottom', side: 'piston_side', front: 'piston_top' } });
defBlock('sticky_piston', { shape: 'cube', hardness: 1.5, tool: 'pickaxe', material: 'stone', faces: { top: 'piston_top_sticky', bottom: 'piston_bottom', side: 'piston_side', front: 'piston_top_sticky' } });

// ---- Plants ----
defBlock('short_grass', { shape: 'cross', solid: false, opaque: false, hardness: 0, drops: null, material: 'plant', flammable: true, faces: { all: 'short_grass' } });
defBlock('fern', { shape: 'cross', solid: false, opaque: false, hardness: 0, drops: null, material: 'plant', faces: { all: 'fern' } });
defBlock('dead_bush', { shape: 'cross', solid: false, opaque: false, hardness: 0, drops: { stick: 2 }, material: 'plant', faces: { all: 'dead_bush' } });
defBlock('dandelion', { shape: 'cross', solid: false, opaque: false, hardness: 0, material: 'plant', faces: { all: 'dandelion' } });
defBlock('poppy', { shape: 'cross', solid: false, opaque: false, hardness: 0, material: 'plant', faces: { all: 'poppy' } });
defBlock('blue_orchid', { shape: 'cross', solid: false, opaque: false, hardness: 0, material: 'plant', faces: { all: 'blue_orchid' } });
defBlock('allium', { shape: 'cross', solid: false, opaque: false, hardness: 0, material: 'plant', faces: { all: 'allium' } });
defBlock('cornflower', { shape: 'cross', solid: false, opaque: false, hardness: 0, material: 'plant', faces: { all: 'cornflower' } });
defBlock('oxeye_daisy', { shape: 'cross', solid: false, opaque: false, hardness: 0, material: 'plant', faces: { all: 'oxeye_daisy' } });
defBlock('red_tulip', { shape: 'cross', solid: false, opaque: false, hardness: 0, material: 'plant', faces: { all: 'red_tulip' } });
defBlock('red_mushroom', { shape: 'cross', solid: false, opaque: false, hardness: 0, material: 'plant', faces: { all: 'red_mushroom' } });
defBlock('brown_mushroom', { shape: 'cross', solid: false, opaque: false, hardness: 0, light: 1, material: 'plant', faces: { all: 'brown_mushroom' } });
defBlock('cactus', { shape: 'cactus', opaque: false, solid: true, hardness: .4, material: 'wool', faces: { top: 'cactus_top', bottom: 'cactus_bottom', side: 'cactus_side' }, cactus: true });
defBlock('sugar_cane', { shape: 'reed', solid: false, opaque: false, hardness: 0, material: 'plant', faces: { all: 'sugar_cane' } });
defBlock('wheat', { shape: 'crop', solid: false, opaque: false, hardness: 0, drops: 'wheat_crop', material: 'plant', faces: { all: 'wheat_stage0' } });

// ---- Wool & beds ----
const WOOL_COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
for (const c of WOOL_COLORS) {
  defBlock(`${c}_wool`, { hardness: .8, tool: 'shears', material: 'wool', flammable: true, faces: { all: `${c}_wool` } });
  defBlock(`${c}_carpet`, { shape: 'carpet', solid: false, opaque: false, hardness: .1, material: 'wool', flammable: true, faces: { all: `${c}_wool` } });
}
defBlock('white_bed', { shape: 'bed', solid: true, opaque: false, hardness: .2, material: 'wool', bed: true, faces: { top: 'bed_top_white', bottom: 'oak_planks', side: 'bed_side_white', front: 'bed_head_white' }, stack: 1 });
defBlock('red_bed', { shape: 'bed', solid: true, opaque: false, hardness: .2, material: 'wool', bed: true, faces: { top: 'bed_top_red', bottom: 'oak_planks', side: 'bed_side_red', front: 'bed_head_red' }, stack: 1 });

// ---- Fluids / fire / portals ----
defBlock('water', { shape: 'liquid', solid: false, opaque: false, hardness: -1, fluid: 'water', placeable: false, material: 'glass', faces: { all: 'water' } });
defBlock('lava', { shape: 'liquid', solid: false, opaque: false, hardness: -1, fluid: 'lava', light: 15, placeable: false, material: 'glass', faces: { all: 'lava' } });
defBlock('fire', { shape: 'fire', solid: false, opaque: false, hardness: 0, light: 15, drops: null, placeable: false, material: 'plant', faces: { all: 'fire' } });
defBlock('nether_portal', { shape: 'portal', solid: false, opaque: false, hardness: -1, light: 11, drops: null, placeable: false, material: 'glass', faces: { all: 'nether_portal' } });
defBlock('end_portal', { shape: 'portal', solid: false, opaque: false, hardness: -1, light: 15, drops: null, placeable: false, material: 'glass', faces: { all: 'end_portal' } });
defBlock('end_portal_frame', { shape: 'frame', solid: true, opaque: false, hardness: -1, light: 1, drops: null, material: 'stone', faces: { top: 'endframe_top', side: 'endframe_side', bottom: 'end_stone' } });
defBlock('dragon_egg', { shape: 'egg', solid: true, opaque: false, hardness: 3, light: 1, material: 'stone', faces: { all: 'dragon_egg' } });

// ---- Nether / End ----
defBlock('netherrack', { hardness: .4, tool: 'pickaxe', material: 'stone' });
defBlock('soul_sand', { hardness: .5, tool: 'shovel', material: 'sand', slows: true });
defBlock('soul_soil', { hardness: .5, tool: 'shovel', material: 'dirt' });
defBlock('nether_bricks', { hardness: 2, tool: 'pickaxe', material: 'stone' });
defBlock('quartz_block', { hardness: .8, tool: 'pickaxe', material: 'stone' });
defBlock('basalt', { hardness: 1.25, tool: 'pickaxe', material: 'stone', faces: { top: 'basalt_top', bottom: 'basalt_top', side: 'basalt_side' } });
defBlock('glowstone', { hardness: .3, light: 15, drops: { glowstone_dust: 3 }, material: 'glass' });
defBlock('sea_lantern', { hardness: .3, light: 15, material: 'glass' });
defBlock('magma_block', { hardness: .5, tool: 'pickaxe', light: 3, material: 'stone' });
defBlock('end_stone', { hardness: 3, tool: 'pickaxe', material: 'stone' });
defBlock('end_stone_bricks', { hardness: 3, tool: 'pickaxe', material: 'stone' });
defBlock('purpur_block', { hardness: 1.5, tool: 'pickaxe', material: 'stone' });

// ---- Stairs ----
defBlock('oak_stairs', { shape: 'stairs', hardness: 2, tool: 'axe', material: 'wood', flammable: true, faces: { all: 'oak_planks' } });
defBlock('spruce_stairs', { shape: 'stairs', hardness: 2, tool: 'axe', material: 'wood', faces: { all: 'spruce_planks' } });
defBlock('birch_stairs', { shape: 'stairs', hardness: 2, tool: 'axe', material: 'wood', faces: { all: 'birch_planks' } });
defBlock('cobblestone_stairs', { shape: 'stairs', hardness: 2, tool: 'pickaxe', material: 'stone', faces: { all: 'cobblestone' } });
defBlock('stone_brick_stairs', { shape: 'stairs', hardness: 2, tool: 'pickaxe', material: 'stone', faces: { all: 'stone_bricks' } });

// dye colors are shared with the icon painter (03c)
const DYE_COLORS = {
  red_dye: '#d43a2a', yellow_dye: '#f5d93f', blue_dye: '#2b53c9', purple_dye: '#792aac',
  light_gray_dye: '#9a9a9a', green_dye: '#546d1b', white_dye: '#f0f0f0', orange_dye: '#f07613',
  pink_dye: '#ed8dac', lime_dye: '#70b919', cyan_dye: '#158991', magenta_dye: '#bd44b3', light_blue_dye: '#3aafd9',
};

// ---- Utility blocks: brewing, anvil, signs, rails, nether wart ----
defBlock('brewing_stand', { shape: 'brewing', hardness: 0.5, tool: 'pickaxe', opaque: false, material: 'metal', light: 1, tileEntity: 'brewing', faces: { all: 'brewing_stand' } });
defBlock('anvil', { shape: 'anvil', hardness: 5, tool: 'pickaxe', opaque: false, material: 'metal', tileEntity: 'anvil', faces: { top: 'anvil_top', side: 'anvil_side', bottom: 'anvil_base' } });
defBlock('oak_sign', { shape: 'sign', solid: false, opaque: false, hardness: 1, tool: 'axe', material: 'wood', flammable: true, tileEntity: 'sign', faces: { all: 'oak_planks' } });
defBlock('rail', { shape: 'rail_flat', solid: false, opaque: false, hardness: 0.7, tool: 'pickaxe', material: 'metal', drops: { rail: 1 }, faces: { all: 'rail_flat' } });
defBlock('nether_wart', { shape: 'crop', solid: false, opaque: false, hardness: 0, drops: 'nether_wart_crop', material: 'plant', faces: { all: 'nether_wart_stage0' } });

const NUM_BLOCKS = BLOCKS.length;
const isOpaque = id => BLOCKS[id].opaque;
const isSolid = id => BLOCKS[id].solid;

// ============================================================================
// ITEMS
// ============================================================================
const ITEMS = [];            // by numeric id
const I = { };               // key -> item
function defItem(key, def) {
  const id = ITEMS.length;
  const d = Object.assign({
    id, key, name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    stack: 64, placeBlock: null, tool: null, food: null, fuel: 0,
    armor: null, damage: 1, variant: null,
  }, def);
  ITEMS.push(d); I[key] = id;
  return id;
}

// Auto item for every placeable block
for (const bl of BLOCKS) {
  if (!bl.placeable) continue;
  defItem(bl.key, { name: bl.name, placeBlock: bl.id, stack: bl.stack || 64, variant: bl.variant || null, fuel: bl.material === 'wood' && bl.flammable ? 300 : 0 });
}
// Door items reference the door block
defItem('oak_door_item', { placeBlock: B.oak_door, name: 'Oak Door', stack: 16, fuel: 200 });
defItem('spruce_door_item', { placeBlock: B.spruce_door, name: 'Spruce Door', stack: 16, fuel: 200 });
defItem('birch_door_item', { placeBlock: B.birch_door, name: 'Birch Door', stack: 16, fuel: 200 });
defItem('bed_item', { placeBlock: B.white_bed, name: 'White Bed', stack: 1, fuel: 200 });
defItem('red_bed_item', { placeBlock: B.red_bed, name: 'Red Bed', stack: 1, fuel: 200 });

// ---- Tools (1:1 ToolMaterial.java) ----
const TIERS = {
  wood: { tier: 0, speed: 2.0, uses: 59, dmgAdd: 0, ench: 15 },
  stone: { tier: 1, speed: 4.0, uses: 131, dmgAdd: 1, ench: 5 },
  iron: { tier: 2, speed: 6.0, uses: 250, dmgAdd: 2, ench: 14 },
  gold: { tier: 0, speed: 12.0, uses: 32, dmgAdd: 0, ench: 22 },
  diamond: { tier: 3, speed: 8.0, uses: 1561, dmgAdd: 3, ench: 10 },
  netherite: { tier: 4, speed: 9.0, uses: 2031, dmgAdd: 4, ench: 15 },
};
const TOOL_TYPES = { pickaxe: 2, axe: 6, shovel: 1.5, sword: 4, hoe: 1 };
for (const tier of Object.keys(TIERS)) {
  const t = TIERS[tier];
  for (const tt of Object.keys(TOOL_TYPES)) {
    defItem(`${tier}_${tt}`, {
      stack: 1, fuel: tier === 'wood' ? 200 : 0,
      tool: { type: tt, tier: t.tier, speed: t.speed, uses: t.uses },
      damage: TOOL_TYPES[tt] + t.dmgAdd,
      name: `${tier[0].toUpperCase()}${tier.slice(1)} ${tt[0].toUpperCase()}${tt.slice(1)}`,
    });
  }
}

// ---- Armor ----
const ARMOR_MATS = {
  leather: { def: [1, 2, 3, 1], uses: 55, ench: 15 },
  iron: { def: [2, 5, 6, 2], uses: 240, ench: 9 },
  gold: { def: [2, 4, 5, 1], uses: 77, ench: 25 },
  diamond: { def: [3, 7, 8, 3], uses: 528, ench: 10 },
  netherite: { def: [3, 6, 8, 3], uses: 592, ench: 15 },
};
const ARMOR_SLOTS = ['helmet', 'chestplate', 'leggings', 'boots'];
for (const mat of Object.keys(ARMOR_MATS)) {
  ARMOR_SLOTS.forEach((slot, i) => {
    defItem(`${mat}_${slot}`, {
      stack: 1, armor: { slot: i, defense: ARMOR_MATS[mat].def[i], uses: ARMOR_MATS[mat].uses },
      name: `${mat[0].toUpperCase()}${mat.slice(1)} ${slot[0].toUpperCase()}${slot.slice(1)}`,
    });
  });
}

// ---- Materials ----
defItem('stick', { fuel: 100 });
defItem('bowl', { fuel: 100 });
defItem('coal', { fuel: 1600 });
defItem('charcoal', { fuel: 1600 });
defItem('raw_iron', {}); defItem('iron_ingot', {}); defItem('raw_copper', {}); defItem('copper_ingot', {});
defItem('raw_gold', {}); defItem('gold_ingot', {}); defItem('gold_nugget', {}); defItem('iron_nugget', {});
defItem('diamond', {}); defItem('emerald', {}); defItem('lapis_lazuli', {}); defItem('redstone', {});
defItem('quartz', {}); defItem('netherite_scrap', {}); defItem('netherite_ingot', {});
defItem('clay_ball', {}); defItem('brick', {}); defItem('flint', {}); defItem('string', {});
defItem('feather', {}); defItem('gunpowder', {}); defItem('bone', {}); defItem('bone_meal', {});
defItem('leather', {}); defItem('paper', { fuel: 100 }); defItem('book', { fuel: 300 });
defItem('glowstone_dust', {}); defItem('sugar', {}); defItem('spider_eye', { food: { food: 2, sat: 3.2, bad: true } });
defItem('blaze_rod', {}); defItem('blaze_powder', {}); defItem('ender_pearl', { stack: 16, projectile: 'pearl' }); defItem('ender_eye', { stack: 16, enderEye: true });
defItem('slimeball', {}); defItem('magma_cream', {}); defItem('ghast_tear', {}); defItem('spectral_dust', {});

// ---- Food ----
const FOOD = (key, food, sat, opts = {}) => defItem(key, Object.assign({ food: { food, sat } }, opts));
FOOD('apple', 4, 2.4); FOOD('golden_apple', 4, 9.6, { stack: 16, golden: true });
FOOD('bread', 5, 6); FOOD('porkchop', 3, 1.8); FOOD('cooked_porkchop', 8, 12.8);
FOOD('beef', 3, 1.8); FOOD('cooked_beef', 8, 12.8);
FOOD('chicken', 2, 1.2, { food: { food: 2, sat: 1.2, bad: true } }); FOOD('cooked_chicken', 6, 7.2);
FOOD('mutton', 2, 1.2); FOOD('cooked_mutton', 6, 9.6);
FOOD('carrot', 3, 3.6); FOOD('golden_carrot', 6, 14.4); FOOD('potato', 1, 0.6); FOOD('baked_potato', 5, 6);
FOOD('melon_slice', 2, 1.2); FOOD('cookie', 2, 0.4); FOOD('pumpkin_pie', 8, 4.8);
FOOD('rotten_flesh', 4, 0.8, { food: { food: 4, sat: 0.8, bad: true } });
FOOD('sweet_berries', 2, 0.4); FOOD('mushroom_stew', 6, 7.2, { stack: 1 });
defItem('milk_bucket', { stack: 1, milk: true });

// ---- Utility ----
defItem('flint_and_steel', { stack: 1, igniter: true, tool: { type: 'igniter', tier: 0, speed: 1, uses: 64 }, damage: 1 });
defItem('shears', { stack: 1, tool: { type: 'shears', tier: 0, speed: 15, uses: 238 }, damage: 1 });
defItem('bucket', { stack: 16, bucket: 'empty' });
defItem('water_bucket', { stack: 1, bucket: 'water' });
defItem('lava_bucket', { stack: 1, bucket: 'lava', fuel: 20000 });
defItem('bow', { stack: 1, bow: true, tool: { type: 'bow', tier: 0, speed: 1, uses: 384 }, damage: 1 });
defItem('arrow', { projectile: 'arrow' });
defItem('snowball', { stack: 16, projectile: 'snowball', damage: 0 });
defItem('egg', { stack: 16, projectile: 'egg' });
defItem('ender_pearl_throw', { stack: 16, projectile: 'pearl' });
defItem('experience_bottle', { stack: 64, projectile: 'xp_bottle' });
defItem('compass', { stack: 1 }); defItem('clock', { stack: 1 });
defItem('wheat_item', {}); defItem('wheat_seeds', { plant: { block: 'wheat', on: 'farmland' } });
defItem('sugar_cane_item', { plant: { block: 'sugar_cane', on: 'any' } });
defItem('bone_meal', { boneMeal: true });
defItem('bone_meal_item', { boneMeal: true });
// dyes (MC-authentic set incl. secondary mixing colors)
for (const [k] of Object.entries(DYE_COLORS)) defItem(k, {});

// ---- Potions & brewing ----
defItem('glass_bottle', { stack: 16 });
defItem('water_bottle', { stack: 1, potion: { effect: 'water' } });
defItem('awkward_potion', { stack: 1, potion: { effect: 'base' } });
defItem('potion_healing', { stack: 1, potion: { effect: 'healing', dur: 0 } });
defItem('potion_regen', { stack: 1, potion: { effect: 'regen', dur: 45 * 20 } });
defItem('potion_speed', { stack: 1, potion: { effect: 'speed', dur: 3 * 60 * 20 } });
defItem('potion_strength', { stack: 1, potion: { effect: 'strength', dur: 3 * 60 * 20 } });
defItem('potion_fire_res', { stack: 1, potion: { effect: 'fire_res', dur: 3 * 60 * 20 } });
defItem('potion_night_vision', { stack: 1, potion: { effect: 'night_vision', dur: 3 * 60 * 20 } });
defItem('potion_water_breathing', { stack: 1, potion: { effect: 'water_breathing', dur: 3 * 60 * 20 } });
defItem('potion_poison', { stack: 1, potion: { effect: 'poison', dur: 45 * 20 } });
defItem('speckled_melon', {});
defItem('nether_wart', { plant: { block: 'nether_wart', on: 'soul' } });
defItem('boat', { stack: 1, boat: true });
defItem('minecart', { stack: 1, cart: true });
defItem('wither_skull_item', { stack: 1, witherSkull: true });
defItem('saddle', { stack: 1 });
// seeds drop item = wheat_seeds

const NUM_ITEMS = ITEMS.length;

// Resolve drops table -> array of [itemKey, count] entries (+special handlers)
// 1:1 with BlockBehaviour.getDestroyProgress & hasCorrectToolForDrops
function resolveDrops(blockId, meta, toolDef, fortuneLvl) {
  const bl = BLOCKS[blockId];
  if (!bl || bl.hardness < 0) return [];
  if (!canHarvest(blockId, toolDef)) return [];
  if (bl.key.endsWith('_leaves') && toolDef && toolDef.type === 'shears') {
    return [[bl.key, 1]];
  }
  if ((bl.key === 'short_grass' || bl.key === 'fern') && toolDef && toolDef.type === 'shears') {
    return [[bl.key, 1]];
  }
  let d = bl.drops;
  if (d === null) return [];
  if (d === undefined || d === 'self') return [[bl.key, 1]];
  if (typeof d === 'string') {
    if (d === 'wheat_crop') {
      if (meta >= 7) return [['wheat_item', 1], ['wheat_seeds', 1 + fortuneLvl]];
      return [['wheat_seeds', 1]];
    }
    if (d === 'nether_wart_crop') return [['nether_wart', meta >= 3 ? randInt(2, 4) : 1]];
    return [[d, 1]];
  }
  const out = [];
  for (const [k, v] of Object.entries(d)) {
    if (k === 'self') { out.push([bl.key, v]); continue; }
    if (k === 'sapling5') { if (chance(0.05 + fortuneLvl * 0.0125)) out.push([`${bl.key.replace('_leaves', '_sapling')}`, 1]); continue; }
    if (k === 'apple1') { if (chance(0.005 + fortuneLvl * 0.0025)) out.push(['apple', 1]); continue; }
    if (k === 'wheat_crop') {
      if (meta >= 7) { out.push(['wheat_item', 1]); out.push(['wheat_seeds', randInt(0, 3) + fortuneLvl]); }
      else out.push(['wheat_seeds', 1]);
      continue;
    }
    if (k === 'nether_wart_crop') {
      out.push(['nether_wart', meta >= 3 ? randInt(2, 4) : 1]);
      continue;
    }
    if (typeof v === 'number') {
      if (k === 'flint') {
        const flintChance = fortuneLvl >= 3 ? 1.0 : (fortuneLvl === 2 ? 0.25 : (fortuneLvl === 1 ? 0.14 : 0.10));
        if (chance(flintChance)) out.push(['flint', 1]);
        else out.push(['gravel', 1]);
        continue;
      }
      if (k.startsWith('redstone') || k.startsWith('lapis') || k.startsWith('diamond') || k.startsWith('emerald') || k.startsWith('coal') || k.startsWith('quartz') || k.startsWith('raw_')) {
        let n = v;
        if (fortuneLvl > 0) n += randInt(0, fortuneLvl + 1);
        out.push([k, n]); continue;
      }
      out.push([k, v]);
    }
  }
  return out;
}

// 1:1 BlockBehaviour.hasCorrectToolForDrops check (from decompiled BlockBehaviour.java & ToolMaterial.java)
function canHarvest(blockId, toolDef) {
  const bl = BLOCKS[blockId];
  if (!bl) return false;
  if (bl.key === 'snow_layer' || bl.key === 'snow_block') {
    return !!(toolDef && toolDef.type === 'shovel');
  }
  if (bl.key === 'cobweb') {
    return !!(toolDef && (toolDef.type === 'sword' || toolDef.type === 'shears'));
  }
  if (bl.tool !== 'pickaxe') return true;
  if (!toolDef || toolDef.type !== 'pickaxe') return false;
  const reqTier = bl.minTier || 0;
  return toolDef.tier >= reqTier;
}
