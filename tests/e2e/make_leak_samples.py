# 漏えい試験用の「わざと危ない」ファイルを作る。隠し文字・作者情報・注釈・EXIF を仕込む（すべて架空の文字列）。
import os, zlib, json, struct, cv2, numpy as np
OUT = os.path.join('tests', 'docs', '_leak'); os.makedirs(OUT, exist_ok=True)
ROOT = os.path.join('tests', 'docs')
def rd(p): return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
src = os.path.join(ROOT, 'd1_chinjutsu_s11', 'scan_p1.png')
im = rd(src); h, w = im.shape[:2]
ok, jpg = cv2.imencode('.jpg', im, [cv2.IMWRITE_JPEG_QUALITY, 85]); jpg = jpg.tobytes()

# ① JPEG に撮影情報（EXIF と見立てた APP1）を仕込む
marker = b'Exif\x00\x00' + b'SECRET-EXIF-GPS-35.6895,139.6917 SECRET-EXIF-OWNER-YAMADA'
app1 = b'\xff\xe1' + struct.pack('>H', len(marker) + 2) + marker
open(os.path.join(OUT, 'with_exif.jpg'), 'wb').write(jpg[:2] + app1 + jpg[2:])

# ② PNG に文字情報を仕込む
ok, png = cv2.imencode('.png', im); png = png.tobytes()
def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
open(os.path.join(OUT, 'with_text.png'), 'wb').write(png[:33] + chunk(b'tEXt', b'Author\x00SECRET-PNG-AUTHOR-YAMADA') + png[33:])

# ③ PDF：スキャン画像＋透明の文字層＋作者情報＋XMP＋注釈＋添付ファイル
W, H = 595.28, 841.89
hidden = 'BT /F1 12 Tf 3 Tr 72 700 Td (SECRET-HIDDEN-TEXT-LAYER 090-0999-8888) Tj ET'
content = f'q {W} 0 0 {H} 0 0 cm /Im Do Q {hidden}'.encode()
xmp = b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><dc:creator>SECRET-XMP-CREATOR</dc:creator></x:xmpmeta>'
attach = b'SECRET-ATTACHMENT-CONTENT'
objs = {
 1: b'<</Type/Catalog/Pages 2 0 R/Metadata 8 0 R/Names<</EmbeddedFiles<</Names[(a.txt) 9 0 R]>>>>>>',
 2: b'<</Type/Pages/Count 1/Kids[3 0 R]>>',
 3: f'<</Type/Page/Parent 2 0 R/MediaBox[0 0 {W} {H}]/Resources<</XObject<</Im 5 0 R>>/Font<</F1 6 0 R>>>>/Contents 4 0 R/Annots[7 0 R]>>'.encode(),
 4: b'<</Length %d>>stream\n' % len(content) + content + b'\nendstream',
 5: f'<</Type/XObject/Subtype/Image/Width {w}/Height {h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length {len(jpg)}>>stream\n'.encode() + jpg + b'\nendstream',
 6: b'<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
 7: b'<</Type/Annot/Subtype/Text/Rect[10 10 30 30]/Contents(SECRET-ANNOTATION-COMMENT)/T(SECRET-ANNOT-AUTHOR)>>',
 8: b'<</Type/Metadata/Subtype/XML/Length %d>>stream\n' % len(xmp) + xmp + b'\nendstream',
 9: b'<</Type/Filespec/F(a.txt)/EF<</F 10 0 R>>>>',
 10: b'<</Type/EmbeddedFile/Length %d>>stream\n' % len(attach) + attach + b'\nendstream',
 11: b'<</Title(SECRET-INFO-TITLE)/Author(SECRET-INFO-AUTHOR)/Creator(SECRET-INFO-CREATOR)/Producer(SECRET-INFO-PRODUCER)>>',
}
out = b'%PDF-1.7\n'; off = {}
for i in sorted(objs): off[i] = len(out); out += b'%d 0 obj\n' % i + objs[i] + b'\nendobj\n'
xr = len(out); out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1)
for i in sorted(objs): out += b'%010d 00000 n \n' % off[i]
out += b'trailer\n<</Size %d/Root 1 0 R/Info 11 0 R>>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, xr)
open(os.path.join(OUT, 'with_hidden.pdf'), 'wb').write(out)
# 正解（元の書類の個人情報）。出力に残っていないことを別の道具で確かめる
t = json.load(open(os.path.join(ROOT, 'd1_chinjutsu_s11', 'truth.json'), encoding='utf-8'))
json.dump({'markers': ['SECRET-'], 'entities': [e['text'] for e in t['entities'] if e['type'] != 'seal']}, open(os.path.join(OUT, 'expect.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('作成', os.listdir(OUT))
