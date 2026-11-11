// kinds.js — katalog jenis pengajuan & aturannya (logika murni, tanpa Firebase / DOM agar bisa diuji).
import { parseDate, toISODate, daysBetween } from './logic.js';
import { countLeaveDays } from './company.js';

export const FAMILY = ['Ayah Kandung', 'Ibu Kandung', 'Ayah Mertua', 'Ibu Mertua', 'Istri/Suami', 'Anak'];
export const MONTHLY_LATE_CAP = 3; // maksimal datang/pulang terlambat per bulan (masing-masing)
export const DEFAULT_IZIN_WARN = 3; // peringatan bila izin dalam 1 bulan >= angka ini
export const MAX_PHOTOS = 3;

export const GROUPS = [
  { id: 'cuti', label: 'Cuti', note: 'Memotong jatah cuti tahunan.' },
  { id: 'izin', label: 'Izin (tidak memotong cuti)', note: 'Tidak memotong jatah cuti. Izin yang terlalu sering akan diberi tanda untuk HRD dan Direktur.' },
  { id: 'khusus', label: 'Cuti Khusus (tidak memotong jatah cuti)', note: 'Tidak memotong jatah cuti.' },
];

// Field:
//  deduct      memotong saldo cuti tahunan
//  code        kode di laporan absensi (C cuti, S sakit, I izin, K khusus, T datang terlambat, P pulang terlambat)
//  maxDays     batas hari
//  calendar    hitung hari kalender (abaikan Sabtu/Minggu/tanggal merah) — hanya Cuti Melahirkan
//  single      hanya 1 hari
//  auto        disetujui otomatis saat diajukan, tetap muncul di riwayat
//  detail      { min } keterangan wajib minimal sekian karakter
//  family      wajib pilih hubungan keluarga
//  docs        { label, always } atau { label, overDays } — lampiran foto wajib
//  announce    tampil sebagai pengumuman di beranda seluruh karyawan PT setelah disetujui
export const KINDS = [
  { id: 'cuti_mendesak', label: 'Cuti Mendesak', group: 'cuti', deduct: true, code: 'C' },
  { id: 'cuti_keluarga', label: 'Cuti Acara Keluarga', group: 'cuti', deduct: true, code: 'C' },
  { id: 'cuti_liburan', label: 'Cuti Liburan', group: 'cuti', deduct: true, code: 'C' },
  { id: 'cuti_lainnya', label: 'Cuti Lainnya', group: 'cuti', deduct: true, code: 'C', detail: { min: 10 }, hint: 'Wajib isi keterangan yang jelas.' },

  { id: 'izin_sakit', label: 'Sakit', group: 'izin', deduct: false, code: 'S', docs: { label: 'surat dokter', overDays: 1 }, hint: '1 hari boleh tanpa surat. Lebih dari 1 hari wajib melampirkan foto surat dokter.' },
  { id: 'izin_keluarga_sakit', label: 'Keluarga Inti Sakit', group: 'izin', deduct: false, code: 'I', family: true, maxDays: 3, docs: { label: 'surat dokter', overDays: 1 }, hint: '1 hari tanpa surat. Lebih dari 1 hari wajib foto surat dokter, maksimal 3 hari.' },
  { id: 'izin_lainnya', label: 'Izin Lainnya', group: 'izin', deduct: false, code: 'I', single: true, maxDays: 1, detail: { min: 5 }, hint: 'Hanya 1 hari. Wajib isi keterangan.' },
  { id: 'izin_datang_terlambat', label: 'Datang Terlambat', group: 'izin', deduct: false, code: 'T', single: true, maxDays: 1, auto: true, late: true, detail: { min: 5 }, hint: `Disetujui otomatis dan tetap tercatat di riwayat. Wajib alasan. Maksimal ${MONTHLY_LATE_CAP}x per bulan.` },
  { id: 'izin_pulang_terlambat', label: 'Pulang Terlambat', group: 'izin', deduct: false, code: 'P', single: true, maxDays: 1, auto: true, late: true, detail: { min: 5 }, hint: `Disetujui otomatis dan tetap tercatat di riwayat. Wajib alasan. Maksimal ${MONTHLY_LATE_CAP}x per bulan.` },

  { id: 'khusus_melahirkan', label: 'Cuti Melahirkan', group: 'khusus', deduct: false, code: 'K', maxDays: 90, calendar: true, docs: { label: 'HPL (hari perkiraan lahir)', always: true }, hint: 'Maksimal 90 hari kalender (tidak terkait Sabtu/Minggu dan tanggal merah). Wajib lampirkan foto HPL.' },
  { id: 'khusus_keguguran', label: 'Cuti Keguguran', group: 'khusus', deduct: false, code: 'K', maxDays: 2, docs: { label: 'surat dokter', always: true }, hint: 'Maksimal 2 hari. Wajib lampirkan foto surat dokter.' },
  { id: 'khusus_pernikahan', label: 'Cuti Pernikahan', group: 'khusus', deduct: false, code: 'K', maxDays: 3, docs: { label: 'undangan pernikahan', always: true }, announce: 'wedding', hint: 'Maksimal 3 hari. Wajib lampirkan foto undangan. Setelah disetujui, ucapan selamat tampil di beranda seluruh karyawan PT.' },
  { id: 'khusus_kematian', label: 'Cuti Kematian Keluarga Inti', group: 'khusus', deduct: false, code: 'K', family: true, maxDays: 3, hint: 'Maksimal 3 hari.' },
  { id: 'khusus_istri_melahirkan', label: 'Cuti Istri Melahirkan', group: 'khusus', deduct: false, code: 'K', maxDays: 7, hint: 'Maksimal 7 hari.' },
];

