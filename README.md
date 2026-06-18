# ProScore — Protein Supplement Scorer

> Stop overpaying for mediocre protein.

ProScore is a Chrome extension that scores protein supplements in real-time on Amazon & Flipkart. No more guessing — see **Protein Score**, **Value Score**, and a final **ProScore** instantly.

---

## How It Works

ProScore calculates three metrics per product:

| Metric | What It Measures |
|---|---|
| **Protein Score** | Actual protein quality per serving |
| **Value Score** | Cost per gram of protein (₹/g) |
| **ProScore** | Combined Final Score |

Three tabs inside the extension:
- **Calculate** — Score any supplement manually
- **Scorecard** — Save and compare products
- **Leaderboard** — Ranked list, sortable by ProScore

---

## Installation (3 steps, ~2 minutes)

### 1. Download the extension

Click the green **Code** button on this page → **Download ZIP**

Or clone via terminal:
```bash
git clone https://github.com/ab25ek/ProScore-Public-Local.git
```

### 2. Open Chrome Extensions

Go to:
```
chrome://extensions/
```
Enable **Developer mode** using the toggle in the top-right corner.

### 3. Load the extension

1. Click **Load unpacked**
2. Select the **`ProScore v5`** folder from the downloaded files
3. ProScore icon appears in your Chrome toolbar — done.

---

## Using ProScore

1. Go to **Amazon.in** or **Flipkart.com**
2. Open any protein supplement product page
3. Click the **ProScore icon** in your toolbar
4. Enter or confirm product details
5. See your score instantly

**Scorecard tab** saves products for comparison.  
**Leaderboard tab** ranks everything you've scored — sorted by ProScore by default.

## Known Limitations

- Don't compare whey vs. plant-based protein — different absorption profiles
- This is a local version — not yet crowdsourced
- Some supplements with unclear labeling may score inaccurately

---

## Troubleshooting

**Extension not loading?**
- Make sure you selected the `ProScore v4` folder (not the root repo folder)
- Developer mode must be ON in `chrome://extensions/`

**Scores not showing?**
- Refresh the product page after installing
- Confirm you're on Amazon.in or Flipkart.com

**Something looks wrong?**
- Open an [Issue](https://github.com/ab25ek/ProScore-Public-Local/issues) with the product link + what you expected to see

---

## Repo Structure

```
ProScore-Public-Local/
├── ProScore v4/        ← Use this version
├── Proscore_v3/        ← Older version (for reference)
├── LICENSE
└── README.md
```

---

## Built With

- JavaScript (59%)
- CSS (27%)
- HTML (14%)

---

## License

MIT — free to use, fork, and modify.

---

**Case study on Behance** → [https://www.behance.net/gallery/251027155/ProScore-Chrome-Extension]  
**Built by Abisek** — Brand & UX Designer
