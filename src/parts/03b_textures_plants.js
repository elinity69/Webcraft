// ============================================================================
// Part 03b: plants, fluids, redstone, wool, beds, portals, destroy stages
// ============================================================================

// ---------- Plants (cross shapes, transparent) ----------
const plantStem = (t, stemC) => { for (let i = 0; i < 7; i++) { const x = 5 + ((t.rng() * 6) | 0); t.vline(x, 6 + i, 15, stemC); } };
TP('short_grass', t => {
  t.clear();
  const g1 = C('#5faa38'), g2 = C('#4c8f2a');
  for (let i = 0; i < 9; i++) {
    const x = 1 + ((t.rng() * 14) | 0), h = 5 + ((t.rng() * 8) | 0);
    for (let y = 15; y > 15 - h; y--) t.px(x + (y < 15 - h + 2 ? (t.rng() < .3 ? 1 : 0) : 0), y, t.rng() < .5 ? g1 : g2);
  }
});
TP('fern', t => {
  t.clear();
  const g1 = C('#4a8f2e'), g2 = C('#3a7322');
  t.vline(8, 4, 15, g2);
  for (let y = 5; y < 15; y += 2) {
    const w = (15 - y) / 3;
    t.rect(8 - w, y, w, 1, g1); t.rect(9, y, w, 1, sh(g1, .85));
  }
});
TP('dead_bush', t => {
  t.clear();
  const b1 = C('#946428'), b2 = C('#6e4a1c');
  t.vline(8, 5, 15, b2);
  for (let i = 0; i < 8; i++) {
    const y0 = 4 + ((t.rng() * 9) | 0);
    const dir = t.rng() < .5 ? -1 : 1, len = 2 + ((t.rng() * 4) | 0);
    for (let j = 0; j < len; j++) t.px(8 + dir * j, y0 - j, t.rng() < .5 ? b1 : b2);
  }
});
const flowerTile = (name, petal, center, petalShape) => TP(name, t => {
  t.clear();
  const stem = C('#3a7322');
  t.vline(7, 8, 15, stem); t.px(6, 11, stem); t.px(8, 13, stem);
  t.rect(5, 11, 2, 1, C('#4a8f2e')); t.rect(8, 12, 2, 1, C('#4a8f2e'));
  if (petalShape === 'round') {
    t.rect(5, 3, 5, 5, petal);
    t.rect(4, 4, 7, 3, petal);
    t.rect(4, 5, 7, 1, sh(petal, .85));
    t.rect(6, 5, 3, 2, center);
  } else if (petalShape === 'tulip') {
    t.rect(5, 3, 5, 5, petal); t.rect(6, 2, 3, 1, sh(petal, 1.15));
    t.rect(7, 3, 1, 2, sh(petal, .7)); t.rect(5, 8, 5, 1, C('#3a7322'));
  } else { // petals around center
    t.rect(6, 2, 4, 4, petal);
    t.px(5, 3, petal); t.px(10, 3, petal); t.px(5, 5, petal); t.px(10, 5, petal);
    t.rect(7, 3, 2, 2, center);
  }
});
flowerTile('dandelion', C('#f5e93f'), C('#e8c72a'), 'round');
flowerTile('poppy', C('#d43a2a'), C('#2e2e2e'), 'round');
flowerTile('blue_orchid', C('#3fc2e8'), C('#c8e8f0'), 'round');
flowerTile('allium', C('#b57edc'), C('#e8d0f5'), 'round');
flowerTile('cornflower', C('#4a6ae0'), C('#8a9af0'), 'tulip');
flowerTile('oxeye_daisy', C('#f0f0f0'), C('#f5d93f'), 'round');
flowerTile('red_tulip', C('#d43a2a'), C('#2e2e2e'), 'tulip');
TP('red_mushroom', t => {
  t.clear();
  t.rect(6, 9, 3, 5, C('#e8d5b5'));
  t.rect(4, 4, 8, 5, C('#c62d2d'));
  t.rect(3, 5, 10, 3, C('#c62d2d'));
  t.px(5, 5, C('#f0f0f0')); t.px(9, 6, C('#f0f0f0')); t.px(6, 7, C('#f0f0f0')); t.px(10, 4, C('#f0f0f0'));
});
TP('brown_mushroom', t => {
  t.clear();
  t.rect(6, 9, 3, 5, C('#e8d5b5'));
  t.rect(4, 4, 8, 5, C('#9a7450'));
  t.rect(3, 5, 10, 3, sh(C('#9a7450'), .9));
  t.px(5, 5, sh(C('#9a7450'), 1.2)); t.px(9, 6, sh(C('#9a7450'), 1.2));
});
TP('cactus_top', t => { t.vary(C('#5a8f2e'), .08); t.rect(4, 4, 8, 8, C('#6ea538')); t.specks(C('#87c04a'), 8); });
TP('cactus_bottom', t => { t.vary(C('#5a8f2e'), .08); });
TP('cactus_side', t => {
  t.fill(C('#5a8f2e'));
  for (let y = 0; y < 16; y += 2) for (let x = 1; x < 16; x += 4) t.px(x, y, C('#87c04a'));
  for (const x of [0, 15]) for (let y = 0; y < 16; y++) if (t.rng() < .7) t.px(x, y, C('#3a6e1a'));
  t.vline(1, 0, 15, sh(C('#5a8f2e'), .85));
});
TP('sugar_cane', t => {
  t.clear();
  const g1 = C('#8fd06a'), g2 = C('#6eb84a');
  for (const x of [3, 8, 12]) {
    t.vline(x, 0, 15, g1); t.vline(x + 1, 0, 15, g2);
    t.px(x, 4, sh(g2, .8)); t.px(x + 1, 9, sh(g2, .8));
  }
});
for (let s = 0; s < 8; s++) {
  TP('wheat_stage' + s, t => {
    t.clear();
    const h = 4 + s * 1.5;
    const green = C('#4a8f2e'), yellow = mixc(C('#4a8f2e'), C('#d8c24a'), s / 7);
    for (const x of [2, 5, 8, 11, 14]) {
      for (let y = 15; y > 15 - h; y--) t.px(x, y, y > 15 - h + 2 ? sh(yellow, .9 + t.rng() * .2) : green);
      if (s >= 6) { t.px(x - 1, 15 - h + 2, yellow); t.px(x + 1, 15 - h + 3, yellow); }
    }
  });
}

