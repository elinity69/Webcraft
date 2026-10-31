// ============================================================================
// Part 06: Chunk mesher — face culling, AO, all block shapes
// Vertex: x y z u v sky block shade flag  (9 floats)
// ============================================================================
const AO_MULT = [0.45, 0.68, 0.85, 1.0];
const FACE_SHADE = { top: 1.0, bottom: 0.55, north: 0.8, south: 0.8, east: 0.62, west: 0.62 };

class MeshBuf {
  constructor() { this.v = []; this.idx = []; this.nVerts = 0; }
  quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, tileIdx, sky, block, shades, flags, flip) {
    // a=bottom-left, b=bottom-right, c=top-right, d=top-left (CCW facing camera)
    const base = this.nVerts;
    const u0 = (tileIdx % ATLAS_COLS) / ATLAS_COLS;
    // atlas is uploaded with Y flipped → canvas row 0 sits at v≈1;
    // tile (row) spans GL v ∈ [1-(row+1)/32, 1-row/32], tile-image bottom = v0
    const v0 = 1 - (Math.floor(tileIdx / ATLAS_COLS) + 1) / ATLAS_COLS;
    const s = 1 / ATLAS_COLS;
    const u0i = u0 + 0.0008, v0i = v0 + 0.0008, u1i = u0 + s - 0.0008, v1i = v0 + s - 0.0008;
    // per-vertex light: accept scalars or 4-arrays (smooth lighting)
    const sk = Array.isArray(sky) ? sky : [sky, sky, sky, sky];
    const bk = Array.isArray(block) ? block : [block, block, block, block];
    const V = [
      [ax, ay, az, u0i, v0i, sk[0], bk[0], shades[0], flags],
      [bx, by, bz, u1i, v0i, sk[1], bk[1], shades[1], flags],
      [cx, cy, cz, u1i, v1i, sk[2], bk[2], shades[2], flags],
      [dx, dy, dz, u0i, v1i, sk[3], bk[3], shades[3], flags],
    ];
    for (const vv of V) { for (const f of vv) this.v.push(f); }
    // reversed winding: our face vertex order produces inward normals, so emit CW
    if (flip) this.idx.push(base + 1, base + 3, base + 2, base + 2, base + 0, base + 3);
    else this.idx.push(base + 0, base + 2, base + 1, base + 0, base + 3, base + 2);
    this.nVerts += 4;
  }
  build() {
    return {
      v: new Float32Array(this.v),
      idx: new Uint32Array(this.idx),
      count: this.idx.length,
    };
  }
}

