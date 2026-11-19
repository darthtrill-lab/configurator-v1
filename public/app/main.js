import { SIZES, GROUPS, STEPS, INCLUDED, DEFAULT_STATE, MODEL_PRICES, applyRules, price, modelName } from './catalog.js';
import { Viewer } from './scene.js';
import { USES, fitsAt } from './furniture.js';
import { roomFor } from './building.js';
import { ITEMS, DOORS, WINDOWS, WALLS, SKYLIGHT, CLEAR, quote, normalize, parse, serialize, fits, needed, defaultDoor, centreFits, preset } from './openings.js';

const $ = s => document.querySelector(s);
const money = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-CA');
const signed = n => n === 0 ? 'Included' : (n > 0 ? '+' : '') + money(n);
const FT = 0.3048;
const ftin = f => { let a = Math.floor(f + 1e-6), i = Math.round((f - a) * 12); if (i === 12) { a++; i = 0; } return `${a}′-${i}″`; };

// ---------- state ----------
const st = { ...DEFAULT_STATE, furn: '1', use: 'office' };
const HASH_KEYS = ['porch', 'roof', 'size', 'use', 'op', 'dp', 'sky', 'panel', 'facade', 'walls', 'floor', 'heat', 'ufh', 'erv', 'elec', 'conn', 'bg', 'view', 'furn', 'step'];
function readHash() {
  const h = location.hash.replace(/^#/, '');
  for (const pair of h.split('&')) {
    const [k, v] = pair.split('='); if (!k || v == null) continue;
    if (k === 'size') { const i = parseInt(v, 10); if (i >= 0 && i < SIZES.length) st.size = i; continue; }
    if (HASH_KEYS.includes(k)) st[k] = decodeURIComponent(v);
  }
  for (const [k, g] of Object.entries(GROUPS)) if (!g.choices[st[k]]) st[k] = g.default;
  if (!STEPS.some(s => s.id === st.step)) st.step = 'model';
  if (!USES[st.use]) st.use = 'office';
}
function writeHash() {
  history.replaceState(null, '', '#' + HASH_KEYS.map(k => `${k}=${encodeURIComponent(st[k])}`).join('&'));
}

// ---------- viewer ----------
const viewer = new Viewer($('#stage'));
let meta, buildKey = '', locks = {};
function buildSig() { return ['porch', 'roof', 'size', 'use', 'op', 'dp', 'sky', 'panel', 'facade', 'walls', 'floor', 'heat', 'erv', 'elec', 'furn'].map(k => st[k]).join('|'); }

let opNotes = [];
async function render(opts = {}) {
  locks = applyRules(st);
  const n = normalize(st); st.op = n.op; st.dp = n.dp; st.sky = n.sky; opNotes = n.notes;
  const sig = buildSig();
  if (sig !== buildKey) {
    buildKey = sig;
    meta = viewer.setBuilding({ ...st, furnish: st.furn === '1' });
    scheduleAR();
  }
  if (opts.scene || !viewer.sceneKey) await viewer.setScene(st.bg);
  viewer.applyView(st.view);
  writeHash();
  drawChrome();
  drawStep();
}

// ---------- chrome: header, overlays, price ----------
function drawChrome() {
  const [d, w] = SIZES[st.size], p = price(st), name = modelName(st);
  $('#m-name').textContent = name;
  $('#m-size').textContent = `${d} × ${w} · ${d * w} sf`;
  $('#p-total').textContent = money(p.total);
  $('#f-total').textContent = money(p.total);
  document.querySelector('.loading')?.remove();
  $('#p-pre').textContent = `${money(p.preTax)} before tax`;
  $('#p-note').textContent = p.connPending ? 'Connection to your home quoted after a panel photo' : 'Includes your connection route';
  for (const b of document.querySelectorAll('[data-bg]')) b.setAttribute('aria-pressed', b.dataset.bg === st.bg);
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', b.dataset.view === st.view);
  const i = STEPS.findIndex(s => s.id === st.step);
  $('#steps').innerHTML = STEPS.map((s, k) =>
    `<button class="step${s.id === st.step ? ' on' : ''}${k < i ? ' done' : ''}" data-step="${s.id}" title="${s.label}"><span>${k < i ? '✓' : k + 1}</span><em>${s.label}</em></button>`).join('');
  $('#progress').style.width = `${(i / (STEPS.length - 1)) * 100}%`;
  $('#b-back').hidden = i === 0;
  $('#b-next').textContent = i === STEPS.length - 1 ? 'Book a call about this build' : `Next: ${STEPS[i + 1].label}`;
}

// ---------- step panels ----------
const plan = inner => `<svg width="46" height="30" viewBox="0 0 46 30" fill="none" aria-hidden="true">${inner}</svg>`;
const S = 'stroke="currentColor" stroke-width="1.6"', F = 'fill="currentColor" opacity=".16"';
const PORCH_PICS = {
  none: plan(`<rect x="6" y="6" width="34" height="18" ${F}/><rect x="6" y="6" width="34" height="18" ${S}/>`),
  front: plan(`<rect x="6" y="6" width="34" height="12" ${F}/><rect x="6" y="6" width="34" height="12" ${S}/><rect x="6" y="18" width="34" height="6" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2"/>`),
  wrap: plan(`<rect x="6" y="6" width="28" height="12" ${F}/><rect x="6" y="6" width="28" height="12" ${S}/><path d="M6 18h34M34 6v18" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2"/>`)
};
const ROOF_PICS = {
  flush: plan(`<path d="M8 12L38 8" ${S}/><rect x="8" y="12" width="30" height="12" ${F}/><rect x="8" y="12" width="30" height="12" ${S}/>`),
  over: plan(`<path d="M4 12L42 7" ${S}/><rect x="9" y="13" width="28" height="11" ${F}/><rect x="9" y="13" width="28" height="11" ${S}/>`)
};

function chip({ key, value, label, sub, pic, swatch, on, disabled }) {
  return `<button class="chip${pic ? ' pic' : ''}" data-key="${key}" data-value="${value}" aria-pressed="${on}" ${disabled ? 'disabled' : ''}>
    ${pic || ''}${swatch ? `<i style="background:${swatch}"></i>` : ''}<span class="cl">${label}</span>${sub ? `<small>${sub}</small>` : ''}</button>`;
}
function groupChips(key, opts = {}) {
  const g = GROUPS[key], area = price(st).area;
  const chips = Object.entries(g.choices).map(([v, c]) => {
    if (opts.filter && !opts.filter(v)) return '';
    const amt = Math.round(c.price(area));
    const sub = key === 'conn' && v === 'unsure' ? 'Quoted later' : signed(amt);
    return chip({ key, value: v, label: c.label, sub, swatch: c.swatch, on: st[key] === v });
  }).join('');
  const note = opts.note || (g.choices[st[key]]?.note ? g.choices[st[key]].note : '');
  return `<div class="grp"><div class="gl">${g.title}</div><div class="row">${chips}</div>${note ? `<p class="note">${note}</p>` : ''}${locks[key] ? `<p class="lock">${locks[key]}</p>` : ''}</div>`;
}
function toggle(key, label) {
  const g = GROUPS[key], area = price(st).area, c = g.choices.yes, on = st[key] === 'yes';
  return `<label class="tog"><input type="checkbox" data-toggle="${key}" ${on ? 'checked' : ''}><span>${c.label}</span><small>${signed(Math.round(c.price(area)))}</small></label>`;
}

function drawStep() {
  const el = $('#step-body'), area = price(st).area;
  let html = '';
  if (st.step === 'model') {
    html += `<h2>Pick the shape</h2><p class="lede">Set the porch and roof. The model name follows from them.</p>`;
    html += `<div class="grp"><div class="gl">Porch</div><div class="row">` +
      ['none', 'front', 'wrap'].map(v => chip({ key: 'porch', value: v, label: { none: 'None', front: 'Front', wrap: 'Wrap' }[v], pic: PORCH_PICS[v],
        sub: v === 'none' ? 'Included' : signed(MODEL_PRICES.porch + 1250), on: st.porch === v })).join('') + `</div>
      ${st.porch !== 'none' ? '<p class="note">Porch price includes the $1,250 cedar front it requires.</p>' : ''}</div>`;
    html += `<div class="grp"><div class="gl">Roof</div><div class="row">` +
      ['flush', 'over'].map(v => chip({ key: 'roof', value: v, label: v === 'flush' ? 'Flush' : '6″ overhang', pic: ROOF_PICS[v],
        sub: v === 'flush' ? 'Included' : signed(MODEL_PRICES.overhang), on: st.roof === v, disabled: st.porch !== 'none' })).join('') +
      `</div>${locks.roof ? `<p class="lock">${locks.roof}</p>` : ''}</div>`;
    html += `<div class="callout"><b>${modelName(st)}</b> — ${{ WunderStudio: 'clean box, flush roof.', WunderShed: 'flush walls with a 6″ roof overhang all round.', WunderCabin: 'recessed cedar front with a covered porch strip.', WunderCabana: 'cedar porch that wraps the front and one side.' }[modelName(st)]}</div>`;
  }
  if (st.step === 'size') {
    html += `<h2>Size and use</h2><p class="lede">Pick how you'll use it, then a footprint. The furniture is drawn to scale, so you can see what fits.</p>`;
    html += `<div class="grp"><div class="gl">How will you use it?</div><div class="row uses">` +
      Object.entries(USES).map(([v, u]) => chip({ key: 'use', value: v, label: u.label, on: st.use === v })).join('') + `</div></div>`;
    html += useGuide();
    html += `<div class="gl">Footprint</div><p class="note" style="margin-top:0">Prices include the shell, insulation, windows, slider, interior finish, mini split and Essential electrical.</p><div class="row sizes">`;
    html += SIZES.map(([d, w], i) => { const pp = price({ ...st, size: i });
      return chip({ key: 'size', value: i, label: `${d} × ${w}`, sub: `${d * w} sf · ${money(pp.total)}`, on: st.size === i }); }).join('') + '</div>';
    html += `<dl class="dims"><div><dt>Exterior</dt><dd>${ftin(meta.W / FT)} × ${ftin(meta.D / FT)}</dd></div><div><dt>Interior</dt><dd>${ftin(meta.interiorW)} × ${ftin(meta.interiorD)}</dd></div>
      <div><dt>Ceiling</dt><dd>8′-0″</dd></div><div><dt>Slider</dt><dd>${Math.round(meta.doorW)}″ × 80″</dd></div></dl>`;
    if (meta.warn) html += `<p class="lock">${meta.warn}</p>`;
    html += `<p class="note">Under 10 m² (108 sf) usually needs no building permit in Toronto. Larger sizes may need one; we check your lot.</p>`;
  }
  if (st.step === 'exterior') {
    html += `<h2>Exterior finish</h2><p class="lede">Steel cladding in three colours. Porch models get a cedar front.</p>`;
    html += groupChips('panel');
    html += groupChips('facade', { filter: v => st.porch !== 'none' ? v === 'wood' : v !== 'wood' });
  }
  if (st.step === 'openings') html += openingsPanel();
  if (st.step === 'interior') {
    html += `<h2>Inside</h2><p class="lede">Switch to <b>Inside</b> on the viewer to look in from above.</p>`;
    html += groupChips('walls') + groupChips('floor');
    html += `<label class="tog plain"><input type="checkbox" data-furn ${st.furn === '1' ? 'checked' : ''}><span>Show ${USES[st.use].label.toLowerCase()} furniture</span><small>Drawn to scale</small></label>`;
  }
  if (st.step === 'climate') {
    html += `<h2>Heating and cooling</h2><p class="lede">Every Wundershed is insulated to R29 or better. A mini split is included.</p>`;
    html += groupChips('heat');
    html += `<div class="grp"><div class="gl">Add-ons</div>${toggle('ufh')}${toggle('erv')}</div>`;
  }
  if (st.step === 'electrical') {
    html += `<h2>Power and lighting</h2><p class="lede">Permit and ESA inspection are always included. Try <b>Dusk</b> to see the lights on.</p>`;
    html += `<div class="grp"><div class="gl">Package</div><div class="cards">` + Object.entries(GROUPS.elec.choices).map(([v, c]) =>
      `<button class="card" data-key="elec" data-value="${v}" aria-pressed="${st.elec === v}"><b>${c.label}</b><span>${c.note}</span><small>${signed(c.price(area))}</small></button>`).join('') + `</div></div>`;
    html += groupChips('conn');
  }
  if (st.step === 'review') {
    const p = price(st), [d, w] = SIZES[st.size];
    const li = l => `<li><span>${l.label}</span><b>${signed(l.amount)}</b></li>`;
    html += `<h2>Your ${modelName(st)}</h2><p class="lede">${d} × ${w} ft · ${d * w} sf · ${GROUPS.panel.choices[st.panel].label} steel${st.porch !== 'none' ? ' with cedar front' : ''} · set up as ${useName(st.use)}</p>`;
    const o = parse(st.op);
    html += `<div class="rv"><div class="rvh">Windows and doors</div><ul>${WALLS.map(([k, name]) => `<li><span>${name}</span><b>${o[k].length ? o[k].map(c => ITEMS[c].short).join(', ') : '—'}</b></li>`).join('')}${+st.sky ? `<li><span>Roof</span><b>${st.sky} × skylight</b></li>` : ''}</ul></div>`;
    html += `<div class="rv"><div class="rvh">Base build</div><ul><li><span>${modelName(st)} ${d} × ${w}, as listed below</span><b>${money(p.base)}</b></li></ul>
      <details open><summary>What's included</summary><ul class="inc">${INCLUDED.map(t => `<li>${t}</li>`).join('')}</ul></details></div>`;
    if (p.upgrades.length) html += `<div class="rv"><div class="rvh">Upgrades</div><ul>${p.upgrades.map(li).join('')}</ul></div>`;
    if (p.credits.length) html += `<div class="rv"><div class="rvh">Credits</div><ul>${p.credits.map(li).join('')}</ul></div>`;
    html += `<div class="rv tot"><ul><li><span>Before tax</span><b>${money(p.preTax)}</b></li><li><span>HST 13%</span><b>${money(p.hst)}</b></li><li class="big"><span>Total</span><b>${money(p.total)}</b></li></ul>
      ${p.connPending ? '<p class="note">Connection to your home is not included yet. Fence-line runs start at $1,750; we confirm the route from a photo of your panel.</p>' : ''}
      <p class="note">Indicative price. We confirm it after a site check of access, foundation and power.</p></div>`;
    html += `<div class="actions"><button class="abtn" id="b-copy">Copy link to this design</button><button class="abtn" id="b-print">Save as PDF</button><span class="said" id="said"></span></div>`;
  }
  el.innerHTML = html;
}

// ---------- use-case guidance ----------
const useName = u => ({ office: 'an office', gym: 'a gym', art: 'an art studio', guest: 'a guest room', flex: 'a flex room', music: 'a music room' })[u];
function tally(labels) {
  const n = {}; for (const l of labels) n[l] = (n[l] || 0) + 1;
  return Object.entries(n).map(([l, k]) => k > 1 ? `${k} × ${l.toLowerCase()}` : l);
}
function useGuide() {
  const [d, w] = SIZES[st.size], u = USES[st.use];
  const now = fitsAt(st.use, st.size, roomFor(st)).labels;
  let html = `<div class="callout use"><b>${u.label}</b> — ${u.blurb}<div class="fits"><span>${d} × ${w} fits</span><ul>${tally(now).map(t => `<li>${t}</li>`).join('')}</ul></div>`;
  if (st.size < SIZES.length - 1) {
    const [d2, w2] = SIZES[st.size + 1];
    const next = fitsAt(st.use, st.size + 1, roomFor({ ...st, size: st.size + 1 })).labels;
    const have = {}; for (const l of now) have[l] = (have[l] || 0) + 1;
    const add = []; for (const l of next) { if (have[l]) have[l]--; else add.push(l); }
    if (add.length) html += `<p class="up">Step up to <button class="link" data-key="size" data-value="${st.size + 1}">${d2} × ${w2}</button> to add ${tally(add).map(t => t.toLowerCase()).join(', ')}.</p>`;
  } else html += `<p class="up">The largest footprint: room for everything on the list with clear walkways.</p>`;
  return html + `</div>`;
}

// ---------- windows and doors ----------
const inch = n => `${Math.floor(n / 12)}′-${Math.round(n % 12)}″`;
function openingsPanel() {
  const n = normalize(st), o = n.o, L = n.L, door = o.F[0], dDef = defaultDoor(st);
  const fmt = v => v === 0 ? 'Included' : (v > 0 ? '+' : '−') + '$' + Math.abs(Math.round(v)).toLocaleString('en-CA');
  let html = `<h2>Windows and doors</h2><p class="lede">Every opening gets a header, so any of these can go on any wall, as long as it keeps 12″ from corners and from other openings.</p>`;
  html += `<div class="grp"><div class="gl">Start from</div><div class="row">` +
    [['standard', 'Standard'], ['light', 'More light'], ['privacy', 'Privacy']].map(([v, l]) => `<button class="chip" data-preset="${v}"><span class="cl">${l}</span><small>${{ standard: 'As included', light: 'Big glass, 2 skylights', privacy: 'High windows, 1 skylight' }[v]}</small></button>`).join('') + `</div></div>`;
  // door
  const wins = o.F.slice(1);
  html += `<div class="grp"><div class="gl">Door · front wall ${inch(L.F)}</div><div class="row">` + DOORS.map(d => {
    const ok = fits(L.F, [d, ...wins]);
    return chip({ key: 'door', value: d, label: ITEMS[d].short, sub: ok ? fmt(quote(d) - quote(dDef)) : `Needs ${inch(needed([d, ...wins]))}`, on: door === d, disabled: !ok });
  }).join('') + `</div><div class="row" style="margin-top:8px">` + [['l', 'Left'], ['c', 'Centre'], ['r', 'Right']].map(([v, l]) =>
    chip({ key: 'dp', value: v, label: l, on: n.dp === v, disabled: v === 'c' && !centreFits(L.F, door, wins) })).join('') + `</div><p class="note">Left and right as you face the front.</p></div>`;
  // walls
  for (const [k, name] of WALLS) {
    const list = o[k], free = L[k] - needed(list.length ? list : []) - (list.length ? 0 : 2 * CLEAR);
    const items = (k === 'F' ? list.slice(1) : list).map((c, i) => `<button class="pill" data-rm="${k}:${k === 'F' ? i + 1 : i}" title="Remove">${ITEMS[c].short}<span aria-hidden="true">×</span></button>`).join('');
    const opts = WINDOWS.map(c => {
      const ok = fits(L[k], [...list, c]);
      return `<option value="${c}" ${ok ? '' : 'disabled'}>${ITEMS[c].label} · ${ok ? '+$' + Math.round(quote(c)).toLocaleString('en-CA') : 'no room'}</option>`;
    }).join('');
    html += `<div class="grp"><div class="gl">${name} wall · ${inch(L[k])} · ${Math.max(0, Math.round(free))}″ free</div>
      <div class="row">${items || '<span class="note" style="margin:0">No windows</span>'}</div>
      <select class="add" data-add="${k}"><option value="">+ Add a window…</option>${opts}</select></div>`;
  }
  html += `<div class="grp"><div class="gl">Skylights</div><div class="row">` + [0, 1, 2].map(v =>
    chip({ key: 'sky', value: String(v), label: v === 0 ? 'None' : `${v} × 24×36`, sub: v ? '+$' + Math.round(v * quote('SKY')).toLocaleString('en-CA') : 'Included', on: st.sky === String(v) })).join('') + `</div></div>`;
  if (opNotes.length) html += opNotes.map(t => `<p class="lock">${t}</p>`).join('');
  html += `<p class="note">Window prices are the supplier list plus 10%. Next to a fence, we usually fit the 60 × 18 high window above the fence line; we confirm this in the design call.</p>`;
  return html;
}

// ---------- events ----------
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.key) {
    const k = b.dataset.key; st[k] = k === 'size' ? parseInt(b.dataset.value, 10) : b.dataset.value;
    if (k === 'porch' && st.porch !== 'none') st.roof = 'flush';
    if (k === 'use') { st.view = 'in'; st.furn = '1'; await render(); viewer.look('inside'); return; }
    if (k === 'door') { const o = parse(st.op); o.F[0] = b.dataset.value; st.op = serialize(o); delete st.door; return render(); }
    return render();
  }
  if (b.dataset.step) { st.step = b.dataset.step; return render(); }
  if (b.dataset.preset) { Object.assign(st, preset(b.dataset.preset, st)); st.view = 'out'; viewer.look('home'); return render(); }
  if (b.dataset.rm) { const [k, i] = b.dataset.rm.split(':'); const o = parse(st.op); o[k].splice(+i, 1); st.op = serialize(o); return render(); }
  if (b.dataset.bg) { st.bg = b.dataset.bg; return render({ scene: true }); }
  if (b.dataset.view) { st.view = b.dataset.view; viewer.look(st.view === 'in' ? 'inside' : 'home'); return render(); }
  if (b.dataset.cam) { if (st.view === 'in' && b.dataset.cam !== 'inside') { st.view = 'out'; viewer.applyView('out'); } viewer.look(b.dataset.cam); return drawChrome(); }
  if (b.id === 'b-next') {
    const i = STEPS.findIndex(s => s.id === st.step);
    if (i < STEPS.length - 1) { st.step = STEPS[i + 1].id; return render(); }
    return bookCall();
  }
  if (b.id === 'b-back') { const i = STEPS.findIndex(s => s.id === st.step); st.step = STEPS[Math.max(0, i - 1)].id; return render(); }
  if (b.id === 'b-ar') return openAR();
  if (b.id === 'qr-close') { $('#qr').hidden = true; return; }
  if (b.id === 'b-copy') { await navigator.clipboard?.writeText(location.href).catch(() => {}); $('#said').textContent = 'Link copied'; return; }
  if (b.id === 'b-print') return window.print();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.toggle) { st[t.dataset.toggle] = t.checked ? 'yes' : 'no'; render(); }
  if ('furn' in t.dataset) { st.furn = t.checked ? '1' : '0'; render(); }
  if (t.dataset.add && t.value) { const o = parse(st.op); o[t.dataset.add].push(t.value); st.op = serialize(o); render(); }
});