export const kindById = (id) => KINDS.find((k) => k.id === id) || null;
export const kindsOf = (group) => KINDS.filter((k) => k.group === group);

// Kode laporan untuk pengajuan (mendukung data lama tanpa `kind`).
export function codeOf(r) {
  const k = kindById(r && r.kind);
  if (k) return k.code;
  return r && r.deduct ? 'C' : 'I';
}

// Jumlah hari sesuai aturan jenis: Melahirkan = hari kalender; lainnya = hari kerja (Sabtu/Minggu dan tanggal merah tidak dihitung).
export function countDays(kind, start, end, holidays = []) {
  if (!kind) return 0;
  if (kind.calendar) return daysBetween(start, end);
  return countLeaveDays(start, end, { excludeWeekends: true, holidays });
}
export const countModeOf = (kind) => (kind && kind.calendar ? 'calendar' : 'work');
// Untuk pengajuan yang tersimpan (dipakai saat persetujuan menghitung ulang dengan kalender terbaru).
export function recountRequest(r, holidays = [], legacyExcludeWeekends = false) {
  if (r.countMode === 'calendar') return daysBetween(r.startDate, r.endDate);
  if (r.countMode === 'work') return countLeaveDays(r.startDate, r.endDate, { excludeWeekends: true, holidays });
  return countLeaveDays(r.startDate, r.endDate, { excludeWeekends: typeof r.excludeWeekends === 'boolean' ? r.excludeWeekends : legacyExcludeWeekends, holidays });
}

// Apakah lampiran foto wajib untuk jenis ini pada durasi `days`? -> { required, label } atau null.
export function docRule(kind, days) {
  const d = kind && kind.docs;
  if (!d) return null;
  if (d.always) return { required: true, label: d.label };
  if (typeof d.overDays === 'number') return { required: days > d.overDays, label: d.label };
  return null;
}

export const monthKey = (dateStr) => String(dateStr || '').slice(0, 7);

// Pengajuan "terlambat" jenis ini milik karyawan ini pada bulan tanggal tsb (selain yang ditolak).
export function lateCount(requests, empId, kindId, dateStr) {
  return requests.filter((r) => r.employeeId === empId && r.kind === kindId && r.status !== 'rejected' && monthKey(r.startDate) === monthKey(dateStr)).length;
}

// Pesan error atau ''. `days` = hasil countDays. `nPhotos` = jumlah foto terlampir.
export function validateRequest({ kind, start, end, detail = '', family = '', days, nPhotos = 0 }) {
  if (!kind) return 'Pilih jenis pengajuan.';
  const a = parseDate(start), b = parseDate(end);
  if (!a || !b) return 'Pilih tanggal mulai dan selesai.';
  if (b < a) return 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
  if (kind.single && start !== end) return `${kind.label} hanya untuk 1 hari.`;
  if (!(days >= 1)) return kind.calendar ? 'Pilih rentang tanggal.' : 'Rentang ini hanya berisi akhir pekan atau tanggal merah, tidak ada hari kerja yang dihitung.';
  if (kind.maxDays && days > kind.maxDays) return `${kind.label} maksimal ${kind.maxDays} hari${kind.calendar ? ' kalender' : ' kerja'}.`;
  if (kind.family && !FAMILY.includes(family)) return 'Pilih hubungan keluarga.';
  const min = kind.detail ? kind.detail.min : 0;
  if (min && String(detail).trim().length < min) return `Keterangan wajib diisi (minimal ${min} karakter).`;
  const rule = docRule(kind, days);
  if (rule && rule.required && nPhotos < 1) return `Lampirkan foto ${rule.label}.`;
  if (nPhotos > MAX_PHOTOS) return `Maksimal ${MAX_PHOTOS} foto.`;
  return '';
}

// Teks yang disimpan di pengajuan (kolom "Jenis" di tabel & ekspor).
export function reasonText(kind, detail = '', family = '') {
  const base = kind.label + (family ? ` (${family})` : '');
  return detail ? `${base} — ${detail}` : base;
}

// ---------- Peringatan izin berlebih ----------
// Menghitung izin (bukan terlambat) per karyawan per bulan. Hanya Sakit, Keluarga Sakit, Izin Lainnya.
export const isIzinCounted = (r) => {
  const k = kindById(r.kind);
  return !!k && k.group === 'izin' && !k.late && r.status !== 'rejected';
};
export function izinAlerts(requests, ym, threshold = DEFAULT_IZIN_WARN) {
  const by = new Map();
  for (const r of requests) {
    if (!isIzinCounted(r) || monthKey(r.startDate) !== ym) continue;
    const e = by.get(r.employeeId) || { employeeId: r.employeeId, name: r.employeeName, companyId: r.companyId, count: 0, items: [] };
    e.count++; e.items.push(r);
    by.set(r.employeeId, e);
  }
  return [...by.values()].filter((e) => e.count >= threshold).sort((a, b) => b.count - a.count);
}
export function izinCountFor(requests, empId, ym) {
  return requests.filter((r) => r.employeeId === empId && isIzinCounted(r) && monthKey(r.startDate) === ym).length;
}

export const todayISO = (d = new Date()) => toISODate(d);
