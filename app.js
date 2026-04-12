/* ===== VenueIQ — app.js v2 ===== */
'use strict';

// ─── Utilities ────────────────────────────────────────────────────────────────
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function animateCounter(el, target, duration = 950, format = v => v.toLocaleString()) {
  if (!el) return;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ─── Panel Navigation ─────────────────────────────────────────────────────────
const panelMeta = {
  crowd: { title: 'Crowd Flow', sub: 'Real-time density monitoring' },
  waits: { title: 'Wait Times', sub: 'Concession & restroom queues' },
  entry: { title: 'Entry Routing', sub: 'Gate status & smart redirects' },
  app: { title: 'Fan App', sub: 'Attendee mobile experience' },
  alerts: { title: 'Live Alerts', sub: 'Operations feed & incident log' },
  arch: { title: 'Architecture', sub: 'System design & data layers' },
  analytics: { title: 'Analytics', sub: 'Event insights & performance KPIs' },
};

$$('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const id = item.dataset.panel;
    if (!id) return;
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    switchPanel(id);
    updateNavPill();
  });
});

function switchPanel(id) {
  const old = $('.panel.active');
  if (old) old.classList.remove('active');

  const panel = document.getElementById('panel-' + id);
  if (!panel) return;

  // Restart CSS stagger animation on children
  $$(':scope > *', panel).forEach(child => {
    child.style.animation = 'none';
    void child.offsetWidth;
    child.style.animation = '';
  });
  panel.classList.add('active');

  const meta = panelMeta[id];
  if (meta) {
    const t = document.getElementById('page-title');
    const s = $('.page-sub');
    if (t) t.textContent = meta.title;
    if (s) s.textContent = meta.sub;
  }

  // Panel-specific callbacks
  const callbacks = {
    crowd: () => initHeatmapCanvas(),
    waits: () => { renderRingCharts(); renderWaits(activeWaitCat); },
    entry: () => renderGateSparklines(),
    analytics: () => { renderAttendanceChart(); renderEntryExitChart(); renderActionsSummary(); animateAnalyticsKPIs(); },
  };
  if (callbacks[id]) callbacks[id]();
}

// ─── Nav Pill ─────────────────────────────────────────────────────────────────
function updateNavPill() {
  const sidenav = $('.sidenav');
  const active = $('.nav-item.active');
  const pill = document.getElementById('nav-pill');
  if (!sidenav || !active || !pill) return;
  const navRect = sidenav.getBoundingClientRect();
  const itemRect = active.getBoundingClientRect();
  pill.style.top = (itemRect.top - navRect.top + sidenav.scrollTop) + 'px';
}
window.addEventListener('load', () => { updateNavPill(); });
setTimeout(updateNavPill, 80);

// ─── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const clockEl = document.getElementById('clock');
  const appEl = document.getElementById('app-time');
  const barFill = document.getElementById('clock-bar-fill');
  if (clockEl) clockEl.textContent = `${hh}:${mm}:${ss}`;
  if (appEl) appEl.textContent = `${hh}:${mm}`;
  if (barFill) barFill.style.width = `${(now.getSeconds() / 59) * 100}%`;
}
updateClock();
setInterval(updateClock, 1000);

// ─── Match minute ─────────────────────────────────────────────────────────────
let matchMin = 67;
setInterval(() => {
  matchMin = (matchMin % 90) + 1;
  const el = document.getElementById('match-min');
  if (el) el.textContent = matchMin + "'";
}, 20000);

// ─── Canvas Heatmap ───────────────────────────────────────────────────────────
let hmAnimId = null;
let hmPhase = 0;
let hmDensity = 78;

