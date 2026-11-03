# サイトで使う文字だけを抜き出して軽い書体ファイルを作る（Noto・SIL OFL 1.1）。
# 書類の文字はこの書体に頼らず端末の書体で出る（全漢字を配ると重いため）。
import glob, os, sys, re
from fontTools import subset
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
chars = set()
for pat in ('*.html', 'js/app.js', 'js/categories.js', 'js/finish.js', 'js/pipeline.js'):
    for f in glob.glob(os.path.join(ROOT, pat)):
        s = open(f, encoding='utf-8').read()
        chars |= set(s)
chars |= set('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .,:;!?-+()[]/%＋−×')
chars |= set('一二三四五六七八九〇十甲乙丙丁第号証山田太郎東京都新宿区夢見丘丁目番商事株式会社')
print('文字数', len(chars))
FONTS = os.environ.get('FONT_DIR', os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft/Windows/Fonts'))
for src, out in (('NotoSerifJP-VF.ttf', 'serif.woff2'), ('NotoSansJP-VF.ttf', 'sans.woff2')):
    path = next((p for p in (os.path.join(FONTS, src), os.path.join('C:/Windows/Fonts', src)) if os.path.exists(p)), None)
    if not path: sys.exit('書体が見つかりません: ' + src)
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['palt', 'kern', 'liga', 'vert', 'vrt2']; opts.notdef_outline = True; opts.name_IDs = ['*']; opts.drop_tables += ['DSIG']
    font = subset.load_font(path, opts)
    s = subset.Subsetter(opts); s.populate(unicodes=[ord(c) for c in chars]); s.subset(font)
    os.makedirs(os.path.join(ROOT, 'fonts'), exist_ok=True)
    dst = os.path.join(ROOT, 'fonts', out); subset.save_font(font, dst, opts); print(out, os.path.getsize(dst) // 1024, 'KB')