// ---------- Wool ----------
const WOOL_HEX = {
  white: '#e9ecec', orange: '#f07613', magenta: '#bd44b3', light_blue: '#3aafd9', yellow: '#f8c527',
  lime: '#70b919', pink: '#ed8dac', gray: '#3e4447', light_gray: '#8e8e86', cyan: '#158991',
  purple: '#792aac', blue: '#35399d', brown: '#724728', green: '#546d1b', red: '#a12722', black: '#141519',
};
for (const c of Object.keys(WOOL_HEX)) {
  TP(c + '_wool', t => {
    const base = C(WOOL_HEX[c]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.px(x, y, sh(base, ((x + y) % 2 ? .96 : 1.03) * (.96 + t.rng() * .08)));
  });
}

// ---------- Beds ----------
const bedTiles = (col) => {
  TP('bed_top_' + col, t => {
    t.fill(C(WOOL_HEX[col] || '#e9ecec'));
    t.rect(0, 0, 16, 5, C('#f0f0f0'));          // pillow
    t.rect(0, 5, 16, 1, sh(C(WOOL_HEX[col]), .7));
    t.vary(C(WOOL_HEX[col]), .05);
  });
  TP('bed_side_' + col, t => {
    t.fill(C(WOOL_HEX[col] || '#e9ecec'));
    t.rect(0, 10, 16, 6, C('#8a6f45'));         // wood base
    t.rect(0, 8, 16, 2, sh(C(WOOL_HEX[col]), .8));
  });
  TP('bed_head_' + col, t => {
    t.fill(C(WOOL_HEX[col] || '#e9ecec'));
    t.rect(0, 10, 16, 6, C('#8a6f45'));
  });
};
bedTiles('white'); bedTiles('red');

// ---------- Fluids ----------
TP('water', t => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const w = Math.sin((x + y * 2) * .8) * .5 + Math.sin(y * 1.3) * .3 + .5;
    // deep, contrasty blue so the surface reads clearly against the sky (MC-style)
    t.px(x, y, mixc(C('#1a44a8'), C('#2e63d6'), w * .7 + t.rng() * .1), 224);
  }
});
TP('lava', t => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const w = Math.sin(x * .9 + Math.sin(y * 1.1) * 2) * .5 + Math.sin((x * .5 + y) * 1.2) * .3 + .5;
    let c = mixc(C('#c33e0a'), C('#ffb92e'), w * .7 + t.rng() * .2);
    t.px(x, y, c);
  }
  t.specks(C('#fff2a8'), 4); t.specks(C('#8a2504'), 6);
});
TP('fire', t => {
  t.clear();
  for (let x = 0; x < 16; x++) {
    const h = 8 + Math.sin(x * 1.2) * 3 + t.rng() * 4;
    for (let y = 15; y > 15 - h; y--) {
      const f = (15 - y) / h;
      const c = f < .3 ? C('#ffd42e') : (f < .6 ? C('#ff9a1f') : C('#e85a0a'));
      t.px(x, y, c, 235);
    }
  }
});
TP('nether_portal', t => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const w = Math.sin(x * 1.4 + y * .6) * .5 + Math.sin(y * 1.8 - x * .4) * .35 + .5;
    const c = mixc(C('#5a1a8a'), C('#c95aff'), w * .8 + t.rng() * .15);
    t.px(x, y, c, 215);
  }
});
TP('end_portal', t => {
  t.fill(C('#050510'));
  for (let i = 0; i < 40; i++) t.px(t.rng() * 16, t.rng() * 16, mixc(C('#8ac8ff'), C('#e0f0ff'), t.rng()), 255);
  for (let i = 0; i < 8; i++) t.px(t.rng() * 16, t.rng() * 16, C('#4a6ae0'));
});
TP('endframe_top', t => { t.vary(C('#dbe08f'), .06); t.rect(4, 4, 8, 8, C('#2a6b5c')); t.rect(6, 6, 4, 4, C('#3fa08a')); });
TP('endframe_side', t => { t.vary(C('#dbe08f'), .06); t.rect(0, 10, 16, 6, sh(C('#dbe08f'), .85)); t.rect(0, 4, 16, 2, C('#2a6b5c')); });
TP('dragon_egg', t => { t.vary(C('#1a0a1e'), .3); t.specks(C('#6a2a8a'), 14); t.borderShade(1.3, .7); });

