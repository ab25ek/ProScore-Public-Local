// background.js — opens side panel on icon click, manages storage

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['products', 'brands'], (d) => {
    if (!d.products) chrome.storage.local.set({ products: [] });
    if (!d.brands)   chrome.storage.local.set({ brands: [] });
  });
});

// ── SCORING ENGINE ──────────────────────────────────────────────
function gradeFor(score) {
  return score >= 80 ? 'Excellent' :
         score >= 60 ? 'Good' :
         score >= 40 ? 'Okay' :
         score >= 20 ? 'Bad' : 'Poor';
}

function recalcScores(products) {
  const valid = products.filter(p => p.proteinPer100g > 0 && p.valueRaw > 0);
  if (!valid.length) return products;

  const maxP = Math.max(...valid.map(p => p.proteinPer100g));
  const maxV = Math.max(...valid.map(p => p.valueRaw));

  return products.map(p => {
    if (!p.proteinPer100g || !p.valueRaw) return p;
    const proteinScore = Math.min(100, Math.max(0, (p.proteinPer100g / maxP) * 100));
    const valueScore   = Math.min(100, Math.max(0, (p.valueRaw   / maxV)   * 100));
    const proScore     = (proteinScore + valueScore) / 2;
    return {
      ...p,
      proteinScore:  round1(proteinScore),
      valueScore:    round1(valueScore),
      proScore:      round1(proScore),
      proteinGrade:  gradeFor(proteinScore),
      valueGrade:    gradeFor(valueScore),
      proGrade:      gradeFor(proScore),
      grade:         gradeFor(proScore), // backwards compat
    };
  });
}

function round1(n) { return Math.round(n * 10) / 10; }

// ── MESSAGE ROUTER ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {
    case 'saveProduct':   saveProduct(msg.product, sendResponse);   return true;
    case 'getProducts':   getProducts(sendResponse);                 return true;
    case 'deleteProduct': deleteProduct(msg.id, sendResponse);       return true;
    case 'clearAll':      clearAll(sendResponse);                    return true;
    case 'getBrands':     getBrands(sendResponse);                   return true;
    case 'addBrand':      addBrand(msg.brand, sendResponse);         return true;
  }
});

function getProducts(cb) {
  chrome.storage.local.get('products', d => cb({ products: d.products || [] }));
}

function saveProduct(product, cb) {
  chrome.storage.local.get('products', (d) => {
    let products = d.products || [];
    const idx = products.findIndex(p => p.id === product.id);
    if (idx >= 0) {
      products[idx] = { ...product, updatedAt: Date.now() };
    } else {
      products.push({ ...product, savedAt: Date.now() });
    }
    products = recalcScores(products);
    chrome.storage.local.set({ products }, () => cb({ ok: true, products }));
  });
}

function deleteProduct(id, cb) {
  chrome.storage.local.get('products', (d) => {
    let products = (d.products || []).filter(p => p.id !== id);
    products = recalcScores(products);
    chrome.storage.local.set({ products }, () => cb({ ok: true, products }));
  });
}

function clearAll(cb) {
  chrome.storage.local.set({ products: [] }, () => cb({ ok: true }));
}

function getBrands(cb) {
  chrome.storage.local.get('brands', d => cb({ brands: d.brands || [] }));
}

function addBrand(brand, cb) {
  if (!brand || !brand.trim()) { cb({ ok: false }); return; }
  chrome.storage.local.get('brands', (d) => {
    const brands = d.brands || [];
    const b = brand.trim();
    if (!brands.includes(b)) {
      brands.push(b);
      brands.sort((a, b) => a.localeCompare(b));
      chrome.storage.local.set({ brands }, () => cb({ ok: true, brands }));
    } else {
      cb({ ok: true, brands });
    }
  });
}
