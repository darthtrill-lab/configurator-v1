// Use-case staging: true-scale furniture laid out for each use and footprint, so the room
// communicates size. Every item is built at real dimensions (metres) with its "front" facing +z.
// Rotation on placement: 0 = against the rear wall facing the door side, PI/2 = against the west
// wall facing east, -PI/2 = against the east wall facing west, PI = facing the rear wall.
import * as THREE from 'three';
import * as TX from './textures.js';

const PI = Math.PI, IN = 0.0254;
const mc = {};
function mat(key, o) {
  if (mc[key]) return mc[key];
  const m = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, ...o });
  m.name = 'f_' + key;
  return (mc[key] = m);
}
const fab = (key, color) => mat(key, { color, map: TX.fabric().map, normalMap: TX.fabric().normalMap, roughness: 0.95 });
const K = {
  oak: () => mat('oak', { map: TX.tabletop().map, roughness: 0.55 }),
  walnut: () => mat('walnut', { color: 0x6b4a33, roughness: 0.5 }),
  black: () => mat('black', { color: 0x1d1d1f, roughness: 0.45, metalness: 0.35 }),
  chrome: () => mat('chrome', { color: 0xc8c8c8, roughness: 0.25, metalness: 1 }),
  white: () => mat('white', { color: 0xefeee9, roughness: 0.5 }),
  rubber: () => mat('rubber', { color: 0x222224, roughness: 0.9 }),
  screen: () => mat('screen', { color: 0x0b0d10, roughness: 0.2, emissive: 0x2a4a6a, emissiveIntensity: 0.45 }),
  sofa: () => fab('sofa', 0x7b8790),
  linen: () => fab('linen', 0xd9d2c3),
  rust: () => fab('rust', 0xb5643c),
  olive: () => fab('olive', 0x6d7550),
  navy: () => fab('navy', 0x34435a),
  duvet: () => fab('duvet', 0xe9e5dc),
  nugget: () => fab('nugget', 0x2f8f9d),
  beanbag: () => fab('beanbag', 0xc98b4b),
  plant: () => mat('plant', { color: 0x3f6b3a, roughness: 0.8 }),
  pot: () => mat('pot', { color: 0xb8714f, roughness: 0.8 }),
  canvas: () => mat('canvas', { color: 0xf4f1ea, roughness: 0.9 }),
  piano: () => mat('piano', { color: 0x111112, roughness: 0.15, metalness: 0.1 }),
  cello: () => mat('cello', { color: 0x7a3b1a, roughness: 0.25 }),
  drum: () => mat('drum', { color: 0x9c1f24, roughness: 0.3, metalness: 0.2 }),
  head: () => mat('head', { color: 0xefeadf, roughness: 0.6 }),
  brass: () => mat('brass', { color: 0xc9a54a, roughness: 0.3, metalness: 1 }),
  mirror: () => mat('mirror', { color: 0xdfe6ea, roughness: 0.02, metalness: 1 }),
  marquee: () => mat('marquee', { color: 0xffe08a, emissive: 0xffc04a, emissiveIntensity: 0.9 }),
  arcadeArt: () => mat('arcadeArt', { color: 0xd8462b, roughness: 0.5 }),
  felt: () => mat('felt', { color: 0x4d5560, roughness: 1 })
};
const MATS = ['purple', 'teal', 'coral'].map((n, i) => () => mat('mat_' + n, { color: [0x6c5a8e, 0x3f8f8a, 0xd9735b][i], roughness: 0.9 }));
const BOOKS = [0x9b3d2e, 0x2f4b6e, 0xd8b45a, 0x3f6b4a, 0xe7e1d4, 0x5b4a7a];

// ---------- primitives ----------
function bx(g, m, w, h, d, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; g.add(o); return o;
}
function cy(g, m, r, h, x = 0, y = 0, z = 0, r2 = r, seg = 24) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, seg), m);
  o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; g.add(o); return o;
}
function sph(g, m, r, x, y, z, sx = 1, sy = 1, sz = 1) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m);
  o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = o.receiveShadow = true; g.add(o); return o;
}
const item = (label, w, d, build) => { const g = new THREE.Group(); build(g); g.userData.label = label; return { g, w, d, label }; };
const legs4 = (g, m, w, d, h, t = 0.035, inset = 0.03) => {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, m, t, h, t, sx * (w / 2 - inset - t / 2), 0, sz * (d / 2 - inset - t / 2));
};