// ---------- Nether & End ----------
TP('netherrack', t => { t.vary(PAL.nether, .16); t.specks(C('#8f4545'), 14); t.specks(C('#5c2424'), 14); });
TP('soul_sand', t => { t.vary(C('#514038'), .1); for (let i = 0; i < 3; i++) { const x = 2 + t.rng() * 11, y = 2 + t.rng() * 11; t.rect(x, y, 3, 2, C('#3a2d26')); t.px(x + 1, y + 2, C('#6a5a4e')); } });
TP('soul_soil', t => { t.vary(C('#4c3a30'), .12); });
TP('nether_bricks', t => {
  t.fill(C('#2c161a'));
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 0 : 4;
    for (let bx = -1; bx < 3; bx++) t.rect(bx * 8 + off + 1, row * 4 + 1, 7, 3, sh(C('#442026'), .9 + t.rng() * .2));
  }
});
TP('quartz_block', t => { t.vary(C('#ece9e2'), .04); t.borderShade(1.08, .9); t.hline(0, C('#f8f5f0')); });
TP('basalt_side', t => { for (let x = 0; x < 16; x++) { const f = .85 + t.rng() * .3; for (let y = 0; y < 16; y++) t.px(x, y, sh(C('#4c4a4f'), f * (.95 + t.rng() * .1))); } });
TP('basalt_top', t => { t.vary(C('#55535a'), .1); t.rect(3, 3, 10, 10, C('#4c4a4f')); t.rect(6, 6, 4, 4, C('#5c5a62')); });
TP('glowstone', t => { t.vary(C('#b58f42'), .12); t.blobs(C('#f9e75a'), 7, 1, 2.5); t.specks(C('#fff2a8'), 10); });
TP('sea_lantern', t => { t.fill(C('#a8bac8')); t.borderShade(1.1, .85); t.rect(4, 4, 8, 8, C('#d5e8f0')); t.rect(6, 6, 4, 4, C('#f0faff')); t.px(2, 2, C('#d5e8f0')); t.px(13, 13, C('#d5e8f0')); });
TP('magma_block', t => { t.vary(C('#3a2018'), .15); t.blobs(C('#e85a0a'), 6, 1, 2); t.specks(C('#ffb92e'), 8); t.specks(C('#8a2504'), 10); });
TP('end_stone', t => { t.vary(PAL.end, .06); t.specks(C('#c9cf7a'), 12); t.specks(C('#e8ecaa'), 8); });
TP('end_stone_bricks', t => {
  t.fill(PAL.end); t.vary(PAL.end, .04);
  const dk = sh(PAL.end, .75);
  t.hline(7, dk); t.hline(15, dk); t.vline(7, 0, 7, dk); t.vline(15, 0, 7, dk); t.vline(3, 8, 15, dk); t.vline(11, 8, 15, dk);
});
TP('purpur_block', t => { t.vary(C('#a97fa9'), .06); t.blobs(C('#b78fb7'), 5, 1, 2); t.borderShade(1.06, .9); });

