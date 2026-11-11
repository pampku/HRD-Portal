// pdf.js — penulis PDF tabel minimal tanpa library (A4 landscape, font Helvetica bawaan). Browser dan Node.
// blocks: { type:'table', heading, head:[...], rows:[[sel...]], widths:[pt...], align?:['l'|'c'...] } | { type:'note', text }
// sel: string | number | { t, fill:'rrggbb', bold }
const PW = 841.89, PH = 595.28, M = 28, RH = 14, FS = 7.5;

const win = (s) => String(s ?? '').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/→/g, '->')
  .replace(/[^\x20-\x7E -ÿ]/g, '?');
const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c);
// Perkiraan lebar karakter Helvetica (per 1 pt ukuran font)
function tw(s, size, bold = false) {
  let w = 0;
  for (const ch of s) {
    if ('il.,:;\'|!'.includes(ch)) w += 0.26; else if ('fjrt()[]-/ '.includes(ch)) w += 0.33; else if ('mwMW'.includes(ch)) w += 0.82;
    else if (/[A-Z]/.test(ch)) w += 0.67; else if (/[0-9]/.test(ch)) w += 0.556; else w += 0.5;
  }
  return w * size * (bold ? 1.06 : 1);
}
function fit(s, width, size, bold) {
  s = win(s);
  if (tw(s, size, bold) <= width) return s;
  while (s.length > 1 && tw(s + '..', size, bold) > width) s = s.slice(0, -1);
  return s + '..';
}
const rgb = (hex) => [0, 2, 4].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
const f2 = (n) => n.toFixed(2);

export function buildPdf({ title = '', subtitle = '', footer = '', blocks }) {
  const pages = [];
  let ops = null, y = 0;
  const newPage = () => {
    ops = []; pages.push(ops);
    y = PH - M;
    if (title) { ops.push(`BT /F2 13 Tf ${M} ${f2(PH - M - 10)} Td (${esc(win(title))}) Tj ET`); y = PH - M - 24; }
    if (subtitle) { ops.push(`BT /F1 8.5 Tf 0.35 0.33 0.3 rg ${M} ${f2(PH - M - 24)} Td (${esc(win(subtitle))}) Tj ET 0 g`); y = PH - M - 40; }
  };
  const text = (x, yy, s, size, bold, color) => ops.push(`BT ${bold ? '/F2' : '/F1'} ${size} Tf ${color ? rgb(color) + ' rg' : '0 g'} ${f2(x)} ${f2(yy)} Td (${esc(s)}) Tj ET`);
  const row = (cells, widths, align, head) => {
    let x = M;
    cells.forEach((c, i) => {
      const w = widths[i], o = typeof c === 'object' && c !== null ? c : { t: c }, raw = win(o.t ?? '');
      const fill = head ? '7A3E22' : o.fill;
      if (fill) ops.push(`${rgb(fill)} rg ${f2(x)} ${f2(y - RH)} ${f2(w)} ${RH} re f 0 g`);
      ops.push(`0.74 0.71 0.66 RG 0.4 w ${f2(x)} ${f2(y - RH)} ${f2(w)} ${RH} re S`);
      const bold = head || o.bold;
      let fs = FS; while (fs > 5.2 && tw(raw, fs, bold) > w - 3) fs -= 0.3;
      const s = fit(raw, w - 3, fs, bold), tx = (align[i] === 'c' || head) ? x + (w - tw(s, fs, bold)) / 2 : x + 2;
      text(tx, y - RH + 4, s, fs, bold, head ? 'FFFFFF' : null);
      x += w;
    });
    y -= RH;
  };
  newPage();
  for (const b of blocks) {
    if (b.type === 'title') {
      if (y < M + 60) newPage();
      text(M, y - 14, fit(b.text, PW - 2 * M, 15, true), 15, true); y -= 26; continue;
    }
    if (b.type === 'note') {
      for (const line of String(b.text).split('\n')) {
        if (y < M + 30) newPage();
        text(M, y - 8, fit(line, PW - 2 * M, 8, false), 8, false, '5A5750'); y -= 12;
      }
      y -= 6; continue;
    }
    if (y < M + RH * 4 + 20) newPage();
    if (b.heading) { text(M, y - 10, win(b.heading), 10.5, true); y -= 18; }
    const align = b.align || [];
    row(b.head, b.widths, align, true);
    for (const r of b.rows) {
      if (y - RH < M + 14) { newPage(); if (b.heading) { text(M, y - 10, win(b.heading) + ' (lanjutan)', 10, true); y -= 18; } row(b.head, b.widths, align, true); }
      row(r, b.widths, align, false);
    }
    y -= 14;
  }
  // rakit file
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(''); // pages, diisi nanti
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids = [];
  pages.forEach((p, i) => {
    p.push(`BT /F1 7 Tf 0.4 g ${f2(PW - M - 70)} ${f2(M - 12)} Td (Halaman ${i + 1} dari ${pages.length}) Tj ET`);
    if (footer) p.push(`BT /F1 7 Tf 0.4 g ${M} ${f2(M - 12)} Td (${esc(fit(footer, 600, 7, false))}) Tj ET`);
    const content = p.join('\n');
    const cid = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cid} 0 R >>`));
  });
  objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}

export const PDF_FILL = { L: 'E4E0D8', C: 'CFE0F3', S: 'FBD9B5', I: 'FFF1A8', K: 'E1D3F2', T: 'F6C5C5', P: 'F6C5C5', H: 'D3EBD3' };
