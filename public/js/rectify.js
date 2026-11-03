// スマホ写真やスキャンの補正：紙の四隅を見つけてまっすぐに伸ばす／傾きを直す。DOM を使わない。
// 返す transform は「元画像の座標 → 補正後の座標」の 3×3 行列。

function toGray(img, maxSide) {
  const s = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
  const g = new Uint8Array(w * h); const d = img.data, W = img.width;
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor(y / s));
    for (let x = 0; x < w; x++) {
      const i = (sy * W + Math.min(W - 1, Math.floor(x / s))) * 4;
      g[y * w + x] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    }
  }
  return { g, w, h, s };
}
function otsu(g) {
  const hist = new Float64Array(256); for (const v of g) hist[v]++;
  let total = g.length, sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, th = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue; const wF = total - wB; if (!wF) break;
    sumB += i * hist[i]; const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; th = i; }
  }
  return th;
}
function fitLine(pts, xFromY) {
  // x = a*y + b（xFromY）／ y = a*x + b を、はずれ値を除きながら求める
  let use = pts;
  let a = 0, b = 0;
  for (let round = 0; round < 3; round++) {
    let sx = 0, sy = 0, sxx = 0, sxy = 0; const n = use.length;
    if (n < 4) return null;
    for (const [px, py] of use) { const u = xFromY ? py : px, v = xFromY ? px : py; sx += u; sy += v; sxx += u * u; sxy += u * v; }
    const den = n * sxx - sx * sx; if (!den) return null;
    a = (n * sxy - sx * sy) / den; b = (sy - a * sx) / n;
    const res = use.map(([px, py]) => Math.abs((xFromY ? px : py) - (a * (xFromY ? py : px) + b))).sort((p, q) => p - q);
    const cut = Math.max(1.5, res[Math.floor(n * 0.7)] * 1.5);
    use = use.filter(([px, py]) => Math.abs((xFromY ? px : py) - (a * (xFromY ? py : px) + b)) <= cut);
  }
  const res = use.map(([px, py]) => Math.abs((xFromY ? px : py) - (a * (xFromY ? py : px) + b))).sort((p, q) => p - q);
  return { a, b, xFromY, med: res[Math.floor(res.length / 2)] || 0, kept: use.length / pts.length };
}
function intersect(v, h) { // v: x = a*y+b, h: y = c*x+d
  const y = (h.a * v.b + h.b) / (1 - h.a * v.a); const x = v.a * y + v.b; return [x, y];
}
export function findPaper(img) {
  const { g, w, h, s } = toGray(img, 700);
  const th = otsu(g);
  const label = new Uint8Array(w * h); let best = null; const stack = [];
  for (let st = 0; st < w * h; st += 3) {
    if (g[st] <= th || label[st]) continue;
    const q = { area: 0, x0: w, y0: h, x1: 0, y1: 0, st };
    label[st] = 1; stack.push(st);
    while (stack.length) {
      const p = stack.pop(); const x = p % w, y = (p - x) / w; q.area++;
      if (x < q.x0) q.x0 = x; if (x > q.x1) q.x1 = x; if (y < q.y0) q.y0 = y; if (y > q.y1) q.y1 = y;
      if (x > 0 && !label[p - 1] && g[p - 1] > th) { label[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && !label[p + 1] && g[p + 1] > th) { label[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && !label[p - w] && g[p - w] > th) { label[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && !label[p + w] && g[p + w] > th) { label[p + w] = 1; stack.push(p + w); }
    }
    if (!best || q.area > best.area) best = q;
  }
  if (!best) return null;
  const frame = w * h, frac = best.area / frame;
  if (frac < 0.2 || frac > 0.9) return null;
  // 紙の外がほぼ紙と同じ明るさなら、補正しない
  let out = 0, outN = 0, inn = 0, innN = 0;
  for (let i = 0; i < frame; i += 7) { const x = i % w, y = (i - x) / w; const inside = x >= best.x0 && x <= best.x1 && y >= best.y0 && y <= best.y1; if (inside) { inn += g[i]; innN++; } else { out += g[i]; outN++; } }
  if (outN > 50 && innN > 50 && inn / innN - out / outN < 25) return null;
  // 紙の連結を塗り直して境界を集める
  const mask = new Uint8Array(w * h); stack.push(best.st); mask[best.st] = 1;
  while (stack.length) {
    const p = stack.pop(); const x = p % w, y = (p - x) / w;
    if (x > 0 && !mask[p - 1] && g[p - 1] > th) { mask[p - 1] = 1; stack.push(p - 1); }
    if (x < w - 1 && !mask[p + 1] && g[p + 1] > th) { mask[p + 1] = 1; stack.push(p + 1); }
    if (y > 0 && !mask[p - w] && g[p - w] > th) { mask[p - w] = 1; stack.push(p - w); }
    if (y < h - 1 && !mask[p + w] && g[p + w] > th) { mask[p + w] = 1; stack.push(p + w); }
  }
  const L = [], R = [], T = [], B = [];
  const bw = best.x1 - best.x0, bh = best.y1 - best.y0;
  for (let y = best.y0 + Math.ceil(bh * 0.12); y < best.y1 - bh * 0.12; y += 2) {
    let a = -1, b = -1; for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (a < 0) a = x; b = x; }
    if (a >= 0) { L.push([a, y]); R.push([b, y]); }
  }
  for (let x = best.x0 + Math.ceil(bw * 0.12); x < best.x1 - bw * 0.12; x += 2) {
    let a = -1, b = -1; for (let y = 0; y < h; y++) if (mask[y * w + x]) { if (a < 0) a = y; b = y; }
    if (a >= 0) { T.push([x, a]); B.push([x, b]); }
  }
  const lf = fitLine(L, true), rf = fitLine(R, true), tf = fitLine(T, false), bf = fitLine(B, false);
  if (!lf || !rf || !tf || !bf) return null;
  const size = Math.max(w, h);
  if ([lf, rf, tf, bf].some((f) => f.med > size * 0.012 || f.kept < 0.5)) return null;
  const c = [intersect(lf, tf), intersect(rf, tf), intersect(rf, bf), intersect(lf, bf)].map(([x, y]) => [x / s, y / s]);
  // 四隅が枠のすぐ外ならよいが、大きく外れるなら信用しない
  if (c.some(([x, y]) => x < -img.width * 0.03 || y < -img.height * 0.03 || x > img.width * 1.03 || y > img.height * 1.03)) return null;
  return c;
}
// src 4点 → dst 4点 の射影行列
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let i = 0; i < 8; i++) {
    let p = i; for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < 8; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const x = new Array(8).fill(0);
  for (let i = 7; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < 8; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
  return [x[0], x[1], x[2], x[3], x[4], x[5], x[6], x[7], 1];
}
export function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m; const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A, c * h - b * i, b * f - c * e, B, a * i - c * g, c * d - a * f, C, b * g - a * h, a * e - b * d].map((v) => v / det);
}
export function mul3(p, q) {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += p[i * 3 + k] * q[k * 3 + j];
  return r;
}
export const applyH = (m, x, y) => { const w = m[6] * x + m[7] * y + m[8]; return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]; };

