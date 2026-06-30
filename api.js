/* ============================================================
   CQ Silvopastoral Dashboard — Backend Integration (Phase 2)
   Author: Jaber (CQUniversity)
   Version: 1.0

   Description:
   Connects the static Phase 1 dashboard (index.html, style.css,
   app.js) to the live FastAPI + PostgreSQL backend deployed on
   Render. This file is kept separate from app.js so the original
   calculation engine stays untouched -- this file only ADDS
   data-loading and persistence, it never changes how profit is
   calculated.

   Responsibilities:
   1. On page load, try fetching species/region reference data
      from the live API. If the API is unreachable (e.g. Render's
      free tier is asleep and slow to wake, or the user has no
      internet to Render specifically), fall back to the existing
      hardcoded SPECIES/REGIONS objects in app.js so the dashboard
      never breaks.
   2. A minimal login/register panel.
   3. Save current slider values as a named scenario; load a saved
      scenario back into the sliders.

   IMPORTANT: update API_BASE below to your actual Render URL.
   ============================================================ */

'use strict';

const API_BASE = 'https://cq-silvopastoral-api-zwsa.onrender.com';

// How long to wait for the API before giving up and using the
// hardcoded fallback data. Render's free tier can take 30-60s to
// wake from sleep, but we don't want the dashboard to hang that
// long on first load -- 5s is enough to catch an AWAKE API while
// failing fast if it's asleep or unreachable.
const API_TIMEOUT_MS = 5000;

// Holds the logged-in user's token and profile, kept in memory only
// (not localStorage) so a shared/lab computer doesn't leave a
// session logged in after the browser tab closes.
const session = {
  token: null,
  user: null,
};


// ---- Low-level fetch helper with timeout ------------------------

async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(API_BASE + path, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(session.token ? { Authorization: 'Bearer ' + session.token } : {}),
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.detail || `Request failed (${response.status})`);
    }
    return response.status === 204 ? null : response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}


// ---- Reference data: fetch from API, converting field names ------
// to the shape app.js's existing SPECIES/REGIONS objects expect, so
// update() in app.js needs zero changes regardless of where the
// data came from.

function mapApiSpecies(apiList) {
  const out = {};
  for (const s of apiList) {
    out[s.key] = {
      label:    s.label,
      seedP:    s.seed_price,
      m3ha:     s.m3_per_ha,
      mill:     s.mill_name,
      millKm:   s.mill_km,
      badge:    s.badge,
      nursery:  s.nursery,
      seedLead: s.seed_lead_time,
      export:   s.export_notes,
    };
  }
  return out;
}

function mapApiRegions(apiList) {
  const out = {};
  for (const r of apiList) {
    out[r.key] = {
      label:      r.label,
      saleyard:   r.saleyard,
      saleyardKm: r.saleyard_km,
      abattoir:   r.abattoir,
      abattoirKm: r.abattoir_km,
      roadNote:   r.road_note,
      roadRisk:   r.road_risk,
    };
  }
  return out;
}

/**
 * Attempts to load species/region reference data from the live API.
 * On ANY failure (timeout, network error, API down), silently keeps
 * the existing hardcoded SPECIES/REGIONS objects already defined in
 * app.js -- the dashboard is fully usable either way.
 *
 * Returns true if live data was loaded, false if the fallback was used.
 */
async function loadReferenceDataFromApi() {
  try {
    const [speciesList, regionsList] = await Promise.all([
      apiFetch('/reference/species'),
      apiFetch('/reference/regions'),
    ]);

    if (!speciesList?.length || !regionsList?.length) {
      throw new Error('API returned empty reference data');
    }

    // Overwrite the in-memory objects app.js already reads from.
    // Using Object.assign onto the existing const-bound objects
    // (rather than reassigning SPECIES/REGIONS themselves) because
    // they're declared with const in app.js -- mutating contents is
    // fine, reassigning the binding is not.
    Object.keys(SPECIES).forEach(k => delete SPECIES[k]);
    Object.assign(SPECIES, mapApiSpecies(speciesList));

    Object.keys(REGIONS).forEach(k => delete REGIONS[k]);
    Object.assign(REGIONS, mapApiRegions(regionsList));

    setConnectionStatus('online');
    return true;
  } catch (err) {
    console.warn('Could not load live reference data, using built-in defaults:', err.message);
    setConnectionStatus('offline');
    return false;
  }
}