// ---------- Redstone ----------
const dustDot = (on) => TP('redstone_dot' + (on ? '_on' : ''), t => {
  t.clear();
  const c = on ? C('#ff2b2b') : C('#6e0f0f');
  t.rect(6, 6, 4, 4, c);
  t.px(5, 7, c); t.px(5, 8, c); t.px(10, 7, c); t.px(10, 8, c);
  t.px(7, 5, c); t.px(8, 5, c); t.px(7, 10, c); t.px(8, 10, c);
  if (on) { t.px(7, 7, C('#ff7a7a')); }
});
const dustLine = (on) => TP('redstone_line' + (on ? '_on' : ''), t => {
  t.clear();
  const c = on ? C('#ff2b2b') : C('#6e0f0f');
  t.rect(0, 6, 16, 4, c);
  t.hline(6, on ? C('#ff6a6a') : C('#8a1a1a')); t.hline(9, on ? C('#c01515') : C('#4a0a0a'));
});
dustDot(true); dustDot(false); dustLine(true); dustLine(false);
TP('redstone_torch', t => {
  t.clear();
  t.rect(7, 8, 2, 8, C('#6b5433'));
  t.rect(7, 5, 2, 3, C('#ff2b2b')); t.rect(7, 4, 2, 1, C('#ff7a7a'));
  t.px(6, 6, C('#c01515')); t.px(9, 6, C('#c01515'));
});
TP('redstone_torch_off', t => {
  t.clear();
  t.rect(7, 8, 2, 8, C('#6b5433'));
  t.rect(7, 5, 2, 3, C('#8a1a1a')); t.rect(7, 4, 2, 1, C('#6e0f0f'));
});
TP('redstone_lamp', t => { t.vary(C('#6e4a2a'), .08); t.rect(3, 3, 10, 10, C('#8a5c34')); t.rect(5, 5, 6, 6, C('#a5743f')); t.borderShade(1.1, .8); });
TP('redstone_lamp_lit', t => { t.vary(C('#c88a3f'), .06); t.rect(3, 3, 10, 10, C('#e8a44a')); t.rect(4, 4, 8, 8, C('#f5c86a')); t.specks(C('#ffe8a8'), 8); t.borderShade(1.15, .9); });
TP('lever', t => {
  t.clear();
  t.rect(3, 12, 10, 3, C('#7d7d7d')); t.borderShade(1.1, .8);
  t.rect(7, 4, 2, 8, C('#8a6f45'));
  t.rect(6, 3, 4, 2, C('#c6b7b7'));
});
TP('stone_button', t => {
  t.clear();
  t.rect(5, 12, 6, 4, C('#7d7d7d')); t.borderShade(1.1, .85);
});
TP('stone_plate', t => { t.clear(); t.rect(1, 13, 14, 3, C('#7d7d7d')); t.rect(2, 12, 12, 1, C('#8d8d8d')); });
TP('oak_plate', t => { t.clear(); t.rect(1, 13, 14, 3, PAL.oak); t.rect(2, 12, 12, 1, sh(PAL.oak, 1.1)); });
TP('repeater_top', t => {
  t.fill(C('#9a9a9a')); t.vary(C('#9a9a9a'), .05);
  t.rect(0, 0, 16, 2, C('#7a7a7a'));
  t.rect(6, 5, 4, 4, C('#b5302a'));
  t.rect(7, 2, 2, 3, C('#6b5433')); t.rect(7, 1, 2, 2, C('#ff2b2b'));
});
TP('repeater_front', t => { t.fill(C('#9a9a9a')); t.vary(C('#9a9a9a'), .05); t.rect(6, 5, 4, 4, C('#777')); });

