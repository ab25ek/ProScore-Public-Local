// sidepanel.js v4

// ── STATE ─────────────────────────────────────────────────────
let allProducts   = [];
let allBrands     = [];
let lastSaved     = null;   // product shown on scorecard
let pendingScrape = null;   // raw scrape data
let formDirty     = false;  // user typed in calc form after last save
let sortCol       = 'proScore';
let sortDir       = -1;     // -1 = desc, 1 = asc

// ── DOM ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const fBrand   = $('fBrand');
const fProduct = $('fProduct');
const fWeight  = $('fWeight');
const fPrice   = $('fPrice');
const fProtein = $('fProtein');
const fServing = $('fServing');

const brandDropdown  = $('brandDropdown');
const btnScrape      = $('btnScrape');
const btnCalc        = $('btnCalc');
const btnClear       = $('btnClear');
const btnNewProduct  = $('btnNewProduct');
const btnClearAll    = $('btnClearAll');
const scrapeBar      = $('scrapeStatus');

const tabCalc  = $('tabCalc');
const tabScore = $('tabScore');
const tabLB    = $('tabLB');
const dotCalc  = $('dotCalc');
const dotScore = $('dotScore');
const connectorSvg = document.querySelector('.tab-connector');

const proScoreVal       = $('proScoreVal');
const proScoreGrade     = $('proScoreGrade');
const proteinScoreVal   = $('proteinScoreVal');
const proteinScoreGrade = $('proteinScoreGrade');
const valueScoreVal     = $('valueScoreVal');
const valueScoreGrade   = $('valueScoreGrade');

// Scorecard meta
const scEmpty      = $('scEmpty');
const scData       = $('scData');
const scName       = $('scName');
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

// ── LISTENERS ────────────────────────────────────────────────
function setupListeners() {
  // Tab buttons
  tabCalc.addEventListener('click',  () => switchTab('viewCalc'));
  tabScore.addEventListener('click', () => switchTab('viewScore'));
  tabLB.addEventListener('click',    () => switchTab('viewLB'));

  // Form
  btnScrape.addEventListener('click', doScrape);
  btnCalc.addEventListener('click',   doCalcAndSave);
  btnClear.addEventListener('click',  clearForm);
  btnNewProduct.addEventListener('click', () => { clearForm(); switchTab('viewCalc'); });
  btnClearAll.addEventListener('click', doClearAll);

  // Mark form dirty whenever user types (after last save)
  [fBrand, fProduct, fWeight, fPrice, fProtein, fServing].forEach(f => {
    f.addEventListener('input', () => {
      formDirty = true;
      updateTabState(currentView());
    });
  });

  // Brand autocomplete
  fBrand.addEventListener('input',  onBrandInput);
  fBrand.addEventListener('focus',  onBrandInput);
  fBrand.addEventListener('blur',   () => setTimeout(() => brandDropdown.classList.add('hidden'), 180));
  document.addEventListener('click', e => {
    if (!e.target.closest('.brand-wrap')) brandDropdown.classList.add('hidden');
  });

  // Leaderboard sort headers
  document.querySelectorAll('.th-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir * -1;
      } else {
        sortCol = col;
        sortDir = -1; // default desc
      }
      renderLeaderboard();
    });
  });
}

// ── TAB MANAGEMENT ───────────────────────────────────────────

function currentView() {
  const active = document.querySelector('.view.active');
  return active?.id ?? 'viewCalc';
}

function switchTab(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  updateTabState(viewId);
}

/**
 * Tab colour logic:
 * - Active tab = white underline + white text
 * - Calc + Score BOTH get blue dot + blue underline when:
 *     lastSaved exists AND formDirty is false (form matches last saved product)
 * - If formDirty = true (user edited form but hasn't saved), both go grey
 * - LB tab is always independent (no blue state)
 */
