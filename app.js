/* ============================================================
   CQ Silvopastoral Dashboard — Application Logic
   Author: Jaber (CQUniversity)
   Version: 1.1 (Phase 1 — Static Prototype, beef logistics parity update)

   Description:
   Core calculation engine for the CQ Silvopastoral Decision
   Support Tool. Computes integrated profitability across beef
   cattle, timber royalties, carbon credits (ACCUs), shade
   productivity bonuses, and logistics costs over a 25-year
   rotation.

   v1.1 change: added a beef logistics model (nearest saleyard /
   abattoir lookup by region, cattle cartage cost using a
   $/head/100km livestock-crate rate) so that beef logistics is
   modelled with the same depth as the existing timber logistics
   (sawmill distance, $/km/load transport cost). Cattle cartage
   uses fundamentally different unit economics to log truck
   freight, so it is modelled as a separate calculation rather
   than reusing the timber transport formula.

   Data sources:
   - Timber yield: ABARES silvicultural guidelines (QLD)
   - Beef productivity: MLA benchmarks for central QLD
   - ACCU methodology: Clean Energy Regulator (HIR method)
   - Transport (timber): Road freight industry averages ($/km/B-double)
   - Transport (beef): Livestock transport industry averages ($/head/100km)
   - Seedling prices: QLD nursery industry estimates
   ============================================================ */

'use strict';

// ---- Species data -----------------------------------------------
// Each species object stores all parameters needed for calculation.
// Future versions will load this from a backend API (FastAPI/PostgreSQL).

const SPECIES = {
  hoop_pine: {
    label:      'Hoop Pine',
    seedP:      1.80,          // $ per seedling (nursery price)
    m3ha:       280,           // m3 timber per hectare at 25yr harvest
    mill:       'Hyne Timber -- Maryborough',
    millKm:     380,           // km from Rockhampton to sawmill
    badge:      'Softwood',
    nursery:    'Callide Nursery, Biloela',
    seedLead:   '8-12 months',
    export:     'Hoop pine is in strong demand for structural and furniture export to South-East Asia, particularly Vietnam and China. Gladstone Port handles bulk timber exports. Contact Timber Queensland for broker referrals.',
  },
  spotted_gum: {
    label:      'Spotted Gum',
    seedP:      2.20,
    m3ha:       200,
    mill:       'Masterton Timber -- Gympie',
    millKm:     470,
    badge:      'Hardwood',
    nursery:    'GreenLife Nursery, Rockhampton',
    seedLead:   '6-10 months',
    export:     'Spotted gum commands premium prices for flooring, decking and heavy construction. Strong domestic demand in SE QLD and NSW. Export potential to Japan and Korea via Gladstone.',
  },
  ironbark: {
    label:      'Grey Ironbark',
    seedP:      2.10,
    m3ha:       180,
    mill:       'Mackay Timbers -- Mackay',
    millKm:     330,
    badge:      'Hardwood',
    nursery:    'Tropic Co. Nursery, Yeppoon',
    seedLead:   '6-9 months',
    export:     'Ironbark is Australia\'s premier hardwood for sleepers, power poles and marine construction. High domestic demand. Export to India and the Middle East via Gladstone or Brisbane.',
  },
  white_mahogany: {
    label:      'White Mahogany',
    seedP:      2.40,
    m3ha:       210,
    mill:       'Martens Sawmill -- Rockhampton',
    millKm:     45,
    badge:      'Hardwood',
    nursery:    'GreenLife Nursery, Rockhampton',
    seedLead:   '6-8 months',
    export:     'White mahogany is locally milled in Rockhampton -- minimal transport cost. Strong demand for high-end furniture and joinery. Boutique export to Japan for premium applications.',
  },
};

// ---- Region data (beef logistics) -------------------------------
// Mirrors the SPECIES lookup structure, but keyed by station region
// rather than tree species, since saleyard/abattoir access depends
// on WHERE the station is, not what timber species is planted.
// Distances are indicative road distances from the regional centre.

