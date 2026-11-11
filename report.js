// report.js — laporan absensi bulanan (logika murni). Hadir = hari kerja dikurangi cuti/izin/sakit yang DISETUJUI.
import { parseDate, toISODate, monthName } from './logic.js';
import { isOffDay } from './workcal.js';
import { kindById, codeOf } from './kinds.js';

export const CODES = {
  H: 'Hadir', C: 'Cuti', S: 'Sakit', I: 'Izin', K: 'Cuti khusus', T: 'Datang terlambat', P: 'Pulang terlambat', L: 'Libur',
};

const nextDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

// Daftar hari dalam bulan: [{ date, day, dow, off }]
export function monthDays(year, month, holidays = []) {
  const n = new Date(year, month + 1, 0).getDate(), out = [];
  for (let i = 1; i <= n; i++) {
    const dt = new Date(year, month, i), date = toISODate(dt);
    out.push({ date, day: i, dow: dt.getDay(), off: isOffDay(date, holidays) });
  }
  return out;
}

const PRIORITY = ['K', 'S', 'C', 'I']; // bila dua pengajuan menutupi hari yang sama

// Kode tiap hari karyawan: '' (belum/di luar masa kerja), 'L', 'H', 'C', 'S', 'I', 'K' ; T/P dicatat terpisah (flag).
export function buildAttendance({ employees, requests, holidays = [], year, month, today = new Date() }) {
  const days = monthDays(year, month, holidays);
  const todayStr = toISODate(today);
  const approved = requests.filter((r) => r.status === 'approved');
  const rows = employees.map((e) => {
    const mine = approved.filter((r) => r.employeeId === e.id);
    const cells = days.map((d) => {
      const out = { date: d.date, code: '', late: '' };
      if (e.joinDate && d.date < e.joinDate) return out; // belum bergabung
      const covering = [];
      for (const r of mine) {
        const k = kindById(r.kind), code = codeOf(r);
        if (code === 'T' || code === 'P') { if (r.startDate === d.date) out.late += code; continue; }
        if (r.startDate <= d.date && d.date <= r.endDate) {
          // Cuti Melahirkan (hari kalender) menutupi semua hari; jenis lain hanya hari kerja.
          if (k && k.calendar) covering.push(code);
          else if (!d.off) covering.push(code);
        }
      }
      const pick = PRIORITY.find((c) => covering.includes(c));
      if (pick) out.code = pick;
      else if (d.off) out.code = 'L';
      else if (d.date <= todayStr) out.code = 'H';
      return out;
    });
    const count = (c) => cells.filter((x) => x.code === c).length;
    const lateIn = cells.filter((x) => x.late.includes('T')).length, lateOut = cells.filter((x) => x.late.includes('P')).length;
    const sums = { H: count('H'), C: count('C'), S: count('S'), I: count('I'), K: count('K'), T: lateIn, P: lateOut };
    return { emp: e, cells, sums };
  });
  const workDays = days.filter((d) => !d.off).length;
  return { year, month, label: `${monthName(month)} ${year}`, days, rows, workDays };
}

// Rincian tiap pengajuan yang disetujui dan menyentuh bulan tsb.
export function detailRows({ employees, requests, year, month }) {
  const first = toISODate(new Date(year, month, 1)), last = toISODate(new Date(year, month + 1, 0));
  const em = Object.fromEntries(employees.map((e) => [e.id, e]));
  return requests
    .filter((r) => r.status === 'approved' && em[r.employeeId] && r.startDate <= last && r.endDate >= first)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.employeeName.localeCompare(b.employeeName)))
    .map((r) => ({
      id: em[r.employeeId].id, name: r.employeeName, companyId: r.companyId, kind: (kindById(r.kind) || {}).label || r.reasonType || '-',
      code: codeOf(r), start: r.startDate, end: r.endDate, days: r.days || 0, detail: r.reasonDetail || '', family: r.family || '',
      by: [r.reviewedBy, r.decidedBy].filter(Boolean).join(' → '), auto: !!r.auto,
    }));
}

// Tabel datar (header + baris) untuk Excel/CSV: ringkasan.
export function summaryTable(att, coName = () => '') {
  const head = ['ID', 'Nama', 'PT', 'Hari kerja', 'Hadir', 'Cuti', 'Sakit', 'Izin', 'Cuti khusus', 'Datang terlambat (x)', 'Pulang terlambat (x)'];
  const body = att.rows.map((r) => [r.emp.id, r.emp.name, coName(r.emp.companyId), att.workDays, r.sums.H, r.sums.C, r.sums.S, r.sums.I, r.sums.K, r.sums.T, r.sums.P]);
  return { head, body };
}
// Matriks harian.
export function matrixTable(att, coName = () => '') {
  const head = ['ID', 'Nama', 'PT', ...att.days.map((d) => d.day)];
  const body = att.rows.map((r) => [r.emp.id, r.emp.name, coName(r.emp.companyId), ...r.cells.map((c) => (c.code === 'H' && !c.late ? 'H' : (c.code + c.late) || ''))]);
  return { head, body };
}
export function detailTable(rows, coName = () => '') {
  const head = ['ID', 'Nama', 'PT', 'Jenis', 'Kode', 'Mulai', 'Selesai', 'Hari', 'Keterangan', 'Diproses'];
  const body = rows.map((r) => [r.id, r.name, coName(r.companyId), r.kind + (r.family ? ` (${r.family})` : ''), r.code, r.start, r.end, r.auto ? 'otomatis' : r.days, r.detail, r.auto ? 'Otomatis' : r.by]);
  return { head, body };
}

export { parseDate };
