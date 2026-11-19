/* ============================================================
   CQ Silvopastoral Dashboard — Calculation Engine
   Author: Jaber (CQUniversity)
   Version: 2.0 (Workshop Edition)

   New in v2.0:
   - Multi-horizon profit analysis (5/10/15/20/25/30/40 yr)
   - New cost inputs: tree establishment, thinning, farm overhead,
     cattle maintenance
   - Species suggestion box (soil type + market economics)
   - Planting density suggestion box (research-backed optimal ranges)
   - Interactive map region selector
   - Corrected slider ranges (station size, carry capacity, royalty etc.)
   ============================================================ */

'use strict';

// ---- Reference data: species ----------------------------------------
// seedP:   seed + seedling cost per seed/plant
// m3ha:    timber yield m³/ha at harvest (25yr)
// millKm:  typical km to nearest sawmill by region
// badge:   market outlook label
// nursery: nearest nursery source

const SPECIES = {
  hoop_pine: {
    label:    'Hoop Pine',
    seedP:    0.65,
    m3ha:     180,
    mill:     'Gympie / Maryborough Sawmill',
    millKm:   280,
    badge:    'High demand',
    nursery:  'Nursery Supplies Australia — Toowoomba',
    seedLead: '12–18 months',
    export:   'Structural timber, interior joinery; strong domestic demand from Queensland builders.',
  },
  spotted_gum: {
    label:    'Spotted Gum',
    seedP:    0.90,
    m3ha:     120,
    mill:     'CQ Native Timber Co. — Rockhampton',
    millKm:   95,
    badge:    'Premium export',
    nursery:  'Redlands Nursery — Brisbane',
    seedLead: '9–12 months',
    export:   'Hardwood flooring, decking, structural; premium Asian export market. Highest royalty potential.',
  },
  ironbark: {
    label:    'Ironbark',
    seedP:    0.75,
    m3ha:     100,
    mill:     'CQ Native Timber Co. — Rockhampton',
    millKm:   95,
    badge:    'Niche premium',
    nursery:  'Redlands Nursery — Brisbane',
    seedLead: '9–15 months',
    export:   'Very high density hardwood; rail sleepers, power poles, heavy construction. Slower growing but highest durability.',
  },
  white_mahogany: {
    label:    'White Mahogany',
    seedP:    0.80,
    m3ha:     130,
    mill:     'CQ Native Timber Co. — Rockhampton',
    millKm:   95,
    badge:    'Good local',
    nursery:  'Capricorn Coast Nursery — Yeppoon',
    seedLead: '6–9 months',
    export:   'General construction, furniture, flooring. Good local demand; lower export volume than Spotted Gum.',
  },
};

// ---- Reference data: regions ----------------------------------------
const REGIONS = {
  rockhampton: {
    label:      'Rockhampton / Fitzroy',
    saleyard:   'Gracemere Saleyards',
    saleyardKm: 12,
    abattoir:   'JBS Australia — Rockhampton',
    abattoirKm: 20,
    roadNote:   'Sealed roads to Gracemere / JBS year-round. Fitzroy River crossings may close Dec–Mar.',
    roadRisk:   'low',
    soilNote:   'Red and brown vertosols; fertile, prone to cracking. Suits spotted gum and ironbark on well-drained ridge country.',
  },
  emerald: {
    label:      'Emerald / Central Highlands',
    saleyard:   'Emerald Saleyards',
    saleyardKm: 8,
    abattoir:   'JBS Australia — Rockhampton',
    abattoirKm: 270,
    roadNote:   'Capricorn Hwy sealed year-round. Some local roads become impassable after heavy rain.',
    roadRisk:   'medium',
    soilNote:   'Red dermosols and chromosols over basalt. Excellent for spotted gum on red country; white mahogany on lighter soils.',
  },
  mackay: {
    label:      'Mackay / Pioneer Valley',
    saleyard:   'Nebo Road Saleyards',
    saleyardKm: 30,
    abattoir:   'NH Foods — Mackay',
    abattoirKm: 55,
    roadNote:   'Bruce Hwy sealed but inland roads deteriorate Jan–Apr wet season. High annual rainfall 1200–1500mm.',
    roadRisk:   'high',
    soilNote:   'Alluvial soils near Pioneer Valley; red basalt soils inland. Best region for hoop pine and white mahogany. High rainfall boosts growth rates.',
  },
  longreach: {
    label:      'Longreach / Central West',
    saleyard:   'Longreach Saleyards',
    saleyardKm: 5,
    abattoir:   'Nolan Meats — Grantham (est. transport)',
    abattoirKm: 650,
    roadNote:   'Longreach Hwy sealed. Western roads subject to flooding closures Aug–Feb flood seasons.',
    roadRisk:   'high',
    soilNote:   'Grey and brown cracking clays (vertosols); semi-arid Mitchell grass country. Ironbark and mulga suit this region. Carbon sequestration potential is very high.',
  },
  gingin: {
    label:      'Gin Gin / North Burnett',
    saleyard:   'Murgon Saleyards',
    saleyardKm: 70,
    abattoir:   'Oakey Beef Exports — Oakey',
    abattoirKm: 220,
    roadNote:   'Bruce Hwy and Burnett Hwy sealed year-round. Some back roads close after heavy summer rain.',
    roadRisk:   'low',
    soilNote:   'Red loams and yellow earths over Burnett sandstone. Excellent for Hoop Pine (proven plantation history nearby) and Spotted Gum on red country. Rainfall 700–900mm — reliable for most species.',
  },
};

