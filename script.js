// script.js — Shiv Bricks V2 (cloud storage with Firebase)

// ===== Firebase init (compat SDK, loaded via <script> in index.html) =====
const firebaseConfig = {
  apiKey: "AIzaSyAMFN8EP-vDNftsFtbS8C9MnABxKVyY6vY",
  authDomain: "shiv-bricks-fe97c.firebaseapp.com",
  projectId: "shiv-bricks-fe97c",
  storageBucket: "shiv-bricks-fe97c.firebasestorage.app",
  messagingSenderId: "761334426715",
  appId: "1:761334426715:web:d521be0aeec936c9dd237e"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// Offline cache so the app keeps working with no connection
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn('Offline persistence not enabled:', err && err.code);
});

// ===== State =====
let currentUser = null;
let activeTab = "";
let tabs = [];            // ordered list of tab names (from the profile doc)
let currentEntries = [];  // entries for the active tab: [{ id, date, place, ... }]
let entriesUnsub = null;  // onSnapshot unsubscribe for the active tab
let editId = null;        // doc id being edited, or null when adding
let firmName = 'Shiv Bricks'; // this account's firm name (header title + PDF title)
let hasMigrated = false;  // whether this account already imported old localStorage data

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

// ===== Auth =====
googleSignInBtn.addEventListener('click', async () => {
  try { await auth.signInWithPopup(provider); }
  catch (e) { alert('Sign-in failed: ' + (e.code || e.message)); }
});

signOutBtn.addEventListener('click', async () => {
  try { await auth.signOut(); }
  catch (e) { console.error(e); }
});

auth.onAuthStateChanged(async (user) => {
  currentUser = user || null;
  if (loadingEl) loadingEl.style.display = 'none';

  if (user) {
    signInScreen.style.display = 'none';
    appRoot.style.display = '';

    await loadProfile();
    await migrateLocalData();   // one-time: pull old localStorage data into the cloud
    if (tabs.length > 0) activeTab = tabs[tabs.length - 1];
    renderTabs();
    subscribeEntries();
    if (tabs.length === 0) addNewTab(); // prompt to create the first tab
  } else {
    if (entriesUnsub) { entriesUnsub(); entriesUnsub = null; }
    appRoot.style.display = 'none';
    signInScreen.style.display = '';
    firmName = 'Shiv Bricks';
    applyFirmName();
  }
});

// ===== Profile, firm name & tabs =====
async function loadProfile() {
  const snap = await userDocRef().get();
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
    try { await userDocRef().set({ tabs: tabs }, { merge: true }); }
    catch (e) { alert('Could not create tab: ' + (e.code || e.message)); return; }
    activeTab = newTabName;
    renderTabs();
    subscribeEntries();
  }
}

addTabButton.addEventListener('click', addNewTab);

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
      subscribeEntries();
    });
    li.appendChild(a);
    tabsContainer.appendChild(li);
  });
}

// ===== Entries (live from Firestore) =====
function subscribeEntries() {
  if (entriesUnsub) { entriesUnsub(); entriesUnsub = null; }
  if (!activeTab) { currentEntries = []; renderTable(); return; }
  entriesUnsub = entriesRef()
    .where('tab', '==', activeTab)
    .onSnapshot((snap) => {
      currentEntries = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      currentEntries.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      renderTable();
    }, (err) => {
      console.error('Entries listener error:', err);
    });
}

// ===== Form submit (add / update) =====
form.addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!currentUser) return;
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

  try {
    if (editId === null) {
      entry.tab = activeTab;
      entry.createdAt = Date.now();
      if (monthFilter) monthFilter.value = ''; // jump to All so the new entry is visible
      await entriesRef().add(entry);
    } else {
      await entriesRef().doc(editId).update(entry);
      editId = null;
      submitbutton.textContent = 'Add Delivery';
    }
  } catch (err) {
    alert('Could not save: ' + (err.code || err.message));
    return;
  }

  form.reset();
});

// ===== Render the table from currentEntries =====
function renderTable() {
  tableBody.innerHTML = '';
  let indexno = 1;

  currentEntries.forEach((entry) => {
    const row = tableBody.insertRow();
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

async function deleteEntry(id) {
  if (confirm('Delete this entry?')) {
    try { await entriesRef().doc(id).delete(); }
    catch (err) { alert('Could not delete: ' + (err.code || err.message)); }
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
