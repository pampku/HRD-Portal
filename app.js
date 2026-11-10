// app.js — layar & interaksi. Aturan bisnis ada di logic.js, akses Firebase di firebase.js.
import * as F from './firebase.js';
import * as L from './logic.js';
import * as C from './company.js';

const { esc } = L;
const { db, auth } = F;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = $('#root');
const modalHost = $('#modalHost');

const state = { user: null, emp: null, settings: { ...L.DEFAULT_SETTINGS }, route: null, busy: false, setupDone: true, reportMonth: '', companies: [], scope: 'all', holidays: [], holDocs: [], cal: { y: new Date().getFullYear(), m: new Date().getMonth(), sel: null } };

// ---------- Ikon & label ----------
const ICONS = {
  dashboard: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
  apply: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M12 13v5M9.5 15.5h5"/>',
  review: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  adjust: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  employees: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  mutations: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  report: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  accounts: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  approval: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  companies: '<path d="M4 21V8l8-5 8 5v13M9 21v-6h6v6M8 11h.01M12 11h.01M16 11h.01"/>',
  holidays: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
const ico = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const NAV = {
  dashboard: 'Beranda', apply: 'Ajukan', review: 'Review', adjust: 'Penyesuaian', employees: 'Karyawan',
  mutations: 'Mutasi', report: 'Laporan', settings: 'Pengaturan', accounts: 'Akun', approval: 'Persetujuan', profile: 'Profil', companies: 'Perusahaan', holidays: 'Libur',
};

// ---------- Format & komponen kecil ----------
const fd = (v) => {
  if (!v) return '-';
  const d = L.parseDate(v) || new Date(v);
  return isNaN(d) ? '-' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};
const fdt = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d) ? '-' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};
const first = (n) => String(n || '').split(' ')[0];
const roleLabel = (r) => L.ROLES[r] || r;
const bal = (e) => (e && typeof e.leaveBalance === 'number' ? e.leaveBalance : 0);
const emptyHtml = (t, s = '') => `<div class="empty"><b>${esc(t)}</b>${esc(s)}</div>`;
const pageHead = (title, sub = '', actions = '') => `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div><div class="btn-row">${actions}</div></div>`;
const card = (title, inner, actions = '') => `<section class="card"><div class="card-head"><h3>${esc(title)}</h3>${actions}</div>${inner}</section>`;
const banner = (kind, title, text = '') => `<div class="banner ${kind}" role="note"><div>${title ? `<strong>${esc(title)}</strong>` : ''}${text ? esc(text) : ''}</div></div>`;
const avatar = (u, cls = '') => u && u.photoUrl
  ? `<div class="avatar ${cls}"><img src="${esc(u.photoUrl)}" alt=""></div>`
  : `<div class="avatar ${cls}">${esc((u && u.name ? u.name : '?').charAt(0).toUpperCase())}</div>`;
const statusBadge = (s) => `<span class="badge ${s === 'approved' ? 'b-ok' : s === 'rejected' ? 'b-no' : 'b-pending'}">${esc(L.statusLabel(s))}</span>`;
const byDateDesc = (key) => (a, b) => new Date(b[key] || 0) - new Date(a[key] || 0);

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'err' ? 6000 : 3200);
}
const errMsg = (e) => { console.error(e); return F.authErrorMessage(e); };

function stepsHtml(r) {
  const flow = r.employeeRole === 'kepala_hrd'
    ? [['pending_director', 'Direktur', 'direktur']]
    : [['pending_review', 'Review HRD', 'staff_hrd'], ['pending_head', 'Kepala HRD', 'kepala_hrd']];
  const out = [['done', 'Diajukan']];
  const cur = flow.findIndex((f) => f[0] === r.status);
  const rejIdx = flow.findIndex((f) => f[2] === r.decidedRole);
  flow.forEach((f, i) => {
    let cls = '';
    if (r.status === 'approved') cls = 'done';
    else if (r.status === 'rejected') cls = i < rejIdx ? 'done' : i === rejIdx ? 'bad' : '';
    else cls = i < cur ? 'done' : i === cur ? 'now' : '';
    out.push([cls, f[1]]);
  });
  if (r.status !== 'rejected') out.push([r.status === 'approved' ? 'done' : '', 'Selesai']);
  return `<div class="steps">${out.map(([c, t]) => `<span class="step ${c}"><i></i>${esc(t)}</span>`).join('')}</div>`;
}

// ---------- Dialog (konfirmasi, formulir, info) ----------
let dlg = null;
function closeModal() { modalHost.innerHTML = ''; dlg = null; }
function dialog({ title, body = '', okLabel = 'Simpan', cancelLabel = 'Batal', danger = false, validate, getValue, onSubmit }) {
  return new Promise((resolve) => {
    dlg = { resolve, validate, getValue, onSubmit };
    modalHost.innerHTML = `<div class="overlay" data-act="m-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h3>${esc(title)}</h3><div>${body}</div>
      <div class="banner danger" id="dlgErr" hidden style="margin:14px 0 0"></div>
      <div class="foot">${cancelLabel ? `<button class="btn btn-line" data-act="m-cancel">${esc(cancelLabel)}</button>` : ''}
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="m-ok" id="dlgOk">${esc(okLabel)}</button></div></div></div>`;
    const f = $('input:not([type=hidden]),select,textarea', modalHost);
    if (f) f.focus();
  });
}
const info = (title, body) => dialog({ title, body, okLabel: 'Tutup', cancelLabel: '' });
const confirmBox = (title, text, okLabel = 'Lanjutkan', danger = false) => dialog({ title, body: `<p>${text}</p>`, okLabel, danger });

async function dialogOk() {
  if (!dlg) return;
  const err = $('#dlgErr'), btn = $('#dlgOk');
  const showErr = (m) => { err.textContent = m; err.hidden = false; };
  err.hidden = true;
  const bad = dlg.validate ? dlg.validate() : '';
  if (bad) return showErr(bad);
  const val = dlg.getValue ? dlg.getValue() : true;
  if (dlg.onSubmit) {
    btn.disabled = true;
    try { await dlg.onSubmit(val); } catch (e) { btn.disabled = false; return showErr(errMsg(e)); }
  }
  const r = dlg.resolve; closeModal(); r(val);
}
function dialogCancel() { if (!dlg) return; const r = dlg.resolve; closeModal(); r(null); }

// ---------- Data ----------
const cache = new Map();
const TTL = 15000;
const bust = () => cache.clear();
async function cached(key, fn) {
  const c = cache.get(key);
  if (c && Date.now() - c.t < TTL) return c.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}
const snapList = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
// ---- Akses per PT: tiap role hanya membaca data PT yang boleh diaksesnya. Owner (superuser) membaca semua.
const access = () => C.accessIds(state.user, state.companies);
const actOn = (u, r) => (C.inAccess(u, r.companyId, state.companies) ? L.actionFor(u, r) : null);
async function fetchRaw(name) {
  if (state.user.role === 'superuser') return snapList(await F.getDocs(F.collection(db, name)));
  const parts = await Promise.all(access().map(async (cid) => snapList(await F.getDocs(F.query(F.collection(db, name), F.where('companyId', '==', cid))))));
  return parts.flat();
}
const inScope = (x) => state.scope === 'all' || x.companyId === state.scope;
const listAll = async (name) => (await cached('all:' + name, () => fetchRaw(name))).filter(inScope);
const coName = (id) => (state.companies.find((c) => c.id === id) || {}).name || '-';
function coChips(usr, e) {
  const home = (usr && usr.companyId) || (e && e.companyId);
  const ids = usr ? C.accessIds(usr, state.companies) : [home].filter(Boolean);
  const order = [home, ...ids.filter((i) => i !== home)].filter((i) => ids.includes(i) || i === home);
  return order.map((i) => `<span class="chip${i === home ? ' home' : ''}">${esc(coName(i))}</span>`).join('') || '-';
}
async function loadCompanies() {
  const u = state.user;
  if (u.role === 'superuser') state.companies = snapList(await F.getDocs(F.collection(db, 'companies')));
  else {
    const docs = await Promise.all(C.uniq([u.companyId, ...(u.companyIds || [])]).map((id) => F.getDoc(F.doc(db, 'companies', id)).catch(() => null)));
    state.companies = docs.filter((d) => d && d.exists()).map((d) => ({ id: d.id, ...d.data() }));
  }
  state.companies.sort((a, b) => a.name.localeCompare(b.name, 'id'));
}
async function loadHolidays() {
  try { const s = await F.getDoc(F.doc(db, 'calendar', 'holidays')); state.holidays = s.exists() ? (s.data().ranges || []) : []; }
  catch (e) { console.warn('holidays', e); state.holidays = []; }
}
const listHolidays = async () => snapList(await F.getDocs(F.collection(db, 'holidays'))).sort(byDateDesc('requestedAt'));
// Hari yang akan dipotong untuk sebuah pengajuan, memperhitungkan tanggal merah yang berlaku sekarang.
const effDays = (r) => (r.status === 'approved' || r.status === 'rejected' ? r.days
  : C.countLeaveDays(r.startDate, r.endDate, { excludeWeekends: typeof r.excludeWeekends === 'boolean' ? r.excludeWeekends : !!state.settings.excludeWeekends, holidays: state.holidays }));