const HM_ZONES = [
  { x: 0.50, y: 0.18, r: 0.22, level: 'high' },
  { x: 0.50, y: 0.82, r: 0.22, level: 'med' },
  { x: 0.87, y: 0.50, r: 0.15, level: 'high' },
  { x: 0.13, y: 0.50, r: 0.15, level: 'low' },
  { x: 0.74, y: 0.23, r: 0.11, level: 'low' },
  { x: 0.26, y: 0.23, r: 0.11, level: 'med' },
  { x: 0.74, y: 0.77, r: 0.11, level: 'low' },
  { x: 0.26, y: 0.77, r: 0.11, level: 'low' },
];

function zoneColor(level, density, pulse) {
  const pa = pulse * 0.1;
  if (density > 70) {
    if (level === 'high') return [`rgba(226,75,74,${0.58 + pa})`, 'rgba(226,75,74,0)'];
    if (level === 'med') return [`rgba(239,159,39,${0.50 + pa})`, 'rgba(239,159,39,0)'];
    return [`rgba(29,158,117,${0.44 + pa})`, 'rgba(29,158,117,0)'];
  }
  if (density > 45) {
    if (level === 'high') return [`rgba(239,159,39,${0.54 + pa})`, 'rgba(239,159,39,0)'];
    if (level === 'med') return [`rgba(239,159,39,${0.44 + pa})`, 'rgba(239,159,39,0)'];
    return [`rgba(29,158,117,${0.44 + pa})`, 'rgba(29,158,117,0)'];
  }
  return [`rgba(29,158,117,${0.44 + pa})`, 'rgba(29,158,117,0)'];
}

function drawHeatmap() {
  const canvas = document.getElementById('heatmap-canvas');
  if (!canvas || !canvas.isConnected) { hmAnimId = null; return; }

  const wrap = canvas.parentElement;
  const W = wrap.clientWidth || 420;
  const H = wrap.clientHeight || 240;
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const cx = W * 0.5, cy = H * 0.5;

  // Outer venue ring
  ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.46, H * 0.44, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#040d16'; ctx.fill();
  ctx.strokeStyle = '#1b3a5e'; ctx.lineWidth = 1.5; ctx.stroke();

  // Inner concourse
  ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.36, H * 0.34, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#030b14'; ctx.fill();
  ctx.strokeStyle = '#122638'; ctx.lineWidth = 1; ctx.stroke();

  // Pitch
  ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.22, H * 0.24, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0b2a10'; ctx.fill();
  ctx.strokeStyle = '#195a20'; ctx.lineWidth = 1; ctx.stroke();

  // Pitch markings
  ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.15, H * 0.17, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#1d6624'; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, W * 0.048, 0, Math.PI * 2);
  ctx.strokeStyle = '#1d6624'; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - H * 0.22); ctx.lineTo(cx, cy + H * 0.22);
  ctx.strokeStyle = '#1d6624'; ctx.lineWidth = 0.5; ctx.stroke();

  // Heat zones
  const pulse = Math.sin(hmPhase * 0.04) * 0.5 + 0.5;
  HM_ZONES.forEach(z => {
    const zx = W * z.x, zy = H * z.y, zr = Math.min(W, H) * z.r;
    const [inner, outer] = zoneColor(z.level, hmDensity, pulse);
    const grad = ctx.createRadialGradient(zx, zy, 0, zx, zy, zr);
    grad.addColorStop(0, inner); grad.addColorStop(1, outer);
    ctx.beginPath(); ctx.arc(zx, zy, zr, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();
  });

  // Labels
  ctx.save();
  const labels = [
    { text: 'GATE N · HIGH', x: 0.50, y: 0.06, anchor: 'center', color: '#E24B4A' },
    { text: 'GATE S · MED', x: 0.50, y: 0.96, anchor: 'center', color: '#EF9F27' },
    { text: 'E · HIGH', x: 0.92, y: 0.52, anchor: 'right', color: '#E24B4A' },
    { text: 'W · LOW', x: 0.08, y: 0.52, anchor: 'left', color: '#1D9E75' },
  ];
  ctx.font = '500 9px "DM Sans", sans-serif';
  labels.forEach(l => {
    ctx.fillStyle = l.color;
    ctx.textAlign = l.anchor === 'center' ? 'center' : l.anchor === 'right' ? 'right' : 'left';
    ctx.fillText(l.text, W * l.x, H * l.y);
  });
  ctx.textAlign = 'center'; ctx.fillStyle = '#2a7d36';
  ctx.font = '500 11px "DM Sans", sans-serif';
  ctx.fillText('FIELD', cx, cy + 4);
  ctx.restore();

  hmPhase++;
  hmAnimId = requestAnimationFrame(drawHeatmap);
}

