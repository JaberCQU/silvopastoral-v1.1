# CQ Silvopastoral Dashboard

**Live demo:** https://jabercqu.github.io/silvopastoral/

An interactive, browser-based decision-support tool for cattle station owners in Central Queensland considering integrated beef-timber (silvopastoral) enterprises.

---

## Changelog

**v1.1 (current)** — Beef logistics parity update
- Added a **Station region** selector (Rockhampton/Fitzroy, Emerald/Central Highlands, Mackay/Pioneer Valley, Longreach/Central West)
- Added nearest **saleyard** and **abattoir** lookup per region, with distance and a road-access risk badge (Low/Moderate/High)
- Added a **cattle cartage cost model** using livestock industry $/head/100km pricing — a genuinely different unit-economics model from the existing $/km/load timber freight calculation, not a reuse of it
- Added **annual cattle turnoff** estimate (20% of herd/year) driving the cartage cost calculation
- Cartage cost now appears as its own line item on the Profit tab and in the 25-year bar chart, alongside the existing timber transport cost
- This brings beef logistics modelling up to the same depth as the existing timber logistics modelling (sawmill distance + transport cost), closing a gap identified during Phase 1 review

**v1.0** — Initial static prototype
- Five-tab dashboard: Inputs, Profit, Shade & Water, Regulations, Logistics
- Species lookup (Hoop Pine, Spotted Gum, Grey Ironbark, White Mahogany) with sawmill distance and transport cost
- ACCU carbon credit income model
- Shade productivity bonus model
- VMA regulatory checklist

---

## Project structure

```
/
├── index.html      # Main HTML shell and tab structure
├── style.css       # All styling and CSS design tokens
├── app.js          # Calculation engine and DOM updates
└── README.md       # This file
```

---

## How to run locally

No build step required. Simply open `index.html` in any modern browser:

```bash
# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

Or serve it with Python for local development:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

---

## How to deploy (GitHub Pages)

1. Push all files to the root of your GitHub repository
2. Go to Settings > Pages
3. Set source: Deploy from branch > main > / (root)
4. Your site will be live at `https://YOUR-USERNAME.github.io/REPO-NAME/`

---

## Phase roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | Complete | Static HTML/CSS/JS prototype — all calculations client-side |
| 2 | Planned  | FastAPI backend, PostgreSQL database, user accounts |
| 3 | Planned  | Mapbox GL JS spatial layer, PostGIS paddock mapping |
| 4 | Planned  | Live data feeds (MLA prices, ACCU spot price, BOM climate) |
| 5 | Planned  | Mobile app (React Native) for use on-station |

---

## Data sources

- Timber yield: ABARES silvicultural guidelines (QLD native species)
- Beef productivity: MLA benchmarks for central QLD grazing systems
- Carbon credits: Clean Energy Regulator (Human Induced Regeneration method)
- Transport (timber): Road freight industry averages for QLD bulk timber haulage
- Transport (beef): Livestock transport industry averages ($/head/100km cattle crate rate)
- Seedling prices: QLD commercial nursery industry estimates (2024)

---

## Disclaimer

All figures are indicative only. Verify with Queensland DAF, Clean Energy Regulator, Timber Queensland, and MLA before making investment decisions.
