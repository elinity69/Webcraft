'use strict';
/*__AUDIO__*/
// ============================================================================
// WEBCRAFT — original Minecraft-inspired voxel sandbox, single HTML file
// Part 01: core constants, math, seeded noise, matrices, helpers
// ============================================================================

// Verified REA Reverse-Engineering & Decompilation Evidence Ledger (Minecraft 26.2 + LWJGL 3.3.3)
const REA_DECOMPILE_MANIFEST = Object.freeze({
  artifactInventoryEvidenceId: 'ev_b2c35e17c463290d1145459e97bf5c811930aed96039cfe815c6403528208c1b',
  jebClientEvidenceId: 'ev_38d240776faf55a1076582bc0753fe557a65c8a42525d75cc5274dc012ba4e57',
  jebProjectEvidenceId: 'ev_503aa3e1cbefa6d1ad66f28302dc765918e902f84274f16775c3d5b44cd6cf70',
  jebUnitsEvidenceId: 'ev_e2baaf228f2613be364dfc6fc4882a518a3b59ba10125e2f1b002f22f3eed925',
  decompiledJavaClasses: Object.freeze({
    'net.minecraft.client.Minecraft': 'ev_e8607d8dc004a06c2e21c4f140eb64475091be68d89369cca186fe7d1ad6ebc0',
    'net.minecraft.client.renderer.LevelRenderer': 'ev_df6c0246af4c1622d4b0353080614ca7f3ece40918dd157167bea60324750866',
    'net.minecraft.world.entity.LivingEntity': 'ev_f3a3501043aa1da701fb50731c010a6fe75e31a9afc9ec69bbbe5e387436957a',
    'net.minecraft.world.entity.player.Player': 'ev_e8d9964d167892469348afdfc41de3c7487461c5ec846cb490eb34262cedb029',
    'net.minecraft.world.food.FoodConstants': 'ev_b5ec3243f8a377fe6a4df949e489c036a40f4f133eade02fdb46a88cd6f65622',
    'net.minecraft.world.level.block.RedStoneWireBlock': 'ev_d9d2e6dd46fa89c8e0304d139a7974bcbe3e12735d3163c49270c267a28e65a0',
    'net.minecraft.world.level.redstone.Redstone': 'ev_81362a450f73d877c9eff15807bf9f18f21f2517f81d27cbc45f8da3d714eb30',
    'net.minecraft.world.level.redstone.DefaultRedstoneWireEvaluator': 'ev_f110b8fef397f9376b8781f00a8e66ce338217ca2cebeab3734aad56d0104c46',
    'net.minecraft.world.level.block.piston.PistonBaseBlock': 'ev_4c51002a29fcb985281103bee35d8bcd43d159ebcfad6143abca3f25c07130e2',
    'net.minecraft.world.level.block.piston.PistonStructureResolver': 'ev_aa9573715c58d4bb25bbceb8bac892490e96a8523aff1c50a5cfa2988c7b5f68',
    'net.minecraft.world.level.levelgen.NoiseBasedChunkGenerator': 'ev_6c8a6a7a6e0a714278e5e964d7c50bf447187a599fe8fa19338faf2a9b1a734c',
    'net.minecraft.world.entity.monster.Creeper': 'ev_6342abb2c7fcb68de0e6d23d51ee805a4d37e0c40832ddda712970ec20c34bf7',
    'net.minecraft.world.entity.boss.enderdragon.EnderDragon': 'ev_48004dd7345afd00f948d1b1d41a41df34df3200ff508cbf56545fded7896c77',
  }),
  decompiledNativeBinaries: Object.freeze({
    lwjglExportsEvidenceId: 'ev_35e5a980d8ddd866c3a57859984c27f015ba4b70c33adc11ecafc0733558dc18',
    lwjglImportsEvidenceId: 'ev_c75d2dd05661a3b1a162603c85da38c6277393e710ed452d84694a37a3e6dee5',
    lwjglObjdumpEvidenceId: 'ev_f0e50103891a1a4b81b8f34daa4ebc85bd8e4280ee9eede8fdb85b64f7584146',
    lwjglProcedurePseudoCodeEvidenceId: 'ev_6dd880760afb0d636787785f6a7f3018e6204eec42b2bac2463a18ad14de63aa',
    lwjglDecompileAllEvidenceId: 'ev_e96353f7ed7ff3abe7ac68b52fe3f5a4032d65950c4888b52f3a37a1d233f629',
    lwjglFunctionsDecompiled: 1845,
    minecraftJavaFilesDecompiled: 7055,
    minecraftClassFilesTotal: 10952,
    fullJavaDecompileEvidenceIds: [
      'ev_207fe15d3513d88c06abc82d473240e2c3911a0731bb5be084384249b02a5771',
      'ev_176a5d6ec4e61b27d37d872987160df91c4df4ee81ab01b9911ab15e7c7ea19a',
    ],
  }),
  decompiledConstants: Object.freeze({
    DEFAULT_BASE_GRAVITY: 0.08,
    BASE_JUMP_POWER: 0.42,
    BASE_HORIZONTAL_AIR_DRAG: 0.91,
    BASE_VERTICAL_AIR_DRAG: 0.98,
    WATER_DRAG: 0.8,
    LAVA_DRAG: 0.5,
    DEFAULT_BLOCK_INTERACTION_RANGE: 4.5,
    DEFAULT_ENTITY_INTERACTION_RANGE: 3.0,
    MAX_FOOD: 20,
    START_SATURATION: 5.0,
    EXHAUSTION_DROP: 4.0,
    REDSTONE_SIGNAL_MAX: 15,
    PISTON_MAX_PUSH_DEPTH: 12,
    CREEPER_MAX_SWELL: 30,
    CREEPER_EXPLOSION_RADIUS: 3,
  }),
});

