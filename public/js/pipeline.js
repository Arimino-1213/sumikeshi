// ファイルを読み、ページごとの画像と文字を作る。原本は外に出さず、すべてこのタブのメモリの中だけで扱う。
import * as pdfjsLib from '../vendor/pdfjs/pdf.min.mjs';

const base = new URL('../', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'vendor/pdfjs/pdf.worker.min.mjs';
const RENDER_DPI = 200;

export class FriendlyError extends Error {}
export class Cancelled extends Error {}

export class Engine {
  constructor() { this.seq = 0; this.wait = new Map(); }
  init() {
    if (this._ready) return this._ready;
    this.worker = new Worker(new URL('./engine-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => { const w = this.wait.get(e.data.id); this.wait.delete(e.data.id); if (!w) return; e.data.ok ? w.ok(e.data.result) : w.ng(new Error(e.data.error)); };
    this.worker.onerror = (e) => { for (const w of this.wait.values()) w.ng(new Error(e.message || '処理が止まりました')); this.wait.clear(); };
    this._ready = this.call('init');
    return this._ready;
  }
  call(cmd, payload, transfer) {
    return new Promise((ok, ng) => { const id = ++this.seq; this.wait.set(id, { ok, ng }); this.worker.postMessage({ id, cmd, payload }, transfer || []); });
  }
  ocr(image) {
    const copy = new Uint8ClampedArray(image.data); // 元の画像は手元に残す
    return this.call('ocr', { data: copy, width: image.width, height: image.height }, [copy.buffer]);
  }
  flipScore(image, boxes) {
    const copy = new Uint8ClampedArray(image.data);
    return this.call('flip', { data: copy, width: image.width, height: image.height, boxes }, [copy.buffer]);
  }
  // 1ページ分の仕上げをワーカーで行う（画像はワーカーへ渡すので、ここには残らない）
  page(image, opts) { return this.call('page', { data: image.data, width: image.width, height: image.height, ...opts }, [image.data.buffer]); }
  detect(docs, options) { return this.call('detect', { docs, options }); }
  safeLabel(label) { return this.call('safeLabel', { label }); }
  // 今の処理を止める。次に使うときに init し直す
  cancel() { this.terminate(); for (const w of this.wait.values()) w.ng(new Cancelled('中止しました')); this.wait.clear(); }
  terminate() { this.worker?.terminate(); this.worker = null; this._ready = null; }
}

const fromCanvas = (c) => { const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); return { data: d.data, width: d.width, height: d.height }; };

// 英数字は字によって幅が違う（i と m）。実際の字形の幅で配分し、全角は 1 として扱う
let measureCtx = null;
function charWidth(c) {
  if (!/[\x20-\x7e｡-ﾟ]/.test(c)) return 1;
  measureCtx ||= new OffscreenCanvas(8, 8).getContext('2d');
  measureCtx.font = '100px "Yu Gothic", "Hiragino Sans", Arial, sans-serif';
  return measureCtx.measureText(c).width / 100 || 0.5;
}

// 文字データのあるPDFから行を作る
function textItemsToLines(items, vp, Util) {
  const raw = [];
  for (const it of items) {
    if (!it.str || !it.str.trim() || !it.transform) continue;
    const m = Util.transform(vp.transform, it.transform);
    const fs = Math.hypot(m[2], m[3]);
    const rot = Math.abs(m[1]) > Math.abs(m[0]);
    const width = it.width * vp.scale;
    if (rot) return null; // 回転した文字列は位置が合わないので OCR に任せる
    raw.push({ s: it.str, x0: m[4], y1: m[5] + fs * 0.24, y0: m[5] - fs * 1.0, w: width, fs });
  }
  raw.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const rows = [];
  for (const r of raw) {
    const row = rows.find((q) => Math.abs(q.y - (r.y0 + r.y1) / 2) < r.fs * 0.5);
    if (row) row.items.push(r); else rows.push({ y: (r.y0 + r.y1) / 2, items: [r] });
  }
  const lines = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x0 - b.x0);
    let cur = null;
    const flush = () => { if (cur) { const chars = cur.chars.filter((c) => c.c !== ''); lines.push({ text: chars.map((c) => c.c).join(''), conf: 1, vertical: false, exact: true, box: [cur.x0, cur.y0, cur.x1, cur.y1], chars }); cur = null; } };
    for (const r of row.items) {
      const gap = cur ? r.x0 - cur.x1 : 0;
      if (cur && gap > r.fs * 1.2) flush();
      if (!cur) cur = { x0: r.x0, y0: r.y0, x1: r.x0, y1: r.y1, chars: [] };
      else if (gap > r.fs * 0.25) cur.chars.push({ c: ' ', conf: 1, box: [cur.x1, r.y0, r.x0, r.y1] });
      // 文字幅：全角=1、半角=0.5 の比で配分
      const cs = [...r.s]; const wt = cs.map(charWidth); const sum = wt.reduce((a, b) => a + b, 0) || 1;
      let x = r.x0;
      cs.forEach((c, i) => { const w = (r.w * wt[i]) / sum; cur.chars.push({ c, conf: 1, box: [x, r.y0, x + w, r.y1] }); x += w; });
      cur.x1 = Math.max(cur.x1, r.x0 + r.w); cur.y0 = Math.min(cur.y0, r.y0); cur.y1 = Math.max(cur.y1, r.y1);
    }
    flush();
  }
  return lines.filter((l) => l.text.trim());
}
const garbageRate = (lines) => {
  let bad = 0, n = 0;
  for (const l of lines) for (const c of l.text) { n++; if (/[-�\u0000-\u001F]/.test(c)) bad++; }
  return n ? bad / n : 0;
};

