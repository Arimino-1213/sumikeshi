// 書き出し本体：焼き込み→PDF/PNG→一覧→検査。検査に通らないときは、何がどこで起きたかをそのまま返す。
import * as pdfjsLib from '../vendor/pdfjs/pdf.min.mjs';
import { burnPage, buildImagePdf, buildZip, inspectPdfBytes, inspectPngBytes, buildCsv, positionText, evidenceLabel, evidenceCode } from './export.js';
import { CATEGORIES, BASIS } from './categories.js';
import { fixRadicals } from './detect.js';

const toBytes = async (blob) => new Uint8Array(await blob.arrayBuffer());
const fromCanvas = (c) => { const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); return { data: d.data, width: d.width, height: d.height }; };
const norm = (s) => fixRadicals(s).normalize('NFKC').replace(/\s/g, '').replace(/[－―‐−–—]/g, '-');
const enc = new TextEncoder();
// 提出用の一覧に、理由の文に含まれる原文（氏名など）を持ち込まない
const publicReason = (it) => {
  if (it.type === 'manual') return '担当者が手で指定';
  if (it.type === 'word') return '担当者が指定した語';
  return it.reason.replace(/氏名「[^」]*」/g, '氏名').replace(/「(?:[^」]*)」のあと/g, '欄のあと');
};