const REGIONS = {
  rockhampton: {
    label:       'Rockhampton / Fitzroy',
    saleyard:    'CQLX Gracemere Saleyard',
    saleyardKm:  12,
    abattoir:    'JBS Australia -- Rockhampton',
    abattoirKm:  18,
    roadNote:    'Sealed Bruce Highway access -- reliable year-round (Beef Road network)',
    roadRisk:    'Low',
  },
  emerald: {
    label:       'Emerald / Central Highlands',
    saleyard:    'Gracemere (via Capricorn Hwy)',
    saleyardKm:  270,
    abattoir:    'JBS Australia -- Rockhampton',
    abattoirKm:  280,
    roadNote:    'Sealed Capricorn Highway -- some local roads unsealed and wet-season affected',
    roadRisk:    'Moderate',
  },
  mackay: {
    label:       'Mackay / Pioneer Valley',
    saleyard:    'Mackay Saleyards, Nebo Road',
    saleyardKm:  35,
    abattoir:    'Borthwicks Mackay (processing via Rockhampton)',
    abattoirKm:  330,
    roadNote:    'Sealed Bruce Highway -- minor wet-season disruption risk',
    roadRisk:    'Low',
  },
  longreach: {
    label:       'Longreach / Central West',
    saleyard:    'Blackall Saleyards',
    saleyardKm:  210,
    abattoir:    'JBS Australia -- Rockhampton',
    abattoirKm:  690,
    roadNote:    'Sealed Landsborough/Capricorn Hwy -- long haul, gravel station access roads common',
    roadRisk:    'High',
  },
};


// ---- Regulatory data -------------------------------------------
// These checks are populated into the Regulations tab.
// Future phase: dynamically filtered based on land category (PMAV API).

const REGS = [
  {
    icon:  'ti-circle-check',
    color: '#0F6E56',
    title: 'Plantation exemption',
    desc:  'Planting into existing cleared paddock land is generally exempt from the Vegetation Management Act if the land is mapped as "Category X". Verify your PMAV with DAF before proceeding.',
  },
  {
    icon:  'ti-alert-triangle',
    color: '#854F0B',
    title: 'Harvest approval required',
    desc:  'Even if planting is exempt, harvesting regrowth vegetation may require a Material Change of Use permit or exemption certificate. Plan your exit strategy before planting.',
  },
  {
    icon:  'ti-leaf',
    color: '#0F6E56',
    title: 'Carbon method registration',
    desc:  'To claim ACCUs, register under the Human Induced Regeneration method with the Clean Energy Regulator BEFORE planting. Cannot be backdated.',
  },
  {
    icon:  'ti-alert-triangle',
    color: '#854F0B',
    title: 'Species lock-in risk',
    desc:  'Exotic species (e.g. certain pines) on cleared land can trigger ongoing obligations restricting future land use. Native species (spotted gum, ironbark, white mahogany) carry lower lock-in risk.',
  },
  {
    icon:  'ti-x',
    color: '#D85A30',
    title: 'Waterway setbacks',
    desc:  'A 50-100m no-clearing setback applies to all watercourses under the Water Act and VMA. Do not plant within this buffer -- it reduces your effective plantable area.',
  },
  {
    icon:  'ti-info-circle',
    color: '#185FA5',
    title: 'Biosecurity obligations',
    desc:  'Planting large areas of a single species may attract biosecurity obligations under the Biosecurity Act 2014. Check with Biosecurity Queensland for your chosen species.',
  },
];

// ---- Utility formatters ----------------------------------------

/**
 * Format a number as AUD shorthand (e.g. $1.2M, $340k, $850)
 * @param {number} n
 * @returns {string}
 */
function fmtK(n) {
  const r = Math.round(n);
  if (Math.abs(r) >= 1_000_000) return '$' + (r / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(r) >= 1_000)     return '$' + (r / 1_000).toFixed(0) + 'k';
  return '$' + r;
}

/**
 * Format a number with locale separators (e.g. 60,000)
 * @param {number} n
 * @returns {string}
 */
function fmtN(n) {
  return Math.round(n).toLocaleString('en-AU');
}

// ---- Chart instance --------------------------------------------
let chart = null;

// ---- Tab switching ---------------------------------------------