// ---- Regulatory data ------------------------------------------------
const REGS = [
  {
    icon: '🌿',
    title: 'Vegetation Management Act 1999 (QLD)',
    desc: 'All native vegetation clearing requires approval under the VMA. Silvopastoral planting on cleared land is encouraged; felling of remnant or regrowth vegetation is restricted. Category X land is freely clearable; Category R requires a Development Approval.',
    badge: 'badge-amber',
    badgeText: 'Approval required',
  },
  {
    icon: '🌊',
    title: 'Carbon Credits (ACCU Scheme)',
    desc: 'Hilly & Sloping Land Carbon Method (Human-induced Regeneration) is applicable in CQ. Projects must be registered with the Clean Energy Regulator. Permanence periods are 25 or 100 years. Additionality must be demonstrated.',
    badge: 'badge-blue',
    badgeText: 'CER registration',
  },
  {
    icon: '🐄',
    title: 'Land Tax & Primary Production',
    desc: 'Land used for primary production (cattle + forestry combined) may qualify for primary production land tax exemption. The silvopastoral system must meet the QLD Revenue Office's dominant use test.',
    badge: 'badge-green',
    badgeText: 'Usually exempt',
  },
  {
    icon: '🪵',
    title: 'Forestry Act 1959 (QLD) — Royalties',
    desc: 'Timber harvested from freehold land is subject to private native forestry codes. Royalties are set by the landowner but must reflect market rate. If harvesting State-managed forest areas, State royalty rates apply ($40–$250/m³ depending on species).',
    badge: 'badge-amber',
    badgeText: 'Royalty schedule',
  },
  {
    icon: '📋',
    title: 'Private Native Forestry Code of Practice (QLD)',
    desc: 'The PNF Code governs all commercial timber harvesting on freehold land. Requires a PNF Plan lodged with DAFF. Stream buffers, slope limits, and coupe size restrictions apply. Compliance audits are periodic.',
    badge: 'badge-amber',
    badgeText: 'PNF plan required',
  },
  {
    icon: '💧',
    title: 'Water Act 2000 — Riparian Buffers',
    desc: 'Planting within 50m of a waterway requires a Development Permit. However, strategic silvopastoral planting in riparian zones can qualify for the Reef Credit Scheme (water quality credits), generating an additional revenue stream.',
    badge: 'badge-blue',
    badgeText: 'Buffer rules apply',
  },
];

// ---- Species suggestion data -----------------------------------------
// soil: best-fit soil types per region
// market: economic rationale