// ---------- furniture (real sizes) ----------
const F = {
  desk: (w = 1.4, d = 0.7) => item('Desk', w, d, g => { bx(g, K.oak(), w, 0.03, d, 0, 0.72); legs4(g, K.black(), w, d, 0.72, 0.03, 0.04); }),
  taskChair: () => item('Task chair', 0.6, 0.6, g => {
    for (let k = 0; k < 5; k++) { const a = k * 2 * PI / 5; const s = bx(g, K.black(), 0.04, 0.03, 0.3, Math.sin(a) * 0.14, 0.04, Math.cos(a) * 0.14); s.rotation.y = a; }
    cy(g, K.black(), 0.025, 0.36, 0, 0.06); bx(g, K.navy(), 0.5, 0.08, 0.48, 0, 0.42);
    bx(g, K.navy(), 0.46, 0.52, 0.06, 0, 0.55, -0.24); bx(g, K.black(), 0.04, 0.2, 0.04, 0, 0.46, -0.24);
  }),
  diningChair: () => item('Chair', 0.46, 0.5, g => {
    legs4(g, K.walnut(), 0.44, 0.46, 0.45, 0.03, 0.01); bx(g, K.walnut(), 0.44, 0.03, 0.46, 0, 0.45);
    bx(g, K.walnut(), 0.44, 0.4, 0.03, 0, 0.48, -0.215);
  }),
  sofa: (w = 2.0, label = 'Sofa') => item(label, w, 0.9, g => {
    const m = K.sofa();
    legs4(g, K.walnut(), w, 0.9, 0.08, 0.04, 0.06);
    bx(g, m, w, 0.22, 0.9, 0, 0.08);                          // base
    bx(g, m, w, 0.42, 0.2, 0, 0.3, -0.35);                    // back
    for (const s of [-1, 1]) bx(g, m, 0.16, 0.32, 0.9, s * (w / 2 - 0.08), 0.3);  // arms
    const n = w > 1.8 ? 3 : 2, cw = (w - 0.32) / n;
    for (let i = 0; i < n; i++) bx(g, m, cw - 0.015, 0.14, 0.62, -w / 2 + 0.16 + cw * (i + 0.5), 0.3, 0.08);
    for (const s of [-1, 1]) { const p = bx(g, K.rust(), 0.42, 0.38, 0.12, s * (w / 2 - 0.4), 0.44, -0.2); p.rotation.x = -0.25; }
  }),
  armchair: () => item('Armchair', 0.82, 0.82, g => {
    const m = K.olive();
    legs4(g, K.walnut(), 0.82, 0.82, 0.12, 0.035, 0.06);
    bx(g, m, 0.82, 0.22, 0.82, 0, 0.12); bx(g, m, 0.82, 0.42, 0.18, 0, 0.34, -0.32);
    for (const s of [-1, 1]) bx(g, m, 0.14, 0.26, 0.82, s * 0.34, 0.34);
    bx(g, m, 0.54, 0.12, 0.6, 0, 0.34, 0.08);
  }),
  coffeeTable: () => item('Coffee table', 1.0, 0.55, g => { bx(g, K.oak(), 1.0, 0.04, 0.55, 0, 0.38); legs4(g, K.black(), 1.0, 0.55, 0.38, 0.03, 0.05); }),
  sideTable: () => item('Side table', 0.45, 0.45, g => { cy(g, K.oak(), 0.22, 0.03, 0, 0.5); cy(g, K.black(), 0.02, 0.5); cy(g, K.black(), 0.16, 0.02); }),
  roundTable: () => item('Meeting table', 0.9, 0.9, g => { cy(g, K.oak(), 0.45, 0.035, 0, 0.72, 0, 0.45, 40); cy(g, K.black(), 0.04, 0.72); cy(g, K.black(), 0.25, 0.02, 0, 0, 0, 0.25, 32); }),
  bookshelf: (w = 0.8) => item('Bookshelf', w, 0.32, g => {
    const m = K.white(), H = 1.8;
    for (const s of [-1, 1]) bx(g, m, 0.02, H, 0.32, s * (w / 2 - 0.01));
    for (let i = 0; i < 5; i++) bx(g, m, w, 0.02, 0.32, 0, i * 0.44);
    let seed = 3;
    for (let i = 0; i < 4; i++) { let x = -w / 2 + 0.03; while (x < w / 2 - 0.12) {
      seed = (seed * 9301 + 49297) % 233280; const r = seed / 233280; const bw = 0.025 + r * 0.03, bh = 0.22 + r * 0.12;
      bx(g, mat('book' + (seed % 6), { color: BOOKS[seed % 6], roughness: 0.8 }), bw, bh, 0.22, x + bw / 2, i * 0.44 + 0.02, 0.02); x += bw + 0.004;
      if (r > 0.86) x += 0.12; } }
  }),
  plant: (tall = 1) => item('Plant', 0.4, 0.4, g => { cy(g, K.pot(), 0.16, 0.32, 0, 0, 0, 0.13); sph(g, K.plant(), 0.3, 0, 0.32 + 0.38 * tall, 0, 1, 1.35 * tall, 1); }),
  rug: (w, d, color = 0xc9c0b0) => item('Rug', w, d, g => { const r = bx(g, mat('rug' + color.toString(16), { color, map: TX.fabric().map, roughness: 1 }), w, 0.008, d); r.castShadow = false; }),
  // gym
  yogaMat: (i = 0) => item('Yoga mat', 0.61, 1.83, g => { const r = bx(g, MATS[i % 3](), 0.61, 0.006, 1.83); r.castShadow = false; }),
  bike: () => item('Spin bike (Peloton)', 0.6, 1.25, g => {
    const k = K.black();
    bx(g, k, 0.5, 0.05, 0.08, 0, 0, 0.5); bx(g, k, 0.5, 0.05, 0.08, 0, 0, -0.5); bx(g, k, 0.08, 0.06, 1.05, 0, 0.03);
    const fw = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 32), K.chrome()); fw.rotation.z = PI / 2; fw.position.set(0, 0.36, 0.28); fw.castShadow = true; g.add(fw);
    const post = bx(g, k, 0.06, 0.85, 0.06, 0, 0.05, -0.18); post.rotation.x = -0.25;
    bx(g, k, 0.18, 0.05, 0.28, 0, 0.88, -0.32);
    const stem = bx(g, k, 0.06, 0.95, 0.06, 0, 0.05, 0.22); stem.rotation.x = 0.18;
    bx(g, k, 0.5, 0.04, 0.12, 0, 1.0, 0.36);
    const sc = bx(g, K.screen(), 0.55, 0.34, 0.03, 0, 1.08, 0.44); sc.rotation.x = 0.25;
  }),
  rower: () => item('Rowing machine', 0.55, 2.4, g => {
    const k = K.black(); bx(g, K.oak(), 0.12, 0.06, 2.0, 0, 0.18, -0.15); bx(g, k, 0.5, 0.18, 0.06, 0, 0, -1.15);
    bx(g, K.oak(), 0.5, 0.5, 0.4, 0, 0, 1.0); bx(g, k, 0.3, 0.06, 0.3, 0, 0.26, -0.5); bx(g, k, 0.5, 0.03, 0.12, 0, 0.12, 0.6);
  }),
  rack: () => item('Dumbbell rack', 0.7, 0.4, g => {
    const k = K.black(); for (const s of [-1, 1]) bx(g, k, 0.04, 0.8, 0.4, s * 0.33);
    for (let t = 0; t < 3; t++) { const y = 0.22 + t * 0.26; const sh = bx(g, k, 0.66, 0.02, 0.36, 0, y); sh.rotation.x = 0.2;
      for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.045 + t * 0.008, 0.045 + t * 0.008, 0.26, 16), K.rubber()); d.rotation.z = PI / 2; d.position.set(-0.24 + i * 0.16, y + 0.06, 0); d.castShadow = true; g.add(d); } }
  }),
  bench: () => item('Weight bench', 0.32, 1.2, g => { bx(g, K.black(), 0.3, 0.42, 0.06, 0, 0, 0.5); bx(g, K.black(), 0.3, 0.42, 0.06, 0, 0, -0.5); bx(g, K.rubber(), 0.3, 0.07, 1.2, 0, 0.42); }),
  // art
  easel: () => item('Easel and stool', 0.7, 1.2, g => {
    const w = K.oak();
    for (const s of [-1, 1]) { const l = bx(g, w, 0.035, 1.85, 0.035, s * 0.22, 0, 0.1); l.rotation.z = s * 0.06; }
    const back = bx(g, w, 0.035, 1.8, 0.035, 0, 0, -0.28); back.rotation.x = 0.28;
    bx(g, w, 0.55, 0.03, 0.08, 0, 0.82, 0.12);
    const c = bx(g, K.canvas(), 0.6, 0.76, 0.03, 0, 0.85, 0.12); c.rotation.x = -0.05;
    for (const [x, y, col] of [[-0.15, 1.3, 0xd9735b], [0.1, 1.1, 0x3f6b8e], [0.05, 1.42, 0xd8b45a]]) bx(g, mat('paint' + col, { color: col }), 0.16, 0.1, 0.005, x, y, 0.145);
    cy(g, K.oak(), 0.17, 0.03, 0, 0.62, 0.62); for (let k = 0; k < 3; k++) { const a = k * 2 * PI / 3; cy(g, K.black(), 0.012, 0.62, Math.sin(a) * 0.12, 0, 0.62 + Math.cos(a) * 0.12); }
  }),
  artTable: (w = 1.4, d = 0.7) => item('Work table', w, d, g => {
    bx(g, K.white(), w, 0.04, d, 0, 0.86); legs4(g, K.black(), w, d, 0.86, 0.04, 0.04); bx(g, K.black(), w - 0.1, 0.02, d - 0.1, 0, 0.2);
    for (const [x, z, col] of [[-0.4, 0.1, 0xd9735b], [-0.32, -0.05, 0x3f6b8e], [-0.24, 0.12, 0xd8b45a], [0.3, 0, 0x6d7550]]) cy(g, mat('paint' + col, { color: col }), 0.04, 0.1, x, 0.9, z);
    bx(g, K.canvas(), 0.5, 0.005, 0.35, 0.1, 0.9, 0);
  }),
  flatFile: () => item('Flat file', 1.0, 0.75, g => { bx(g, K.white(), 1.0, 0.85, 0.75); for (let i = 0; i < 5; i++) bx(g, K.black(), 0.3, 0.015, 0.01, 0, 0.12 + i * 0.15, 0.376); bx(g, K.oak(), 1.02, 0.03, 0.77, 0, 0.85); }),
  canvases: () => item('Canvases', 0.8, 0.3, g => { for (let i = 0; i < 4; i++) { const c = bx(g, K.canvas(), 0.5 + i * 0.1, 0.6 + i * 0.12, 0.025, -0.1 + i * 0.07, 0, 0.08 - i * 0.05); c.rotation.x = -0.12; } }),
  // guest
  bed: (w, l, label) => item(label, w, l, g => {
    bx(g, K.walnut(), w + 0.06, 0.28, l + 0.04, 0, 0.04); legs4(g, K.walnut(), w, l, 0.05, 0.05, 0.05);
    bx(g, K.white(), w, 0.24, l - 0.02, 0, 0.32);
    bx(g, K.duvet(), w + 0.04, 0.06, l * 0.68, 0, 0.53, l * 0.16); bx(g, K.rust(), w + 0.05, 0.065, 0.42, 0, 0.535, l * 0.33);
    for (const s of [-1, 1]) { const p = bx(g, K.linen(), w / 2 - 0.08, 0.14, 0.38, s * w / 4, 0.55, -l / 2 + 0.3); p.rotation.x = -0.2; }
    bx(g, K.linen(), w + 0.1, 1.05, 0.08, 0, 0, -l / 2 - 0.02);
  }),
  nightstand: () => item('Nightstand', 0.45, 0.4, g => {
    bx(g, K.walnut(), 0.45, 0.5, 0.4, 0, 0.05); legs4(g, K.black(), 0.45, 0.4, 0.05, 0.03, 0.02);
    cy(g, K.white(), 0.06, 0.25, 0, 0.55); cy(g, K.linen(), 0.1, 0.16, 0, 0.78, 0, 0.13);
  }),
  dresser: () => item('Dresser', 1.0, 0.45, g => { bx(g, K.walnut(), 1.0, 0.75, 0.45, 0, 0.08); legs4(g, K.black(), 1.0, 0.45, 0.08, 0.03, 0.03); for (let i = 0; i < 3; i++) bx(g, K.black(), 0.16, 0.015, 0.01, 0, 0.22 + i * 0.22, 0.226); }),
  // flex
  arcade: (col = 0xd8462b) => item('Arcade cabinet', 0.66, 0.8, g => {
    const k = K.black(), art = mat('arcade' + col.toString(16), { color: col, roughness: 0.5 });
    for (const s of [-1, 1]) bx(g, art, 0.03, 1.75, 0.8, s * 0.315);
    bx(g, k, 0.6, 0.85, 0.7, 0, 0, -0.04); bx(g, k, 0.6, 0.9, 0.35, 0, 0.85, -0.2);
    const deck = bx(g, k, 0.6, 0.06, 0.32, 0, 0.9, 0.2); deck.rotation.x = 0.2;
    for (const x of [-0.15, -0.05, 0.05, 0.15]) cy(g, mat('btn' + (x > 0 ? 'r' : 'b'), { color: x > 0 ? 0xe03a3a : 0x3a7be0, emissive: x > 0 ? 0x601010 : 0x102a60 }), 0.018, 0.02, x, 0.97, 0.25);
    const sc = bx(g, K.screen(), 0.5, 0.42, 0.02, 0, 1.08, 0.04); sc.rotation.x = -0.35;
    bx(g, K.marquee(), 0.6, 0.16, 0.06, 0, 1.56, 0.12);
  }),
  nugget: () => item('Nugget play couch', 1.58, 0.8, g => {
    const m = K.nugget();
    bx(g, m, 0.78, 0.19, 0.8, -0.395); bx(g, m, 0.78, 0.19, 0.8, 0.395);
    bx(g, m, 1.58, 0.5, 0.2, 0, 0.19, -0.3);
    for (const s of [-1, 1]) { const p = bx(g, m, 0.2, 0.36, 0.55, s * 0.69, 0.19, 0.08); p.rotation.z = s * 0.08; }
  }),
  beanbag: () => item('Beanbag', 0.85, 0.85, g => { sph(g, K.beanbag(), 0.42, 0, 0.3, 0, 1, 0.72, 1); sph(g, K.beanbag(), 0.3, 0, 0.5, -0.18, 1, 0.8, 0.6); }),
  tv: () => item('Wall TV', 1.25, 0.05, g => { bx(g, K.black(), 1.25, 0.72, 0.04, 0, 1.0, 0.03); bx(g, K.screen(), 1.21, 0.68, 0.005, 0, 1.02, 0.051); }),
  console: () => item('Media console', 1.5, 0.4, g => { bx(g, K.walnut(), 1.5, 0.45, 0.4, 0, 0.1); legs4(g, K.black(), 1.5, 0.4, 0.1, 0.03, 0.05); }),
  // music
  drums: () => item('Drum kit', 1.6, 1.4, g => {
    const sh = K.drum(), hd = K.head(), ch = K.chrome();
    const kick = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.42, 32), sh); kick.rotation.x = PI / 2; kick.position.set(0, 0.29, 0.25); kick.castShadow = true; g.add(kick);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.27, 32), hd); face.position.set(0, 0.29, 0.461); g.add(face);
    for (const [x, z, r, h, y] of [[-0.18, 0.2, 0.15, 0.13, 0.62], [0.18, 0.2, 0.17, 0.15, 0.64]]) { cy(g, sh, r, h, x, y, z); cy(g, hd, r, 0.005, x, y + h, z); }
    cy(g, sh, 0.2, 0.4, 0.5, 0.2, -0.05); cy(g, hd, 0.2, 0.005, 0.5, 0.6, -0.05); for (let k = 0; k < 3; k++) cy(g, ch, 0.01, 0.2, 0.5 + Math.sin(k * 2.1) * 0.18, 0, -0.05 + Math.cos(k * 2.1) * 0.18);
    cy(g, sh, 0.18, 0.14, -0.35, 0.5, -0.15); cy(g, hd, 0.18, 0.005, -0.35, 0.64, -0.15); cy(g, ch, 0.012, 0.5, -0.35, 0, -0.15);
    for (const [x, z, h, r] of [[-0.62, -0.05, 0.92, 0.18], [-0.45, 0.45, 1.35, 0.23], [0.55, 0.4, 1.45, 0.26]]) { cy(g, ch, 0.012, h, x, 0, z); cy(g, K.brass(), r, 0.008, x, h, z, r * 0.3); }
    cy(g, K.brass(), 0.18, 0.008, -0.62, 0.95, -0.05);
    cy(g, K.black(), 0.18, 0.08, 0, 0.5, -0.55); cy(g, K.chrome(), 0.02, 0.5, 0, 0, -0.55); cy(g, K.black(), 0.22, 0.02, 0, 0, -0.55);
  }),
  piano: () => item('Upright piano', 1.5, 1.0, g => {
    const p = K.piano();
    bx(g, p, 1.5, 1.25, 0.6, 0, 0, -0.2); bx(g, p, 1.5, 0.1, 0.27, 0, 0.66, 0.235);
    bx(g, K.white(), 1.36, 0.02, 0.15, 0, 0.76, 0.28); for (let i = 0; i < 36; i++) if ([1, 3, 6, 8, 10].includes(i % 12)) bx(g, p, 0.014, 0.012, 0.09, -0.66 + i * 0.0378, 0.78, 0.25);
    for (const s of [-1, 1]) bx(g, p, 0.06, 0.66, 0.06, s * 0.68, 0, 0.32);
    bx(g, p, 0.75, 0.05, 0.35, 0, 0.45, 0.72); legs4(g, p, 0.75, 0.35, 0.45, 0.04, 0.02);
  }),
  cello: () => item('Cello, chair and stand', 0.9, 1.0, g => {
    const c = K.cello();
    sph(g, c, 0.2, 0, 0.32, 0.28, 1.05, 1.0, 0.33); sph(g, c, 0.17, 0, 0.6, 0.28, 1.0, 0.9, 0.33);
    bx(g, K.black(), 0.05, 0.62, 0.03, 0, 0.72, 0.3); cy(g, K.chrome(), 0.006, 0.1, 0, 0.02, 0.27);
    const ch = F.diningChair().g; ch.position.set(0, 0, -0.2); g.add(ch);
    const ms = new THREE.Group(); ms.position.set(0, 0, 0.75); g.add(ms);
    cy(ms, K.black(), 0.01, 1.05); bx(ms, K.black(), 0.48, 0.32, 0.01, 0, 1.0, 0).rotation.x = 0.35; cy(ms, K.black(), 0.2, 0.01);
  }),
  acoustic: (n = 3, y0 = 0.8, h = 1.2) => item('Acoustic panels', 0.6 * n + 0.1 * (n - 1), 0.05, g => { for (let i = 0; i < n; i++) bx(g, K.felt(), 0.6, h, 0.05, -((n - 1) * 0.35) + i * 0.7, y0, 0.025); }),
  mirror: (w = 1.0) => item('Wall mirror', w, 0.03, g => { bx(g, K.black(), w + 0.04, 1.84, 0.02, 0, 0.3, 0.01); bx(g, K.mirror(), w, 1.8, 0.005, 0, 0.32, 0.022); })
};

