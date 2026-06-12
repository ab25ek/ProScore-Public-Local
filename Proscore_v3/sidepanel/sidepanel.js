// sidepanel.js

// ── STATE ──────────────────────────────────────────────────────
let allProducts  = [];
let allBrands    = [];
let lastSaved    = null;  // product object after save
let pendingScrape = null; // raw scraped data

// ── DOM ────────────────────────────────────────────────────────
const fBrand   = document.getElementById('fBrand');
const fProduct = document.getElementById('fProduct');
const fWeight  = document.getElementById('fWeight');
const fPrice   = document.getElementById('fPrice');
const fProtein = document.getElementById('fProtein');
const fServing = document.getElementById('fServing');

const brandDropdown  = document.getElementById('brandDropdown');

const btnScrape   = document.getElementById('btnScrape');
const btnCalc     = document.getElementById('btnCalc');
const btnClear    = document.getElementById('btnClear');
const btnShowLB   = document.getElementById('btnShowLB');
const btnBack     = document.getElementById('btnBackToForm');
const btnNewProduct = document.getElementById('btnNewProduct');
const btnBackFromLB = document.getElementById('btnBackFromLB');
const btnClearAll   = document.getElementById('btnClearAll');

const scrapeStatusEl = document.getElementById('scrapeStatus');

const proScoreVal       = document.getElementById('proScoreVal');
const proScoreGrade     = document.getElementById('proScoreGrade');
const proteinScoreVal   = document.getElementById('proteinScoreVal');
const proteinScoreGrade = document.getElementById('proteinScoreGrade');
const valueScoreVal     = document.getElementById('valueScoreVal');
const valueScoreGrade   = document.getElementById('valueScoreGrade');
const scoreNote         = document.getElementById('scoreNote');
const savedName         = document.getElementById('savedName');

const lbBody   = document.getElementById('lbBody');
const toastEl  = document.getElementById('toast');

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  setupListeners();
});

function loadAll() {
  chrome.runtime.sendMessage({ action: 'getProducts' }, (res) => {
    allProducts = res?.products || [];
    renderLeaderboard();
  });
  chrome.runtime.sendMessage({ action: 'getBrands' }, (res) => {
    allBrands = res?.brands || [];
  });
}

// ── LISTENERS ─────────────────────────────────────────────────
function setupListeners() {
  btnScrape.addEventListener('click', doScrape);
  btnCalc.addEventListener('click', doCalcAndSave);
  btnClear.addEventListener('click', clearForm);
  btnShowLB.addEventListener('click', () => showView('viewLB'));
  btnBack.addEventListener('click', () => showView('viewForm'));
  btnNewProduct.addEventListener('click', () => { clearForm(); showView('viewForm'); });
  btnBackFromLB.addEventListener('click', () => {
    showView(lastSaved ? 'viewScore' : 'viewForm');
  });
  btnClearAll.addEventListener('click', doClearAll);

  // Brand autocomplete
  fBrand.addEventListener('input', onBrandInput);
  fBrand.addEventListener('blur', () => {
    // Delay so click on dropdown option registers first
    setTimeout(() => brandDropdown.classList.add('hidden'), 180);
  });
  fBrand.addEventListener('focus', onBrandInput);

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.brand-wrap')) brandDropdown.classList.add('hidden');
  });
}