const SPECIES_SUGGESTIONS = {
  rockhampton: {
    bestSoil:   'spotted_gum',
    bestMarket: 'spotted_gum',
    soilReason: 'Red/brown vertosols on ridge country suit Spotted Gum\'s deep root system and drought tolerance.',
    marketReason: 'Spotted Gum commands the highest royalty ($120–250/m³) with active Asian export demand through Rockhampton port.',
    alternatives: ['ironbark'],
    altNote: 'Ironbark suits heavier clay country; slower growth but very high timber density and durability.',
  },
  emerald: {
    bestSoil:   'spotted_gum',
    bestMarket: 'spotted_gum',
    soilReason: 'Red dermosols over basalt plateaus are ideal for Spotted Gum, providing good drainage and nutrients.',
    marketReason: 'Spotted Gum offers the best combined yield × royalty outcome for Central Highlands, with established markets via Rocky.',
    alternatives: ['white_mahogany'],
    altNote: 'White Mahogany performs well on lighter sandy soils at the margins of the Central Highlands.',
  },
  mackay: {
    bestSoil:   'hoop_pine',
    bestMarket: 'white_mahogany',
    soilReason: 'High annual rainfall (1,200–1,500mm) and alluvial valleys suit Hoop Pine\'s growth requirements exceptionally well.',
    marketReason: 'White Mahogany has strong local Mackay demand (construction, furniture) with minimal transport costs to NH Foods abattoir region.',
    alternatives: ['hoop_pine'],
    altNote: 'Hoop Pine offers high m³/ha yield and is the dominant plantation species in SE QLD, with proven Mackay establishment history.',
  },
  longreach: {
    bestSoil:   'ironbark',
    bestMarket: 'ironbark',
    soilReason: 'Semi-arid grey and brown cracking clays suit Ironbark and Mulga. Hoop Pine and Spotted Gum require significantly more rainfall.',
    marketReason: 'Ironbark for rail sleepers and power poles has stable government infrastructure demand. Carbon sequestration in this region commands premium ACCUs due to high additionality.',
    alternatives: [],
    altNote: 'Note: consider supplementary carbon revenue as the primary income stream for Longreach operations — timber transport distances are high.',
  },
  gingin: {
    bestSoil:   'spotted_gum',
    bestMarket: 'spotted_gum',
    soilReason: 'Red loams and yellow earths over Burnett sandstone suit Spotted Gum very well — the species thrives on well-drained red country with 700–900 mm rainfall, delivering consistent yields across the North Burnett.',
    marketReason: 'Spotted Gum commands premium prices in the hardwood export market (flooring, decking, structural). High and growing demand from Asian export buyers, with proximity to Maryborough and Brisbane port keeping logistics costs competitive.',
    alternatives: ['hoop_pine'],
    altNote: 'Hoop Pine is a proven plantation species in the North Burnett with lower establishment risk and shorter sawlog rotation, but lower royalty than Spotted Gum.',
  },
};

// ---- Density suggestion data -----------------------------------------
// Bands are based on MLA (2022) Silvopastoral Guidelines and
// Queensland LTCC plantation research.

const DENSITY_BANDS = [
  {
    max: 150,
    label: 'Very Low',
    color: 'var(--blue)',
    icon: '🌱',
    text: 'Below 150 trees/ha. Insufficient canopy for meaningful shade co-benefits. Carbon sequestration rates are low. Recommended only if the primary goal is a scattered shade tree system rather than commercial timber.',
  },
  {
    max: 250,
    label: 'Low',
    color: 'var(--blue)',
    icon: '🌲',
    text: '150–250 trees/ha. Good for open silvopastoral systems where cattle movement and feed access is a priority. Moderate shade benefit; suitable for open grassland regions like Longreach where grass biomass is paramount.',
  },
  {
    max: 400,
    label: '✅ Optimal',
    color: 'var(--green)',
    icon: '🌳',
    text: '250–400 trees/ha is the MLA-recommended optimal range for CQ silvopasture. This density balances timber yield, shade/carbon co-benefits, and grass understorey productivity. Thinning at Year 10–12 to 150–200 stems/ha is standard practice.',
  },
  {
    max: 600,
    label: 'Moderate-High',
    color: 'var(--amber)',
    icon: '🌿',
    text: '400–600 trees/ha. Suitable if early thinning (Year 8–10) is planned. Initial density drives early crown closure for carbon and weed suppression; aggressive thinning recovers understorey. Higher establishment cost.',
  },
  {
    max: 1000,
    label: '⚠️ High — plan for thinning',
    color: 'var(--amber)',
    icon: '⚠️',
    text: 'Above 600 trees/ha will significantly suppress grass production and reduce cattle carrying capacity. Only viable as a temporary high-density system with planned early thinning to 300–350 stems/ha by Year 6–8. Research: QLD LTCC (2021) showed >600 stems/ha reduced grass DM yield by 42%.',
  },
];

// ---- Active horizon (years) for multi-horizon analysis ---------------
let activeHorizon = 25;
let horizonChart  = null;
let profitChart   = null;

