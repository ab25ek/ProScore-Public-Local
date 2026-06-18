// sidepanel.js v5

// ── GRADE COLOUR MAP ─────────────────────────────────────────
const GRADE_COLOR = {
  Excellent: '#FFA14C',
  Good:      '#FF7537',
  Okay:      '#FF4E25',
  Bad:       '#FF2712',
  Poor:      '#FF0101',
};

// ── STATE ─────────────────────────────────────────────────────
let allProducts    = [];
let allBrands      = [];
let lastSaved      = null;
let pendingScrape  = null;
let formDirty      = false;
let sortCol        = 'proScore';
let sortDir        = -1;
let newlyAddedId   = null;
let pendingSaveFn  = null;
let nameExpanded   = false;

// ── DOM ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const fBrand   = $('fBrand');
const fProduct = $('fProduct');
const fWeight  = $('fWeight');
const fPrice   = $('fPrice');
const fProtein = $('fProtein');
const fServing = $('fServing');

const brandDropdown    = $('brandDropdown');
const btnScrape        = $('btnScrape');
const btnCalc          = $('btnCalc');
const btnClear         = $('btnClear');
const btnNewProduct    = $('btnNewProduct');
const btnClearAll      = $('btnClearAll');
const scrapeBar        = $('scrapeStatus');

const wheyNotice       = $('wheyNotice');
const btnDismissNotice = $('btnDismissNotice');
const wheyModal        = $('wheyModal');
const btnWheyConfirm   = $('btnWheyConfirm');
const btnWheyCancel    = $('btnWheyCancel');

const tabCalc  = $('tabCalc');
const tabScore = $('tabScore');
const tabLB    = $('tabLB');

const proScoreVal       = $('proScoreVal');
const proScoreGrade     = $('proScoreGrade');
const proteinScoreVal   = $('proteinScoreVal');
const proteinScoreGrade = $('proteinScoreGrade');
const valueScoreVal     = $('valueScoreVal');
const valueScoreGrade   = $('valueScoreGrade');
const scoreShell        = $('scoreShell');

const scEmpty      = $('scEmpty');
const scData       = $('scData');
const scName       = $('scName');
const scNameToggle = $('scNameToggle');
const scRankBadge  = $('scRankBadge');
const scPillPrice  = $('scPillPrice');
const scPillWeight = $('scPillWeight');
const scPillLink   = $('scPillLink');
const scDataset    = $('scDataset');

const lbBody  = $('lbBody');
const lbCount = $('lbCount');
const toastEl = $('toast');

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  setupListeners();
  updateTabState('viewCalc');
  initWheyNotice();
});

function loadAll() {
  chrome.runtime.sendMessage({ action: 'getProducts' }, res => {
    allProducts = res?.products || [];
    renderLeaderboard();
    if (lastSaved) {
      const refreshed = allProducts.find(p => p.id === lastSaved.id);
      if (refreshed) { lastSaved = refreshed; renderScorecard(lastSaved); }
    }
  });
  chrome.runtime.sendMessage({ action: 'getBrands' }, res => {
    allBrands = res?.brands || [];
  });
}

// ── WHEY NOTICE ──────────────────────────────────────────────
function initWheyNotice() {
  if (!localStorage.getItem('ps_whey_notice_dismissed')) {
    wheyNotice.classList.remove('hidden');
  }
  btnDismissNotice.addEventListener('click', () => {
    wheyNotice.classList.add('hidden');
    localStorage.setItem('ps_whey_notice_dismissed', '1');
  });
}