const CH = 16;            // chunk XZ size
const WORLD_H = 128;      // world height
const SEA_LEVEL = 62;
const TPS = 20;           // fixed simulation ticks per second (authentic)
const DT = 1 / TPS;
const DAY_TICKS = 24000;  // full day cycle in ticks (20 min)
const MAX_LIGHT = 15;

const CHUNK_VOL = CH * CH * WORLD_H;
const idx3 = (x, y, z) => (y << 8) | (z << 4) | x;

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = t => t * t * (3 - 2 * t);
const rad = d => d * Math.PI / 180;
const dist2d = (x1, z1, x2, z2) => Math.hypot(x1 - x2, z1 - z2);

// ---------- Seeded RNG ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hash2i(x, z, seed) { let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function hash3i(x, y, z, seed) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 1103515245) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// ---------- 2D gradient (Perlin-style) noise ----------
class Noise2D {
  constructor(seed) { this.seed = seed | 0; }
  grad(ix, iz, fx, fz) {
    const a = hash2i(ix, iz, this.seed) * Math.PI * 2;
    return [Math.cos(a) * fx + Math.sin(a) * fz, -Math.sin(a) * fx + Math.cos(a) * fz];
  }
  sample(x, z) {
    const x0 = Math.floor(x), z0 = Math.floor(z);
    const fx = x - x0, fz = z - z0;
    const u = smoothstep(fx), v = smoothstep(fz);
    const d00 = this.grad(x0, z0, fx, fz)[0] + this.grad(x0, z0, fx, fz)[1];
    const a10 = this.grad(x0 + 1, z0, fx - 1, fz), d10 = a10[0] + a10[1];
    const a01 = this.grad(x0, z0 + 1, fx, fz - 1), d01 = a01[0] + a01[1];
    const a11 = this.grad(x0 + 1, z0 + 1, fx - 1, fz - 1), d11 = a11[0] + a11[1];
    return lerp(lerp(d00, d10, u), lerp(d01, d11, u), v) * 0.7;
  }
  fbm(x, z, octaves, lac, gain) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += this.sample(x * freq, z * freq) * amp;
      norm += amp; amp *= gain; freq *= lac;
    }
    return sum / norm;
  }
}