// ---- Format helpers --------------------------------------------------
function fmtK(n) {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1000)      return Math.round(n / 1000) + 'k';
  return String(Math.round(n));
}

function fmtMoney(n) {
  const prefix = n < 0 ? '-$' : '$';
  return prefix + fmtK(Math.abs(n));
}

function fmtN(n) {
  return Math.round(n).toLocaleString('en-AU');
}

// ---- Calculate profit for a given horizon (years) --------------------
function calcProfit(hz) {
  const regionKey  = document.getElementById('region').value  || 'rockhampton';
  const speciesKey = document.getElementById('species').value || 'hoop_pine';
  const ha         = parseFloat(document.getElementById('hectares').value)      || 200;
  const density    = parseFloat(document.getElementById('density').value)       || 300;
  const beefP      = parseFloat(document.getElementById('beef-price').value)    || 800;
  const carry      = parseFloat(document.getElementById('carry').value)         || 8;
  const cartageR   = parseFloat(document.getElementById('cattle-cartage').value)|| 14;
  const carbonP    = parseFloat(document.getElementById('carbon-price').value)  || 35;
  const royaltyP   = parseFloat(document.getElementById('royalty').value)       || 95;
  const estabCost  = parseFloat(document.getElementById('estab-cost').value)    || 600;
  const thinCost   = parseFloat(document.getElementById('thin-cost').value)     || 50;
  const overhead   = parseFloat(document.getElementById('overhead-cost').value) || 30000;
  const cattleMaint= parseFloat(document.getElementById('cattle-maint').value)  || 60;
  const stationHa  = parseFloat(document.getElementById('station-ha').value)    || 5000;

  const sp = SPECIES[speciesKey] || SPECIES.hoop_pine;

  // --- Cattle calculations ---
  const totalCattle   = Math.floor(stationHa / carry);
  const plantedCattle = Math.floor(ha / carry);

  // Beef income: sale 1 turnoff/yr per 2 head (conservative)
  // beefP is c/kg LW; average 400 kg LW per head
  const avgLW        = 400; // kg
  const beefPerHead  = (beefP / 100) * avgLW; // convert c/kg → $
  const beefMain     = totalCattle * beefPerHead * hz;

  // Shade/water productivity bonus ($12/head/yr for cattle under canopy)
  const shadeBonus = plantedCattle * 12 * hz;

  // --- Timber ---
  // Harvest assumed at Year 25 (single point), scaled pro-rata for other horizons
  const harvestFraction = Math.min(hz / 25, 1.0);
  const timberRoyalty   = ha * sp.m3ha * harvestFraction * royaltyP;

  // --- Carbon ---
  const carbonSeqRate = 12; // tCO2e/ha/yr (CER HIRF method typical)
  const carbonIncome  = ha * carbonSeqRate * hz * carbonP;

  // --- Costs ---
  // Tree establishment: one-off
  const totalEstab = ha * estabCost;

  // Seed cost within establishment (already included in estabCost, but seeds are additive)
  const seedCount = ha * density;
  const seedCost  = seedCount * sp.seedP;
  const totalEstabWithSeed = totalEstab + seedCost;

  // Thinning/maintenance: annual, per ha
  const thinTotal = ha * thinCost * hz;

  // Farm overhead: annual
  const overheadTotal = overhead * hz;

  // Opportunity cost: planted ha at typical grazing income forgone
  const beefPerHaYr = (beefP / 100) * avgLW * (1 / carry);
  const oppCost     = ha * beefPerHaYr * hz;

  // Timber transport: cost from mill ($/km/m³ approx $0.15)
  const millKm          = sp.millKm || 150;
  const transportPerM3  = 0.15;
  const timberTransport = ha * sp.m3ha * harvestFraction * millKm * transportPerM3;

  // Cattle cartage: total herd × rate × hz (annual musters)
  const cattleCartage = totalCattle * cartageR * hz;

  // Cattle maintenance costs: $/head/yr
  const cattleMaintTotal = totalCattle * cattleMaint * hz;

  const totalRev  = beefMain + shadeBonus + timberRoyalty + carbonIncome;
  const totalCost = totalEstabWithSeed + thinTotal + overheadTotal + oppCost + timberTransport + cattleCartage + cattleMaintTotal;
  const netProfit = totalRev - totalCost;

  return {
    hz, ha, density, totalCattle, plantedCattle,
    beefMain, shadeBonus, timberRoyalty, carbonIncome,
    totalEstabWithSeed, thinTotal, overheadTotal, oppCost,
    timberTransport, cattleCartage, cattleMaintTotal,
    totalRev, totalCost, netProfit,
    regionKey, speciesKey, sp,
  };
}

