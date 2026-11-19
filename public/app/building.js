// Parametric Wundershed shell. Units: metres, y up. Footprint x in [0,W], z in [0,D]; the front
// (door side) faces +z and is the tall side of the mono-slope roof.
import * as THREE from 'three';
import * as TX from './textures.js';
import { SIZES, GROUPS } from './catalog.js';
import { stageUse } from './furniture.js';
import { layout as openingLayout } from './openings.js';

const FT = 0.3048, IN = 0.0254;
const T = 0.165;                 // wall thickness
const BASE_H = 0.15;             // rapid foundation / skirt height
const FRONT_H = 9 * FT + IN;     // 9'1" front wall, measured from floor deck
const PITCH = 0.05;              // falls 0.5" per 10"
const PORCH = 8 * IN, OVERHANG = 6 * IN, ROOF_T = 0.11, CEIL_DROP = 0.24;
const DOOR_W = 90 * IN, DOOR_ALT_W = 72 * IN, DOOR_H = 80 * IN, SILL = 2 * IN;
const HEAD = SILL + DOOR_H;
// Steel cladding ribs (real geometry): 9" o.c., 3/4" deep, trapezoid profile.
const RIB_P = 9 * IN, RIB_D = 0.019, RIB_B = 0.046, RIB_T = 0.02;
const TRIM_OUT = RIB_D + 0.008;  // trims sit proud of the ribs
const CT = 3 * IN;               // corner trim leg
const SURR = 0.045;              // window/door surround width
const FASC = 0.09, FASC_OUT = RIB_D + 0.025; // roof edge drops below and past the cladding
const UP = new THREE.Vector3(0, 1, 0);

// ---------- materials ----------
const matCache = {};
function texMat(key, set, opts = {}) {
  if (matCache[key]) return matCache[key];
  const { ns = 0.8, ...rest } = opts;
  const m = new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap,
    roughness: 1, metalness: 0, ...rest });
  m.normalScale.set(ns, ns);
  m.name = key;
  return (matCache[key] = m);
}
function plain(key, color, opts = {}) {
  if (matCache[key]) return matCache[key];
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...opts });
  m.name = key;
  return (matCache[key] = m);
}
function steelMat(colorHex) {
  const key = 'steel_' + colorHex.toString(16);
  return texMat(key, TX.steelWall(), { color: colorHex, metalness: 0.08, envMapIntensity: 0.5, ns: 0.35 });
}
function interiorMat(walls) {
  if (walls === 'shiplap') return texMat('shiplap', TX.shiplap(), { ns: 0.6 });
  if (walls === 'osb') return texMat('osb', TX.osb(), { ns: 0.5 });
  return texMat('birch', TX.birchPly(), { ns: 0.4 });
}
function floorMat(floor) {
  if (floor === 'oak') return texMat('walnut', TX.walnutPlank(), { ns: 0.5 });
  if (floor === 'rubber') return texMat('rubber', TX.rubber(), { ns: 0.4 });
  if (floor === 'osb') return texMat('osbFloor', TX.osb(), { ns: 0.4 });
  return texMat('lvp', TX.oakPlank(), { ns: 0.5 });
}
const M = {
  cedar: () => texMat('cedar', TX.cedar(), { ns: 1.0 }),
  deck: () => texMat('deck', TX.deck(), { ns: 1.0 }),
  roof: () => texMat('roof', TX.steelRoof(), { color: 0x2a2a2b, metalness: 0.3, envMapIntensity: 0.6, ns: 1.0 }),
  trim: () => plain('trim', 0x1c1c1d, { roughness: 0.45, metalness: 0.3 }),
  frame: () => plain('frame', 0x141415, { roughness: 0.35, metalness: 0.4 }),
  glass: () => matCache.glass || (matCache.glass = Object.assign(new THREE.MeshPhysicalMaterial({
    color: 0x9fb4c0, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.28, envMapIntensity: 1.4,
    side: THREE.DoubleSide, depthWrite: false }), { name: 'glass' })),
  white: () => plain('white', 0xf2f1ee, { roughness: 0.4 }),
  lamp: () => plain('lamp', 0xfff1d6, { emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.3 }),
  wood: () => texMat('furnWood', TX.tabletop(), { ns: 0.6 }),
  fabric: () => texMat('fabric', TX.fabric(), { color: 0x56606c, ns: 0.8 }),
  rug: () => texMat('rug', TX.fabric(), { color: 0xc9c0b0, ns: 1.0 }),
  plant: () => plain('plant', 0x3f6b3a, { roughness: 0.8 }),
  pot: () => plain('pot', 0xd8d2c6, { roughness: 0.7 })
};

