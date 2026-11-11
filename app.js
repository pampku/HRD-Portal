// app.js — layar & interaksi. Aturan bisnis ada di logic.js, akses Firebase di firebase.js.
import * as F from './firebase.js';
import * as L from './logic.js';
import * as C from './company.js';
import * as K from './kinds.js';
import * as W from './workcal.js';
import * as R from './report.js';
import { buildXlsx, STYLE } from './xlsx.js';
import { buildPdf } from './pdf.js';

const STATUS_APPROVED = 'approved';

const { esc } = L;
const { db, auth } = F;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = $('#root');
const modalHost = $('#modalHost');

const state = { user: null, emp: null, settings: { ...L.DEFAULT_SETTINGS }, route: null, busy: false, setupDone: true, reportMonth: '', companies: [], scope: 'all', holidays: [], batches: [], cal: { y: new Date().getFullYear(), m: new Date().getMonth(), drafts: {} }, photos: [], izinReqs: [], attMonth: '' };

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
  attendance: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  newemp: '<circle cx="10" cy="8" r="3.5"/><path d="M3 20a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
const ico = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const NAV = {
  dashboard: 'Beranda', apply: 'Ajukan', review: 'Review', adjust: 'Penyesuaian', employees: 'Karyawan',
  mutations: 'Mutasi', report: 'Laporan', settings: 'Pengaturan', accounts: 'Akun', approval: 'Persetujuan', profile: 'Profil', companies: 'Perusahaan', holidays: 'Kalender Kerja', attendance: 'Absensi', newemp: 'Karyawan Baru',
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
  if (r.auto) return '<div class="steps"><span class="step done"><i></i>Diajukan</span><span class="step done"><i></i>Disetujui otomatis</span></div>';
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
// Hari yang akan dipotong untuk sebuah pengajuan, memperhitungkan tanggal merah yang berlaku sekarang.
const effDays = (r) => (r.status === 'approved' || r.status === 'rejected' ? r.days : K.recountRequest(r, state.holidays, !!state.settings.excludeWeekends));
const NAVS = {
  superuser: ['companies', 'accounts', 'employees', 'mutations', 'report', 'attendance', 'settings', 'holidays', 'profile'],
  staff: ['dashboard', 'apply', 'holidays', 'profile'],
  staff_hrd: ['dashboard', 'apply', 'review', 'adjust', 'employees', 'newemp', 'attendance', 'holidays', 'profile'],
  kepala_hrd: ['dashboard', 'apply', 'employees', 'newemp', 'attendance', 'holidays', 'profile'],
  direktur: ['approval', 'newemp', 'employees', 'mutations', 'report', 'attendance', 'holidays', 'profile'],
  komisaris: ['employees', 'mutations', 'report', 'holidays', 'profile'],
};
const navItems = (role) => NAVS[role] || ['profile'];
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
  state.scope = 'all'; state.attMonth = ''; state.photos = [];
  state.cal = { y: new Date().getFullYear(), m: new Date().getMonth(), drafts: {} };
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
      c.newemp = (await listAll('employeeRequests')).filter((r) => empReqAction(u, r) || canCreateFrom(u, r)).length;
    }
    if (u.role === 'direktur') {
      c.approval = (await listAll('requests')).filter((r) => actOn(u, r) === 'director').length;
      c.holidays = (await listBatches()).filter((h) => h.status === 'pending').length;
      c.newemp = (await listAll('employeeRequests')).filter((r) => empReqAction(u, r)).length;
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
    <td>${esc(fd(r.startDate))} – ${esc(fd(r.endDate))}</td><td>${daysText(r)}</td>
    <td>${esc(r.reason)}${r.rejectNote ? `<div class="sub">Alasan ditolak: ${esc(r.rejectNote)}</div>` : ''}${attBtn(r) ? `<div style="margin-top:6px">${attBtn(r)}</div>` : ''}</td>
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
    <div class="meta">${esc(fd(r.startDate))} – ${esc(fd(r.endDate))} · ${ed} hari${ed !== r.days ? ` (diajukan ${r.days}, tanggal merah tidak dihitung)` : ''} · ${esc(r.reason)}${izinBadge(r)}</div>${attBtn(r) ? `<div style="margin:6px 0">${attBtn(r)}</div>` : ''}
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
    <td><b>${esc(r.employeeName)}</b></td><td>${esc(fd(r.startDate))} – ${esc(fd(r.endDate))}</td><td>${daysText(r)}</td><td>${esc(r.reason)}${izinBadge(r)}${r.rejectNote ? `<div class="sub">Ditolak: ${esc(r.rejectNote)}</div>` : ''}${attBtn(r) ? `<div style="margin-top:6px">${attBtn(r)}</div>` : ''}</td>
    <td>${statusBadge(r.status)}</td><td><span class="sub">${esc([r.reviewedBy, r.decidedBy].filter(Boolean).join(' → ') || '-')}</span></td></tr>`).join('')}</tbody></table></div>`;
}
const exportBtn = (act, label = 'Unduh CSV') => `<button class="btn btn-line btn-sm" data-act="${act}">${label}</button>`;

// ---------- Halaman ----------
const pages = {};
const afterPage = {};

