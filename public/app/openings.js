// Windows, doors and skylights. Source: "Configurator Business Rules: Windows, Doors and
// Placement" v1.0 (13 Nov 2026). Quote price = price list x 1.10 (CAD, before HST).
// Sizes are width x height in inches (open item B). Every opening gets a header (P3) and may
// cross panel joints (P4), so the only placement rules are 12" to a corner (P1) and 12" between
// openings (P2): sum(widths) + 12 x (n - 1) + 24 <= wall length.
import { SIZES } from './catalog.js';

export const MARKUP = 1.10;
export const IN = 0.0254;
export const CLEAR = 12;      // P1 and P2, inches
export const HEAD = 82;       // door head above floor (2" sill + 80"); window heads align to it (open item D)

export const ITEMS = {
  D108: { kind: 'door', label: '108″ sliding patio door', short: '108″ slider', w: 108, h: 80, list: 2482.00, panels: 3 },
  D118: { kind: 'door', label: '118″ thermal sliding door', short: '118″ slider', w: 118, h: 80, list: 3640.09, panels: 3 },
  D60:  { kind: 'door', label: '60 × 72 thermal sliding door', short: '60″ slider', w: 60, h: 72, list: 1879.07, panels: 2 },
  D36:  { kind: 'door', label: '36″ full-lite door', short: '36″ door', w: 36, h: 80, list: 1717.72, panels: 1 },
  W1860: { kind: 'win', label: '18 × 60 tall window', short: '18×60 tall', w: 18, h: 60, list: 768.08, note: 'The 60 × 18 unit, installed vertically' },
  W6018: { kind: 'win', label: '60 × 18 high window', short: '60×18 high', w: 60, h: 18, list: 768.08, note: 'Sits high, above a fence line' },
  W3030: { kind: 'win', label: '30 × 30 window', short: '30×30', w: 30, h: 30, list: 772.83 },
  W3636: { kind: 'win', label: '36 × 36 window', short: '36×36', w: 36, h: 36, list: 710.00 },
  W4836: { kind: 'win', label: '48 × 36 window', short: '48×36', w: 48, h: 36, list: 929.66 },
  W3072: { kind: 'win', label: '30 × 72 window', short: '30×72', w: 30, h: 72, list: 1215.57 },
  W6072: { kind: 'win', label: '60 × 72 window', short: '60×72', w: 60, h: 72, list: 2450.00 }
};
export const SKYLIGHT = { label: 'Skylight 24 × 36', list: 1200.00, max: 2 };
export const DOORS = ['D108', 'D118', 'D60', 'D36'];
export const WINDOWS = ['W1860', 'W6018', 'W3030', 'W3636', 'W4836', 'W3072', 'W6072'];
export const WALLS = [['F', 'Front'], ['R', 'Back'], ['W', 'Left side'], ['E', 'Right side']]; // left/right as seen from the front
export const quote = id => Math.round((id === 'SKY' ? SKYLIGHT.list : ITEMS[id].list) * MARKUP * 100) / 100;

// Enclosed wall lengths in inches. Left/right sides run the enclosed depth; front/back the enclosed width.
export function wallLengths(st) {
  const [d, w] = SIZES[st.size];
  const Wr = w * 12 - (st.porch === 'wrap' ? 8 : 0), Dr = d * 12 - (st.porch !== 'none' ? 8 : 0);
  return { F: Wr, R: Wr, W: Dr, E: Dr };
}
export const needed = codes => codes.length ? codes.reduce((s, c) => s + ITEMS[c].w, 0) + CLEAR * (codes.length - 1) + 2 * CLEAR : 0;
export const fits = (L, codes) => needed(codes) <= L;

export function defaultDoor(st) { return fits(wallLengths(st).F, ['D108']) ? 'D108' : 'D60'; }
export function defaultOps(st) { return { F: [defaultDoor(st)], R: ['W4836'], W: [], E: ['W1860', 'W1860'] }; }

export const parse = s => {
  const o = { F: [], R: [], W: [], E: [] };
  for (const part of String(s || '').split('|')) {
    const [k, v] = part.split(':'); if (!o[k] || !v) continue;
    o[k] = v.split('.').filter(c => ITEMS[c]);
  }
  return o;
};
export const serialize = o => WALLS.map(([k]) => `${k}:${o[k].join('.')}`).join('|');

// Makes a state's openings legal for its footprint. Returns the cleaned set and notes for the client.
export function normalize(st) {
  const L = wallLengths(st), notes = [];
  const o = st.op ? parse(st.op) : defaultOps(st);
  for (const k of ['R', 'W', 'E']) o[k] = o[k].filter(c => ITEMS[c].kind === 'win');
  let door = o.F.find(c => ITEMS[c].kind === 'door') || defaultDoor(st);
  let wins = o.F.filter(c => ITEMS[c].kind === 'win');
  if (!fits(L.F, [door])) {
    const alt = DOORS.find(d => fits(L.F, [d]) && ITEMS[d].w < ITEMS[door].w);
    notes.push(`The ${ITEMS[door].short} needs ${needed([door])}″ of wall; this front is ${L.F}″, so it is now a ${ITEMS[alt].short}.`);
    door = alt;
  }
  while (wins.length && !fits(L.F, [door, ...wins])) { notes.push(`Removed a ${ITEMS[wins.at(-1)].short} window from the front: no room at this size.`); wins.pop(); }
  o.F = [door, ...wins];
  for (const k of ['R', 'W', 'E']) while (o[k].length && !fits(L[k], o[k])) {
    notes.push(`Removed a ${ITEMS[o[k].at(-1)].short} window from the ${WALLS.find(w => w[0] === k)[1].toLowerCase()} wall: no room at this size.`); o[k].pop();
  }
  let dp = ['l', 'c', 'r'].includes(st.dp) ? st.dp : 'r';
  if (dp === 'c' && !centreFits(L.F, door, wins)) dp = 'r';
  const sky = Math.max(0, Math.min(SKYLIGHT.max, parseInt(st.sky, 10) || 0));
  return { o, op: serialize(o), dp, sky: String(sky), notes, L };
}
// With the door centred, windows alternate left and right; each half must fit on its own.
function halves(door, wins) { const a = [], b = []; wins.forEach((c, i) => (i % 2 ? b : a).push(c)); return [a, b]; }
export function centreFits(L, door, wins) {
  const half = (L - ITEMS[door].w) / 2;
  return halves(door, wins).every(h => !h.length || h.reduce((s, c) => s + ITEMS[c].w, 0) + CLEAR * (h.length + 1) <= half);
}