// ---------- layouts ----------
// r: room in building coordinates. x0..x1 west->east, z0 (rear wall) .. z1 (front wall, slider on the east side).
// tier = footprint index (0: 8x10, 1: 10x12, 2: 10x14, 3: 10x16).
const W_ = PI / 2, E_ = -PI / 2;
const LAYOUTS = {
  office(r, t) {
    const L = [];
    const dw = t === 0 ? 1.2 : 1.4, dd = t === 0 ? 0.6 : 0.7;
    const dx = t === 3 ? r.cx : t === 2 ? r.x1 - dw / 2 - 0.65 : Math.min(r.x0 + r.iw * 0.62, r.x1 - dw / 2 - (t === 0 ? 0.05 : 0.65));
    L.push([F.desk(dw, dd), dx, r.z0 + dd / 2 + 0.02], [F.taskChair(), dx, r.z0 + dd + 0.25, PI]);
    if (t === 0) L.push([F.armchair(), r.x0 + 0.62, r.z1 - 0.7, W_ - 0.5], [F.plant(), r.x0 + 0.3, r.z0 + 0.3]);
    if (t >= 1) {
      const sw = t === 1 ? 1.6 : 2.0;
      L.push([F.sofa(sw, t === 1 ? '2-seat sofa' : '3-seat sofa'), r.x0 + 0.47, r.cz + 0.05, W_], [F.rug(1.6, 1.4), r.x0 + 1.35, r.cz + 0.05]);
      L.push(t === 1 ? [F.sideTable(), r.x0 + 0.3, r.cz - sw / 2 - 0.25] : [F.coffeeTable(), r.x0 + 1.4, r.cz + 0.05, W_]);
    }
    if (t >= 2) L.push([F.armchair(), r.x0 + 2.35, r.z0 + dd + 1.05, E_ + 0.15]);
    if (t === 3) L.push([F.roundTable(), r.x1 - 0.85, r.z0 + 1.12], [F.diningChair(), r.x1 - 0.85, r.z0 + 1.74, PI], [F.diningChair(), r.x1 - 0.23, r.z0 + 1.12, E_], [F.diningChair(), r.x1 - 1.47, r.z0 + 1.12, W_]);
    if (t >= 1) L.push([F.plant(1.2), r.x1 - 0.3, r.z0 + 0.3]);
    if (t >= 2) L.push([F.bookshelf(), r.x0 + 0.5, r.z0 + 0.17]);
    return L;
  },
  gym(r, t) {
    const L = [[F.bike(), r.x0 + 0.45, r.z0 + 0.75], [F.mirror(t === 0 ? 0.8 : 1.0), r.x0 + 0.01, r.z0 + r.id * 0.7, W_]];
    const mats = t === 0 ? 1 : t === 3 ? 3 : 2;
    const mx0 = r.x0 + (t === 0 ? 1.45 : 1.35), mz = t === 3 ? r.z0 + 1.68 : Math.max(r.cz, r.z0 + 1.465);
    for (let i = 0; i < mats; i++) L.push([F.yogaMat(i), mx0 + i * 0.8, mz]);
    L.push([F.rack(), r.x1 - 0.42, r.z0 + 0.25]);
    if (t === 2) L.push([F.bench(), r.x1 - 0.5, r.cz - 0.1]);
    if (t === 3) L.push([F.rower(), r.x0 + 2.3, r.z0 + 0.35, W_]);
    if (t >= 1) L.push([F.plant(), r.x1 - 0.3, r.z1 - 0.3]);
    return L;
  },
  art(r, t) {
    const L = [];
    const tw = t === 0 ? 1.2 : 1.5;
    L.push([F.artTable(tw, 0.7), r.x0 + tw / 2 + 0.05, r.z0 + 0.37]);
    L.push([F.easel(), r.x0 + r.iw * (t === 0 ? 0.6 : 0.5), r.z0 + r.id * 0.62, 0.5]);
    if (t >= 1) L.push([F.flatFile(), r.x0 + 0.42, r.z1 - 0.65, W_], [F.canvases(), r.x1 - 0.5, r.z0 + 0.2]);
    if (t >= 2) L.push([F.easel(), r.x0 + r.iw * 0.78, r.z0 + r.id * 0.5, -0.4]);
    if (t === 3) L.push([F.bookshelf(1.0), r.x1 - 1.4, r.z0 + 0.17], [F.armchair(), r.x0 + 1.3, r.z1 - 0.55, PI - 0.3]);
    L.push([F.plant(1.2), r.x1 - 0.3, t === 0 ? r.z0 + 0.3 : r.z1 - 0.3]);
    return L;
  },
  guest(r, t) {
    const L = [];
    if (t === 0) {
      L.push([F.sofa(1.9, 'Sofa bed (sleeps 2)'), r.x0 + 0.47, r.cz, W_], [F.sideTable(), r.x1 - 0.3, r.z0 + 0.3], [F.rug(1.4, 1.6), r.x0 + 1.4, r.cz], [F.plant(), r.x1 - 0.3, r.z1 - 0.3]);
      return L;
    }
    const queen = t >= 2, bw = queen ? 1.52 : 1.37, bl = queen ? 2.03 : 1.9;
    L.push([F.bed(bw, bl, queen ? 'Queen bed (60×80″)' : 'Double bed (54×75″)'), r.x0 + bl / 2 + 0.04, r.cz, W_]);
    L.push([F.nightstand(), r.x0 + 0.23, r.cz - bw / 2 - 0.27, W_]);
    if (queen) L.push([F.nightstand(), r.x0 + 0.23, r.cz + bw / 2 + 0.27, W_]);
    L.push([F.rug(1.4, 2.2), r.x0 + bl - 0.2, r.cz]);
    if (t === 1) L.push([F.armchair(), r.x1 - 0.62, r.z0 + 0.64, -0.6]);
    if (t >= 2) L.push([F.dresser(), r.x1 - 0.65, r.z0 + 0.23], [F.armchair(), r.x1 - 0.55, r.cz + 0.2, E_ + 0.3]);
    const gx = Math.min(r.x0 + bl + 0.75, r.x1 - 1.75);
    if (t === 3) L.push([F.desk(1.0, 0.5), gx, r.z0 + 0.27], [F.diningChair(), gx, r.z0 + 0.75, PI]);
    return L;
  },
  flex(r, t) {
    if (t === 0) return [[F.nugget(), r.x0 + 0.42, r.cz, W_], [F.arcade(), r.x1 - 0.42, r.z0 + 0.42], [F.beanbag(), r.x0 + 1.5, r.z1 - 0.55, PI * 0.8], [F.rug(1.4, 1.4, 0xb7a68f), r.x0 + 1.3, r.cz]];
    const L = [[F.tv(), r.x0 + 0.01, r.cz, W_], [F.console(), r.x0 + 0.22, r.cz, W_]];
    L.push([F.nugget(), r.x0 + 2.0, r.cz, E_]);
    L.push([F.arcade(), r.x1 - 0.42, r.z0 + 0.42]);
    if (t >= 1) L.push([F.beanbag(), r.x0 + 1.0, r.z1 - 0.7, PI * 0.8], [F.rug(1.8, 1.6, 0xb7a68f), r.x0 + 1.4, r.cz]);
    if (t >= 2) L.push([F.arcade(0x2b6ed8), r.x1 - 1.15, r.z0 + 0.42]);
    if (t === 3) L.push([F.beanbag(), r.x0 + 1.05, r.z0 + 0.75, PI * 0.2], [F.plant(1.2), r.x1 - 0.3, r.z1 - 0.3]);
    return L;
  },
  music(r, t) {
    const L = [];
    if (t === 0) {
      L.push([F.drums(), r.cx + 0.1, r.cz + 0.05, 0.25], [F.acoustic(2), r.x0 + 0.01, r.cz, W_], [F.rug(1.8, 1.6, 0x7a4b3a), r.cx + 0.1, r.cz + 0.05]);
      return L;
    }
    const pz = t === 1 ? r.cz : r.z0 + 0.85;
    L.push([F.piano(), r.x0 + 0.52, pz, W_], [F.acoustic(t === 1 ? 2 : 3, 1.38, 0.6), r.x0 + 0.01, r.cz, W_]);
    if (t === 1) L.push([F.cello(), r.x0 + 2.4, r.cz + 0.1, E_ + 0.5]);
    else L.push([F.cello(), r.x0 + (t === 2 ? 1.72 : 2.0), r.z1 - 0.65, PI],
      [F.drums(), r.x1 - 0.85, r.z0 + 0.85, -0.35], [F.rug(1.8, 1.6, 0x7a4b3a), r.x1 - 0.85, r.z0 + 0.85]);
    L.push([F.plant(), r.x1 - 0.3, t === 1 ? r.z0 + 0.3 : r.z1 - 0.3]);
    return L;
  }
};

