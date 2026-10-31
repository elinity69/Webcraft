// ============================================================================
// Part 13: Dimensions — nether/end travel, dragon fight setup
// ============================================================================
const DIM_WORLDS = new Map();  // dim -> World

function getWorldFor(dim) {
  if (dim === G.dimension) return G.world;
  let w = DIM_WORLDS.get(dim);
  if (!w) {
    w = new World(G.seed, dim);
    DIM_WORLDS.set(dim, w);
  }
  return w;
}

function TeleportPlayer(x, y, z) {
  const p = G.player;
  p.x = x; p.y = y; p.z = z;
  p.px = x; p.py = y; p.pz = z;   // no camera glide across the world
  p.isTeleporting = true;
  setTimeout(() => { p.isTeleporting = false; }, 100);
  p.vx = p.vy = p.vz = 0;
  p.fallDistance = 0;
  // ensure destination chunks are generated
  const w = G.world;
  for (let cx = Math.floor((x - 16) / CH); cx <= Math.floor((x + 16) / CH); cx++)
    for (let cz = Math.floor((z - 16) / CH); cz <= Math.floor((z + 16) / CH); cz++)
      w.ensureChunk(cx, cz);
  // find safe ground
  let sy = Math.min(WORLD_H - 3, Math.max(2, Math.floor(y)));
  const solidAt = (yy) => { const id = w.getBlock(Math.floor(x), yy, Math.floor(z)); return id > 0 && BLOCKS[id].solid; };
  while (sy < WORLD_H - 2 && !solidAt(sy)) sy++;
  if (solidAt(sy)) p.y = sy + 1.01;
}

function TeleportDimension(targetDim, fromX, fromZ) {
  const p = G.player;
  if (targetDim === G.dimension) return;
  SFX.playPortalTrigger();
  // coordinate scaling overworld <-> nether
  let tx = fromX, tz = fromZ;
  if (G.dimension === 0 && targetDim === 1) { tx = Math.floor(fromX / 8); tz = Math.floor(fromZ / 8); }
  else if (G.dimension === 1 && targetDim === 0) { tx = Math.floor(fromX * 8); tz = Math.floor(fromZ * 8); }

  const oldWorld = G.world;
  // swap world
  G.world = getWorldFor(targetDim);
  G.dimension = targetDim;

  // pre-generate around destination
  const R = 2;
  for (let cx = Math.floor((tx - R * CH) / CH); cx <= Math.floor((tx + R * CH) / CH); cx++)
    for (let cz = Math.floor((tz - R * CH) / CH); cz <= Math.floor((tz + R * CH) / CH); cz++)
      G.world.ensureChunk(cx, cz);

  // find portal spot or build one
  let px = Math.floor(tx), pz = Math.floor(tz);
  let py = -1;
  // search existing portal nearby
  outer:
  for (let r = 0; r < 24 && py < 0; r += 4) {
    for (let dx = -r; dx <= r && py < 0; dx += 4) {
      for (let dz = -r; dz <= r && py < 0; dz += 4) {
        const sx = px + dx, sz = pz + dz;
        for (let y = 1; y < WORLD_H - 3; y++) {
          if (G.world.getBlock(sx, y, sz) === B.nether_portal) { px = sx; pz = sz; py = y; break; }
        }
      }
    }
  }
  if (py < 0) {
    // build a new portal at destination
    py = findPortalY(G.world, px, pz);
    buildPortalFrame(G.world, px, py, pz);
    py = py + 1;
  }
  p.x = px + .5; p.z = pz + .5;
  p.y = py + .5;
  p.px = p.x; p.py = p.y; p.pz = p.z;
  p.isTeleporting = true;
  setTimeout(() => { p.isTeleporting = false; }, 100);
  p.vx = p.vy = p.vz = 0;
  p.fallDistance = 0;
  p.portalTime = -40; // grace period

  // clear entities (they belong to the old dimension); re-init dragon if End
  G.entities.length = 0;
  G.particles.length = 0;
  if (targetDim === 2) setupEndFight();
  if (targetDim === 0 && G._dragonDefeated) { /* portal already placed */ }
  // update sky immediately
  $('underwater-overlay').style.opacity = '0';
  Chat.add('§d' + (targetDim === 1 ? 'Entering the Nether...' : targetDim === 2 ? 'Entering the End...' : 'Returning to the Overworld...'));
}

function findPortalY(world, x, z) {
  if (G.dimension === 1) {
    // nether: find air pocket with floor
    for (let y = 34; y < 90; y++) {
      const below = world.getBlock(x, y - 1, z), at = world.getBlock(x, y, z), above = world.getBlock(x, y + 1, z), above2 = world.getBlock(x, y + 2, z), above3 = world.getBlock(x, y + 3, z);
      if (below === B.netherrack && at === 0 && above === 0 && above2 === 0 && above3 === 0) return y;
    }
    // carve a pocket
    for (let dy = 0; dy < 5; dy++) for (let dx = -2; dx <= 3; dx++) for (let dz = -2; dz <= 3; dz++) {
      world.setBlock(x + dx, 40 + dy, z + dz, 0, 0, { noUpdate: true });
    }
    return 40;
  }
  // overworld: surface
  for (let y = WORLD_H - 4; y > 1; y--) {
    const id = world.getBlock(x, y, z);
    if (id > 0 && BLOCKS[id].solid && world.getBlock(x, y + 1, z) === 0 && world.getBlock(x, y + 2, z) === 0 && world.getBlock(x, y + 3, z) === 0 && world.getBlock(x, y + 4, z) === 0) return y + 1;
  }
  return 70;
}

function buildPortalFrame(world, x, y, z) {
  // 4 wide (x), 5 tall portal facing z-axis (axis meta 1 = z-plane)
  for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 4; dy++) {
    const isFrame = dx === -1 || dx === 2 || dy === -1 || dy === 4;
    world.setBlock(x + dx, y + dy, z, isFrame ? B.obsidian : 0, 0, { noUpdate: true });
  }
  for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 3; dy++) {
    world.setBlock(x + dx, y + dy, z, B.nether_portal, 1, { noUpdate: true });
  }
  // platform in front/back
  for (let dx = -1; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    const below = world.getBlock(x + dx, y - 1, z + dz);
    if (below === 0) world.setBlock(x + dx, y - 1, z + dz, G.dimension === 1 ? B.netherrack : B.stone, 0, { noUpdate: true });
  }
}

// ---------- End fight ----------
function setupEndFight() {
  // ensure center island is generated
  for (let cx = -4; cx <= 4; cx++) for (let cz = -4; cz <= 4; cz++) G.world.ensureChunk(cx, cz);
  if (G._endInit) return;
  G._endInit = true;
  // crystals on the 10 pillars
  for (let p = 0; p < 10; p++) {
    const ang = p / 10 * Math.PI * 2;
    const pxw = Math.round(Math.cos(ang) * 42), pzw = Math.round(Math.sin(ang) * 42);
    const h = 78 + ((mulberry32(G.seed ^ (p * 7919))() * 18) | 0);
    const crystal = new Entity('crystal', pxw + .5, h + 1, pzw + .5, { w: 1, h: 2, health: 1, xp: 0 }, {});
    crystal.hittable = true;
    crystal.crystalHeal = true;
    G.entities.push(crystal);
  }
  // dragon
  const dragon = spawnEntity('dragon', 0, 80, 0);
  dragon.orbitR = 38; dragon.orbitY = 82;
  Chat.add('§dThe Ender Dragon awakens!');
}