// Positions, in metres along each wall (front/back: from the left corner; sides: from the back corner).
// Openings are spread evenly, which always satisfies P1 and P2 once the length check passes.
function spread(start, end, codes) {
  const free = (end - start) - codes.reduce((s, c) => s + ITEMS[c].w, 0), g = free / (codes.length + 1);
  let x = start + g; const out = [];
  for (const c of codes) { out.push([x, x + ITEMS[c].w]); x += ITEMS[c].w + g; }
  return out;
}
function rect(c, a0, a1) {
  const it = ITEMS[c], v1 = it.kind === 'door' ? 2 + it.h : HEAD;
  return { code: c, kind: it.kind, a0: a0 * IN, a1: a1 * IN, v0: (v1 - it.h) * IN, v1: v1 * IN, panels: it.panels || 0 };
}
export function layout(st) {
  const { o, dp, L } = normalize(st);
  const out = { F: [], R: [], W: [], E: [] };
  const [door, ...wins] = o.F, dw = ITEMS[door].w;
  if (dp === 'c') {
    const d0 = (L.F - dw) / 2, [a, b] = halves(door, wins);
    out.F.push(rect(door, d0, d0 + dw));
    spread(0, d0, a).forEach(([p, q], i) => out.F.push(rect(a[i], p, q)));
    spread(d0 + dw, L.F, b).forEach(([p, q], i) => out.F.push(rect(b[i], p, q)));
  } else {
    const d0 = dp === 'l' ? CLEAR : L.F - CLEAR - dw;
    out.F.push(rect(door, d0, d0 + dw));
    const [s, e] = dp === 'l' ? [d0 + dw, L.F] : [0, d0];
    spread(s, e, wins).forEach(([p, q], i) => out.F.push(rect(wins[i], p, q)));
  }
  for (const k of ['R', 'W', 'E']) spread(0, L[k], o[k]).forEach(([p, q], i) => out[k].push(rect(o[k][i], p, q)));
  return out;
}

// Price lines against the openings the base price already includes (included + credits).
export function priceLines(st) {
  const { o, sky } = normalize(st), d = defaultOps(st), lines = [];
  const door = o.F[0], dd = d.F[0];
  if (door !== dd) lines.push({ label: `Door: ${ITEMS[door].label} instead of ${ITEMS[dd].short}`, amount: quote(door) - quote(dd), group: 'openings' });
  const count = set => { const n = {}; for (const k of ['F', 'R', 'W', 'E']) for (const c of set[k]) if (ITEMS[c].kind === 'win') n[c] = (n[c] || 0) + 1; return n; };
  const now = count(o), base = count(d);
  for (const c of WINDOWS) {
    const diff = (now[c] || 0) - (base[c] || 0);
    const n = Math.abs(diff), x = n > 1 ? ` (${n})` : '';
    if (diff > 0) lines.push({ label: `Added ${ITEMS[c].label}${x}`, amount: diff * quote(c), group: 'openings' });
    if (diff < 0) lines.push({ label: `Removed ${ITEMS[c].label}${x}`, amount: diff * quote(c), group: 'openings' });
  }
  if (+sky) lines.push({ label: `${SKYLIGHT.label}${+sky > 1 ? ` (${sky})` : ''}`, amount: +sky * quote('SKY'), group: 'openings' });
  return lines.map(l => ({ ...l, amount: Math.round(l.amount) }));
}

// One-click starting layouts.
export function preset(name, st) {
  const L = wallLengths(st), best = (k, list) => list.find(c => fits(L[k], [c])) ;
  const door = name === 'light' ? (fits(L.F, ['D118']) ? 'D118' : defaultDoor(st)) : defaultDoor(st);
  if (name === 'standard') return { op: serialize(defaultOps(st)), dp: 'r', sky: '0' };
  if (name === 'light') {
    const sides = k => fits(L[k], ['W3072', 'W3072']) ? ['W3072', 'W3072'] : [best(k, ['W3072', 'W1860'])];
    return { op: serialize({ F: [door], R: [best('R', ['W6072', 'W4836'])], W: sides('W'), E: sides('E') }), dp: 'r', sky: '2' };
  }
  // privacy: high strips on the sides and back, light from above
  return { op: serialize({ F: [door], R: ['W6018'], W: ['W6018'], E: ['W6018'] }), dp: 'r', sky: '1' };
}
