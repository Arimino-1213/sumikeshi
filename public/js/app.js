// 画面の動き。書類の文字は必ず textContent で出す（書類の中身をHTMLとして解釈させない）。
import { Engine, loadFile, FriendlyError, Cancelled } from './pipeline.js';
import { CATEGORIES, GROUPS, SCENES, BASIS } from './categories.js';
import { runExport } from './finish.js';
import { PROTECTED, effectOf, recordDecisions, recordLabel, learnedLabels, loadStats, saveStats, learnEnabled, setLearnEnabled, clearStats, emptyStats, readUnderRect, encryptMemo, decryptMemo } from './learn.js';

const $ = (id) => document.getElementById(id);
const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids) if (c != null) el.append(c);
  return el;
};
const engine = new Engine();
const store = (() => { try { return window.localStorage; } catch { return null; } })();
const S = { scene: 'all', docs: [], items: [], sel: null, filter: 'all', di: 0, pi: 0, zoom: 1, final: false, words: [], undo: [], decisions: new Map(), manualSeq: 0,
  caseKeep: new Set(), caseHide: new Set(), queue: [], reading: null, docSeq: 0, counted: new Set(), learnOn: store ? learnEnabled(store) : false, stats: store ? loadStats(store) : emptyStats() };

// ---- 外への通信の見張り ----
let netCount = 0;
const bumpNet = () => { netCount++; $('netCount').textContent = netCount; document.querySelector('.proof').classList.add('bad'); };
try {
  new PerformanceObserver((list) => { for (const e of list.getEntries()) if (new URL(e.name, location.href).origin !== location.origin) bumpNet(); }).observe({ type: 'resource', buffered: true });
} catch { /* 古いブラウザでは数えない */ }
document.addEventListener('securitypolicyviolation', (e) => { if (/^https?:/.test(e.blockedURI || '')) bumpNet(); });

function show(view) {
  for (const id of ['start', 'loading', 'work', 'finish']) $(id).hidden = id !== view;
  document.body.dataset.view = view;
  $('wipe').hidden = view === 'start';
  window.scrollTo(0, 0);
}
let toastTimer;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3600); }

// ---- はじめの画面 ----
function buildScenePick() {
  const box = $('scenePick');
  for (const [k, v] of Object.entries(SCENES)) {
    const inp = h('input', { type: 'radio', name: 'scene', value: k, checked: k === S.scene, onchange: () => { S.scene = k; } });
    box.append(h('label', { class: 'scene' }, inp, h('strong', { text: v.label }), h('small', { text: v.sub })));
  }
  const sel = $('sceneSel');
  for (const [k, v] of Object.entries(SCENES)) sel.append(h('option', { value: k, text: v.label }));
  sel.addEventListener('change', () => { S.scene = sel.value; pushUndo(); applyDefaults(); renderAll(); toast(`「${SCENES[S.scene].label}」に切り替えました。手で変えた箇所はそのままです`); });
}
const dropEl = $('drop');
for (const ev of ['dragenter', 'dragover']) window.addEventListener(ev, (e) => { e.preventDefault(); dropEl.classList.add('over'); });
for (const ev of ['dragleave', 'drop']) window.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' || !e.relatedTarget) dropEl.classList.remove('over'); });
window.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) handleFiles([...e.dataTransfer.files]); });
$('fileInput').addEventListener('change', (e) => { handleFiles([...e.target.files]); e.target.value = ''; });
$('addInput').addEventListener('change', (e) => { handleFiles([...e.target.files]); e.target.value = ''; });