// ---------- geometry helpers ----------
// World-space UVs in metres: horizontal coordinate first, so boards run level and ribs stand up.
function worldUVs(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
function boxGeo(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).toNonIndexed();
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return worldUVs(g);
}
function box(group, mat, x0, x1, y0, y1, z0, z1, name) {
  const m = new THREE.Mesh(boxGeo(x0, x1, y0, y1, z0, z1), mat);
  m.castShadow = m.receiveShadow = true; if (name) m.name = name;
  group.add(m); return m;
}

// A wall slab with openings. axis: 'x' or 'z' (the axis the wall runs along).
// inward: unit vector into the building. plane: world coordinate of the outer face.
// a0..a1: extent along the axis. top(s): wall top height at along-coordinate s.
// holes: [{a0,a1,v0,v1}]. mats: [outer, inner, edge]. ends: materials for the end faces at a0 / a1
// (they show on the neighbouring facade, so they take that facade's cladding).
function wall(group, { axis, inward, plane, a0, a1, top, holes = [], mats, ends = [], name }) {
  const Z = inward.clone(), X = new THREE.Vector3().crossVectors(UP, Z);
  const sign = axis === 'x' ? Math.sign(X.x) : Math.sign(X.z);
  const toU = s => s * sign;
  const shape = new THREE.Shape();
  const pts = [[a0, 0], [a1, 0], [a1, top(a1)], [a0, top(a0)]].map(([s, v]) => new THREE.Vector2(toU(s), v));
  shape.setFromPoints(pts);
  for (const hl of holes) {
    const hp = new THREE.Path();
    hp.setFromPoints([[hl.a0, hl.v0], [hl.a1, hl.v0], [hl.a1, hl.v1], [hl.a0, hl.v1]].map(([s, v]) => new THREE.Vector2(toU(s), v)));
    shape.holes.push(hp);
  }
  let geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
  geo = geo.toNonIndexed();
  const O = new THREE.Vector3(); if (axis === 'x') O.z = plane; else O.x = plane;
  O.y = BASE_H;
  const m4 = new THREE.Matrix4().makeBasis(X, UP, Z).setPosition(O);
  geo.applyMatrix4(m4);
  // regroup triangles: outer face, inner face, edges/reveals
  const pos = geo.attributes.position.array, buckets = [[], [], [], [], []];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3();
  const along = v => axis === 'x' ? v.x : v.z;
  const at = (v, s) => Math.abs(along(v) - s) < 1e-4;
  for (let i = 0; i < pos.length; i += 9) {
    a.fromArray(pos, i); b.fromArray(pos, i + 3); c.fromArray(pos, i + 6);
    nrm.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const d = nrm.dot(Z);
    let k = d < -0.9 ? 0 : d > 0.9 ? 1 : 2;
    if (k === 2 && Math.abs(nrm.dot(X)) > 0.9) {
      if (at(a, a0) && at(b, a0) && at(c, a0)) k = 3;
      else if (at(a, a1) && at(b, a1) && at(c, a1)) k = 4;
    }
    buckets[k].push(...pos.slice(i, i + 9));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(buckets.flat(), 3));
  let start = 0;
  buckets.forEach((bk, gi) => { out.addGroup(start, bk.length / 3, gi); start += bk.length / 3; });
  out.computeVertexNormals();
  worldUVs(out);
  const mesh = new THREE.Mesh(out, [mats[0], mats[1], mats[2], ends[0] || mats[0], ends[1] || mats[0]]);
  mesh.castShadow = mesh.receiveShadow = true; mesh.name = name || 'wall';
  group.add(mesh);
  return mesh;
}