// ── LISTENERS ────────────────────────────────────────────────
function setupListeners() {
  tabCalc.addEventListener('click',  () => switchTab('viewCalc'));
  tabScore.addEventListener('click', () => switchTab('viewScore'));
  tabLB.addEventListener('click',    () => switchTab('viewLB'));

  btnScrape.addEventListener('click', doScrape);
  btnCalc.addEventListener('click',   () => doCalcAndSave());
  btnClear.addEventListener('click',  clearForm);
  btnNewProduct.addEventListener('click', () => { clearForm(); switchTab('viewCalc'); });
  btnClearAll.addEventListener('click', doClearAll);

  [fBrand, fProduct, fWeight, fPrice, fProtein, fServing].forEach(f => {
    f.addEventListener('input', () => { formDirty = true; updateTabState(currentView()); });
  });

  fBrand.addEventListener('input', onBrandInput);
  fBrand.addEventListener('focus', onBrandInput);
  fBrand.addEventListener('blur',  () => setTimeout(() => brandDropdown.classList.add('hidden'), 180));
  document.addEventListener('click', e => {
    if (!e.target.closest('.brand-wrap')) brandDropdown.classList.add('hidden');
  });

  document.querySelectorAll('.th-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) { sortDir *= -1; } else { sortCol = col; sortDir = -1; }
      renderLeaderboard();
    });
  });

  // Whey modal
  btnWheyConfirm.addEventListener('click', () => {
    wheyModal.classList.add('hidden');
    if (pendingSaveFn) { pendingSaveFn(); pendingSaveFn = null; }
  });
  btnWheyCancel.addEventListener('click', () => {
    wheyModal.classList.add('hidden');
    pendingSaveFn = null;
  });

  // Product name toggle
  scNameToggle.addEventListener('click', () => {
    nameExpanded = !nameExpanded;
    scName.classList.toggle('expanded', nameExpanded);
    scNameToggle.classList.toggle('expanded', nameExpanded);
  });
}

// ── TAB MANAGEMENT ───────────────────────────────────────────
function currentView() {
  return document.querySelector('.view.active')?.id ?? 'viewCalc';
}

function switchTab(viewId) {
  if (currentView() === 'viewLB') newlyAddedId = null;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  updateTabState(viewId);
  if (viewId === 'viewLB') renderLeaderboard();
  // Re-animate scorecard when switching into it
  if (viewId === 'viewScore' && lastSaved) renderScorecard(lastSaved);
}

function updateTabState(activeViewId) {
  [tabCalc, tabScore, tabLB].forEach(t => t.classList.remove('active', 'synced'));
  const tabMap = { viewCalc: tabCalc, viewScore: tabScore, viewLB: tabLB };
  if (tabMap[activeViewId]) tabMap[activeViewId].classList.add('active');

  const synced = lastSaved && !formDirty;
  if (synced) {
    tabCalc.classList.add('synced');
    tabScore.classList.add('synced');
    if (activeViewId === 'viewCalc')  { tabCalc.classList.remove('synced');  tabCalc.classList.add('active'); }
    if (activeViewId === 'viewScore') { tabScore.classList.remove('synced'); tabScore.classList.add('active'); }
  }

  const connectorWrap = document.querySelector('.tab-connector');
  const lines = document.querySelectorAll('.connector-line');
  if (synced) {
    connectorWrap.classList.add('connector-synced');
    lines.forEach(l => l.setAttribute('stroke', 'rgba(255,220,160,0.9)'));
  } else {
    connectorWrap.classList.remove('connector-synced');
    lines.forEach(l => l.setAttribute('stroke', 'rgba(255,255,255,0.3)'));
  }
}

// ── BRAND AUTOCOMPLETE ───────────────────────────────────────
function onBrandInput() {
  const q = fBrand.value.trim().toLowerCase();
  const matches = q ? allBrands.filter(b => b.toLowerCase().includes(q)) : allBrands;
  brandDropdown.innerHTML = '';
  if (!matches.length) {
    if (q) {
      const d = document.createElement('div');
      d.className = 'brand-opt no-match';
      d.textContent = `Save "${fBrand.value.trim()}" as new brand`;
      d.addEventListener('mousedown', () => pickBrand(fBrand.value.trim()));
      brandDropdown.appendChild(d);
      brandDropdown.classList.remove('hidden');
    } else {
      brandDropdown.classList.add('hidden');
    }
    return;
  }
  matches.slice(0, 12).forEach(b => {
    const d = document.createElement('div');
    d.className = 'brand-opt';
    d.textContent = b;
    d.addEventListener('mousedown', () => pickBrand(b));
    brandDropdown.appendChild(d);
  });
  brandDropdown.classList.remove('hidden');
}

function pickBrand(b) {
  fBrand.value = b;
  brandDropdown.classList.add('hidden');
  if (!allBrands.includes(b)) {
    chrome.runtime.sendMessage({ action: 'addBrand', brand: b }, res => {
      if (res?.brands) allBrands = res.brands;
    });
  }
}