// ── VIEW SWITCHER ──────────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── BRAND AUTOCOMPLETE ─────────────────────────────────────────
function onBrandInput() {
  const q = fBrand.value.trim().toLowerCase();
  const matches = q
    ? allBrands.filter(b => b.toLowerCase().includes(q))
    : allBrands;

  brandDropdown.innerHTML = '';

  if (!matches.length) {
    if (q) {
      const d = document.createElement('div');
      d.className = 'brand-opt no-match';
      d.textContent = `Add "${fBrand.value.trim()}" as new brand`;
      d.addEventListener('mousedown', () => {
        pickBrand(fBrand.value.trim());
      });
      brandDropdown.appendChild(d);
    }
    brandDropdown.classList.toggle('hidden', !q);
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
  // Save new brand to repo if it doesn't exist
  if (!allBrands.includes(b)) {
    chrome.runtime.sendMessage({ action: 'addBrand', brand: b }, (res) => {
      if (res?.brands) allBrands = res.brands;
    });
  }
}

// ── SCRAPE ─────────────────────────────────────────────────────
async function doScrape() {
  btnScrape.disabled = true;
  setScrapeStatus('Scraping page…', '');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab — click a tab first');

    // Inject content script if not already present
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']
    }).catch(() => {}); // ignore if already injected

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => typeof window._proScoreScrape === 'function' ? window._proScoreScrape() : null
    });

    const d = results?.[0]?.result;
    if (!d) throw new Error('Could not read page — try refreshing it');

    pendingScrape = d;

    // Fill fields
    setField(fBrand,   d.brand    ?? '', !!d.brand);
    setField(fProduct, d.name     ?? '', !!d.name);
    setField(fWeight,  d.weightGrams ?? '', !!d.weightGrams);
    setField(fPrice,   d.price    ?? '', !!d.price);
    setField(fServing, d.servingSizeG ?? '', !!d.servingSizeG);
    // Protein always manual
    fProtein.value = '';
    fProtein.classList.remove('autofilled');
    fProtein.classList.add('needs-input');

    // Auto-add brand to repo
    if (d.brand) pickBrand(d.brand);

    const missing = [];
    if (!d.weightGrams) missing.push('weight');
    if (!d.price)       missing.push('price');

    if (missing.length) {
      setScrapeStatus(`Got partial data — check ${missing.join(' & ')} and enter protein from label`, 'err');
    } else {
      setScrapeStatus(`Scraped ✓ — enter protein & serving from nutrition label`, 'ok');
    }

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
  scrapeStatusEl.textContent = msg;
  scrapeStatusEl.className = 'scrape-status' + (cls ? ' ' + cls : '');
}

// ── CALCULATE & SAVE ──────────────────────────────────────────
function doCalcAndSave() {
  const a = parseFloat(fProtein.value); // protein per serving
  const b = parseFloat(fServing.value); // serving size g
  const c = parseFloat(fWeight.value);  // total weight g
  const d = parseFloat(fPrice.value);   // price ₹

  // Validation
  const errs = [];
  if (!a || a <= 0) errs.push(fProtein);
  if (!b || b <= 0) errs.push(fServing);
  if (!c || c <= 0) errs.push(fWeight);
  if (!d || d <= 0) errs.push(fPrice);

  if (errs.length) {
    errs.forEach(f => { f.classList.add('needs-input'); f.focus(); });
    showToast('Fill all 4 numeric fields');
    return;
  }

  // Derived
  const proteinPer100g = (a / b) * 100;
  const totalProtein   = (proteinPer100g / 100) * c;
  const valueRaw       = (totalProtein / d) * 1000;

  const product = {
    id:      pendingScrape?.id ?? Date.now().toString(),
    name:    fProduct.value.trim()   || 'Unknown Product',
    brand:   fBrand.value.trim()     || '',
    url:     pendingScrape?.url      || '',
    source:  pendingScrape?.source   || '',
    siteLabel: pendingScrape?.siteLabel || (pendingScrape?.source?.replace(/\.(com|in|co\.in|net|org).*$/, '') ?? ''),
    // Raw inputs
    proteinPerServing: a,
    servingSizeG: b,
    weightGrams: c,
    price: d,
    // Derived (before normalization)
    proteinPer100g: round1(proteinPer100g),
    totalProtein:   round1(totalProtein),
    valueRaw:       round1(valueRaw),
    // Scores set by background after normalization
    proteinScore: null, valueScore: null, proScore: null, grade: null,
  };

  // Save brand
  if (product.brand) pickBrand(product.brand);

  chrome.runtime.sendMessage({ action: 'saveProduct', product }, (res) => {
    if (!res?.ok) { showToast('Save failed'); return; }

    allProducts = res.products;

    // Find this product's normalized scores
    const saved = allProducts.find(p => p.id === product.id) || product;
    lastSaved = saved;

    renderScoreDisplay(saved);
    renderLeaderboard();
    showToast('Saved ✓');
    showView('viewScore');

    pendingScrape = { ...pendingScrape, id: product.id }; // persist id for re-save
  });
}