// ---------- Brewing stand, anvil, rail, nether wart ----------
TP('brewing_stand', t => {
  t.clear();
  t.rect(6, 3, 4, 4, C('#b8935a'));          // top knob
  t.vline(7, 6, 15, C('#6e6e72')); t.vline(8, 6, 15, C('#7d7d82'));
  t.rect(3, 10, 3, 4, C('#8a5cc8')); t.rect(10, 10, 3, 4, C('#8a5cc8'));  // side bottles
  t.rect(4, 11, 1, 2, C('#c8a8f0')); t.rect(11, 11, 1, 2, C('#c8a8f0'));
  t.hline(13, C('#4a4a4e'), 2, 13);
});
TP('anvil_top', t => {
  t.vary(C('#4a4a4e'), .08);
  t.rect(1, 1, 14, 4, C('#5c5c60'));
  t.rect(4, 5, 8, 3, C('#3c3c40'));
  t.rect(5, 8, 6, 6, C('#55555a'));
  t.borderShade(1.15, .8);
});
TP('anvil_side', t => {
  t.vary(C('#4a4a4e'), .08);
  t.rect(3, 2, 10, 3, C('#5c5c60'));
  t.rect(5, 5, 6, 4, C('#3c3c40'));
  t.rect(4, 9, 8, 6, C('#58585c'));
  t.borderShade(1.1, .8);
});
TP('anvil_base', t => { t.vary(C('#454549'), .08); t.rect(2, 2, 12, 12, C('#515156')); t.borderShade(1.1, .8); });
TP('rail_flat', t => {
  t.clear();
  for (let x = 2; x < 14; x++) { t.px(x, 7, C('#9a9a9a')); t.px(x, 8, C('#7a7a7e')); }
  for (let y = 5; y < 11; y += 3) t.hline(y, C('#8a6f45'), 2, 13);
});
for (let s = 0; s < 4; s++) {
  TP('nether_wart_stage' + s, t => {
    t.clear();
    const h = 4 + s * 3;
    const c1 = s < 2 ? C('#4a8f2e') : C('#8a2a2a'), c2 = s < 2 ? C('#6eb84a') : C('#b83a3a');
    for (const x of [3, 8, 13]) {
      t.vline(x, 15 - h, 15, t.rng() < .5 ? c1 : c2);
      if (s >= 2) { t.px(x - 1, 15 - h + 1, c2); t.px(x + 1, 15 - h + 2, c2); }
      if (s >= 3) t.px(x, 15 - h - 1, C('#d85a5a'));
    }
  });
}

// ---------- Destroy stage overlays (MC-authentic: RADIAL growing cracks) ----------
// The crack network is generated once (fixed seed); all points are sorted by
// distance from the impact center. Stage s draws every point with distance <=
// maxD * (s+1)/10 — the network grows strictly FROM THE CENTER OUTWARD in all
// directions, and each stage is a strict superset of the previous one.
for (let s = 0; s < 10; s++) {
  TP('destroy_stage_' + s, t => {
    t.clear();
    const rng = mulberry32(1337);
    const cx2 = 7.5, cy2 = 7.5;
    const pts = [];
    const seedCount = 9;
    for (let i = 0; i < seedCount; i++) {
      let x = cx2 + (rng() - .5) * 1.6, y = cy2 + (rng() - .5) * 1.6;
      let ang = (i / seedCount) * Math.PI * 2 + rng() * 0.7;
      for (let j = 0; j < 16; j++) {
        pts.push([x, y]);
        ang += (rng() - .5) * 0.75;
        x += Math.cos(ang); y += Math.sin(ang);
        if (rng() < 0.10) {
          let bx = x, by = y, bang = ang + (rng() < .5 ? 1.1 : -1.1);
          for (let k = 0; k < 5; k++) {
            pts.push([bx, by]);
            bx += Math.cos(bang); by += Math.sin(bang);
            bang += (rng() - .5) * 0.8;
          }
        }
      }
    }
    // radial order: growth is concentric from the impact point
    pts.sort((a, b) => Math.hypot(a[0] - cx2, a[1] - cy2) - Math.hypot(b[0] - cx2, b[1] - cy2));
    const maxD = Math.hypot(10.5, 10.5);
    const cutoff = maxD * ((s + 1) / 10);
    const black = [10, 10, 10], gray = [42, 42, 42];
    for (const [x, y] of pts) {
      const d2 = Math.hypot(x - cx2, y - cy2);
      if (d2 > cutoff) continue;
      // width grows with distance — same rule for every stage (cumulative)
      const w2 = 1 + Math.min(2, Math.floor(d2 / 5));
      for (let ox = 0; ox < w2; ox++) for (let oy = 0; oy < w2; oy++) {
        t.px(x + ox, y + oy, t.rng() < .75 ? black : gray, 215);
      }
    }
  });
}