function updateTabState(activeViewId) {
  // Reset all
  [tabCalc, tabScore, tabLB].forEach(t => t.classList.remove('active', 'synced'));

  // Highlight active
  const tabMap = { viewCalc: tabCalc, viewScore: tabScore, viewLB: tabLB };
  if (tabMap[activeViewId]) tabMap[activeViewId].classList.add('active');

  // Synced blue state for calc+score pair
  const synced = lastSaved && !formDirty;
  if (synced) {
    tabCalc.classList.add('synced');
    tabScore.classList.add('synced');
    // But active tab overrides synced (active = white)
    if (activeViewId === 'viewCalc')  { tabCalc.classList.remove('synced');  tabCalc.classList.add('active'); }
    if (activeViewId === 'viewScore') { tabScore.classList.remove('synced'); tabScore.classList.add('active'); }
  }

  // Connector arrow colour
  const lines = document.querySelectorAll('.connector-line');
  if (synced) {
    lines.forEach(l => l.setAttribute('stroke', '#2563eb'));
  } else {
    lines.forEach(l => l.setAttribute('stroke', '#444'));
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
  // Switch to calc tab so user sees fields fill in
  switchTab('viewCalc');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']
    }).catch(() => {});

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => typeof window._proScoreScrape === 'function' ? window._proScoreScrape() : null
    });

    const d = results?.[0]?.result;
    if (!d) throw new Error('Could not read page — refresh and try');

    pendingScrape = { ...d, id: Date.now().toString() };

    setField(fBrand,   d.brand         ?? '', !!d.brand);
    setField(fProduct, d.name          ?? '', !!d.name);
    setField(fWeight,  d.weightGrams   ?? '', !!d.weightGrams);
    setField(fPrice,   d.price         ?? '', !!d.price);
    setField(fServing, d.servingSizeG  ?? '', !!d.servingSizeG);
    fProtein.value = '';
    fProtein.classList.remove('autofilled');
    fProtein.classList.add('needs-input');

    if (d.brand) pickBrand(d.brand);

    const missing = [!d.weightGrams && 'weight', !d.price && 'price'].filter(Boolean);
    if (missing.length) {
      setScrapeStatus(`Partial scrape — enter ${missing.join(' & ')} + protein from label`, 'err');
    } else {
      setScrapeStatus('Scraped ✓ — enter protein & serving from nutrition label', 'ok');
    }

    // Form is dirty until they calculate
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

// ── CALCULATE & SAVE ─────────────────────────────────────────
function doCalcAndSave() {
  const a = parseFloat(fProtein.value);
  const b = parseFloat(fServing.value);
  const c = parseFloat(fWeight.value);
  const d = parseFloat(fPrice.value);

  const badFields = [
    [a, fProtein], [b, fServing], [c, fWeight], [d, fPrice]
  ].filter(([v]) => !v || v <= 0);

  if (badFields.length) {
    badFields.forEach(([, f]) => f.classList.add('needs-input'));
    showToast('Fill all 4 numeric fields');
    return;
  }

  const proteinPer100g = (a / b) * 100;
  const totalProtein   = (proteinPer100g / 100) * c;
  const valueRaw       = (totalProtein / d) * 1000;

  const product = {
    id:         pendingScrape?.id    ?? Date.now().toString(),
    name:       fProduct.value.trim()  || 'Unknown Product',
    brand:      fBrand.value.trim()    || '',
    url:        pendingScrape?.url     || '',
    source:     pendingScrape?.source  || '',
    siteLabel:  pendingScrape?.siteLabel
                  || (pendingScrape?.source?.replace(/\.(com|in|co\.in|net|org).*$/, '') ?? ''),
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
    lastSaved = saved;

    // Form is now in sync with saved product
    formDirty = false;

    renderScorecard(saved);
    renderLeaderboard();
    showToast('Saved ✓');
    switchTab('viewScore');

    pendingScrape = { ...pendingScrape, id: product.id };
  });
}