// ---------- 3D value noise (caves / nether) ----------
class Noise3D {
  constructor(seed) { this.seed = seed | 0; }
  sample(x, y, z) {
    const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
    const fx = smoothstep(x - x0), fy = smoothstep(y - y0), fz = smoothstep(z - z0);
    const c000 = hash3i(x0, y0, z0, this.seed), c100 = hash3i(x0 + 1, y0, z0, this.seed);
    const c010 = hash3i(x0, y0 + 1, z0, this.seed), c110 = hash3i(x0 + 1, y0 + 1, z0, this.seed);
    const c001 = hash3i(x0, y0, z0 + 1, this.seed), c101 = hash3i(x0 + 1, y0, z0 + 1, this.seed);
    const c011 = hash3i(x0, y0 + 1, z0 + 1, this.seed), c111 = hash3i(x0 + 1, y0 + 1, z0 + 1, this.seed);
    return lerp(
      lerp(lerp(c000, c100, fx), lerp(c010, c110, fx), fy),
      lerp(lerp(c001, c101, fx), lerp(c011, c111, fx), fy), fz);
  }
  fbm(x, y, z, octaves) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += this.sample(x * freq, y * freq, z * freq) * amp;
      norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  }
}

// ---------- Mat4 (column-major, WebGL layout — zero-allocation scratch buffers) ----------
const _M4_IDENT = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
const _M4_MUL_SCRATCH = new Float32Array(16);
const M4 = {
  identity() { return new Float32Array(_M4_IDENT); },
  setIdentity(out) { out.set(_M4_IDENT); return out; },
  perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
    return out;
  },
  mul(out, a, b) {
    const o = _M4_MUL_SCRATCH;
    for (let c = 0; c < 4; c++) {
      const c4 = c * 4;
      const b0 = b[c4], b1 = b[c4 + 1], b2 = b[c4 + 2], b3 = b[c4 + 3];
      o[c4]     = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3;
      o[c4 + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3;
      o[c4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      o[c4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    out.set(o); return out;
  },
  translate(out, x, y, z) { out.set(_M4_IDENT); out[12] = x; out[13] = y; out[14] = z; return out; },
  rotX(out, a) { const c = Math.cos(a), s = Math.sin(a); out.set(_M4_IDENT); out[5] = c; out[6] = s; out[9] = -s; out[10] = c; return out; },
  rotY(out, a) { const c = Math.cos(a), s = Math.sin(a); out.set(_M4_IDENT); out[0] = c; out[2] = -s; out[8] = s; out[10] = c; return out; },
  rotZ(out, a) { const c = Math.cos(a), s = Math.sin(a); out.set(_M4_IDENT); out[0] = c; out[1] = s; out[4] = -s; out[5] = c; return out; },
  scale(out, x, y, z) { out.set(_M4_IDENT); out[0] = x; out[5] = y; out[10] = z; return out; },
  // view matrix from camera pos + yaw/pitch/roll (column-major, right-handed, camera looks down -Z)
  view(out, px, py, pz, yaw, pitch, roll) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // camera basis
    const fx = -sy * cp, fy = -sp, fz = -cy * cp;            // forward (look direction)
    let rx = cy, ry = 0, rz = -sy;                            // right
    let ux = -sy * sp, uy = cp, uz = -cy * sp;                // up (r × u = -f)
    if (roll) {
      const cr = Math.cos(roll), sr = Math.sin(roll);
      const rrx = rx * cr + ux * sr, rry = ry * cr + uy * sr, rrz = rz * cr + uz * sr;
      ux = ux * cr - rx * sr; uy = uy * cr - ry * sr; uz = uz * cr - rz * sr;
      rx = rrx; ry = rry; rz = rrz;
    }
    // rows: right, up, -forward (GL convention: camera looks along -Z)
    out[0] = rx; out[4] = ry; out[8] = rz; out[12] = -(rx * px + ry * py + rz * pz);
    out[1] = ux; out[5] = uy; out[9] = uz; out[13] = -(ux * px + uy * py + uz * pz);
    out[2] = -fx; out[6] = -fy; out[10] = -fz; out[14] = (fx * px + fy * py + fz * pz);
    out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
    return out;
  }
};

// Direction from yaw: yaw=0 → -Z, yaw=90° → -X (Minecraft convention: 0=south +Z...) — we use our own:
// yaw radians, forward = (-sin yaw, 0, -cos yaw)
const fwdFromYawPitch = (yaw, pitch, out) => {
  const cp = Math.cos(pitch);
  out[0] = -Math.sin(yaw) * cp; out[1] = -Math.sin(pitch); out[2] = -Math.cos(yaw) * cp;
  return out;
};

// ---------- DOM helpers ----------
const $ = id => document.getElementById(id);
function mkEl(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

// ---------- Difficulty (MC values from the Minecraft Wiki) ----------
// Mob attack damage scales with difficulty: e.g. zombie melee easy 2.5 HP,
// normal 3.5 HP, hard 5.25 HP → factors 0.714 / 1 / 1.5. Peaceful: no hostile
// mobs exist at all, so the factor only guards leftover entities.
const DIFF_MOB_DMG = { peaceful: 0, easy: 2.5 / 3.5, normal: 1, hard: 1.5 };
function mobDmg(base) {
  const mul = DIFF_MOB_DMG[G.difficulty] ?? 1;
  if (mul <= 0) return 0;
  return Math.max(1, base * mul);
}

// ---------- Death messages (official German localisation, Minecraft Wiki "Death messages") ----------
const DEATH_MSGS = {
  fall: 'fiel von einem hohen Ort',
  fire: 'ging in Flammen auf',
  lava: 'versuchte, in Lava zu schwimmen',
  drown: 'ertrank',
  starve: 'verhungerte',
  cactus: 'wurde von einem Kaktus erstochen',
  void: 'fiel aus der Welt',
  explosion: 'wurde in die Luft gesprengt',
  dragon: 'wurde vom Enderdrachen erfasst',
};
const MOB_NAMES_DE = {
  zombie: 'Zombie', skeleton: 'Skelett', creeper: 'Creeper', spider: 'Spinne',
  enderman: 'Enderman', ghast: 'Ghast', slime: 'Slime', witch: 'Hexe',
  wither: 'Wither', dragon: 'Enderdrache', player_remote: 'Spieler',
};
function deathMessage(cause, name) {
  const n = '§e' + name + '§7';
  if (!cause) return n + ' ist gestorben';
  if (cause.startsWith('mob:')) {
    const mob = MOB_NAMES_DE[cause.slice(4)] || 'ein Monster';
    return n + ' wurde von ' + mob + ' getötet';
  }
  if (cause.startsWith('arrow:')) {
    const mob = MOB_NAMES_DE[cause.slice(6)] || 'einem Skelett';
    return n + ' wurde von ' + mob + ' erschossen';
  }
  if (cause.startsWith('explosion:')) return n + ' explodierte';
  const base = DEATH_MSGS[cause];
  return base ? n + ' ' + base : n + ' ist gestorben';
}

// Global game object namespaces (populated by later parts)
const G = {
  blocks: null, world: null, player: null, renderer: null, net: null,
  settings: { renderDist: 7, fov: 70, fpsCap: '240', guiScale: 2, volume: 0.7, music: 0.3, particles: true, clouds: true, smoothLighting: true, bobbing: true, sensitivity: 1.0 },
  state: 'title',           // title | loading | playing | paused | dead | container
  worldName: null, seed: 0, gameMode: 'survival', hardcore: false,
  difficulty: 'normal',     // peaceful | easy | normal | hard  (MC difficulty)
  time: 6000,               // world time in ticks (0=dawn 6000=noon 12000=dusk 18000=midnight)
  rain: 0, thunder: 0,      // weather intensity 0..1
  dimension: 0,             // 0=overworld 1=nether 2=end
  entities: [], particles: [],
  edits: new Map(),         // "dim:x,y,z" -> [id, meta]  (world deltas vs procedural gen, for save/net)
  tileEntities: new Map(),  // "dim:x,y,z" -> {type, ...state}
  advancements: new Set(),
  stats: { mined: 0, placed: 0, crafted: 0, kills: 0, deaths: 0, walked: 0, playedTicks: 0 },
  msgQueue: [], freeCam: false,
};

// seeded per-world RNG streams
G.rng = mulberry32(1);
function rand() { return G.rng(); }
function randInt(a, b) { return a + Math.floor(G.rng() * (b - a + 1)); }
function chance(p) { return G.rng() < p; }