// ── SCORE DISPLAY ─────────────────────────────────────────────
function renderScoreDisplay(p) {
  if (!p) {
    [proScoreVal, proScoreGrade, proteinScoreVal, proteinScoreGrade,
     valueScoreVal, valueScoreGrade].forEach(el => el.textContent = '—');
    scoreNote.textContent = '';
    return;
  }

  proScoreVal.textContent     = fmt1(p.proScore);
  proteinScoreVal.textContent = fmt1(p.proteinScore);
  valueScoreVal.textContent   = fmt1(p.valueScore);

  const g = p.grade ?? '—';
  const gc = 'grade-' + g;
  proScoreGrade.textContent   = g.toUpperCase();
  proScoreGrade.className     = 'score-grade ' + gc;
  proteinScoreGrade.textContent = g.toUpperCase();
  proteinScoreGrade.className   = 'sub-grade ' + gc;
  valueScoreGrade.textContent   = g.toUpperCase();
  valueScoreGrade.className     = 'sub-grade ' + gc;

  savedName.textContent = (p.brand ? p.brand + ' — ' : '') + (p.name ?? '');

  const n = allProducts.length;
  scoreNote.textContent = n > 1
    ? `Scored relative to ${n} products in your dataset`
    : 'Add more products for relative scoring';
}

// ── LEADERBOARD ───────────────────────────────────────────────
function renderLeaderboard() {
  lbBody.innerHTML = '';

  // Sort by proScore desc, take top 20 for display
  const sorted = [...allProducts]
    .sort((a, b) => (b.proScore ?? 0) - (a.proScore ?? 0))
    .slice(0, 20);

  if (!sorted.length) {
    lbBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#888;font-size:12px;">
      No products saved yet.</td></tr>`;
    return;
  }

  sorted.forEach((p, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const isDimmed  = rank > 10;

    // Site label + link
    const siteLabel = p.siteLabel || p.source || '—';
    const siteCell  = p.url
      ? `<a class="lb-site-link" href="${esc(p.url)}" target="_blank" title="${esc(p.url)}">🔗 ${esc(siteLabel)}</a>`
      : `<span style="color:#aaa;font-size:10px">${esc(siteLabel)}</span>`;

    const tr = document.createElement('tr');
    if (isDimmed) tr.classList.add('dimmed');

    tr.innerHTML = `
      <td class="lb-rank ${rankClass}">${rank}</td>
      <td class="lb-name-cell">
        <span class="lb-name" title="${esc(p.name ?? '')}">${esc(trunc(p.name ?? '', 20))}</span>
        ${p.brand ? `<span class="lb-brand">${esc(trunc(p.brand, 18))}</span>` : ''}
      </td>
      <td>${fmt1(p.proteinScore)}</td>
      <td>${fmt1(p.valueScore)}</td>
      <td style="font-weight:800">${fmt1(p.proScore)}</td>
      <td class="lb-site-cell">${siteCell}</td>
      <td><button class="lb-del" data-id="${esc(p.id)}" title="Delete">✕</button></td>
    `;

    tr.querySelector('.lb-del').addEventListener('click', () => deleteProduct(p.id));
    lbBody.appendChild(tr);
  });
}

function deleteProduct(id) {
  chrome.runtime.sendMessage({ action: 'deleteProduct', id }, (res) => {
    if (res?.ok) {
      allProducts = res.products;
      renderLeaderboard();
      if (lastSaved?.id === id) {
        lastSaved = null;
        renderScoreDisplay(null);
      }
    }
  });
}

function doClearAll() {
  if (!confirm('Clear all saved products?')) return;
  chrome.runtime.sendMessage({ action: 'clearAll' }, () => {
    allProducts = [];
    lastSaved = null;
    renderLeaderboard();
    renderScoreDisplay(null);
    showView('viewForm');
  });
}

// ── FORM CLEAR ────────────────────────────────────────────────
function clearForm() {
  [fBrand, fProduct, fWeight, fPrice, fProtein, fServing].forEach(f => {
    f.value = '';
    f.classList.remove('autofilled', 'needs-input');
  });
  fProtein.classList.add('needs-input');
  fServing.classList.add('needs-input');
  pendingScrape = null;
  setScrapeStatus('', '');
}

// ── UTILS ─────────────────────────────────────────────────────
function round1(n) { return Math.round(n * 10) / 10; }

function fmt1(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return round1(v);
}

function trunc(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let _toastT;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(_toastT);
  _toastT = setTimeout(() => toastEl.classList.remove('show'), 2200);
}
