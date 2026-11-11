// logic.js — logika murni (tanpa Firebase / DOM) agar bisa diuji otomatis.

export const ROLES = {
  superuser: 'Superuser',
  direktur: 'Direktur',
  komisaris: 'Komisaris',
  kepala_hrd: 'Kepala HRD',
  staff_hrd: 'Staff HRD',
  staff: 'Staff Biasa',
};

// Role yang boleh dibuat oleh Staff HRD (sama seperti versi lama).
export const HRD_CREATABLE_ROLES = ['staff', 'staff_hrd'];

export const DEFAULT_SETTINGS = {
  annualQuota: 12, // jatah cuti tahunan
  maxCarryOver: 0, // sisa cuti positif yang boleh dibawa ke tahun berikutnya
  lockDay: 10, // setelah tanggal ini, bulan lalu dikunci
  excludeWeekends: false, // true = Sabtu/Minggu tidak dihitung
};

// deduct: true  -> memotong saldo cuti tahunan
// deduct: false -> tercatat & disetujui, saldo tidak berubah
export const LEAVE_TYPES = [
  { id: 'Cuti Tahunan', category: 'Cuti', deduct: true },
  { id: 'Cuti Besar', category: 'Cuti', deduct: true },
  { id: 'Cuti Mendesak', category: 'Cuti', deduct: true },
  { id: 'Cuti Wajib', category: 'Cuti', deduct: true },
  { id: 'Cuti Sakit', category: 'Sakit', deduct: false },
  { id: 'Cuti Kecelakaan Kerja', category: 'Sakit', deduct: false },
  { id: 'Cuti Sakit Keluarga', category: 'Sakit', deduct: false },
  { id: 'Cuti Melahirkan', category: 'Khusus', deduct: false },
  { id: 'Cuti Keguguran', category: 'Khusus', deduct: false },
  { id: 'Cuti Ayah', category: 'Khusus', deduct: false },
  { id: 'Cuti Pernikahan', category: 'Khusus', deduct: false },
  { id: 'Cuti Kematian Keluarga', category: 'Khusus', deduct: false },
  { id: 'Cuti Haji/Umroh', category: 'Khusus', deduct: false },
  { id: 'Cuti Ibadah', category: 'Khusus', deduct: false },
  { id: 'Cuti Dokumen Negara', category: 'Khusus', deduct: false },
  { id: 'Cuti Pindah Rumah', category: 'Khusus', deduct: false },
  { id: 'Cuti Ujian', category: 'Khusus', deduct: false },
  { id: 'Cuti Serikat Pekerja', category: 'Khusus', deduct: false },
  { id: 'Cuti Bencana Alam', category: 'Khusus', deduct: false },
  { id: 'Cuti Tugas Negara', category: 'Khusus', deduct: false },
  { id: 'Izin Tidak Masuk', category: 'Izin', deduct: false },
  { id: 'Izin Datang Terlambat', category: 'Izin', deduct: false },
  { id: 'Izin Pulang Cepat', category: 'Izin', deduct: false },
  { id: 'Lainnya', category: 'Lainnya', deduct: true, needsDetail: true },
];

export function leaveTypeById(id) {
  return LEAVE_TYPES.find((t) => t.id === id) || null;
}

// ---------- Aman untuk HTML ----------
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Tanggal (selalu waktu lokal, format 'YYYY-MM-DD') ----------
export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

export function toISODate(dt) {
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function startOfDay(dt) {
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

// Jumlah hari inklusif. 0 jika tanggal tidak valid atau akhir < mulai.
export function daysBetween(start, end, opts = {}) {
  const a = parseDate(start), b = parseDate(end);
  if (!a || !b || b < a) return 0;
  const total = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000) + 1;
  if (!opts.excludeWeekends) return total;
  let n = 0;
  for (let i = 0; i < total; i++) {
    const d = new Date(a.getFullYear(), a.getMonth(), a.getDate() + i).getDay();
    if (d !== 0 && d !== 6) n++;
  }
  return n;
}

export const MAX_LEAVE_SPAN_DAYS = 366;

// Mengembalikan pesan error, atau '' jika valid.
export function validateRange(start, end) {
  const a = parseDate(start), b = parseDate(end);
  if (!a || !b) return 'Pilih tanggal mulai dan selesai.';
  if (b < a) return 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
  if (daysBetween(start, end) > MAX_LEAVE_SPAN_DAYS) return 'Rentang cuti maksimal 1 tahun.';
  return '';
}

// ---------- Kelayakan & auto renewal ----------
export function addYears(dt, n) {
  const y = dt.getFullYear() + n, m = dt.getMonth(), d = dt.getDate();
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d, last));
}

// Jumlah tahun masa kerja yang sudah genap.
export function completedYears(joinDate, now = new Date()) {
  const j = parseDate(joinDate);
  if (!j) return 0;
  const today = startOfDay(now);
  let y = today.getFullYear() - j.getFullYear();
  if (y < 0) return 0;
  if (addYears(j, y) > today) y--;
  return Math.max(0, y);
}