export async function runExport({ docs, items, engine, options, onProgress = () => {} }) {
  const checks = []; const pdfs = []; const pngFiles = []; const rows = [];
  const secretsAll = [];
  let maskFail = 0, maskTotal = 0;
  const ocrFails = []; let ocrPages = 0, ocrWords = 0;
  const totalPages = docs.reduce((s, d) => s + d.pages.length, 0); let done = 0;

  for (let di = 0; di < docs.length; di++) {
    const d = docs[di];
    const label = evidenceLabel(d.side, d.no, d.branch), code = evidenceCode(d.side, d.no, d.branch);
    const imgs = [];
    for (let pi = 0; pi < d.pages.length; pi++) {
      done++;
      onProgress(`書き出しと読み直しの検査をしています（${done}／${totalPages} ページ）`);
      const p = d.pages[pi];
      const here = items.filter((i) => i.doc === di && i.page === pi);
      const on = here.filter((i) => i.on);
      const masks = on.flatMap((i) => i.rects.map((r) => ({ x0: r[0], y0: r[1], x1: r[2], y1: r[3], style: i.style })));
      const stamp = options.stamp ? label : null;
      const margin = [options.caseNo, options.filer].filter(Boolean).join('　') || null;
      const { canvas, blackCheck } = await burnPage(p, masks, { stamp, margin });
      maskFail += blackCheck.bad; maskTotal += blackCheck.total;
      const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
      imgs.push({ bytes: await toBytes(jpeg), width: p.width, height: p.height });
      const png = await canvas.convertToBlob({ type: 'image/png' });
      pngFiles.push({ name: `${code}_p${String(pi + 1).padStart(3, '0')}.png`, bytes: await toBytes(png) });
      // 焼き込んだ画像を読み直し、隠した語が読めないことを確かめる
      const blackOn = on.filter((i) => i.style !== 'redline' && !/^手で追加 /.test(i.text) && i.type !== 'seal' && i.type !== 'lowconf');
      const keep = here.filter((i) => !i.on).map((i) => norm(i.text));
      const words = [...new Set(blackOn.map((i) => norm(i.text)))].filter((w) => w.length >= 2 && !keep.includes(w));
      for (const w of blackOn) secretsAll.push(w.text.replace(/\s+/g, ''));
      if (words.length) {
        const r = await engine.ocr(fromCanvas(canvas));
        const text = norm(r.lines.map((l) => l.text).join(''));
        ocrPages++; ocrWords += words.length;
        for (const w of words) if (text.includes(w)) ocrFails.push({ doc: di, page: pi, word: w });
      }
      for (const i of on) {
        const r = i.rects[0];
        rows.push({
          evidence: label, page: pi + 1, position: positionText({ x0: r[0], y0: r[1], x1: r[2], y1: r[3] }, p.width, p.height),
          label: CATEGORIES[i.type]?.label || i.type, reason: publicReason(i), basis: BASIS[CATEGORIES[i.type]?.basis] || '', how: i.style === 'redline' ? '赤線（非開示の希望）' : '黒塗り', text: i.text,
        });
      }
    }
    const bytes = buildImagePdf(imgs, { binding: options.binding });
    pdfs.push({ name: `${code}.pdf`, bytes, blob: new Blob([bytes], { type: 'application/pdf' }), label, di });
  }

  // ---- 検査 ----
  checks.push({ ok: maskFail === 0, title: '黒塗りの下に元の画素が残っていない', detail: `${maskTotal} 箇所の内側がすべて真っ黒であることを確認${maskFail ? `（${maskFail} 箇所に残りあり）` : ''}` });
  const secrets = [...new Set(secretsAll)].filter((s) => s.length >= 2);
  let badStruct = [], leaked = [], appMark = 0, textItems = 0, metaKeys = 0, annots = 0;
  for (const f of pdfs) {
    const r = inspectPdfBytes(f.bytes, secrets);
    badStruct.push(...r.banned); leaked.push(...r.leaked); appMark += r.jpegApp.length;
    const doc = await pdfjsLib.getDocument({ data: f.bytes.slice(), isEvalSupported: false, cMapUrl: new URL('../vendor/pdfjs/cmaps/', import.meta.url).href, cMapPacked: true }).promise;
    for (let n = 1; n <= doc.numPages; n++) {
      const pg = await doc.getPage(n);
      textItems += (await pg.getTextContent()).items.filter((x) => x.str && x.str.trim()).length;
      annots += (await pg.getAnnotations()).length;
    }
    const meta = await doc.getMetadata();
    metaKeys += Object.keys(meta.info || {}).filter((k) => !['PDFFormatVersion', 'Language', 'EncryptFilterName', 'IsLinearized', 'IsAcroFormPresent', 'IsXFAPresent', 'IsCollectionPresent', 'IsSignaturesPresent'].includes(k)).length + (meta.metadata ? 1 : 0);
    await doc.loadingTask.destroy();
  }
  checks.push({ ok: textItems === 0, title: 'PDFに文字データがない', detail: `取り出せた文字 ${textItems} 件` });
  checks.push({ ok: !badStruct.length && metaKeys === 0 && annots === 0 && appMark === 0, title: '作成者や注釈などの付帯情報がない', detail: badStruct.length || metaKeys || annots || appMark ? `見つかったもの：${[...new Set(badStruct)].join(' ')} 情報${metaKeys} 注釈${annots} 画像付帯${appMark}` : '入っているのはページの画像だけです' });
  checks.push({ ok: !leaked.length, title: 'ファイルの中に隠した文字がない', detail: leaked.length ? `${leaked.length} 語が見つかりました` : `${secrets.length} 語をファイルの中身と照合` });
  checks.push({ ok: !ocrFails.length, title: '黒塗りした画像を読み直しても、隠した語が読めない', detail: ocrFails.length ? `読めた語：${[...new Set(ocrFails.map((f) => f.word))].slice(0, 5).join('、')}（枠がずれている可能性があります）` : `${ocrPages} ページ・${ocrWords} 語を読み直して確認`, jump: ocrFails[0] ? { doc: ocrFails[0].doc, page: ocrFails[0].page } : null });
  let pngBad = 0; for (const f of pngFiles) if (!inspectPngBytes(f.bytes).ok) pngBad++;
  checks.push({ ok: pngBad === 0, title: '画像に撮影情報や文字情報が入っていない', detail: `${pngFiles.length} 枚を確認` });
  const pending = items.filter((i) => i.need && !i.seen).length; const unseen = docs.flatMap((d) => d.pages).filter((p) => !p.seen).length;
  checks.push({ ok: pending === 0 && unseen === 0, title: '人の目の確認', detail: pending || unseen ? `要確認 ${pending} 件・見ていないページ ${unseen} ページが残っています` : '要確認とすべてのページを確認済み' });

  // ---- 一覧 ----
  const listText = buildCsv(rows, false);
  const leakInList = secrets.filter((s) => s.length >= 2 && norm(listText).includes(norm(s)));
  checks.push({ ok: !leakInList.length, title: '提出用の一覧に隠した文字がない', detail: leakInList.length ? `${leakInList.length} 語が入っています` : `${rows.length} 行を照合` });
  const listCsv = new Blob([listText], { type: 'text/csv' });
  const internalCsv = new Blob([buildCsv(rows, true)], { type: 'text/csv' });
  const namesLeak = pdfs.filter((f) => secrets.some((s) => f.name.includes(s)));
  if (namesLeak.length) checks.push({ ok: false, title: 'ファイル名に隠した文字がない', detail: '名前を見直してください' });
  const pngZip = new Blob([buildZip(pngFiles)], { type: 'application/zip' });
  const bundleFiles = [...pdfs.map((f) => ({ name: f.name, bytes: f.bytes })), { name: '黒塗り箇所一覧_提出用.csv', bytes: enc.encode(listText) }];
  const bundle = new Blob([buildZip(bundleFiles)], { type: 'application/zip' });
  return { checks, pdfs, pngZip, listCsv, internalCsv, bundle, bundleName: '提出用（書証PDF・一覧）.zip' };
}