// ---- Connection status indicator ---------------------------------

function setConnectionStatus(state) {
  const el = document.getElementById('api-status');
  if (!el) return;
  if (state === 'online') {
    el.textContent = 'Live data';
    el.className = 'api-status api-status-online';
    el.title = 'Connected to the live backend -- species and region data is current.';
  } else {
    el.textContent = 'Offline mode';
    el.className = 'api-status api-status-offline';
    el.title = 'Could not reach the backend -- showing built-in reference data instead.';
  }
}


// ---- Auth: register / login / logout ------------------------------

async function registerUser(email, fullName, password) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, full_name: fullName, password, role: 'owner' }),
  });
}

async function loginUser(email, password) {
  // /auth/login expects form-encoded data (OAuth2PasswordRequestForm
  // on the backend), not JSON -- this matches what FastAPI's
  // standard auth pattern expects.
  const body = new URLSearchParams();
  body.set('username', email);
  body.set('password', password);

  const res = await fetch(API_BASE + '/auth/login', { method: 'POST', body });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || 'Login failed');
  }
  const data = await res.json();
  session.token = data.access_token;
  session.user = await apiFetch('/auth/me');
  return session.user;
}

function logoutUser() {
  session.token = null;
  session.user = null;
}


// ---- Stations and scenarios ---------------------------------------

async function listMyStations() {
  return apiFetch('/stations');
}

async function createStation(name, region, totalHectares) {
  return apiFetch('/stations', {
    method: 'POST',
    body: JSON.stringify({ name, region, total_hectares: totalHectares }),
  });
}

async function listScenarios(stationId) {
  return apiFetch(`/stations/${stationId}/scenarios`);
}

/**
 * Reads every current slider/dropdown value from the DOM and saves
 * it as a named scenario under the given station.
 */