// ---- Find approximate payback year -----------------------------------
function findPayback() {
  for (const yr of [5, 10, 15, 20, 25, 30, 40]) {
    const r = calcProfit(yr);
    if (r.netProfit >= 0) return yr;
  }
  return '>40';
}

// ---- Main update function --------------------------------------------
function update() {
  updateSliderLabels();

  const r = calcProfit(activeHorizon);

  // --- Summary cards ---
  document.getElementById('mv-rev').textContent   = fmtMoney(r.totalRev);
  document.getElementById('mv-cost').textContent  = fmtMoney(r.totalCost);
  document.getElementById('mv-net').textContent   = fmtMoney(r.netProfit);
  document.getElementById('mv-net').style.color   = r.netProfit >= 0 ? 'var(--green)' : 'var(--red)';

  const payback = findPayback();
  document.getElementById('mv-payback').textContent = typeof payback === 'number' ? 'Year ' + payback : payback + ' yrs';

  document.getElementById('breakdown-title').textContent = activeHorizon + '-Year Breakdown';
  document.getElementById('chart-horizon-label').textContent = activeHorizon + ' Years';

  // --- Profit row breakdown ---
  const neg = r.netProfit < 0;
  const netEl = document.getElementById('pr-net');
  netEl.textContent = fmtMoney(r.netProfit);
  netEl.style.color = neg ? 'var(--red)' : 'var(--green)';

  document.getElementById('pr-beef').textContent       = fmtMoney(r.beefMain);
  document.getElementById('pr-shade').textContent      = fmtMoney(r.shadeBonus);
  document.getElementById('pr-timber').textContent     = fmtMoney(r.timberRoyalty);
  document.getElementById('pr-carbon').textContent     = fmtMoney(r.carbonIncome);
  document.getElementById('pr-estab').textContent      = '−' + fmtMoney(r.totalEstabWithSeed);
  document.getElementById('pr-thin').textContent       = '−' + fmtMoney(r.thinTotal);
  document.getElementById('pr-overhead').textContent   = '−' + fmtMoney(r.overheadTotal);
  document.getElementById('pr-opp').textContent        = '−' + fmtMoney(r.oppCost);
  document.getElementById('pr-transport').textContent  = '−' + fmtMoney(r.timberTransport);
  document.getElementById('pr-cartage').textContent    = '−' + fmtMoney(r.cattleCartage);
  document.getElementById('pr-cattlemaint').textContent= '−' + fmtMoney(r.cattleMaintTotal);

  // --- Shade tab ---
  const shadeCover = r.ha * r.density * 4 / 10000; // m² → ha
  document.getElementById('sv-trees').textContent  = fmtN(r.ha * r.density);
  document.getElementById('sv-shade').textContent  = fmtN(shadeCover) + ' ha';
  document.getElementById('sv-cattle').textContent = fmtN(r.plantedCattle) + ' head';
  document.getElementById('sv-bonus').textContent  = fmtMoney(r.plantedCattle * 12) + '/yr';

  // --- Logistics tab ---
  const reg = REGIONS[r.regionKey] || REGIONS.rockhampton;
  document.getElementById('saleyard-name').textContent  = reg.saleyard + ' & ' + reg.abattoir;
  document.getElementById('saleyard-dist').textContent  = `Saleyard ~${reg.saleyardKm} km · Abattoir ~${reg.abattoirKm} km`;
  const roadBadge = document.getElementById('road-badge');
  roadBadge.textContent = 'Road risk: ' + reg.roadRisk;
  roadBadge.className = 'badge badge-' + (reg.roadRisk === 'low' ? 'green' : reg.roadRisk === 'medium' ? 'amber' : 'red');

  document.getElementById('lg-timber-transport').textContent = fmtMoney(r.timberTransport);
  document.getElementById('lg-cattle-cartage').textContent   = fmtMoney(r.cattleCartage);
  document.getElementById('lg-transport-total').textContent  = fmtMoney(r.timberTransport + r.cattleCartage);

  // --- Regulations tab ---
  renderRegs();

  // --- Charts ---
  updateHorizonChart();
  updateProfitChart(r);
}