function initHeatmapCanvas() {
  if (hmAnimId) cancelAnimationFrame(hmAnimId);
  hmPhase = 0;
  drawHeatmap();
}

const densitySlider = document.getElementById('density-slider');
const densityVal = document.getElementById('density-val');
if (densitySlider) {
  densitySlider.addEventListener('input', function () {
    hmDensity = parseInt(this.value);
    if (densityVal) densityVal.textContent = hmDensity + '%';
  });
}

// ─── Ring Charts ──────────────────────────────────────────────────────────────
const RING_CIRC = 2 * Math.PI * 36; // r = 36

const RINGS_CONFIG = [
  { label: 'Food avg', value: 9, max: 20, unit: 'min', color: '#EF9F27' },
  { label: 'Drinks avg', value: 8, max: 20, unit: 'min', color: '#378ADD' },
  { label: 'Restrooms', value: 2, max: 10, unit: 'min', color: '#1D9E75' },
  { label: 'Entry gates', value: 4, max: 20, unit: 'min', color: '#7F77DD' },
];

function renderRingCharts() {
  const container = document.getElementById('rings-row');
  if (!container) return;

  container.innerHTML = RINGS_CONFIG.map((r, i) => `
    <div class="ring-chart">
      <div class="ring-wrap">
        <svg class="ring-svg" viewBox="0 0 84 84">
          <circle class="ring-bg" cx="42" cy="42" r="36"/>
          <circle class="ring-fill" id="ring-${i}" cx="42" cy="42" r="36"
            stroke="${r.color}"
            style="stroke-dasharray:${RING_CIRC.toFixed(1)};stroke-dashoffset:${RING_CIRC.toFixed(1)};"/>
        </svg>
        <div class="ring-value-wrap">
          <span class="ring-value" style="color:${r.color}">${r.value}</span>
          <span class="ring-unit">${r.unit}</span>
        </div>
      </div>
      <div class="ring-label">${r.label}</div>
    </div>`).join('');

  // Animate rings after two frames (ensures CSS transition is active)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    RINGS_CONFIG.forEach((r, i) => {
      const el = document.getElementById(`ring-${i}`);
      if (!el) return;
      el.style.transition = 'stroke-dashoffset 1.3s cubic-bezier(0.4,0,0.2,1)';
      el.style.strokeDashoffset = (RING_CIRC * (1 - r.value / r.max)).toFixed(1);
    });
  }));
}

// ─── Wait Times ───────────────────────────────────────────────────────────────
const waitsData = {
  food: [
    { label: 'Kiosk A1 — Hot dogs', wait: 5, max: 20 },
    { label: 'Kiosk B3 — Burgers', wait: 9, max: 20 },
    { label: 'Kiosk C3 — Pizza', wait: 18, max: 20 },
    { label: 'Kiosk D2 — Wraps', wait: 4, max: 20 },
    { label: 'Restaurant R1', wait: 12, max: 20 },
  ],
  drinks: [
    { label: 'Bar B1 — Lager', wait: 6, max: 20 },
    { label: 'Bar B2 — Cocktails', wait: 9, max: 20 },
    { label: 'Kiosk D4 — Soft drinks', wait: 2, max: 20 },
    { label: 'Bar A3 — Premium', wait: 14, max: 20 },
  ],
  wc: [
    { label: 'Block A — Level 1', wait: 2, max: 10 },
    { label: 'Block B — Level 2', wait: 1, max: 10 },
    { label: 'Block C — Level 1', wait: 7, max: 10 },
    { label: 'Block D — Accessible', wait: 0, max: 10 },
  ],
};
let activeWaitCat = 'food';