async function imageCoverage(page, vp) {
  const ops = await page.getOperatorList(); const O = pdfjsLib.OPS; let area = 0, count = 0;
  const stack = []; let m = [1, 0, 0, 1, 0, 0];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const f = ops.fnArray[i];
    if (f === O.save) stack.push(m);
    else if (f === O.restore) m = stack.pop() || m;
    else if (f === O.transform) m = pdfjsLib.Util.transform(m, ops.argsArray[i]);
    else if (f === O.paintImageXObject || f === O.paintInlineImageXObject || f === O.paintImageMaskXObject) { count++; area += Math.abs(m[0] * m[3] - m[1] * m[2]); }
  }
  return { ratio: area / (vp.width * vp.height / (vp.scale * vp.scale)), count };
}

export async function renderPdfPage(page) {
  const vp = page.getViewport({ scale: RENDER_DPI / 72 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = canvas.height = 0;
  return { vp, image: { data: d.data, width: d.width, height: d.height } };
}

// 1ファイル→ページの配列。onPage はページができるたびに呼ぶ。signal.cancelled が立つと止める
export async function loadFile(file, engine, { onProgress = () => {}, onPage = () => {}, signal = {}, password } = {}) {
  const name = file.name || '';
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(name);
  const pages = [];
  const stop = () => { if (signal.cancelled) throw new Cancelled('中止しました'); };
  const done = async (r, number) => { stop(); const pg = { number, ...r }; pages.push(pg); await onPage(pg); };
  if (isPdf) {
    const data = new Uint8Array(await file.arrayBuffer());
    let doc;
    try {
      doc = await pdfjsLib.getDocument({
        data, password, isEvalSupported: false, enableXfa: false, useSystemFonts: false, disableFontFace: false,
        cMapUrl: base + 'vendor/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: base + 'vendor/pdfjs/standard_fonts/', wasmUrl: base + 'vendor/pdfjs/wasm/',
      }).promise;
    } catch (e) {
      if (e?.name === 'PasswordException') throw new FriendlyError(`「${name}」にはパスワードがかかっています。解除してから入れてください。`);
      throw new FriendlyError(`「${name}」を開けませんでした（壊れているか PDF ではない可能性があります）。`);
    }
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        stop();
        onProgress({ page: i, total: doc.numPages });
        const page = await doc.getPage(i);
        const { vp, image } = await renderPdfPage(page);
        const text = await page.getTextContent({ includeMarkedContent: false });
        const cov = await imageCoverage(page, vp);
        let lines = null;
        try { lines = textItemsToLines(text.items, vp, pdfjsLib.Util); } catch { lines = null; }
        const textChars = lines ? lines.reduce((n, l) => n + l.text.length, 0) : 0;
        // 1行が極端に短い＝縦書きが1文字ずつに分かれている。位置が合わないので OCR に任せる
        const spaces = lines ? lines.reduce((n, l) => n + (l.text.match(/\s/g) || []).length, 0) : 0;
        const textOk = lines && textChars >= 10 && garbageRate(lines) < 0.03 && textChars / lines.length >= 2.5 && spaces / textChars < 0.25;
        page.cleanup();
        let r;
        if (textOk && cov.ratio < 0.7 && cov.count === 0) r = await engine.page(image, { mode: 'text', lines });
        else if (textOk && cov.ratio < 0.7) r = await engine.page(image, { mode: 'mix', lines });
        else r = await engine.page(image, { mode: 'photo', allowStraighten: cov.ratio >= 0.7, note: textChars ? '見えない文字データは無視（画面に見える文字を読み直し）' : null });
        await done(r, i);
      }
    } finally { await doc.loadingTask.destroy(); }
  } else {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {
      throw new FriendlyError(`「${name}」はこのブラウザでは開けない形式です。PDF・JPEG・PNG・WebP にしてから入れてください（iPhone の HEIC は書き出し時に JPEG を選べます）。`);
    }
    const c = new OffscreenCanvas(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0); bmp.close();
    let image = fromCanvas(c);
    // 大きすぎる写真は長辺3000pxに縮める（OCRとメモリのため）
    const long = Math.max(image.width, image.height);
    let pre = null;
    if (long > 3000) {
      const k = 3000 / long; const c2 = new OffscreenCanvas(Math.round(image.width * k), Math.round(image.height * k));
      const g2 = c2.getContext('2d'); g2.imageSmoothingQuality = 'high'; g2.drawImage(c, 0, 0, c2.width, c2.height); image = fromCanvas(c2); pre = [k, 0, 0, 0, k, 0, 0, 0, 1];
    }
    onProgress({ page: 1, total: 1 });
    stop();
    await done(await engine.page(image, { mode: 'photo', pre }), 1);
  }
  return pages;
}
