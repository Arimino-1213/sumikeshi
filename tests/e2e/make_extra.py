# 20ページの画像PDFと、向きを変えた画像を作る（中身はすべて架空の書類）
import os, glob, cv2, numpy as np
OUT = os.path.join('tests', 'docs', '_leak'); ROOT = os.path.join('tests', 'docs')
def rd(p): return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
def wr(p, im): ok, b = cv2.imencode(os.path.splitext(p)[1], im); b.tofile(p)
src = sorted(glob.glob(os.path.join(ROOT, 'd*_s*', 'scan_p1.png')))[:16] + sorted(glob.glob(os.path.join(ROOT, 'd*_s11', 'photo_p1.jpg')))[:4]
objs = {1: b'<</Type/Catalog/Pages 2 0 R>>'}; kids = []
n = 3
for f in src:
    im = rd(f); h, w = im.shape[:2]; ok, jpg = cv2.imencode('.jpg', im, [cv2.IMWRITE_JPEG_QUALITY, 82]); jpg = jpg.tobytes()
    c = b'q 595.28 0 0 841.89 0 0 cm /I Do Q'
    objs[n] = f'<</Type/Page/Parent 2 0 R/MediaBox[0 0 595.28 841.89]/Resources<</XObject<</I {n + 2} 0 R>>>>/Contents {n + 1} 0 R>>'.encode()
    objs[n + 1] = b'<</Length %d>>stream\n' % len(c) + c + b'\nendstream'
    objs[n + 2] = f'<</Type/XObject/Subtype/Image/Width {w}/Height {h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length {len(jpg)}>>stream\n'.encode() + jpg + b'\nendstream'
    kids.append(n); n += 3
objs[2] = f'<</Type/Pages/Count {len(kids)}/Kids[{" ".join(f"{k} 0 R" for k in kids)}]>>'.encode()
out = b'%PDF-1.5\n'; off = {}
for i in sorted(objs): off[i] = len(out); out += b'%d 0 obj\n' % i + objs[i] + b'\nendobj\n'
x = len(out); out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1)
for i in sorted(objs): out += b'%010d 00000 n \n' % off[i]
out += b'trailer\n<</Size %d/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, x)
open(os.path.join(OUT, 'long20.pdf'), 'wb').write(out); print('long20.pdf', len(kids), 'ページ', len(out) // 1048576, 'MB')
im = rd(os.path.join(ROOT, 'd3_kyuyo_s11', 'clean_p1.png'))
wr(os.path.join(OUT, 'rot90.png'), cv2.rotate(im, cv2.ROTATE_90_CLOCKWISE)); wr(os.path.join(OUT, 'rot180.png'), cv2.rotate(im, cv2.ROTATE_180)); wr(os.path.join(OUT, 'rot270.png'), cv2.rotate(im, cv2.ROTATE_90_COUNTERCLOCKWISE))