// 入れたファイルは順番待ちにして、裏で読む。1ページ読めたら確認を始められる
function handleFiles(files) {
  if (!files.length) return;
  S.queue.push(...files);
  document.getElementById('startError').hidden = true;
  if (S.reading) { renderReading(); return; }
  runQueue();
}
async function runQueue() {
  const R = S.reading = { signal: {}, fileNo: 0, fileTotal: S.queue.length, page: 0, total: 0, errs: [] };
  document.body.dataset.reading = '1';
  if (!S.docs.some((d) => d.pages.length)) {
    show('loading');
    $('loadTitle').textContent = '読み取りの準備をしています';
    $('loadSub').textContent = 'はじめの1回だけ、読み取りのプログラムをこの端末に読み込みます。書類は送信されません';
    $('loadBar').style.width = '4%';
  }
  renderReading();
  let refreshAt = 0;
  try {
    await engine.init();
    let nextNo = S.docs.reduce((m, d) => Math.max(m, d.no), 0) + 1;
    while (S.queue.length && !R.signal.cancelled) {
      const f = S.queue.shift(); R.fileNo++; R.page = 0; R.total = 0; R.name = f.name;
      R.fileTotal = R.fileNo + S.queue.length;
      const doc = { id: ++S.docSeq, name: f.name, side: '甲', no: nextNo, branch: '', pages: [] };
      renderReading();
      try {
        await loadFile(f, engine, {
          signal: R.signal,
          onProgress: ({ page, total }) => { R.page = page; R.total = total; renderReading(); },
          onPage: async (p) => {
            p.url = URL.createObjectURL(p.blob); p.seen = false;
            if (!doc.pages.length) { S.docs.push(doc); nextNo++; }
            doc.pages.push(p);
            // 最初のページで確認を始める。以降は数秒おきに候補を更新する
            if (document.body.dataset.view === 'loading') {
              $('loadTitle').textContent = '個人情報を探しています'; $('loadSub').textContent = '氏名の辞書を読み込んでいます';
              await refreshDetection(); $('sceneSel').value = S.scene; S.di = S.docs.length - 1; S.pi = 0; if (curPage()) curPage().seen = true; show('work'); renderAll(); refreshAt = performance.now();
            } else if (performance.now() - refreshAt > 3000) { await refreshDetection(); renderAll(); refreshAt = performance.now(); } else renderRail();
          },
        });
      } catch (e) {
        if (e instanceof Cancelled) break;
        R.errs.push(e instanceof FriendlyError ? e.message : `「${f.name}」を読み取れませんでした（理由：${e.message}）。ほかの書類の処理は続けます。`);
      }
    }
  } catch (e) {
    if (!(e instanceof Cancelled)) R.errs.push(`読み取りのプログラムを読み込めませんでした。書類は送信されていません。ページを再読み込みしてもう一度入れてください（理由：${e.message}）`);
  }
  const cancelled = R.signal.cancelled;
  S.queue.length = 0;
  if (!S.docs.some((d) => d.pages.length)) {
    S.reading = null; delete document.body.dataset.reading; renderReading();
    show('start');
    if (R.errs.length) showStartError(R.errs.join(' '));
    return;
  }
  // 全ページの候補を出し終えるまでは「読み取り中」のままにして、保存させない（候補が欠けたまま保存しないため）
  R.finalizing = true; renderReading();
  S.detectFailed = false;
  try { await engine.init(); await refreshDetection(); } catch (e) { S.detectFailed = true; R.errs.push(`候補を出せませんでした。ページを再読み込みしてやり直してください（理由：${e.message}）`); }
  S.reading = null; delete document.body.dataset.reading; renderReading();
  if (document.body.dataset.view === 'loading') show('work');
  renderAll();
  if (R.errs.length) toast(R.errs.join(' ')); else if (cancelled) toast('読み取りを中止しました。読めた分はそのまま確認できます');
}
function cancelReading() {
  if (!S.reading) return;
  S.reading.signal.cancelled = true; S.queue.length = 0;
  if (!S.reading.finalizing) engine.cancel();
}
function renderReading() {
  const R = S.reading; const bar = $('readBar');
  bar.hidden = !R;
  const busy = !!R || S.detecting > 0 || S.detectFailed;
  $('toFinish').disabled = busy;
  $('toFinish').textContent = S.detectFailed ? '候補を出せませんでした' : R ? '読み取りが終わると保存できます' : S.detecting > 0 ? '候補を更新しています' : '保存へ進む';
  if (!R) return;
  $('cancelRead').hidden = !!R.finalizing;
  $('cancelLoad').hidden = !!R.finalizing;
  const txt = R.finalizing ? '候補を更新しています' : `読み取り中　${R.fileNo || 1}／${R.fileTotal || 1} ファイル${R.total ? `・${R.page}／${R.total} ページ` : ''}`;
  $('readText').textContent = txt;
  const pct = R.fileTotal ? ((Math.max(0, R.fileNo - 1) + (R.total ? (R.page - 0.5) / R.total : 0)) / R.fileTotal) * 100 : 0;
  $('readFill').style.width = `${Math.max(3, pct)}%`;
  if (document.body.dataset.view === 'loading' && R.fileNo) {
    $('loadTitle').textContent = R.fileTotal > 1 ? `読み取っています（${R.fileNo}／${R.fileTotal} ファイル）` : '読み取っています';
    $('loadSub').textContent = '1ページ読めたら、残りを待たずに確認を始められます。この端末の中で処理しています';
    $('loadBar').style.width = `${Math.max(6, pct)}%`;
  }
}
$('cancelLoad').addEventListener('click', cancelReading);
$('cancelRead').addEventListener('click', cancelReading);
// 書類を一覧から外す
function removeDoc(di) {
  const d = S.docs[di]; if (!d) return;
  for (const p of d.pages) URL.revokeObjectURL(p.url);
  S.docs.splice(di, 1);
  S.items = S.items.filter((i) => i.type === 'manual' && i.doc !== di);
  for (const i of S.items) if (i.doc > di) i.doc--;
  S.sel = null;
  if (!S.docs.length) { S.di = 0; S.pi = 0; if (!S.reading) { show('start'); return; } }
  if (S.di >= S.docs.length) S.di = Math.max(0, S.docs.length - 1);
  S.pi = 0;
  refreshDetection().then(renderAll);
  toast(`「${d.name}」を外しました`);
}
function showStartError(msg) { const e = $('startError'); e.textContent = msg; e.hidden = false; }

