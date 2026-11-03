# Indra OCR（Python・ネイティブ）で、PP-OCR と同じ書類・同じ物差しを測る
import json, os, time, unicodedata, re
from collections import Counter
import indra_ocr
ROOT = os.path.join('tests', 'docs')
def norm(s):
    s = re.sub(r'\s', '', unicodedata.normalize('NFKC', s)); return re.sub('[ー－―‐−–—]', '-', s)
if __name__ == '__main__':
    conv = indra_ocr.load(threads=4); out = []
    for m in json.load(open(os.path.join(ROOT, 'manifest.json'), encoding='utf-8')):
        if m['set'] != 'dev': continue
        for v in ['clean', 'scan', 'photo']:
            t = json.load(open(os.path.join(ROOT, m['id'], 'truth.json' if v == 'clean' else f'truth_{v}.json'), encoding='utf-8'))
            p = os.path.join(ROOT, m['id'], f"{v}_p1.{'jpg' if v == 'photo' else 'png'}")
            t0 = time.time(); pages = list(conv.convert(p)); sec = time.time() - t0
            got = norm(''.join(l.text for pg in pages for l in pg[-1].lines))
            tb, gb = Counter(norm(t['pageText'][0])), Counter(got); hit = sum(min(n, gb[c]) for c, n in tb.items()); tot = sum(tb.values())
            ents = [e for e in t['entities'] if e['type'] != 'seal']; eh = sum(1 for e in ents if norm(e['text']) in got)
            out.append(dict(id=m['id'], kind=m['kind'], v=v, recall=hit / tot, eh=eh, en=len(ents), sec=sec))
            print('indra', m['id'], v, f'{hit / tot:.3f}', f'{eh}/{len(ents)}', f'{sec:.1f}秒', flush=True)
    json.dump(out, open('tests/out/compare_indra.json', 'w'))
