# samples.mjs の出力を、提出書類らしい形（スキャン・スマホ撮影・PDF化）に仕上げて サンプル書類/ に置く。すべて架空。
import cv2, numpy as np, json, os, sys, random, shutil, struct
HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, '..', 'samples_raw'); OUT = os.path.join(HERE, '..', '..', 'サンプル書類')
def rd(p): return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
def enc(im, ext, q=None):
    ok, b = cv2.imencode(ext, im, [cv2.IMWRITE_JPEG_QUALITY, q] if q else []); return b.tobytes()
def scan(im, seed, color=False, angle=1.2):
    r = random.Random(seed); np.random.seed(seed); h, w = im.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), r.uniform(-angle, angle), 1.0); M[:, 2] += (r.uniform(-9, 9), r.uniform(-9, 9))
    o = cv2.warpAffine(im, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=(250, 250, 250)); o = cv2.GaussianBlur(o, (3, 3), 0.6)
    if not color: o = cv2.cvtColor(cv2.cvtColor(o, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
    o = np.clip(o.astype(np.float32) * 0.95 + 8 + np.random.normal(0, 4, o.shape if color else o.shape[:2] + (1,)), 0, 255).astype(np.uint8)
    for _ in range(35):
        cv2.circle(o, (r.randrange(w), r.randrange(h)), r.choice([1, 1, 2]), (r.randrange(60, 170),) * 3, -1)
    # 左端のとじ跡の影
    o[:, :18] = (o[:, :18] * np.linspace(.8, 1, 18)[None, :, None]).astype(np.uint8)
    return o
def desk(W, H, seed):
    # 木の机：横長の木目
    np.random.seed(seed); base = np.full((H, W, 3), (70, 104, 146), np.float32)
    n = cv2.resize(np.random.normal(0, 26, (H // 3 + 1, 18, 1)).astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
    return np.clip(base + n[..., None] if n.ndim == 2 else base + n, 0, 255)
def photo(im, seed, strength=1.0):
    r = random.Random(seed); h, w = im.shape[:2]; W, H = int(w * 1.24), int(h * 1.2)
    ox, oy = (W - w) / 2, (H - h) / 2; j = lambda s: r.uniform(-s, s) * strength
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([[ox + j(80), oy + j(60)], [ox + w + j(80), oy + j(60)], [ox + w + j(45), oy + h + j(50)], [ox + j(45), oy + h + j(50)]])
    Hm = cv2.getPerspectiveTransform(src, dst)
    bg = desk(W, H, seed); wp = cv2.warpPerspective(im, Hm, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0))
    m = cv2.warpPerspective(np.full((h, w), 255, np.uint8), Hm, (W, H)).astype(np.float32) / 255
    out = bg * (1 - m[..., None]) + wp.astype(np.float32) * m[..., None]
    gx = np.linspace(r.uniform(.8, .92), r.uniform(.98, 1.04), W)[None, :, None]; gy = np.linspace(r.uniform(.94, 1.04), r.uniform(.84, .98), H)[:, None, None]
    out = np.clip(cv2.GaussianBlur(out * gx * gy, (3, 3), 0.7), 0, 255).astype(np.uint8)
    return cv2.resize(out, (int(W * .9), int(H * .9)), interpolation=cv2.INTER_AREA)
def image_pdf(images):
    objs = {1: b'<</Type/Catalog/Pages 2 0 R>>'}; kids = []; n = 3
    for im in images:
        h, w = im.shape[:2]; jpg = enc(im, '.jpg', 84); pw, ph = 595.28, 595.28 * h / w
        c = f'q {pw:.2f} 0 0 {ph:.2f} 0 0 cm /I Do Q'.encode()
        objs[n] = f'<</Type/Page/Parent 2 0 R/MediaBox[0 0 {pw:.2f} {ph:.2f}]/Resources<</XObject<</I {n + 2} 0 R>>>>/Contents {n + 1} 0 R>>'.encode()
        objs[n + 1] = b'<</Length %d>>stream\n' % len(c) + c + b'\nendstream'
        objs[n + 2] = f'<</Type/XObject/Subtype/Image/Width {w}/Height {h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length {len(jpg)}>>stream\n'.encode() + jpg + b'\nendstream'
        kids.append(n); n += 3
    objs[2] = f'<</Type/Pages/Count {len(kids)}/Kids[{" ".join(f"{k} 0 R" for k in kids)}]>>'.encode()
    out = b'%PDF-1.5\n'; off = {}
    for i in sorted(objs): off[i] = len(out); out += b'%d 0 obj\n' % i + objs[i] + b'\nendobj\n'
    x = len(out); out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1)
    for i in sorted(objs): out += b'%010d 00000 n \n' % off[i]
    return out + b'trailer\n<</Size %d/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, x)
def pages(i): return [rd(os.path.join(RAW, i, f'p{n + 1}.png')) for n in range(json.load(open(os.path.join(RAW, i, 'truth.json'), encoding='utf-8'))['pages'])]
def write(name, data):
    with open(os.path.join(OUT, name), 'wb') as f: f.write(data)
    print(name, len(data) // 1024, 'KB')
if os.path.isdir(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)
write('甲第1号証_住民票の写し（スキャン）.pdf', image_pdf([scan(pages('a01_juminhyo')[0], 101)]))
shutil.copy(os.path.join(RAW, 'a02_kyuyo', 'digital.pdf'), os.path.join(OUT, '甲第2号証_給与明細（文字データ入り）.pdf')); print('甲第2号証 PDF')
write('甲第3号証_源泉徴収票（スキャン）.jpg', enc(scan(pages('a03_gensen')[0], 103), '.jpg', 86))
write('甲第4号証_預金通帳（スマホ撮影）.jpg', enc(photo(pages('a04_tsucho')[0], 104), '.jpg', 88))
write('甲第5号証_LINEトーク画面.png', enc(pages('a05_line')[0], '.png'))
write('甲第6号証_通知書（縦書き・スキャン）.pdf', image_pdf([scan(pages('a06_tsuchi')[0], 106)]))
shutil.copy(os.path.join(RAW, 'a07_chinjutsu', 'digital.pdf'), os.path.join(OUT, '甲第7号証_陳述書（文字データ入り）.pdf')); print('甲第7号証 PDF')
write('甲第8号証_診断書（カラースキャン）.pdf', image_pdf([scan(pages('a08_shindan')[0], 108, color=True)]))
write('甲第9号証_賃貸借契約書（スマホ撮影）.pdf', image_pdf([photo(p, 109 + i, 1.0) for i, p in enumerate(pages('a09_chintai'))]))
write('甲第10号証_身分証のコピー.png', enc(scan(pages('a10_id')[0], 110, color=True, angle=.6), '.png'))
write('参考_仮処分命令申立書（スマホ撮影）.pdf', image_pdf([photo(p, 111 + i, 1.1) for i, p in enumerate(pages('a11_moushitate'))]))
shutil.copy(os.path.join(RAW, 'a12_junbi', 'digital.pdf'), os.path.join(OUT, '複雑_原告第2準備書面（文字データ入り）.pdf')); print('準備書面 PDF')
write('複雑_遺産分割協議書と相続関係図（スキャン）.pdf', image_pdf([scan(p, 113 + i, color=True) for i, p in enumerate(pages('a13_isan'))]))
write('複雑_録音反訳とメール印刷（スマホ撮影）.pdf', image_pdf([photo(p, 115 + i, .9) for i, p in enumerate(pages('a14_hanyaku'))]))