// 行列 toDst（元→先）で画像を作り直す
export function warp(img, toDst, W, H, fill = [255, 255, 255]) {
  const inv = invert3(toDst); const out = new Uint8ClampedArray(W * H * 4); const d = img.data, sw = img.width, sh = img.height;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const den = inv[6] * x + inv[7] * y + inv[8];
      const u = (inv[0] * x + inv[1] * y + inv[2]) / den, v = (inv[3] * x + inv[4] * y + inv[5]) / den;
      const o = (y * W + x) * 4; out[o + 3] = 255;
      if (u < 0 || v < 0 || u >= sw - 1 || v >= sh - 1) { out[o] = fill[0]; out[o + 1] = fill[1]; out[o + 2] = fill[2]; continue; }
      const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv; const p = (iv * sw + iu) * 4;
      for (let c = 0; c < 3; c++) {
        out[o + c] = (d[p + c] * (1 - fu) + d[p + 4 + c] * fu) * (1 - fv) + (d[p + sw * 4 + c] * (1 - fu) + d[p + sw * 4 + 4 + c] * fu) * fv;
      }
    }
  }
  return { data: out, width: W, height: H };
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// 紙の補正
export function straightenPaper(img) {
  const c = findPaper(img); if (!c) return null;
  let W = (dist(c[0], c[1]) + dist(c[3], c[2])) / 2, H = (dist(c[0], c[3]) + dist(c[1], c[2])) / 2;
  // A判に近ければ A判の縦横比にそろえる
  const ratio = Math.max(W, H) / Math.min(W, H);
  if (Math.abs(ratio - Math.SQRT2) < 0.12) { if (H >= W) H = W * Math.SQRT2; else W = H * Math.SQRT2; }
  const sc = Math.min(1.3, 2400 / Math.max(W, H)); W = Math.round(W * sc); H = Math.round(H * sc);
  const toDst = homography(c, [[0, 0], [W, 0], [W, H], [0, H]]);
  return { image: warp(img, toDst, W, H), transform: toDst, corners: c };
}
// 傾きの角度（度）を、文字の並びの投影で求める
export function estimateSkew(img) {
  const { g, w, h } = toGray(img, 1000);
  const sorted = Uint8Array.from(g).sort(); const med = sorted[sorted.length >> 1];
  const xs = [], ys = [];
  for (let y = 2; y < h - 2; y += 1) for (let x = 2; x < w - 2; x += 1) if (g[y * w + x] < med - 55) { xs.push(x); ys.push(y); }
  if (xs.length < 300) return 0;
  const step = Math.max(1, Math.floor(xs.length / 60000));
  const score = (deg) => {
    const t = (deg * Math.PI) / 180, cs = Math.cos(t), sn = Math.sin(t); const n = (w + h) * 2 + 4;
    const row = new Int32Array(n), colv = new Int32Array(n);
    for (let i = 0; i < xs.length; i += step) {
      const x = xs[i], y = ys[i];
      row[Math.round(y * cs - x * sn) + w + h]++; colv[Math.round(x * cs + y * sn) + w + h]++;
    }
    let a = 0, b = 0; for (let i = 1; i < n; i++) { a += (row[i] - row[i - 1]) ** 2; b += (colv[i] - colv[i - 1]) ** 2; }
    return Math.max(a, b);
  };
  let best = 0, bs = -1;
  for (let d = -3.5; d <= 3.5; d += 0.25) { const v = score(d); if (v > bs) { bs = v; best = d; } }
  let b2 = best;
  for (let d = best - 0.2; d <= best + 0.2; d += 0.05) { const v = score(d); if (v > bs) { bs = v; b2 = d; } }
  return b2;
}
export function deskew(img) {
  const deg = estimateSkew(img);
  if (Math.abs(deg) < 0.15) return null;
  const t = (deg * Math.PI) / 180, cs = Math.cos(t), sn = Math.sin(t);
  const cx = img.width / 2, cy = img.height / 2;
  // 元→先：中心回りの回転（score の row = y cos − x sin に合わせる）
  const toDst = [cs, sn, cx - cs * cx - sn * cy, -sn, cs, cy + sn * cx - cs * cy, 0, 0, 1];
  // 余白の色は紙の色（明るい方）に合わせる
  const px = img.data; let bg = 0; for (let i = 0; i < px.length; i += 4 * 97) bg = Math.max(bg, px[i]);
  return { image: warp(img, toDst, img.width, img.height, [bg, bg, bg]), transform: toDst, degrees: deg };
}
// 赤い印影を探す。返り値は [x0,y0,x1,y1] のリスト
export function findSeals(img) {
  const st = 2, w = Math.floor(img.width / st), h = Math.floor(img.height / st);
  const red = new Uint8Array(w * h); const d = img.data, W = img.width;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * st * W + x * st) * 4; const r = d[i], g = d[i + 1], b = d[i + 2];
    if (r > 140 && r - g > 70 && r - b > 60) red[y * w + x] = 1; // 文字のふちの色むら（画面の写し）を拾わないよう強めに判定
  }
  // 少し太らせてから連結（印影の線は途切れる）
  const fat = new Uint8Array(w * h);
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) if (red[y * w + x]) for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) fat[(y + a) * w + x + b] = 1;
  const out = []; const seen = new Uint8Array(w * h); const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!fat[s] || seen[s]) continue;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0; seen[s] = 1; stack.push(s);
    while (stack.length) {
      const p = stack.pop(); const x = p % w, y = (p - x) / w; area++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - w, p + w]) if (q >= 0 && q < w * h && fat[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
    }
    const bw = (x1 - x0 + 1) * st, bh = (y1 - y0 + 1) * st, ar = bw / bh;
    const min = Math.min(img.width, img.height) * 0.018, max = Math.min(img.width, img.height) * 0.16;
    if (bw < min || bh < min || bw > max || bh > max || ar < 0.55 || ar > 1.8) continue;
    // 本物の印影は赤い線がある程度の量を占める
    let redCount = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (red[y * w + x]) redCount++;
    const density = redCount / ((x1 - x0 + 1) * (y1 - y0 + 1));
    if (density < 0.1 || redCount < 40) continue;
    const pad = 3 * st;
    out.push([Math.max(0, x0 * st - pad), Math.max(0, y0 * st - pad), Math.min(img.width, (x1 + 1) * st + pad), Math.min(img.height, (y1 + 1) * st + pad)]);
  }
  return out;
}