function bookCall() {
  const p = price(st), [d, w] = SIZES[st.size];
  const summary = `${modelName(st)} ${d}x${w} (${USES[st.use].label}), indicative ${money(p.total)} incl. HST. Design: ${location.href}`;
  window.open('https://calendly.com/wundershed/30min?a1=' + encodeURIComponent(summary), '_blank', 'noopener');
}

// ---------- AR ----------
let arTimer, arURL;
function scheduleAR() {
  clearTimeout(arTimer);
  arTimer = setTimeout(async () => {
    try {
      const blob = await viewer.exportGLB();
      if (arURL) URL.revokeObjectURL(arURL);
      arURL = URL.createObjectURL(blob);
      $('#ar-mv').src = arURL;
    } catch (err) { console.warn('AR export failed', err); }
  }, 700);
}
async function openAR() {
  const mv = $('#ar-mv');
  if (mv && mv.canActivateAR) return mv.activateAR();
  $('#qr').hidden = false;
  const box = $('#qrbox');
  if (!window.qrcode) await new Promise(res => { const s = document.createElement('script'); s.src = window.WS_CDN.qr; s.onload = res; s.onerror = res; document.head.appendChild(s); });
  if (window.qrcode) { const q = window.qrcode(0, 'M'); q.addData(location.href); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0 }); }
  else box.textContent = 'Copy the link and open it on your phone.';
}

readHash();
render({ scene: true }).then(() => { if (st.view === 'in') viewer.look('inside'); });
window.__ws = { st, price: () => price(st), viewer, render };
