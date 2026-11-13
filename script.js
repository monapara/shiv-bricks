// script.js — Shiv Bricks V3
// Speed model: the screen is painted instantly from a local snapshot (localStorage),
// exactly like the old V1. Firebase is loaded AFTER that paint and only syncs /
// backs up in the background. If local data is ever lost, Firebase restores it.

// ===== Firebase config =====
const firebaseConfig = {
  apiKey: "AIzaSyAMFN8EP-vDNftsFtbS8C9MnABxKVyY6vY",
  authDomain: "shiv-bricks-fe97c.firebaseapp.com",
  projectId: "shiv-bricks-fe97c",
  storageBucket: "shiv-bricks-fe97c.firebasestorage.app",
  messagingSenderId: "761334426715",
  appId: "1:761334426715:web:d521be0aeec936c9dd237e"
};
// Assigned in initFirebase() once the SDK has loaded
let auth = null;
let db = null;
let provider = null;
let persistenceReady = Promise.resolve();

// ===== State =====
let currentUser = null;
let activeTab = "";
let tabs = [];            // ordered list of tab names (from the profile doc)
let currentEntries = [];  // entries for the active tab: [{ id, date, place, ... }]
let entriesUnsub = null;  // onSnapshot unsubscribe for the active tab
let editId = null;        // doc id being edited, or null when adding
let firmName = 'Shiv Bricks'; // this account's firm name (header title + PDF title)
let hasMigrated = false;  // whether this account already imported old localStorage data

// ===== Local snapshot (the fast path) =====
// { uid, firmName, tabs, activeTab, migrated, entries: { [tabName]: [entry, ...] } }
const CACHE_KEY = 'sb_cache_v1';
let appCache = null;
function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (c && c.uid && Array.isArray(c.tabs)) return c;
  } catch (_) {}
  return null;
}
function saveCache() {
  if (!appCache) return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(appCache)); } catch (_) {}
}
function clearCache() {
  appCache = null;
  try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
}
function ensureCache() {
  if (!currentUser) return false;
  if (!appCache || appCache.uid !== currentUser.uid) appCache = { uid: currentUser.uid, entries: {} };
  if (!appCache.entries) appCache.entries = {};
  return true;
}
function updateCache() {
  if (!ensureCache()) return;
  appCache.firmName = firmName;
  appCache.tabs = tabs;
  appCache.activeTab = activeTab;
  appCache.migrated = hasMigrated;
  saveCache();
}

// ===== DOM elements =====
const form = document.getElementById('entryForm');
const dateInput = document.getElementById('deliveryDate');
const placeInput = document.getElementById('place');
const partyInput = document.getElementById('party');
const areaInput = document.getElementById('area');
const purchaseInput = document.getElementById('purchase');
const transporterInput = document.getElementById('transporter');
const quantityInput = document.getElementById('quantity');
const submitbutton = document.getElementById('submitbutton');
const addTabButton = document.getElementById('addTabButton');
const tableBody = document.getElementById('entryTableBody');
const monthFilter = document.getElementById('monthFilter');
// filter inputs (referenced by filter.js)
const filterstartDate = document.getElementById('startDate');
const filterendDate = document.getElementById('endDate');
const filterPlace = document.getElementById('filterPlace');
const filterParty = document.getElementById('filterParty');
const filterArea = document.getElementById('filterArea');
const filterTransporter = document.getElementById('filterTransporter');
const filterPurchase = document.getElementById('filterPurchase');
const filterQuantity = document.getElementById('filterQuantity');
// auth UI
const signInScreen = document.getElementById('signInScreen');
const appRoot = document.getElementById('appRoot');
const loadingEl = document.getElementById('loading');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const signOutBtn = document.getElementById('signOutBtn');

// ===== Firestore references (per signed-in user) =====
function userDocRef() { return db.collection('users').doc(currentUser.uid); }
function entriesRef() { return userDocRef().collection('entries'); }