// ---- 検出結果を項目にする ----
const round = Math.round;
const itemKey = (it) => `${S.docs[it.doc]?.id}:${it.page}:${it.type}:${round(it.rects[0][0])},${round(it.rects[0][1])}`;
const normText = (s) => s.normalize('NFKC').replace(/\s/g, '');
async function refreshDetection() {
  S.detecting = (S.detecting || 0) + 1; renderReading();
  try { await runDetection(); } finally { S.detecting--; renderReading(); }
}
async function runDetection() {
  const docs = S.docs.map((d) => ({ pages: d.pages.map((p) => ({ lines: p.lines })) }));
  const { hits, people } = await engine.detect(docs, { forceWords: S.words, learnedLabels: S.learnOn ? learnedLabels(S.stats) : [] });
  S.people = people;
  const manual = S.items.filter((i) => i.type === 'manual');
  const items = hits.map((x) => ({ doc: x.doc, page: x.page, type: x.type, tier: x.tier, text: x.text, rects: x.rects, reason: x.reason, rule: x.rule }));
  S.docs.forEach((d, di) => d.pages.forEach((p, pi) => {
    p.seals.forEach((r) => items.push({ doc: di, page: pi, type: 'seal', tier: 'mid', text: '印影', rects: [r], reason: '赤い丸い印の形', rule: 'seal' }));
    (p.lowConf || []).forEach((r) => {
      if (items.some((i) => i.doc === di && i.page === pi && i.rects.some((q) => overlapRatio(q, r) > 0.4))) return;
      const line = p.lines.find((l) => l.box === r || l.box.every((v, n) => v === r[n]));
      items.push({ doc: di, page: pi, type: 'lowconf', tier: 'low', text: line?.text || '（読めない箇所）', rects: [r], reason: '読み取りの自信が低い行です。目で確かめてください', rule: 'lowconf' });
    });
  }));
  const selKey = S.sel?.key;
  S.items = [...items, ...manual];
  applyDefaults();
  if (selKey) S.sel = S.items.find((i) => i.key === selKey) || null;
}
const overlapRatio = (a, b) => { const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), t = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); if (w <= 0 || t <= 0) return 0; return (w * t) / Math.min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1])); };
const groupOf = (it) => (it.type === 'lowconf' ? 'attention' : CATEGORIES[it.type]?.group || 'pro');
// 場面に合わせて最初の状態を決める。人が決めた箇所は変えない
function applyDefaults() {
  const groups = SCENES[S.scene].groups;
  for (const it of S.items) {
    it.key ||= itemKey(it);
    it.counted = S.counted.has(it.key);
    const d = S.decisions.get(it.key);
    const base = it.type === 'manual' || it.type === 'word' || it.type === 'learned' ? true : it.type === 'lowconf' ? false : groups.includes(groupOf(it)) && it.tier !== 'low';
    // ② 傾向：場面の対象のものだけ変える。変えたものは必ず要確認に出す（黙って消さない）
    const eff = S.learnOn && (base || it.tier === 'low') ? effectOf(S.stats, it) : null;
    let auto = eff === 'demote' ? false : eff === 'promote' ? true : base;
    // ① 案件メモ：この事件で決めた語。番号類は覚えない
    const tx = normText(it.text); let memo = null;
    if (!PROTECTED.has(it.type) && S.caseKeep.has(tx)) { auto = false; memo = 'keep'; }
    if (S.caseHide.has(tx)) { auto = true; memo = 'hide'; }
    it.baseOn = auto; it.learnedBy = memo ? (memo === 'keep' ? 'この案件で残すと決めた語' : 'この案件で隠すと決めた語') : eff === 'demote' ? 'よく解除しているので最初は残します' : eff === 'promote' ? 'よく隠しているので最初から隠します' : '';
    it.on = d ? d.on : auto;
    it.style = d?.style || 'black';
    it.seen = d?.seen || false;
    it.need = it.type === 'lowconf' || (it.tier === 'mid' && base) || it.rule === 'prop-fuzzy' || !!eff;
  }
}
function decide(it, patch) {
  Object.assign(it, patch);
  S.decisions.set(it.key, { on: it.on, style: it.style, seen: it.seen, ...(S.decisions.get(it.key) || {}), ...patch });
  if ('on' in patch) syncCaseMemory(it);
}
// 同じ語が全部「残す」なら残す語、最初は隠さない語を全部隠したなら隠す語として、この案件の間おぼえる。1か所だけの判断は広げない
function syncCaseMemory(it) {
  if (it.type === 'manual' || it.type === 'seal' || it.type === 'lowconf') return;
  const tx = normText(it.text); if (tx.length < 2) return;
  const same = S.items.filter((i) => i.type !== 'manual' && normText(i.text) === tx);
  S.caseKeep.delete(tx); S.caseHide.delete(tx);
  if (same.every((i) => !i.on)) { if (!PROTECTED.has(it.type)) S.caseKeep.add(tx); } else if (same.every((i) => i.on) && same.some((i) => i.tier === 'low')) S.caseHide.add(tx);
}
function pushUndo() { S.undo.push({ decisions: new Map(S.decisions), items: [...S.items] }); if (S.undo.length > 50) S.undo.shift(); }