async function saveCurrentScenario(stationId, scenarioName) {
  const payload = {
    name: scenarioName,
    planted_hectares: parseFloat(document.getElementById('hectares').value),
    species: document.getElementById('species').value,
    density: parseInt(document.getElementById('density').value),
    beef_price: parseFloat(document.getElementById('beef-price').value),
    carry_capacity: parseFloat(document.getElementById('carry').value),
    cattle_cartage_rate: parseFloat(document.getElementById('cattle-cartage').value),
    carbon_price: parseFloat(document.getElementById('carbon-price').value),
    royalty_price: parseFloat(document.getElementById('royalty').value),
  };
  return apiFetch(`/stations/${stationId}/scenarios`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Takes a scenario object (as returned by the API) and pushes its
 * values back into the dashboard's sliders/dropdowns, then calls
 * the existing update() function from app.js to recalculate
 * everything on screen.
 *
 * Also accepts the scenario's PARENT STATION, since region and
 * total station size live on the station record, not the scenario
 * record (a station's location/size doesn't change between
 * what-if scenarios -- only the planting plan does). Without this,
 * loading a scenario would leave the region/station-size sliders
 * showing whatever they happened to be set to before loading,
 * which could be inconsistent with the station the scenario
 * actually belongs to.
 */
function applyScenarioToForm(scenario, station) {
  if (station) {
    document.getElementById('region').value     = station.region;
    document.getElementById('station-ha').value = station.total_hectares;
  }
  document.getElementById('hectares').value      = scenario.planted_hectares;
  document.getElementById('species').value        = scenario.species;
  document.getElementById('density').value         = scenario.density;
  document.getElementById('beef-price').value      = scenario.beef_price;
  document.getElementById('carry').value           = scenario.carry_capacity;
  document.getElementById('cattle-cartage').value  = scenario.cattle_cartage_rate;
  document.getElementById('carbon-price').value    = scenario.carbon_price;
  document.getElementById('royalty').value         = scenario.royalty_price;
  update(); // existing recalculation function defined in app.js
}


// ---- Wiring up the login/save UI (added in index.html) -------------

function initAuthPanel() {
  const panel = document.getElementById('auth-panel');
  if (!panel) return; // index.html not yet updated with the panel markup

  const loggedOutView  = document.getElementById('auth-logged-out');
  const loggedInView   = document.getElementById('auth-logged-in');
  const authError      = document.getElementById('auth-error');
  const userLabel      = document.getElementById('auth-user-label');
  const stationSelect  = document.getElementById('auth-station-select');
  const scenarioSelect = document.getElementById('auth-scenario-select');

  let myStations = [];
  let myScenarios = [];

  function showError(msg) {
    authError.textContent = msg;
    authError.style.display = msg ? 'block' : 'none';
  }

  async function refreshStations() {
    myStations = await listMyStations();
    stationSelect.innerHTML = myStations.length
      ? myStations.map(s => `<option value="${s.id}">${s.name} (${s.region})</option>`).join('')
      : '<option value="">No stations yet -- create one below</option>';
  }

  async function refreshScenarios() {
    const stationId = stationSelect.value;
    if (!stationId) { scenarioSelect.innerHTML = '<option value="">--</option>'; return; }
    myScenarios = await listScenarios(stationId);
    scenarioSelect.innerHTML = myScenarios.length
      ? myScenarios.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
      : '<option value="">No saved scenarios yet</option>';
  }

  document.getElementById('auth-login-btn').addEventListener('click', async () => {
    showError('');
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    try {
      const user = await loginUser(email, password);
      userLabel.textContent = user.full_name + ' (' + user.email + ')';
      loggedOutView.style.display = 'none';
      loggedInView.style.display = 'block';
      await refreshStations();
    } catch (err) {
      showError(err.message);
    }
  });

  document.getElementById('auth-register-btn').addEventListener('click', async () => {
    showError('');
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const fullName = email.split('@')[0]; // simple default; user can be prompted for a real name later
    try {
      await registerUser(email, fullName, password);
      await loginUser(email, password);
      userLabel.textContent = fullName + ' (' + email + ')';
      loggedOutView.style.display = 'none';
      loggedInView.style.display = 'block';
      await refreshStations();
    } catch (err) {
      showError(err.message);
    }
  });

  document.getElementById('auth-logout-btn').addEventListener('click', () => {
    logoutUser();
    loggedInView.style.display = 'none';
    loggedOutView.style.display = 'block';
  });

  document.getElementById('auth-new-station-btn').addEventListener('click', async () => {
    const region = document.getElementById('region').value; // reuse the dashboard's own region selector
    const totalHa = parseFloat(document.getElementById('station-ha').value);
    const regionLabel = REGIONS[region]?.label || region;
    const name = prompt(
      `Station name?\n\n(Will use your current Inputs tab settings: ${regionLabel}, ${totalHa.toLocaleString()} ha total -- change those sliders first if needed.)`
    );
    if (!name) return;
    try {
      await createStation(name, region, totalHa);
      await refreshStations();
    } catch (err) {
      showError(err.message);
    }
  });

  stationSelect.addEventListener('change', refreshScenarios);

  document.getElementById('auth-save-scenario-btn').addEventListener('click', async () => {
    const stationId = stationSelect.value;
    if (!stationId) { showError('Create or select a station first.'); return; }
    const name = prompt('Name this scenario:', 'Scenario ' + new Date().toLocaleDateString());
    if (!name) return;
    try {
      await saveCurrentScenario(stationId, name);
      await refreshScenarios();
    } catch (err) {
      showError(err.message);
    }
  });

  document.getElementById('auth-load-scenario-btn').addEventListener('click', () => {
    const scenarioId = scenarioSelect.value;
    const scenario = myScenarios.find(s => String(s.id) === scenarioId);
    const station = myStations.find(s => String(s.id) === String(stationSelect.value));
    if (scenario) applyScenarioToForm(scenario, station);
  });
}


// ---- Startup --------------------------------------------------------
// Runs alongside app.js's own DOMContentLoaded handler (which calls
// update() once with the default/fallback data). This handler then
// tries to replace that fallback data with live API data, and
// re-runs update() again if it succeeds so the screen reflects
// whichever data source actually won.

document.addEventListener('DOMContentLoaded', async () => {
  initAuthPanel();
  const gotLiveData = await loadReferenceDataFromApi();
  if (gotLiveData) update(); // re-run with live data now in SPECIES/REGIONS
});