function waitColor(w, m) {
  const p = w / m;
  return p >= 0.75 ? '#E24B4A' : p >= 0.45 ? '#EF9F27' : '#1D9E75';
}
function renderWaits(cat) {
  const list = document.getElementById('wait-list');
  if (!list) return;
  list.innerHTML = waitsData[cat].map(item => {
    const pct = Math.min(100, Math.round((item.wait / item.max) * 100));
    const color = waitColor(item.wait, item.max);
    const label = item.wait === 0 ? 'Free' : item.wait.toFixed(0) + ' min';
    return `
      <div class="wait-item">
        <div class="wait-label">${item.label}</div>
        <div class="wait-bar-bg"><div class="wait-bar" style="width:${pct}%;background:${color};"></div></div>
        <div class="wait-time" style="color:${color}">${label}</div>
      </div>`;
  }).join('');
}

document.addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab || !tab.dataset.cat) return;
  $$('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  activeWaitCat = tab.dataset.cat;
  renderWaits(activeWaitCat);
});

renderWaits('food');

function driftWaits() {
  Object.keys(waitsData).forEach(cat => {
    waitsData[cat].forEach(item => {
      item.wait = Math.max(0, Math.min(item.max, item.wait + (Math.random() - 0.48) * 1.3));
    });
  });
  renderWaits(activeWaitCat);
}
setInterval(driftWaits, 4200);

// ─── Gate Sparklines ─────────────────────────────────────────────────────────
const sparkSeries = {
  north: [95, 98, 92, 96, 88, 94, 91, 89, 93, 91],
  west: [28, 25, 30, 27, 32, 29, 31, 28, 26, 28],
  south: [60, 65, 68, 62, 70, 67, 65, 62, 64, 64],
  east: [82, 88, 85, 90, 87, 83, 86, 85, 87, 88],
};
const sparkColors = { north: '#E24B4A', west: '#1D9E75', south: '#EF9F27', east: '#EF9F27' };