// ---- Slider label updates -------------------------------------------
function updateSliderLabels() {
  const v = id => parseFloat(document.getElementById(id).value);
  const setLabel = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

  setLabel('rv-station-ha',   fmtN(v('station-ha'))  + ' ha');
  setLabel('rv-hectares',     fmtN(v('hectares'))     + ' ha');
  setLabel('rv-density',      fmtN(v('density'))      + ' trees/ha');
  setLabel('rv-beef-price',   '$' + (v('beef-price')/100).toFixed(2) + '/kg');
  setLabel('rv-carry',        v('carry')               + ' ha/head');
  setLabel('rv-cattle-cartage','$' + v('cattle-cartage') + '/hd');
  setLabel('rv-cattle-maint', '$' + v('cattle-maint') + '/hd/yr');
  setLabel('rv-carbon-price', '$' + v('carbon-price') + '/t');
  setLabel('rv-royalty',      '$' + v('royalty')      + '/m³');
  setLabel('rv-estab-cost',   '$' + fmtN(v('estab-cost')) + '/ha');
  setLabel('rv-thin-cost',    '$' + v('thin-cost')    + '/ha/yr');
  setLabel('rv-overhead-cost','$' + fmtK(v('overhead-cost')) + '/yr');
}

// ---- Regulations render ---------------------------------------------
function renderRegs() {
  const el = document.getElementById('reg-list');
  if (!el || el.dataset.rendered) return; // only render once — static content
  el.innerHTML = REGS.map(r => `
    <div class="reg-row">
      <span class="reg-icon">${r.icon}</span>
      <div>
        <p class="reg-title">${r.title} <span class="badge ${r.badge}">${r.badgeText}</span></p>
        <p class="reg-desc">${r.desc}</p>
      </div>
    </div>
  `).join('');
  el.dataset.rendered = '1';
}

// ---- Multi-horizon profit chart -------------------------------------
const HORIZONS = [5, 10, 15, 20, 25, 30, 40];

function updateHorizonChart() {
  const ctx = document.getElementById('horizonChart');
  if (!ctx) return;

  const revData  = HORIZONS.map(hz => { const r = calcProfit(hz); return r.totalRev   / 1000; });
  const costData = HORIZONS.map(hz => { const r = calcProfit(hz); return r.totalCost  / 1000; });
  const netData  = HORIZONS.map(hz => { const r = calcProfit(hz); return r.netProfit  / 1000; });
  const labels   = HORIZONS.map(h => h + 'yr');

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const textColor  = isDark ? '#a09e98' : '#6b6a65';

  if (horizonChart) {
    horizonChart.data.datasets[0].data = revData;
    horizonChart.data.datasets[1].data = costData;
    horizonChart.data.datasets[2].data = netData;
    horizonChart.update();
    return;
  }

  horizonChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue',
          data: revData,
          backgroundColor: 'rgba(15,110,86,0.65)',
          borderColor: 'rgba(15,110,86,1)',
          borderWidth: 1,
          borderRadius: 3,
          order: 2,
        },
        {
          label: 'Costs',
          data: costData,
          backgroundColor: 'rgba(216,90,48,0.55)',
          borderColor: 'rgba(216,90,48,0.9)',
          borderWidth: 1,
          borderRadius: 3,
          order: 2,
        },
        {
          label: 'Net Profit',
          data: netData,
          type: 'line',
          borderColor: '#185FA5',
          backgroundColor: 'rgba(24,95,165,0.12)',
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: netData.map(v => v >= 0 ? '#0F6E56' : '#D85A30'),
          tension: 0.35,
          fill: true,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 11 }, color: textColor, boxWidth: 12, padding: 12 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ctx.dataset.label + ': $' + fmtK(ctx.parsed.y * 1000),
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 } },
          title: { display: true, text: 'Time horizon', color: textColor, font: { size: 11 } },
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 11 },
            callback: v => '$' + fmtK(v * 1000),
          },
          title: { display: true, text: '$ (thousands)', color: textColor, font: { size: 11 } },
        },
      },
    },
  });
}