const Mesher = {
  build(world, chunk) {
    const opaque = new MeshBuf();
    const trans = new MeshBuf();
    const x0 = chunk.cx * CH, z0 = chunk.cz * CH;
    const blocks = chunk.blocks, metaArr = chunk.meta;

    // padded caches (x/z: -1..CH) — one sequential pass, then O(1) reads for
    // the whole build (smooth lighting does thousands of neighbor reads)
    const PW = CH + 2;
    let chunkTop = 0;
    if (chunk.heightmap) { for (let i = 0; i < 256; i++) chunkTop = Math.max(chunkTop, chunk.heightmap[i]); }
    const PH = Math.min(WORLD_H, chunkTop + 3); // cache only up to the top — 3x less work
    const pIdx = (x, y, z) => (y * PW + (z + 1)) * PW + (x + 1);
    const pBlocks = new Uint16Array(PW * PH * PW);
    const pMeta = new Uint8Array(PW * PH * PW);
    const pLight = new Uint8Array(PW * PH * PW);
    for (let y = 0; y < PH; y++) {
      for (let z = -1; z < CH + 1; z++) {
        for (let x = -1; x < CH + 1; x++) {
          const inCh = x >= 0 && x < CH && z >= 0 && z < CH;
          const i = pIdx(x, y, z);
          if (inCh) {
            const ci = idx3(x, y, z);
            pBlocks[i] = blocks[ci];
            pMeta[i] = metaArr[ci];
            pLight[i] = chunk.light[ci];
          } else if (y >= 0 && y < WORLD_H) {
            const bid = world.getBlock(x0 + x, y, z0 + z);
            // ungenerated neighbor (-1) → air: a Uint16Array would wrap -1 to 65535
            pBlocks[i] = bid < 0 ? 0 : bid;
            pMeta[i] = world.getMeta(x0 + x, y, z0 + z);
            pLight[i] = world.getLight(x0 + x, y, z0 + z);
          } else {
            pBlocks[i] = y < 0 ? B.bedrock : 0;
            pLight[i] = 0xF0; // above-ground air: full skylight
          }
        }
      }
    }
    const gb = (x, y, z) => {
      if (y < 0) return B.bedrock;
      if (y >= WORLD_H) return 0;
      if (x >= -1 && x <= CH && z >= -1 && z <= CH) return pBlocks[pIdx(x, y, z)];
      return world.getBlock(x0 + x, y, z0 + z);
    };
    const gm = (x, y, z) => {
      if (y < 0 || y >= WORLD_H) return 0;
      if (x >= -1 && x <= CH && z >= -1 && z <= CH) return pMeta[pIdx(x, y, z)];
      return world.getMeta(x0 + x, y, z0 + z);
    };
    const opaqueAt = (x, y, z) => { const id = gb(x, y, z); return id > 0 && BLOCKS[id].opaque; };
    const _lt = [0, 0];
    const lightAt = (x, y, z, out) => {
      const o = out || _lt;
      const c = (x >= -1 && x <= CH && z >= -1 && z <= CH && y >= 0 && y < WORLD_H)
        ? pLight[pIdx(x, y, z)]
        : world.getLight(x0 + x, y, z0 + z);
      o[0] = (c >> 4) / 15; o[1] = (c & 15) / 15;
      return o;
    };

    const yTop = Math.min(WORLD_H - 1, chunkTop + 1);
    for (let y = 0; y <= yTop; y++) {
      for (let lz = 0; lz < CH; lz++) {
        for (let lx = 0; lx < CH; lx++) {
          const id = blocks[idx3(lx, y, lz)];
          if (id === 0) continue;
          const bl = BLOCKS[id];
          if (bl.shape === 'none') continue;
          const m = metaArr[idx3(lx, y, lz)];
          this.emitBlock(bl, id, m, lx, y, lz, gb, gm, opaqueAt, lightAt, opaque, trans, world, x0, z0);
        }
      }
    }
    return { opaque: opaque.build(), trans: trans.build() };
  },

  tileOf(bl, face, m) { return TEX.tileIndex(TEX.faceTile(bl.id, face, m)); },

  emitBlock(bl, id, m, x, y, z, gb, gm, opaqueAt, lightAt, opaque, trans, world, x0, z0) {
    const shape = bl.shape;
    const wx = x0 + x, wz = z0 + z;
    const isTrans = bl.fluid || bl.key === 'ice' || bl.key === 'nether_portal' || bl.key === 'end_portal';
    const mesh = isTrans ? trans : opaque;

    // light helper for a face direction
    const faceLight = (dx, dy, dz) => {
      const [s, b] = lightAt(x + dx, y + dy, z + dz);
      return [s, b];
    };
    const solidAO = (xx, yy, zz) => (opaqueAt(xx, yy, zz) ? 1 : 0);
    const ao4 = (dx, dy, dz) => {
      // returns 4 corner AO values for a face pointing (dx,dy,dz)
      const out = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) out[c] = 1;
      return out;
    };

    switch (shape) {
      case 'cube': case 'farmland': case 'snow': case 'chestbox': case 'enchant': case 'egg': case 'cactus': case 'frame': {
        let h0 = 0, h1 = 1, inset = 0;
        if (shape === 'farmland') h1 = 15 / 16;
        else if (shape === 'snow') h1 = 2 / 16;
        else if (shape === 'chestbox') { h1 = 14 / 16; inset = 1 / 16; }
        else if (shape === 'enchant') h1 = 12 / 16;
        else if (shape === 'cactus') inset = 1 / 16;
        else if (shape === 'egg') { h1 = 15 / 16; inset = .5 / 16; }
        else if (shape === 'frame') { h1 = 13 / 16; inset = 0; }
        const e0 = inset, e1 = 1 - inset;
        const faces = [
          { d: [0, 1, 0], f: 'top' }, { d: [0, -1, 0], f: 'bottom' },
          { d: [0, 0, -1], f: 'north' }, { d: [0, 0, 1], f: 'south' },
          { d: [1, 0, 0], f: 'east' }, { d: [-1, 0, 0], f: 'west' },
        ];
        for (const { d, f } of faces) {
          const nid = gb(x + d[0], y + d[1], z + d[2]);
          if (nid > 0) {
            const nbl = BLOCKS[nid];
            if (nbl.opaque) continue;
            if (nbl.fluid && bl.fluid) continue;      // fluid-fluid cull
            if (nid === id && (bl.key === 'glass' || bl.key === 'ice' || bl.key === 'nether_portal')) continue;
            if (bl.key === 'cactus' && nbl.key === 'cactus') continue;
          }
          // Resolve directional front face (0=south(+z), 1=west(-x), 2=north(-z), 3=east(+x))
          let faceRole = f;
          if (f === 'north' || f === 'south' || f === 'east' || f === 'west') {
            if (bl.faces && bl.faces.front) {
              if (bl.key === 'crafting_table') {
                faceRole = (f === 'north' || f === 'south') ? 'front' : 'side';
              } else {
                const frontDir = ['south', 'west', 'north', 'east'][m & 3];
                faceRole = (f === frontDir) ? 'front' : 'side';
              }
            } else {
              faceRole = 'side';
            }
          }
          const tile = this.tileOf(bl, faceRole, m);
          const fs = FACE_SHADE[f];
          // AO & smooth lighting for the 4 corners matching exact emitFace vertex order [a,b,c,d]
          const [dx, dy, dz] = d;
          let u, v;
          if (dy !== 0) { u = [1, 0, 0]; v = [0, 0, 1]; }
          else if (dz !== 0) { u = [1, 0, 0]; v = [0, 1, 0]; }
          else { u = [0, 0, 1]; v = [0, 1, 0]; }
          const corners = [], skyArr = [], blkArr = [];
          const gridL = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
          const gridO = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
          for (let gu = -1; gu <= 1; gu++) for (let gv = -1; gv <= 1; gv++) {
            const cxx = x + dx + u[0] * gu + v[0] * gv;
            const cyy = y + dy + u[1] * gu + v[1] * gv;
            const czz = z + dz + u[2] * gu + v[2] * gv;
            const nid = gb(cxx, cyy, czz);
            const opq = nid > 0 && BLOCKS[nid].opaque;
            gridO[gu + 1][gv + 1] = opq ? 1 : 0;
            const l = lightAt(cxx, cyy, czz);
            gridL[gu + 1][gv + 1] = opq ? 0 : (l[0] * 15) * 16 + (l[1] * 15);
          }
          // Match exact [su, sv] order of emitFace(a, b, c, d) for each face normal
          let cornerUVs;
          if (dy === 1 || dz === -1 || dx === 1) {
            cornerUVs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
          } else if (dy === -1) {
            cornerUVs = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
          } else {
            // dz === 1 (south) or dx === -1 (west): a=(+1,-1), b=(-1,-1), c=(-1,+1), d=(+1,+1)
            cornerUVs = [[1, -1], [-1, -1], [-1, 1], [1, 1]];
          }
          for (const [su, sv] of cornerUVs) {
            const side1 = gridO[1 + su][1], side2 = gridO[1][1 + sv], corn = gridO[1 + su][1 + sv];
            const ao = (side1 && side2) ? 0 : 3 - (side1 + side2 + corn);
            corners.push(AO_MULT[ao] * fs);
            let sSum = 0, bSum = 0;
            for (const [ou, ov] of [[0, 0], [su, 0], [0, sv], [su, sv]]) {
              const packed = gridL[1 + ou][1 + ov];
              sSum += ((packed / 16) | 0) / 15;
              bSum += (packed % 16) / 15;
            }
            skyArr.push(sSum / 4);
            blkArr.push(bSum / 4);
          }
          this.emitFace(mesh, x, y, z, d, e0, h0, e1, h1, tile, skyArr, blkArr, corners, 0);
        }
        break;
      }
      case 'slab': {
        const e = bl.variant ? 0 : 0;
        const faces = [
          { d: [0, 1, 0], f: 'top' }, { d: [0, -1, 0], f: 'bottom' },
          { d: [0, 0, -1], f: 'north' }, { d: [0, 0, 1], f: 'south' },
          { d: [1, 0, 0], f: 'east' }, { d: [-1, 0, 0], f: 'west' },
        ];
        for (const { d, f } of faces) {
          const nid = gb(x + d[0], y + d[1], z + d[2]);
          if (nid > 0 && BLOCKS[nid].opaque) continue;
          if (f === 'top' && nid === id) continue;
          const tile = this.tileOf(bl, f === 'north' || f === 'south' || f === 'east' || f === 'west' ? 'side' : f, m);
          const [sky, blk] = faceLight(d[0], d[1], d[2]);
          const fs = FACE_SHADE[f];
          this.emitFace(mesh, x, y, z, d, 0, 0, 1, .5, tile, sky, blk, [fs, fs, fs, fs], 0);
        }
        break;
      }
      case 'stairs': {
        // meta bits0-1 = facing (0=+z, 1=-x, 2=-z, 3=+x: the high half), bit3 = top-half (ignored visually for now)
        const [sky, blk] = lightAt(x, y, z);
        const f = m & 3;
        const tile = this.tileOf(bl, 'side', m);
        const tileTop = this.tileOf(bl, 'top', m);
        // bottom slab across the whole footprint
        this.boxMesh(mesh, x, y, z, 0, 0, 0, 1, 0.5, 1, tileTop, sky, blk, [1, 1, 1, 1], tile);
        // upper half on the high side
        if (f === 0) this.boxMesh(mesh, x, y, z, 0, 0.5, 0.5, 1, 1, 1, tileTop, sky, blk, [1, 1, 1, 1], tile);
        else if (f === 1) this.boxMesh(mesh, x, y, z, 0, 0.5, 0, 0.5, 1, 1, tileTop, sky, blk, [1, 1, 1, 1], tile);
        else if (f === 2) this.boxMesh(mesh, x, y, z, 0, 0.5, 0, 1, 1, 0.5, tileTop, sky, blk, [1, 1, 1, 1], tile);
        else this.boxMesh(mesh, x, y, z, 0.5, 0.5, 0, 1, 1, 1, tileTop, sky, blk, [1, 1, 1, 1], tile);
        break;
      }
      case 'brewing': {
        const tile = this.tileOf(bl, 'all', m);
        const [sky, blk] = lightAt(x, y, z);
        // base rod + knob + side arms (MC-like silhouette)
        this.boxMesh(mesh, x, y, z, 7 / 16, 0, 7 / 16, 9 / 16, 11 / 16, 9 / 16, tile, sky, blk, [1, 1, 1, 1]);
        this.boxMesh(mesh, x, y, z, 6 / 16, 11 / 16, 6 / 16, 10 / 16, 13 / 16, 10 / 16, tile, sky, blk, [1, 1, 1, 1]);
        this.boxMesh(mesh, x, y, z, 2 / 16, 2 / 16, 6 / 16, 7 / 16, 7 / 16, 10 / 16, tile, sky, blk, [1, 1, 1, 1]);
        this.boxMesh(mesh, x, y, z, 9 / 16, 2 / 16, 6 / 16, 14 / 16, 7 / 16, 10 / 16, tile, sky, blk, [1, 1, 1, 1]);
        break;
      }
      case 'anvil': {
        const tileTop = this.tileOf(bl, 'top', m);
        const tileSide = this.tileOf(bl, 'side', m);
        const tileBase = TEX.tileIndex(TEX.faceTile(bl.id, 'bottom', m));
        const [sky, blk] = lightAt(x, y, z);
        this.boxMesh(mesh, x, y, z, 2 / 16, 0, 2 / 16, 14 / 16, 4 / 16, 14 / 16, tileBase, sky, blk, [1, 1, 1, 1]);   // base
        this.boxMesh(mesh, x, y, z, 5 / 16, 4 / 16, 6 / 16, 11 / 16, 10 / 16, 10 / 16, tileSide, sky, blk, [1, 1, 1, 1]); // neck
        this.boxMesh(mesh, x, y, z, 1 / 16, 10 / 16, 4 / 16, 15 / 16, 14 / 16, 12 / 16, tileTop, sky, blk, [1, 1, 1, 1]); // face
        break;
      }
      case 'sign': {
        const tile = this.tileOf(bl, 'all', m);
        const [sky, blk] = lightAt(x, y, z);
        const f = m & 3;
        this.boxMesh(mesh, x, y, z, 7 / 16, 0, 7 / 16, 9 / 16, 7 / 16, 9 / 16, tile, sky, blk, [1, 1, 1, 1]); // post
        // board faces the player direction (f: 0=+z,1=-x,2=-z,3=+x)
        if (f === 0) this.boxMesh(mesh, x, y, z, 1 / 16, 7 / 16, 11 / 16, 15 / 16, 15 / 16, 14 / 16, tile, sky, blk, [1, 1, 1, 1]);
        else if (f === 2) this.boxMesh(mesh, x, y, z, 1 / 16, 7 / 16, 2 / 16, 15 / 16, 15 / 16, 5 / 16, tile, sky, blk, [1, 1, 1, 1]);
        else if (f === 1) this.boxMesh(mesh, x, y, z, 11 / 16, 7 / 16, 1 / 16, 14 / 16, 15 / 16, 15 / 16, tile, sky, blk, [1, 1, 1, 1]);
        else this.boxMesh(mesh, x, y, z, 2 / 16, 7 / 16, 1 / 16, 5 / 16, 15 / 16, 15 / 16, tile, sky, blk, [1, 1, 1, 1]);
        break;
      }
      case 'rail_flat': {
        const tile = this.tileOf(bl, 'all', m);
        const [sky, blk] = lightAt(x, y, z);
        const h = 1 / 32;
        mesh.quad(x, y + h, z, x + 1, y + h, z, x + 1, y + h, z + 1, x, y + h, z + 1, tile, sky, blk, [1, 1, 1, 1], 0, false);
        mesh.quad(x + 1, y + h - 0.001, z + 1, x + 1, y + h - 0.001, z, x, y + h - 0.001, z, x, y + h - 0.001, z + 1, tile, sky, blk, [1, 1, 1, 1], 0, false);
        break;
      }
      case 'liquid': {
        const level = m === 0 ? 0 : (m & 7);
        const falling = (m & 8) !== 0;
        const topH = falling ? 1 : (level === 0 ? 14 / 16 : (8 - level) / 9);
        const aboveId = gb(x, y + 1, z);
        const aboveSame = aboveId > 0 && BLOCKS[aboveId].fluid === bl.fluid;
        const th = aboveSame ? 1 : topH;
        const [sky, blk] = lightAt(x, y, z);
        const tile = this.tileOf(bl, 'top', m);
        // top face
        if (!aboveSame) {
          mesh.quad(x, y + th, z, x + 1, y + th, z, x + 1, y + th, z + 1, x, y + th, z + 1,
            tile, sky, blk, [1, 1, 1, 1], 1, false);
        }
        // neighbor top height helper (same fluid → exposed strip logic)
        const fluidTop = (nx, ny, nz) => {
          const nm = gm(nx, ny, nz);
          const nAbove = gb(nx, ny + 1, nz);
          const nAboveSame = nAbove > 0 && BLOCKS[nAbove].fluid === bl.fluid;
          if (nAboveSame) return 1;
          const nFalling = (nm & 8) !== 0;
          const nLevel = nm === 0 ? 0 : (nm & 7);
          return nFalling ? 1 : (nLevel === 0 ? 14 / 16 : (8 - nLevel) / 9);
        };
        // side & bottom faces
        const sides = [
          { d: [0, -1, 0], f: 'bottom' }, { d: [0, 0, -1], f: 'north' },
          { d: [0, 0, 1], f: 'south' }, { d: [1, 0, 0], f: 'east' }, { d: [-1, 0, 0], f: 'west' },
        ];
        for (const { d, f } of sides) {
          const nid = gb(x + d[0], y + d[1], z + d[2]);
          let y0 = 0, y1 = th, flags = 0, skip = false;
          if (nid > 0) {
            const nbl = BLOCKS[nid];
            if (nbl.opaque) skip = true;
            else if (nbl.fluid === bl.fluid) {
              // same fluid: render only the exposed strip between the two heights
              const nth = fluidTop(x + d[0], y + d[1], z + d[2]);
              if (nth >= th) skip = true;
              else {
                y0 = nth;
                // surface strips ride the same wave as the top face so the seam
                // never opens while the surface bobs
                if (!aboveSame && d[1] === 0) flags = 1;
              }
            }
          }
          if (skip) continue;
          this.emitFace(mesh, x, y, z, d, 0, y0, 1, y1, tile, sky, blk, [FACE_SHADE[f], FACE_SHADE[f], FACE_SHADE[f], FACE_SHADE[f]], flags);
        }
        break;
      }
      case 'cross': case 'reed': {
        const tile = this.tileOf(bl, 'all', m);
        const [sky, blk] = lightAt(x, y, z);
        const flag = bl.key === 'fire' ? 0 : 0;
        const h = 1;
        mesh.quad(x + .07, y, z + .07, x + .93, y, z + .93, x + .93, y + h, z + .93, x + .07, y + h, z + .07, tile, sky, blk, [.95, .95, .95, .95], flag, false);
        mesh.quad(x + .93, y, z + .07, x + .07, y, z + .93, x + .07, y + h, z + .93, x + .93, y + h, z + .07, tile, sky, blk, [.95, .95, .95, .95], flag, false);
        mesh.quad(x + .93, y, z + .93, x + .07, y, z + .07, x + .07, y + h, z + .07, x + .93, y + h, z + .93, tile, sky, blk, [.85, .85, .85, .85], flag, false);
        mesh.quad(x + .07, y, z + .93, x + .93, y, z + .07, x + .93, y + h, z + .07, x + .07, y + h, z + .93, tile, sky, blk, [.85, .85, .85, .85], flag, false);
        break;
      }
      case 'crop': {
        const tile = this.tileOf(bl, 'all', m);
        const [sky, blk] = lightAt(x, y, z);
        for (const px of [4 / 16, 12 / 16]) {
          mesh.quad(x + px, y, z, x + px, y, z + 1, x + px, y + 1, z + 1, x + px, y + 1, z, tile, sky, blk, [1, 1, 1, 1], 0, false);
          mesh.quad(x + px + 0.001, y, z + 1, x + px + 0.001, y, z, x + px + 0.001, y + 1, z, x + px + 0.001, y + 1, z + 1, tile, sky, blk, [1, 1, 1, 1], 0, false);
        }
        for (const pz of [4 / 16, 12 / 16]) {
          mesh.quad(x, y, z + pz, x + 1, y, z + pz, x + 1, y + 1, z + pz, x, y + 1, z + pz, tile, sky, blk, [1, 1, 1, 1], 0, false);
          mesh.quad(x + 1, y, z + pz + 0.001, x, y, z + pz + 0.001, x, y + 1, z + pz + 0.001, x + 1, y + 1, z + pz + 0.001, tile, sky, blk, [1, 1, 1, 1], 0, false);
        }
        break;
      }
      case 'torch': {
        const tile = this.tileOf(bl, 'all', m);
        const [sky, blk] = lightAt(x, y, z);
        const w = 1 / 16;
        let cx = .5, cz = .5, cy = 0;
        const attach = m & 7;
        if (attach === 1) { cx = .5 - 5 / 16; }        // east wall
        else if (attach === 2) { cx = .5 + 5 / 16; }
        else if (attach === 3) { cz = .5 - 5 / 16; }
        else if (attach === 4) { cz = .5 + 5 / 16; }
        // small vertical box
        const h = 10 / 16;
        this.boxMesh(mesh, x, y, z, cx - w, 0, cz - w, cx + w, h, cz + w, tile, sky, blk, [.95, .95, .95, .95]);
        break;
      }
      case 'ladder': {
        const tile = this.tileOf(bl, 'all', m);
        const [sky, blk] = lightAt(x, y, z);
        const d = m & 3; // 0=south(+z) 1=west(-x) 2=north(-z) 3=east(+x)
        const t = 1 / 16;
        if (d === 0) mesh.quad(x + 1, y, z + t, x, y, z + t, x, y + 1, z + t, x + 1, y + 1, z + t, tile, sky, blk, [.9, .9, .9, .9], 0, false);
        else if (d === 2) mesh.quad(x, y, z + 1 - t, x + 1, y, z + 1 - t, x + 1, y + 1, z + 1 - t, x, y + 1, z + 1 - t, tile, sky, blk, [.9, .9, .9, .9], 0, false);
        else if (d === 3) mesh.quad(x + t, y, z + 1, x + t, y, z, x + t, y + 1, z, x + t, y + 1, z + 1, tile, sky, blk, [.9, .9, .9, .9], 0, false);
        else mesh.quad(x + 1 - t, y, z, x + 1 - t, y, z + 1, x + 1 - t, y + 1, z + 1, x + 1 - t, y + 1, z, tile, sky, blk, [.9, .9, .9, .9], 0, false);
        break;
      }
      case 'fence': {
        const tile = this.tileOf(bl, 'side', m);
        const [sky, blk] = lightAt(x, y, z);
        this.boxMesh(mesh, x, y, z, 6 / 16, 0, 6 / 16, 10 / 16, 1, 10 / 16, tile, sky, blk, [1, 1, 1, 1]);
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dz] of dirs) {
          const nid = gb(x + dx, y, z + dz);
          const isF = nid > 0 && (BLOCKS[nid].shape === 'fence' || BLOCKS[nid].opaque || BLOCKS[nid].key.includes('_door'));
          if (!isF) continue;
          if (dx === 1) this.boxMesh(mesh, x, y, z, 10 / 16, 12 / 16, 7 / 16, 1, 15 / 16, 9 / 16, tile, sky, blk, [1, 1, 1, 1]);
          if (dx === 1) this.boxMesh(mesh, x, y, z, 10 / 16, 6 / 16, 7 / 16, 1, 9 / 16, 9 / 16, tile, sky, blk, [1, 1, 1, 1]);
          if (dx === -1) this.boxMesh(mesh, x, y, z, 0, 12 / 16, 7 / 16, 6 / 16, 15 / 16, 9 / 16, tile, sky, blk, [1, 1, 1, 1]);
          if (dx === -1) this.boxMesh(mesh, x, y, z, 0, 6 / 16, 7 / 16, 6 / 16, 9 / 16, 9 / 16, tile, sky, blk, [1, 1, 1, 1]);
          if (dz === 1) this.boxMesh(mesh, x, y, z, 7 / 16, 12 / 16, 10 / 16, 9 / 16, 15 / 16, 1, tile, sky, blk, [1, 1, 1, 1]);
          if (dz === 1) this.boxMesh(mesh, x, y, z, 7 / 16, 6 / 16, 10 / 16, 9 / 16, 9 / 16, 1, tile, sky, blk, [1, 1, 1, 1]);
          if (dz === -1) this.boxMesh(mesh, x, y, z, 7 / 16, 12 / 16, 0, 9 / 16, 15 / 16, 6 / 16, tile, sky, blk, [1, 1, 1, 1]);
          if (dz === -1) this.boxMesh(mesh, x, y, z, 7 / 16, 6 / 16, 0, 9 / 16, 9 / 16, 6 / 16, tile, sky, blk, [1, 1, 1, 1]);
        }
        break;
      }
      case 'door': {
        const tileTop = TEX.tileIndex(TEX.faceTile(bl.id, 'top', m));
        const tileBot = TEX.tileIndex(TEX.faceTile(bl.id, 'bottom', m));
        const [sky, blk] = lightAt(x, y, z);
        const facing = m & 3, open = (m & 4) !== 0, top = (m & 8) !== 0;
        const tile = top ? tileTop : tileBot;
        const th = 3 / 16;
        // door sits on the facing edge; if open, rotated 90°
        let fx = 0, fz = 0;
        const dir = open ? (facing + 1) % 4 : facing;
        const x0b = dir === 3 ? 0 : dir === 1 ? 1 - th : 0;
        const z0b = dir === 0 ? 1 - th : dir === 2 ? 0 : 0;
        const x1b = dir === 3 ? th : dir === 1 ? 1 : 1;
        const z1b = dir === 0 ? 1 : dir === 2 ? th : 1;
        if (dir === 0) { /* +z */ }
        this.boxMesh(mesh, x, y, z, x0b, 0, z0b, x1b, 1, z1b, tile, sky, blk, [1, 1, 1, 1]);
        break;
      }
      case 'bed': {
        const head = (m & 4) !== 0;
        const [sky, blk] = lightAt(x, y, z);
        const col = bl.key === 'red_bed' ? 'red' : 'white';
        const tTop = TEX.tileIndex('bed_top_' + col), tSide = TEX.tileIndex('bed_side_' + col), tHead = TEX.tileIndex('bed_head_' + col);
        // base box with proper textures per face; head end uses head tile on its front face
        const h = 9 / 16;
        this.boxMesh(mesh, x, y, z, 0, 0, 0, 1, h, 1, tTop, sky, blk, [1, 1, 1, 1], tSide, tHead);
        break;
      }
      case 'pane': {
        const tile = this.tileOf(bl, 'all', m);
        const [sky, blk] = lightAt(x, y, z);
        const cx0 = 7 / 16, cx1 = 9 / 16;
        this.boxMesh(mesh, x, y, z, cx0, 0, cx0, cx1, 1, cx1, tile, sky, blk, [1, 1, 1, 1]);
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dz] of dirs) {
          const nid = gb(x + dx, y, z + dz);
          if (!(nid > 0 && (BLOCKS[nid].shape === 'pane' || BLOCKS[nid].opaque))) continue;
          if (dx === 1) this.boxMesh(mesh, x, y, z, cx1, 0, cx0, 1, 1, cx1, tile, sky, blk, [1, 1, 1, 1]);
          if (dx === -1) this.boxMesh(mesh, x, y, z, 0, 0, cx0, cx0, 1, cx1, tile, sky, blk, [1, 1, 1, 1]);
          if (dz === 1) this.boxMesh(mesh, x, y, z, cx0, 0, cx1, cx1, 1, 1, tile, sky, blk, [1, 1, 1, 1]);
          if (dz === -1) this.boxMesh(mesh, x, y, z, cx0, 0, 0, cx1, 1, cx0, tile, sky, blk, [1, 1, 1, 1]);
        }
        break;
      }
      case 'carpet': {
        const tile = this.tileOf(bl, 'all', m);
        const [sky, blk] = lightAt(x, y, z);
        this.boxMesh(mesh, x, y, z, 0, 0, 0, 1, 1 / 16, 1, tile, sky, blk, [1, 1, 1, 1]);
        break;
      }
      case 'wire': {
        // compute connections
        let conn = 0; // bit0 +x, bit1 -x, bit2 +z, bit3 -z
        for (const [dx, dz, bit] of [[1, 0, 1], [-1, 0, 2], [0, 1, 4], [0, -1, 8]]) {
          const nid = gb(x + dx, y, z + dz);
          if (nid > 0 && (nid === B.redstone_wire || BLOCKS[nid].key.includes('repeater') || BLOCKS[nid].key.includes('torch') || BLOCKS[nid].key.includes('lever') || BLOCKS[nid].key.includes('button') || BLOCKS[nid].key.includes('plate') || BLOCKS[nid].key === 'redstone_block' || BLOCKS[nid].key.includes('lamp'))) conn |= bit;
        }
        const [sky, blk] = lightAt(x, y, z);
        const power = m >> 4;
        const tileDot = TEX.tileIndex(power > 0 ? 'redstone_dot_on' : 'redstone_dot');
        const tileLine = TEX.tileIndex(power > 0 ? 'redstone_line_on' : 'redstone_line');
        const h = 1 / 32;
        const mk = (tile, rot) => {
          const u0 = (tile % ATLAS_COLS) / ATLAS_COLS, v0 = Math.floor(tile / ATLAS_COLS) / ATLAS_COLS;
          if (rot) {
            mesh.quad(x, y + h, z, x + 1, y + h, z, x + 1, y + h, z + 1, x, y + h, z + 1, tile, sky, blk, [1, 1, 1, 1], 0, false);
          } else {
            mesh.quad(x, y + h, z, x + 1, y + h, z, x + 1, y + h, z + 1, x, y + h, z + 1, tile, sky, blk, [1, 1, 1, 1], 0, false);
          }
        };
        const cNS = (conn & 4) || (conn & 8), cEW = (conn & 1) || (conn & 2);
        if (!cNS && !cEW) mk(tileDot);
        else if (cNS && !cEW) mk(tileLine);
        else if (cEW && !cNS) mk(tileLine); // side lines look same-ish rotated; fine
        else { mk(tileLine); }
        break;
      }
      case 'plate': {
        const tile = this.tileOf(bl, 'all', m);
        const [sky, blk] = lightAt(x, y, z);
        const pressed = (m & 1) ? 0.5 / 16 : 1 / 16;
        this.boxMesh(mesh, x, y, z, 1 / 16, 0, 1 / 16, 15 / 16, pressed, 15 / 16, tile, sky, blk, [1, 1, 1, 1]);
        break;
      }
      case 'button': {
        const tile = this.tileOf(bl, 'all', m);
        const [sky, blk] = lightAt(x, y, z);
        this.boxMesh(mesh, x, y, z, 6 / 16, 0, 5 / 16, 10 / 16, 3 / 16, 11 / 16, tile, sky, blk, [1, 1, 1, 1]);
        break;
      }
      case 'lever': {
        const tBase = TEX.tileIndex('lever');
        const [sky, blk] = lightAt(x, y, z);
        this.boxMesh(mesh, x, y, z, 4 / 16, 0, 6 / 16, 12 / 16, 3 / 16, 10 / 16, tBase, sky, blk, [1, 1, 1, 1]);
        this.boxMesh(mesh, x, y, z, 7 / 16, 3 / 16, 7 / 16, 9 / 16, 11 / 16, 9 / 16, tBase, sky, blk, [.9, .9, .9, .9]);
        break;
      }
      case 'repeater': {
        const tTop = TEX.tileIndex('repeater_top'), tSide = TEX.tileIndex('smooth_stone');
        const [sky, blk] = lightAt(x, y, z);
        this.boxMesh(mesh, x, y, z, 0, 0, 0, 1, 2 / 16, 1, tTop, sky, blk, [1, 1, 1, 1], tSide);
        break;
      }
      case 'portal': {
        const tile = this.tileOf(bl, 'all', m);
        const [sky, blk] = lightAt(x, y, z);
        const axis = m & 1; // 0 = x-plane, 1 = z-plane
        if (axis === 0) {
          mesh.quad(x, y, z + .5, x + 1, y, z + .5, x + 1, y + 1, z + .5, x, y + 1, z + .5, tile, sky, blk, [1, 1, 1, 1], 2, false);
          mesh.quad(x + 1, y, z + .5, x, y, z + .5, x, y + 1, z + .5, x + 1, y + 1, z + .5, tile, sky, blk, [1, 1, 1, 1], 2, false);
        } else {
          mesh.quad(x + .5, y, z, x + .5, y, z + 1, x + .5, y + 1, z + 1, x + .5, y + 1, z, tile, sky, blk, [1, 1, 1, 1], 2, false);
          mesh.quad(x + .5, y, z + 1, x + .5, y, z, x + .5, y + 1, z, x + .5, y + 1, z + 1, tile, sky, blk, [1, 1, 1, 1], 2, false);
        }
        break;
      }
      case 'fire': {
        const tile = this.tileOf(bl, 'all', m);
        const [sky, blk] = lightAt(x, y, z);
        mesh.quad(x + .1, y, z + .1, x + .9, y, z + .9, x + .9, y + .95, z + .9, x + .1, y + .95, z + .1, tile, sky, blk, [1, 1, 1, 1], 0, false);
        mesh.quad(x + .9, y, z + .1, x + .1, y, z + .9, x + .1, y + .95, z + .9, x + .9, y + .95, z + .1, tile, sky, blk, [1, 1, 1, 1], 0, false);
        break;
      }
      default: break;
    }
  },

  emitFace(mesh, x, y, z, d, e0, h0, e1, h1, tile, sky, blk, shades, flags) {
    const [dx, dy, dz] = d;
    if (dy === 1) {
      mesh.quad(x + e0, y + h1, z + e0, x + e1, y + h1, z + e0, x + e1, y + h1, z + e1, x + e0, y + h1, z + e1, tile, sky, blk, shades, flags, false);
    } else if (dy === -1) {
      mesh.quad(x + e0, y + h0, z + e0, x + e0, y + h0, z + e1, x + e1, y + h0, z + e1, x + e1, y + h0, z + e0, tile, sky, blk, shades, flags, false);
    } else if (dz === -1) {
      mesh.quad(x + e0, y + h0, z + e0, x + e1, y + h0, z + e0, x + e1, y + h1, z + e0, x + e0, y + h1, z + e0, tile, sky, blk, shades, flags, false);
    } else if (dz === 1) {
      mesh.quad(x + e1, y + h0, z + e1, x + e0, y + h0, z + e1, x + e0, y + h1, z + e1, x + e1, y + h1, z + e1, tile, sky, blk, shades, flags, false);
    } else if (dx === 1) {
      mesh.quad(x + e1, y + h0, z + e0, x + e1, y + h0, z + e1, x + e1, y + h1, z + e1, x + e1, y + h1, z + e0, tile, sky, blk, shades, flags, false);
    } else if (dx === -1) {
      mesh.quad(x + e0, y + h0, z + e1, x + e0, y + h0, z + e0, x + e0, y + h1, z + e0, x + e0, y + h1, z + e1, tile, sky, blk, shades, flags, false);
    }
  },

  // small helper box (all faces, no culling) with optional separate side/top tiles
  boxMesh(mesh, x, y, z, x0, y0, z0, x1, y1, z1, tileTop, sky, blk, shades, tileSide, tileHead) {
    const ts = tileSide !== undefined ? tileSide : tileTop;
    const sides = [
      { d: [0, 1, 0], t: tileTop }, { d: [0, -1, 0], t: ts },
      { d: [0, 0, -1], t: ts }, { d: [0, 0, 1], t: ts }, { d: [1, 0, 0], t: ts }, { d: [-1, 0, 0], t: ts },
    ];
    for (const { d, t } of sides) {
      const [dx, dy, dz] = d;
      if (dy === 1) mesh.quad(x + x0, y + y1, z + z0, x + x1, y + y1, z + z0, x + x1, y + y1, z + z1, x + x0, y + y1, z + z1, t, sky, blk, shades, 0, false);
      else if (dy === -1) mesh.quad(x + x0, y + y0, z + z0, x + x0, y + y0, z + z1, x + x1, y + y0, z + z1, x + x1, y + y0, z + z0, t, sky, blk, shades, 0, false);
      else if (dz === -1) mesh.quad(x + x0, y + y0, z + z0, x + x1, y + y0, z + z0, x + x1, y + y1, z + z0, x + x0, y + y1, z + z0, t, sky, blk, shades, 0, false);
      else if (dz === 1) mesh.quad(x + x1, y + y0, z + z1, x + x0, y + y0, z + z1, x + x0, y + y1, z + z1, x + x1, y + y1, z + z1, t, sky, blk, shades, 0, false);
      else if (dx === 1) mesh.quad(x + x1, y + y0, z + z0, x + x1, y + y0, z + z1, x + x1, y + y1, z + z1, x + x1, y + y1, z + z0, t, sky, blk, shades, 0, false);
      else mesh.quad(x + x0, y + y0, z + z1, x + x0, y + y0, z + z0, x + x0, y + y1, z + z0, x + x0, y + y1, z + z1, t, sky, blk, shades, 0, false);
    }
  },
};
