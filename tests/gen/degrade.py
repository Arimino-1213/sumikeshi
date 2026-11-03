# clean_p*.png から「スキャン風」「スマホ写真風」を作り、正解の位置も同じ変換で動かす
import cv2, numpy as np, json, os, glob, random
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs')
def rd(p): return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
def wr(p, im, q=None):
    ext = os.path.splitext(p)[1]; ok, b = cv2.imencode(ext, im, [cv2.IMWRITE_JPEG_QUALITY, q] if q else []); b.tofile(p)
def tf_rects(rects, H, w, h, W2, H2):
    out = []
    for r in rects:
        x0, y0, x1, y1 = r[0] * w, r[1] * h, r[2] * w, r[3] * h
        pts = np.float32([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]).reshape(-1, 1, 2)
        q = cv2.perspectiveTransform(pts, H).reshape(-1, 2)
        out.append([float(q[:, 0].min() / W2), float(q[:, 1].min() / H2), float(q[:, 0].max() / W2), float(q[:, 1].max() / H2)])
    return out
def apply_truth(t, Hs, sizes):
    t2 = dict(t)
    for key in ('entities', 'keeps'):
        t2[key] = []
        for e in t[key]:
            (w, h), (W2, H2) = sizes[e['page']]
            t2[key].append({**e, 'rects': tf_rects(e['rects'], Hs[e['page']], w, h, W2, H2)})
    return t2
def scan(im, seed):
    r = random.Random(seed); np.random.seed(seed % 2**31); h, w = im.shape[:2]
    a = r.uniform(-1.6, 1.6); dx, dy = r.uniform(-14, 14), r.uniform(-14, 14)
    M = cv2.getRotationMatrix2D((w / 2, h / 2), a, 1.0); M[:, 2] += (dx, dy)
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    g = cv2.warpAffine(g, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=250)
    g = cv2.GaussianBlur(g, (3, 3), 0.7)
    g = np.clip(g.astype(np.float32) * 0.93 + 12 + np.random.normal(0, 7, g.shape), 0, 255).astype(np.uint8)
    for _ in range(60):
        x, y = r.randrange(w), r.randrange(h); cv2.circle(g, (x, y), r.choice([1, 1, 2]), r.randrange(40, 150), -1)
    return cv2.cvtColor(g, cv2.COLOR_GRAY2BGR), np.vstack([M, [0, 0, 1]]), (w, h)
def desk(W, H, seed):
    np.random.seed(seed % 2**31); base = np.full((H, W, 3), (66, 92, 120), np.float32)
    n = cv2.resize(np.random.normal(0, 22, (H // 12 + 1, W // 12 + 1, 3)).astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
    return np.clip(base + n, 0, 255)
def photo(im, seed):
    r = random.Random(seed); h, w = im.shape[:2]; W, H = int(w * 1.22), int(h * 1.18)
    ox, oy = (W - w) / 2, (H - h) / 2; j = lambda s: r.uniform(-s, s)
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([[ox + j(70), oy + j(60)], [ox + w + j(70), oy + j(60)], [ox + w + j(45), oy + h + j(50)], [ox + j(45), oy + h + j(50)]])
    Hm = cv2.getPerspectiveTransform(src, dst)
    bg = desk(W, H, seed); warped = cv2.warpPerspective(im, Hm, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0))
    mask = cv2.warpPerspective(np.full((h, w), 255, np.uint8), Hm, (W, H)).astype(np.float32) / 255
    out = bg * (1 - mask[..., None]) + warped.astype(np.float32) * mask[..., None]
    gx = np.linspace(r.uniform(.78, .95), r.uniform(.98, 1.05), W)[None, :, None]; gy = np.linspace(r.uniform(.9, 1.05), r.uniform(.8, 1.0), H)[:, None, None]
    out = np.clip(cv2.GaussianBlur(out * gx * gy, (3, 3), 0.8), 0, 255).astype(np.uint8)
    return out, Hm, (W, H)
import sys
for d in sorted(glob.glob(os.path.join(ROOT, (sys.argv[1] if len(sys.argv) > 1 else '') + '*_s*'))):
    t = json.load(open(os.path.join(d, 'truth.json'), encoding='utf-8')); seed = t['seed'] * 31 + len(t['id'])
    for kind, fn, ext, q in (('scan', scan, 'png', None), ('photo', photo, 'jpg', 88)):
        Hs, sizes = {}, {}
        for i in range(t['pages']):
            im = rd(os.path.join(d, f'clean_p{i + 1}.png')); h, w = im.shape[:2]
            o, M, (W2, H2) = fn(im, seed + i); wr(os.path.join(d, f'{kind}_p{i + 1}.{ext}'), o, q)
            Hs[i] = M; sizes[i] = ((w, h), (W2, H2))
        json.dump(apply_truth(t, Hs, sizes), open(os.path.join(d, f'truth_{kind}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('劣化版の作成完了')