// ---- Single-horizon revenue breakdown chart --------------------------
function updateProfitChart(r) {
  const ctx = document.getElementById('profitChart');
  if (!ctx) return;

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const textColor = isDark ? '#a09e98' : '#6b6a65';

  const labels = ['Beef income', 'Shade bonus', 'Timber royalty', 'Carbon income'];
  const vals   = [r.beefMain, r.shadeBonus, r.timberRoyalty, r.carbonIncome];
  const colors = ['rgba(15,110,86,0.75)', 'rgba(24,95,165,0.65)', 'rgba(133,79,11,0.65)', 'rgba(216,90,48,0.65)'];

  if (profitChart) {
    profitChart.data.datasets[0].data = vals;
    profitChart.update();
    return;
  }

  profitChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: vals,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: c => '$' + fmtK(c.parsed.y) },
        },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 }, callback: v => '$' + fmtK(v) },
          title: { display: true, text: '$ total', color: textColor, font: { size: 11 } },
        },
      },
    },
  });
}

// ---- Horizon selector -----------------------------------------------
function setHorizon(hz) {
  activeHorizon = hz;
  document.querySelectorAll('.hz-btn').forEach(b => b.classList.remove('hz-btn-active'));
  const btn = document.getElementById('hz-' + hz);
  if (btn) btn.classList.add('hz-btn-active');
  update();
}

// ---- Interactive map region selector --------------------------------
function selectRegion(regionKey) {
  // Update hidden input
  const input = document.getElementById('region');
  input.value = regionKey;

  // Update active state on SVG paths
  document.querySelectorAll('.map-region').forEach(el => {
    el.classList.toggle('map-region-active', el.dataset.region === regionKey);
  });

  // Update selected label badge
  const reg = REGIONS[regionKey];
  const lbl = document.getElementById('region-selected-label');
  if (lbl && reg) lbl.textContent = reg.label;

  // Recalculate
  update();
  showSpeciesSuggestion();
}

// ---- Species suggestion box -----------------------------------------
function showSpeciesSuggestion() {
  const regionKey  = document.getElementById('region').value  || 'rockhampton';
  const speciesKey = document.getElementById('species').value || 'hoop_pine';
  const sug        = SPECIES_SUGGESTIONS[regionKey] || SPECIES_SUGGESTIONS.rockhampton;
  const sp         = SPECIES[speciesKey] || SPECIES.hoop_pine;
  const container  = document.getElementById('species-sug-body');
  if (!container) return;

  const isBestSoil   = speciesKey === sug.bestSoil;
  const isBestMarket = speciesKey === sug.bestMarket;

  const soilBadge   = isBestSoil   ? '<span class="badge badge-green" style="margin-left:6px">Best for soil</span>'   : '';
  const marketBadge = isBestMarket ? '<span class="badge badge-green" style="margin-left:6px">Best for market</span>' : '';

  let altHtml = '';
  if (sug.alternatives && sug.alternatives.length > 0) {
    const altNames = sug.alternatives.map(k => SPECIES[k]?.label || k).join(', ');
    altHtml = `<p class="sug-row"><i class="ti ti-arrows-exchange"></i><span><strong>Alternative:</strong> ${altNames} — ${sug.altNote}</span></p>`;
  }

  container.innerHTML = `
    <p class="sug-row"><i class="ti ti-map-pin"></i><span><strong>Region soil:</strong> ${REGIONS[regionKey]?.soilNote || '—'}</span></p>
    <p class="sug-row sug-highlight"><i class="ti ti-shovel"></i><span><strong>Best for soil</strong>${soilBadge}: <em>${SPECIES[sug.bestSoil]?.label}</em> — ${sug.soilReason}</span></p>
    <p class="sug-row sug-highlight"><i class="ti ti-currency-dollar"></i><span><strong>Best for market</strong>${marketBadge}: <em>${SPECIES[sug.bestMarket]?.label}</em> — ${sug.marketReason}</span></p>
    ${altHtml}
    <p class="sug-row" style="margin-top:6px"><i class="ti ti-certificate"></i><span><strong>Selected (${sp.label}):</strong> ${sp.export}</span></p>
  `;

  document.getElementById('species-suggestion').classList.add('sug-expanded');
}