/**
 * Show a tab panel and mark its button as active.
 * @param {string} tabId - ID suffix (e.g. 'inputs', 'profit')
 * @param {HTMLElement} btn - The clicked tab button
 */
function showTab(tabId, btn) {
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
  btn.classList.add('active');
}

// ---- Main calculation engine -----------------------------------

/**
 * Read all slider/select values, run the profitability model,
 * and push results to every display element on the page.
 *
 * Called on every input event (real-time reactivity).
 */
function update() {

  // -- Read inputs
  const ha       = parseInt(document.getElementById('hectares').value);
  const stnHa    = parseInt(document.getElementById('station-ha').value);
  const beefP    = parseInt(document.getElementById('beef-price').value);
  const carryHa  = parseInt(document.getElementById('carry').value);
  const cartageRate = parseInt(document.getElementById('cattle-cartage').value); // $/head/100km
  const carbonP  = parseInt(document.getElementById('carbon-price').value);
  const royaltyP = parseInt(document.getElementById('royalty').value);
  const dens     = parseInt(document.getElementById('density').value);
  const sp       = SPECIES[document.getElementById('species').value];
  const rg       = REGIONS[document.getElementById('region').value];

  // -- Update raw display values
  document.getElementById('ha-out').textContent      = ha.toLocaleString();
  document.getElementById('stn-out').textContent     = stnHa.toLocaleString();
  document.getElementById('beef-out').textContent    = beefP;
  document.getElementById('carry-out').textContent   = carryHa;
  document.getElementById('cartage-out').textContent = cartageRate;
  document.getElementById('carbon-out').textContent  = carbonP;
  document.getElementById('royalty-out').textContent = royaltyP;
  document.getElementById('dens-out').textContent    = dens;

  // -- Station summary
  const pct = Math.round(ha / stnHa * 100);
  document.getElementById('pct-land').textContent = pct + '%';

  // -- Seedlings and establishment costs
  const seedCount  = ha * dens;
  const seedCost   = seedCount * sp.seedP;
  const plantCost  = ha * 400;   // $400/ha labour + machinery
  const fenceCost  = ha * 150;   // $150/ha internal fencing
  const totalEstab = seedCost + plantCost + fenceCost;

  document.getElementById('seedlings-needed').textContent = fmtN(seedCount);
  document.getElementById('seedling-cost-sub').textContent = 'est. ' + fmtK(seedCost);

  // -- Cattle numbers
  const remHa      = stnHa - ha;
  const cattleMain = Math.floor(remHa / carryHa);
  document.getElementById('cattle-count').textContent = fmtN(cattleMain);

  // -- Beef logistics model (cattle cartage to saleyard, parity with timber logistics)
  // Cattle road transport is priced per head per 100km (livestock crate rate),
  // NOT per m3 like log trucks -- a different unit economics model entirely.
  const annualTurnoffRate = 0.20;                                  // 20% of herd sold per year (typical CQ store/finisher turnoff)
  const cattleTurnedOff   = Math.round(cattleMain * annualTurnoffRate);
  const cartagePerHead    = (rg.saleyardKm / 100) * cartageRate;    // $ per head for this trip distance
  const cartageAnnual     = cattleTurnedOff * cartagePerHead;
  const cartageTotal25yr  = cartageAnnual * 25;

  document.getElementById('turnoff-count').textContent = fmtN(cattleTurnedOff);

  // -- Shade effect model
  // Assumes ~15% of cattle on planted ha equivalent graze near tree rows
  const shCattle   = Math.max(Math.floor(ha / carryHa * 0.15), 10);
  const shadeBonus = shCattle * beefP * 0.10 * 25;   // +10% value, 25 years
  document.getElementById('shade-cattle').textContent = fmtN(shCattle);
  document.getElementById('s-cattle').textContent     = fmtN(shCattle);
  document.getElementById('s-bonus').textContent      = fmtK(shadeBonus);
  document.getElementById('s-perha').textContent      = fmtK(shadeBonus / ha);

  // -- Income streams
  const beefMain      = cattleMain * beefP * 25;               // beef from remaining land
  const oppCost       = (ha / carryHa) * beefP * 25;          // foregone beef on planted ha
  const m3Total       = ha * sp.m3ha;                          // total timber volume
  const timberRoyalty = m3Total * royaltyP;                    // royalty at harvest
  const carbonIncome  = ha * 12 * 25 * carbonP;               // 12 tCO2/ha/yr ACCU estimate
  const loads         = Math.ceil(m3Total / 60);               // 60 m3 per B-double load
  const transportTotal = loads * sp.millKm * 3.5;             // $3.50/km/load

  // -- Totals
  const totalRev   = beefMain + shadeBonus + timberRoyalty + carbonIncome;
  const totalCost  = totalEstab + oppCost + transportTotal + cartageTotal25yr;
  const netProfit  = totalRev - totalCost;
  const roi        = totalEstab > 0 ? Math.round(netProfit / totalEstab * 100) : 0;

  // -- Profit tab outputs
  document.getElementById('p-total-rev').textContent = fmtK(totalRev);
  document.getElementById('p-total-cost').textContent = fmtK(totalCost);
  const pn = document.getElementById('p-net');
  pn.textContent = fmtK(netProfit);
  pn.style.color = netProfit >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('p-roi').textContent = roi + '%';

  document.getElementById('b-beef').textContent      = fmtK(beefMain);
  document.getElementById('b-shade').textContent     = fmtK(shadeBonus);
  document.getElementById('b-timber').textContent    = fmtK(timberRoyalty);
  document.getElementById('b-carbon').textContent    = fmtK(carbonIncome);
  document.getElementById('b-estab').textContent     = '-' + fmtK(totalEstab);
  document.getElementById('b-oppcost').textContent   = '-' + fmtK(oppCost);
  document.getElementById('b-transport').textContent = '-' + fmtK(transportTotal);
  document.getElementById('b-cartage').textContent   = '-' + fmtK(cartageTotal25yr);
  const bn = document.getElementById('b-net');
  bn.textContent = fmtK(netProfit);
  bn.style.color = netProfit >= 0 ? 'var(--green)' : 'var(--red)';

  // -- Chart
  const chartLabels = ['Beef income', 'Shade bonus', 'Timber', 'Carbon', 'Establishment', 'Opp. cost', 'Transport', 'Cartage'];
  const chartVals   = [beefMain, shadeBonus, timberRoyalty, carbonIncome, totalEstab, oppCost, transportTotal, cartageTotal25yr]
                        .map(v => Math.round(v / 1000));
  const chartColors = ['#1D9E75','#5DCAA5','#3266ad','#639922','#D85A30','#E8A87C','#BF6A3A','#9C5FBF'];

  if (chart) {
    chart.data.datasets[0].data = chartVals;
    chart.update();
  } else {
    chart = new Chart(document.getElementById('profitChart'), {
      type: 'bar',
      data: {
        labels: chartLabels,
        datasets: [{
          label: 'AUD (thousands)',
          data: chartVals,
          backgroundColor: chartColors,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' $' + ctx.parsed.y.toLocaleString() + 'k' } },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: v => '$' + v + 'k', font: { size: 11 }, color: '#888780' },
            grid: { color: 'rgba(136,135,128,.15)' },
          },
          x: { ticks: { font: { size: 11 }, color: '#888780' }, grid: { display: false } },
        },
      },
    });
  }

  // -- Shade & water tab: density assessment
  let densLabel, densAdvice, densColor, pastureRed, alleyW;
  if (dens < 200) {
    densLabel = 'Sparse'; densAdvice = 'Consider increasing for better yield';
    densColor = 'var(--amber)'; pastureRed = 5; alleyW = '>15 m';
  } else if (dens <= 350) {
    densLabel = 'Optimal'; densAdvice = 'Good alley spacing for CQ';
    densColor = 'var(--green)'; pastureRed = 12; alleyW = '10-15 m';
  } else if (dens <= 450) {
    densLabel = 'Dense'; densAdvice = 'Monitor water competition';
    densColor = 'var(--amber)'; pastureRed = 22; alleyW = '5-10 m';
  } else {
    densLabel = 'Too dense'; densAdvice = 'High competition risk';
    densColor = 'var(--red)'; pastureRed = 35; alleyW = '<5 m';
  }
  const dsEl = document.getElementById('dens-status');
  dsEl.textContent = densLabel;
  dsEl.style.color = densColor;
  document.getElementById('dens-advice').textContent  = densAdvice;
  document.getElementById('pasture-red').textContent  = pastureRed + '%';
  document.getElementById('alley-width').textContent  = alleyW;

  // Visual tree density indicator
  const treeCount = Math.min(Math.round(dens / 30), 20);
  document.getElementById('dens-vis').innerHTML =
    Array.from({ length: treeCount }, () => '<span style="font-size:18px">&#x1F332;</span>').join('');

  // -- Logistics tab: beef (saleyard/abattoir) -- parity section with timber logistics below
  document.getElementById('saleyard-name').textContent = rg.saleyard;
  document.getElementById('saleyard-dist').textContent = '~' + rg.saleyardKm + ' km from ' + rg.label.split(' / ')[0];
  document.getElementById('abattoir-name').textContent = rg.abattoir;
  document.getElementById('abattoir-dist').textContent = '~' + rg.abattoirKm + ' km from ' + rg.label.split(' / ')[0];

  const riskBadge = document.getElementById('road-risk-badge');
  riskBadge.textContent = rg.roadRisk + ' road risk';
  riskBadge.className = 'badge ' + (rg.roadRisk === 'Low' ? 'badge-green' : rg.roadRisk === 'Moderate' ? 'badge-amber' : 'badge-red');

  document.getElementById('bl-rate').textContent       = '$' + cartageRate + '/100km';
  document.getElementById('bl-perhead').textContent     = fmtK(cartagePerHead);
  document.getElementById('bl-perhead-sub').textContent = 'over ' + rg.saleyardKm + ' km to ' + rg.saleyard.split(',')[0].split(' --')[0];
  document.getElementById('bl-annual').textContent      = fmtK(cartageAnnual);
  document.getElementById('bl-annual-sub').textContent  = 'for ' + fmtN(cattleTurnedOff) + ' head/yr turned off';
  document.getElementById('bl-total').textContent       = fmtK(cartageTotal25yr);
  document.getElementById('bl-road-note').innerHTML     = '<strong>Road access:</strong> ' + rg.roadNote + '.';

  // -- Logistics tab: timber (sawmill) -- existing model, unchanged
  document.getElementById('mill-name').textContent       = sp.mill;
  document.getElementById('mill-dist').textContent       = '~' + sp.millKm + ' km from Rockhampton';
  document.getElementById('mill-badge').textContent      = sp.badge;
  document.getElementById('l-transport').textContent     = fmtK(sp.millKm * 3.5);
  document.getElementById('l-transport-sub').textContent = 'per load (' + sp.millKm + 'km x $3.50/km)';
  document.getElementById('l-loads').textContent         = fmtN(loads);
  document.getElementById('l-total-transport').textContent = fmtK(transportTotal);
  document.getElementById('l-port-dist').textContent     = '~' + Math.round(sp.millKm * 0.6 + 90) + ' km from station';
  document.getElementById('l-nursery').textContent       = sp.nursery;
  document.getElementById('l-seed-price').textContent    = '$' + sp.seedP.toFixed(2) + '/seedling';
  document.getElementById('l-seed-count').textContent    = fmtN(seedCount) + ' seedlings';
  document.getElementById('l-seed-total').textContent    = fmtK(seedCost);
  document.getElementById('l-lead').textContent          = sp.seedLead;
  document.getElementById('l-export').textContent        = sp.export;

  // -- Regulations tab (static, populated once then updated on species change)
  document.getElementById('reg-list').innerHTML = REGS.map(r => `
    <div class="reg-row">
      <i class="ti ${r.icon} reg-icon" style="color:${r.color}" aria-hidden="true"></i>
      <div>
        <p class="reg-title">${r.title}</p>
        <p class="reg-desc">${r.desc}</p>
      </div>
    </div>
  `).join('');
}

// ---- Initialise on page load -----------------------------------
document.addEventListener('DOMContentLoaded', update);