// ---- 描画 ----
const pageItems = (di = S.di, pi = S.pi) => S.items.filter((i) => i.doc === di && i.page === pi);
const curPage = () => S.docs[S.di]?.pages[S.pi];
const evLabel = (d) => `${d.side}${d.no}${d.branch ? '-' + d.branch : ''}`;
function renderAll() { renderRail(); renderStage(); renderList(); renderFocus(); renderCounters(); }
function renderRail() {
  const box = $('docList');
  const sig = S.docs.map((d) => `${d.id}:${d.pages.length}:${evLabel(d)}`).join('|');
  if (!S.docs.length) { box.replaceChildren(); box.dataset.sig = ''; return; }
  if (box.dataset.sig !== sig) {
    // 画像は作り直すと重いので、書類が増えたときだけ組み直す
    box.dataset.sig = sig; box.replaceChildren();
    S.docs.forEach((d, di) => {
      box.append(h('div', { class: 'doc-name', title: d.name }, h('button', { class: 'doc-x', title: 'この書類を外す', 'aria-label': `${d.name} を外す`, text: '×', onclick: () => removeDoc(di) }), h('b', { text: evLabel(d) }), d.name));
      const grid = h('div', { class: 'thumbs' });
      d.pages.forEach((p, pi) => {
        p.thumbEl = h('button', { class: 'thumb', 'aria-label': `${evLabel(d)} ${pi + 1}ページ`, onclick: () => go(di, pi) }, h('img', { src: p.url, alt: '', loading: 'lazy' }), h('span', { class: 'thumb-no', text: String(pi + 1) }));
        p.markEl = h('span', { class: 'thumb-mark' }); p.markEl.hidden = true; p.thumbEl.append(p.markEl);
        grid.append(p.thumbEl);
      });
      box.append(grid);
    });
  }
  S.docs.forEach((d, di) => d.pages.forEach((p, pi) => {
    const here = pageItems(di, pi); const n = here.filter((i) => i.on).length, pending = here.filter((i) => i.need && !i.seen).length;
    p.thumbEl.classList.toggle('on', di === S.di && pi === S.pi);
    p.markEl.hidden = !(n || pending); p.markEl.classList.toggle('seen', !pending); p.markEl.textContent = pending ? `要${pending}` : String(n);
  }));
  box.querySelector('.thumb.on')?.scrollIntoView({ block: 'nearest' });
}
function go(di, pi, keepSel) {
  S.di = di; S.pi = pi;
  const p = curPage(); if (p) p.seen = true;
  if (!keepSel) S.sel = null;
  renderAll();
  $('stage').scrollTop = 0;
}
const baseWidth = () => { const room = $('stage').clientWidth - (window.innerWidth < 860 ? 24 : 52); return Math.max(240, Math.min(room > 0 ? room : 720, 820)); };
function renderStage() {
  const p = curPage(); if (!p) return;
  const img = $('pageImg');
  if (img.dataset.url !== p.url) { img.src = p.url; img.dataset.url = p.url; }
  const paper = $('paper'); paper.classList.toggle('final', S.final);
  paper.style.width = `${baseWidth() * S.zoom}px`;
  paper.style.aspectRatio = `${p.width} / ${p.height}`;
  $('zoomVal').textContent = `${round(S.zoom * 100)}%`;
  $('pageNo').textContent = `${S.pi + 1} / ${S.docs[S.di].pages.length}`;
  $('modeEdit').classList.toggle('on', !S.final); $('modeFinal').classList.toggle('on', S.final);
  const ov = $('overlay'); ov.replaceChildren();
  for (const it of pageItems()) {
    for (const r of it.rects) {
      const el = h('div', { class: `m ${it.on ? 'on' : 'off'}${it.need ? ' need' : ''}${it.seen ? ' seen' : ''}${it === S.sel ? ' sel' : ''}${it.style === 'redline' && it.on ? ' redline' : ''}`, title: `${labelOf(it)}：${it.text}` });
      el.style.left = `${(r[0] / p.width) * 100}%`; el.style.top = `${(r[1] / p.height) * 100}%`;
      el.style.width = `${((r[2] - r[0]) / p.width) * 100}%`; el.style.height = `${((r[3] - r[1]) / p.height) * 100}%`;
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', () => { pushUndo(); select(it, false); decide(it, { on: !it.on, seen: true }); renderAll(); });
      ov.append(el);
    }
  }
}
const labelOf = (it) => (it.type === 'lowconf' ? '読みにくい箇所' : CATEGORIES[it.type]?.label || it.type);