// ── SCRAPE ───────────────────────────────────────────────────
async function doScrape() {
  btnScrape.disabled = true;
  setScrapeStatus('Scraping page…', '');
  switchTab('viewCalc');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] }).catch(() => {});
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => typeof window._proScoreScrape === 'function' ? window._proScoreScrape() : null
    });
    const d = results?.[0]?.result;
    if (!d) throw new Error('Could not read page — refresh and try');
    pendingScrape = { ...d, id: Date.now().toString() };
    setField(fBrand,   d.brand        ?? '', !!d.brand);
    setField(fProduct, d.name         ?? '', !!d.name);
    setField(fWeight,  d.weightGrams  ?? '', !!d.weightGrams);
    setField(fPrice,   d.price        ?? '', !!d.price);
    setField(fServing, d.servingSizeG ?? '', !!d.servingSizeG);
    fProtein.value = '';
    fProtein.classList.remove('autofilled');
    fProtein.classList.add('needs-input');
    if (d.brand) pickBrand(d.brand);
    const missing = [!d.weightGrams && 'weight', !d.price && 'price'].filter(Boolean);
    setScrapeStatus(
      missing.length ? `Partial scrape — enter ${missing.join(' & ')} + protein from label` : 'Scraped ✓ — enter protein & serving from nutrition label',
      missing.length ? 'err' : 'ok'
    );
    formDirty = true;
    updateTabState('viewCalc');
  } catch (e) {
    setScrapeStatus(e.message || 'Scrape failed', 'err');
  }
  btnScrape.disabled = false;
}

function setField(inp, val, auto) {
  inp.value = val ?? '';
  inp.classList.toggle('autofilled',  auto && !!val);
  inp.classList.toggle('needs-input', !val);
}

function setScrapeStatus(msg, cls) {
  scrapeBar.textContent = msg;
  scrapeBar.className = 'scrape-bar' + (cls ? ' ' + cls : '');
}

// ── WHEY DETECTION ───────────────────────────────────────────
const NON_WHEY_RE = /\b(plant|pea|soy(a)?|yeast|vegan|hemp|rice\s+protein|oat\s+protein|egg\s+white)\b/i;
const WHEY_RE     = /\bwhey\b/i;

function isLikelyNotWhey(name) {
  const n = name || '';
  return NON_WHEY_RE.test(n) || !WHEY_RE.test(n);
}

// ── CALCULATE & SAVE ─────────────────────────────────────────
function doCalcAndSave(skipWheyCheck = false) {
  const a = parseFloat(fProtein.value);
  const b = parseFloat(fServing.value);
  const c = parseFloat(fWeight.value);
  const d = parseFloat(fPrice.value);

  const badFields = [[a, fProtein], [b, fServing], [c, fWeight], [d, fPrice]]
    .filter(([v]) => !v || v <= 0);
  if (badFields.length) {
    badFields.forEach(([, f]) => f.classList.add('needs-input'));
    showToast('Fill all 4 numeric fields');
    return;
  }

  if (a > b) {
    fProtein.classList.add('error');
    fServing.classList.add('error');
    showToast('Protein cannot exceed serving size');
    fProtein.addEventListener('input', () => {
      fProtein.classList.remove('error');
      fServing.classList.remove('error');
    }, { once: true });
    return;
  }

  const productName = fProduct.value.trim();
  if (!skipWheyCheck && isLikelyNotWhey(productName)) {
    wheyModal.classList.remove('hidden');
    pendingSaveFn = () => doCalcAndSave(true);
    return;
  }

  const proteinPer100g = (a / b) * 100;
  const totalProtein   = (proteinPer100g / 100) * c;
  const valueRaw       = (totalProtein / d) * 1000;

  const product = {
    id:         pendingScrape?.id   ?? Date.now().toString(),
    name:       productName         || 'Unknown Product',
    brand:      fBrand.value.trim() || '',
    url:        pendingScrape?.url  || '',
    source:     pendingScrape?.source || '',
    siteLabel:  pendingScrape?.siteLabel || (pendingScrape?.source?.replace(/\.(com|in|co\.in|net|org).*$/, '') ?? ''),
    proteinPerServing: a,
    servingSizeG: b,
    weightGrams: c,
    price: d,
    proteinPer100g: r1(proteinPer100g),
    totalProtein:   r1(totalProtein),
    valueRaw:       r1(valueRaw),
    proteinScore: null, valueScore: null, proScore: null, grade: null,
  };

  if (product.brand) pickBrand(product.brand);

  chrome.runtime.sendMessage({ action: 'saveProduct', product }, res => {
    if (!res?.ok) { showToast('Save failed'); return; }
    allProducts = res.products;
    const saved = allProducts.find(p => p.id === product.id) || product;
    lastSaved    = saved;
    newlyAddedId = saved.id;
    formDirty    = false;
    renderScorecard(saved);
    renderLeaderboard();
    showToast('Saved ✓');
    switchTab('viewScore');
    pendingScrape = { ...pendingScrape, id: product.id };
  });
}

