// Procedural materials drawn at real-world scale. Each texture knows the size in metres
// it represents, and the geometry writes UVs in metres, so boards and ribs line up on every face.
import * as THREE from 'three';

const cache = {};

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// tileable value noise: period px, py in lattice cells
function vnoise(x, y, px, py, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (a, p) => ((a % p) + p) % p;
  const a = hash(m(xi, px), m(yi, py), seed), b = hash(m(xi + 1, px), m(yi, py), seed);
  const c = hash(m(xi, px), m(yi + 1, py), seed), d = hash(m(xi + 1, px), m(yi + 1, py), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, px, py, seed, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f, px * f, py * f, seed + i * 17); amp *= 0.5; f *= 2; }
  return s;
}

function build(w, h, fill) {
  const col = new Uint8ClampedArray(w * h * 4), height = new Float32Array(w * h), rough = new Uint8ClampedArray(w * h * 4);
  fill({ w, h, col, height, rough });
  return { w, h, col, height, rough };
}
function toTexture(w, h, data, srgb) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.userData.mimeType = 'image/jpeg';
  return t;
}
function normalFrom(w, h, height, strength) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = height[y * w + (x - 1 + w) % w], r = height[y * w + (x + 1) % w];
    const u = height[((y - 1 + h) % h) * w + x], d = height[((y + 1) % h) * w + x];
    let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * w + x) * 4;
    out[i] = (nx * 0.5 + 0.5) * 255; out[i + 1] = (ny * 0.5 + 0.5) * 255; out[i + 2] = (nz * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return out;
}
function finish(key, img, worldW, worldH, normalStrength) {
  const set = {
    map: toTexture(img.w, img.h, img.col, true),
    normalMap: toTexture(img.w, img.h, normalFrom(img.w, img.h, img.height, normalStrength), false),
    roughnessMap: toTexture(img.w, img.h, img.rough, false),
    worldW, worldH
  };
  for (const k of ['map', 'normalMap', 'roughnessMap']) set[k].repeat.set(1 / worldW, 1 / worldH);
  cache[key] = set;
  return set;
}
function px(img, x, y, r, g, b, h, ro) {
  const i = y * img.w + x, j = i * 4;
  img.col[j] = r; img.col[j + 1] = g; img.col[j + 2] = b; img.col[j + 3] = 255;
  img.height[i] = h;
  img.rough[j] = img.rough[j + 1] = img.rough[j + 2] = ro; img.rough[j + 3] = 255;
}
const mix = (a, b, t) => a + (b - a) * t;

// Horizontal board patterns (cedar siding, floors, deck, shiplap).
// boardsPerTile courses over worldH; joints staggered; grain along x.
function boards(key, o) {
  if (cache[key]) return cache[key];
  const { w, h, courses, palette, seed = 1, groove = 3, gap = 0, grain = 1, knots = 0, paint = 0, roughBase = 150, joints = true, maxJoints = 2, toneW = 0.55 } = o;
  const R = rng(seed);
  const rowH = h / courses;
  // Each course has 1-2 butt joints; the board after the last joint wraps into the first,
  // so the tile repeats seamlessly along its length.
  const rows = [];
  for (let c = 0; c < courses; c++) {
    const n = joints ? 1 + Math.floor(R() * maxJoints) : 1;
    const js = [];
    for (let i = 0; i < n; i++) js.push(Math.floor(((i + 0.2 + R() * 0.6) / n) * w));
    const boardsIn = js.map(() => ({ tone: R(), hue: R(), seed: Math.floor(R() * 1e6) }));
    rows.push({ js, boardsIn });
  }
  const knotList = [];
  for (let k = 0; k < knots; k++) knotList.push({ x: R() * w, y: R() * h, r: 2 + R() * 4 });
  const img = build(w, h, () => {});
  for (let y = 0; y < h; y++) {
    const c = Math.floor(y / rowH), ly = (y - c * rowH) / rowH;
    for (let x = 0; x < w; x++) {
      const row = rows[c];
      let bi = row.js.length - 1;
      for (let j = 0; j < row.js.length; j++) if (x >= row.js[j]) bi = j;
      const seg = row.boardsIn[bi];
      const tone = seg.tone;
      // grain: long stretched noise plus growth-ring stripes
      const n = fbm(x / 64, y / 4, w / 64, h / 4, seg.seed % 997, 4);
      const rings = 0.5 + 0.5 * Math.sin((ly * 9 + n * 6 + seg.hue * 6) * Math.PI);
      let g = mix(n, rings, 0.45) * grain;
      let k = 0;
      for (const kn of knotList) { const dx = (x - kn.x) / (kn.r * 2.2), dy = (y - kn.y) / kn.r; const d = dx * dx + dy * dy; if (d < 1) k = Math.max(k, 1 - d); }
      const p0 = palette[0], p1 = palette[1];
      const t = Math.min(1, Math.max(0, 0.5 * (1 - toneW) + tone * toneW + g * 0.45 - k * 0.6));
      let r = mix(p0[0], p1[0], t), gg = mix(p0[1], p1[1], t), b = mix(p0[2], p1[2], t);
      if (paint) { const pv = 0.9 + 0.1 * g; r = mix(r, palette[2][0] * pv, paint); gg = mix(gg, palette[2][1] * pv, paint); b = mix(b, palette[2][2] * pv, paint); }
      let hgt = 1, ro = roughBase + g * 30;
      const yIn = y - c * rowH;
      if (yIn < groove) { const f = yIn / groove; r *= 0.35 + 0.4 * f; gg *= 0.35 + 0.4 * f; b *= 0.35 + 0.4 * f; hgt = f * 0.6; ro = 220; }
      else if (yIn > rowH - 2) { hgt = 0.85; }
      if (gap && yIn < gap) { r = 30; gg = 26; b = 22; hgt = 0; }
      if (joints && row.js.some(jx => x === jx || x === jx + 1)) { r *= 0.45; gg *= 0.45; b *= 0.45; hgt = 0.3; }
      px(img, x, y, r, gg, b, hgt + g * 0.08, ro);
    }
  }
  return finish(key, img, o.worldW, o.worldH, o.normal || 3);
}