// 一覧：同じ語はまとめて1行
function buildRows() {
  const rows = new Map();
  for (const it of S.items) {
    const g = groupOf(it);
    const solo = it.type === 'manual' || it.type === 'seal' || it.type === 'lowconf';
    const k = solo ? it.key : `${it.tier === 'low' ? 'low' : g}:${it.type}:${normText(it.text)}`;
    if (!rows.has(k)) rows.set(k, { key: k, group: it.tier === 'low' && it.type !== 'lowconf' ? 'low' : g, items: [] });
    rows.get(k).items.push(it);
  }
  return [...rows.values()];
}
const GROUP_ORDER = ['attention', 'number', 'place', 'contact', 'person', 'pro', 'manual', 'low'];
const GROUP_NAME = { attention: '目で確かめる', ...Object.fromEntries(Object.entries(GROUPS).map(([k, v]) => [k, v.label])), low: '念のため（最初は隠しません）' };
function renderList() {
  const rows = buildRows();
  const need = (r) => r.items.some((i) => i.need && !i.seen);
  const chips = $('chips'); chips.replaceChildren();
  const counts = { all: rows.length, need: rows.filter(need).length };
  for (const g of GROUP_ORDER) counts[g] = rows.filter((r) => r.group === g).length;
  const chip = (k, label) => { if (k !== 'all' && !counts[k]) return; chips.append(h('button', { class: 'chip' + (S.filter === k ? ' on' : ''), onclick: () => { S.filter = k; renderList(); } }, label, h('b', { text: String(counts[k]) }))); };
  chip('all', 'すべて'); chip('need', '要確認');
  for (const g of GROUP_ORDER) chip(g, GROUP_NAME[g]);
  const list = $('list'); list.replaceChildren();
  const shown = rows.filter((r) => S.filter === 'all' || (S.filter === 'need' ? need(r) : r.group === S.filter));
  if (!shown.length) list.append(h('p', { class: 'empty', text: S.items.length ? 'この絞り込みに当てはまる箇所はありません' : '候補は見つかりませんでした。ページをよく見て、隠す場所をドラッグで塗ってください' }));
  for (const g of GROUP_ORDER) {
    const inG = shown.filter((r) => r.group === g);
    if (!inG.length) continue;
    list.append(h('div', { class: 'group-head', text: GROUP_NAME[g] }));
    for (const r of inG) {
      const first = r.items[0]; const onN = r.items.filter((i) => i.on).length; const all = onN === r.items.length;
      const cb = h('input', { type: 'checkbox', 'aria-label': `${first.text} を隠す`, checked: all, onclick: (e) => e.stopPropagation(), onchange: (e) => { pushUndo(); r.items.forEach((i) => decide(i, { on: e.target.checked, seen: true })); renderAll(); } });
      if (onN && !all) cb.indeterminate = true;
      const sel = S.sel && r.items.includes(S.sel);
      list.append(h('div', { class: `row${sel ? ' sel' : ''}${onN ? '' : ' off'}`, onclick: () => cycle(r) }, cb,
        h('span', { class: 'row-main' }, h('span', { class: 'row-val', text: first.text }), h('span', { class: 'row-sub' }, need(r) ? h('span', { class: 'row-need', text: '要確認' }) : null, labelOf(first), first.learnedBy ? `・${first.learnedBy}` : '')),
        r.items.length > 1 ? h('span', { class: 'row-n', text: `×${r.items.length}` }) : null));
    }
  }
}
function cycle(row) {
  const i = row.items.indexOf(S.sel);
  select(row.items[(i + 1) % row.items.length], true);
}
function select(it, scroll) {
  S.sel = it;
  if (it.doc !== S.di || it.page !== S.pi) { S.di = it.doc; S.pi = it.page; const p = curPage(); if (p) p.seen = true; }
  renderAll();
  if (scroll) requestAnimationFrame(() => document.querySelector('.m.sel')?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }));
}
function renderFocus() {
  const it = S.sel; const bar = $('focusBar');
  if (!it || S.final) { bar.hidden = true; return; }
  bar.hidden = false;
  $('focusTag').textContent = labelOf(it);
  $('focusVal').textContent = it.text;
  $('focusWhy').textContent = (it.learnedBy ? `【${it.learnedBy}】` : '') + it.reason + (BASIS[CATEGORIES[it.type]?.basis] ? `｜${BASIS[CATEGORIES[it.type].basis]}` : '');
  const same = S.items.filter((i) => i !== it && normText(i.text) === normText(it.text) && !i.on).length;
  const canAll = it.type === 'manual' && !/^手で追加 /.test(it.text);
  $('actAll').hidden = !(canAll || same > 0);
  $('actAll').textContent = same > 0 ? `同じ語を全部隠す（${same}）` : '同じ語を全ページで隠す';
  $('actHide').classList.toggle('ink', it.on && it.style === 'black');
  $('actRed').textContent = it.style === 'redline' ? '黒塗りに戻す' : '赤線';
}
function renderCounters() {
  const pending = S.items.filter((i) => i.need && !i.seen).length;
  const on = S.items.filter((i) => i.on);
  const btn = $('nextReview');
  btn.classList.toggle('done', pending === 0);
  $('reviewLabel').textContent = pending === 0 ? '要確認はすべて見ました' : S.items.some((i) => i.need && i.seen) || S.sel ? '次の確認へ' : '確認を始める';
  $('reviewCount').textContent = pending ? `残り ${pending} 件` : `全 ${S.items.length} 件`;
  const unseen = S.docs.flatMap((d) => d.pages).filter((p) => !p.seen).length;
  const manual = on.filter((i) => i.type === 'manual').length;
  $('summary').textContent = `黒塗り ${on.length} 箇所（手で追加 ${manual}）・隠さない ${S.items.length - on.length} 箇所${unseen ? `・まだ見ていないページ ${unseen}` : ''}`;
}
const orderKey = (i) => [i.doc, i.page, i.rects[0][1], i.rects[0][0]];
const cmp = (a, b) => { const x = orderKey(a), y = orderKey(b); for (let k = 0; k < 4; k++) if (x[k] !== y[k]) return x[k] - y[k]; return 0; };
function nextPending() {
  const list = S.items.filter((i) => i.need && !i.seen).sort(cmp);
  if (!list.length) { S.sel = null; renderAll(); toast('要確認はすべて見ました。念のため各ページも目で確かめてください'); return; }
  const after = S.sel ? list.find((i) => cmp(i, S.sel) > 0) : null;
  select(after || list[0], true);
}

