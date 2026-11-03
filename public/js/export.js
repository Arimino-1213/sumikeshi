// 黒塗りの焼き込み・画像だけのPDF・ZIP・一覧の出力・漏えい検査
// 出力PDFは自前で組み立てる：入っているのは「ページの画像」だけで、文字・注釈・作成情報の入れ物を作らない。
const enc = new TextEncoder();
const A4 = [595.28, 841.89];

// 1ページを焼き込んだ canvas を作る。masks は [x0,y0,x1,y1, style?]
export async function burnPage(page, masks, { stamp = null, margin = null } = {}) {
  const bmp = await createImageBitmap(page.blob);
  const c = new OffscreenCanvas(page.width, page.height); const g = c.getContext('2d');
  g.drawImage(bmp, 0, 0); bmp.close();
  for (const m of masks) {
    if (m.style === 'redline') {
      // 非開示の希望：赤線を引くだけ（文字は残る）。横書きは下線、縦書きは右線
      g.strokeStyle = '#d0021b'; g.lineWidth = Math.max(3, page.height / 400);
      g.beginPath();
      if (m.y1 - m.y0 > (m.x1 - m.x0) * 1.5) { g.moveTo(m.x1 + 2, m.y0); g.lineTo(m.x1 + 2, m.y1); } else { g.moveTo(m.x0, m.y1 + 2); g.lineTo(m.x1, m.y1 + 2); }
      g.stroke();
      continue;
    }
    // 端の半端なピクセルが残らないよう、外側へ切り上げて塗る
    const x0 = Math.floor(m.x0), y0 = Math.floor(m.y0), x1 = Math.ceil(m.x1), y1 = Math.ceil(m.y1);
    g.fillStyle = '#000'; g.globalAlpha = 1; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  // 塗った内側が真っ黒か、その場で確かめる
  const blackCheck = { total: 0, bad: 0 };
  for (const m of masks) {
    if (m.style === 'redline') continue;
    const x0 = Math.floor(m.x0), y0 = Math.floor(m.y0), w = Math.ceil(m.x1) - x0, hh = Math.ceil(m.y1) - y0;
    if (w <= 0 || hh <= 0) continue;
    const px = g.getImageData(x0, y0, w, hh).data; blackCheck.total++;
    for (let i = 0; i < px.length; i += 4) if (px[i] || px[i + 1] || px[i + 2]) { blackCheck.bad++; break; }
  }
  if (margin) {
    const fs = Math.round(page.height / 70);
    g.font = `${fs}px "Yu Mincho","Hiragino Mincho ProN",serif`; g.textBaseline = 'top';
    const w = g.measureText(margin).width;
    g.fillStyle = '#fff'; g.fillRect(fs * 1.2 - 4, fs * 1.2 - 4, w + 8, fs + 8);
    g.fillStyle = '#000'; g.fillText(margin, fs * 1.2, fs * 1.2);
  }
  if (stamp) {
    const fs = Math.round(page.height / 48);
    g.font = `${fs}px "Yu Mincho","Hiragino Mincho ProN",serif`; g.textBaseline = 'top';
    const w = g.measureText(stamp).width; const pad = fs * 0.35; const x = page.width - w - fs * 1.2, y = fs * 0.9;
    g.fillStyle = '#fff'; g.fillRect(x - pad, y - pad, w + pad * 2, fs + pad * 2);
    g.strokeStyle = '#000'; g.lineWidth = Math.max(1.5, fs / 14); g.strokeRect(x - pad, y - pad, w + pad * 2, fs + pad * 2);
    g.fillStyle = '#000'; g.fillText(stamp, x, y);
  }
  return { canvas: c, blackCheck };
}

const concat = (parts) => {
  const n = parts.reduce((s, p) => s + p.length, 0); const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

// 用紙（A4 か A3）に収めて画像を置く。mints は「記録」のPDFを A4・A3 に限っている
function fitPage(w, h, { binding = false } = {}) {
  const paper = w > h ? [A4[1], A4[0]] : A4;
  const left = binding ? 85.04 : 0; // とじしろ 3cm
  const availW = paper[0] - left, availH = paper[1];
  const s = Math.min(availW / w, availH / h); const iw = w * s, ih = h * s;
  return { pw: paper[0], ph: paper[1], x: left + (availW - iw) / 2, y: (availH - ih) / 2, iw, ih };
}

// JPEG のかたまりから「画像だけ」のPDFを作る。Info・Metadata・Font・Annots を一切書かない。
export function buildImagePdf(images, opts = {}) {
  const objs = []; const n = images.length;
  // 1:Catalog 2:Pages 以降 ページごとに Page / Contents / Image の3つ
  const pageIds = images.map((_, i) => 3 + i * 3);
  objs[1] = enc.encode('<</Type/Catalog/Pages 2 0 R>>');
  objs[2] = enc.encode(`<</Type/Pages/Count ${n}/Kids[${pageIds.map((p) => p + ' 0 R').join(' ')}]>>`);
  images.forEach((im, i) => {
    const pid = 3 + i * 3, cid = pid + 1, iid = pid + 2; const f = fitPage(im.width, im.height, opts);
    objs[pid] = enc.encode(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${f.pw.toFixed(2)} ${f.ph.toFixed(2)}]/Resources<</XObject<</I ${iid} 0 R>>>>/Contents ${cid} 0 R>>`);
    const content = enc.encode(`q ${f.iw.toFixed(3)} 0 0 ${f.ih.toFixed(3)} ${f.x.toFixed(3)} ${f.y.toFixed(3)} cm /I Do Q`);
    objs[cid] = concat([enc.encode(`<</Length ${content.length}>>stream\n`), content, enc.encode('\nendstream')]);
    objs[iid] = concat([enc.encode(`<</Type/XObject/Subtype/Image/Width ${im.width}/Height ${im.height}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${im.bytes.length}>>stream\n`), im.bytes, enc.encode('\nendstream')]);
  });
  const parts = [enc.encode('%PDF-1.5\n')]; const offs = []; let pos = parts[0].length;
  for (let id = 1; id < objs.length; id++) {
    offs[id] = pos;
    const head = enc.encode(`${id} 0 obj\n`), tail = enc.encode('\nendobj\n');
    parts.push(head, objs[id], tail); pos += head.length + objs[id].length + tail.length;
  }
  const xref = pos; let x = `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objs.length; id++) x += String(offs[id]).padStart(10, '0') + ' 00000 n \n';
  x += `trailer\n<</Size ${objs.length}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  parts.push(enc.encode(x));
  return concat(parts);
}

// ---- ZIP（無圧縮）。時刻は固定して、作業日時を残さない ----
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function buildZip(files) {
  const chunks = [], central = []; let off = 0;
  const u16 = (v) => [v & 255, (v >> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.bytes), sz = f.bytes.length;
    const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(33), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0)];
    const local = Uint8Array.from([0x50, 0x4b, 3, 4, ...common]);
    chunks.push(local, nm, f.bytes);
    central.push(Uint8Array.from([0x50, 0x4b, 1, 2, ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
    off += local.length + nm.length + sz;
  }
  const cen = concat(central);
  const end = Uint8Array.from([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cen.length), ...u32(off), ...u16(0)]);
  return concat([...chunks, cen, end]);
}

// 号証番号：甲第1号証 と、mints に入れる番号 甲001
export const evidenceLabel = (side, no, branch) => `${side}第${no}号証${branch ? `の${branch}` : ''}`;
export const evidenceCode = (side, no, branch) => `${side}${String(no).padStart(3, '0')}${branch ? `-${branch}` : ''}`;

// ---- 検査：できあがった PDF の中身を調べる ----
const latin1 = (u8) => { let s = ''; const step = 1 << 15; for (let i = 0; i < u8.length; i += step) s += String.fromCharCode.apply(null, u8.subarray(i, i + step)); return s; };
export function inspectPdfBytes(u8, secrets = []) {
  // 画像のかたまりを取り除いて、構造の部分だけを調べる
  let s = latin1(u8);
  s = s.replace(/stream\r?\n[\s\S]*?endstream/g, (m) => (m.includes('/I Do') ? m : 'stream…endstream'));
  const banned = ['/Font', '/Info', '/Metadata', '/Annots', '/Names', '/JavaScript', '/JS', '/OpenAction', '/AcroForm', '/XMP', '/Producer', '/Creator', '/Author', '/Title', '/StructTreeRoot', '/OCProperties', '/EmbeddedFile', ' BT', 'TJ', 'Tj'];
  const found = banned.filter((b) => s.includes(b));
  const whole = latin1(u8);
  const leaked = [];
  for (const w of secrets) {
    if (!w) continue;
    // 短い数字は PDF の目次の数字（ファイル内の位置など）と偶然一致する。構造に文字が入らないことは上の検査で別に確かめている
    if (/^[0-9-]+$/.test(w) && w.length < 10) continue;
    const a = latin1(enc.encode(w)); // UTF-8
    let b = ''; for (const c of w) { const v = c.charCodeAt(0); b += String.fromCharCode(v >> 8, v & 255); } // UTF-16
    // 構造の部分は短い語も調べる。画像の圧縮データは乱数に近く、短い並びは偶然一致するので 6 バイト以上だけ調べる
    if (s.includes(a) || s.includes(b) || (a.length >= 6 && whole.includes(a)) || (b.length >= 6 && whole.includes(b))) leaked.push(w);
  }
  // JPEG の付帯情報（APP1=Exif/XMP）が入っていないか
  const jpegApp = [];
  for (let i = 0; i < u8.length - 3; i++) if (u8[i] === 0xff && u8[i + 1] === 0xd8 && u8[i + 2] === 0xff) { let p = i + 2; while (u8[p] === 0xff && u8[p + 1] >= 0xe0 && u8[p + 1] <= 0xef) { if (u8[p + 1] === 0xe1 || u8[p + 1] === 0xed) jpegApp.push(u8[p + 1].toString(16)); p += 2 + ((u8[p + 2] << 8) | u8[p + 3]); } }
  return { banned: found, leaked, jpegApp, ok: !found.length && !leaked.length && !jpegApp.length };
}
export function inspectPngBytes(u8) {
  const chunks = []; let p = 8;
  while (p + 8 <= u8.length) {
    const len = (u8[p] << 24) | (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3];
    chunks.push(String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7])); p += 12 + len;
  }
  const bad = chunks.filter((c) => /^(tEXt|iTXt|zTXt|eXIf|tIME)$/.test(c));
  return { chunks: [...new Set(chunks)], bad, ok: !bad.length };
}

// ---- 一覧 ----
const pos = (m, w, h) => {
  const vt = (m.y0 + m.y1) / 2 / h, hz = (m.x0 + m.x1) / 2 / w;
  return `${vt < 0.34 ? '上' : vt < 0.67 ? '中' : '下'}${hz < 0.34 ? '左' : hz < 0.67 ? '中央' : '右'}`;
};
const csvCell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const positionText = pos;
export function buildCsv(rows, withOriginal) {
  const head = ['書証', 'ページ', '位置', '種類', '理由', '根拠', '操作'];
  if (withOriginal) head.push('隠した文字（原文）');
  const body = rows.map((r) => {
    const row = [r.evidence, r.page, r.position, r.label, r.reason, r.basis, r.how];
    if (withOriginal) row.push(r.text);
    return row.map(csvCell).join(',');
  });
  return '﻿' + [head.join(','), ...body].join('\r\n') + '\r\n';
}
