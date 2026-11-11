// workcal.js — Kalender Kerja: Sabtu & Minggu selalu libur; tanggal merah diajukan per bulan (logika murni).
import { parseDate, toISODate } from './logic.js';
import { isHoliday, holidayAt } from './company.js';

export const MAX_ITEMS_PER_MONTH = 31;

export const isWeekend = (dateStr) => { const d = parseDate(dateStr); return !!d && (d.getDay() === 0 || d.getDay() === 6); };
// Hari libur kerja = Sabtu/Minggu atau tanggal merah.
export const isOffDay = (dateStr, holidays = []) => isWeekend(dateStr) || isHoliday(dateStr, holidays);
export const monthOf = (dateStr) => String(dateStr || '').slice(0, 7); // 'YYYY-MM'
export const monthRange = (ym) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || '');
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1;
  if (mo < 0 || mo > 11) return null;
  return { first: toISODate(new Date(y, mo, 1)), last: toISODate(new Date(y, mo + 1, 0)), y, m: mo };
};

// Satu item libur: { start, end, name }, harus di dalam bulan `ym`. Pesan error atau ''.
export function validateItem({ start, end, name }, ym) {
  const r = monthRange(ym), a = parseDate(start), b = parseDate(end);
  if (!r) return 'Bulan tidak valid.';
  if (!a || !b) return 'Pilih tanggal.';
  if (b < a) return 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
  if (start < r.first || end > r.last) return 'Tanggal harus berada dalam bulan yang sedang dibuka.';
  if (String(name || '').trim().length < 3) return 'Isi keterangan libur (minimal 3 karakter).';
  return '';
}

// Daftar libur yang berlaku untuk bulan `ym` (item yang menyentuh bulan itu), terurut.
export const itemsOfMonth = (ranges = [], ym) => {
  const r = monthRange(ym); if (!r) return [];
  return ranges.filter((x) => x.start <= r.last && x.end >= r.first).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : 0));
};

const sameItem = (a, b) => a.start === b.start && a.end === b.end && a.name === b.name;

// Draf bulan ini -> perubahan dibanding yang berlaku.
export function diffMonth(current = [], draft = []) {
  const added = draft.filter((d) => !current.some((c) => sameItem(c, d)));
  const removed = current.filter((c) => !draft.some((d) => sameItem(c, d)));
  return { added, removed, changed: added.length + removed.length > 0 };
}

// Menambah item ke draf. Mengembalikan { items } atau { error }.
export function addToDraft(draft = [], item, ym) {
  const err = validateItem(item, ym);
  if (err) return { error: err };
  const it = { start: item.start, end: item.end, name: String(item.name).trim() };
  const clash = draft.find((d) => it.start <= d.end && d.start <= it.end);
  if (clash) return { error: `Bertabrakan dengan "${clash.name}" (${clash.start}${clash.end !== clash.start ? ' – ' + clash.end : ''}).` };
  if (draft.length >= MAX_ITEMS_PER_MONTH) return { error: `Maksimal ${MAX_ITEMS_PER_MONTH} item per bulan.` };
  return { items: [...draft, it].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)) };
}
export const removeFromDraft = (draft = [], idx) => draft.filter((_, i) => i !== idx);

// Terapkan batch bulan ke daftar rentang yang berlaku: buang item bulan itu, tambahkan item baru.
// Item diberi `month` & `batch` supaya bisa ditelusuri. Item lintas bulan dari bulan lain tidak disentuh.
export function applyBatch(ranges = [], ym, items = [], batchId = '') {
  const keep = ranges.filter((x) => !(x.month === ym));
  const next = items.map((it, i) => ({ id: `${batchId || 'b'}:${i}`, start: it.start, end: it.end, name: it.name, month: ym, batch: batchId }));
  return [...keep, ...next].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

export const BATCH_STATUS = { pending: 'Menunggu Direktur', approved: 'Disetujui', rejected: 'Ditolak', cancelled: 'Dibatalkan' };

// Cap waktu lokal dengan detik: 'DD/MM/YYYY HH:MM:SS'
export function stamp(iso) {
  const d = new Date(iso); if (isNaN(d)) return '-';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export { holidayAt, isHoliday };