// ── SCORECARD ────────────────────────────────────────────────
function renderScorecard(p) {
  if (!p) {
    // Show empty state
    scEmpty.classList.remove('hidden');
    scData.classList.add('hidden');
    [proScoreVal, proScoreGrade, proteinScoreVal, proteinScoreGrade,
     valueScoreVal, valueScoreGrade].forEach(el => el.textContent = '—');
    return;
  }

  // Meta strip
  scEmpty.classList.add('hidden');
  scData.classList.remove('hidden');

  // Name
  scName.textContent = (p.brand ? p.brand + ' · ' : '') + (p.name ?? '—');

  // Rank badge
  const rank = allProducts
    .slice().sort((a, b) => (b.proScore ?? 0) - (a.proScore ?? 0))
    .findIndex(x => x.id === p.id) + 1;

  scRankBadge.textContent = rank ? `#${rank}` : '';
  scRankBadge.className   = 'sc-rank' + (rank === 1 ? ' gold' : rank === 2 ? ' silver' : rank === 3 ? ' bronze' : '');

  // Pills
  scPillPrice.textContent  = p.price   ? `₹${fmtNum(p.price)}`   : 'Price N/A';
  scPillWeight.textContent = p.weightGrams ? `${fmtNum(p.weightGrams)}g` : 'Weight N/A';

  if (p.url) {
    scPillLink.href = p.url;
    scPillLink.classList.remove('hidden');
  } else {
    scPillLink.classList.add('hidden');
  }

  // Dataset note
  const n = allProducts.length;
  scDataset.textContent = n > 1
    ? `Scored relative to ${n} products in your dataset`
    : 'Add more products for relative scoring';

  // Scores
  proScoreVal.textContent     = fmt1(p.proScore);
  proteinScoreVal.textContent = fmt1(p.proteinScore);
  valueScoreVal.textContent   = fmt1(p.valueScore);

  const g  = p.grade ?? '—';
  const gc = 'grade-' + g;
  proScoreGrade.textContent     = g.toUpperCase();
  proScoreGrade.className       = 'score-grade ' + gc;
  proteinScoreGrade.textContent = g.toUpperCase();
  proteinScoreGrade.className   = 'sub-grade '   + gc;
  valueScoreGrade.textContent   = g.toUpperCase();
  valueScoreGrade.className     = 'sub-grade '   + gc;
}

// ── LEADERBOARD ──────────────────────────────────────────────
function renderLeaderboard() {
  // Update sort header visuals
  document.querySelectorAll('.th-sortable').forEach(th => {
    const active = th.dataset.col === sortCol;
    th.classList.toggle('sort-active', active);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = active ? (sortDir === -1 ? '↓' : '↑') : '↕';
  });

  // Sort + cap at 20
  const sorted = [...allProducts]
    .sort((a, b) => {
      const av = a[sortCol] ?? -Infinity;
      const bv = b[sortCol] ?? -Infinity;
      return (bv - av) * -sortDir; // sortDir -1=desc, 1=asc; formula flips
    })
    .slice(0, 20);

  // Update count
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

    // Highlight whichever column is sorted
    const colP   = sortCol === 'proteinScore' ? ' col-active' : '';
    const colV   = sortCol === 'valueScore'   ? ' col-active' : '';
    const colPro = sortCol === 'proScore'     ? ' col-active' : '';

    const tr = document.createElement('tr');
    if (rank > 10) tr.classList.add('dimmed');

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
      lastSaved = null;
      formDirty = false;
      renderScorecard(null);
      updateTabState('viewLB');
    }
    renderLeaderboard();
  });
}

function doClearAll() {
  if (!confirm('Clear all saved products?')) return;
  chrome.runtime.sendMessage({ action: 'clearAll' }, () => {
    allProducts = [];
    lastSaved   = null;
    formDirty   = false;
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
    f.classList.remove('autofilled', 'needs-input');
  });
  fProtein.classList.add('needs-input');
  fServing.classList.add('needs-input');
  pendingScrape = null;
  formDirty     = false;
  setScrapeStatus('', '');
  updateTabState(currentView());
}

// ── UTILS ────────────────────────────────────────────────────
function r1(n)    { return Math.round(n * 10) / 10; }
function fmt1(v)  { return (v == null || isNaN(v)) ? '—' : r1(v); }
function fmtNum(n){ return Number(n).toLocaleString('en-IN'); }
function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + '…' : (s ?? ''); }
function esc(s)   { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

let _tt;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => toastEl.classList.remove('show'), 2200);
}
