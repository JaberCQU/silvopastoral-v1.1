# CQ Silvopastoral Dashboard

**Live demo:** https://jabercqu.github.io/silvopastoral/

An interactive, browser-based decision-support tool for cattle station owners in Central Queensland considering integrated beef-timber (silvopastoral) enterprises.

---

## Changelog

**v1.2 (current)** — Phase 2 backend integration
- Added `api.js`, a new file connecting this dashboard to the live FastAPI + PostgreSQL backend (`https://cq-silvopastoral-api-zwsa.onrender.com`)
- On page load, the dashboard now tries to fetch species and region reference data from the live API. **If the API is unreachable for any reason** (Render's free tier asleep, no internet, etc.), it **silently falls back to the built-in hardcoded data** in `app.js` — the dashboard is fully functional either way, and a small "Live data" / "Offline mode" badge in the header shows which source is active
- Added a collapsible **Account & saved scenarios** panel: register/login, create a station profile, save the current slider values as a named scenario, and reload a saved scenario later
- `app.js`'s calculation logic is completely unchanged — this update only adds data loading and persistence around it, so the dashboard's real-time slider feel is unaffected

**v1.1** — Beef logistics parity update
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
├── index.html      # Main HTML shell, tab structure, and Account & saved scenarios panel
├── style.css       # All styling, including connection-status badge and account panel
├── app.js          # Calculation engine and DOM updates (unchanged from v1.1)
├── api.js          # Phase 2: live API integration, auth, save/load scenarios
└── README.md       # This file
```

---

## How the frontend talks to the backend

`api.js` is intentionally kept as a **separate file** from `app.js`, not merged into it. This keeps the existing, already-tested calculation logic completely untouched — `api.js` only adds two things around it:

1. **Reference data loading** — on page load, tries `GET /reference/species` and `GET /reference/regions` from the live API. The response field names (snake_case, e.g. `seed_price`, `mill_km`) are converted to the shape `app.js` already expects (`seedP`, `millKm`) so `app.js` itself needs zero changes regardless of where the data came from.

2. **Accounts and saved scenarios** — a login/register panel and save/load buttons that call the backend's `/auth`, `/stations`, and `/stations/{id}/scenarios` endpoints.

If the API call in step 1 fails for any reason — the backend is asleep (Render's free tier spins down after 15 minutes of inactivity), there's no internet, the URL changed — the dashboard automatically falls back to the original hardcoded `SPECIES`/`REGIONS` data and remains fully usable. A small badge in the top right of the header shows **"Live data"** (green) or **"Offline mode"** (amber) so it's clear which source is currently active.

To point this dashboard at a different backend deployment, update the `API_BASE` constant at the top of `api.js`.

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
| 2 | Complete | FastAPI backend, PostgreSQL database, user accounts, this frontend now connects to it live |
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
