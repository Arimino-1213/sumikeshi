# 書き出されたファイルを、アプリとは別の道具（PDFium・バイト走査・Indra OCR）で調べる。
import os, re, json, zipfile, io, sys, unicodedata, tempfile
import numpy as np, cv2, pypdfium2 as pdfium
DL = os.path.join('tests', 'out', 'dl')
expect = json.load(open(os.path.join('tests', 'docs', '_leak', 'expect.json'), encoding='utf-8'))
def norm(s): return re.sub(r'\s', '', unicodedata.normalize('NFKC', s))
def b_has(data, s):
    return s.encode('utf-8') in data or s.encode('utf-16-be') in data or s.encode('utf-16-le') in data
report = {}
if __name__ == '__main__':
    files = os.listdir(DL); print('ファイル', files)
    bundle = next(f for f in files if f.startswith('提出用'))
    pngz = next(f for f in files if f.startswith('画像'))
    z = zipfile.ZipFile(os.path.join(DL, bundle)); names = z.namelist(); print('まとめZIP', names)
    pdfs = {n: z.read(n) for n in names if n.endswith('.pdf')}
    # 1. PDF の中身
    total_text = 0; bad = []
    for n, data in pdfs.items():
        d = pdfium.PdfDocument(data)
        size = [d[i].get_size() for i in range(len(d))]
        for i in range(len(d)):
            total_text += len(d[i].get_textpage().get_text_bounded().strip())
            for ob in d[i].get_objects():
                if ob.type != 3: bad.append((n, i, 'オブジェクト種別', ob.type))  # 3 = 画像
        meta = {k: v for k, v in d.get_metadata_dict().items() if v}
        if meta: bad.append((n, 'メタ情報', meta))
        if d.count_attachments() if hasattr(d, 'count_attachments') else 0: bad.append((n, '添付'))
        for tok in [b'/Font', b'/Info', b'/Metadata', b'/Annots', b'/JavaScript', b'/EmbeddedFile', b'/Author', b'/Producer', b'/XML']:
            if tok in re.sub(rb'stream\r?\n.*?endstream', b'', data, flags=re.S): bad.append((n, '構造に', tok))
        a4 = all(abs(min(s) - 595.28) < 1 and abs(max(s) - 841.89) < 1 for s in size)
        print(n, 'ページ', len(d), 'A4', a4, '文字', total_text)
        report[n] = dict(pages=len(d), a4=a4)
    print('PDFium で取り出せた文字数', total_text, '／問題', bad)
    report['pdf_text'] = total_text; report['pdf_problems'] = [str(b) for b in bad]
    # 2. 仕込んだ印と個人情報がバイト列に残っていないか
    leak = []
    allfiles = {n: z.read(n) for n in names}
    pz = zipfile.ZipFile(os.path.join(DL, pngz))
    for n in pz.namelist(): allfiles['png/' + n] = pz.read(n)
    list_csv = next((n for n in names if n.endswith('.csv')), None)
    for n, data in allfiles.items():
        if b'SECRET-' in data: leak.append((n, 'SECRET-'))
        for e in expect['entities']:
            if len(e) >= 2 and b_has(data, e): leak.append((n, e))
    print('仕込んだ秘密・個人情報のバイト検索', len(allfiles), 'ファイル → 残り', leak)
    report['byte_leaks'] = [str(x) for x in leak]
    # 3. ファイル名
    report['names'] = names
    # 4. PNG の付帯情報
    badpng = []
    for n in pz.namelist():
        data = pz.read(n); p = 8
        while p + 8 <= len(data):
            ln = int.from_bytes(data[p:p + 4], 'big'); t = data[p + 4:p + 8].decode('latin1'); p += 12 + ln
            if t in ('tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME'): badpng.append((n, t))
    print('PNG 付帯情報', badpng); report['png_chunks'] = [str(x) for x in badpng]
    # 5. JPEG の付帯情報（PDF の中）
    badjpg = []
    for n, data in pdfs.items():
        for m in re.finditer(b'\xff\xd8\xff', data):
            p = m.start() + 2
            while data[p] == 0xff and 0xe0 <= data[p + 1] <= 0xef:
                if data[p + 1] in (0xe1, 0xed): badjpg.append((n, hex(data[p + 1])))
                p += 2 + int.from_bytes(data[p + 2:p + 4], 'big')
    print('JPEG 付帯情報', badjpg); report['jpeg_app'] = [str(x) for x in badjpg]
    # 6. 一覧
    txt = allfiles[list_csv].decode('utf-8-sig') if list_csv else ''
    lst = [e for e in expect['entities'] if len(e) >= 2 and norm(e) in norm(txt)]
    print('提出用一覧の行数', txt.count('\n'), '原文の混入', lst); report['list_leak'] = lst
    # 7. 別のOCR（Indra）で PNG を読み直す。d1 由来の3ファイルで、隠した語が読めないか
    import indra_ocr
    conv = indra_ocr.load(threads=4)
    png_names = sorted(pz.namelist()); left = {}
    tmp = tempfile.mkdtemp()
    for n in png_names:
        p = os.path.join(tmp, re.sub(r'[^A-Za-z0-9_.]', '_', n)); open(p, 'wb').write(pz.read(n))
        pages = list(conv.convert(p))
        text = norm(''.join(l.text for pg in pages for l in pg[-1].lines))
        hits = [e for e in expect['entities'] if len(e) >= 2 and norm(e) in text]
        left[n] = hits
        print('  Indra 読み直し', n, '文字数', len(text), '読めた語', hits)
    report['indra_reread'] = left
    json.dump(report, open(os.path.join('tests', 'out', 'verify_output.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
