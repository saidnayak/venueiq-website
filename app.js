/* ===== VenueIQ — app.js ===== */

// ---- Panel navigation ----
const panelTitles = {
  crowd: { title: 'Crowd Flow', sub: 'Real-time density monitoring' },
  waits: { title: 'Wait Times', sub: 'Concession & restroom queues' },
  entry: { title: 'Entry Routing', sub: 'Gate status & smart redirects' },
  app: { title: 'Fan App', sub: 'Attendee mobile experience' },
  alerts: { title: 'Live Alerts', sub: 'Operations feed & incident log' },
  arch: { title: 'Architecture', sub: 'System design & data layers' },
};

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const id = item.dataset.panel;
    switchPanel(id);
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
  });
});

function switchPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');

  const meta = panelTitles[id];
  if (meta) {
    document.getElementById('page-title').textContent = meta.title;
    document.querySelector('.page-sub').textContent = meta.sub;
  }
}

// ---- Clock ----
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const timeStr = `${hh}:${mm}:${ss}`;
  const clockEl = document.getElementById('clock');
  const appTimeEl = document.getElementById('app-time');
  if (clockEl) clockEl.textContent = timeStr;
  if (appTimeEl) appTimeEl.textContent = `${hh}:${mm}`;
}
updateClock();
setInterval(updateClock, 1000);

// ---- Match minute counter ----
let matchMin = 67;
setInterval(() => {
  matchMin = (matchMin + 1) % 90 || 1;
  const el = document.getElementById('match-min');
  if (el) el.textContent = matchMin + "'";
}, 20000); // advance every 20s for demo feel

// ---- Density heatmap slider ----
const densitySlider = document.getElementById('density-slider');
const densityVal = document.getElementById('density-val');

if (densitySlider) {
  densitySlider.addEventListener('input', function () {
    const v = parseInt(this.value);
    densityVal.textContent = v + '%';
    updateHeatmap(v);
  });
}

function updateHeatmap(v) {
  const getColor = (level) => {
    if (level === 'high') return v > 70 ? '#E24B4A' : v > 45 ? '#EF9F27' : '#1D9E75';
    if (level === 'med') return v > 55 ? '#EF9F27' : '#1D9E75';
    if (level === 'low') return v > 85 ? '#EF9F27' : '#1D9E75';
    return '#1D9E75';
  };

  const zones = {
    'z-n': getColor('high'),
    'z-e': getColor('high'),
    'z-s': getColor('med'),
    'z-nw': getColor('med'),
    'z-ne': v > 80 ? '#EF9F27' : '#1D9E75',
    'z-se': '#1D9E75',
    'z-sw': '#1D9E75',
    'z-w': getColor('low'),
  };

  Object.entries(zones).forEach(([id, color]) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('fill', color);
  });
}

// ---- Wait times data ----
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

function getWaitColor(wait, max) {
  const pct = wait / max;
  if (pct >= 0.75) return '#E24B4A';
  if (pct >= 0.45) return '#EF9F27';
  return '#1D9E75';
}

function renderWaits(cat) {
  const list = document.getElementById('wait-list');
  if (!list) return;
  const items = waitsData[cat];
  list.innerHTML = items.map(item => {
    const pct = Math.round((item.wait / item.max) * 100);
    const color = getWaitColor(item.wait, item.max);
    const label = item.wait === 0 ? 'Now' : item.wait + ' min';
    return `
      <div class="wait-item">
        <div class="wait-label">${item.label}</div>
        <div class="wait-bar-bg">
          <div class="wait-bar" style="width:${pct}%; background:${color};"></div>
        </div>
        <div class="wait-time" style="color:${color}">${label}</div>
      </div>`;
  }).join('');
}

// Tab switching for wait times
document.addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  const cat = tab.dataset.cat;
  if (!cat) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  activeWaitCat = cat;
  renderWaits(cat);
});

renderWaits('food');

// ---- Simulate live wait time drift ----
function driftWaits() {
  Object.keys(waitsData).forEach(cat => {
    waitsData[cat].forEach(item => {
      const delta = (Math.random() - 0.48) * 1.2;
      item.wait = Math.max(0, Math.min(item.max, item.wait + delta));
    });
  });
  renderWaits(activeWaitCat);
}
setInterval(driftWaits, 4000);

// ---- Alert resolve/dismiss ----
document.addEventListener('click', e => {
  const btn = e.target.closest('.alert-action');
  if (!btn) return;
  const alertItem = btn.closest('.alert-item');
  if (!alertItem) return;
  alertItem.style.transition = 'opacity 0.3s, transform 0.3s';
  alertItem.style.opacity = '0';
  alertItem.style.transform = 'translateX(16px)';
  setTimeout(() => {
    alertItem.remove();
    updateBadgeCount();
  }, 320);
});

function updateBadgeCount() {
  const remaining = document.querySelectorAll('.alert-item').length;
  const badge = document.querySelector('.badge-count');
  if (badge) {
    badge.textContent = remaining;
    if (remaining === 0) badge.style.display = 'none';
  }
}

// ---- Simulate new alert arrival ----
const simulatedAlerts = [
  { severity: 'low', title: 'Concourse B vending restocked', desc: 'Auto-restocking completed at kiosks B1, B3, B5. Inventory at 85%.', time: null, tag: 'Auto', tagClass: 'muted' },
  { severity: 'medium', title: 'Gate S queue approaching threshold', desc: 'Wait time at 7 min and rising. Monitoring — no action required yet.', time: null, tag: 'Medium', tagClass: 'amber' },
  { severity: 'low', title: 'Fan app surge: 800 new sessions', desc: 'Half-time check-in spike detected. CDN auto-scaled. No degradation.', time: null, tag: 'Info', tagClass: 'muted' },
];

let alertIdx = 0;
setInterval(() => {
  const feed = document.getElementById('alert-feed');
  if (!feed || alertIdx >= simulatedAlerts.length) return;
  const a = simulatedAlerts[alertIdx++];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const el = document.createElement('div');
  el.className = `alert-item ${a.severity}`;
  el.style.opacity = '0';
  el.style.transform = 'translateY(-8px)';
  el.innerHTML = `
    <div class="alert-severity-bar"></div>
    <div class="alert-body">
      <div class="alert-title">${a.title}</div>
      <div class="alert-desc">${a.desc}</div>
      <div class="alert-meta">
        <span class="alert-time">${timeStr}</span>
        <span class="alert-tag ${a.tagClass}">${a.tag}</span>
      </div>
    </div>
    <button class="alert-action">Dismiss</button>`;
  feed.prepend(el);
  requestAnimationFrame(() => {
    el.style.transition = 'opacity 0.35s, transform 0.35s';
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
  updateBadgeCount();
  const badge = document.querySelector('.badge-count');
  if (badge) {
    badge.style.display = '';
    badge.textContent = document.querySelectorAll('.alert-item').length;
  }
}, 18000);