// ── COUNT-UP ANIMATION ───────────────────────────────────────
function animateValue(el, to, duration = 900) {
  if (to == null || isNaN(to)) { el.textContent = '—'; return; }
  const start = performance.now();
  const tick = (now) => {
    const t    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = r1(to * ease);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = r1(to);
  };
  requestAnimationFrame(tick);
}

// ── SCORECARD ────────────────────────────────────────────────
function renderScorecard(p) {
  if (!p) {
    scEmpty.classList.remove('hidden');
    scData.classList.add('hidden');
    scoreShell.classList.add('hidden');
    btnNewProduct.classList.add('hidden');
    return;
  }

  scEmpty.classList.add('hidden');
  scData.classList.remove('hidden');
  scoreShell.classList.remove('hidden');
  btnNewProduct.classList.remove('hidden');

  // Product name (reset expand state)
  nameExpanded = false;
  scName.classList.remove('expanded');
  scNameToggle.classList.remove('expanded');
  scName.textContent = (p.brand ? p.brand + ' · ' : '') + (p.name ?? '—');
  // Show toggle arrow only when text is actually truncated
  requestAnimationFrame(() => {
    const overflows = scName.scrollHeight > scName.clientHeight + 2;
    scNameToggle.classList.toggle('hidden', !overflows);
  });

  // Rank badge
  const rank = allProducts
    .slice().sort((a, b) => (b.proScore ?? 0) - (a.proScore ?? 0))
    .findIndex(x => x.id === p.id) + 1;
  scRankBadge.textContent = rank ? `#${rank}` : '';
  scRankBadge.className   = 'sc-rank' + (rank === 1 ? ' gold' : rank === 2 ? ' silver' : rank === 3 ? ' bronze' : '');

  // Pills
  scPillPrice.textContent  = p.price      ? `₹${fmtNum(p.price)}`      : 'Price N/A';
  scPillWeight.textContent = p.weightGrams ? `${fmtNum(p.weightGrams)}g` : 'Weight N/A';
  if (p.url) { scPillLink.href = p.url; scPillLink.classList.remove('hidden'); }
  else { scPillLink.classList.add('hidden'); }

  const n = allProducts.length;
  scDataset.textContent = n > 1
    ? `Scored relative to ${n} products in your dataset`
    : 'Add more products for relative scoring';

  // Individual grades
  const pg  = p.proGrade     ?? p.grade ?? 'Poor';
  const prg = p.proteinGrade ?? p.grade ?? 'Poor';
  const vg  = p.valueGrade   ?? p.grade ?? 'Poor';

  proScoreGrade.textContent     = p.proScore     != null ? pg.toUpperCase()  : '—';
  proScoreGrade.className       = 'score-grade grade-' + pg;
  proteinScoreGrade.textContent = p.proteinScore != null ? prg.toUpperCase() : '—';
  proteinScoreGrade.className   = 'sub-grade grade-' + prg;
  valueScoreGrade.textContent   = p.valueScore   != null ? vg.toUpperCase()  : '—';
  valueScoreGrade.className     = 'sub-grade grade-' + vg;

  // Gradient: reset to neutral instantly, then animate to grade colours
  const gc = g => GRADE_COLOR[g] || '#FFA14C';
  scoreShell.classList.add('no-transition');
  scoreShell.style.setProperty('--g-start', '#FFA14C');
  scoreShell.style.setProperty('--g-mid',   '#FFA14C');
  scoreShell.style.setProperty('--g-end',   '#FFA14C');
  // Force reflow so the instant-reset is painted before the transition re-enables
  void scoreShell.offsetWidth;
  scoreShell.classList.remove('no-transition');
  scoreShell.style.setProperty('--g-start', gc(prg));
  scoreShell.style.setProperty('--g-mid',   gc(pg));
  scoreShell.style.setProperty('--g-end',   gc(vg));

  // Count-up animations for score numbers
  animateValue(proScoreVal,     p.proScore);
  animateValue(proteinScoreVal, p.proteinScore);
  animateValue(valueScoreVal,   p.valueScore);
}