// ===== Startup =====
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}
async function loadFirebase() {
  const base = 'https://www.gstatic.com/firebasejs/12.14.0/';
  await loadScript(base + 'firebase-app-compat.js');
  await Promise.all([
    loadScript(base + 'firebase-auth-compat.js'),
    loadScript(base + 'firebase-firestore-compat.js')
  ]);
}

function boot() {
  // 1) Paint immediately from the local snapshot -- no network, no Firebase.
  appCache = readCache();
  if (appCache) {
    firmName = appCache.firmName || firmName;
    tabs = appCache.tabs.slice();
    hasMigrated = appCache.migrated === true;
    activeTab = tabs.includes(appCache.activeTab) ? appCache.activeTab : (tabs[tabs.length - 1] || '');
    currentEntries = (appCache.entries && appCache.entries[activeTab]) || [];
    if (loadingEl) loadingEl.style.display = 'none';
    signInScreen.style.display = 'none';
    appRoot.style.display = '';
    applyFirmName();
    renderTabs();
    renderTable();
  }
  // 2) Then bring Firebase up in the background.
  loadFirebase().then(initFirebase).catch((err) => {
    console.error(err);
    if (!appCache && loadingEl) {
      loadingEl.style.display = '';
      loadingEl.textContent = 'Could not load. Check your connection and reload.';
    }
  });
}
document.addEventListener('DOMContentLoaded', boot);

function initFirebase() {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  provider = new firebase.auth.GoogleAuthProvider();
  // Offline cache so the app keeps working with no connection
  persistenceReady = db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    console.warn('Offline persistence not enabled:', err && err.code);
  });

  auth.onAuthStateChanged(async (user) => {
    currentUser = user || null;
    if (loadingEl) loadingEl.style.display = 'none';
    if (user) {
      // A different account than the one in the local snapshot -> drop the snapshot.
      if (appCache && appCache.uid !== user.uid) {
        clearCache();
        tabs = []; activeTab = ''; currentEntries = [];
        firmName = 'Shiv Bricks'; hasMigrated = false;
        applyFirmName(); renderTabs(); renderTable();
      }
      signInScreen.style.display = 'none';
      appRoot.style.display = '';
      await loadProfile();
      await migrateLocalData();   // one-time: pull old localStorage data into the cloud
      if (tabs.length > 0 && !tabs.includes(activeTab)) activeTab = tabs[tabs.length - 1];
      renderTabs();
      subscribeEntries();
      if (tabs.length === 0) addNewTab(); // prompt to create the first tab
    } else {
      if (entriesUnsub) { entriesUnsub(); entriesUnsub = null; }
      clearCache(); // don't leave one account's data on a signed-out device
      tabs = []; activeTab = ''; currentEntries = [];
      appRoot.style.display = 'none';
      signInScreen.style.display = '';
      firmName = 'Shiv Bricks';
      applyFirmName();
    }
  });
}

// ===== Auth buttons =====
googleSignInBtn.addEventListener('click', async () => {
  if (!auth) return;
  try { await auth.signInWithPopup(provider); }
  catch (e) { alert('Sign-in failed: ' + (e.code || e.message)); }
});
signOutBtn.addEventListener('click', async () => {
  if (!auth) return;
  try { await auth.signOut(); }
  catch (e) { console.error(e); }
});