// ---- 操作 ----
$('nextReview').addEventListener('click', () => { if (S.sel && S.sel.need) decide(S.sel, { seen: true }); nextPending(); });
$('actHide').addEventListener('click', () => act(true));
$('actKeep').addEventListener('click', () => act(false));
$('actNext').addEventListener('click', () => { if (S.sel) { decide(S.sel, { seen: true }); nextPending(); } });
$('actAll').addEventListener('click', async () => {
  const it = S.sel; if (!it) return;
  pushUndo();
  const tx = normText(it.text); let n = 0;
  for (const i of S.items) if (normText(i.text) === tx && !i.on) { decide(i, { on: true, seen: true }); n++; }
  if (it.type === 'manual' && !S.words.includes(it.text)) {
    S.words.push(it.text); await refreshDetection();
    n = S.items.filter((i) => i.type === 'word' && normText(i.text).includes(tx)).length;
  }
  S.caseHide.add(tx); renderAll();
  toast(`「${it.text}」を ${n} 箇所隠しました。この案件の次の書類にも反映します`);
});
$('actRed').addEventListener('click', () => { const it = S.sel; if (!it) return; pushUndo(); decide(it, { style: it.style === 'redline' ? 'black' : 'redline', on: true, seen: true }); renderAll(); });
function act(on) { const it = S.sel; if (!it) return; pushUndo(); decide(it, { on, seen: true }); nextPending(); }
$('modeEdit').addEventListener('click', () => { S.final = false; renderStage(); renderFocus(); });
$('modeFinal').addEventListener('click', () => { S.final = true; renderStage(); renderFocus(); });
// 拡大縮小はページの部分だけ。指定した点が同じ場所に留まるようにスクロールも合わせる
function zoomAt(next, cx, cy) {
  const stage = $('stage'), paper = $('paper'); const r0 = paper.getBoundingClientRect();
  const sr = stage.getBoundingClientRect(); if (cx == null) { cx = sr.left + sr.width / 2; cy = sr.top + sr.height / 2; }
  const fx = (cx - r0.left) / r0.width, fy = (cy - r0.top) / r0.height;
  S.zoom = Math.min(4, Math.max(0.25, next));
  paper.style.width = `${baseWidth() * S.zoom}px`;
  $('zoomVal').textContent = `${round(S.zoom * 100)}%`;
  const r1 = paper.getBoundingClientRect();
  stage.scrollLeft += r1.left + fx * r1.width - cx; stage.scrollTop += r1.top + fy * r1.height - cy;
}
function zoomFit() {
  const p = curPage(); if (!p) return;
  const stage = $('stage'); const room = stage.clientHeight - 52;
  S.zoom = Math.min(1, Math.max(0.25, ((room * p.width) / p.height) / baseWidth()));
  $('paper').style.width = `${baseWidth() * S.zoom}px`; $('zoomVal').textContent = `${round(S.zoom * 100)}%`;
  stage.scrollTop = 0; stage.scrollLeft = 0;
}
$('zoomIn').addEventListener('click', () => zoomAt(S.zoom * 1.25));
$('zoomOut').addEventListener('click', () => zoomAt(S.zoom / 1.25));
$('zoomFit').addEventListener('click', zoomFit);
$('zoomVal').addEventListener('click', () => zoomAt(1));
$('stage').addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.metaKey) return; // 普通のホイールはスクロールのまま
  e.preventDefault();
  zoomAt(S.zoom * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
}, { passive: false });
function undo() {
  const u = S.undo.pop(); if (!u) { toast('戻せる操作はありません'); return; }
  S.decisions = u.decisions; S.items = u.items; applyDefaults(); renderAll();
}
$('undo').addEventListener('click', undo);
$('wordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const w = $('wordInput').value.trim(); if (!w) return;
  pushUndo(); S.words.push(w); $('wordInput').value = '';
  await refreshDetection();
  const n = S.items.filter((i) => i.type === 'word' && normText(i.text).includes(normText(w))).length;
  renderAll();
  toast(n ? `「${w}」を ${n} 箇所隠しました` : `「${w}」は見つかりませんでした。読み間違いの可能性があるので、ページを見てドラッグで塗ってください`);
});
window.addEventListener('keydown', (e) => {
  if (document.body.dataset.view !== 'work') return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); return; }
  // ブラウザ全体の倍率でなく、ページの部分だけを変える
  if ((e.ctrlKey || e.metaKey) && (k === '+' || k === '=' || k === ';')) { e.preventDefault(); zoomAt(S.zoom * 1.25); return; }
  if ((e.ctrlKey || e.metaKey) && k === '-') { e.preventDefault(); zoomAt(S.zoom / 1.25); return; }
  if ((e.ctrlKey || e.metaKey) && k === '0') { e.preventDefault(); zoomAt(1); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k === 'h') act(true);
  else if (k === 'n') act(false);
  else if (k === 'enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); if (S.sel) decide(S.sel, { seen: true }); nextPending(); }
  else if (k === 'f') { S.final = !S.final; renderStage(); renderFocus(); }
  else if (k === 'escape') { S.sel = null; renderAll(); }
});
// ドラッグで範囲を追加
(() => {
  const ov = $('overlay'); let st = null, box = null;
  const pos = (e) => { const r = ov.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  ov.addEventListener('pointerdown', (e) => { if (e.target !== ov || S.final) return; ov.setPointerCapture(e.pointerId); st = pos(e); box = h('div', { class: 'draw' }); ov.append(box); });
  ov.addEventListener('pointermove', (e) => {
    if (!st) return; const q = pos(e);
    box.style.left = `${Math.min(st[0], q[0]) * 100}%`; box.style.top = `${Math.min(st[1], q[1]) * 100}%`;
    box.style.width = `${Math.abs(q[0] - st[0]) * 100}%`; box.style.height = `${Math.abs(q[1] - st[1]) * 100}%`;
  });
  const end = (e) => {
    if (!st) return; const q = pos(e); const p = curPage(); box.remove();
    const x0 = Math.min(st[0], q[0]) * p.width, x1 = Math.max(st[0], q[0]) * p.width, y0 = Math.min(st[1], q[1]) * p.height, y1 = Math.max(st[1], q[1]) * p.height; st = null;
    if (x1 - x0 < 6 || y1 - y0 < 6) return;
    pushUndo();
    const rect = [Math.max(0, x0), Math.max(0, y0), Math.min(p.width, x1), Math.min(p.height, y1)];
    const under = readUnderRect(p.lines, rect);
    ++S.manualSeq;
    const it = { doc: S.di, page: S.pi, type: 'manual', tier: 'high', text: under.text.length >= 2 ? under.text : `手で追加 ${S.manualSeq}`, rects: [rect], reason: '担当者が手で指定', rule: 'manual', on: true, style: 'black', seen: true, need: false };
    it.key = `${itemKey(it)}:${S.manualSeq}`;
    S.items.push(it); S.decisions.set(it.key, { on: true, style: 'black', seen: true });
    S.sel = it; renderAll();
    // ② 手で隠した欄の名前をおぼえる（人名や地名を含むものはおぼえない）
    if (S.learnOn && store && under.label) engine.safeLabel(under.label).then((safe) => { if (safe) { recordLabel(S.stats, under.label); saveStats(store, S.stats); } }).catch(() => {});
  };
  ov.addEventListener('pointerup', end); ov.addEventListener('pointercancel', () => { if (box) box.remove(); st = null; });
})();

$('toFinish').addEventListener('click', () => { if (S.reading || S.detecting > 0 || S.detectFailed) return; renderFinish(); show('finish'); });
$('backWork').addEventListener('click', () => { show('work'); renderAll(); });
$('wipe').addEventListener('click', () => {
  for (const d of S.docs) for (const p of d.pages) URL.revokeObjectURL(p.url);
  engine.terminate(); location.href = './';
});

// ---- 保存の画面 ----
function renderFinish() {
  const tb = document.querySelector('#evTable tbody'); tb.replaceChildren();
  S.docs.forEach((d, di) => {
    const side = h('select', { 'aria-label': '甲か乙か', onchange: (e) => { d.side = e.target.value; } });
    for (const v of ['甲', '乙', '丙']) side.append(h('option', { value: v, text: v, selected: d.side === v }));
    tb.append(h('tr', {},
      h('td', {}, side),
      h('td', {}, h('input', { type: 'number', min: 1, value: d.no, 'aria-label': '号証番号', onchange: (e) => { d.no = Math.max(1, +e.target.value || 1); } })),
      h('td', {}, h('input', { type: 'text', value: d.branch, 'aria-label': '枝番', onchange: (e) => { d.branch = e.target.value.trim(); } })),
      h('td', { class: 'file', title: d.name, text: d.name }),
      h('td', { text: String(d.pages.length) }),
      h('td', { text: String(S.items.filter((i) => i.doc === di && i.on).length) })));
  });
  $('checks').replaceChildren(h('li', { class: 'wait', text: '書き出すと、ここに結果が出ます' }));
  $('downloads').hidden = true; $('exportError').hidden = true;
  const pending = S.items.filter((i) => i.need && !i.seen).length; const unseen = S.docs.flatMap((d) => d.pages).filter((p) => !p.seen).length;
  const warn = [];
  if (pending) warn.push(`要確認が ${pending} 件残っています`);
  if (unseen) warn.push(`見ていないページが ${unseen} ページあります`);
  $('finishTitle').textContent = warn.length ? `${warn.join('。')}` : '提出の形を決める';
}
function check(state, title, detail, action) {
  const li = h('li', { class: state === 'ng' ? 'ng-row' : '' }, h('span', { class: `mark ${state}`, text: state === 'ok' ? '合格' : state === 'ng' ? '要確認' : '検査中' }), h('span', {}, title, detail ? h('small', { text: detail }) : null, action || null));
  return li;
}
$('runExport').addEventListener('click', async () => {
  if (S.reading || S.detecting > 0) { toast('候補の更新が終わってから書き出してください'); return; }
  const btn = $('runExport'); btn.disabled = true; btn.textContent = '書き出しています'; $('exportError').hidden = true; $('downloads').hidden = true;
  const box = $('checks'); box.replaceChildren(check('run', '書き出しと検査をしています'));
  try {
    const r = await runExport({
      docs: S.docs, items: S.items, engine,
      options: { stamp: $('optStamp').checked, binding: $('optBinding').checked, caseNo: $('optCase').value.trim(), filer: $('optFiler').value.trim(), scene: SCENES[S.scene].label },
      onProgress: (msg) => { box.replaceChildren(check('run', msg)); },
    });
    box.replaceChildren();
    for (const c of r.checks) {
      const jump = c.jump ? h('button', { class: 'jump', text: 'この場所を見る', onclick: () => { show('work'); go(c.jump.doc, c.jump.page); } }) : null;
      box.append(check(c.ok ? 'ok' : 'ng', c.title, c.detail, jump));
    }
    if (S.learnOn && store) { recordDecisions(S.stats, S.items); saveStats(store, S.stats); for (const i of S.items) if (i.counted) S.counted.add(i.key); }
    const allOk = r.checks.every((c) => c.ok);
    const setDl = (a, blob, name) => { a.href = URL.createObjectURL(blob); a.download = name; };
    setDl($('dlAll'), r.bundle, r.bundleName); setDl($('dlPng'), r.pngZip, '画像（ページごと）.zip'); setDl($('dlList'), r.listCsv, '黒塗り箇所一覧_提出用.csv'); setDl($('dlInternal'), r.internalCsv, '【社内控え・提出禁止】黒塗り一覧_原文あり.csv');
    const each = $('dlEach'); each.replaceChildren();
    for (const f of r.pdfs) { const a = h('a', { class: 'dl', text: f.name }); setDl(a, f.blob, f.name); each.append(a); }
    $('downloads').hidden = false;
    if (!allOk) box.prepend(h('li', { class: 'ng-row' }, h('span', { class: 'mark ng', text: '注意' }), h('span', { text: '検査に通らない項目があります。上の場所を確かめてから保存してください' })));
    $('finishTitle').textContent = allOk ? '検査に通りました。保存できます' : '検査で気になる箇所があります';
  } catch (e) {
    box.replaceChildren(check('ng', '書き出しに失敗しました', `ファイルは作られていません。理由：${e.message}`));
    const er = $('exportError'); er.textContent = 'メモリが足りない場合は、ほかのタブを閉じるか、書類を分けて試してください。'; er.hidden = false;
  } finally { btn.disabled = false; btn.textContent = '書き出して検査する'; }
});

window.addEventListener('resize', () => { if (document.body.dataset.view === 'work') renderStage(); });
// ---- 学習と案件メモの画面 ----
const RULE_NAME = (r) => `${CATEGORIES[r.type]?.label || r.type}`;
function renderMemo() {
  $('memoCount').textContent = `隠す語 ${S.words.length + S.caseHide.size}／残す語 ${S.caseKeep.size}`;
  const box = $('memoWords'); box.replaceChildren();
  const addChip = (w, kind, remove) => box.append(h('button', { class: 'memo-chip', title: '押すと忘れます', onclick: async () => { remove(); await refreshIfNeeded(); renderMemo(); } }, h('span', { class: 'memo-kind', text: kind }), w, ' ×'));
  for (const w of S.words) addChip(w, '隠す', () => { S.words = S.words.filter((q) => q !== w); });
  for (const w of S.caseHide) addChip(w, '隠す', () => S.caseHide.delete(w));
  for (const w of S.caseKeep) addChip(w, '残す', () => S.caseKeep.delete(w));
  if (!box.children.length) box.append(h('p', { class: 'memo-empty', text: 'まだありません。一覧で解除したり、手で塗って「同じ語を全ページで隠す」を押すと、ここに入ります' }));
  $('learnOn').checked = S.learnOn;
  const tb = $('learnRules'); tb.replaceChildren();
  const rows = Object.values(S.stats.rules).filter((r) => r.onN + r.offN > 0).sort((a, b) => (b.onN + b.offN) - (a.onN + a.offN));
  for (const r of rows) {
    const eff = effectOf(S.stats, { type: r.type, rule: r.rule, tier: r.offN > r.onN ? 'low' : 'mid' });
    tb.append(h('tr', {}, h('td', { text: RULE_NAME(r) }), h('td', { class: 'r', text: String(r.onN + r.offN) }), h('td', { class: 'r', text: String(r.onOff) }), h('td', { class: 'r', text: String(r.offOn) }), h('td', { text: PROTECTED.has(r.type) ? '必ず隠す候補（変えません）' : eff === 'demote' ? '最初は残す' : eff === 'promote' ? '最初から隠す' : 'そのまま' })));
  }
  if (!rows.length) tb.append(h('tr', {}, h('td', { colspan: 5, class: 'memo-empty', text: 'まだ記録がありません。書き出すと、確認した分だけ数えます' })));
  const labs = Object.entries(S.stats.labels);
  $('learnLabels').textContent = labs.length ? labs.map(([k, v]) => `${k}（${v.n}回${v.n >= 2 ? '・自動で候補に' : ''}）`).join('、') : 'まだありません';
}
async function refreshIfNeeded() { if (S.docs.length) { await refreshDetection(); renderAll(); } }
const memoError = (msg) => { const e = $('memoError'); e.textContent = msg; e.hidden = !msg; };
$('openMemo').addEventListener('click', () => { renderMemo(); memoError(''); $('memoDlg').showModal(); });
$('openMemoStart').addEventListener('click', () => { renderMemo(); memoError(''); $('memoDlg').showModal(); });
$('closeMemo').addEventListener('click', () => { $('memoDlg').close(); $('memoPass').value = ''; });
$('learnOn').addEventListener('change', async (e) => { S.learnOn = e.target.checked; if (store) setLearnEnabled(store, S.learnOn); await refreshIfNeeded(); toast(S.learnOn ? 'この端末で傾向を学習します' : '傾向の学習を止めました（記録は残っています）'); });
$('clearLearn').addEventListener('click', async () => { S.stats = emptyStats(); if (store) clearStats(store); await refreshIfNeeded(); renderMemo(); toast('この端末の学習の記録を消しました'); });
$('saveMemo').addEventListener('click', async () => {
  memoError('');
  try {
    const bytes = await encryptMemo({ v: 1, words: S.words, hide: [...S.caseHide], keep: [...S.caseKeep], scene: S.scene }, $('memoPass').value);
    const a = $('memoDl'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' })); a.download = '案件メモ.sumi'; a.hidden = false; a.click();
    toast('暗号化して保存しました。パスワードを忘れると開けません');
  } catch (e) { memoError(e.message); }
});
$('loadMemo').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return; memoError('');
  try {
    const memo = await decryptMemo(new Uint8Array(await f.arrayBuffer()), $('memoPass').value);
    S.words = [...new Set([...S.words, ...memo.words])]; memo.hide.forEach((w) => S.caseHide.add(w)); memo.keep.forEach((w) => S.caseKeep.add(w));
    if (memo.scene && SCENES[memo.scene]) { S.scene = memo.scene; $('sceneSel').value = memo.scene; const radio = document.querySelector(`input[name=scene][value=${memo.scene}]`); if (radio) radio.checked = true; }
    await refreshIfNeeded(); renderMemo(); toast('案件メモを読み込みました');
  } catch (err) { memoError(err.message); }
});

buildScenePick();
// 回線が切れても動くように、プログラムとモデルを端末に控える（書類は控えない）
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js').catch(() => {});
export { S };