// Vertical steel ribs on one facade plane. Rib centres sit on a world grid (9" o.c. from the
// footprint origin) so ribs on pieces of the same facade line up. They stop short of corner
// trims and break around opening surrounds.
function ribs(group, { axis, outward, plane, s0, s1, top, holes = [], mat, name = 'ribs' }) {
  const tri = [];
  const P = (s, d, y) => axis === 'x' ? [s, y, plane + outward.z * d] : [plane + outward.x * d, y, s];
  const quad = (q, want) => {
    const [A, B, C, D] = q.map(v => new THREE.Vector3(...v));
    const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A));
    const order = n.dot(want) >= 0 ? [A, B, C, A, C, D] : [A, C, B, A, D, C];
    for (const v of order) tri.push(v.x, v.y, v.z);
  };
  const margin = CT + RIB_B / 2 + 0.012;
  const prof = [[-RIB_B / 2, 0], [-RIB_T / 2, RIB_D], [RIB_T / 2, RIB_D], [RIB_B / 2, 0]];
  const along = axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  for (let k = Math.ceil((s0 + margin) / RIB_P - 0.5); (k + 0.5) * RIB_P <= s1 - margin; k++) {
    const s = (k + 0.5) * RIB_P;
    let spans = [[BASE_H, BASE_H + top(s)]];
    for (const hl of holes) {
      if (s + RIB_B / 2 <= hl.a0 - SURR || s - RIB_B / 2 >= hl.a1 + SURR) continue;
      const c0 = BASE_H + hl.v0 - SURR, c1 = BASE_H + hl.v1 + SURR;
      spans = spans.flatMap(([y0, y1]) => [[y0, Math.min(y1, c0)], [Math.max(y0, c1), y1]]).filter(([y0, y1]) => y1 - y0 > 0.02);
    }
    for (const [y0, y1] of spans) {
      for (let f = 0; f < 3; f++) {
        const [sa, da] = prof[f], [sb, db] = prof[f + 1];
        const want = outward.clone().multiplyScalar(f === 1 ? 1 : 0.3).add(along.clone().multiplyScalar(f === 0 ? -1 : f === 2 ? 1 : 0));
        quad([P(s + sa, da, y0), P(s + sb, db, y0), P(s + sb, db, y1), P(s + sa, da, y1)], want);
      }
      // end caps, so a rib that stops at a window or door is closed
      for (const [yy, dir] of [[y0, -1], [y1, 1]]) quad(prof.map(([ps, pd]) => P(s + ps, pd, yy)), new THREE.Vector3(0, dir, 0));
    }
  }
  if (!tri.length) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  geo.computeVertexNormals(); worldUVs(geo);
  const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; m.name = name;
  group.add(m);
}

// Black aluminium frame + glass in an opening on a wall.
function opening(group, { axis, inward, plane, a0, a1, v0, v1, mullions = 0, name, sill = true }) {
  const fw = 0.05, fd = 0.07, y0 = BASE_H + v0, y1 = BASE_H + v1;
  const o = axis === 'x' ? (t) => [plane + inward.z * t] : (t) => [plane + inward.x * t];
  const inset = 0.02; // frame sits just inside the outer face
  const n0 = Math.min(o(inset)[0], o(inset + fd)[0]), n1 = Math.max(o(inset)[0], o(inset + fd)[0]);
  const g = new THREE.Group(); g.name = name || 'opening';
  const put = (s0, s1, yy0, yy1, mat, nn0 = n0, nn1 = n1) => axis === 'x'
    ? box(g, mat, s0, s1, yy0, yy1, nn0, nn1) : box(g, mat, nn0, nn1, yy0, yy1, s0, s1);
  put(a0, a1, y0, y0 + fw, M.frame()); put(a0, a1, y1 - fw, y1, M.frame());
  put(a0, a0 + fw, y0, y1, M.frame()); put(a1 - fw, a1, y0, y1, M.frame());
  for (let k = 1; k <= mullions; k++) { const s = a0 + (a1 - a0) * k / (mullions + 1); put(s - 0.022, s + 0.022, y0, y1, M.frame()); }
  const mid = (n0 + n1) / 2;
  const gl = put(a0 + fw, a1 - fw, y0 + fw, y1 - fw, M.glass(), mid - 0.004, mid + 0.004);
  gl.castShadow = false; gl.userData.noAO = true;
  // flashing surround, proud of the ribs
  const o0 = o(0)[0], o1 = o(-TRIM_OUT)[0], s0 = Math.min(o0, o1), s1 = Math.max(o0, o1);
  put(a0 - SURR, a0, y0 - (sill ? SURR : 0), y1 + SURR, M.trim(), s0, s1);
  put(a1, a1 + SURR, y0 - (sill ? SURR : 0), y1 + SURR, M.trim(), s0, s1);
  put(a0, a1, y1, y1 + SURR, M.trim(), s0, s1);
  if (sill) put(a0, a1, y0 - SURR, y0, M.trim(), s0, s1);
  group.add(g);
}