pages.dashboard = async () => {
  const u = state.user, emp = state.emp;
  let h = pageHead(`Halo, ${first(u.name)}`, 'Ringkasan cuti dan pengajuan Anda.', `<button class="btn btn-primary" data-act="go" data-route="apply">Ajukan cuti atau izin</button>`);
  h += weddingHtml(await weddings());
  h += emp ? balanceHero(emp) : banner('warn', 'Akun belum terhubung ke data karyawan.', 'Hubungi Staff HRD.');
  if (u.role === 'staff_hrd') {
    const allReqs = await listAll('requests'); state.izinReqs = allReqs;
    const n = allReqs.filter((r) => actOn(u, r) === 'review').length;
    h += izinAlertCard(allReqs);
    if (n) h += `<div class="banner info"><div><strong>${n} pengajuan menunggu review Anda</strong><button class="btn btn-line btn-sm" style="margin-top:8px" data-act="go" data-route="review">Buka antrian review</button></div></div>`;
  }
  if (u.role === 'kepala_hrd') {
    const [reqs, adjs, emps] = await Promise.all([listAll('requests'), listAll('adjustments'), getEmployees()]);
    const em = empMap(emps); state.izinReqs = reqs;
    h += izinAlertCard(reqs);
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

const izinWarn = () => (Number.isInteger(state.settings.izinWarn) && state.settings.izinWarn >= 2 ? state.settings.izinWarn : K.DEFAULT_IZIN_WARN);
const MGMT_VIEW = ['staff_hrd', 'kepala_hrd', 'direktur'];
const photoOk = (s) => /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(String(s || ''));
const attBtn = (r) => (r.attachmentIds && r.attachmentIds.length ? `<button class="btn btn-line btn-sm" data-act="att-view" data-id="${esc(r.id)}">Lampiran (${r.attachmentIds.length})</button>` : '');
const daysText = (r, d = r.days) => (r.auto ? '-' : d);
function izinBadge(r) {
  if (!MGMT_VIEW.includes(state.user.role) || !K.isIzinCounted(r)) return '';
  const n = K.izinCountFor(state.izinReqs, r.employeeId, K.monthKey(r.startDate));
  return n >= izinWarn() ? ` <span class="badge b-warn" title="Izin berulang dalam sebulan">${n}x izin bulan ini</span>` : '';
}
function izinAlertCard(reqs) {
  const al = K.izinAlerts(reqs, K.monthKey(L.toISODate(new Date())), izinWarn());
  if (!al.length) return '';
  return card('Perhatian: izin terlalu sering bulan ini', `<p class="sub" style="margin-bottom:10px">Karyawan dengan ${izinWarn()}x izin atau lebih (sakit, keluarga sakit, izin lainnya) dalam bulan berjalan.</p>`
    + al.map((a) => `<div class="q-item debt"><div class="q-main"><div class="who">${esc(a.name)} <span class="badge b-warn">${a.count}x izin</span></div>
      <div class="meta">${a.items.slice().sort((x, y) => (x.startDate < y.startDate ? -1 : 1)).map((i) => `${esc(fd(i.startDate))} (${esc((K.kindById(i.kind) || {}).label || i.reasonType)})`).join(' · ')}</div></div></div>`).join(''));
}
async function weddings() {
  try { const t = L.toISODate(new Date()); return (await listAll('announcements')).filter((a) => a.type === 'wedding' && a.endDate >= t).sort(byDateDesc('createdAt')); }
  catch (e) { console.warn('announcements', e); return []; }
}
const weddingHtml = (list) => list.map((a) => `<section class="wed" role="note"><div class="wed-t">Selamat atas pernikahan <b>${esc(a.employeeName)}</b></div>
  <div class="wed-s">Semoga bahagia selalu. Cuti pernikahan ${esc(fd(a.startDate))} – ${esc(fd(a.endDate))}${state.companies.length > 1 ? ' · ' + esc(coName(a.companyId)) : ''}</div>
  ${photoOk(a.photo) ? `<img class="wed-img" src="${esc(a.photo)}" alt="Undangan pernikahan ${esc(a.employeeName)}">` : ''}</section>`).join('');

pages.apply = async () => {
  const u = state.user, emp = state.emp;
  if (!emp) return pageHead('Ajukan cuti') + banner('warn', 'Akun belum terhubung ke data karyawan.', 'Hubungi Staff HRD.');
  state.photos = [];
  const opts = K.GROUPS.map((g) => `<optgroup label="${esc(g.label)}">${K.kindsOf(g.id).map((k) => `<option value="${esc(k.id)}">${esc(k.label)}</option>`).join('')}</optgroup>`).join('');
  const flow = u.role === 'kepala_hrd' ? 'Anda → persetujuan Direktur' : u.role === 'staff_hrd' ? 'Anda → review Staff HRD lain → persetujuan Kepala HRD' : 'Anda → review Staff HRD → persetujuan Kepala HRD';
  const mine = await myRequests();
  let h = pageHead('Ajukan cuti atau izin', `Alur: ${flow}. Datang/pulang terlambat disetujui otomatis.`);
  if (bal(emp) < 0) h += banner('danger', `Anda punya hutang cuti ${Math.abs(bal(emp))} hari.`, 'Cuti yang memotong saldo akan menambah hutang.');
  if (!L.isEligible(emp.joinDate)) h += banner('info', 'Masa kerja Anda belum genap 1 tahun.', 'Cuti yang diajukan sekarang akan tercatat sebagai hutang.');
  h += banner('info', '', `${L.lockMessage(new Date(), state.settings.lockDay)} Sisa cuti Anda saat ini ${bal(emp)} hari. Sabtu, Minggu, dan tanggal merah tidak dihitung.`);
  h += `<section class="card"><form data-submit="leave" novalidate>
    <div class="field"><label for="lvType">Jenis pengajuan</label><select id="lvType" data-input="calc"><option value="">Pilih jenis pengajuan</option>${opts}</select><div class="hint" id="lvTypeHint"></div></div>
    <div class="field" id="lvFamilyWrap" hidden><label for="lvFamily">Hubungan keluarga</label><select id="lvFamily" data-input="calc"><option value="">Pilih keluarga</option>${K.FAMILY.map((f) => `<option>${esc(f)}</option>`).join('')}</select></div>
    <div class="row2"><div class="field"><label for="lvStart" id="lvStartLabel">Mulai</label><input type="date" id="lvStart" data-input="calc"></div>
    <div class="field" id="lvEndWrap"><label for="lvEnd">Selesai</label><input type="date" id="lvEnd" data-input="calc"></div></div>
    <div class="field"><label for="lvDetail" id="lvDetailLabel">Keterangan (opsional)</label><textarea id="lvDetail" data-input="calc" maxlength="300"></textarea></div>
    <div class="field" id="lvPhotoWrap" hidden><label id="lvPhotoLabel">Lampiran foto</label><div class="photos" id="lvPhotos"></div>
      <button type="button" class="btn btn-line btn-sm" data-act="lv-photo" id="lvPhotoBtn">Tambah foto</button>
      <input type="file" id="lvPhotoInput" data-input="lv-photo-file" accept="image/*" multiple hidden>
      <div class="hint">Hanya foto (JPG/PNG), diperkecil otomatis. Maksimal ${K.MAX_PHOTOS} foto.</div></div>
    <div class="calc" id="lvCalc" hidden></div>
    <button class="btn btn-primary" id="lvBtn" type="submit">Kirim pengajuan</button></form></section>`;
  h += card('Riwayat pengajuan saya', myReqTable(mine));
  return h;
};

function renderPhotos() {
  const el = $('#lvPhotos'); if (!el) return;
  el.innerHTML = state.photos.map((p, i) => `<div class="ph"><img src="${esc(p.data)}" alt="Foto ${i + 1}"><button type="button" class="ph-x" data-act="lv-photo-del" data-i="${i}" aria-label="Hapus foto ${i + 1}">×</button></div>`).join('');
  const b = $('#lvPhotoBtn'); if (b) b.hidden = state.photos.length >= K.MAX_PHOTOS;
}

function compressPhoto(file, maxSide = 1280, maxBytes = 230000) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let k = Math.min(1, maxSide / Math.max(img.width, img.height)), q = 0.72, out = '';
      for (let i = 0; i < 10; i++) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        if (out.length * 0.75 <= maxBytes) return res(out);
        if (q > 0.5) q -= 0.1; else k *= 0.8;
      }
      rej(new Error('Foto terlalu besar, coba foto lain.'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('File bukan gambar yang valid.')); };
    img.src = url;
  });
}
async function addPhotos(el) {
  const files = [...el.files]; el.value = '';
  if (!files.length) return;
  for (const f of files) {
    if (state.photos.length >= K.MAX_PHOTOS) { toast(`Maksimal ${K.MAX_PHOTOS} foto.`, 'err'); break; }
    if (!/^image\//.test(f.type)) { toast('Hanya file foto yang diterima.', 'err'); continue; }
    try { state.photos.push({ name: f.name.slice(0, 60), data: await compressPhoto(f) }); } catch (e) { toast(errMsg(e), 'err'); }
  }
  renderPhotos(); updateCalc();
}

function updateCalc() {
  const kind = K.kindById($('#lvType').value), box = $('#lvCalc');
  const single = !!(kind && kind.single);
  $('#lvEndWrap').hidden = single;
  $('#lvStartLabel').textContent = single ? 'Tanggal' : 'Mulai';
  const s = $('#lvStart').value, e = single ? s : $('#lvEnd').value;
  $('#lvTypeHint').textContent = kind ? (kind.hint || (kind.deduct ? 'Memotong saldo cuti tahunan.' : 'Tidak memotong saldo cuti tahunan.')) : '';
  $('#lvFamilyWrap').hidden = !(kind && kind.family);
  const min = kind && kind.detail ? kind.detail.min : 0;
  $('#lvDetailLabel').textContent = min ? `Keterangan (wajib, minimal ${min} karakter)` : 'Keterangan (opsional)';
  const ok = kind && s && e && !L.validateRange(s, e);
  const days = ok ? K.countDays(kind, s, e, state.holidays) : 0;
  const rule = kind ? K.docRule(kind, days) : null;
  $('#lvPhotoWrap').hidden = !(kind && kind.docs);
  if (kind && kind.docs) $('#lvPhotoLabel').textContent = kind.docs.always ? `Lampiran foto ${kind.docs.label} (wajib)` : rule && rule.required ? `Lampiran foto ${kind.docs.label} (wajib karena lebih dari ${kind.docs.overDays} hari)` : `Lampiran foto ${kind.docs.label} (wajib bila lebih dari ${kind.docs.overDays} hari)`;
  if (!ok) { box.hidden = true; return; }
  box.hidden = false;
  const msg = (t) => { box.className = 'calc debt'; box.innerHTML = `<div class="r"><span>${esc(t)}</span></div>`; };
  if (!days) return msg(kind.calendar ? 'Pilih rentang tanggal.' : 'Tanggal ini jatuh pada akhir pekan atau tanggal merah, tidak ada hari kerja yang dihitung.');
  if (kind.maxDays && days > kind.maxDays) return msg(`${kind.label} maksimal ${kind.maxDays} hari${kind.calendar ? ' kalender' : ' kerja'}. Rentang ini ${days} hari.`);
  const freed = kind.calendar ? 0 : C.holidayDaysIn(s, e, { excludeWeekends: true, holidays: state.holidays });
  const b = bal(state.emp), proj = L.projectBalance(b, days, kind.deduct), debt = proj < 0;
  box.className = 'calc' + (debt ? ' debt' : '');
  box.innerHTML = kind.auto ? '<div class="r"><span>Disetujui otomatis dan tercatat di riwayat pengajuan.</span></div>'
    : `<div class="r"><span>Durasi</span><b>${days} hari${kind.calendar ? ' kalender' : ' kerja'}</b></div>
    ${freed ? `<div class="r"><span>Tanggal merah (tidak dihitung)</span><b>${freed} hari</b></div>` : ''}
    ${kind.deduct ? `<div class="r"><span>Saldo sekarang</span><b>${b} hari</b></div><div class="r t"><span>Saldo setelah disetujui</span><b class="${debt ? 'num-neg' : ''}">${proj} hari${debt ? ' (hutang)' : ''}</b></div>` : '<div class="r t"><span>Tidak memotong saldo cuti</span><b></b></div>'}`;
}

async function submitLeave() {
  const u = state.user, emp = state.emp;
  const kind = K.kindById($('#lvType').value);
  if (!kind) return toast('Pilih jenis pengajuan.', 'err');
  const s = $('#lvStart').value, e = kind.single ? s : $('#lvEnd').value, detail = $('#lvDetail').value.trim(), family = kind.family ? $('#lvFamily').value : '';
  const ve = L.validateRange(s, e); if (ve) return toast(ve, 'err');
  if (L.isDateLocked(s, new Date(), state.settings.lockDay)) return toast(L.lockMessage(new Date(), state.settings.lockDay), 'err');
  await loadHolidays();
  const days = K.countDays(kind, s, e, state.holidays);
  const photos = kind.docs ? state.photos.slice(0, K.MAX_PHOTOS) : [];
  const err = K.validateRequest({ kind, start: s, end: e, detail, family, days, nPhotos: photos.length });
  if (err) return toast(err, 'err');
  const status = kind.auto ? STATUS_APPROVED : L.initialStatus(u.role); if (!status) return toast('Role Anda tidak bisa mengajukan cuti.', 'err');
  bust();
  const mine = await myRequests();
  if (kind.late && K.lateCount(mine, emp.id, kind.id, s) >= K.MONTHLY_LATE_CAP) return toast(`${kind.label} hanya boleh ${K.MONTHLY_LATE_CAP}x dalam 1 bulan. Bulan ini sudah ${K.MONTHLY_LATE_CAP}x.`, 'err');
  const clash = mine.find((r) => r.status !== 'rejected' && L.rangesOverlap(s, e, r.startDate, r.endDate) && !(kind.late && r.kind && r.kind !== kind.id && (K.kindById(r.kind) || {}).late));
  if (clash) return toast(`Tanggal bertabrakan dengan pengajuan ${fd(clash.startDate)} – ${fd(clash.endDate)}.`, 'err');
  if (kind.deduct && bal(emp) - days < 0) {
    const ok = await confirmBox('Saldo tidak cukup', `Saldo ${bal(emp)} hari, cuti ${days} hari. Selisih ${Math.abs(bal(emp) - days)} hari akan menjadi hutang dan dipotong dari jatah tahun berikutnya. Lanjutkan?`, 'Ajukan tetap', true);
    if (!ok) return;
  }
  const btn = $('#lvBtn'); btn.disabled = true;
  try {
    const now = new Date().toISOString(), rref = F.doc(F.collection(db, 'requests')), b = F.writeBatch(db);
    const attachmentIds = photos.map((p) => {
      const ref = F.doc(F.collection(db, 'attachments'));
      b.set(ref, { requestId: rref.id, employeeId: emp.id, companyId: emp.companyId, name: p.name, data: p.data, createdAt: now });
      return ref.id;
    });
    const doc = {
      employeeId: emp.id, employeeName: emp.name, employeeRole: u.role, companyId: emp.companyId,
      kind: kind.id, group: kind.group, reasonType: kind.label, reasonDetail: detail, family, reason: K.reasonText(kind, detail, family),
      startDate: s, endDate: e, days: kind.auto ? 0 : days, deduct: kind.deduct, countMode: K.countModeOf(kind), attachmentIds, status, createdAt: now,
    };
    if (kind.auto) Object.assign(doc, { auto: true, daysSubmitted: days, decidedBy: 'Otomatis', decidedRole: 'system', decidedAt: now });
    b.set(rref, doc);
    await b.commit();
    bust(); toast(kind.auto ? 'Tercatat dan disetujui otomatis.' : 'Pengajuan terkirim.', 'ok'); go('apply');
  } catch (er) { toast(errMsg(er), 'err'); btn.disabled = false; }
}

async function viewAttachments(id) {
  const r = (await getRequests()).find((x) => x.id === id);
  if (!r || !(r.attachmentIds || []).length) return;
  const docs = await Promise.all(r.attachmentIds.map((a) => F.getDoc(F.doc(db, 'attachments', a)).catch(() => null)));
  const imgs = docs.filter((d) => d && d.exists() && photoOk(d.data().data)).map((d, i) => `<img class="att-img" src="${esc(d.data().data)}" alt="Lampiran ${i + 1}">`);
  await info(`Lampiran - ${r.employeeName}`, imgs.length ? imgs.join('') : '<p>Lampiran tidak dapat dibuka.</p>');
}

pages.review = async () => {
  const u = state.user;
  const [reqs, emps] = await Promise.all([listAll('requests'), getEmployees()]);
  const em = empMap(emps); state.izinReqs = reqs;
  const pend = reqs.filter((r) => actOn(u, r) === 'review').sort(byDateDesc('createdAt'));
  const done = reqs.filter((r) => r.status !== 'pending_review').sort(byDateDesc('createdAt'));
  return pageHead('Review pengajuan', 'Siapa pun Staff HRD yang memproses lebih dulu yang tercatat. Ajuan Anda sendiri tidak muncul di sini.')
    + card(`Menunggu review (${pend.length})`, pend.length ? pend.map((r) => reqQueueItem(r, em)).join('') : emptyHtml('Tidak ada pengajuan', 'Antrian review kosong.'))
    + card('Riwayat', historyTable(done, em), exportBtn('export-requests'));
};

pages.approval = async () => {
  const u = state.user;
  const [reqs, emps] = await Promise.all([listAll('requests'), getEmployees()]);
  const em = empMap(emps); state.izinReqs = reqs;
  const pend = reqs.filter((r) => actOn(u, r) === 'director').sort(byDateDesc('createdAt'));
  const done = reqs.filter((r) => r.employeeRole === 'kepala_hrd' && !L.isPending(r.status)).sort(byDateDesc('decidedAt'));
  return pageHead('Persetujuan Direktur', 'Alur: Kepala HRD → Direktur (satu langkah).')
    + weddingHtml(await weddings()) + izinAlertCard(reqs)
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
    let eref = null, emp = null, days = req.days, freed = 0, wedding = null;
    if (patch.status === 'approved') {
      // Hitung ulang dengan tanggal merah yang berlaku saat ini: tanggal merah tidak memotong jatah cuti.
      const cs = await tx.get(cref);
      const holidays = cs.exists() ? cs.data().ranges || [] : [];
      days = K.recountRequest(req, holidays, !!state.settings.excludeWeekends);
      const kd = K.kindById(req.kind);
      if (kd && kd.announce === 'wedding' && (req.attachmentIds || [])[0]) {
        const as = await tx.get(F.doc(db, 'attachments', req.attachmentIds[0]));
        wedding = { photo: as.exists() ? as.data().data : '' };
      }
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
    if (wedding) tx.set(F.doc(db, 'announcements', id), { type: 'wedding', requestId: id, companyId: req.companyId, employeeId: req.employeeId, employeeName: req.employeeName, startDate: req.startDate, endDate: req.endDate, photo: wedding.photo, approvedBy: state.user.name, createdAt: now });
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
  return pageHead('Karyawan', `${emps.length} karyawan terdaftar.`, u.role === 'staff_hrd' || u.role === 'kepala_hrd' ? '<button class="btn btn-primary" data-act="go" data-route="newemp">Ajukan karyawan baru</button>' : '')
    + (['komisaris', 'superuser'].includes(u.role) ? weddingHtml(await weddings()) : '')
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

async function createAccount({ name, username, role, joinDate, password, companyId, companyIds, employeeRequestId }) {
  const isSuper = role === 'superuser';
  if (isSuper && state.user.role !== 'superuser') throw new Error('Hanya Superuser yang bisa menambah Superuser.');
  if (!isSuper && (!state.companies.some((c) => c.id === companyId) || !access().includes(companyId))) throw new Error('PT tidak valid atau di luar akses Anda.');
  if ((await F.getDoc(F.doc(db, 'usernames', username))).exists()) throw new Error('Username sudah dipakai.');
  if (employeeRequestId) {
    const rs = await F.getDoc(F.doc(db, 'employeeRequests', employeeRequestId));
    if (!rs.exists() || rs.data().status !== 'approved') throw new Error('Pengajuan karyawan ini belum disetujui atau sudah dibuatkan akun.');
  }
  const nid = isSuper ? null : await allocEmployeeId();
  let email = L.loginIdToEmail(username), uid;
  try { uid = await F.createAuthUser(email, password); } catch (e) {
    if (e.code !== 'auth/email-already-in-use') throw e; // login lama (karyawan yang sudah dihapus) masih tercatat di Firebase Auth
    email = `${username}.${Math.random().toString(36).slice(2, 7)}@${L.LOGIN_DOMAIN}`;
    uid = await F.createAuthUser(email, password);
  }
  const now = new Date().toISOString(), b = F.writeBatch(db);
  if (isSuper) {
    b.set(F.doc(db, 'users', uid), { username, name, role, email, createdAt: now, createdBy: state.user.name });
    b.set(F.doc(db, 'usernames', username), { email, uid });
    await b.commit(); bust();
    return { nid, email };
  }
  const done = L.completedYears(joinDate), quota = state.settings.annualQuota, link = employeeRequestId ? { employeeRequestId } : {};
  b.set(F.doc(db, 'users', uid), { username, name, role, employeeId: nid, email, companyId, companyIds, createdAt: now, ...link });
  b.set(F.doc(db, 'usernames', username), { email, uid });
  b.set(F.doc(db, 'employees', nid), { name, joinDate, companyId, leaveBalance: done >= 1 ? quota : 0, renewedYears: done, createdAt: now, ...link });
  if (done >= 1) b.set(F.doc(F.collection(db, 'ledger')), { employeeId: nid, employeeName: name, companyId, ts: now, type: 'Saldo awal', amount: quota, balanceAfter: quota, note: `Jatah tahun berjalan (masa kerja ${done} tahun)`, by: state.user.name });
  if (employeeRequestId) b.update(F.doc(db, 'employeeRequests', employeeRequestId), { status: 'created', employeeId: nid, createdBy: state.user.name, createdByUid: state.user.uid, createdAt: now });
  await b.commit();
  bust();
  return { nid, email };
}

async function accountForm({ roles, title }) {
  roles = roles.slice();
  const myCos = state.companies.filter((c) => c.active !== false && access().includes(c.id));
  if (!myCos.length) {
    if (!roles.includes('superuser')) { await info('Belum ada PT', '<p>Tambahkan PT lebih dulu di menu Perusahaan, lalu buat akunnya.</p>'); return false; }
    roles = ['superuser'];
  }
  const grantable = C.grantableIds(state.user, state.companies);
  const opts = roles.map((r) => `<option value="${r}">${esc(r === 'superuser' ? 'Superuser (owner tambahan)' : roleLabel(r))}</option>`).join('');
  const coOpts = myCos.map((c) => `<option value="${esc(c.id)}"${state.scope === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
  const extra = grantable.length > 1
    ? `<div class="field"><label>Boleh melihat PT lain (opsional)</label><div class="checks" id="acExtra">${state.companies.filter((c) => grantable.includes(c.id)).map((c) => `<label class="check"><input type="checkbox" value="${esc(c.id)}"> ${esc(c.name)}</label>`).join('')}</div><div class="hint">Akun ini juga bisa melihat karyawan di PT yang dicentang, selain PT utamanya.</div></div>`
    : '';
  const pw = randomPassword();
  const v = await dialog({
    title,
    body: `<div class="field"><label for="acName">Nama lengkap</label><input type="text" id="acName"></div>
      <div class="field"><label for="acUser">Username</label><input type="text" id="acUser" autocapitalize="none"></div>
      <div class="field"><label for="acRole">Role</label><select id="acRole" data-input="ac-role">${opts}</select><div class="hint" id="acSuperHint" hidden>Superuser punya akses penuh ke semua PT dan pengaturan. Hanya Superuser yang bisa menambahkannya.</div></div>
      <div id="acStd"><div class="field"><label for="acCompany">PT</label><select id="acCompany">${coOpts || '<option value="">-</option>'}</select></div>
      <div class="field"><label for="acJoin">Tanggal bergabung</label><input type="date" id="acJoin"></div>
      ${extra}</div>
      <div class="field"><label for="acPass">Password awal</label><input type="text" id="acPass" value="${pw}"><div class="hint">Berikan ke karyawan, lalu sarankan segera menggantinya di menu Profil.</div></div>`,
    okLabel: 'Buat akun',
    validate: () => {
      if (!$('#acName').value.trim()) return 'Isi nama lengkap.';
      const ue = L.validateUsername(L.normalizeUsername($('#acUser').value)); if (ue) return ue;
      if ($('#acRole').value !== 'superuser') {
        if (!$('#acCompany').value) return 'Pilih PT.';
        if (!L.parseDate($('#acJoin').value)) return 'Isi tanggal bergabung.';
      }
      if ($('#acPass').value.length < 6) return 'Password minimal 6 karakter.';
      return '';
    },
    getValue: () => {
      if ($('#acRole').value === 'superuser') return { name: $('#acName').value.trim(), username: L.normalizeUsername($('#acUser').value), role: 'superuser', password: $('#acPass').value };
      const home = $('#acCompany').value, chosen = $$('#acExtra input:checked').map((i) => i.value);
      return { name: $('#acName').value.trim(), username: L.normalizeUsername($('#acUser').value), role: $('#acRole').value, joinDate: $('#acJoin').value, password: $('#acPass').value,
        companyId: home, companyIds: C.nextAccessList({ home, current: [home], chosen, grantable }) };
    },
    onSubmit: createAccount,
  });
  if (!v) return false;
  await info('Akun dibuat', `<p>Catat dan berikan kepada karyawan:</p><p style="margin-top:10px">Username: <code>${esc(v.username)}</code><br>Password: <code>${esc(v.password)}</code>${v.companyId ? `<br>PT: <b>${esc(coName(v.companyId))}</b>` : '<br>Role: <b>Superuser</b>'}</p>`);
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
      <div class="field"><label for="stIzin">Peringatan izin berlebih (kali per bulan)</label><input type="number" id="stIzin" min="2" max="31" value="${izinWarn()}"><div class="hint">Bila izin (sakit, keluarga sakit, izin lainnya) mencapai angka ini dalam sebulan, HRD dan Direktur diberi tanda. Sabtu, Minggu, dan tanggal merah selalu tidak dihitung sebagai hari cuti.</div></div></div>
      <button class="btn btn-primary" type="submit">Simpan pengaturan</button></form></section>`
    + card('Pembaruan cuti tahunan', `<p style="margin-bottom:12px">Pembaruan berjalan otomatis saat Staff HRD, Kepala HRD, atau Superuser membuka portal. Anda juga bisa menjalankannya sekarang.</p><button class="btn btn-line" data-act="run-renewal">Jalankan pembaruan sekarang</button>`);
};

async function saveSettings() {
  const q = parseInt($('#stQuota').value, 10), c = parseInt($('#stCarry').value, 10), l = parseInt($('#stLock').value, 10);
  if (!(q >= 1 && q <= 60)) return toast('Jatah cuti harus 1–60 hari.', 'err');
  if (!(c >= 0 && c <= 60)) return toast('Batas sisa cuti harus 0–60 hari.', 'err');
  if (!(l >= 1 && l <= 28)) return toast('Tanggal kunci harus 1–28.', 'err');
  const iz = parseInt($('#stIzin').value, 10);
  if (!(iz >= 2 && iz <= 31)) return toast('Batas peringatan izin harus 2–31.', 'err');
  const next = { annualQuota: q, maxCarryOver: c, lockDay: l, excludeWeekends: true, izinWarn: iz };
  try { await F.setDoc(F.doc(db, 'settings', 'leave'), next); state.settings = { ...L.DEFAULT_SETTINGS, ...next }; toast('Pengaturan disimpan.', 'ok'); }
  catch (e) { toast(errMsg(e), 'err'); }
}

// ---------- Akun (Superuser) ----------
pages.accounts = async () => {
  const users = (await listAll('users')).slice().sort((a, b) => a.name.localeCompare(b.name, 'id'));
  const rows = users.map((x) => `<tr data-q="${esc((x.name + ' ' + x.username).toLowerCase())}"><td><div style="display:flex;gap:10px;align-items:center">${avatar(x, 'sm')}<b>${esc(x.name)}</b></div></td>
    <td><code>${esc(x.username)}</code></td><td><span class="badge b-role">${esc(roleLabel(x.role))}</span></td><td>${x.role === 'superuser' ? '<span class="sub">Semua PT</span>' : coChips(x)}</td>
    <td>${x.id === state.user.uid ? '<span class="sub">Akun Anda</span>' : `<div class="btn-row">${x.role !== 'superuser' ? `<button class="btn btn-line btn-sm" data-act="acc-access" data-uid="${esc(x.id)}">Akses PT</button>` : ''}<button class="btn btn-line btn-sm" data-act="acc-reset" data-id="${esc(x.id)}">Reset password</button><button class="btn btn-ghost btn-sm" data-act="acc-del" data-id="${esc(x.id)}">Hapus</button></div>`}</td></tr>`).join('');
  return pageHead('Akun', 'Superuser bisa lebih dari satu dan hanya Superuser yang bisa menambahkannya. Password disimpan aman oleh Firebase Authentication.', '<button class="btn btn-primary" data-act="acc-add">Tambah akun</button>')
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
  const t = (await listAll('users')).find((x) => x.id === uid); if (!t || uid === state.user.uid) return;
  if (t.employeeId) return deleteEmployee(t.employeeId);
  const ok = await confirmBox(`Hapus akun ${t.name}?`, t.role === 'superuser' ? 'Superuser ini tidak bisa login lagi. Pastikan masih ada Superuser lain.' : 'Akun tidak bisa login lagi.', 'Hapus', true);
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

// ---------- Kalender Kerja ----------
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => L.monthName(i));
const ymStr = () => `${state.cal.y}-${String(state.cal.m + 1).padStart(2, '0')}`;
const monthLabel = (ym) => { const r = W.monthRange(ym); return r ? `${MONTH_NAMES[r.m]} ${r.y}` : ym; };
const strip = (a) => a.map(({ start, end, name }) => ({ start, end, name }));
function draftFor(ym) {
  if (!state.cal.drafts[ym]) state.cal.drafts[ym] = strip(W.itemsOfMonth(state.holidays, ym));
  return state.cal.drafts[ym];
}
const holRange = (h) => (h.start === h.end ? fd(h.start) : `${fd(h.start)} – ${fd(h.end)}`);
const listBatches = async () => snapList(await F.getDocs(F.collection(db, 'holidayBatches'))).sort(byDateDesc('requestedAt'));
const batchBadge = (s) => `<span class="badge ${s === 'approved' ? 'b-ok' : s === 'pending' ? 'b-pending' : 'b-no'}">${esc(W.BATCH_STATUS[s] || s)}</span>`;
const itemList = (a) => a.map((i) => `${esc(holRange(i))} (${esc(i.name)})`).join(', ');

function calendarHtml(ym, pendItems, draft) {
  const { y, m } = state.cal, today = L.toISODate(new Date());
  const cell = (d) => {
    if (!d) return '<span class="cal-blank"></span>';
    const dt = L.parseDate(d), dow = dt.getDay(), hol = C.holidayAt(d, state.holidays);
    const pd = pendItems ? C.holidayAt(d, pendItems) : null, dr = draft ? C.holidayAt(d, draft) : null;
    const cls = ['cal-d', (dow === 0 || dow === 6) && 'we', hol && 'hol', draft && !hol && dr && 'draft', draft && hol && !dr && 'rm', !draft && !hol && pd && 'pend', d === today && 'today'].filter(Boolean).join(' ');
    const nm = hol ? hol.name : dr ? dr.name : pd ? pd.name : (dow === 0 || dow === 6) ? 'Akhir pekan' : '';
    return `<span class="${cls}" title="${esc(nm)}" aria-label="${esc(fd(d) + (nm ? ', ' + nm : ''))}">${dt.getDate()}</span>`;
  };
  return `<div class="cal-head"><button class="btn btn-line btn-sm" data-act="cal-nav" data-d="-1" aria-label="Bulan sebelumnya">‹</button><h3>${MONTH_NAMES[m]} ${y}</h3><button class="btn btn-line btn-sm" data-act="cal-nav" data-d="1" aria-label="Bulan berikutnya">›</button></div>
    <div class="cal-grid" role="group" aria-label="Kalender ${MONTH_NAMES[m]} ${y}">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => `<span class="cal-w">${d}</span>`).join('')}${C.monthGrid(y, m).flat().map(cell).join('')}</div>
    <div class="cal-legend"><span><i class="sw we"></i>Sabtu &amp; Minggu (selalu libur)</span><span><i class="sw hol"></i>Tanggal merah berlaku</span>${draft ? '<span><i class="sw draft"></i>Akan ditambah</span><span><i class="sw rm"></i>Akan dihapus</span>' : '<span><i class="sw pend"></i>Menunggu Direktur</span>'}</div>`;
}

pages.holidays = async () => {
  await loadHolidays();
  const u = state.user, canP = C.canProposeHoliday(u.role), canD = C.canDecideHoliday(u.role), owner = u.role === 'superuser';
  const ym = ymStr(), label = monthLabel(ym);
  state.batches = canP || canD ? await listBatches() : [];
  const cur = W.itemsOfMonth(state.holidays, ym);
  const pendThis = state.batches.find((b) => b.status === 'pending' && b.month === ym);
  const draft = canP && !pendThis ? draftFor(ym) : null;
  const dif = draft ? W.diffMonth(strip(cur), draft) : null;
  let h = pageHead('Kalender Kerja', canP ? 'Sabtu dan Minggu selalu libur. Untuk mengubah tanggal merah, gunakan tombol Add di bawah kalender, lalu Ajukan ke Direktur (per bulan).'
    : canD ? 'Setujui perubahan tanggal merah yang diajukan Kepala HRD. Berlaku untuk semua PT.' : 'Sabtu dan Minggu selalu libur. Tanggal berwarna merah adalah libur tambahan dan tidak memotong jatah cuti.');
  h += `<section class="card"><div id="calHost">${calendarHtml(ym, pendThis ? pendThis.items : null, draft)}</div></section>`;

  if (canP) {
    let inner;
    if (pendThis) {
      inner = `<p>Pengajuan ${esc(label)} sedang menunggu persetujuan Direktur. Anda bisa membatalkannya untuk mengubah lagi.</p><div class="sub" style="margin:8px 0">${itemList(pendThis.items) || 'Tidak ada tanggal merah'}</div>
        <button class="btn btn-line" data-act="hol-decide" data-kind="cancel" data-id="${esc(pendThis.id)}">Batalkan pengajuan</button>`;
    } else {
      const rows = draft.map((it, i) => {
        const exists = cur.some((c) => c.start === it.start && c.end === it.end && c.name === it.name);
        return `<tr><td>${esc(holRange(it))}</td><td><b>${esc(it.name)}</b></td><td>${exists ? '<span class="badge b-ok">Berlaku</span>' : '<span class="badge b-pending">Baru</span>'}</td><td><button class="btn btn-ghost btn-sm" data-act="hol-del" data-i="${i}">Hapus</button></td></tr>`;
      }).join('');
      inner = `<div class="btn-row" style="margin-bottom:12px"><button class="btn btn-primary" data-act="hol-add">Add</button>${dif.changed ? '<button class="btn btn-line" data-act="hol-reset">Batalkan perubahan</button>' : ''}</div>
        ${rows ? `<div class="tw"><table><thead><tr><th>Tanggal</th><th>Keterangan</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyHtml('Belum ada tanggal merah di bulan ini', 'Klik Add untuk menambah satu tanggal atau rentang.')}
        ${dif.removed.length ? `<p class="sub" style="margin-top:10px">Akan dihapus: ${itemList(dif.removed)}</p>` : ''}
        <div style="margin-top:14px"><button class="btn btn-primary" data-act="hol-submit"${dif.changed ? '' : ' disabled'}>Ajukan ${esc(label)} ke Direktur</button></div>`;
    }
    h += card(`Ubah tanggal merah - ${label}`, inner);
  }

  if (canD || canP) {
    const pend = state.batches.filter((b) => b.status === 'pending' && (canD || b.requestedByUid === u.uid));
    h += card(`Menunggu persetujuan Direktur (${pend.length})`, pend.length ? pend.map((b) => `<div class="q-item"><div class="q-main"><div class="who">${esc(monthLabel(b.month))}</div>
      <div class="meta">Diajukan ${esc(b.requestedBy)} · ${esc(W.stamp(b.requestedAt))}</div>
      ${(b.added || []).length ? `<div class="meta">Ditambah: ${itemList(b.added)}</div>` : ''}${(b.removed || []).length ? `<div class="meta">Dihapus: ${itemList(b.removed)}</div>` : ''}</div>
      <div class="q-act">${canD ? `<button class="btn btn-ok btn-sm" data-act="hol-decide" data-kind="approve" data-id="${esc(b.id)}">Setujui</button><button class="btn btn-line btn-sm" data-act="hol-decide" data-kind="reject" data-id="${esc(b.id)}">Tolak</button>`
      : `<button class="btn btn-line btn-sm" data-act="hol-decide" data-kind="cancel" data-id="${esc(b.id)}">Batalkan</button>`}</div></div>`).join('') : emptyHtml('Tidak ada yang menunggu'));
  }

  h += card(`Libur yang berlaku - ${label}`, `<p class="sub" style="margin-bottom:10px">Sabtu dan Minggu selalu libur. Tanggal merah di bawah ini tidak memotong jatah cuti.</p>`
    + (cur.length ? `<div class="tw"><table><thead><tr><th>Tanggal</th><th>Keterangan</th><th>Hari</th></tr></thead><tbody>${cur.map((x) => `<tr><td>${esc(holRange(x))}</td><td><b>${esc(x.name)}</b></td><td>${C.countLeaveDays(x.start, x.end)}</td></tr>`).join('')}</tbody></table></div>` : emptyHtml('Tidak ada tanggal merah di bulan ini')));

  if (canD || canP) {
    const past = state.batches.filter((b) => b.status !== 'pending').slice(0, 10);
    if (past.length) h += card('Riwayat pengajuan', `<div class="tw"><table><thead><tr><th>Bulan</th><th>Perubahan</th><th>Status</th></tr></thead><tbody>${past.map((b) => `<tr><td>${esc(monthLabel(b.month))}</td><td><span class="sub">${[(b.added || []).length ? 'Ditambah: ' + itemList(b.added) : '', (b.removed || []).length ? 'Dihapus: ' + itemList(b.removed) : ''].filter(Boolean).join(' · ') || '-'}</span></td><td>${batchBadge(b.status)}</td></tr>`).join('')}</tbody></table></div>`);
  }

  if (owner) {
    let log = [];
    try { log = snapList(await F.getDocs(F.collection(db, 'calendarLog'))).filter((x) => x.month === ym).sort(byDateDesc('at')); } catch (e) { console.warn('calendarLog', e); }
    h += card(`Riwayat perubahan - ${label}`, log.length ? `<div class="tw"><table><thead><tr><th>Waktu</th><th>Keputusan</th><th>Disetujui / diputuskan oleh</th><th>Diajukan oleh</th><th>Perubahan</th></tr></thead><tbody>${log.map((x) => `<tr><td class="mono">${esc(W.stamp(x.at))}</td><td>${batchBadge(x.action)}</td><td><b>${esc(x.by)}</b> <span class="sub">${esc(roleLabel(x.byRole))}</span></td><td>${esc(x.requestedBy)}</td>
      <td><span class="sub">${[(x.added || []).length ? 'Ditambah: ' + itemList(x.added) : '', (x.removed || []).length ? 'Dihapus: ' + itemList(x.removed) : ''].filter(Boolean).join(' · ') || '-'}</span></td></tr>`).join('')}</tbody></table></div>`
      : emptyHtml('Belum ada perubahan', 'Persetujuan perubahan kalender bulan ini akan tercatat lengkap dengan jam, menit, dan detik.'));
  }
  return h;
};

async function addHolidayItem() {
  const ym = ymStr(), r = W.monthRange(ym);
  const v = await dialog({
    title: `Add tanggal merah - ${monthLabel(ym)}`,
    body: `<div class="row2"><div class="field"><label for="hdA">Tanggal</label><input type="date" id="hdA" min="${r.first}" max="${r.last}" value="${r.first}"></div>
      <div class="field"><label for="hdB">Sampai tanggal (opsional)</label><input type="date" id="hdB" min="${r.first}" max="${r.last}"><div class="hint">Kosongkan jika hanya 1 tanggal.</div></div></div>
      <div class="field"><label for="hdName">Keterangan</label><input type="text" id="hdName" maxlength="60" placeholder="Contoh: Cuti bersama Natal"></div>`,
    okLabel: 'Tambahkan',
    getValue: () => ({ start: $('#hdA').value, end: $('#hdB').value || $('#hdA').value, name: $('#hdName').value.trim() }),
    validate: () => { const a = $('#hdA').value, b = $('#hdB').value || a; return W.addToDraft(draftFor(ym), { start: a, end: b, name: $('#hdName').value }, ym).error || ''; },
    onSubmit: (it) => { state.cal.drafts[ym] = W.addToDraft(draftFor(ym), it, ym).items; },
  });
  if (v) go('holidays');
}

async function submitHolidayBatch() {
  if (!C.canProposeHoliday(state.user.role)) throw new Error('Hanya Kepala HRD yang bisa mengajukan perubahan kalender.');
  const ym = ymStr(), draft = draftFor(ym);
  const dif = W.diffMonth(W.itemsOfMonth(state.holidays, ym), draft);
  if (!dif.changed) return toast('Belum ada perubahan untuk diajukan.', 'err');
  const fresh = await listBatches();
  if (fresh.some((b) => b.status === 'pending' && b.month === ym)) throw new Error('Masih ada pengajuan bulan ini yang menunggu Direktur.');
  if (!(await confirmBox(`Ajukan ${monthLabel(ym)}?`, `${dif.added.length} tanggal ditambah, ${dif.removed.length} dihapus. Pengajuan dikirim ke Direktur.`, 'Ajukan'))) return;
  await F.addDoc(F.collection(db, 'holidayBatches'), { month: ym, items: draft, added: dif.added, removed: dif.removed, status: 'pending', requestedBy: state.user.name, requestedByUid: state.user.uid, requestedAt: new Date().toISOString() });
  delete state.cal.drafts[ym]; bust(); toast('Diajukan ke Direktur.', 'ok'); go('holidays'); updateCounts();
}

async function holDecide(el) {
  const { id, kind } = el.dataset, u = state.user;
  const cfg = {
    approve: ['Setujui perubahan kalender?', 'Tanggal merah bulan ini diganti sesuai pengajuan, berlaku untuk semua PT dan tidak memotong jatah cuti. Persetujuan Anda dicatat lengkap dengan jam.', 'Setujui', false],
    reject: ['Tolak pengajuan?', 'Kalender tidak berubah.', 'Tolak', true],
    cancel: ['Batalkan pengajuan?', 'Pengajuan ini dibatalkan.', 'Batalkan', true],
  }[kind];
  if (!cfg || !(await confirmBox(cfg[0], cfg[1], cfg[2], cfg[3]))) return;
  const href = F.doc(db, 'holidayBatches', id), cref = F.doc(db, 'calendar', 'holidays');
  await F.runTransaction(db, async (tx) => {
    const hs = await tx.get(href), cs = await tx.get(cref);
    if (!hs.exists()) throw new Error('Pengajuan tidak ditemukan.');
    const bt = hs.data(), now = new Date().toISOString();
    if (bt.status !== 'pending') throw new Error('Pengajuan ini sudah diproses.');
    const who = { decidedBy: u.name, decidedByUid: u.uid, decidedAt: now };
    if (kind === 'cancel') {
      if (bt.requestedByUid !== u.uid) throw new Error('Hanya pengaju yang bisa membatalkan.');
      tx.update(href, { status: 'cancelled', ...who });
      return;
    }
    if (!C.canDecideHoliday(u.role)) throw new Error('Hanya Direktur yang bisa memutuskan perubahan kalender.');
    const action = kind === 'approve' ? 'approved' : 'rejected';
    tx.update(href, { status: action, ...who });
    if (kind === 'approve') tx.set(cref, { ranges: W.applyBatch(cs.exists() ? cs.data().ranges || [] : [], bt.month, bt.items || [], id), updatedAt: now });
    tx.set(F.doc(F.collection(db, 'calendarLog')), { month: bt.month, batchId: id, action, at: now, by: u.name, byUid: u.uid, byRole: u.role, requestedBy: bt.requestedBy, requestedAt: bt.requestedAt, added: bt.added || [], removed: bt.removed || [] });
  });
  await loadHolidays(); bust();
  toast({ approve: 'Kalender diperbarui.', reject: 'Pengajuan ditolak.', cancel: 'Pengajuan dibatalkan.' }[kind], 'ok');
  go('holidays'); updateCounts();
}

// ---------- Laporan Absensi ----------
const ATT_ROLES = ['staff_hrd', 'kepala_hrd', 'direktur', 'superuser'];
const CODE_FILL = { L: 'E4E0D8', C: 'CFE0F3', S: 'FBD9B5', I: 'FFF1A8', K: 'E1D3F2', T: 'F6C5C5', P: 'F6C5C5', H: 'D3EBD3' };
const CODE_STYLE = { L: STYLE.OFF, C: STYLE.C, S: STYLE.S, I: STYLE.I, K: STYLE.K, T: STYLE.LATE, P: STYLE.LATE, H: STYLE.H };
const cellCode = (c) => (c.code === 'H' && !c.late ? 'H' : (c.code + c.late));
const attMonths = () => {
  const now = new Date(), out = [];
  for (let i = 0; i < 12; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push({ v: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, y: d.getFullYear(), m: d.getMonth() }); }
  if (!out.some((m) => m.v === state.attMonth)) state.attMonth = out[0].v;
  return out;
};
async function attBuild() {
  if (!ATT_ROLES.includes(state.user.role)) throw new Error('Laporan absensi hanya untuk Staff HRD, Kepala HRD, Direktur, dan Superuser.');
  const months = attMonths(), sel = months.find((m) => m.v === state.attMonth);
  await loadHolidays();
  const [employees, requests] = await Promise.all([getEmployees(), listAll('requests')]);
  const att = R.buildAttendance({ employees, requests, holidays: state.holidays, year: sel.y, month: sel.m });
  const detail = R.detailRows({ employees, requests, year: sel.y, month: sel.m });
  const ids = state.scope === 'all' ? access() : [state.scope];
  const cos = state.companies.filter((c) => ids.includes(c.id)).map((c) => c.name).join(', ') || '-';
  return { months, sel, att, detail, cos };
}
const legendText = 'H hadir · C cuti · S sakit · I izin · K cuti khusus · T datang terlambat · P pulang terlambat · L libur (Sabtu/Minggu/tanggal merah)';

pages.attendance = async () => {
  const { months, sel, att, detail, cos } = await attBuild();
  const sumHead = ['ID', 'Nama', 'PT', 'Hari kerja', 'Hadir', 'Cuti', 'Sakit', 'Izin', 'Khusus', 'Datang terlambat', 'Pulang terlambat'];
  const rows = att.rows.map((r) => `<tr><td>${esc(r.emp.id)}</td><td><b>${esc(r.emp.name)}</b></td><td>${esc(coName(r.emp.companyId))}</td><td>${att.workDays}</td><td>${r.sums.H}</td><td>${r.sums.C}</td><td>${r.sums.S}</td><td>${r.sums.I}</td><td>${r.sums.K}</td><td>${r.sums.T}</td><td>${r.sums.P}</td></tr>`).join('');
  const mhead = att.days.map((d) => `<th class="mc${d.off ? ' off' : ''}">${d.day}</th>`).join('');
  const mrows = att.rows.map((r) => `<tr><td class="mname"><b>${esc(r.emp.name)}</b></td>${r.cells.map((c) => `<td class="mc c-${esc((c.code || '-').toLowerCase())}">${esc(cellCode(c))}</td>`).join('')}</tr>`).join('');
  return pageHead('Laporan Absensi', `${att.label} · ${cos}`, `<button class="btn btn-line btn-sm" data-act="att-xlsx">Unduh Excel</button><button class="btn btn-primary btn-sm" data-act="att-pdf">Unduh PDF</button>`)
    + `<div class="toolbar"><select id="attMonth" data-input="att-month" aria-label="Pilih bulan">${months.map((m) => `<option value="${m.v}" ${m.v === sel.v ? 'selected' : ''}>${L.monthName(m.m)} ${m.y}</option>`).join('')}</select></div>`
    + banner('info', '', `Hadir dihitung dari hari kerja dikurangi cuti, izin, dan sakit yang sudah disetujui. Sistem ini tidak membaca mesin absen. ${legendText}.`)
    + card(`Rekap (${att.rows.length} karyawan)`, att.rows.length ? `<div class="tw"><table><thead><tr>${sumHead.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` : emptyHtml('Belum ada karyawan', 'Pilih PT lain atau tambahkan karyawan.'))
    + card('Harian', att.rows.length ? `<div class="tw"><table class="matrix"><thead><tr><th class="mname">Nama</th>${mhead}</tr></thead><tbody>${mrows}</tbody></table></div>` : emptyHtml('Belum ada data'))
    + card(`Rincian pengajuan disetujui (${detail.length})`, detail.length ? `<div class="tw"><table><thead><tr><th>Nama</th><th>Jenis</th><th>Periode</th><th>Hari</th><th>Keterangan</th></tr></thead><tbody>${detail.map((d) => `<tr><td><b>${esc(d.name)}</b></td><td>${esc(d.kind)}${d.family ? ` (${esc(d.family)})` : ''}</td><td>${esc(holRange({ start: d.start, end: d.end }))}</td><td>${d.auto ? '-' : d.days}</td><td><span class="sub">${esc(d.detail)}</span></td></tr>`).join('')}</tbody></table></div>` : emptyHtml('Tidak ada pengajuan disetujui bulan ini'));
};

function downloadBytes(name, bytes, mime) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const sumCols = ['H', 'C', 'S', 'I', 'K', 'T', 'P'];
const fileMonth = () => state.attMonth;

async function exportAttendanceXlsx() {
  const { att, detail, cos } = await attBuild();
  if (!att.rows.length) return toast('Belum ada data untuk diunduh.', 'err');
  const meta = [[{ v: `Laporan Absensi - ${att.label}`, s: STYLE.TITLE }], [`PT: ${cos}`], [`Dibuat ${W.stamp(new Date().toISOString())} oleh ${state.user.name}`], [legendText], []];
  const H = (arr) => arr.map((v) => ({ v, s: STYLE.HEAD }));
  const sum = R.summaryTable(att, coName);
  const rekap = [...meta, H(sum.head), ...sum.body.map((r) => r.map((v, i) => ({ v, s: i < 3 ? STYLE.TEXT : STYLE.NUM })))];
  const mx = R.matrixTable(att, coName);
  const harian = [...meta, H([...mx.head, ...sumCols]),
    ...att.rows.map((r, ri) => [{ v: r.emp.id, s: STYLE.TEXT }, { v: r.emp.name, s: STYLE.TEXT }, { v: coName(r.emp.companyId), s: STYLE.TEXT },
      ...r.cells.map((c) => { const v = cellCode(c); return v ? { v, s: CODE_STYLE[v[0]] || STYLE.CENTER } : { v: '', s: STYLE.CENTER }; }),
      ...sumCols.map((k) => ({ v: r.sums[k], s: STYLE.NUM }))])];
  const dt = R.detailTable(detail, coName);
  const det = [...meta, H(dt.head), ...dt.body.map((r) => r.map((v) => ({ v, s: STYLE.TEXT })))];
  const bytes = buildXlsx([
    { name: 'Rekap', rows: rekap, widths: [10, 30, 22, 11, 9, 9, 9, 9, 10, 18, 18], freeze: { row: 6, col: 2 } },
    { name: 'Harian', rows: harian, widths: [10, 28, 20, ...att.days.map(() => 5), ...sumCols.map(() => 5)], freeze: { row: 6, col: 2 } },
    { name: 'Rincian', rows: det, widths: [10, 28, 20, 30, 7, 12, 12, 10, 40, 28], freeze: { row: 6, col: 0 } },
  ]);
  downloadBytes(`absensi-${fileMonth()}.xlsx`, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  toast('File Excel diunduh.', 'ok');
}

async function exportAttendancePdf() {
  const { att, detail, cos } = await attBuild();
  if (!att.rows.length) return toast('Belum ada data untuk diunduh.', 'err');
  const fc = (v) => (v ? { t: v, fill: CODE_FILL[v[0]] || '' } : '');
  const sum = R.summaryTable(att, coName), mx = R.matrixTable(att, coName), dt = R.detailTable(detail, coName);
  const bytes = buildPdf({
    footer: `Laporan Absensi ${att.label} - ${cos}`,
    blocks: [
      { type: 'title', text: `Laporan Absensi - ${att.label}` },
      { type: 'note', text: `PT: ${cos}\nDibuat ${W.stamp(new Date().toISOString())} oleh ${state.user.name}\n${legendText}\nHadir = hari kerja dikurangi cuti, izin, dan sakit yang disetujui.` },
      { type: 'table', heading: 'Rekap', head: sum.head, rows: sum.body, widths: [38, 160, 110, 50, 42, 42, 42, 42, 48, 70, 70], align: ['l', 'l', 'l', 'c', 'c', 'c', 'c', 'c', 'c', 'c', 'c'] },
      { type: 'table', heading: 'Harian', head: [mx.head[0], mx.head[1], ...att.days.map((d) => String(d.day)), ...sumCols],
        rows: att.rows.map((r) => [r.emp.id, r.emp.name, ...r.cells.map((c) => fc(cellCode(c))), ...sumCols.map((k) => r.sums[k])]),
        widths: [34, 108, ...att.days.map(() => 13.2), ...sumCols.map(() => 17)], align: ['l', 'l', ...att.days.map(() => 'c'), ...sumCols.map(() => 'c')] },
      ...(dt.body.length ? [{ type: 'table', heading: 'Rincian pengajuan disetujui', head: dt.head, rows: dt.body, widths: [34, 105, 80, 140, 26, 54, 54, 36, 130, 90] }] : []),
    ],
  });
  downloadBytes(`absensi-${fileMonth()}.pdf`, bytes, 'application/pdf');
  toast('File PDF diunduh.', 'ok');
}

// ---------- Karyawan baru (diajukan, disetujui, lalu akun dibuat Kepala HRD) ----------
const EMPREQ_LABEL = { pending_head: 'Menunggu Kepala HRD', pending_director: 'Menunggu Direktur', approved: 'Disetujui, akun belum dibuat', rejected: 'Ditolak', created: 'Akun sudah dibuat' };
const empReqBadge = (s) => `<span class="badge ${s === 'created' || s === 'approved' ? 'b-ok' : s === 'rejected' ? 'b-no' : 'b-pending'}">${esc(EMPREQ_LABEL[s] || s)}</span>`;
const NEWEMP_ROLES = ['staff_hrd', 'kepala_hrd', 'direktur'];
const empReqAction = (u, r) => {
  if (!C.inAccess(u, r.companyId, state.companies)) return null;
  if (r.status === 'pending_head' && u.role === 'kepala_hrd' && r.requestedByUid !== u.uid) return 'head';
  if (r.status === 'pending_director' && u.role === 'direktur') return 'director';
  return null;
};
const canCreateFrom = (u, r) => r.status === 'approved' && u.role === 'kepala_hrd' && C.inAccess(u, r.companyId, state.companies);

function empReqRow(r) {
  const u = state.user, act = empReqAction(u, r);
  return `<div class="q-item"><div class="q-main"><div class="who">${esc(r.name)} <span class="badge b-role">${esc(roleLabel(r.role))}</span> ${empReqBadge(r.status)}</div>
    <div class="meta">Username <code>${esc(r.username)}</code> · PT ${esc(coName(r.companyId))} · bergabung ${esc(fd(r.joinDate))}</div>
    <div class="meta">Diajukan ${esc(r.requestedBy)} (${esc(roleLabel(r.requestedByRole))}) · ${esc(fdt(r.requestedAt))}${r.decidedBy ? ` · diputuskan ${esc(r.decidedBy)}` : ''}</div>
    ${r.rejectNote ? `<div class="meta">Alasan ditolak: ${esc(r.rejectNote)}</div>` : ''}${r.employeeId ? `<div class="meta">ID karyawan ${esc(r.employeeId)}</div>` : ''}</div>
    <div class="q-act">${act ? `<button class="btn btn-ok btn-sm" data-act="er-decide" data-yes="1" data-id="${esc(r.id)}">Setujui</button><button class="btn btn-line btn-sm" data-act="er-decide" data-yes="0" data-id="${esc(r.id)}">Tolak</button>` : ''}
    ${canCreateFrom(u, r) ? `<button class="btn btn-primary btn-sm" data-act="er-create" data-id="${esc(r.id)}">Buat akun</button>` : ''}</div></div>`;
}

pages.newemp = async () => {
  const u = state.user;
  if (!NEWEMP_ROLES.includes(u.role)) return pageHead('Karyawan Baru') + banner('warn', 'Menu ini tidak tersedia untuk role Anda.');
  const list = (await listAll('employeeRequests')).slice().sort(byDateDesc('requestedAt'));
  const mineAct = list.filter((r) => empReqAction(u, r)), ready = list.filter((r) => canCreateFrom(u, r));
  const rest = list.filter((r) => !mineAct.includes(r) && !ready.includes(r));
  const canAsk = u.role === 'staff_hrd' || u.role === 'kepala_hrd';
  const sub = u.role === 'staff_hrd' ? 'Pengajuan Anda disetujui Kepala HRD, lalu Kepala HRD membuat akunnya.'
    : u.role === 'kepala_hrd' ? 'Persetujuan pengajuan Staff HRD ada di sini. Pengajuan Anda sendiri disetujui Direktur. Setelah disetujui, Anda membuat akunnya.' : 'Setujui penambahan karyawan yang diajukan Kepala HRD.';
  let h = pageHead('Karyawan Baru', sub, canAsk ? '<button class="btn btn-primary" data-act="er-add">Ajukan karyawan baru</button>' : '');
  if (mineAct.length || u.role !== 'staff_hrd') h += card(`Menunggu persetujuan Anda (${mineAct.length})`, mineAct.length ? mineAct.map(empReqRow).join('') : emptyHtml('Tidak ada yang menunggu'));
  if (u.role === 'kepala_hrd') h += card(`Siap dibuatkan akun (${ready.length})`, ready.length ? ready.map(empReqRow).join('') : emptyHtml('Belum ada', 'Pengajuan yang sudah disetujui akan muncul di sini.'));
  h += card('Semua pengajuan', rest.length ? rest.map(empReqRow).join('') : emptyHtml('Belum ada pengajuan'));
  return h;
};

async function empReqForm() {
  const u = state.user;
  const cos = state.companies.filter((c) => c.active !== false && access().includes(c.id));
  if (!cos.length) return info('Belum ada PT', '<p>Anda belum punya akses PT aktif.</p>');
  const coField = cos.length > 1
    ? `<div class="field"><label for="erCo">Letakkan karyawan di PT</label><select id="erCo">${cos.map((c) => `<option value="${esc(c.id)}"${state.scope === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`
    : `<div class="field"><label>PT</label><div class="static">${esc(cos[0].name)}</div><input type="hidden" id="erCo" value="${esc(cos[0].id)}"></div>`;
  const v = await dialog({
    title: 'Ajukan karyawan baru',
    body: `<div class="field"><label for="erName">Nama lengkap</label><input type="text" id="erName"></div>
      <div class="field"><label for="erUser">Username</label><input type="text" id="erUser" autocapitalize="none"></div>
      ${coField}
      <div class="row2"><div class="field"><label for="erRole">Role</label><select id="erRole">${L.HRD_CREATABLE_ROLES.map((r) => `<option value="${r}">${esc(roleLabel(r))}</option>`).join('')}</select></div>
      <div class="field"><label for="erJoin">Tanggal bergabung</label><input type="date" id="erJoin"></div></div>
      <div class="hint">${u.role === 'kepala_hrd' ? 'Pengajuan ini akan disetujui Direktur.' : 'Pengajuan ini akan disetujui Kepala HRD.'} Akun dibuat Kepala HRD setelah disetujui.</div>`,
    okLabel: 'Kirim pengajuan',
    validate: () => {
      if (!$('#erName').value.trim()) return 'Isi nama lengkap.';
      const ue = L.validateUsername(L.normalizeUsername($('#erUser').value)); if (ue) return ue;
      if (!$('#erCo').value) return 'Pilih PT.';
      if (!L.parseDate($('#erJoin').value)) return 'Isi tanggal bergabung.';
      return '';
    },
    getValue: () => ({ name: $('#erName').value.trim(), username: L.normalizeUsername($('#erUser').value), companyId: $('#erCo').value, role: $('#erRole').value, joinDate: $('#erJoin').value }),
    onSubmit: async (d) => {
      if (!access().includes(d.companyId)) throw new Error('PT di luar akses Anda.');
      if ((await F.getDoc(F.doc(db, 'usernames', d.username))).exists()) throw new Error('Username sudah dipakai.');
      bust();
      if ((await listAll('employeeRequests')).some((r) => r.username === d.username && ['pending_head', 'pending_director', 'approved'].includes(r.status))) throw new Error('Username ini sudah ada di pengajuan lain.');
      await F.addDoc(F.collection(db, 'employeeRequests'), { ...d, status: u.role === 'kepala_hrd' ? 'pending_director' : 'pending_head', requestedBy: u.name, requestedByUid: u.uid, requestedByRole: u.role, requestedAt: new Date().toISOString() });
      bust();
    },
  });
  if (v) { toast('Pengajuan terkirim.', 'ok'); go('newemp'); }
}

async function decideEmpReq(el) {
  const id = el.dataset.id, approve = el.dataset.yes === '1', u = state.user;
  let note = '';
  if (!approve) {
    const n = await dialog({ title: 'Tolak pengajuan karyawan', body: '<div class="field"><label for="erNote">Alasan penolakan</label><textarea id="erNote" maxlength="300"></textarea></div>', okLabel: 'Tolak', danger: true,
      validate: () => ($('#erNote').value.trim() ? '' : 'Isi alasan penolakan.'), getValue: () => $('#erNote').value.trim() });
    if (n === null) return; note = n;
  } else if (!(await confirmBox('Setujui karyawan baru?', 'Setelah disetujui, Kepala HRD dapat membuat akunnya.', 'Setujui'))) return;
  const ref = F.doc(db, 'employeeRequests', id);
  await F.runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('Pengajuan tidak ditemukan.');
    const r = { id, ...s.data() };
    if (!empReqAction(u, r)) throw new Error('Pengajuan ini sudah diproses atau bukan wewenang Anda.');
    const who = { decidedBy: u.name, decidedByUid: u.uid, decidedByRole: u.role, decidedAt: new Date().toISOString() };
    tx.update(ref, approve ? { status: 'approved', ...who } : { status: 'rejected', rejectNote: note, ...who });
  });
  bust(); toast(approve ? 'Disetujui.' : 'Ditolak.', 'ok'); go('newemp'); updateCounts();
}

async function createFromEmpReq(id) {
  const u = state.user;
  const r = (await listAll('employeeRequests')).find((x) => x.id === id);
  if (!r || !canCreateFrom(u, r)) return toast('Pengajuan ini tidak bisa dibuatkan akun.', 'err');
  const pw = randomPassword();
  const v = await dialog({
    title: `Buat akun - ${r.name}`,
    body: `<p style="margin-bottom:12px">Username <code>${esc(r.username)}</code> · ${esc(roleLabel(r.role))} · ${esc(coName(r.companyId))}</p>
      <div class="field"><label for="erPass">Password awal</label><input type="text" id="erPass" value="${pw}"><div class="hint">Berikan ke karyawan, lalu sarankan segera menggantinya di menu Profil. Password tidak disimpan di pengajuan.</div></div>`,
    okLabel: 'Buat akun',
    validate: () => ($('#erPass').value.length < 6 ? 'Password minimal 6 karakter.' : ''),
    getValue: () => $('#erPass').value,
    onSubmit: (password) => createAccount({ name: r.name, username: r.username, role: r.role, joinDate: r.joinDate, password, companyId: r.companyId, companyIds: [r.companyId], employeeRequestId: r.id }),
  });
  if (v) { await info('Akun dibuat', `<p>Catat dan berikan kepada karyawan:</p><p style="margin-top:10px">Username: <code>${esc(r.username)}</code><br>Password: <code>${esc(v)}</code><br>PT: <b>${esc(coName(r.companyId))}</b></p>`); bust(); go('newemp'); updateCounts(); }
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
  'cal-nav': (el) => { const c = state.cal, d = new Date(c.y, c.m + parseInt(el.dataset.d, 10), 1); c.y = d.getFullYear(); c.m = d.getMonth(); go('holidays'); },
  'hol-add': addHolidayItem,
  'hol-del': (el) => { const ym = ymStr(); state.cal.drafts[ym] = W.removeFromDraft(draftFor(ym), parseInt(el.dataset.i, 10)); go('holidays'); },
  'hol-reset': () => { delete state.cal.drafts[ymStr()]; go('holidays'); },
  'hol-submit': submitHolidayBatch,
  'hol-decide': holDecide,
  'att-xlsx': exportAttendanceXlsx,
  'att-pdf': exportAttendancePdf,
  'att-view': (el) => viewAttachments(el.dataset.id),
  'lv-photo': () => { $('#lvPhotoInput').click(); },
  'lv-photo-del': (el) => { state.photos.splice(parseInt(el.dataset.i, 10), 1); renderPhotos(); updateCalc(); },
  'er-add': empReqForm,
  'er-decide': decideEmpReq,
  'er-create': (el) => createFromEmpReq(el.dataset.id),
  logout: () => F.signOut(auth),
  'm-ok': dialogOk,
  'm-cancel': dialogCancel,
  'm-bg': (el, e) => { if (e.target === el) dialogCancel(); },
  decide,
  'export-requests': exportRequests,
  'export-ledger': exportLedger,
  'adj-open': (el) => openAdjust(el.dataset.id),
  'acc-add': async () => { if (await accountForm({ roles: ['superuser', ...Object.keys(L.ROLES).filter((r) => r !== 'superuser')], title: 'Tambah akun' })) reload(); },
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
const submits = { login: doLogin, setup: doSetup, leave: submitLeave, settings: saveSettings, password: changePassword };
const inputs = {
  calc: updateCalc,
  'lv-photo-file': addPhotos,
  'att-month': (el) => { state.attMonth = el.value; go('attendance'); },
  'ac-role': (el) => { const sup = el.value === 'superuser'; $('#acStd').hidden = sup; $('#acSuperHint').hidden = !sup; },
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