// 明るい部分の細かいざらつきを測り、強いときだけ 3×3 の中央値で均す
export function denoiseForOcr(img) {
  const { data: d, width: w, height: h } = img;
  let sum = 0, n = 0;
  for (let y = 4; y < h - 4; y += 7) for (let x = 4; x < w - 4; x += 7) {
    const a = d[(y * w + x) * 4], b = d[(y * w + x + 1) * 4], c = d[((y + 1) * w + x) * 4];
    if (a > 170 && b > 170 && c > 170) { sum += Math.abs(a - b) + Math.abs(a - c); n++; }
  }
  if (!n || sum / n / 2 < 2.2) return img;
  // 読み取り用なので白黒にして、3×3 の中央値を速い比較の並びで求める
  const total = w * h; const g = new Uint8Array(total);
  for (let i = 0; i < total; i++) g[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
  const out = new Uint8ClampedArray(d.length);
  const med = (a0, a1, a2, a3, a4, a5, a6, a7, a8) => {
    let t;
    if (a1 > a2) { t = a1; a1 = a2; a2 = t; } if (a4 > a5) { t = a4; a4 = a5; a5 = t; } if (a7 > a8) { t = a7; a7 = a8; a8 = t; }
    if (a0 > a1) { t = a0; a0 = a1; a1 = t; } if (a3 > a4) { t = a3; a3 = a4; a4 = t; } if (a6 > a7) { t = a6; a6 = a7; a7 = t; }
    if (a1 > a2) { t = a1; a1 = a2; a2 = t; } if (a4 > a5) { t = a4; a4 = a5; a5 = t; } if (a7 > a8) { t = a7; a7 = a8; a8 = t; }
    if (a0 > a3) a3 = a0; if (a5 > a8) a5 = a8; if (a4 > a7) { t = a4; a4 = a7; a7 = t; }
    if (a3 > a6) a6 = a3; if (a1 > a4) a4 = a1; if (a2 > a5) a2 = a5;
    if (a4 > a7) a4 = a7; if (a4 > a2) { t = a4; a4 = a2; a2 = t; } if (a6 > a4) a4 = a6; if (a4 > a2) a4 = a2;
    return a4;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = i * 4; let v = g[i];
    if (y > 0 && x > 0 && y < h - 1 && x < w - 1) v = med(g[i - w - 1], g[i - w], g[i - w + 1], g[i - 1], g[i], g[i + 1], g[i + w - 1], g[i + w], g[i + w + 1]);
    out[o] = out[o + 1] = out[o + 2] = v; out[o + 3] = 255;
  }
  return { data: out, width: w, height: h };
}
