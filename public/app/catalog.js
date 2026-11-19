// Wundershed configurator v2 — options, rules and prices.
import { priceLines as openingLines } from './openings.js';
// Pricing model: "included + credits". The base curve is anchored on Estimate 1092-Shed 119
// (15 Bamber), so the base already contains the items marked included below. Upgrades add,
// downgrades credit. All amounts are CAD before HST.
// Sources: est119 = Estimate 1092-Shed 119; sheet = Wundershed Pricing (Apr 2026);
// elec = Electrical Pricing Handout v2 (Nov 2026); co = Nov 2026 change orders (Bamber, Birchmount).

export const SIZES = [ // [depth ft, width ft]
  [8, 10], [10, 12], [10, 14], [10, 16]
];

export const BASE = { perSf: 190.268625, fixed: 17273.51, hst: 0.13, floor: 30000 };

// Included in the base (from est119). Shown on the Review screen.
export const INCLUDED = [
  'Insulated SIP body, min. R29 floor, walls and roof',
  'Steel exterior cladding and black steel roof',
  '108″ sliding patio door (60 × 72 slider on a 10 ft front), two 18 × 60 side windows, 48 × 36 back window',
  'Maple/birch interior walls',
  'Luxury vinyl plank floor',
  '9,000 BTU ductless mini split, installed',
  'Essential electrical: 30A sub panel, outlets, ceiling light, mini-split circuit',
  'Rapid foundation, labour and installation, GTA delivery'
];

// Each choice: label, price(areaSf) -> number, note (shown under the chip), src.
export const GROUPS = {
  panel: {
    title: 'Panel colour', step: 'exterior', default: 'grey',
    choices: {
      cream: { label: 'Cream', swatch: '#E6E2D6', color: 0xd9d4c4, price: () => 0, src: 'est116/co' },
      grey:  { label: 'Light grey', swatch: '#C9C6BE', color: 0xb9b6ae, price: () => 0, src: 'est119' },
      char:  { label: 'Charcoal', swatch: '#3A3835', color: 0x3a3936, price: () => 0, src: 'est116 (black steel, same rate)' }
    }
  },
  facade: {
    title: 'Front facade', step: 'exterior', default: 'metal',
    choices: {
      metal: { label: 'Steel', price: () => 0, src: 'est119' },
      black: { label: 'Black steel', swatch: '#1B1B1C', price: () => 0, src: 'est116' },
      wood:  { label: 'Cedar', swatch: '#9A5A2E', price: () => 1250, src: 'Mill St 2025 cedar accent' }
    }
  },
  walls: {
    title: 'Interior walls', step: 'interior', default: 'birch',
    choices: {
      birch:   { label: 'Maple/birch plywood', price: () => 0, src: 'est119 (included)' },
      shiplap: { label: 'White shiplap', price: () => 0, src: 'sheet: shiplap and maple/birch both $24' },
      osb:     { label: 'OSB (unfinished)', price: a => -(22.96 * a) + 200, src: 'est119 $2,296/100 sf credited; sheet OSB $200' }
    }
  },
  floor: {
    title: 'Flooring', step: 'interior', default: 'lvp',
    choices: {
      lvp:    { label: 'Luxury vinyl plank', price: () => 0, src: 'est119 (included, $9/sf)' },
      oak:    { label: 'Engineered wood', price: a => -2 * a, src: 'Birchmount 2026: $7/sf vs LVP $9/sf' },
      rubber: { label: 'Rubber gym floor', price: a => 3.5 * a, src: 'sheet: rubber $12 vs LVP $8.50 /sf' },
      osb:    { label: 'OSB subfloor only', price: a => -(9 * a) + 200, src: 'est119 LVP credited; sheet OSB $200' }
    }
  },
  heat: {
    title: 'Heating and cooling', step: 'climate', default: 'split9',
    choices: {
      split9:  { label: 'Mini split 9,000 BTU', price: () => 0, src: 'est119 (included)' },
      split12: { label: 'Mini split 12,000 BTU', price: () => 0, src: 'co: upsize at no change' },
      ceramic: { label: 'Ceramic panel heaters ×2', price: () => -3200 + 2 * 210, src: 'est119 mini split $3,200 credited; sheet $210 each' }
    }
  },
  ufh: {
    title: 'Underfloor heating', step: 'climate', default: 'no', toggle: true,
    choices: {
      no:  { label: 'None', price: () => 0 },
      yes: { label: 'Add underfloor heating', price: a => 15.25 * a, src: 'Birchmount 2026: $1,525 per 100 sf' }
    }
  },
  erv: {
    title: 'Fresh air (ERV)', step: 'climate', default: 'no', toggle: true,
    choices: {
      no:  { label: 'None', price: () => 0 },
      yes: { label: 'Add ERV with circuit', price: () => 1355, src: 'co Birchmount: ERV $1,200 + circuit $155' }
    }
  },
  elec: {
    title: 'Electrical package', step: 'electrical', default: 'essential',
    choices: {
      essential: { label: 'Essential', price: () => 0, note: '4 outlets, ceiling light', src: 'elec (included)',
                   pots: 0, ceiling: 1, outdoor: 0 },
      comfort:   { label: 'Comfort', price: () => 1200, note: '6 outlets + outdoor, 4 pot lights, outdoor light', src: 'elec: $2,525 − $1,325',
                   pots: 4, ceiling: 0, outdoor: 1 },
      complete:  { label: 'Complete', price: () => 2250, note: '8 outlets + floor + outdoor, 6 pot lights, 2 outdoor lights', src: 'elec: $3,575 − $1,325',
                   pots: 6, ceiling: 0, outdoor: 2 }
    }
  },
  conn: {
    title: 'Connection to your home', step: 'electrical', default: 'unsure',
    choices: {
      unsure: { label: 'Not sure yet', price: () => 0, note: 'Quoted after a panel photo' },
      fence:  { label: 'Fence-line, up to 100 ft', price: () => 1750, src: 'elec' },
      ug20:   { label: 'Underground, up to 20 ft', price: () => 2325, src: 'elec' },
      ug40:   { label: 'Underground, 21–40 ft', price: () => 3150, src: 'elec' }
    }
  }
};