// ---------- the build ----------
export function buildStudio(st) {
  const [dFt, wFt] = SIZES[st.size];
  const W = wFt * FT, D = dFt * FT;
  const porch = st.porch, hasPorch = porch !== 'none';
  const OH = !hasPorch && st.roof === 'over' ? OVERHANG : 0;
  const Dr = hasPorch ? D - PORCH : D;            // enclosed depth (z from 0 to Dr)
  const Wr = porch === 'wrap' ? W - PORCH : W;    // enclosed width (x from 0 to Wr)
  const h = z => FRONT_H - PITCH * (D - z);       // wall top above floor deck
  const panelColor = GROUPS.panel.choices[st.panel].color;
  const steel = steelMat(panelColor);
  const facadeMat = st.facade === 'wood' ? M.cedar() : st.facade === 'black' ? steelMat(0x1d1d1e) : steel;
  const inner = interiorMat(st.walls), trim = M.trim(), cedar = M.cedar();
  const eastOuter = porch === 'wrap' ? cedar : steel;

  const g = new THREE.Group(); g.name = 'Wundershed';
  const meta = { W, D, Wr, Dr, h, BASE_H, CEIL_DROP, name: null, warn: null };

  // base skirt
  box(g, trim, -0.01, W + 0.01, 0, BASE_H, -0.01, D + 0.01, 'skirt');

  // openings from the rules engine (openings.js): positions along each wall, sizes in metres
  const ops = openingLayout(st);
  const door = ops.F.find(o => o.kind === 'door');
  meta.door = door; meta.doorW = (door.a1 - door.a0) / IN; meta.openings = ops;
  const put = (k, axis, inward, plane, list) => list.forEach(o => opening(g, { axis, inward, plane, a0: o.a0, a1: o.a1, v0: o.v0, v1: o.v1,
    mullions: o.kind === 'door' ? o.panels - 1 : 0, sill: o.kind !== 'door', name: k === 'F' ? (o.kind === 'door' ? 'slider' : 'frontWindow') : k + 'Window' }));

  // front wall
  const frontZ = Dr;
  wall(g, { axis: 'x', inward: new THREE.Vector3(0, 0, -1), plane: frontZ, a0: 0, a1: Wr, top: () => h(frontZ),
    holes: ops.F, mats: [hasPorch ? cedar : facadeMat, inner, trim], ends: [steel, eastOuter], name: 'front' });
  put('F', 'x', new THREE.Vector3(0, 0, -1), frontZ, ops.F);

  // rear wall (on a wrap porch a cedar-lined fin carries on past the enclosed width)
  wall(g, { axis: 'x', inward: new THREE.Vector3(0, 0, 1), plane: 0, a0: 0, a1: Wr, top: () => h(0),
    holes: ops.R, mats: [steel, inner, trim], ends: [steel, eastOuter], name: 'rear' });
  if (porch === 'wrap') wall(g, { axis: 'x', inward: new THREE.Vector3(0, 0, 1), plane: 0, a0: Wr, a1: W, top: () => h(0),
    mats: [steel, cedar, trim], name: 'rearFin' });
  put('R', 'x', new THREE.Vector3(0, 0, 1), 0, ops.R);

  // left (west) side; it carries on as the porch fin when there is a porch
  wall(g, { axis: 'z', inward: new THREE.Vector3(1, 0, 0), plane: 0, a0: T, a1: Dr - T, top: h, holes: ops.W, mats: [steel, inner, trim], name: 'west' });
  if (hasPorch) wall(g, { axis: 'z', inward: new THREE.Vector3(1, 0, 0), plane: 0, a0: Dr, a1: D, top: h, mats: [steel, cedar, trim], name: 'westFin' });
  put('W', 'z', new THREE.Vector3(1, 0, 0), 0, ops.W);

  // right (east) side
  const eastX = Wr;
  wall(g, { axis: 'z', inward: new THREE.Vector3(-1, 0, 0), plane: eastX, a0: T, a1: Dr - T, top: h,
    holes: ops.E, mats: [porch === 'wrap' ? cedar : steel, inner, trim], name: 'east' });
  put('E', 'z', new THREE.Vector3(-1, 0, 0), eastX, ops.E);
  if (porch === 'front') wall(g, { axis: 'z', inward: new THREE.Vector3(-1, 0, 0), plane: W, a0: Dr, a1: D, top: h, mats: [steel, cedar, trim], name: 'eastFin' });

  // corner trims: black angle at each outside corner, proud of the ribs; fin ends get a cap.
  const cornerTop = cz => BASE_H + h(cz);
  const corner = (cx, cz, ox, oz) => {
    const xs = [cx + ox * TRIM_OUT, cx - ox * CT], zs = [cz + oz * TRIM_OUT, cz - oz * CT];
    box(g, trim, Math.min(...xs), Math.max(...xs), BASE_H - 0.02, cornerTop(cz), Math.min(...zs), Math.max(...zs), 'cornerTrim');
  };
  const capZ = (x0, ix, zEnd) => { // fin running along z, wall thickness from x0 towards ix
    const xs = [x0 - ix * TRIM_OUT, x0 + ix * (T + 0.008)];
    box(g, trim, Math.min(...xs), Math.max(...xs), BASE_H - 0.02, cornerTop(zEnd), zEnd - CT, zEnd + TRIM_OUT, 'finCap');
  };
  corner(0, 0, -1, -1);
  if (porch === 'wrap') box(g, trim, W - CT, W + TRIM_OUT, BASE_H - 0.02, cornerTop(0), -TRIM_OUT, T + 0.008, 'finCap');
  else corner(W, 0, 1, -1);
  if (!hasPorch) { corner(0, Dr, -1, 1); corner(W, Dr, 1, 1); }
  else {
    capZ(0, 1, D);
    if (porch === 'front') capZ(W, -1, D); else corner(Wr, Dr, 1, 1);
  }

  // steel ribs, one run per facade plane
  ribs(g, { axis: 'z', outward: new THREE.Vector3(-1, 0, 0), plane: 0, s0: 0, s1: hasPorch ? D : Dr, top: h, holes: ops.W, mat: steel });
  ribs(g, { axis: 'x', outward: new THREE.Vector3(0, 0, -1), plane: 0, s0: 0, s1: W, top: () => h(0), holes: ops.R, mat: steel });
  if (porch !== 'wrap') ribs(g, { axis: 'z', outward: new THREE.Vector3(1, 0, 0), plane: W, s0: 0, s1: porch === 'front' ? D : Dr, top: h, holes: ops.E, mat: steel });
  if (!hasPorch && st.facade !== 'wood') ribs(g, { axis: 'x', outward: new THREE.Vector3(0, 0, 1), plane: Dr, s0: 0, s1: W, top: () => h(Dr), holes: ops.F, mat: facadeMat, name: 'frontRibs' });

  // porch deck + soffit
  if (hasPorch) {
    box(g, M.deck(), 0, W, BASE_H - 0.04, BASE_H, Dr, D, 'deck');
    if (porch === 'wrap') box(g, M.deck(), Wr, W, BASE_H - 0.04, BASE_H, 0, Dr, 'deck');
  }

  // roof slab, sloped. Underside reads as cedar soffit over a porch.
  const rx0 = -OH - FASC_OUT, rx1 = W + OH + FASC_OUT, rz0 = -OH - FASC_OUT, rz1 = D + OH + FASC_OUT;
  const y = z => BASE_H + h(z);
  const ceilYOf = z => BASE_H + h(z) - CEIL_DROP;
  const roofGeo = new THREE.BufferGeometry();
  const P = [
    [rx0, y(rz0) - FASC, rz0], [rx1, y(rz0) - FASC, rz0], [rx1, y(rz1) - FASC, rz1], [rx0, y(rz1) - FASC, rz1],
    [rx0, y(rz0) + ROOF_T, rz0], [rx1, y(rz0) + ROOF_T, rz0], [rx1, y(rz1) + ROOF_T, rz1], [rx0, y(rz1) + ROOF_T, rz1]
  ];
  const quads = { top: [4, 7, 6, 5], bottom: [0, 1, 2, 3], s1: [0, 4, 5, 1], s2: [1, 5, 6, 2], s3: [2, 6, 7, 3], s4: [3, 7, 4, 0] };
  const tri = []; const groups = [];
  for (const [k, q] of Object.entries(quads)) {
    const start = tri.length / 3;
    for (const idx of [q[0], q[1], q[2], q[0], q[2], q[3]]) tri.push(...P[idx]);
    groups.push([start, 6, k === 'top' ? 0 : k === 'bottom' ? 1 : 2]);
  }
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  groups.forEach(([s, c, m]) => roofGeo.addGroup(s, c, m));
  roofGeo.computeVertexNormals(); worldUVs(roofGeo);
  const roof = new THREE.Mesh(roofGeo, [M.roof(), hasPorch ? cedar : trim, trim]);
  roof.castShadow = roof.receiveShadow = true; roof.name = 'roof';
  g.add(roof);

  // skylights: 24 x 36 curb-mounted units on the roof, centred across the width
  const nSky = Math.max(0, Math.min(2, parseInt(st.sky, 10) || 0));
  meta.skylights = nSky;
  for (let i = 0; i < nSky; i++) {
    const sx = nSky === 1 ? W / 2 : W * (i === 0 ? 0.33 : 0.67), sz = D * 0.45, sw = 24 * IN, sl = 36 * IN;
    const top = y(sz) + ROOF_T;
    const sk = new THREE.Group(); sk.name = 'skylight';
    box(sk, trim, sx - sw / 2 - 0.05, sx + sw / 2 + 0.05, top - 0.02, top + 0.1, sz - sl / 2 - 0.05, sz + sl / 2 + 0.05);
    const gl = box(sk, M.glass(), sx - sw / 2, sx + sw / 2, top + 0.1, top + 0.112, sz - sl / 2, sz + sl / 2); gl.castShadow = false;
    sk.rotation.x = 0; g.add(sk);
    const well = box(g, M.white(), sx - sw / 2, sx + sw / 2, ceilYOf(sz) - 0.012, ceilYOf(sz) - 0.006, sz - sl / 2, sz + sl / 2, 'skylightWell');
    well.material = plain('skyWell', 0xdfeaf3, { emissive: 0xbcd7ee, emissiveIntensity: 0.6, roughness: 0.3 });
  }

  // ---------- interior ----------
  const floorY = BASE_H + 0.005;
  const fl = new THREE.Mesh(boxGeo(T, Wr - T, BASE_H, floorY, T, Dr - T), floorMat(st.floor));
  fl.receiveShadow = true; fl.name = 'floor'; g.add(fl);
  const ceilY = z => BASE_H + h(z) - CEIL_DROP;
  const ceil = new THREE.BufferGeometry();
  const cp = [[T, ceilY(T), T], [Wr - T, ceilY(T), T], [Wr - T, ceilY(Dr - T), Dr - T], [T, ceilY(Dr - T), Dr - T]];
  ceil.setAttribute('position', new THREE.Float32BufferAttribute([...cp[0], ...cp[1], ...cp[2], ...cp[0], ...cp[2], ...cp[3]], 3));
  ceil.computeVertexNormals(); worldUVs(ceil);
  const ceilMesh = new THREE.Mesh(ceil, st.walls === 'birch' ? inner : M.white());
  ceilMesh.name = 'ceiling'; ceilMesh.receiveShadow = true; g.add(ceilMesh);

  const fixtures = new THREE.Group(); fixtures.name = 'fixtures'; g.add(fixtures);
  const midZ = Dr / 2;
  // heating / cooling
  if (st.heat === 'split9' || st.heat === 'split12') {
    // Head unit high on the back wall in the widest clear stretch between openings, so it reads
    // through the slider; if the back wall is too busy, the left side, then the right side.
    const len = st.heat === 'split12' ? 0.92 : 0.8, hh = 0.3, dep = 0.23;
    const clearRun = (list, a0, a1) => {
      let best = [a0, a0], x = a0;
      for (const o of [...list].sort((p, q) => p.a0 - q.a0)) { const e = o.a0 - SURR - 0.03; if (e - x > best[1] - best[0]) best = [x, e]; x = Math.max(x, o.a1 + SURR + 0.03); }
      if (a1 - x > best[1] - best[0]) best = [x, a1];
      return best;
    };
    const runs = [['rear', clearRun(ops.R, T, Wr - T)], ['west', clearRun(ops.W, T, Dr - T)], ['east', clearRun(ops.E, T, Dr - T)]];
    const [wallName, run] = runs.find(([, r]) => r[1] - r[0] >= len + 0.1) || runs[0];
    const onRear = wallName === 'rear', c = (run[0] + run[1]) / 2;
    const u = new THREE.Group(); u.name = 'miniSplit';
    box(u, M.white(), -len / 2, len / 2, 0, hh, 0, dep);
    box(u, plain('splitGrey', 0xc9cbcc, { roughness: 0.4 }), -len / 2 + 0.03, len / 2 - 0.03, 0.035, 0.07, dep - 0.02, dep + 0.004);
    box(u, plain('splitSlot', 0x2a2b2d, { roughness: 0.6 }), -len / 2 + 0.05, len / 2 - 0.05, 0.005, 0.03, dep * 0.4, dep);
    box(u, plain('splitLed', 0x7fd3ff, { emissive: 0x3aa8ff, emissiveIntensity: 1.2 }), len / 2 - 0.12, len / 2 - 0.08, 0.1, 0.11, dep, dep + 0.003);
    const top = ceilY(onRear ? T : c) - 0.22; // ~1.9 m to the underside, a normal install height
    u.position.set(onRear ? c : wallName === 'west' ? T : Wr - T, top - hh, onRear ? T : c);
    if (wallName === 'west') u.rotation.y = Math.PI / 2;
    if (wallName === 'east') u.rotation.y = -Math.PI / 2;
    u.traverse(o => { if (o.isMesh) o.castShadow = true; });
    fixtures.add(u);
    meta.splitWall = wallName;
  } else {
    box(fixtures, M.white(), T, T + 0.025, floorY + 0.35, floorY + 0.95, midZ - 0.3, midZ + 0.3, 'ceramicPanel');
    box(fixtures, M.white(), Wr * 0.35, Wr * 0.35 + 0.6, floorY + 0.35, floorY + 0.95, T, T + 0.025, 'ceramicPanel');
  }
  if (st.erv === 'yes') {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 32), M.white());
    c.rotation.x = Math.PI / 2; c.position.set(T + 0.35, ceilY(T) - 0.3, T + 0.015); c.name = 'erv'; fixtures.add(c);
  }
  // lighting package
  const pkg = GROUPS.elec.choices[st.elec];
  const lamps = [], lampPositions = [];
  if (pkg.ceiling) lampPositions.push([Wr / 2, Dr / 2, 'dome']);
  const pr = pkg.pots === 6 ? [3, 2] : pkg.pots === 4 ? [2, 2] : [0, 0];
  for (let i = 0; i < pr[0]; i++) for (let j = 0; j < pr[1]; j++)
    lampPositions.push([T + (Wr - 2 * T) * (i + 0.5) / pr[0], T + (Dr - 2 * T) * (j + 0.5) / pr[1], 'pot']);
  for (const [lx, lz, kind] of lampPositions) {
    const geo = kind === 'dome' ? new THREE.SphereGeometry(0.16, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2) : new THREE.CylinderGeometry(0.055, 0.055, 0.012, 24);
    const lm = new THREE.Mesh(geo, M.lamp()); lm.position.set(lx, ceilY(lz) - 0.006, lz);
    lm.name = 'lamp'; fixtures.add(lm); lamps.push({ pos: lm.position.clone(), indoor: true });
  }
  // outdoor lights beside the slider
  const sconceSpots = pkg.outdoor === 2 ? [door.a0 - 0.25, door.a1 + 0.12] : pkg.outdoor === 1 ? [door.a0 - 0.25] : [];
  for (const sx of sconceSpots) {
    if (sx < 0.1 || sx > Wr - 0.1) continue;
    const yy = BASE_H + HEAD + 0.15;
    box(fixtures, M.trim(), sx - 0.05, sx + 0.05, yy - 0.12, yy + 0.12, frontZ, frontZ + 0.09, 'sconce');
    const lens = box(fixtures, M.lamp(), sx - 0.035, sx + 0.035, yy - 0.125, yy - 0.115, frontZ + 0.01, frontZ + 0.08, 'sconceLens');
    lamps.push({ pos: new THREE.Vector3(sx, yy - 0.2, frontZ + 0.2), indoor: false });
  }

  // use-case staging, drawn to scale (see furniture.js)
  const room = roomFor(st, floorY);
  meta.room = room;
  if (st.furnish !== false) {
    const stg = new THREE.Group(); stg.name = 'staging'; stg.userData.staging = true; g.add(stg);
    meta.staged = stageUse(stg, st.use, st.size, room);
  }

  // soft contact shadow on the ground (viewer only; not exported to AR)
  g.add(contactShadow(W, D));

  // centre the footprint on the origin
  g.position.set(-W / 2, 0, -D / 2);
  meta.lamps = lamps.map(l => ({ pos: l.pos.clone().add(new THREE.Vector3(-W / 2, 0, -D / 2)), indoor: l.indoor }));
  meta.interiorW = (Wr - 2 * T) / FT; meta.interiorD = (Dr - 2 * T) / FT;
  meta.roofTop = BASE_H + h(D) + ROOF_T;
  g.traverse(o => {
    if (o.name === 'roof' || o.name === 'fascia') o.userData.roof = true;
    if (o.name === 'ceiling' || o.name === 'lamp' || o.name === 'skylightWell') o.userData.ceiling = true;
    if (o.name === 'skylight') o.traverse(c => c.userData.roof = true);
    if (['front', 'frontRibs', 'slider', 'frontWindow', 'sconce', 'sconceLens'].includes(o.name)) o.userData.cut = true;
  });
  return { group: g, meta };
}