// ===== Profile, firm name & tabs =====
async function loadProfile() {
  await persistenceReady;
  // Fast path: we already painted from the local snapshot, so just refresh the
  // profile from Firebase in the background and carry on.
  if (appCache && appCache.uid === currentUser.uid && appCache.firmName) {
    refreshProfile();
    return;
  }
  // Slow path (first sign-in on this device): try Firestore's own cache, then the server.
  let snap = null;
  try {
    const cached = await userDocRef().get({ source: 'cache' });
    if (cached.exists && cached.data() && cached.data().firmName) snap = cached;
  } catch (_) { /* nothing cached on this device yet */ }
  if (!snap) snap = await userDocRef().get();
  const data = snap.exists ? (snap.data() || {}) : {};
  hasMigrated = data.migrated === true;
  tabs = Array.isArray(data.tabs) ? data.tabs.slice() : [];
  tabs.sort((a, b) => a.localeCompare(b));
  if (data.firmName) {
    firmName = data.firmName;
  } else {
    // Ask once for the firm / company name, then save it on this account.
    let name = prompt("Enter your firm / company name:");
    if (name) name = name.trim();
    firmName = name || 'Shiv Bricks';
    const update = { firmName: firmName };
    if (!snap.exists) update.tabs = []; // create the profile for a brand-new account
    try { await userDocRef().set(update, { merge: true }); }
    catch (e) { console.error('Could not save firm name:', e); }
  }
  applyFirmName();
  updateCache();
  if (snap.metadata && snap.metadata.fromCache) refreshProfile();
}
// Quietly pull the latest profile (tabs / firm name from another device) without blocking.
function refreshProfile() {
  userDocRef().get().then((fresh) => {
    if (!fresh.exists) return;
    const d = fresh.data() || {};
    if (d.migrated === true) hasMigrated = true;
    if (Array.isArray(d.tabs)) {
      tabs = d.tabs.slice().sort((a, b) => a.localeCompare(b));
      renderTabs();
    }
    if (d.firmName) { firmName = d.firmName; applyFirmName(); }
    updateCache();
  }).catch(() => {});
}
function applyFirmName() {
  const h = document.getElementById('firmName');
  if (h) h.textContent = firmName;
  document.title = firmName;
}

// ===== One-time migration: old localStorage data -> Firestore =====
async function migrateLocalData() {
  // Skip if this account already imported, or this device's data was already imported.
  if (hasMigrated) return;
  if (localStorage.getItem('deliveryDataMigrated')) return;
  const raw = localStorage.getItem('deliveryData');
  if (!raw) return;
  let local;
  try { local = JSON.parse(raw); } catch (e) { return; }
  if (!local || typeof local !== 'object') return;
  const tabNames = Object.keys(local);
  if (tabNames.length === 0) return;
  // Gather every entry, preserving its original order via an increasing createdAt.
  const toWrite = [];
  const allTabs = new Set(tabs);
  let order = Date.now();
  tabNames.forEach((tabName) => {
    allTabs.add(tabName);
    const arr = Array.isArray(local[tabName]) ? local[tabName] : [];
    arr.forEach((e) => {
      toWrite.push({
        date: e.date || '',
        place: e.place || '',
        party: e.party || '',
        area: e.area || '',
        purchase: e.purchase || '',
        transporter: e.transporter || '',
        quantity: e.quantity || '',
        tab: tabName,
        createdAt: order++
      });
    });
  });
  try {
    // Firestore batches max out at 500 writes; chunk to stay safe.
    const CHUNK = 400;
    for (let i = 0; i < toWrite.length; i += CHUNK) {
      const batch = db.batch();
      toWrite.slice(i, i + CHUNK).forEach((entry) => {
        batch.set(entriesRef().doc(), entry);
      });
      await batch.commit();
    }
    const mergedTabs = [...allTabs].sort((a, b) => a.localeCompare(b));
    await userDocRef().set({ tabs: mergedTabs, migrated: true }, { merge: true });
    tabs = mergedTabs;
    hasMigrated = true;
    updateCache();
    localStorage.setItem('deliveryDataMigrated', '1'); // don't import this device again
    if (toWrite.length > 0) {
      alert('Imported ' + toWrite.length + ' existing entr' +
            (toWrite.length === 1 ? 'y' : 'ies') + ' into your account.');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    alert('Could not import existing data: ' + (err.code || err.message) +
          '\nYour old data is still safe on this device. Reload to try again.');
  }
}

async function addNewTab() {
  const newTabName = prompt("Enter a name for the new tab (e.g., 'Diwali 2081'):");
  if (newTabName) {
    if (tabs.includes(newTabName)) {
      alert('A tab with this name already exists.');
      return;
    }
    tabs.push(newTabName);
    tabs.sort((a, b) => a.localeCompare(b));
    // Not awaited: the tab shows up instantly; Firestore syncs in the background.
    userDocRef().set({ tabs: tabs }, { merge: true })
      .catch((e) => alert('Could not sync new tab: ' + (e.code || e.message)));
    activeTab = newTabName;
    renderTabs();
    subscribeEntries();
  }
}
addTabButton.addEventListener('click', () => { if (currentUser) addNewTab(); });

function renderTabs() {
  const tabsContainer = document.getElementById('yearTabs');
  tabsContainer.innerHTML = '';
  tabs.forEach((tabName) => {
    const li = document.createElement('li');
    li.className = 'nav-item';
    const a = document.createElement('a');
    a.className = 'nav-link';
    if (tabName === activeTab) a.classList.add('active');
    a.href = '#';
    a.textContent = tabName;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      activeTab = tabName;
      renderTabs();
      if (currentUser) subscribeEntries();
      else { // Firebase not ready yet: show this tab from the local snapshot
        currentEntries = (appCache && appCache.entries && appCache.entries[activeTab]) || [];
        renderTable();
      }
    });
    li.appendChild(a);
    tabsContainer.appendChild(li);
  });
  updateCache();
}