// ── LEADERBOARD ──────────────────────────────────────────────
function renderLeaderboard() {
  document.querySelectorAll('.th-sortable').forEach(th => {
    const active = th.dataset.col === sortCol;
    th.classList.toggle('sort-active', active);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = active ? (sortDir === -1 ? '↓' : '↑') : '↕';
  });

  const sorted = [...allProducts]
    .sort((a, b) => {
      const av = a[sortCol] ?? -Infinity;
      const bv = b[sortCol] ?? -Infinity;
      return (bv - av) * -sortDir;
    })
    .slice(0, 20);

  lbCount.textContent = allProducts.length > 20
    ? `— Top 20 of ${allProducts.length}`
    : allProducts.length > 0 ? `— ${allProducts.length} product${allProducts.length > 1 ? 's' : ''}` : '';

  lbBody.innerHTML = '';

  if (!sorted.length) {
    lbBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px 0;color:#aaa;font-size:12px;">
      No products yet — scrape a page and calculate.</td></tr>`;
    return;
  }

  sorted.forEach((p, i) => {
    const rank      = i + 1;
    const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const siteLabel = p.siteLabel || p.source || '';
    const siteCell  = p.url
      ? `<a class="lb-site-link" href="${esc(p.url)}" target="_blank" title="${esc(p.url)}">🔗 ${esc(siteLabel)}</a>`
      : `<span style="color:#bbb;font-size:10px">${esc(siteLabel) || '—'}</span>`;

    const colP   = sortCol === 'proteinScore' ? ' col-active' : '';
    const colV   = sortCol === 'valueScore'   ? ' col-active' : '';
    const colPro = sortCol === 'proScore'     ? ' col-active' : '';

    const tr = document.createElement('tr');
    if (rank > 10) tr.classList.add('dimmed');
    if (p.id === newlyAddedId) tr.classList.add('lb-new');

    tr.innerHTML = `
      <td class="lb-rank ${rankClass}">${rank}</td>
      <td class="lb-name-cell">
        <span class="lb-name" title="${esc(p.name ?? '')}">${esc(trunc(p.name ?? '', 20))}</span>
        ${p.brand ? `<span class="lb-brand">${esc(trunc(p.brand, 18))}</span>` : ''}
      </td>
      <td class="td-num${colP}">${fmt1(p.proteinScore)}</td>
      <td class="td-num${colV}">${fmt1(p.valueScore)}</td>
      <td class="td-num${colPro}" style="font-weight:800">${fmt1(p.proScore)}</td>
      <td>${siteCell}</td>
      <td><button class="lb-del" title="Delete">✕</button></td>
    `;
    tr.querySelector('.lb-del').addEventListener('click', () => deleteProduct(p.id));
    lbBody.appendChild(tr);
  });
}

function deleteProduct(id) {
  chrome.runtime.sendMessage({ action: 'deleteProduct', id }, res => {
    if (!res?.ok) return;
    allProducts = res.products;
    if (lastSaved?.id === id) {
      lastSaved = null; formDirty = false;
      renderScorecard(null);
      updateTabState('viewLB');
    }
    if (newlyAddedId === id) newlyAddedId = null;
    renderLeaderboard();
  });
}

function doClearAll() {
  if (!confirm('Clear all saved products?')) return;
  chrome.runtime.sendMessage({ action: 'clearAll' }, () => {
    allProducts = []; lastSaved = null; formDirty = false; newlyAddedId = null;
    renderLeaderboard();
    renderScorecard(null);
    switchTab('viewCalc');
    updateTabState('viewCalc');
  });
}

// ── FORM CLEAR ───────────────────────────────────────────────
function clearForm() {
  [fBrand, fProduct, fWeight, fPrice, fProtein, fServing].forEach(f => {
    f.value = '';
    f.classList.remove('autofilled', 'needs-input', 'error');
  });
  fProtein.classList.add('needs-input');
  fServing.classList.add('needs-input');
  pendingScrape = null;
  formDirty     = false;
  setScrapeStatus('', '');
  updateTabState(currentView());
}

// ── UTILS ────────────────────────────────────────────────────
function r1(n)     { return Math.round(n * 10) / 10; }
function fmt1(v)   { return (v == null || isNaN(v)) ? '—' : r1(v); }
function fmtNum(n) { return Number(n).toLocaleString('en-IN'); }
function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + '…' : (s ?? ''); }
function esc(s)    { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

let _tt;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => toastEl.classList.remove('show'), 2200);
}