// ---- Density suggestion box -----------------------------------------
function showDensitySuggestion() {
  const density   = parseFloat(document.getElementById('density').value) || 300;
  const container = document.getElementById('density-sug-body');
  if (!container) return;

  const band = DENSITY_BANDS.find(b => density <= b.max) || DENSITY_BANDS[DENSITY_BANDS.length - 1];

  container.innerHTML = `
    <p class="sug-row">
      <span style="font-size:18px;margin-right:6px">${band.icon}</span>
      <span>
        <strong style="color:${band.color}">${band.label}</strong> — ${band.text}
      </span>
    </p>
    <p class="sug-row" style="margin-top:6px;font-size:11px;color:var(--text3)">
      Source: MLA Silvopastoral Guidelines (2022); QLD LTCC Plantation Research (2021)
    </p>
  `;

  document.getElementById('density-suggestion').classList.add('sug-expanded');
}

// ---- Tab switcher ---------------------------------------------------
function showTab(tabId, btn) {
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.remove('active');
    p.style.display = '';   // clear any inline style so CSS controls display
  });
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById(tabId);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
}

// ---- Forum: load & post (wired to api.js) ---------------------------
// These are stub implementations that api.js's forum functions replace
// if a user is logged in. They render a "sign in required" notice
// for anonymous visitors.

async function loadForum() {
  const authNotice = document.getElementById('forum-auth-notice');
  const content    = document.getElementById('forum-content');

  if (!session || !session.token) {
    if (authNotice) authNotice.style.display = 'block';
    if (content)    content.style.display    = 'none';
    return;
  }

  if (authNotice) authNotice.style.display = 'none';
  if (content)    content.style.display    = 'block';

  const feed = document.getElementById('forum-feed');
  if (!feed) return;

  feed.innerHTML = `<div class="forum-loading"><i class="ti ti-loader-2" style="font-size:20px;animation:spin 1s linear infinite"></i><span>Loading posts…</span></div>`;

  try {
    const posts = await apiFetch('/forum/posts');
    renderFeed(posts || []);
  } catch {
    feed.innerHTML = `<p class="forum-empty">Could not load posts. Try again later.</p>`;
  }
}

function renderFeed(posts) {
  const feed = document.getElementById('forum-feed');
  if (!feed) return;

  if (!posts.length) {
    feed.innerHTML = `<p class="forum-empty">No posts yet — be the first to share!</p>`;
    return;
  }

  feed.innerHTML = posts.map(p => {
    const repliesHtml = (p.replies || []).map(r => `
      <div class="forum-reply">
        <div class="forum-meta">
          <span class="forum-author">${esc(r.author_name)}</span>
          <span class="forum-time">${timeAgo(r.created_at)}</span>
        </div>
        <p class="forum-body">${esc(r.body)}</p>
      </div>
    `).join('');

    return `
      <div class="forum-post" data-post-id="${p.id}">
        <div class="forum-meta">
          <span class="forum-author"><i class="ti ti-user-circle"></i> ${esc(p.author_name)}</span>
          <span class="forum-time">${timeAgo(p.created_at)}</span>
        </div>
        <p class="forum-body">${esc(p.body)}</p>
        ${repliesHtml}
        <div class="forum-reply-row">
          <input type="text" class="forum-reply-input" placeholder="Reply to ${esc(p.author_name)}…" data-post-id="${p.id}">
          <button class="auth-btn" style="padding:5px 12px;font-size:12px" onclick="submitReply(${p.id}, this)">
            <i class="ti ti-corner-down-right"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function submitPost() {
  const textarea = document.getElementById('forum-post-text');
  const body = textarea?.value?.trim();
  if (!body) return;
  if (!session?.token) return;

  const btn = document.getElementById('forum-post-btn');
  btn.disabled = true;

  try {
    await apiFetch('/forum/posts', {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    textarea.value = '';
    await loadForum();
  } catch (e) {
    alert('Failed to post: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

async function submitReply(postId, btn) {
  const row   = btn.closest('.forum-reply-row');
  const input = row?.querySelector('.forum-reply-input');
  const body  = input?.value?.trim();
  if (!body) return;
  if (!session?.token) return;

  btn.disabled = true;
  try {
    await apiFetch(`/forum/posts/${postId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    await loadForum();
  } catch (e) {
    alert('Failed to reply: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

// ---- Utility helpers ------------------------------------------------
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return mins + ' min ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  return days + 'd ago';
}

// ---- Init -----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Keyboard accessibility for map regions
  document.querySelectorAll('.map-region').forEach(el => {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectRegion(el.dataset.region);
      }
    });
  });

  update();
  showSpeciesSuggestion();
  showDensitySuggestion();
});