export const MODEL_PRICES = { porch: 1000, overhang: 400 }; // Tha, 10 Nov 2026

export const STEPS = [
  { id: 'model', label: 'Model' },
  { id: 'size', label: 'Size' },
  { id: 'exterior', label: 'Exterior' },
  { id: 'openings', label: 'Windows' },
  { id: 'interior', label: 'Interior' },
  { id: 'climate', label: 'Climate' },
  { id: 'electrical', label: 'Electrical' },
  { id: 'review', label: 'Review' }
];

export function modelName(st) {
  if (st.porch === 'wrap') return 'WunderCabana';
  if (st.porch === 'front') return 'WunderCabin';
  return st.roof === 'over' ? 'WunderShed' : 'WunderStudio';
}

// Applies the range rules. Returns notes explaining any locked option.
export function applyRules(st) {
  const locks = {};
  if (st.porch !== 'none') {
    st.roof = 'flush';
    st.facade = 'wood';
    locks.roof = 'A porch builds its own 8″ soffit, so the roof stays flush.';
    locks.facade = 'Porch models use cedar on the recessed front.';
  } else if (st.facade === 'wood') {
    st.facade = 'metal';
  }
  if (st.heat === 'ceramic' && st.erv === 'yes') { /* allowed */ }
  return locks;
}

export function price(st) {
  const [d, w] = SIZES[st.size];
  const area = d * w;
  const base = BASE.perSf * area + BASE.fixed;
  const lines = [];
  if (st.porch !== 'none') lines.push({ label: (st.porch === 'wrap' ? 'Wrap' : 'Front') + ' porch', amount: MODEL_PRICES.porch });
  if (st.porch === 'none' && st.roof === 'over') lines.push({ label: '6″ roof overhang', amount: MODEL_PRICES.overhang });
  for (const [key, g] of Object.entries(GROUPS)) {
    const c = g.choices[st[key]];
    if (!c) continue;
    const amt = Math.round(c.price(area));
    if (amt !== 0) lines.push({ label: (g.toggle ? '' : g.title + ': ') + c.label, amount: amt, group: key });
  }
  lines.push(...openingLines(st));
  const upgrades = lines.filter(l => l.amount > 0);
  const credits = lines.filter(l => l.amount < 0);
  const preTax = base + lines.reduce((s, l) => s + l.amount, 0);
  const total = Math.max(BASE.floor, preTax * (1 + BASE.hst));
  return { area, base, upgrades, credits, preTax, hst: total - preTax, total, connPending: st.conn === 'unsure' };
}

export const DEFAULT_STATE = {
  porch: 'none', roof: 'flush', size: 3,
  ...Object.fromEntries(Object.entries(GROUPS).map(([k, g]) => [k, g.default])),
  op: '', dp: 'r', sky: '0',
  bg: 'yard', view: 'out', step: 'model'
};