function buildSparkSVG(vals, color, W = 92, H = 28) {
  const min = Math.min(...vals), max = Math.max(...vals);
  const rng = max - min || 1;
  const px = 2, py = 3, iW = W - px * 2, iH = H - py * 2;
  const pts = vals.map((v, i) => [
    px + (i / (vals.length - 1)) * iW,
    py + (1 - (v - min) / rng) * iH,
  ]);
  const lineStr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = pts.at(-1);
  const uid = 'sg' + Math.random().toString(36).slice(2, 7);
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs>
      <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <polygon points="${lineStr} ${(W - px).toFixed(1)},${(H - py).toFixed(1)} ${px},${(H - py).toFixed(1)}" fill="url(#${uid})"/>
    <polyline points="${lineStr}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.5" fill="${color}"/>
  </svg>`;
}

function renderGateSparklines() {
  ['north', 'west', 'south', 'east'].forEach(gate => {
    const el = document.getElementById(`spark-${gate}`);
    if (el) el.innerHTML = buildSparkSVG(sparkSeries[gate], sparkColors[gate]);
  });
}

// ─── Push Notifications (Fan App) ────────────────────────────────────────────
const notifMessages = [
  'Gate W is now open — only 2 min wait!',
  'Your Burger pre-order ready at Counter C4 🍔',
  'Block B restroom (Level 2) is clear now',
  '⚡ Half-time in 12 min — pre-order your food!',
  'Concourse C getting busy — use Concourse B',
];
let notifIdx = 0;

function showNotif() {
  const bubble = document.getElementById('phone-notif');
  const text = document.getElementById('notif-text');
  if (!bubble || !text) return;
  text.textContent = notifMessages[notifIdx++ % notifMessages.length];
  bubble.classList.add('visible');
  setTimeout(() => bubble.classList.remove('visible'), 4200);
}
setTimeout(showNotif, 1800);
setInterval(showNotif, 10000);

// ─── Alert Actions ────────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('.alert-action');
  if (!btn) return;
  const item = btn.closest('.alert-item');
  if (!item) return;
  item.style.transition = 'opacity 0.3s, transform 0.3s';
  item.style.opacity = '0';
  item.style.transform = 'translateX(18px)';
  setTimeout(() => { item.remove(); updateBadge(); }, 330);
});

function updateBadge() {
  const n = $$('.alert-item').length;
  const badge = document.getElementById('badge-count');
  if (!badge) return;
  if (n === 0) { badge.style.display = 'none'; return; }
  badge.style.display = '';
  badge.textContent = n;
  badge.classList.remove('bump');
  void badge.offsetWidth;
  badge.classList.add('bump');
}

// Simulate incoming alerts
const incomingAlerts = [
  { sev: 'low', title: 'Concourse B vending restocked', desc: 'Kiosks B1, B3, B5 restocked — inventory at 85%.', tag: 'Auto', tagCls: 'muted' },
  { sev: 'medium', title: 'Gate S queue approaching threshold', desc: 'Wait time at 7 min and rising — monitoring in progress.', tag: 'Medium', tagCls: 'amber' },
  { sev: 'low', title: 'Fan app surge: 800 new sessions', desc: 'Half-time spike. CDN auto-scaled. No degradation observed.', tag: 'Info', tagCls: 'muted' },
];
let incomingIdx = 0;

setInterval(() => {
  const feed = document.getElementById('alert-feed');
  if (!feed || incomingIdx >= incomingAlerts.length) return;
  const a = incomingAlerts[incomingIdx++];
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const el = document.createElement('div');
  el.className = `alert-item ${a.sev}`;
  el.style.cssText = 'opacity:0;transform:translateY(-10px)';
  el.innerHTML = `
    <div class="alert-severity-bar"></div>
    <div class="alert-body">
      <div class="alert-title">${a.title}</div>
      <div class="alert-desc">${a.desc}</div>
      <div class="alert-meta">
        <span class="alert-time">${ts}</span>
        <span class="alert-tag ${a.tagCls}">${a.tag}</span>
      </div>
    </div>
    <button class="alert-action">Dismiss</button>`;
  feed.prepend(el);
  requestAnimationFrame(() => {
    el.style.transition = 'opacity 0.38s, transform 0.38s';
    el.style.opacity = '1'; el.style.transform = 'none';
  });
  updateBadge();
}, 18000);

// ─── Analytics Charts ─────────────────────────────────────────────────────────
const SVG_W = 680, SVG_H = 140, PL = 46, PR = 14, PT = 10, PB = 28;

function toPoints(data, maxVal) {
  return data.map((d, i) => ({
    x: PL + (i / (data.length - 1)) * (SVG_W - PL - PR),
    y: PT + (1 - d.v / maxVal) * (SVG_H - PT - PB),
    ...d,
  }));
}
function gridSVG(maxVal, steps = [0.25, 0.5, 0.75, 1]) {
  return steps.map(g => {
    const y = PT + (1 - g) * (SVG_H - PT - PB);
    const lbl = g === 1 ? Math.round(maxVal / 1000) + 'k' : Math.round(g * maxVal / 1000) + 'k';
    return `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${SVG_W - PR}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.045)" stroke-width="1"/>
            <text x="${PL - 4}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="rgba(110,144,174,0.7)" font-family="DM Sans,sans-serif">${lbl}</text>`;
  }).join('');
}
function pathStr(pts) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function renderAttendanceChart() {
  const container = document.getElementById('attendance-chart');
  if (!container) return;
  const hourly = [
    { t: '17:00', v: 8200 }, { t: '17:30', v: 19500 }, { t: '18:00', v: 33000 }, { t: '18:30', v: 45800 },
    { t: '19:00', v: 54200 }, { t: '19:30', v: 58450 }, { t: '20:00', v: 56800 }, { t: '20:30', v: 57900 },
    { t: '21:00', v: 54000 }, { t: '21:30', v: 38500 }, { t: '22:00', v: 14200 },
  ];
  const maxCap = 75000;
  const pts = toPoints(hourly, maxCap);
  const line = pathStr(pts);
  const area = line + ` L${pts.at(-1).x.toFixed(1)},${SVG_H - PB} L${pts[0].x.toFixed(1)},${SVG_H - PB} Z`;
  const nowX = pts[6].x; // 20:00

  const timeLbls = pts.filter((_, i) => i % 2 === 0).map(p =>
    `<text x="${p.x.toFixed(1)}" y="${SVG_H - PB + 13}" text-anchor="middle" font-size="9" fill="rgba(110,144,174,0.7)" font-family="DM Sans,sans-serif">${p.t}</text>`
  ).join('');
  const dots = pts.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="#1D9E75" opacity="0.85"/>`
  ).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${SVG_W} ${SVG_H}" width="100%" style="height:140px;">
      <defs>
        <linearGradient id="att-gr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1D9E75" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#1D9E75" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      ${gridSVG(maxCap)}
      <path d="${area}" fill="url(#att-gr)"/>
      <path d="${line}" fill="none" stroke="#1D9E75" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${timeLbls}
      <line x1="${nowX.toFixed(1)}" y1="${PT}" x2="${nowX.toFixed(1)}" y2="${SVG_H - PB}" stroke="#E24B4A" stroke-width="1" stroke-dasharray="3 2"/>
      <text x="${(nowX + 4).toFixed(1)}" y="${PT + 10}" font-size="9" fill="#E24B4A" font-family="DM Sans,sans-serif">Now</text>
    </svg>`;
}