export function cedar() {
  // 6" boards in 16' lengths, one butt joint per course, gentle board-to-board tone change
  return boards('cedar', { w: 2048, h: 256, courses: 4, worldW: 4.88, worldH: 0.6096, seed: 7, knots: 9, maxJoints: 1, toneW: 0.22,
    palette: [[136, 92, 60], [190, 138, 94]], groove: 5, roughBase: 165 });
}
export function deck() {
  return boards('deck', { w: 1024, h: 256, courses: 4, worldW: 2.44, worldH: 0.6096, seed: 11, knots: 3, maxJoints: 1, toneW: 0.3,
    palette: [[118, 82, 56], [166, 120, 82]], groove: 2, gap: 6, roughBase: 185 });
}
export function shiplap() {
  return boards('shiplap', { w: 512, h: 256, courses: 3, worldW: 1.22, worldH: 0.6096, seed: 3, joints: false,
    palette: [[200, 190, 172], [226, 218, 204], [242, 240, 234]], paint: 0.85, groove: 4, grain: 0.6, roughBase: 170, normal: 2 });
}
export function oakPlank() {
  return boards('oak', { w: 512, h: 448, courses: 6, worldW: 1.22, worldH: 1.067, seed: 21,
    palette: [[176, 140, 100], [214, 182, 140]], groove: 2, roughBase: 120, normal: 2 });
}
export function walnutPlank() {
  return boards('walnut', { w: 512, h: 448, courses: 6, worldW: 1.22, worldH: 1.067, seed: 33,
    palette: [[96, 64, 44], [140, 98, 66]], groove: 2, roughBase: 110, normal: 2 });
}

// Steel panels: vertical ribs. Colour is applied by the material, so the map stays near white.
function ribbed(key, { w, h, worldW, worldH, ribs, ribW, minor = 0, seed = 5, base = 236 }) {
  if (cache[key]) return cache[key];
  const img = build(w, h, () => {});
  const pitch = w / ribs;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const lx = (x % pitch) / pitch; // 0..1 within a rib bay
    const c = Math.abs(lx - 0.5) * 2; // 0 at rib centre
    let hgt = c < ribW ? 1 : c < ribW * 1.8 ? 1 - (c - ribW) / (ribW * 0.8) : 0;
    if (minor) { const m = Math.abs(((lx * minor) % 1) - 0.5) * 2; if (c > ribW * 2 && m < 0.08) hgt = 0.15; }
    const n = fbm(x / 64, y / 256, w / 64, h / 256, seed, 2);
    const v = base - 10 + n * 14 - (hgt > 0 && hgt < 1 ? 12 : 0);
    px(img, x, y, v, v, v, hgt, 105 + n * 40);
  }
  return finish(key, img, worldW, worldH, 9);
}
// Painted steel face (the ribs are real geometry now, so the map is just the paint:
// faint roll-forming streaks and orange peel). Colour comes from the material.
export function steelWall() {
  if (cache.steelWall) return cache.steelWall;
  const w = 512, h = 512;
  const img = build(w, h, () => {});
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const peel = fbm(x / 3, y / 3, w / 3, h / 3, 81, 2);
    const streak = fbm(x / 6, y / 160, w / 6, h / 160, 83, 3);
    const blotch = fbm(x / 96, y / 96, w / 96, h / 96, 85, 3);
    const v = 226 + streak * 12 + blotch * 10;
    px(img, x, y, v, v, v, peel * 0.5 + streak * 0.5, 140 + blotch * 40 + peel * 16);
  }
  return finish('steelWall', img, 1.0, 1.0, 1.2);
}
export function steelRoof() { // standing seam, 16" o.c.
  return ribbed('steelRoof', { w: 512, h: 512, worldW: 1.2192, worldH: 1.2192, ribs: 3, ribW: 0.025, seed: 9 });
}

