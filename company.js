// company.js — logika murni untuk multi-PT dan kalender libur (tanpa Firebase / DOM agar bisa diuji).
// Dipisah dari logic.js supaya aturan lama tetap utuh.
import { parseDate, toISODate } from './logic.js';

// ---------- Akses per PT ----------
// Role yang boleh menentukan akses lihat banyak PT. Role lain tidak bisa.
export const GRANT_ROLES = ['superuser', 'direktur', 'komisaris'];
export const canGrantAccess = (role) => GRANT_ROLES.includes(role);

export const uniq = (a) => [...new Set((a || []).filter(Boolean))];

// ID PT yang boleh dilihat user. Superuser (owner) selalu melihat semua PT.
// `companies` = daftar PT yang sudah dimuat (id, name, ...).
export function accessIds(user, companies = []) {
  if (!user) return [];
  const all = companies.map((c) => c.id);
  if (user.role === 'superuser') return all;
  return uniq([user.companyId, ...(user.companyIds || [])]).filter((id) => all.includes(id));
}

export const inAccess = (user, companyId, companies) => !!companyId && accessIds(user, companies).includes(companyId);

// PT yang boleh dibagikan aksesnya oleh `actor`: hanya milik actor sendiri, dan hanya jika rolenya boleh.
export function grantableIds(actor, companies) {
  return canGrantAccess(actor && actor.role) ? accessIds(actor, companies) : [];
}

// Daftar akses baru untuk satu akun. PT utama selalu ada. PT yang tidak bisa diatur actor dipertahankan apa adanya.
export function nextAccessList({ home, current = [], chosen = [], grantable = [] }) {
  const keep = current.filter((id) => !grantable.includes(id));
  const picked = chosen.filter((id) => grantable.includes(id));
  return uniq([home, ...keep, ...picked]);
}

// ---------- Kalender libur ----------
export const MAX_HOLIDAY_DAYS = 31;
export const canProposeHoliday = (role) => role === 'kepala_hrd';
export const canDecideHoliday = (role) => role === 'direktur';

export const HOLIDAY_STATUS = {
  pending: 'Menunggu Direktur', approved: 'Berlaku', rejected: 'Ditolak', cancelled: 'Dibatalkan', revoked: 'Dicabut',
};

const dayDiff = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);

// Pesan error, atau '' jika valid.
export function validateHoliday({ start, end, name }) {
  const a = parseDate(start), b = parseDate(end);
  if (!a || !b) return 'Pilih tanggal mulai dan selesai.';
  if (b < a) return 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
  if (dayDiff(a, b) + 1 > MAX_HOLIDAY_DAYS) return `Satu pengajuan libur maksimal ${MAX_HOLIDAY_DAYS} hari.`;
  if (String(name || '').trim().length < 3) return 'Isi nama libur (minimal 3 karakter).';
  return '';
}

// ranges: [{ start, end, name?, id? }] dengan tanggal 'YYYY-MM-DD' (perbandingan string aman).
export const isHoliday = (dateStr, ranges = []) => ranges.some((r) => r.start <= dateStr && dateStr <= r.end);
export const holidayAt = (dateStr, ranges = []) => ranges.find((r) => r.start <= dateStr && dateStr <= r.end) || null;

const nextDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

// Jumlah hari cuti yang dihitung: tanggal merah tidak dihitung, Sabtu/Minggu tidak dihitung bila diatur.
export function countLeaveDays(start, end, { excludeWeekends = false, holidays = [] } = {}) {
  const a = parseDate(start), b = parseDate(end);
  if (!a || !b || b < a) return 0;
  let n = 0;
  for (let d = a; d <= b; d = nextDay(d)) {
    const dow = d.getDay();
    if (excludeWeekends && (dow === 0 || dow === 6)) continue;
    if (isHoliday(toISODate(d), holidays)) continue;
    n++;
  }
  return n;
}

// Berapa hari yang seharusnya terhitung tetapi dibebaskan karena tanggal merah.
export function holidayDaysIn(start, end, { excludeWeekends = false, holidays = [] } = {}) {
  return countLeaveDays(start, end, { excludeWeekends }) - countLeaveDays(start, end, { excludeWeekends, holidays });
}

export function addRange(ranges = [], r) {
  return [...ranges.filter((x) => x.id !== r.id), { id: r.id, start: r.start, end: r.end, name: r.name }]
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}
export const removeRange = (ranges = [], id) => ranges.filter((x) => x.id !== id);

// Grid bulan (minggu mulai Senin). Tiap sel: 'YYYY-MM-DD' atau null. month: 0-11.
export function monthGrid(year, month) {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const dim = new Date(year, month + 1, 0).getDate();
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= dim; d++) cells.push(toISODate(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Urutkan dua tanggal menjadi [awal, akhir] (untuk memilih rentang di kalender, klik pertama/kedua bebas urutan).
export const orderRange = (a, b) => (a <= b ? [a, b] : [b, a]);