// Interior rectangle for a state (any size), in building coordinates.
export function roomFor(st, floorY = BASE_H + 0.005) {
  const [dFt, wFt] = SIZES[st.size];
  const W = wFt * FT, D = dFt * FT, Dr = st.porch !== 'none' ? D - PORCH : D, Wr = st.porch === 'wrap' ? W - PORCH : W;
  return { x0: T, x1: Wr - T, z0: T, z1: Dr - T, iw: Wr - 2 * T, id: Dr - 2 * T, cx: Wr / 2, cz: Dr / 2, floorY };
}

function contactShadow(W, D) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), pad = 48;
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  x.filter = 'blur(18px)'; x.fillStyle = '#fff'; x.fillRect(pad, pad, 256 - 2 * pad, 256 - 2 * pad);
  const tex = new THREE.CanvasTexture(c);
  const k = 256 / (256 - 2 * pad);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W * k + 0.3, D * k + 0.3),
    new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex, transparent: true, depthWrite: false, opacity: 0.5 }));
  m.rotation.x = -Math.PI / 2; m.position.set(W / 2, 0.003, D / 2); m.renderOrder = 1;
  m.name = 'contactShadow'; m.userData.noExport = true; m.userData.noAO = true;
  return m;
}

export function setLampsOn(group, on) {
  const m = matCache.lamp; if (m) m.emissiveIntensity = on ? 3.2 : 0;
}