function renderEntryExitChart() {
  const container = document.getElementById('entry-exit-chart');
  if (!container) return;
  const entryD = [
    { t: '17:00', v: 1200 }, { t: '17:30', v: 3800 }, { t: '18:00', v: 5200 }, { t: '18:30', v: 4600 }, { t: '19:00', v: 3100 },
    { t: '19:30', v: 1200 }, { t: '20:00', v: 600 }, { t: '20:30', v: 800 }, { t: '21:00', v: 400 }, { t: '21:30', v: 200 }, { t: '22:00', v: 80 },
  ];
  const exitD = [
    { t: '17:00', v: 50 }, { t: '17:30', v: 100 }, { t: '18:00', v: 200 }, { t: '18:30', v: 800 }, { t: '19:00', v: 400 },
    { t: '19:30', v: 600 }, { t: '20:00', v: 300 }, { t: '20:30', v: 500 }, { t: '21:00', v: 4200 }, { t: '21:30', v: 6800 }, { t: '22:00', v: 4500 },
  ];
  const maxV = 8000;
  const ePts = toPoints(entryD, maxV);
  const xPts = toPoints(exitD, maxV);
  const eLine = pathStr(ePts);
  const xLine = pathStr(xPts);
  const eArea = eLine + ` L${ePts.at(-1).x.toFixed(1)},${SVG_H - PB} L${ePts[0].x.toFixed(1)},${SVG_H - PB} Z`;
  const xArea = xLine + ` L${xPts.at(-1).x.toFixed(1)},${SVG_H - PB} L${xPts[0].x.toFixed(1)},${SVG_H - PB} Z`;

  const timeLbls = ePts.filter((_, i) => i % 3 === 0).map(p =>
    `<text x="${p.x.toFixed(1)}" y="${SVG_H - PB + 13}" text-anchor="middle" font-size="9" fill="rgba(110,144,174,0.7)" font-family="DM Sans,sans-serif">${p.t}</text>`
  ).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${SVG_W} ${SVG_H}" width="100%" style="height:130px;">
      <defs>
        <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1D9E75" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#1D9E75" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="xg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#E24B4A" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#E24B4A" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridSVG(maxV)}
      <path d="${eArea}" fill="url(#eg)"/>
      <path d="${xArea}" fill="url(#xg)"/>
      <path d="${eLine}" fill="none" stroke="#1D9E75" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${xLine}" fill="none" stroke="#E24B4A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      ${timeLbls}
      <circle cx="56" cy="12" r="4" fill="#1D9E75"/>
      <text x="64" y="16" font-size="9" fill="rgba(110,144,174,0.9)" font-family="DM Sans,sans-serif">Entry</text>
      <circle cx="108" cy="12" r="4" fill="#E24B4A"/>
      <text x="116" y="16" font-size="9" fill="rgba(110,144,174,0.9)" font-family="DM Sans,sans-serif">Exit</text>
    </svg>`;
}

function renderActionsSummary() {
  const el = document.getElementById('actions-summary');
  if (!el) return;
  const items = [
    { t: '19:31', c: '#E24B4A', txt: 'Gate N → Gate W redirect — 400 fans rerouted' },
    { t: '19:20', c: '#EF9F27', txt: '3 additional staff dispatched to Concourse C3' },
    { t: '19:05', c: '#1D9E75', txt: 'C3 Express lane opened — queue cleared in 4 min' },
    { t: '18:55', c: '#378ADD', txt: 'Half-time surge warning pre-issued to all staff' },
    { t: '18:52', c: '#1D9E75', txt: 'South car park P3 → P5 redirect activated' },
    { t: '18:30', c: '#7F77DD', txt: 'Fan app ML model retrained on live event data' },
    { t: '17:45', c: '#1D9E75', txt: 'Gate S express lanes opened (+2 additional lanes)' },
  ];
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:9px;position:relative;z-index:1;">
      ${items.map(a => `
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <span style="font-family:'Outfit',sans-serif;font-size:11px;color:rgba(110,144,174,0.65);min-width:38px;padding-top:1px;flex-shrink:0;">${a.t}</span>
          <span style="width:6px;height:6px;border-radius:50%;background:${a.c};margin-top:4px;flex-shrink:0;box-shadow:0 0 5px ${a.c};"></span>
          <span style="font-size:12px;color:var(--text-secondary);line-height:1.45;">${a.txt}</span>
        </div>`).join('')}
      <div style="margin-top:10px;padding-top:10px;border-top:0.5px solid rgba(255,255,255,0.06);font-size:11px;color:var(--text-muted);display:flex;gap:16px;flex-wrap:wrap;">
        <span>7 total actions</span>
        <span style="color:var(--accent-green);">0 incidents escalated</span>
        <span>100% auto-resolved</span>
      </div>
    </div>`;
}

function animateAnalyticsKPIs() {
  animateCounter(document.getElementById('kpi-attendance'), 58450, 1000, v => v.toLocaleString());
  animateCounter(document.getElementById('kpi-revenue'), 284920, 1100, v => '£' + v.toLocaleString());
  animateCounter(document.getElementById('kpi-incidents'), 14, 700, v => v.toString());
  animateCounter(document.getElementById('kpi-nps'), 74, 800, v => v.toString());
}

// ─── Keyboard Shortcuts (1–7) ────────────────────────────────────────────────
const keyMap = { '1': 'crowd', '2': 'waits', '3': 'entry', '4': 'app', '5': 'alerts', '6': 'arch', '7': 'analytics' };
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const id = keyMap[e.key];
  if (!id) return;
  const item = document.querySelector(`.nav-item[data-panel="${id}"]`);
  if (item) item.click();
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
setTimeout(() => {
  initHeatmapCanvas();
  updateNavPill();
  renderWaits('food');
}, 120);