export function isEligible(joinDate, now = new Date()) {
  return completedYears(joinDate, now) >= 1;
}

export function nextRenewalDate(joinDate, now = new Date()) {
  const j = parseDate(joinDate);
  if (!j) return null;
  return addYears(j, Math.max(1, completedYears(joinDate, now) + 1));
}

// Satu siklus pembaruan: hutang (saldo negatif) dipotong dari jatah baru,
// sisa positif dibawa maksimal `maxCarryOver`.
export function renewBalance(balance, settings = DEFAULT_SETTINGS) {
  const carry = Math.min(Math.max(balance, 0), settings.maxCarryOver);
  const debt = Math.min(balance, 0);
  return carry + debt + settings.annualQuota;
}

// Hasil:
//  null                          -> tidak ada yang perlu dilakukan
//  { initOnly, renewedYears }    -> data lama tanpa penanda; hanya set penanda, tanpa tambahan saldo
//  { renewedYears, newBalance, entries[] } -> pembaruan yang harus ditulis
export function computeRenewal(emp, now = new Date(), settings = DEFAULT_SETTINGS) {
  const done = completedYears(emp.joinDate, now);
  if (typeof emp.renewedYears !== 'number') {
    return { initOnly: true, renewedYears: done };
  }
  if (done <= emp.renewedYears) return null;
  const j = parseDate(emp.joinDate);
  let bal = emp.leaveBalance || 0;
  const entries = [];
  for (let k = emp.renewedYears + 1; k <= done; k++) {
    const before = bal;
    bal = renewBalance(bal, settings);
    entries.push({
      ts: addYears(j, k).toISOString(),
      type: 'Pembaruan Cuti Tahunan',
      amount: bal - before,
      balanceAfter: bal,
      note: `Tahun masa kerja ke-${k}: jatah ${settings.annualQuota} hari` + (before < 0 ? `, hutang ${Math.abs(before)} hari dipotong` : ''),
    });
  }
  return { renewedYears: done, newBalance: bal, entries };
}

// ---------- Lock bulan ----------
// Tanggal paling awal yang masih boleh diajukan.
export function lockCutoff(now = new Date(), lockDay = DEFAULT_SETTINGS.lockDay) {
  const t = startOfDay(now);
  return t.getDate() <= lockDay
    ? new Date(t.getFullYear(), t.getMonth() - 1, 1)
    : new Date(t.getFullYear(), t.getMonth(), 1);
}