function navItems(role) {
  const base = L.navFor(role).filter((r) => r !== 'profile');
  return [...(role === 'superuser' ? ['companies'] : []), ...base, 'holidays', 'profile'];
}
function renderScope() {
  const el = $('#scopeBar'); if (!el) return;
  const ids = access();
  if (ids.length < 2) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="scopebar"><label for="scopeSel">Perusahaan</label><select id="scopeSel" data-input="scope"><option value="all">Semua PT${state.user.role === 'superuser' ? '' : ' saya'} (${ids.length})</option>${state.companies.filter((c) => ids.includes(c.id)).map((c) => `<option value="${esc(c.id)}"${state.scope === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`;
}
const listBy = (name, field, val) => cached(`by:${name}:${field}:${val}`, async () => snapList(await F.getDocs(F.query(F.collection(db, name), F.where(field, '==', val)))));
const isMgmt = () => ['superuser', 'direktur', 'komisaris', 'kepala_hrd', 'staff_hrd'].includes(state.user.role);
const getEmployees = async () => (await listAll('employees')).sort((a, b) => a.name.localeCompare(b.name, 'id'));
const getRequests = async () => (await (isMgmt() ? listAll('requests') : listBy('requests', 'employeeId', state.user.employeeId))).slice().sort(byDateDesc('createdAt'));
const myRequests = async () => (await listBy('requests', 'employeeId', state.user.employeeId)).slice().sort(byDateDesc('createdAt'));
const empMap = (list) => Object.fromEntries(list.map((e) => [e.id, e]));

async function loadSettings() {
  try {
    const s = await F.getDoc(F.doc(db, 'settings', 'leave'));
    state.settings = { ...L.DEFAULT_SETTINGS, ...(s.exists() ? s.data() : {}) };
  } catch (e) { console.warn('settings', e); }
}
async function refreshEmp() {
  if (!state.user.employeeId) return;
  const s = await F.getDoc(F.doc(db, 'employees', state.user.employeeId));
  state.emp = s.exists() ? { id: s.id, ...s.data() } : null;
}

// ---------- Layar: konfigurasi, setup, login ----------
function gate(inner) { root.innerHTML = `<div class="gate"><div class="gate-card">${inner}</div></div>`; }
const brandHtml = '<div class="brand"><span class="brand-mark">H</span>HRD Portal</div>';

function renderNeedConfig() {
  gate(`${brandHtml}<p class="lead">Firebase belum dikonfigurasi.</p>
    <p>Buka <code>firebase.js</code>, lalu ganti nilai <code>firebaseConfig</code> dengan config project Firebase baru Anda. Langkah lengkap ada di <code>README.md</code>.</p>`);
}
function renderFatal(e) {
  console.error(e);
  gate(`${brandHtml}<p class="lead">Tidak bisa memuat portal.</p>${banner('danger', '', F.authErrorMessage(e))}
    <button class="btn btn-primary btn-block" onclick="location.reload()">Muat ulang</button>`);
}
function renderLogin() {
  state.user = null; state.emp = null; cache.clear();
  gate(`${brandHtml}<p class="lead">Masuk untuk mengajukan cuti dan melihat sisa saldo Anda.</p>
    <form data-submit="login" novalidate>
      <div class="field"><label for="lgUser">Username</label><input type="text" id="lgUser" autocomplete="username" autocapitalize="none" spellcheck="false"></div>
      <div class="field"><label for="lgPass">Password</label><input type="password" id="lgPass" autocomplete="current-password"></div>
      <div class="banner danger" id="lgErr" hidden></div>
      <button class="btn btn-primary btn-block" id="lgBtn" type="submit">Masuk</button>
    </form>`);
  $('#lgUser').focus();
}
function renderSetup() {
  gate(`${brandHtml}<p class="lead">Setup awal: buat akun Superuser pertama. Layar ini hanya muncul sekali.</p>
    <form data-submit="setup" novalidate>
      <div class="field"><label for="suName">Nama lengkap</label><input type="text" id="suName" autocomplete="name"></div>
      <div class="field"><label for="suUser">Username</label><input type="text" id="suUser" autocomplete="username" autocapitalize="none"></div>
      <div class="field"><label for="suPass">Password</label><input type="password" id="suPass" autocomplete="new-password"><div class="hint">Minimal 8 karakter.</div></div>
      <div class="field"><label for="suPass2">Ulangi password</label><input type="password" id="suPass2" autocomplete="new-password"></div>
      <div class="banner danger" id="suErr" hidden></div>
      <button class="btn btn-primary btn-block" id="suBtn" type="submit">Buat Superuser</button>
    </form>`);
}
function renderNoCompany() {
  gate(`${brandHtml}<p class="lead">Akun Anda belum terhubung ke perusahaan (PT).</p>
    <p style="margin-bottom:16px">Hubungi owner atau Staff HRD agar akun Anda dikaitkan ke PT.</p>
    <button class="btn btn-line btn-block" data-act="logout">Keluar</button>`);
}
function renderNoProfile() {
  gate(`${brandHtml}<p class="lead">Akun login ini belum terdaftar di portal.</p>
    <p style="margin-bottom:16px">Hubungi Superuser atau Staff HRD untuk dibuatkan profil.</p>
    <button class="btn btn-line btn-block" data-act="logout">Keluar</button>`);
}

async function doLogin() {
  const id = L.normalizeUsername($('#lgUser').value), pass = $('#lgPass').value, err = $('#lgErr'), btn = $('#lgBtn');
  err.hidden = true;
  if (!id || !pass) { err.textContent = 'Isi username dan password.'; err.hidden = false; return; }
  btn.disabled = true; btn.textContent = 'Memeriksa…';
  try {
    let mapped = null;
    if (!id.includes('@')) {
      const s = await F.getDoc(F.doc(db, 'usernames', id));
      if (s.exists()) mapped = s.data().email;
    }
    await F.signInWithEmailAndPassword(auth, L.loginIdToEmail(id, mapped), pass);
  } catch (e) {
    err.textContent = errMsg(e); err.hidden = false;
    btn.disabled = false; btn.textContent = 'Masuk';
  }
}

async function doSetup() {
  const name = $('#suName').value.trim(), uname = L.normalizeUsername($('#suUser').value), p1 = $('#suPass').value, p2 = $('#suPass2').value;
  const err = $('#suErr'), btn = $('#suBtn');
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  err.hidden = true;
  if (!name) return fail('Isi nama lengkap.');
  const ue = L.validateUsername(uname); if (ue) return fail(ue);
  if (p1.length < 8) return fail('Password minimal 8 karakter.');
  if (p1 !== p2) return fail('Konfirmasi password tidak sama.');
  btn.disabled = true; btn.textContent = 'Membuat…';
  state.busy = true;
  try {
    const email = L.loginIdToEmail(uname);
    let uid;
    if (auth.currentUser) uid = auth.currentUser.uid; // sisa setup yang terputus
    else uid = (await F.createUserWithEmailAndPassword(auth, email, p1)).user.uid;
    const b = F.writeBatch(db), now = new Date().toISOString();
    b.set(F.doc(db, 'users', uid), { username: uname, name, role: 'superuser', email, createdAt: now });
    b.set(F.doc(db, 'usernames', uname), { email, uid });
    b.set(F.doc(db, 'meta', 'bootstrap'), { at: now, by: uid });
    await b.commit();
    state.setupDone = true; state.busy = false;
    await loadSession(auth.currentUser);
  } catch (e) {
    state.busy = false;
    fail(errMsg(e)); btn.disabled = false; btn.textContent = 'Buat Superuser';
  }
}

// ---------- Sesi ----------
async function loadSession(u) {
  const snap = await F.getDoc(F.doc(db, 'users', u.uid));
  if (!snap.exists()) return state.setupDone ? renderNoProfile() : renderSetup();
  state.user = { uid: u.uid, ...snap.data() };
  state.setupDone = true;
  await refreshEmp();
  await loadSettings();
  await loadCompanies();
  await loadHolidays();
  state.scope = 'all';
  if (state.user.role !== 'superuser' && !access().length) return renderNoCompany();
  state.route = null;
  renderShell();
  renderScope();
  go(navItems(state.user.role)[0]);
  if (['staff_hrd', 'kepala_hrd', 'superuser'].includes(state.user.role)) {
    runRenewals().then((n) => { if (n) { toast(`Cuti tahunan diperbarui untuk ${n} karyawan.`, 'ok'); bust(); if (state.route) go(state.route); } }).catch((e) => console.warn('renewal', e));
  }
}

async function onAuth(u) {
  if (state.busy) return;
  try {
    if (!u) return state.setupDone ? renderLogin() : renderSetup();
    await loadSession(u);
  } catch (e) { renderFatal(e); }
}

async function boot() {
  if (!F.isConfigured) return renderNeedConfig();
  try {
    state.setupDone = (await F.getDoc(F.doc(db, 'meta', 'bootstrap'))).exists();
  } catch (e) { return renderFatal(e); }
  F.onAuthStateChanged(auth, onAuth);
}

// ---------- Auto renewal ----------
async function runRenewals() {
  const list = await fetchRaw('employees');
  let n = 0;
  for (const emp of list) {
    if (!L.computeRenewal(emp, new Date(), state.settings)) continue;
    const applied = await F.runTransaction(db, async (tx) => {
      const ref = F.doc(db, 'employees', emp.id);
      const s = await tx.get(ref);
      if (!s.exists()) return false;
      const cur = { id: s.id, ...s.data() };
      const r = L.computeRenewal(cur, new Date(), state.settings);
      if (!r) return false;
      if (r.initOnly) { tx.update(ref, { renewedYears: r.renewedYears }); return false; }
      tx.update(ref, { leaveBalance: r.newBalance, renewedYears: r.renewedYears });
      r.entries.forEach((en) => tx.set(F.doc(F.collection(db, 'ledger')), { employeeId: cur.id, employeeName: cur.name, companyId: cur.companyId, ...en, by: 'Sistem' }));
      return true;
    });
    if (applied) n++;
  }
  if (n) bust();
  return n;
}

// ---------- Kerangka ----------
function renderShell() {
  const u = state.user, items = navItems(u.role);
  const nav = items.map((r) => `<button class="nav-item" data-act="go" data-route="${r}">${ico(r)}<span>${NAV[r]}</span><span class="count" data-badge="${r}" hidden></span></button>`).join('');
  root.innerHTML = `<div class="shell">
    <aside class="side">
      <div class="brand"><span class="brand-mark">H</span>HRD Portal</div>
      ${nav}
      <div class="side-foot">
        <div class="me">${avatar(u, 'sm')}<div><div class="me-name">${esc(u.name)}</div><div class="me-role">${esc(roleLabel(u.role))}</div></div></div>
        <button class="nav-item" data-act="logout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg><span>Keluar</span></button>
      </div>
    </aside>
    <div>
      <header class="topbar"><div class="brand"><span class="brand-mark">H</span>HRD Portal</div>
        <div class="btn-row" style="align-items:center">${avatar(u, 'sm')}<button class="btn btn-ghost btn-sm" data-act="logout">Keluar</button></div></header>
      <div id="scopeBar"></div>
      <main class="main" id="page"></main>
    </div>
    <nav class="bottom-nav" aria-label="Menu utama">${nav}</nav>
  </div>`;
}
function markNav() {
  $$('.nav-item[data-route]').forEach((b) => { if (b.dataset.route === state.route) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
}
async function updateCounts() {
  const u = state.user; if (!u) return;
  const c = {};
  try {
    if (u.role === 'staff_hrd') c.review = (await listAll('requests')).filter((r) => actOn(u, r) === 'review').length;
    if (u.role === 'kepala_hrd') {
      c.dashboard = (await listAll('requests')).filter((r) => actOn(u, r) === 'head').length
        + (await listAll('adjustments')).filter((a) => a.status === 'pending_head').length;
    }
    if (u.role === 'direktur') {
      c.approval = (await listAll('requests')).filter((r) => actOn(u, r) === 'director').length;
      c.holidays = (await listHolidays()).filter((h) => h.status === 'pending').length;
    }
  } catch (e) { console.warn(e); }
  $$('[data-badge]').forEach((el) => { const n = c[el.dataset.badge] || 0; el.textContent = n; el.hidden = !n; });
}

async function go(route) {
  if (!state.user) return;
  state.route = route; markNav();
  const page = $('#page'); if (!page) return;
  page.innerHTML = '<div class="loading"><div class="spin"></div>Memuat…</div>';
  window.scrollTo(0, 0);
  try {
    if (['dashboard', 'apply', 'review', 'approval'].includes(route)) await loadHolidays();
    const html = await pages[route]();
    if (state.route !== route) return;
    page.innerHTML = html;
    if (afterPage[route]) afterPage[route]();
    updateCounts();
  } catch (e) {
    console.error(e);
    page.innerHTML = pageHead('Terjadi kesalahan') + banner('danger', '', F.authErrorMessage(e)) + `<button class="btn btn-primary" data-act="go" data-route="${esc(route)}">Coba lagi</button>`;
  }
}
const reload = () => { bust(); return go(state.route); };

// ---------- Komponen data ----------
function balanceHero(emp) {
  const b = bal(emp), q = state.settings.annualQuota, debt = b < 0;
  const pct = Math.max(0, Math.min(100, (b / q) * 100));
  const yrs = L.completedYears(emp.joinDate), next = L.nextRenewalDate(emp.joinDate);
  const eligible = L.isEligible(emp.joinDate);
  return `<section class="balance ${debt ? 'debt' : ''}">
    <div><div class="lab">Sisa cuti tahunan</div><div class="num">${b}<small>hari</small></div></div>
    <div>
      <div class="meter" role="img" aria-label="Saldo ${b} dari jatah ${q} hari"><i style="width:${pct}%"></i></div>
      <dl>
        <dt>Masa kerja</dt><dd>${yrs} tahun (sejak ${esc(fd(emp.joinDate))})</dd>
        <dt>Pembaruan berikutnya</dt><dd>${esc(fd(next))} — jatah ${q} hari</dd>
        <dt>Status</dt><dd>${debt ? `<span class="badge b-debt">Hutang ${Math.abs(b)} hari</span> dipotong dari jatah berikutnya` : eligible ? 'Berhak cuti tahunan' : `Cuti tahunan terbuka setelah ${esc(fd(L.addYears(L.parseDate(emp.joinDate), 1)))}`}</dd>
      </dl>
    </div></section>`;
}

function myReqTable(list) {
  if (!list.length) return emptyHtml('Belum ada pengajuan', 'Pengajuan cuti dan izin Anda akan muncul di sini.');
  return `<div class="tw"><table><thead><tr><th>Periode</th><th>Hari</th><th>Jenis</th><th>Status</th></tr></thead><tbody>${list.map((r) => `<tr>
    <td>${esc(fd(r.startDate))} – ${esc(fd(r.endDate))}</td><td>${r.days}</td>
    <td>${esc(r.reason)}${r.rejectNote ? `<div class="sub">Alasan ditolak: ${esc(r.rejectNote)}</div>` : ''}</td>
    <td>${statusBadge(r.status)}${stepsHtml(r)}</td></tr>`).join('')}</tbody></table></div>`;
}

function ledgerTable(list, withName = false) {
  if (!list.length) return emptyHtml('Belum ada mutasi', 'Perubahan saldo cuti akan tercatat di sini.');
  return `<div class="tw"><table><thead><tr><th>Tanggal</th>${withName ? '<th>Nama</th>' : ''}<th>Jenis</th><th>Perubahan</th><th>Saldo</th><th>Catatan</th></tr></thead><tbody>${list.map((h) => {
    const a = h.amount || 0, neg = (h.balanceAfter ?? 0) < 0;
    return `<tr class="${neg ? 'debt' : ''}" data-emp="${esc(h.employeeId)}"><td>${esc(fdt(h.ts))}</td>${withName ? `<td><b>${esc(h.employeeName)}</b></td>` : ''}<td>${esc(h.type)}</td>
      <td><span class="${a < 0 ? 'num-neg' : a > 0 ? 'num-pos' : ''}">${a > 0 ? '+' : ''}${a}</span></td><td>${h.balanceAfter ?? '-'}${neg ? ' <span class="badge b-debt">Hutang</span>' : ''}</td><td><span class="sub">${esc(h.note || '')}</span></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function reqQueueItem(r, emps) {
  const e = emps[r.employeeId], b = bal(e), ed = effDays(r), proj = L.projectBalance(b, ed, r.deduct), debt = r.deduct && proj < 0;
  const action = actOn(state.user, r);
  const yes = action === 'review' ? 'Teruskan' : 'Setujui';
  return `<div class="q-item ${debt ? 'debt' : ''}"><div class="q-main">
    <div class="who">${esc(r.employeeName)} <span class="badge b-role">${esc(roleLabel(r.employeeRole))}</span></div>
    <div class="meta">${esc(fd(r.startDate))} – ${esc(fd(r.endDate))} · ${ed} hari${ed !== r.days ? ` (diajukan ${r.days}, tanggal merah tidak dihitung)` : ''} · ${esc(r.reason)}</div>
    <div class="proj">${r.deduct ? `Saldo ${b} hari → <b class="${debt ? 'num-neg' : 'num-pos'}">${debt ? 'hutang ' + Math.abs(proj) : 'sisa ' + proj}</b>` : 'Tidak memotong saldo'}</div>
    ${r.reviewedBy ? `<div class="meta">Direview oleh ${esc(r.reviewedBy)} · ${esc(fdt(r.reviewedAt))}</div>` : ''}
    ${stepsHtml(r)}</div>
    ${action ? `<div class="q-act"><button class="btn btn-ok btn-sm" data-act="decide" data-kind="req" data-id="${esc(r.id)}" data-yes="1">${yes}</button><button class="btn btn-line btn-sm" data-act="decide" data-kind="req" data-id="${esc(r.id)}" data-yes="0">Tolak</button></div>` : ''}</div>`;
}
function adjQueueItem(a) {
  const t = a.adjustmentDays > 0 ? `+${a.adjustmentDays}` : `${a.adjustmentDays}`;
  return `<div class="q-item"><div class="q-main"><div class="who">${esc(a.employeeName)} · penyesuaian ${t} hari</div>
    <div class="meta">${esc(a.note)}</div><div class="meta">Diajukan oleh ${esc(a.requestedBy)} · ${esc(fdt(a.requestedAt))}</div></div>
    <div class="q-act"><button class="btn btn-ok btn-sm" data-act="decide" data-kind="adj" data-id="${esc(a.id)}" data-yes="1">Setujui</button><button class="btn btn-line btn-sm" data-act="decide" data-kind="adj" data-id="${esc(a.id)}" data-yes="0">Tolak</button></div></div>`;
}
function historyTable(list, emps) {
  if (!list.length) return emptyHtml('Belum ada riwayat');
  return `<div class="tw"><table><thead><tr><th>Nama</th><th>Periode</th><th>Hari</th><th>Jenis</th><th>Status</th><th>Diproses</th></tr></thead><tbody>${list.slice(0, 100).map((r) => `<tr>
    <td><b>${esc(r.employeeName)}</b></td><td>${esc(fd(r.startDate))} – ${esc(fd(r.endDate))}</td><td>${r.days}</td><td>${esc(r.reason)}${r.rejectNote ? `<div class="sub">Ditolak: ${esc(r.rejectNote)}</div>` : ''}</td>
    <td>${statusBadge(r.status)}</td><td><span class="sub">${esc([r.reviewedBy, r.decidedBy].filter(Boolean).join(' → ') || '-')}</span></td></tr>`).join('')}</tbody></table></div>`;
}
const exportBtn = (act, label = 'Unduh CSV') => `<button class="btn btn-line btn-sm" data-act="${act}">${label}</button>`;

// ---------- Halaman ----------
const pages = {};
const afterPage = {};

pages.dashboard = async () => {
  const u = state.user, emp = state.emp;
  let h = pageHead(`Halo, ${first(u.name)}`, 'Ringkasan cuti dan pengajuan Anda.', `<button class="btn btn-primary" data-act="go" data-route="apply">Ajukan cuti atau izin</button>`);
  h += emp ? balanceHero(emp) : banner('warn', 'Akun belum terhubung ke data karyawan.', 'Hubungi Staff HRD.');
  if (u.role === 'staff_hrd') {
    const n = (await listAll('requests')).filter((r) => actOn(u, r) === 'review').length;
    if (n) h += `<div class="banner info"><div><strong>${n} pengajuan menunggu review Anda</strong><button class="btn btn-line btn-sm" style="margin-top:8px" data-act="go" data-route="review">Buka antrian review</button></div></div>`;
  }
  if (u.role === 'kepala_hrd') {
    const [reqs, adjs, emps] = await Promise.all([listAll('requests'), listAll('adjustments'), getEmployees()]);
    const em = empMap(emps);
    const pr = reqs.filter((r) => actOn(u, r) === 'head').sort(byDateDesc('createdAt'));
    const pa = adjs.filter((a) => a.status === 'pending_head').sort(byDateDesc('requestedAt'));
    h += card(`Persetujuan cuti (${pr.length})`, pr.length ? pr.map((r) => reqQueueItem(r, em)).join('') : emptyHtml('Tidak ada yang menunggu', 'Semua pengajuan sudah diproses.'));
    h += card(`Persetujuan penyesuaian saldo (${pa.length})`, pa.length ? pa.map(adjQueueItem).join('') : emptyHtml('Tidak ada yang menunggu'));
    const done = reqs.filter((r) => !L.isPending(r.status)).sort(byDateDesc('decidedAt'));
    h += card('Riwayat persetujuan', historyTable(done, em), exportBtn('export-requests'));
  }
  const mine = await myRequests();
  h += card('Pengajuan saya', myReqTable(mine.slice(0, 8)));
  if (u.employeeId) {
    const led = (await listBy('ledger', 'employeeId', u.employeeId)).sort(byDateDesc('ts')).slice(0, 8);
    h += card('Mutasi saldo terakhir', ledgerTable(led));
  }
  return h;
};

pages.apply = async () => {
  const u = state.user, emp = state.emp;
  if (!emp) return pageHead('Ajukan cuti') + banner('warn', 'Akun belum terhubung ke data karyawan.', 'Hubungi Staff HRD.');
  const cats = ['Cuti', 'Sakit', 'Khusus', 'Izin', 'Lainnya'];
  const opts = cats.map((c) => `<optgroup label="${esc(c)}">${L.LEAVE_TYPES.filter((t) => t.category === c).map((t) => `<option value="${esc(t.id)}">${esc(t.id)}</option>`).join('')}</optgroup>`).join('');
  const flow = u.role === 'kepala_hrd' ? 'Anda → persetujuan Direktur' : u.role === 'staff_hrd' ? 'Anda → review Staff HRD lain → persetujuan Kepala HRD' : 'Anda → review Staff HRD → persetujuan Kepala HRD';
  const mine = await myRequests();
  let h = pageHead('Ajukan cuti atau izin', `Alur: ${flow}`);
  if (bal(emp) < 0) h += banner('danger', `Anda punya hutang cuti ${Math.abs(bal(emp))} hari.`, 'Cuti yang memotong saldo akan menambah hutang.');
  if (!L.isEligible(emp.joinDate)) h += banner('info', 'Masa kerja Anda belum genap 1 tahun.', 'Cuti tahunan yang diajukan sekarang akan tercatat sebagai hutang.');
  h += banner('info', '', `${L.lockMessage(new Date(), state.settings.lockDay)} Sisa cuti Anda saat ini ${bal(emp)} hari.`);
  h += `<section class="card"><form data-submit="leave" novalidate>
    <div class="field"><label for="lvType">Jenis</label><select id="lvType" data-input="calc"><option value="">Pilih jenis cuti atau izin</option>${opts}</select><div class="hint" id="lvTypeHint"></div></div>
    <div class="row2"><div class="field"><label for="lvStart">Mulai</label><input type="date" id="lvStart" data-input="calc"></div>
    <div class="field"><label for="lvEnd">Selesai</label><input type="date" id="lvEnd" data-input="calc"></div></div>
    <div class="field"><label for="lvDetail" id="lvDetailLabel">Keterangan (opsional)</label><textarea id="lvDetail" data-input="calc" maxlength="300"></textarea></div>
    <div class="calc" id="lvCalc" hidden></div>
    <button class="btn btn-primary" id="lvBtn" type="submit">Kirim pengajuan</button></form></section>`;
  h += card('Riwayat pengajuan saya', myReqTable(mine));
  return h;
};

function updateCalc() {
  const s = $('#lvStart').value, e = $('#lvEnd').value, type = $('#lvType').value, box = $('#lvCalc');
  const t = L.leaveTypeById(type);
  $('#lvTypeHint').textContent = t ? (t.deduct ? 'Memotong saldo cuti tahunan.' : 'Tidak memotong saldo cuti tahunan.') : '';
  $('#lvDetailLabel').textContent = t && t.needsDetail ? 'Keterangan (wajib)' : 'Keterangan (opsional)';
  if (!s || !e || L.validateRange(s, e) || !t) { box.hidden = true; return; }
  const co = { excludeWeekends: state.settings.excludeWeekends, holidays: state.holidays };
  const days = C.countLeaveDays(s, e, co), freed = C.holidayDaysIn(s, e, co);
  const b = bal(state.emp), proj = L.projectBalance(b, days, t.deduct), debt = proj < 0;
  box.hidden = false; box.className = 'calc' + (debt ? ' debt' : '');
  if (!days) { box.innerHTML = '<div class="r"><span>Rentang ini hanya berisi akhir pekan atau tanggal merah, tidak ada hari yang dihitung.</span></div>'; return; }
  box.innerHTML = `<div class="r"><span>Durasi</span><b>${days} hari${state.settings.excludeWeekends ? ' kerja' : ''}</b></div>
    ${freed ? `<div class="r"><span>Tanggal merah (tidak dipotong)</span><b>${freed} hari</b></div>` : ''}
    <div class="r"><span>Saldo sekarang</span><b>${b} hari</b></div>
    <div class="r t"><span>Saldo setelah disetujui</span><b class="${debt ? 'num-neg' : ''}">${proj} hari${debt ? ' (hutang)' : ''}</b></div>`;
}

async function submitLeave() {
  const u = state.user, emp = state.emp;
  const s = $('#lvStart').value, e = $('#lvEnd').value, type = $('#lvType').value, detail = $('#lvDetail').value.trim();
  const t = L.leaveTypeById(type);
  if (!t) return toast('Pilih jenis cuti atau izin.', 'err');
  const ve = L.validateRange(s, e); if (ve) return toast(ve, 'err');
  if (t.needsDetail && detail.length < 5) return toast('Keterangan wajib diisi (minimal 5 karakter).', 'err');
  if (L.isDateLocked(s, new Date(), state.settings.lockDay)) return toast(L.lockMessage(new Date(), state.settings.lockDay), 'err');
  await loadHolidays();
  const days = C.countLeaveDays(s, e, { excludeWeekends: state.settings.excludeWeekends, holidays: state.holidays });
  if (days < 1) return toast('Rentang hanya berisi akhir pekan atau tanggal merah.', 'err');
  const status = L.initialStatus(u.role); if (!status) return toast('Role Anda tidak bisa mengajukan cuti.', 'err');
  const mine = await myRequests();
  const clash = mine.find((r) => r.status !== 'rejected' && L.rangesOverlap(s, e, r.startDate, r.endDate));
  if (clash) return toast(`Tanggal bertabrakan dengan pengajuan ${fd(clash.startDate)} – ${fd(clash.endDate)}.`, 'err');
  if (t.deduct && bal(emp) - days < 0) {
    const ok = await confirmBox('Saldo tidak cukup', `Saldo ${bal(emp)} hari, cuti ${days} hari. Selisih ${Math.abs(bal(emp) - days)} hari akan menjadi hutang dan dipotong dari jatah tahun berikutnya. Lanjutkan?`, 'Ajukan tetap', true);
    if (!ok) return;
  }
  const btn = $('#lvBtn'); btn.disabled = true;
  try {
    await F.addDoc(F.collection(db, 'requests'), {
      employeeId: emp.id, employeeName: emp.name, employeeRole: u.role,
      reasonType: type, reasonDetail: detail, reason: t.needsDetail ? `Lainnya: ${detail}` : detail ? `${type} — ${detail}` : type,
      startDate: s, endDate: e, days, deduct: t.deduct, excludeWeekends: !!state.settings.excludeWeekends, companyId: emp.companyId, status, createdAt: new Date().toISOString(),
    });
    bust(); toast('Pengajuan terkirim.', 'ok'); go('apply');
  } catch (err) { toast(errMsg(err), 'err'); btn.disabled = false; }
}

pages.review = async () => {
  const u = state.user;
  const [reqs, emps] = await Promise.all([listAll('requests'), getEmployees()]);
  const em = empMap(emps);
  const pend = reqs.filter((r) => actOn(u, r) === 'review').sort(byDateDesc('createdAt'));
  const done = reqs.filter((r) => r.status !== 'pending_review').sort(byDateDesc('createdAt'));
  return pageHead('Review pengajuan', 'Siapa pun Staff HRD yang memproses lebih dulu yang tercatat. Ajuan Anda sendiri tidak muncul di sini.')
    + card(`Menunggu review (${pend.length})`, pend.length ? pend.map((r) => reqQueueItem(r, em)).join('') : emptyHtml('Tidak ada pengajuan', 'Antrian review kosong.'))
    + card('Riwayat', historyTable(done, em), exportBtn('export-requests'));
};

pages.approval = async () => {
  const u = state.user;
  const [reqs, emps] = await Promise.all([listAll('requests'), getEmployees()]);
  const em = empMap(emps);
  const pend = reqs.filter((r) => actOn(u, r) === 'director').sort(byDateDesc('createdAt'));
  const done = reqs.filter((r) => r.employeeRole === 'kepala_hrd' && !L.isPending(r.status)).sort(byDateDesc('decidedAt'));
  return pageHead('Persetujuan Direktur', 'Alur: Kepala HRD → Direktur (satu langkah).')
    + card(`Menunggu persetujuan (${pend.length})`, pend.length ? pend.map((r) => reqQueueItem(r, em)).join('') : emptyHtml('Tidak ada pengajuan', 'Semua sudah diproses.'))
    + card('Riwayat keputusan', historyTable(done, em), exportBtn('export-requests'));
};

async function processRequest(id, approve, note) {
  const rref = F.doc(db, 'requests', id), cref = F.doc(db, 'calendar', 'holidays');
  return F.runTransaction(db, async (tx) => {
    const rs = await tx.get(rref);
    if (!rs.exists()) throw new Error('Pengajuan tidak ditemukan.');
    const req = { id: rs.id, ...rs.data() };
    const action = actOn(state.user, req);
    if (!action) throw new Error('Pengajuan ini sudah diproses atau bukan wewenang Anda.');
    const now = new Date().toISOString();
    const patch = L.decisionPatch(action, approve, state.user, now, note);
    let eref = null, emp = null, days = req.days, freed = 0;
    if (patch.status === 'approved') {
      // Hitung ulang dengan tanggal merah yang berlaku saat ini: tanggal merah tidak memotong jatah cuti.
      const cs = await tx.get(cref);
      const holidays = cs.exists() ? cs.data().ranges || [] : [];
      const ew = typeof req.excludeWeekends === 'boolean' ? req.excludeWeekends : !!state.settings.excludeWeekends;
      days = C.countLeaveDays(req.startDate, req.endDate, { excludeWeekends: ew, holidays });
      freed = Math.max(0, req.days - days);
      if (days !== req.days) { patch.days = days; patch.daysSubmitted = req.days; }
      if (req.deduct && days > 0) {
        eref = F.doc(db, 'employees', req.employeeId);
        const es = await tx.get(eref);
        if (!es.exists()) throw new Error('Data karyawan tidak ditemukan.');
        emp = es.data();
      }
    }
    tx.update(rref, patch);
    if (eref) {
      const nb = bal(emp) - days;
      tx.update(eref, { leaveBalance: nb });
      tx.set(F.doc(F.collection(db, 'ledger')), {
        employeeId: req.employeeId, employeeName: req.employeeName, companyId: req.companyId, ts: now, type: 'Cuti disetujui', amount: -days, balanceAfter: nb,
        note: `${req.reason} · ${fd(req.startDate)} – ${fd(req.endDate)}${freed ? ` · ${freed} hari tanggal merah tidak dipotong` : ''} · disetujui ${state.user.name}${nb < 0 ? ' · hutang' : ''}`, by: state.user.name,
      });
    }
    return patch.status;
  });
}

async function processAdjustment(id, approve) {
  const aref = F.doc(db, 'adjustments', id);
  return F.runTransaction(db, async (tx) => {
    const as = await tx.get(aref);
    if (!as.exists()) throw new Error('Penyesuaian tidak ditemukan.');
    const a = as.data();
    if (a.status !== 'pending_head' || state.user.role !== 'kepala_hrd' || !C.inAccess(state.user, a.companyId, state.companies)) throw new Error('Penyesuaian ini sudah diproses atau bukan wewenang Anda.');
    const now = new Date().toISOString();
    const who = { decidedBy: state.user.name, decidedByUid: state.user.uid, decidedAt: now };
    if (!approve) { tx.update(aref, { status: 'rejected', ...who }); return; }
    const eref = F.doc(db, 'employees', a.employeeId);
    const es = await tx.get(eref);
    if (!es.exists()) throw new Error('Data karyawan tidak ditemukan.');
    const nb = bal(es.data()) + a.adjustmentDays;
    tx.update(eref, { leaveBalance: nb });
    tx.update(aref, { status: 'approved', ...who });
    tx.set(F.doc(F.collection(db, 'ledger')), {
      employeeId: a.employeeId, employeeName: a.employeeName, companyId: a.companyId, ts: now, type: 'Penyesuaian saldo', amount: a.adjustmentDays, balanceAfter: nb,
      note: `${a.note} · diajukan ${a.requestedBy}, disetujui ${state.user.name}${nb < 0 ? ' · hutang' : ''}`, by: state.user.name,
    });
  });
}

async function decide(el) {
  const { kind, id } = el.dataset, approve = el.dataset.yes === '1';
  let note = '';
  if (!approve) {
    const n = await dialog({
      title: kind === 'adj' ? 'Tolak penyesuaian' : 'Tolak pengajuan',
      body: kind === 'adj' ? '<p>Penyesuaian ini tidak akan mengubah saldo.</p>' : '<div class="field"><label for="dNote">Alasan penolakan</label><textarea id="dNote" maxlength="300"></textarea><div class="hint">Alasan akan terlihat oleh pengaju.</div></div>',
      okLabel: 'Tolak', danger: true,
      validate: () => (kind !== 'adj' && !$('#dNote').value.trim() ? 'Isi alasan penolakan.' : ''),
      getValue: () => (kind === 'adj' ? '' : $('#dNote').value.trim()),
    });
    if (n === null) return;
    note = n;
  } else {
    const r = kind === 'adj' ? null : (await listAll('requests')).find((x) => x.id === id);
    const act = r ? actOn(state.user, r) : 'head';
    if (act !== 'review') {
      const ok = await confirmBox('Setujui?', kind === 'adj' ? 'Saldo karyawan akan disesuaikan.' : r && r.deduct ? `Saldo ${esc(r.employeeName)} akan dipotong ${effDays(r)} hari.` : 'Pengajuan ini tidak memotong saldo.', 'Setujui');
      if (!ok) return;
    }
  }
  el.disabled = true;
  try {
    if (kind === 'adj') await processAdjustment(id, approve);
    else await processRequest(id, approve, note);
    bust(); toast(approve ? 'Tersimpan.' : 'Pengajuan ditolak.', 'ok');
    await refreshEmp(); go(state.route);
  } catch (e) { toast(errMsg(e), 'err'); el.disabled = false; bust(); }
}

pages.adjust = async () => {
  const [emps, adjs] = await Promise.all([getEmployees(), listAll('adjustments')]);
  const mine = adjs.filter((a) => a.requesterEmployeeId === state.user.employeeId).sort(byDateDesc('requestedAt')).slice(0, 10);
  const rows = emps.map((e) => `<tr class="${bal(e) < 0 ? 'debt' : ''}"><td>${esc(e.id)}</td><td><b>${esc(e.name)}</b></td><td>${bal(e)} hari ${bal(e) < 0 ? '<span class="badge b-debt">Hutang</span>' : ''}</td>
    <td>${e.id === state.user.employeeId ? '<span class="sub">Tidak bisa untuk diri sendiri</span>' : `<button class="btn btn-line btn-sm" data-act="adj-open" data-id="${esc(e.id)}">Ajukan penyesuaian</button>`}</td></tr>`).join('');
  return pageHead('Penyesuaian saldo', 'Setiap penyesuaian harus disetujui Kepala HRD.')
    + card('Karyawan', `<div class="tw"><table><thead><tr><th>ID</th><th>Nama</th><th>Saldo</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`)
    + card('Pengajuan penyesuaian saya', mine.length ? `<div class="tw"><table><thead><tr><th>Karyawan</th><th>Perubahan</th><th>Catatan</th><th>Status</th></tr></thead><tbody>${mine.map((a) => `<tr><td>${esc(a.employeeName)}</td><td>${a.adjustmentDays > 0 ? '+' : ''}${a.adjustmentDays}</td><td>${esc(a.note)}</td><td>${statusBadge(a.status)}</td></tr>`).join('')}</tbody></table></div>` : emptyHtml('Belum ada pengajuan'));
};

async function openAdjust(id) {
  const e = (await getEmployees()).find((x) => x.id === id); if (!e) return;
  await dialog({
    title: `Penyesuaian saldo — ${e.name}`,
    body: `<p style="margin-bottom:12px">Saldo saat ini <b>${bal(e)} hari</b>.</p>
      <div class="field"><label for="adjDays">Jumlah hari</label><input type="number" id="adjDays" step="1" placeholder="Contoh: 2 atau -2"><div class="hint">Negatif untuk mengurangi.</div></div>
      <div class="field"><label for="adjNote">Alasan</label><textarea id="adjNote" maxlength="300"></textarea></div>`,
    okLabel: 'Kirim ke Kepala HRD',
    validate: () => L.validateAdjustment(parseInt($('#adjDays').value, 10), state.user.employeeId, id) || (!$('#adjNote').value.trim() ? 'Isi alasan penyesuaian.' : ''),
    getValue: () => ({ days: parseInt($('#adjDays').value, 10), note: $('#adjNote').value.trim() }),
    onSubmit: async (v) => {
      await F.addDoc(F.collection(db, 'adjustments'), {
        employeeId: e.id, employeeName: e.name, companyId: e.companyId, currentBalance: bal(e), adjustmentDays: v.days, note: v.note, status: 'pending_head',
        requestedBy: state.user.name, requesterEmployeeId: state.user.employeeId, requestedAt: new Date().toISOString(),
      });
      bust(); toast('Penyesuaian dikirim.', 'ok');
    },
  }).then((v) => { if (v) go('adjust'); });
}

// ---------- Karyawan ----------
pages.employees = async () => {
  const u = state.user;
  const [emps, users] = await Promise.all([getEmployees(), listAll('users')]);
  const um = Object.fromEntries(users.filter((x) => x.employeeId).map((x) => [x.employeeId, x]));
  const manage = u.role === 'staff_hrd' || u.role === 'superuser', canAccess = C.canGrantAccess(u.role);
  const rows = emps.map((e) => {
    const usr = um[e.id], debt = bal(e) < 0, canRole = manage && usr && usr.role !== 'superuser' && usr.employeeId !== u.employeeId;
    return `<tr class="${debt ? 'debt' : ''}" data-q="${esc((e.name + ' ' + e.id).toLowerCase())}"><td>${esc(e.id)}</td>
      <td><div style="display:flex;gap:10px;align-items:center">${avatar(usr, 'sm')}<div><b>${esc(e.name)}</b><div class="sub">${esc(usr ? roleLabel(usr.role) : '-')}</div></div></div></td>
      <td>${coChips(usr, e)}</td><td>${esc(fd(e.joinDate))}</td><td><b class="${debt ? 'num-neg' : ''}">${bal(e)}</b> hari ${debt ? '<span class="badge b-debt">Hutang</span>' : ''}</td>
      <td><div class="btn-row"><button class="btn btn-line btn-sm" data-act="emp-detail" data-id="${esc(e.id)}">Detail</button>
      ${canAccess && usr && usr.role !== 'superuser' && usr.id !== u.uid ? `<button class="btn btn-line btn-sm" data-act="acc-access" data-uid="${esc(usr.id)}">Akses PT</button>` : ''}
      ${canRole ? `<button class="btn btn-line btn-sm" data-act="emp-role" data-id="${esc(e.id)}">Ubah role</button>` : ''}
      ${manage && usr && usr.role !== 'superuser' && usr.employeeId !== u.employeeId ? `<button class="btn btn-ghost btn-sm" data-act="emp-del" data-id="${esc(e.id)}">Hapus</button>` : ''}</div></td></tr>`;
  }).join('');
  return pageHead('Karyawan', `${emps.length} karyawan terdaftar.`, u.role === 'staff_hrd' ? '<button class="btn btn-primary" data-act="add-staff">Tambah karyawan</button>' : '')
    + `<section class="card"><div class="toolbar"><input type="text" id="empSearch" data-input="search" data-target="#empBody" data-counter="#empCount" placeholder="Cari nama atau ID" aria-label="Cari karyawan"><span class="count" id="empCount">${emps.length} karyawan</span></div>
    <div class="tw"><table><thead><tr><th>ID</th><th>Nama</th><th>PT</th><th>Bergabung</th><th>Saldo cuti</th><th></th></tr></thead><tbody id="empBody">${rows || ''}</tbody></table></div></section>`;
};

async function empDetail(id) {
  const [emps, users, led] = await Promise.all([getEmployees(), listAll('users'), listAll('ledger').then((l) => l.filter((x) => x.employeeId === id))]);
  const e = emps.find((x) => x.id === id); if (!e) return;
  const usr = users.find((x) => x.employeeId === id);
  await dialog({
    title: e.name, cancelLabel: '', okLabel: 'Tutup',
    body: `<div class="grid" style="margin-bottom:14px"><div><span class="sub">ID</span><br>${esc(e.id)}</div><div><span class="sub">Role</span><br>${esc(usr ? roleLabel(usr.role) : '-')}</div>
      <div><span class="sub">PT</span><br>${coChips(usr, e)}</div><div><span class="sub">Bergabung</span><br>${esc(fd(e.joinDate))} (${L.completedYears(e.joinDate)} tahun)</div><div><span class="sub">Saldo</span><br><b class="${bal(e) < 0 ? 'num-neg' : ''}">${bal(e)} hari</b></div></div>
      <h3 style="font-size:16px;margin-bottom:8px">Mutasi saldo</h3>${ledgerTable(led.sort(byDateDesc('ts')).slice(0, 15))}`,
  });
}

function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint32Array(10);
  crypto.getRandomValues(a);
  return [...a].map((n) => chars[n % chars.length]).join('');
}

// Nomor karyawan unik lintas PT. Memakai penghitung agar Staff HRD tidak perlu membaca karyawan PT lain.
async function allocEmployeeId() {
  return F.runTransaction(db, async (tx) => {
    const ref = F.doc(db, 'counters', 'employee');
    const s = await tx.get(ref);
    const n = (s.exists() ? s.data().last || 0 : 0) + 1;
    tx.set(ref, { last: n });
    return 'E' + String(n).padStart(3, '0');
  });
}

async function createAccount({ name, username, role, joinDate, password, companyId, companyIds }) {
  if (!state.companies.some((c) => c.id === companyId) || !access().includes(companyId)) throw new Error('PT tidak valid atau di luar akses Anda.');
  if ((await F.getDoc(F.doc(db, 'usernames', username))).exists()) throw new Error('Username sudah dipakai.');
  const nid = await allocEmployeeId();
  let email = L.loginIdToEmail(username), uid;
  try { uid = await F.createAuthUser(email, password); } catch (e) {
    if (e.code !== 'auth/email-already-in-use') throw e; // login lama (karyawan yang sudah dihapus) masih tercatat di Firebase Auth
    email = `${username}.${Math.random().toString(36).slice(2, 7)}@${L.LOGIN_DOMAIN}`;
    uid = await F.createAuthUser(email, password);
  }
  const now = new Date().toISOString(), done = L.completedYears(joinDate), quota = state.settings.annualQuota;
  const b = F.writeBatch(db);
  b.set(F.doc(db, 'users', uid), { username, name, role, employeeId: nid, email, companyId, companyIds, createdAt: now });
  b.set(F.doc(db, 'usernames', username), { email, uid });
  b.set(F.doc(db, 'employees', nid), { name, joinDate, companyId, leaveBalance: done >= 1 ? quota : 0, renewedYears: done, createdAt: now });
  if (done >= 1) b.set(F.doc(F.collection(db, 'ledger')), { employeeId: nid, employeeName: name, companyId, ts: now, type: 'Saldo awal', amount: quota, balanceAfter: quota, note: `Jatah tahun berjalan (masa kerja ${done} tahun)`, by: state.user.name });
  await b.commit();
  bust();
  return { nid, email };
}

async function accountForm({ roles, title }) {
  const myCos = state.companies.filter((c) => c.active !== false && access().includes(c.id));
  if (!myCos.length) { await info('Belum ada PT', '<p>Tambahkan PT lebih dulu di menu Perusahaan, lalu buat akunnya.</p>'); return false; }
  const grantable = C.grantableIds(state.user, state.companies);
  const opts = roles.map((r) => `<option value="${r}">${esc(roleLabel(r))}</option>`).join('');
  const coOpts = myCos.map((c) => `<option value="${esc(c.id)}"${state.scope === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
  const extra = grantable.length > 1
    ? `<div class="field"><label>Boleh melihat PT lain (opsional)</label><div class="checks" id="acExtra">${state.companies.filter((c) => grantable.includes(c.id)).map((c) => `<label class="check"><input type="checkbox" value="${esc(c.id)}"> ${esc(c.name)}</label>`).join('')}</div><div class="hint">Akun ini juga bisa melihat karyawan di PT yang dicentang, selain PT utamanya.</div></div>`
    : '';
  const pw = randomPassword();
  const v = await dialog({
    title,
    body: `<div class="field"><label for="acName">Nama lengkap</label><input type="text" id="acName"></div>
      <div class="field"><label for="acUser">Username</label><input type="text" id="acUser" autocapitalize="none"></div>
      <div class="field"><label for="acCompany">PT</label><select id="acCompany">${coOpts}</select></div>
      <div class="row2"><div class="field"><label for="acRole">Role</label><select id="acRole">${opts}</select></div>
      <div class="field"><label for="acJoin">Tanggal bergabung</label><input type="date" id="acJoin"></div></div>
      ${extra}
      <div class="field"><label for="acPass">Password awal</label><input type="text" id="acPass" value="${pw}"><div class="hint">Berikan ke karyawan, lalu sarankan segera menggantinya di menu Profil.</div></div>`,
    okLabel: 'Buat akun',
    validate: () => {
      if (!$('#acName').value.trim()) return 'Isi nama lengkap.';
      const ue = L.validateUsername(L.normalizeUsername($('#acUser').value)); if (ue) return ue;
      if (!$('#acCompany').value) return 'Pilih PT.';
      if (!L.parseDate($('#acJoin').value)) return 'Isi tanggal bergabung.';
      if ($('#acPass').value.length < 6) return 'Password minimal 6 karakter.';
      return '';
    },
    getValue: () => {
      const home = $('#acCompany').value, chosen = $$('#acExtra input:checked').map((i) => i.value);
      return { name: $('#acName').value.trim(), username: L.normalizeUsername($('#acUser').value), role: $('#acRole').value, joinDate: $('#acJoin').value, password: $('#acPass').value,
        companyId: home, companyIds: C.nextAccessList({ home, current: [home], chosen, grantable }) };
    },
    onSubmit: createAccount,
  });
  if (!v) return false;
  await info('Akun dibuat', `<p>Catat dan berikan kepada karyawan:</p><p style="margin-top:10px">Username: <code>${esc(v.username)}</code><br>Password: <code>${esc(v.password)}</code><br>PT: <b>${esc(coName(v.companyId))}</b></p>`);
  return true;
}

// Mengatur PT tambahan yang boleh dilihat sebuah akun. Hanya owner, Direktur, dan Komisaris; dan hanya di antara PT milik pengatur sendiri.
async function accessForm(uid) {
  const grantable = C.grantableIds(state.user, state.companies);
  if (!grantable.length) return toast('Hanya owner, Direktur, dan Komisaris yang bisa mengatur akses PT.', 'err');
  const t = (await listAll('users')).find((x) => x.id === uid);
  if (!t || t.role === 'superuser') return;
  const cur = C.uniq([t.companyId, ...(t.companyIds || [])]);
  const list = state.companies.filter((c) => grantable.includes(c.id) || c.id === t.companyId);
  const v = await dialog({
    title: `Akses PT — ${t.name}`,
    body: `<p style="margin-bottom:12px">PT utama <b>${esc(coName(t.companyId))}</b> selalu bisa diakses. Centang PT lain yang boleh dilihat akun ini.</p>
      <div class="checks" id="axList">${list.map((c) => `<label class="check"><input type="checkbox" value="${esc(c.id)}" ${cur.includes(c.id) ? 'checked' : ''} ${c.id === t.companyId ? 'disabled' : ''}> ${esc(c.name)}</label>`).join('')}</div>
      <div class="hint" style="margin-top:10px">Berlaku saat akun ini login berikutnya.</div>`,
    okLabel: 'Simpan akses',
    getValue: () => $$('#axList input:checked:not(:disabled)').map((i) => i.value),
    onSubmit: async (chosen) => {
      const next = C.nextAccessList({ home: t.companyId, current: cur, chosen, grantable });
      await F.updateDoc(F.doc(db, 'users', uid), { companyIds: next });
      bust();
    },
  });
  if (v) { toast('Akses PT diperbarui.', 'ok'); go(state.route); }
}

async function changeRole(id) {
  const [emps, users] = await Promise.all([getEmployees(), listAll('users')]);
  const e = emps.find((x) => x.id === id), usr = users.find((x) => x.employeeId === id);
  if (!e || !usr) return;
  const roles = Object.keys(L.ROLES).filter((r) => r !== 'superuser');
  const allowed = state.user.role === 'superuser' ? roles : L.HRD_CREATABLE_ROLES;
  const v = await dialog({
    title: `Ubah role — ${e.name}`,
    body: `<p style="margin-bottom:12px">Role sekarang: <b>${esc(roleLabel(usr.role))}</b>. Perubahan langsung berlaku di login berikutnya.</p>
      <div class="field"><label for="erRole">Role baru</label><select id="erRole">${allowed.map((r) => `<option value="${r}" ${r === usr.role ? 'selected' : ''}>${esc(roleLabel(r))}</option>`).join('')}</select></div>
      ${state.user.role === 'staff_hrd' ? '<div class="hint">Staff HRD hanya dapat memilih Staff Biasa atau Staff HRD. Role lain lewat Superuser.</div>' : ''}`,
    validate: () => ($('#erRole').value === usr.role ? 'Role tidak berubah.' : ''),
    getValue: () => $('#erRole').value,
    onSubmit: async (r) => { await F.updateDoc(F.doc(db, 'users', usr.id), { role: r }); bust(); },
  });
  if (v) { toast('Role diperbarui.', 'ok'); go(state.route); }
}

async function deleteEmployee(id) {
  const [emps, users] = await Promise.all([getEmployees(), listAll('users')]);
  const e = emps.find((x) => x.id === id), usr = users.find((x) => x.employeeId === id);
  if (!e) return;
  const ok = await confirmBox(`Hapus ${e.name}?`, 'Data karyawan, akun, dan mutasi saldo akan dihapus permanen. Riwayat pengajuan tetap tersimpan.', 'Hapus', true);
  if (!ok) return;
  try {
    const led = (await fetchRaw('ledger')).filter((x) => x.employeeId === id);
    const b = F.writeBatch(db);
    led.forEach((x) => b.delete(F.doc(db, 'ledger', x.id)));
    if (usr) { b.delete(F.doc(db, 'users', usr.id)); if (usr.username) b.delete(F.doc(db, 'usernames', usr.username)); }
    b.delete(F.doc(db, 'employees', id));
    await b.commit();
    bust(); toast('Karyawan dihapus.', 'ok'); go(state.route);
  } catch (err) { toast(errMsg(err), 'err'); }
}

// ---------- Mutasi ----------
pages.mutations = async () => {
  const led = (await listAll('ledger')).slice().sort(byDateDesc('ts'));
  const names = [...new Map(led.map((h) => [h.employeeId, h.employeeName])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'id'));
  return pageHead('Mutasi cuti', 'Seluruh perubahan saldo, terbaru di atas.', exportBtn('export-ledger'))
    + `<section class="card"><div class="toolbar"><select id="ledFilter" data-input="ledger-filter" aria-label="Filter karyawan"><option value="">Semua karyawan</option>${names.map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join('')}</select></div>${ledgerTable(led.slice(0, 500), true)}</section>`;
};

// ---------- Laporan ----------
function bars(items, cls = '') {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return emptyHtml('Belum ada data');
  return `<div class="bars">${items.map((i) => `<div class="bar ${i.cls || cls}"><span>${esc(i.label)}</span><span class="t"><i style="width:${(i.value / max) * 100}%"></i></span><span class="n">${i.value}</span></div>`).join('')}</div>`;
}
pages.report = async () => {
  const now = new Date(), months = [];
  for (let i = 0; i < 12; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ v: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, y: d.getFullYear(), m: d.getMonth() }); }
  if (!months.some((m) => m.v === state.reportMonth)) state.reportMonth = months[0].v;
  const sel = months.find((m) => m.v === state.reportMonth);
  const [emps, reqs, adjs] = await Promise.all([getEmployees(), listAll('requests'), listAll('adjustments')]);
  const r = L.buildReport(emps, reqs, adjs, sel.y, sel.m);
  const label = `${L.monthName(sel.m)} ${sel.y}`;
  return `<div class="print-only"><h2>Laporan cuti — ${esc(label)}</h2></div>`
    + pageHead('Laporan bulanan', label, `<button class="btn btn-line btn-sm no-print" data-act="report-print">Cetak</button>`)
    + `<div class="toolbar no-print"><select id="repMonth" data-input="report-month" aria-label="Pilih bulan">${months.map((m) => `<option value="${m.v}" ${m.v === sel.v ? 'selected' : ''}>${L.monthName(m.m)} ${m.y}</option>`).join('')}</select></div>`
    + `<div class="grid cols3" style="margin-bottom:18px">
      <div class="stat"><div class="k">Karyawan</div><div class="v">${r.employees}</div></div>
      <div class="stat"><div class="k">Pengajuan</div><div class="v">${r.requests}</div><div class="s">${r.approved} disetujui · ${r.rejected} ditolak · ${r.pending} menunggu</div></div>
      <div class="stat"><div class="k">Tingkat persetujuan</div><div class="v">${r.approvalRate}%</div></div>
      <div class="stat"><div class="k">Total hari disetujui</div><div class="v">${r.totalDays}</div><div class="s">rata-rata ${r.avgDays} hari / karyawan</div></div>
      <div class="stat"><div class="k">Total saldo</div><div class="v">${r.totalBalance}</div><div class="s">rata-rata ${r.avgBalance} hari</div></div>
      <div class="stat ${r.debtors.length ? 'warn' : ''}"><div class="k">Karyawan berhutang cuti</div><div class="v">${r.debtors.length}</div></div></div>`
    + `<div class="grid cols2">${card('Cuti terbanyak (hari)', bars(r.top.map((t) => ({ label: t.name, value: t.days }))))}
      ${card('Jenis cuti disetujui', bars(Object.entries(r.byReason).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))))}
      ${card('Sebaran saldo', bars([{ label: 'Positif', value: r.balance.positive, cls: 'sage' }, { label: 'Nol', value: r.balance.zero, cls: 'gray' }, { label: 'Hutang', value: r.balance.negative, cls: 'rose' }]))}
      ${card('Penyesuaian saldo', `<p>${r.adjustments} diajukan, ${r.adjustmentsApproved} disetujui.</p>`)}</div>`
    + (r.debtors.length ? card('Daftar hutang cuti', `<div class="tw"><table><thead><tr><th>ID</th><th>Nama</th><th>Hutang</th></tr></thead><tbody>${r.debtors.map((d) => `<tr class="debt"><td>${esc(d.id)}</td><td><b>${esc(d.name)}</b></td><td><span class="badge b-debt">${d.debt} hari</span></td></tr>`).join('')}</tbody></table></div>`) : '');
};

// ---------- Pengaturan ----------
pages.settings = async () => {
  const s = state.settings;
  return pageHead('Pengaturan cuti', 'Berlaku untuk seluruh karyawan.')
    + `<section class="card"><form data-submit="settings" novalidate>
      <div class="row2"><div class="field"><label for="stQuota">Jatah cuti tahunan (hari)</label><input type="number" id="stQuota" min="1" max="60" value="${s.annualQuota}"><div class="hint">Diberikan setiap karyawan genap 1, 2, 3, … tahun masa kerja.</div></div>
      <div class="field"><label for="stCarry">Maksimal sisa cuti dibawa (hari)</label><input type="number" id="stCarry" min="0" max="60" value="${s.maxCarryOver}"><div class="hint">0 = sisa cuti hangus saat pembaruan. Hutang selalu dipotong dari jatah baru.</div></div></div>
      <div class="row2"><div class="field"><label for="stLock">Kunci bulan lalu setelah tanggal</label><input type="number" id="stLock" min="1" max="28" value="${s.lockDay}"></div>
      <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" id="stWeekend" ${s.excludeWeekends ? 'checked' : ''}> Sabtu dan Minggu tidak dihitung sebagai hari cuti</label></div></div>
      <button class="btn btn-primary" type="submit">Simpan pengaturan</button></form></section>`
    + card('Pembaruan cuti tahunan', `<p style="margin-bottom:12px">Pembaruan berjalan otomatis saat Staff HRD, Kepala HRD, atau Superuser membuka portal. Anda juga bisa menjalankannya sekarang.</p><button class="btn btn-line" data-act="run-renewal">Jalankan pembaruan sekarang</button>`);
};

async function saveSettings() {
  const q = parseInt($('#stQuota').value, 10), c = parseInt($('#stCarry').value, 10), l = parseInt($('#stLock').value, 10);
  if (!(q >= 1 && q <= 60)) return toast('Jatah cuti harus 1–60 hari.', 'err');
  if (!(c >= 0 && c <= 60)) return toast('Batas sisa cuti harus 0–60 hari.', 'err');
  if (!(l >= 1 && l <= 28)) return toast('Tanggal kunci harus 1–28.', 'err');
  const next = { annualQuota: q, maxCarryOver: c, lockDay: l, excludeWeekends: $('#stWeekend').checked };
  try { await F.setDoc(F.doc(db, 'settings', 'leave'), next); state.settings = { ...L.DEFAULT_SETTINGS, ...next }; toast('Pengaturan disimpan.', 'ok'); }
  catch (e) { toast(errMsg(e), 'err'); }
}

// ---------- Akun (Superuser) ----------
pages.accounts = async () => {
  const users = (await listAll('users')).slice().sort((a, b) => a.name.localeCompare(b.name, 'id'));
  const rows = users.map((x) => `<tr data-q="${esc((x.name + ' ' + x.username).toLowerCase())}"><td><div style="display:flex;gap:10px;align-items:center">${avatar(x, 'sm')}<b>${esc(x.name)}</b></div></td>
    <td><code>${esc(x.username)}</code></td><td><span class="badge b-role">${esc(roleLabel(x.role))}</span></td><td>${x.role === 'superuser' ? '<span class="sub">Semua PT</span>' : coChips(x)}</td>
    <td>${x.id === state.user.uid ? '<span class="sub">Akun Anda</span>' : `<div class="btn-row">${x.role !== 'superuser' ? `<button class="btn btn-line btn-sm" data-act="acc-access" data-uid="${esc(x.id)}">Akses PT</button>` : ''}<button class="btn btn-line btn-sm" data-act="acc-reset" data-id="${esc(x.id)}">Reset password</button>${x.role !== 'superuser' ? `<button class="btn btn-ghost btn-sm" data-act="acc-del" data-id="${esc(x.id)}">Hapus</button>` : ''}</div>`}</td></tr>`).join('');
  return pageHead('Akun', 'Password disimpan aman oleh Firebase Authentication dan tidak bisa dilihat siapa pun.', '<button class="btn btn-primary" data-act="acc-add">Tambah akun</button>')
    + `<section class="card"><div class="toolbar"><input type="text" id="accSearch" data-input="search" data-target="#accBody" data-counter="#accCount" placeholder="Cari nama atau username" aria-label="Cari akun"><span class="count" id="accCount">${users.length} akun</span></div>
    <div class="tw"><table><thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>PT</th><th></th></tr></thead><tbody id="accBody">${rows}</tbody></table></div></section>`;
};

async function resetLogin(uid) {
  const users = await listAll('users');
  const t = users.find((x) => x.id === uid); if (!t || uid === state.user.uid) return;
  const pw = randomPassword();
  const v = await dialog({
    title: `Reset password — ${t.name}`,
    body: `<p style="margin-bottom:12px">Login lama tidak berlaku lagi. Berikan password baru ini kepada pemilik akun.</p>
      <div class="field"><label for="rsPass">Password baru</label><input type="text" id="rsPass" value="${pw}"></div>`,
    okLabel: 'Reset', danger: true,
    validate: () => ($('#rsPass').value.length < 6 ? 'Password minimal 6 karakter.' : ''),
    getValue: () => $('#rsPass').value,
    onSubmit: async (pass) => {
      const email = `${t.username}.${Math.random().toString(36).slice(2, 7)}@${L.LOGIN_DOMAIN}`;
      const newUid = await F.createAuthUser(email, pass);
      const { id, ...data } = t;
      const b = F.writeBatch(db);
      b.set(F.doc(db, 'users', newUid), { ...data, email });
      b.delete(F.doc(db, 'users', uid));
      b.set(F.doc(db, 'usernames', t.username), { email, uid: newUid });
      await b.commit(); bust();
    },
  });
  if (v) { await info('Password direset', `<p>Username: <code>${esc(t.username)}</code><br>Password baru: <code>${esc(v)}</code></p>`); go('accounts'); }
}

async function deleteAccount(uid) {
  const t = (await listAll('users')).find((x) => x.id === uid); if (!t || t.role === 'superuser') return;
  if (t.employeeId) return deleteEmployee(t.employeeId);
  const ok = await confirmBox(`Hapus akun ${t.name}?`, 'Akun tidak bisa login lagi.', 'Hapus', true);
  if (!ok) return;
  try {
    const b = F.writeBatch(db);
    b.delete(F.doc(db, 'users', uid)); b.delete(F.doc(db, 'usernames', t.username));
    await b.commit(); bust(); toast('Akun dihapus.', 'ok'); go('accounts');
  } catch (e) { toast(errMsg(e), 'err'); }
}

// ---------- Profil ----------
pages.profile = async () => {
  const u = state.user;
  return pageHead('Profil', `${u.name} · ${roleLabel(u.role)}`)
    + card('Foto profil', `<div class="photo-box">${avatar(u, 'lg')}<div class="btn-row"><button class="btn btn-line" data-act="photo-pick">Pilih foto</button>${u.photoUrl ? '<button class="btn btn-ghost" data-act="photo-remove">Hapus foto</button>' : ''}</div></div><p class="sub" style="margin-top:10px">Foto diperkecil otomatis dan hanya terlihat oleh pengguna portal.</p>`)
    + `<section class="card"><h3>Ganti password</h3><form data-submit="password" novalidate style="max-width:420px">
      <div class="field"><label for="pwOld">Password lama</label><input type="password" id="pwOld" autocomplete="current-password"></div>
      <div class="field"><label for="pwNew">Password baru</label><input type="password" id="pwNew" autocomplete="new-password"><div class="hint">Minimal 6 karakter.</div></div>
      <div class="field"><label for="pwNew2">Ulangi password baru</label><input type="password" id="pwNew2" autocomplete="new-password"></div>
      <button class="btn btn-primary" type="submit">Ganti password</button></form></section>`;
};

async function changePassword() {
  const o = $('#pwOld').value, n = $('#pwNew').value, c = $('#pwNew2').value;
  if (!o || !n || !c) return toast('Lengkapi semua kolom.', 'err');
  if (n.length < 6) return toast('Password baru minimal 6 karakter.', 'err');
  if (n !== c) return toast('Konfirmasi password tidak sama.', 'err');
  if (n === o) return toast('Password baru harus berbeda.', 'err');
  try { await F.changeOwnPassword(o, n); toast('Password diganti.', 'ok'); ['#pwOld', '#pwNew', '#pwNew2'].forEach((s) => { $(s).value = ''; }); }
  catch (e) { toast(errMsg(e), 'err'); }
}

function resizeImage(file, max = 256, q = 0.8) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('File bukan gambar yang valid.')); };
    img.src = url;
  });
}
async function setPhoto(url) {
  await F.updateDoc(F.doc(db, 'users', state.user.uid), { photoUrl: url });
  state.user.photoUrl = url; bust();
  renderShell(); go('profile');
}

// ---------- Ekspor ----------
function download(name, text) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => L.toISODate(new Date());
async function exportRequests() {
  const list = (await getRequests()).filter((r) => !L.isPending(r.status));
  if (!list.length) return toast('Belum ada data untuk diunduh.', 'err');
  download(`riwayat-cuti-${stamp()}.csv`, L.toCsv(list, [
    { label: 'Nama', key: 'employeeName' }, { label: 'Role', get: (r) => roleLabel(r.employeeRole) }, { label: 'Jenis', key: 'reasonType' },
    { label: 'Mulai', key: 'startDate' }, { label: 'Selesai', key: 'endDate' }, { label: 'Hari', key: 'days' },
    { label: 'Memotong saldo', get: (r) => (r.deduct ? 'Ya' : 'Tidak') }, { label: 'Keterangan', key: 'reasonDetail' },
    { label: 'Status', get: (r) => L.statusLabel(r.status) }, { label: 'Direview oleh', key: 'reviewedBy' }, { label: 'Diputuskan oleh', key: 'decidedBy' },
    { label: 'Tanggal keputusan', key: 'decidedAt' }, { label: 'Alasan penolakan', key: 'rejectNote' }, { label: 'Diajukan', key: 'createdAt' },
  ]));
}
async function exportLedger() {
  const list = (await listAll('ledger')).slice().sort(byDateDesc('ts'));
  if (!list.length) return toast('Belum ada data untuk diunduh.', 'err');
  download(`mutasi-cuti-${stamp()}.csv`, L.toCsv(list, [
    { label: 'Tanggal', key: 'ts' }, { label: 'ID', key: 'employeeId' }, { label: 'Nama', key: 'employeeName' }, { label: 'Jenis', key: 'type' },
    { label: 'Perubahan', key: 'amount' }, { label: 'Saldo setelahnya', key: 'balanceAfter' }, { label: 'Catatan', key: 'note' }, { label: 'Oleh', key: 'by' },
  ]));
}

// ---------- Perusahaan (owner) ----------
pages.companies = async () => {
  const emps = await fetchRaw('employees');
  const rows = state.companies.map((c) => `<tr><td><b>${esc(c.name)}</b>${c.active === false ? ' <span class="badge b-no">Nonaktif</span>' : ''}</td><td>${emps.filter((e) => e.companyId === c.id).length}</td>
    <td><div class="btn-row"><button class="btn btn-line btn-sm" data-act="co-rename" data-id="${esc(c.id)}">Ubah nama</button>
    <button class="btn btn-ghost btn-sm" data-act="co-toggle" data-id="${esc(c.id)}">${c.active === false ? 'Aktifkan' : 'Nonaktifkan'}</button></div></td></tr>`).join('');
  return pageHead('Perusahaan', 'Setiap PT punya karyawan dan data cutinya sendiri. Role selain owner hanya melihat PT miliknya.', '<button class="btn btn-primary" data-act="co-add">Tambah PT</button>')
    + (rows ? card(`${state.companies.length} PT`, `<div class="tw"><table><thead><tr><th>Nama PT</th><th>Karyawan</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`)
      : card('Belum ada PT', emptyHtml('Tambahkan PT pertama Anda', 'Setelah itu Anda bisa membuat akun Kepala HRD, Staff HRD, dan karyawan untuk PT tersebut.')));
};

async function companyForm(c) {
  const v = await dialog({
    title: c ? 'Ubah nama PT' : 'Tambah PT',
    body: `<div class="field"><label for="cmName">Nama PT</label><input type="text" id="cmName" maxlength="80" value="${esc(c ? c.name : '')}"></div>`,
    okLabel: 'Simpan',
    validate: () => ($('#cmName').value.trim().length < 2 ? 'Isi nama PT.' : ''),
    getValue: () => $('#cmName').value.trim(),
    onSubmit: async (name) => {
      if (state.companies.some((x) => (!c || x.id !== c.id) && x.name.toLowerCase() === name.toLowerCase())) throw new Error('Nama PT sudah ada.');
      if (c) await F.updateDoc(F.doc(db, 'companies', c.id), { name });
      else await F.addDoc(F.collection(db, 'companies'), { name, active: true, createdAt: new Date().toISOString() });
      await loadCompanies(); renderScope(); bust();
    },
  });
  if (v) go('companies');
}

// ---------- Kalender libur ----------
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => L.monthName(i));
const selDays = (sel) => (sel ? C.countLeaveDays(sel.a, sel.b) : 0);
function selText() {
  const sel = state.cal.sel;
  if (!sel) return 'Belum ada tanggal dipilih. Klik satu tanggal, lalu klik tanggal lain untuk membuat rentang.';
  return sel.a === sel.b ? `${fd(sel.a)} (1 hari)` : `${fd(sel.a)} – ${fd(sel.b)} (${selDays(sel)} hari)`;
}
function calendarHtml() {
  const { y, m, sel } = state.cal, canP = C.canProposeHoliday(state.user.role), today = L.toISODate(new Date());
  const pend = (state.holDocs || []).filter((h) => h.status === 'pending');
  const cell = (d) => {
    if (!d) return '<span class="cal-blank"></span>';
    const dt = L.parseDate(d), dow = dt.getDay(), hol = C.holidayAt(d, state.holidays), pd = hol ? null : C.holidayAt(d, pend);
    const cls = ['cal-d', (dow === 0 || dow === 6) && 'we', hol && 'hol', pd && 'pend', sel && sel.a <= d && d <= sel.b && 'sel', d === today && 'today'].filter(Boolean).join(' ');
    const title = hol ? hol.name : pd ? `${pd.name} (menunggu Direktur)` : '';
    const label = `${fd(d)}${hol ? ', libur ' + hol.name : pd ? ', libur menunggu Direktur' : ''}`;
    return canP ? `<button type="button" class="${cls}" data-act="cal-pick" data-d="${d}" aria-label="${esc(label)}"${title ? ` title="${esc(title)}"` : ''}>${dt.getDate()}</button>`
      : `<span class="${cls}" aria-label="${esc(label)}"${title ? ` title="${esc(title)}"` : ''}>${dt.getDate()}</span>`;
  };
  return `<div class="cal-head"><button class="btn btn-line btn-sm" data-act="cal-nav" data-d="-1" aria-label="Bulan sebelumnya">‹</button><h3>${MONTH_NAMES[m]} ${y}</h3><button class="btn btn-line btn-sm" data-act="cal-nav" data-d="1" aria-label="Bulan berikutnya">›</button></div>
    <div class="cal-grid" role="group" aria-label="Kalender ${MONTH_NAMES[m]} ${y}">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => `<span class="cal-w">${d}</span>`).join('')}${C.monthGrid(y, m).flat().map(cell).join('')}</div>
    <div class="cal-legend"><span><i class="sw hol"></i>Libur berlaku, tidak memotong cuti</span><span><i class="sw pend"></i>Menunggu Direktur</span>${canP ? '<span><i class="sw sel"></i>Pilihan Anda</span>' : ''}</div>`;
}
function refreshCal() {
  const h = $('#calHost'); if (h) h.innerHTML = calendarHtml();
  const t = $('#selText'); if (t) t.textContent = selText();
}
const holRange = (h) => (h.start === h.end ? fd(h.start) : `${fd(h.start)} – ${fd(h.end)}`);
const holStatus = (s) => `<span class="badge ${s === 'approved' ? 'b-ok' : s === 'pending' ? 'b-pending' : 'b-no'}">${esc(C.HOLIDAY_STATUS[s] || s)}</span>`;

pages.holidays = async () => {
  await loadHolidays();
  state.holDocs = await listHolidays();
  const u = state.user, canP = C.canProposeHoliday(u.role), canD = C.canDecideHoliday(u.role);
  const approved = state.holidays.slice().sort((a, b) => (a.start < b.start ? -1 : 1));
  const pend = state.holDocs.filter((h) => h.status === 'pending');
  const past = state.holDocs.filter((h) => h.status !== 'pending' && h.status !== 'approved').slice(0, 20);
  let h = pageHead('Kalender libur', canP ? 'Pilih rentang tanggal, beri nama, lalu ajukan ke Direktur. Setelah disetujui, tanggal berwarna merah tidak memotong jatah cuti.'
    : canD ? 'Setujui libur yang diajukan Kepala HRD. Libur yang disetujui berlaku untuk semua PT.' : 'Tanggal berwarna merah adalah libur dan tidak memotong jatah cuti.');
  h += `<section class="card"><div id="calHost">${calendarHtml()}</div></section>`;
  if (canP) {
    h += `<section class="card"><form data-submit="holiday" novalidate><h3>Ajukan libur</h3>
      <p id="selText" class="sel-text">${esc(selText())}</p>
      <div class="field"><label for="hdName">Nama libur</label><input type="text" id="hdName" maxlength="60" placeholder="Contoh: Cuti bersama Natal"></div>
      <div class="btn-row"><button class="btn btn-primary" type="submit">Ajukan ke Direktur</button><button class="btn btn-line" type="button" data-act="cal-clear">Hapus pilihan</button></div></form></section>`;
  }
  if (canD || canP) {
    const mineP = canD ? pend : pend.filter((x) => x.requestedByUid === u.uid);
    h += card(`Menunggu persetujuan Direktur (${mineP.length})`, mineP.length ? mineP.map((x) => `<div class="q-item"><div class="q-main"><div class="who">${esc(x.name)}</div>
      <div class="meta">${esc(holRange(x))} · ${C.countLeaveDays(x.start, x.end)} hari · diajukan ${esc(x.requestedBy)}</div></div>
      <div class="q-act">${canD ? `<button class="btn btn-ok btn-sm" data-act="hol-decide" data-kind="approve" data-id="${esc(x.id)}">Setujui</button><button class="btn btn-line btn-sm" data-act="hol-decide" data-kind="reject" data-id="${esc(x.id)}">Tolak</button>`
      : `<button class="btn btn-line btn-sm" data-act="hol-decide" data-kind="cancel" data-id="${esc(x.id)}">Batalkan</button>`}</div></div>`).join('') : emptyHtml('Tidak ada yang menunggu'));
  }
  h += card('Libur yang berlaku', approved.length ? `<div class="tw"><table><thead><tr><th>Tanggal</th><th>Nama</th><th>Hari</th>${canD ? '<th></th>' : ''}</tr></thead><tbody>${approved.map((x) => `<tr><td>${esc(holRange(x))}</td><td><b>${esc(x.name)}</b></td><td>${C.countLeaveDays(x.start, x.end)}</td>${canD ? `<td><button class="btn btn-ghost btn-sm" data-act="hol-decide" data-kind="revoke" data-id="${esc(x.id)}">Cabut</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`
    : emptyHtml('Belum ada libur', 'Libur yang disetujui Direktur akan muncul di sini.'));
  if ((canD || canP) && past.length) h += card('Riwayat pengajuan', `<div class="tw"><table><thead><tr><th>Tanggal</th><th>Nama</th><th>Status</th></tr></thead><tbody>${past.map((x) => `<tr><td>${esc(holRange(x))}</td><td>${esc(x.name)}</td><td>${holStatus(x.status)}</td></tr>`).join('')}</tbody></table></div>`);
  return h;
};

async function proposeHoliday() {
  const sel = state.cal.sel, name = $('#hdName').value.trim();
  const err = C.validateHoliday({ start: sel && sel.a, end: sel && sel.b, name });
  if (err) return toast(err, 'err');
  if (!C.canProposeHoliday(state.user.role)) return toast('Hanya Kepala HRD yang bisa mengajukan libur.', 'err');
  const clash = state.holidays.find((r) => L.rangesOverlap(sel.a, sel.b, r.start, r.end));
  if (clash) return toast(`Bertabrakan dengan libur "${clash.name}". Minta Direktur mencabutnya lebih dulu bila ingin mengubah.`, 'err');
  await F.addDoc(F.collection(db, 'holidays'), { start: sel.a, end: sel.b, name, status: 'pending', requestedBy: state.user.name, requestedByUid: state.user.uid, requestedAt: new Date().toISOString() });
  state.cal.sel = null; bust(); toast('Libur diajukan ke Direktur.', 'ok'); go('holidays');
}

async function holDecide(el) {
  const { id, kind } = el.dataset, u = state.user;
  const cfg = {
    approve: ['Setujui libur?', 'Tanggal ini diwarnai merah dan tidak memotong jatah cuti karyawan di semua PT, termasuk pengajuan yang masih menunggu.', 'Setujui', false],
    reject: ['Tolak libur?', 'Pengajuan libur ini ditolak.', 'Tolak', true],
    revoke: ['Cabut libur?', 'Tanggal ini tidak lagi libur. Cuti yang sudah disetujui tidak berubah.', 'Cabut', true],
    cancel: ['Batalkan pengajuan?', 'Pengajuan libur ini dibatalkan.', 'Batalkan', true],
  }[kind];
  if (!cfg || !(await confirmBox(cfg[0], cfg[1], cfg[2], cfg[3]))) return;
  const href = F.doc(db, 'holidays', id), cref = F.doc(db, 'calendar', 'holidays');
  await F.runTransaction(db, async (tx) => {
    const hs = await tx.get(href), cs = await tx.get(cref);
    if (!hs.exists()) throw new Error('Pengajuan libur tidak ditemukan.');
    const h = hs.data(), ranges = cs.exists() ? cs.data().ranges || [] : [], now = new Date().toISOString();
    const who = { decidedBy: u.name, decidedByUid: u.uid, decidedAt: now };
    if (kind === 'cancel') {
      if (h.status !== 'pending' || h.requestedByUid !== u.uid) throw new Error('Hanya pengaju yang bisa membatalkan pengajuan yang masih menunggu.');
      tx.update(href, { status: 'cancelled', ...who });
      return;
    }
    if (!C.canDecideHoliday(u.role)) throw new Error('Hanya Direktur yang bisa memutuskan libur.');
    if (kind === 'revoke') {
      if (h.status !== 'approved') throw new Error('Libur ini tidak sedang berlaku.');
      tx.update(href, { status: 'revoked', ...who });
      tx.set(cref, { ranges: C.removeRange(ranges, id), updatedAt: now });
      return;
    }
    if (h.status !== 'pending') throw new Error('Pengajuan ini sudah diproses.');
    if (kind === 'reject') { tx.update(href, { status: 'rejected', ...who }); return; }
    tx.update(href, { status: 'approved', ...who });
    tx.set(cref, { ranges: C.addRange(ranges, { id, start: h.start, end: h.end, name: h.name }), updatedAt: now });
  });
  await loadHolidays(); bust();
  toast({ approve: 'Libur disetujui.', reject: 'Libur ditolak.', revoke: 'Libur dicabut.', cancel: 'Pengajuan dibatalkan.' }[kind], 'ok');
  go('holidays'); updateCounts();
}

// ---------- Event ----------
const acts = {
  go: (el) => go(el.dataset.route),
  'co-add': () => companyForm(null),
  'co-rename': (el) => companyForm(state.companies.find((c) => c.id === el.dataset.id)),
  'co-toggle': async (el) => {
    const c = state.companies.find((x) => x.id === el.dataset.id); if (!c) return;
    await F.updateDoc(F.doc(db, 'companies', c.id), { active: c.active === false });
    await loadCompanies(); renderScope(); go('companies');
  },
  'acc-access': (el) => accessForm(el.dataset.uid),
  'cal-nav': (el) => { const c = state.cal, d = new Date(c.y, c.m + parseInt(el.dataset.d, 10), 1); c.y = d.getFullYear(); c.m = d.getMonth(); refreshCal(); },
  'cal-pick': (el) => {
    const d = el.dataset.d, s0 = state.cal.sel;
    if (!s0 || s0.a !== s0.b) state.cal.sel = { a: d, b: d };
    else { const [a, b] = C.orderRange(s0.a, d); state.cal.sel = { a, b }; }
    refreshCal();
  },
  'cal-clear': () => { state.cal.sel = null; refreshCal(); },
  'hol-decide': holDecide,
  logout: () => F.signOut(auth),
  'm-ok': dialogOk,
  'm-cancel': dialogCancel,
  'm-bg': (el, e) => { if (e.target === el) dialogCancel(); },
  decide,
  'export-requests': exportRequests,
  'export-ledger': exportLedger,
  'adj-open': (el) => openAdjust(el.dataset.id),
  'add-staff': async () => { if (await accountForm({ roles: L.HRD_CREATABLE_ROLES, title: 'Tambah karyawan' })) reload(); },
  'acc-add': async () => { if (await accountForm({ roles: Object.keys(L.ROLES).filter((r) => r !== 'superuser'), title: 'Tambah akun' })) reload(); },
  'emp-detail': (el) => empDetail(el.dataset.id),
  'emp-role': (el) => changeRole(el.dataset.id),
  'emp-del': (el) => deleteEmployee(el.dataset.id),
  'acc-reset': (el) => resetLogin(el.dataset.id),
  'acc-del': (el) => deleteAccount(el.dataset.id),
  'run-renewal': async (el) => {
    el.disabled = true;
    try { const n = await runRenewals(); toast(n ? `Cuti tahunan diperbarui untuk ${n} karyawan.` : 'Belum ada karyawan yang perlu diperbarui.', 'ok'); }
    catch (e) { toast(errMsg(e), 'err'); }
    el.disabled = false;
  },
  'report-print': () => window.print(),
  'photo-pick': () => { $('#photoInput').value = ''; $('#photoInput').click(); },
  'photo-remove': async () => { try { await setPhoto(''); toast('Foto dihapus.', 'ok'); } catch (e) { toast(errMsg(e), 'err'); } },
};
const submits = { login: doLogin, setup: doSetup, leave: submitLeave, settings: saveSettings, password: changePassword, holiday: proposeHoliday };
const inputs = {
  calc: updateCalc,
  scope: (el) => { state.scope = el.value; go(state.route); updateCounts(); },
  search: (el) => {
    const k = el.value.toLowerCase().trim(); let n = 0;
    $$(`${el.dataset.target} tr`).forEach((r) => { const m = !k || (r.dataset.q || '').includes(k); r.hidden = !m; if (m) n++; });
    $(el.dataset.counter).textContent = n + (el.dataset.counter === '#accCount' ? ' akun' : ' karyawan');
  },
  'ledger-filter': (el) => $$('tr[data-emp]').forEach((r) => { r.hidden = !!el.value && r.dataset.emp !== el.value; }),
  'report-month': (el) => { state.reportMonth = el.value; go('report'); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !acts[el.dataset.act]) return;
  Promise.resolve(acts[el.dataset.act](el, e)).catch((err) => toast(errMsg(err), 'err'));
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-submit]');
  if (!f) return;
  e.preventDefault();
  Promise.resolve(submits[f.dataset.submit]()).catch((err) => toast(errMsg(err), 'err'));
});
['input', 'change'].forEach((ev) => document.addEventListener(ev, (e) => {
  const el = e.target.closest('[data-input]');
  if (el && inputs[el.dataset.input]) inputs[el.dataset.input](el);
}));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dlg) dialogCancel(); });
$('#photoInput').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { await setPhoto(await resizeImage(f)); toast('Foto diperbarui.', 'ok'); } catch (err) { toast(errMsg(err), 'err'); }
});

boot();