// ===== Entries (live from Firestore, mirrored to the local snapshot) =====
function subscribeEntries() {
  if (entriesUnsub) { entriesUnsub(); entriesUnsub = null; }
  if (!activeTab) { currentEntries = []; renderTable(); return; }
  const tabAtSub = activeTab;
  // Show this tab's local copy right away while Firestore catches up.
  const local = appCache && appCache.entries && appCache.entries[tabAtSub];
  currentEntries = local ? local.slice() : [];
  renderTable();
  entriesUnsub = entriesRef()
    .where('tab', '==', tabAtSub)
    .onSnapshot((snap) => {
      // Firestore's own cache can start empty (e.g. cleared browser data) -- don't
      // let that blank out a good local copy while the real data is on its way.
      const hadLocal = appCache && appCache.entries && appCache.entries[tabAtSub] &&
                       appCache.entries[tabAtSub].length > 0;
      if (snap.metadata.fromCache && snap.empty && hadLocal) return;
      currentEntries = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      currentEntries.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      if (ensureCache()) {
        appCache.entries[tabAtSub] = currentEntries;
        updateCache();
      }
      renderTable();
    }, (err) => {
      console.error('Entries listener error:', err);
    });
}

// ===== Form submit (add / update) =====
// Writes are not awaited: Firestore applies them locally at once (the table updates
// instantly, even offline) and uploads in the background.
form.addEventListener('submit', function (e) {
  e.preventDefault();
  if (!currentUser) { alert('Still connecting to your account. Please try again in a moment.'); return; }
  if (!activeTab) { alert('Please create a tab first before adding entries.'); return; }
  if (!dateInput.value || !placeInput.value || !partyInput.value || !areaInput.value ||
      !purchaseInput.value || !transporterInput.value || !quantityInput.value) {
    alert('Please fill in all fields.');
    return;
  }
  const entry = {
    date: dateInput.value,
    place: placeInput.value.trim(),
    party: partyInput.value.trim(),
    area: areaInput.value.trim(),
    purchase: purchaseInput.value.trim(),
    transporter: transporterInput.value.trim(),
    quantity: quantityInput.value.trim()
  };
  const onSaveError = (err) => alert('Could not save: ' + (err.code || err.message));
  if (editId === null) {
    entry.tab = activeTab;
    entry.createdAt = Date.now();
    if (monthFilter) monthFilter.value = ''; // jump to All so the new entry is visible
    entriesRef().add(entry).catch(onSaveError);
  } else {
    entriesRef().doc(editId).update(entry).catch(onSaveError);
    editId = null;
    submitbutton.textContent = 'Add Delivery';
  }
  form.reset();
});

