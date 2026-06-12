// content.js — injected into all pages, exposes window._proScoreScrape

(function () {
  if (window._proScoreScrape) return; // already injected

  // ── PRICE ─────────────────────────────────────────────────────

  function parseRupee(txt) {
    if (!txt) return null;
    const s = txt.replace(/,/g, '').replace(/\s/g, '');
    const m = s.match(/(?:₹|Rs\.?|INR)([\d]+(?:\.[\d]{1,2})?)/i);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return (v >= 99 && v <= 99999) ? v : null;
  }

  function firstPrice(selectors) {
    for (const sel of selectors) {
      try {
        for (const el of document.querySelectorAll(sel)) {
          const p = parseRupee(el.textContent || el.innerText || '');
          if (p) return p;
        }
      } catch (_) {}
    }
    return null;
  }

  // ── WEIGHT ────────────────────────────────────────────────────

  function weightFromStr(s) {
    if (!s) return null;
    s = s.replace(/,/g, '.');
    // kg — take last match (title often ends with size)
    const kg = [...s.matchAll(/(\d+(?:\.\d+)?)\s*kg\b/gi)];
    if (kg.length) {
      const v = parseFloat(kg[kg.length - 1][1]) * 1000;
      if (v >= 200 && v <= 30000) return Math.round(v);
    }
    // 3-5 digit grams
    const g = [...s.matchAll(/\b(\d{3,5})\s*g(?:rams?)?\b/gi)];
    if (g.length) {
      const v = parseFloat(g[g.length - 1][1]);
      if (v >= 200 && v <= 30000) return v;
    }
    // lbs
    const lb = [...s.matchAll(/(\d+(?:\.\d+)?)\s*lbs?\b/gi)];
    if (lb.length) {
      const v = Math.round(parseFloat(lb[lb.length - 1][1]) * 453.592);
      if (v >= 200 && v <= 20000) return v;
    }
    return null;
  }

  function weightFromVariant() {
    const sels = [
      // Amazon
      '#variation_size_name .selection',
      '#tp-inline-twister-dim-value-display-size_name',
      '#native_dropdown_selected_size_name option:checked',
      '.twisterButton.selected .a-button-inner',
      '.twisterButton.selected',
      // Flipkart
      '._31qSD5.selected ._3LIhhP',
      '._31qSD5.selected',
      '._3Rm2K3._3Yikzp',
      // HealthKart
      '.packSize-li.active',
      '.hk-packSize-li.active',
      // MyProtein
      'select[id*="Size"] option:checked',
      'select[id*="size"] option:checked',
      '[class*="variation"] option:checked',
      // Generic active/selected patterns
      'button[aria-pressed="true"]',
      '[class*="pack"][class*="active"]',
      '[class*="size"][class*="selected"]',
      '[class*="variant"][class*="active"]',
      '[class*="weight"][class*="selected"]',
      'select[name*="weight"] option:checked',
      'select[name*="size"] option:checked',
    ];
    for (const sel of sels) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const w = weightFromStr(el.textContent || el.value || '');
          if (w) return w;
        }
      } catch (_) {}
    }
    return null;
  }

  function servingFromPage() {
    const txt = document.body.innerText;
    const pats = [
      /serving\s*size[:\s]+(\d+\.?\d*)\s*g/i,
      /per\s*serv(?:ing|e)[:\s]+(\d+\.?\d*)\s*g/i,
      /per\s*scoop[\s(]+(\d+\.?\d*)\s*g/i,
      /\((\d+\.?\d*)\s*g\)\s*(?:per\s*)?(?:scoop|serving|serve)/i,
      /each\s*serving[:\s]+(\d+\.?\d*)\s*g/i,
    ];
    for (const p of pats) {
      const m = txt.match(p);
      if (m) { const v = parseFloat(m[1]); if (v >= 10 && v <= 300) return v; }
    }
    return null;
  }

  // ── SITE SCRAPERS ─────────────────────────────────────────────

  function amazon(r) {
    r.name  = document.querySelector('#productTitle')?.innerText?.trim() ?? null;
    const bEl = document.querySelector('#bylineInfo');
    if (bEl) r.brand = bEl.innerText.replace(/visit the\s+|store\b|\s*brand:/gi, '').trim();

    r.price = firstPrice([
      '.priceToPay .a-offscreen',
      '#corePrice_desktop .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
      '#apex_offerDisplay_desktop .a-price .a-offscreen',
      '#priceblock_dealprice',
      '#priceblock_saleprice',
      '#priceblock_ourprice',
      '.a-price[data-a-size="xl"] .a-offscreen',
      '.a-price .a-offscreen',
    ]);

    r.weightGrams = weightFromVariant()
      || weightFromStr(document.querySelector('#variation_size_name .selection')?.textContent ?? '')
      || weightFromStr(r.name ?? '');

    r.servingSizeG = servingFromPage();
  }

  function flipkart(r) {
    r.name = document.querySelector('.B_NuCI, .yhB1nd, h1.yhB1nd, h1[class*="Name"]')?.innerText?.trim()
      ?? document.querySelector('h1')?.innerText?.trim()
      ?? null;
    r.price = firstPrice([
      '._30jeq3._16Jk6d', '._30jeq3',
      '[class*="finalPrice"]', '[class*="sellingPrice"]',
    ]);
    r.weightGrams = weightFromVariant()
      || weightFromStr(document.querySelector('._31qSD5.selected, ._3Rm2K3._3Yikzp')?.textContent ?? '')
      || weightFromStr(r.name ?? '');
    r.servingSizeG = servingFromPage();
  }

  function myprotein(r) {
    r.name = document.querySelector('.productName_title, h1[class*="productName"], .athena-product-name')?.innerText?.trim() ?? null;
    r.price = firstPrice(['.productPrice_price', '[class*="currentPrice"]', '[class*="productPrice"]']);
    r.weightGrams = weightFromVariant() || weightFromStr(r.name ?? '');
    r.servingSizeG = servingFromPage();
  }

  function healthkart(r) {
    r.name = document.querySelector('[class*="pdp-product-name"], h1[class*="product"]')?.innerText?.trim() ?? null;
    r.price = firstPrice([
      '[class*="pdp-price"] strong', '[class*="final-price"]',
      '[class*="sellingPrice"]', '[class*="finalPrice"]',
    ]);
    r.weightGrams = weightFromVariant() || weightFromStr(r.name ?? '');
    r.servingSizeG = servingFromPage();
  }

  function bigbasket(r) {
    r.name = document.querySelector('h1.pb-1, [class*="product-name"]')?.innerText?.trim() ?? null;
    r.price = firstPrice(['[class*="discounted"]', '[class*="selling-price"]', '[class*="pd-price"]']);
    r.weightGrams = weightFromVariant() || weightFromStr(r.name ?? '');
    r.servingSizeG = servingFromPage();
  }

  function generic(r) {
    if (!r.name) {
      r.name = document.querySelector('h1')?.innerText?.trim()
        ?? document.title?.substring(0, 200)
        ?? null;
    }
    if (!r.price) {
      const txt = document.body.innerText.replace(/,/g, '');
      const vals = [...txt.matchAll(/(?:₹|Rs\.?)\s*(\d+(?:\.\d{1,2})?)/g)]
        .map(m => parseFloat(m[1]))
        .filter(v => v >= 99 && v <= 99999);
      if (vals.length) {
        const freq = {};
        vals.forEach(v => freq[v] = (freq[v] || 0) + 1);
        r.price = parseFloat(
          Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
        );
      }
    }
    if (!r.weightGrams) {
      r.weightGrams = weightFromVariant()
        || weightFromStr(document.querySelector('h1')?.innerText ?? '')
        || weightFromStr(document.title);
    }
    if (!r.servingSizeG) r.servingSizeG = servingFromPage();
  }

  // ── ENTRY POINT ───────────────────────────────────────────────

  window._proScoreScrape = function () {
    const host = location.hostname.replace(/^www\./, '');
    const r = {
      name: null, brand: null,
      price: null, weightGrams: null, servingSizeG: null,
      url: location.href,
      source: host,
      // human-friendly site label for leaderboard
      siteLabel: host.replace(/\.(com|in|co\.in|net|org).*$/, '').replace(/-/g, ' '),
    };

    try {
      if      (host.includes('amazon'))     amazon(r);
      else if (host.includes('flipkart'))   flipkart(r);
      else if (host.includes('myprotein'))  myprotein(r);
      else if (host.includes('healthkart')) healthkart(r);
      else if (host.includes('bigbasket'))  bigbasket(r);
      else                                  generic(r);
    } catch (e) { console.warn('[ProScore] scrape error:', e); }

    // Always run generic to fill any remaining nulls
    generic(r);
    return r;
  };
})();