export function birchPly() {
  if (cache.birch) return cache.birch;
  const w = 512, h = 1024; // one 4x8 sheet, grain vertical
  const img = build(w, h, () => {});
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm(x / 6, y / 90, w / 6, h / 90, 41, 4);
    const patch = fbm(x / 128, y / 256, w / 128, h / 256, 43, 2);
    const rings = 0.5 + 0.5 * Math.sin((x / 9 + n * 5) * Math.PI);
    const t = 0.35 * n + 0.25 * rings + 0.4 * patch;
    let r = mix(200, 232, t), g = mix(168, 204, t), b = mix(122, 158, t);
    let hgt = 1;
    if (x < 2 || x > w - 3 || y < 2 || y > h - 3) { r *= 0.55; g *= 0.55; b *= 0.55; hgt = 0.2; } // sheet seam
    px(img, x, y, r, g, b, hgt, 160 + n * 30);
  }
  return finish('birch', img, 1.2192, 2.4384, 2);
}
export function osb() {
  if (cache.osb) return cache.osb;
  const w = 512, h = 512;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); const R = rng(77);
  x.fillStyle = '#b48a55'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    const cx = R() * w, cy = R() * h, l = 20 + R() * 46, t = 5 + R() * 9, a = R() * Math.PI;
    const tone = 120 + R() * 90;
    x.fillStyle = `rgb(${tone + 40},${tone * 0.78 + 20},${tone * 0.45})`;
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      x.save(); x.translate(cx + ox, cy + oy); x.rotate(a); x.fillRect(-l / 2, -t / 2, l, t); x.restore();
    }
  }
  const data = x.getImageData(0, 0, w, h).data;
  const img = { w, h, col: new Uint8ClampedArray(data), height: new Float32Array(w * h), rough: new Uint8ClampedArray(w * h * 4) };
  for (let i = 0; i < w * h; i++) { img.height[i] = data[i * 4] / 255; img.rough.fill(200, i * 4, i * 4 + 3); img.rough[i * 4 + 3] = 255; }
  return finish('osb', img, 1.2192, 1.2192, 1.5);
}
export function rubber() {
  if (cache.rubber) return cache.rubber;
  const w = 512, h = 512, R = rng(5);
  const img = build(w, h, () => {});
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm(x / 8, y / 8, w / 8, h / 8, 51, 3);
    let v = 34 + n * 18; let r = v, g = v, b = v + 2;
    if (R() < 0.035) { const f = R(); r = 70 + f * 40; g = 80 + f * 40; b = 96 + f * 50; }
    px(img, x, y, r, g, b, n, 230);
  }
  return finish('rubber', img, 1, 1, 1);
}
export function grass() {
  if (cache.grass) return cache.grass;
  const w = 512, h = 512, R = rng(9);
  const img = build(w, h, () => {});
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm(x / 64, y / 64, w / 64, h / 64, 61, 4);
    const fine = fbm(x / 2, y / 6, w / 2, h / 6, 63, 2);
    const t = 0.55 * n + 0.45 * fine;
    const r = mix(52, 104, t), g = mix(84, 140, t), b = mix(34, 62, t);
    px(img, x, y, r, g, b, fine, 235);
  }
  return finish('grass', img, 2, 2, 2);
}

// Privacy fence: vertical cedar boards, no butt joints. Generated as horizontal courses;
// the fence writes its UVs rotated (u = height, v = along the fence).
export function fenceBoards() {
  return boards('fence', { w: 512, h: 512, courses: 6, worldW: 1.83, worldH: 0.84, seed: 17, joints: false, knots: 4,
    palette: [[104, 78, 58], [150, 116, 86]], groove: 0, gap: 3, roughBase: 200, normal: 2.5 });
}
// Solid tabletop grain (no plank grooves).
export function tabletop() {
  return boards('tabletop', { w: 512, h: 256, courses: 1, worldW: 1.4, worldH: 0.7, seed: 91, joints: false,
    palette: [[150, 108, 72], [196, 150, 104]], groove: 0, roughBase: 110, normal: 1.5 });
}
// Woven fabric for chair and rug; colour comes from the material.
export function fabric() {
  if (cache.fabric) return cache.fabric;
  const w = 256, h = 256;
  const img = build(w, h, () => {});
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const weave = ((x >> 1) + (y >> 1)) % 2 ? Math.abs(Math.sin(y * Math.PI / 2)) : Math.abs(Math.sin(x * Math.PI / 2));
    const n = fbm(x / 16, y / 16, w / 16, h / 16, 95, 3);
    const v = 200 + weave * 30 + n * 25;
    px(img, x, y, v, v, v, weave * 0.6 + n * 0.4, 230);
  }
  return finish('fabric', img, 0.08, 0.08, 1.5);
}