// ===== Render the table from currentEntries =====
function renderTable() {
  tableBody.innerHTML = '';
  let indexno = 1;
  const frag = document.createDocumentFragment();
  const tmp = document.createElement('tbody');
  currentEntries.forEach((entry) => {
    const row = tmp.insertRow();
    row.insertCell().textContent = indexno++;
    row.insertCell().textContent = formatDateToDDMMYYYY(entry.date);
    row.insertCell().textContent = entry.place;
    row.insertCell().textContent = entry.party;
    row.insertCell().textContent = entry.area;
    row.insertCell().textContent = entry.purchase;
    row.insertCell().textContent = entry.transporter;
    row.insertCell().textContent = entry.quantity;
    const actionsCell = row.insertCell();
    actionsCell.classList.add('text-center');
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'btn btn-sm btn-primary me-2';
    editBtn.addEventListener('click', () => editEntry(entry.id));
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.className = 'btn btn-sm btn-danger';
    delBtn.addEventListener('click', () => deleteEntry(entry.id));
    actionsCell.appendChild(editBtn);
    actionsCell.appendChild(delBtn);
  });
  // move all rows into the live table in one go (single reflow)
  while (tmp.firstChild) frag.appendChild(tmp.firstChild);
  tableBody.appendChild(frag);
  populateMonths();
  applyFilters();
  applyColumnVisibility();
}

// ===== Edit / delete =====
function editEntry(id) {
  const entry = currentEntries.find((x) => x.id === id);
  if (!entry) return;
  dateInput.value = entry.date;
  placeInput.value = entry.place;
  partyInput.value = entry.party;
  areaInput.value = entry.area;
  purchaseInput.value = entry.purchase;
  transporterInput.value = entry.transporter;
  quantityInput.value = entry.quantity;
  editId = id;
  submitbutton.textContent = 'Update Delivery';
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
function deleteEntry(id) {
  if (!currentUser) return;
  if (confirm('Delete this entry?')) {
    entriesRef().doc(id).delete()
      .catch((err) => alert('Could not delete: ' + (err.code || err.message)));
  }
}

// ===== Month dropdown =====
function populateMonths() {
  if (!monthFilter) return;
  const previous = monthFilter.value;
  const keys = [...new Set(
    currentEntries.map((e) => (e.date || '').slice(0, 7)).filter((k) => k.length === 7)
  )].sort();
  monthFilter.innerHTML = '<option value="">All</option>';
  keys.forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = monthLabel(key);
    monthFilter.appendChild(opt);
  });
  monthFilter.value = keys.includes(previous) ? previous : '';
}
function monthLabel(key) {
  const [year, month] = key.split('-');
  const names = ['January', 'February', 'March', 'April', 'May', 'June',
                 'July', 'August', 'September', 'October', 'November', 'December'];
  const idx = parseInt(month, 10) - 1;
  return (names[idx] || month) + ' ' + year;
}

// ===== Column show / hide =====
function applyColumnVisibility() {
  const checks = document.querySelectorAll('.pdf-col');
  if (!checks.length) return;
  const visible = {};
  checks.forEach((cb) => { visible[parseInt(cb.value, 10)] = cb.checked; });
  const isShown = (i) => visible[i] !== false;
  const headRow = document.querySelector('thead tr');
  for (let i = 0; i <= 7; i++) {
    const disp = isShown(i) ? '' : 'none';
    if (headRow && headRow.children[i]) headRow.children[i].style.display = disp;
    document.querySelectorAll('#entryTableBody tr').forEach((tr) => {
      if (tr.children[i]) tr.children[i].style.display = disp;
    });
  }
  const countCell = document.getElementById('totalCount');
  const qtyCell = document.getElementById('totalQuantity');
  const labelCell = document.getElementById('totalLabelCell');
  if (countCell) countCell.style.display = isShown(0) ? '' : 'none';
  if (qtyCell) qtyCell.style.display = isShown(7) ? '' : 'none';
  if (labelCell) {
    let middle = 0;
    for (let i = 1; i <= 6; i++) if (isShown(i)) middle++;
    if (middle === 0) labelCell.style.display = 'none';
    else { labelCell.style.display = ''; labelCell.colSpan = middle; }
  }
}
document.querySelectorAll('.pdf-col').forEach((cb) => {
  cb.addEventListener('change', applyColumnVisibility);
});

// ===== Date helper (also used by filter.js) =====
function formatDateToDDMMYYYY(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split("-");
  return `${day}-${month}-${year}`;
}
