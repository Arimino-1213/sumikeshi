// 学習：①案件メモ（語を覚える。保存は暗号化ファイルのみ）②傾向（ルール名と回数・欄の名前だけを端末に残す）
// 書類の原文を端末に残さないこと、番号類が学習で外れないことを守る。DOM を使わないので Node でも試験できる。

// 学習で「最初は残す」にしてはいけない種類。個人番号などを解除し続けても、次も必ず隠す候補として出す
export const PROTECTED = new Set(['mynumber', 'jukicode', 'license', 'passport', 'pension', 'zairyu', 'insurance', 'account', 'card', 'phone', 'email', 'snsid', 'address', 'postal', 'honseki', 'birth', 'manual', 'word', 'learned', 'lowconf']);
const DEMOTE_MIN = 8, DEMOTE_RATE = 0.8; // 8回以上の判断で8割以上解除
const PROMOTE_MIN = 5, PROMOTE_RATE = 0.6; // 「念のため」を5回以上の判断で6割以上隠した

export const emptyStats = () => ({ v: 1, rules: {}, labels: {} });
const keyOf = (it) => `${it.type}:${it.rule}`;

// 人が判断した項目だけを数える（見ていない項目は数えない）。同じ項目は1回だけ
export function recordDecisions(stats, items) {
  let n = 0;
  for (const it of items) {
    if (!it.rule || it.counted || !it.seen || it.type === 'manual' || it.type === 'word' || it.type === 'lowconf') continue;
    const r = (stats.rules[keyOf(it)] ||= { type: it.type, rule: it.rule, onN: 0, onOff: 0, offN: 0, offOn: 0 });
    if (it.baseOn) { r.onN++; if (!it.on) r.onOff++; } else { r.offN++; if (it.on) r.offOn++; }
    it.counted = true; n++;
  }
  return n;
}

// 傾向にもとづく最初の状態の変更。'demote'＝最初は残す、'promote'＝最初から隠す、null＝変えない
export function effectOf(stats, it) {
  const r = stats?.rules?.[keyOf(it)];
  if (!r) return null;
  if (!PROTECTED.has(it.type) && it.tier !== 'high' && r.onN >= DEMOTE_MIN && r.onOff / r.onN >= DEMOTE_RATE) return 'demote';
  if (it.tier === 'low' && r.offN >= PROMOTE_MIN && r.offOn / r.offN >= PROMOTE_RATE) return 'promote';
  return null;
}

export function recordLabel(stats, label) {
  if (!label) return;
  const l = (stats.labels[label] ||= { n: 0 }); l.n++;
}
export const learnedLabels = (stats) => Object.entries(stats?.labels || {}).filter(([, v]) => v.n >= 2).map(([k]) => k);

export function loadStats(storage) {
  try {
    const s = JSON.parse(storage.getItem('sumi.learn.v1') || 'null');
    if (s && s.v === 1 && s.rules && s.labels) return s;
  } catch { /* 読めなければ空から */ }
  return emptyStats();
}
export function saveStats(storage, stats) { try { storage.setItem('sumi.learn.v1', JSON.stringify(stats)); return true; } catch { return false; } }
export function learnEnabled(storage) { try { return storage.getItem('sumi.learn.on') !== '0'; } catch { return false; } }
export function setLearnEnabled(storage, on) { try { storage.setItem('sumi.learn.on', on ? '1' : '0'); } catch { /* 保存できなくても動く */ } }
export function clearStats(storage) { try { storage.removeItem('sumi.learn.v1'); } catch { /* 同上 */ } }

// 手で塗った四角の下の文字と、その左にある欄の名前を求める
export function readUnderRect(lines, rect) {
  const [x0, y0, x1, y1] = rect; const parts = []; let label = '';
  for (const L of lines) {
    const covered = []; (L.chars || []).forEach((c, i) => { const cx = (c.box[0] + c.box[2]) / 2, cy = (c.box[1] + c.box[3]) / 2; if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) covered.push(i); });
    if (!covered.length) continue;
    parts.push(covered.map((i) => L.chars[i].c).join(''));
    if (!label && !L.vertical) {
      const before = L.chars.slice(0, covered[0]).map((c) => c.c).join('').replace(/[\s:：]+$/, '');
      const m = /[^\s:：、。]{2,8}$/.exec(before);
      if (m) label = m[0];
    }
  }
  if (parts.length && !label) {
    // 同じ段で左隣の欄
    const h = y1 - y0; let best = null, bd = 1e9;
    for (const L of lines) {
      const cy = (L.box[1] + L.box[3]) / 2; if (cy < y0 - h * 0.3 || cy > y1 + h * 0.3 || L.box[2] > x0 + 4) continue;
      const d = x0 - L.box[2]; if (d < bd && d < h * 8) { bd = d; best = L; }
    }
    if (best) { const t = best.text.trim().replace(/[:：]$/, ''); if (t.length >= 2 && t.length <= 8) label = t; }
  }
  return { text: parts.join('').trim(), label };
}

// ---- 案件メモの暗号化（パスワードから鍵を作り AES-GCM で暗号化。平文は書き出さない）----
const MAGIC = new TextEncoder().encode('SUMI1');
const ITER = 600000;
async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptMemo(memo, password) {
  if (!password || password.length < 8) throw new Error('パスワードは8文字以上にしてください');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(password, salt), new TextEncoder().encode(JSON.stringify(memo))));
  const out = new Uint8Array(MAGIC.length + salt.length + iv.length + ct.length);
  out.set(MAGIC, 0); out.set(salt, MAGIC.length); out.set(iv, MAGIC.length + salt.length); out.set(ct, MAGIC.length + salt.length + iv.length);
  return out;
}
export async function decryptMemo(bytes, password) {
  if (bytes.length < MAGIC.length + 29 || !MAGIC.every((b, i) => bytes[i] === b)) throw new Error('案件メモのファイルではありません');
  const salt = bytes.slice(MAGIC.length, MAGIC.length + 16), iv = bytes.slice(MAGIC.length + 16, MAGIC.length + 28), ct = bytes.slice(MAGIC.length + 28);
  let plain;
  try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await deriveKey(password, salt), ct); } catch { throw new Error('パスワードが違うか、ファイルが壊れています'); }
  const memo = JSON.parse(new TextDecoder().decode(plain));
  if (memo.v !== 1) throw new Error('この案件メモには対応していません');
  return { v: 1, words: [], hide: [], keep: [], ...memo };
}