export const USES = {
  office: { label: 'Office', blurb: 'Work from the garden, take calls, host a client.' },
  gym:    { label: 'Gym', blurb: 'Yoga, spin and strength without the commute.' },
  art:    { label: 'Art studio', blurb: 'North light, a big table and room to step back.' },
  guest:  { label: 'Guest room', blurb: 'Somewhere private for visiting family.' },
  flex:   { label: 'Flex room', blurb: 'Kids, games and movie nights.' },
  music:  { label: 'Music room', blurb: 'Practice at full volume without the house.' }
};

// Lays out a use in a room. Each item is kept inside the walls; if the layout for this footprint
// still has clashes (a wrap porch takes 8" off both directions), it falls back to the next smaller
// layout, so what is drawn and what the guidance lists always agree.
const WALL_ITEMS = new Set(['Wall TV', 'Acoustic panels', 'Wall mirror']);
const TUCKED = [['Desk', 'Task chair'], ['Desk', 'Chair'], ['Meeting table', 'Chair']];
const boxOf = g => { g.updateMatrixWorld(true); return new THREE.Box3().setFromObject(g, true); };
function arrange(use, tier, room) {
  const fn = LAYOUTS[use] || LAYOUTS.office;
  for (let t = tier; t >= 0; t--) {
    const placed = [];
    for (const [it, x, z, rot = 0] of fn(room, t)) {
      it.g.position.set(x, room.floorY, z); it.g.rotation.y = rot;
      const b = boxOf(it.g);
      const dx = Math.max(0, room.x0 - b.min.x) - Math.max(0, b.max.x - room.x1);
      const dz = Math.max(0, room.z0 - b.min.z) - Math.max(0, b.max.z - room.z1);
      if (!WALL_ITEMS.has(it.label) && (dx || dz)) { it.g.position.x += dx; it.g.position.z += dz; b.translate(new THREE.Vector3(dx, 0, dz)); }
      placed.push({ it, b });
    }
    let clash = false;
    for (let i = 0; i < placed.length && !clash; i++) for (let j = i + 1; j < placed.length; j++) {
      const A = placed[i], B = placed[j], la = A.it.label, lb = B.it.label;
      if (la === 'Rug' || lb === 'Rug' || WALL_ITEMS.has(la) || WALL_ITEMS.has(lb)) continue;
      if (TUCKED.some(([p, q]) => (la === p && lb === q) || (la === q && lb === p))) continue;
      const ox = Math.min(A.b.max.x, B.b.max.x) - Math.max(A.b.min.x, B.b.min.x);
      const oz = Math.min(A.b.max.z, B.b.max.z) - Math.max(A.b.min.z, B.b.min.z);
      if (ox > 0.06 && oz > 0.06) { clash = true; break; }
    }
    if (!clash || t === 0) return { tier: t, items: placed.map(p => p.it) };
  }
}
const listed = items => items.map(it => it.label).filter(l => l !== 'Rug' && l !== 'Plant');

// Places the layout into `group`. Returns what was placed and which layout tier was used.
export function stageUse(group, use, tier, room) {
  const { tier: used, items } = arrange(use, tier, room);
  for (const it of items) { it.g.name = 'stage:' + it.label; group.add(it.g); }
  return { tier: used, labels: listed(items) };
}

// What a use fits at a footprint, for the guidance panel.
export function fitsAt(use, tier, room) {
  const r = arrange(use, tier, room);
  return { tier: r.tier, labels: listed(r.items) };
}