export function isDateLocked(dateStr, now = new Date(), lockDay = DEFAULT_SETTINGS.lockDay) {
  const d = parseDate(dateStr);
  return !!d && d < lockCutoff(now, lockDay);
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const monthName = (i) => MONTHS[i];

export function lockMessage(now = new Date(), lockDay = DEFAULT_SETTINGS.lockDay) {
  const c = lockCutoff(now, lockDay);
  return `Pengajuan sebelum ${c.getDate()} ${MONTHS[c.getMonth()]} ${c.getFullYear()} sudah dikunci.`;
}

// ---------- Saldo ----------
export function projectBalance(balance, days, deduct) {
  return deduct ? balance - days : balance;
}

export function validateAdjustment(days, requesterEmpId, targetEmpId) {
  if (!Number.isInteger(days) || days === 0) return 'Isi jumlah hari berupa bilangan bulat, bukan 0.';
  if (Math.abs(days) > 60) return 'Penyesuaian maksimal 60 hari sekali ajuan.';
  if (requesterEmpId && requesterEmpId === targetEmpId) return 'Tidak bisa menyesuaikan saldo sendiri.';
  return '';
}

// ---------- Alur persetujuan ----------
export const STATUS = {
  PENDING_REVIEW: 'pending_review',
  PENDING_HEAD: 'pending_head',
  PENDING_DIRECTOR: 'pending_director',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const STATUS_LABEL = {
  pending_review: 'Menunggu review Staff HRD',
  pending_head: 'Menunggu Kepala HRD',
  pending_director: 'Menunggu Direktur',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};
export const statusLabel = (s) => STATUS_LABEL[s] || s;
export const isPending = (s) => typeof s === 'string' && s.startsWith('pending');

// Role yang boleh mengajukan cuti, beserta status awalnya.
export function initialStatus(role) {
  if (role === 'staff' || role === 'staff_hrd') return STATUS.PENDING_REVIEW;
  if (role === 'kepala_hrd') return STATUS.PENDING_DIRECTOR;
  return null;
}

// Aksi yang boleh dilakukan user pada sebuah pengajuan.
export function actionFor(user, req) {
  if (!user || !req) return null;
  if (user.employeeId && req.employeeId === user.employeeId) return null; // tidak boleh memproses ajuan sendiri
  if (req.status === STATUS.PENDING_REVIEW && user.role === 'staff_hrd') return 'review';
  if (req.status === STATUS.PENDING_HEAD && user.role === 'kepala_hrd') return 'head';
  if (req.status === STATUS.PENDING_DIRECTOR && user.role === 'direktur') return 'director';
  return null;
}

// Menghasilkan field yang harus ditulis ke dokumen pengajuan.
export function decisionPatch(action, approve, user, nowISO, note = '') {
  const who = { decidedBy: user.name, decidedByUid: user.uid || '', decidedRole: user.role, decidedAt: nowISO };
  if (!approve) return { status: STATUS.REJECTED, rejectNote: note, ...who };
  if (action === 'review') {
    return { status: STATUS.PENDING_HEAD, reviewedBy: user.name, reviewedByUid: user.uid || '', reviewedAt: nowISO };
  }
  return { status: STATUS.APPROVED, ...who };
}

// ---------- Menu per role ----------
export function navFor(role) {
  switch (role) {
    case 'superuser': return ['accounts', 'employees', 'mutations', 'report', 'settings', 'profile'];
    case 'staff': return ['dashboard', 'apply', 'profile'];
    case 'staff_hrd': return ['dashboard', 'apply', 'review', 'adjust', 'employees', 'profile'];
    case 'kepala_hrd': return ['dashboard', 'apply', 'employees', 'profile'];
    case 'direktur': return ['approval', 'employees', 'mutations', 'report', 'profile'];
    case 'komisaris': return ['employees', 'mutations', 'report', 'profile'];
    default: return ['profile'];
  }
}

// ---------- Akun ----------
export function normalizeUsername(u) {
  return String(u || '').trim().toLowerCase();
}

export function validateUsername(u) {
  const ok = /^[a-z0-9._-]{3,30}$/.test(u) && !/^\.+$/.test(u) && !/^__.*__$/.test(u); // dua pola terakhir tidak boleh jadi ID dokumen Firestore
  return ok ? '' : 'Username 3–30 karakter: huruf, angka, titik, strip, atau garis bawah.';
}

export const LOGIN_DOMAIN = 'hrd.portal';

// Pengguna boleh login dengan username atau email asli.
export function loginIdToEmail(id, mapped) {
  const v = normalizeUsername(id);
  if (v.includes('@')) return v;
  return mapped || `${v}@${LOGIN_DOMAIN}`;
}

export function nextEmployeeId(employees) {
  let max = 0;
  for (const e of employees) {
    const m = /^E(\d{3,})$/.exec(e.id || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return 'E' + String(max + 1).padStart(3, '0');
}

// ---------- Laporan ----------
function dateOfRequest(r) {
  return new Date(r.decidedAt || r.createdAt || 0);
}

export function buildReport(employees, requests, adjustments, year, month) {
  const inMonth = (d) => d.getFullYear() === year && d.getMonth() === month;
  const reqs = requests.filter((r) => inMonth(dateOfRequest(r)));
  const approved = reqs.filter((r) => r.status === STATUS.APPROVED);
  const rejected = reqs.filter((r) => r.status === STATUS.REJECTED);
  const pending = reqs.filter((r) => isPending(r.status));
  const totalDays = approved.reduce((s, r) => s + (r.days || 0), 0);

  const byEmp = {};
  approved.forEach((r) => { byEmp[r.employeeName] = (byEmp[r.employeeName] || 0) + (r.days || 0); });
  const top = Object.entries(byEmp).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, days]) => ({ name, days }));

  const byReason = {};
  approved.forEach((r) => { const k = r.reasonType || 'Lainnya'; byReason[k] = (byReason[k] || 0) + 1; });

  const adjs = adjustments.filter((a) => inMonth(new Date(a.decidedAt || a.requestedAt || 0)));
  const totalBalance = employees.reduce((s, e) => s + (e.leaveBalance || 0), 0);

  return {
    employees: employees.length,
    requests: reqs.length,
    approved: approved.length,
    rejected: rejected.length,
    pending: pending.length,
    totalDays,
    avgDays: employees.length ? +(totalDays / employees.length).toFixed(1) : 0,
    approvalRate: reqs.length ? Math.round((approved.length / reqs.length) * 100) : 0,
    top,
    byReason,
    balance: {
      positive: employees.filter((e) => e.leaveBalance > 0).length,
      zero: employees.filter((e) => e.leaveBalance === 0).length,
      negative: employees.filter((e) => e.leaveBalance < 0).length,
    },
    totalBalance,
    avgBalance: employees.length ? +(totalBalance / employees.length).toFixed(1) : 0,
    debtors: employees.filter((e) => e.leaveBalance < 0).map((e) => ({ id: e.id, name: e.name, debt: Math.abs(e.leaveBalance) })),
    adjustments: adjs.length,
    adjustmentsApproved: adjs.filter((a) => a.status === STATUS.APPROVED).length,
  };
}

// ---------- CSV ----------
function csvCell(v) {
  let s = String(v ?? '');
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah formula injection di Excel (angka asli dibiarkan)
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(rows, columns) {
  const head = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','));
  return [head, ...body].join('\r\n');
}

// ---------- Tumpang tindih tanggal ----------
// Dua rentang 'YYYY-MM-DD' (inklusif) bertabrakan?
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}
