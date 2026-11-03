# 墨消し（証拠書面の黒塗り）

PDF・画像の個人情報をブラウザの中だけで検出し、黒塗りして、文字データのない画像PDFで保存するアプリ。
サーバーを持たず、Cloudflare Pages の無料枠で静的に配信する。

**サイト：https://sumikeshi-jp.pages.dev**　試すときは `サンプル書類/`（すべて架空）を使えます。

## フォルダ

| 場所 | 中身 |
|---|---|
| `public/` | 公開するファイル一式（これだけを配信する） |
| `public/js/detect.js` | 個人情報の検出ルール。DOM を使わないので Node でも試せる |
| `public/js/ocr-engine.js` | PP-OCRv5 をブラウザで動かす部分 |
| `public/js/pipeline.js` | PDF・画像の読み込み、補正、OCR の流れ |
| `public/js/rectify.js` | 写真の紙の補正・傾き補正・印影の検出 |
| `public/js/export.js` / `finish.js` | 焼き込み・PDF作成・一覧・漏えい検査 |
| `public/js/categories.js` | 検出項目・場面・根拠の一覧 |
| `public/_headers` | 安全設定（外への通信を禁止する CSP など） |
| `tests/gen/` | 架空書類の生成器（実在の個人情報は使わない） |
| `tests/e2e/` | 本物のブラウザでの通し評価・画面操作・漏えい検査 |
| `docs/` | 測定結果と判断の記録 |

## できること

- PDF・JPEG・PNG・WebP を入れると、文字と位置を読み取り、個人情報の候補を出す（縦書き・漢数字・スマホ写真も対象）
- 候補を1件ずつ確認し、解除や手での追加ができる
- 文字データのない画像だけの PDF（A4）と PNG で保存する。保存の前に漏えいを自動で検査する
- 何を・どのページの・どこを・なぜ隠したかの一覧を出す（提出用は原文なし）

**これは候補を出す道具で、法律上の助言ではない。** 未知の書類で自動で隠せた割合は 86.6%（`docs/測定結果.md`）なので、人の確認が必須。

## 使い方（手元）

```bash
npm install
node tests/serve.mjs 8795
```

http://127.0.0.1:8795/ を開く。`_headers` の安全設定も本番と同じように付く。

## 公開（Cloudflare Pages）

ファイルを変えたら、公開の前に必ず `sw.js` を作り直す（変更を端末へ届けるため）。

```bash
node tools/build_sw.mjs
```

```bash
wrangler pages project create sumikeshi-jp --production-branch main
```

```bash
wrangler pages deploy public --project-name sumikeshi-jp --branch main
```

無料枠の範囲：静的ファイルの配信は回数の上限なし。1ファイル 25MiB まで（最大は OCR モデル 16MB）、ファイル数 2 万まで。Workers は使わない（無料枠は CPU 10ms で OCR は動かせない）。

## 試験

試験には Google Chrome と、Python（OpenCV・NumPy・pypdfium2・indra-ocr）が要る。Chrome の場所は `tests/` の各スクリプトの先頭で指定している。

```bash
node tests/gen/render.mjs 11,29
```

```bash
python tests/gen/degrade.py
```

```bash
node tests/eval_text.mjs dev v
```

```bash
node tests/e2e/run_eval.mjs dev digital,clean,scan,photo
```

```bash
node tests/e2e/ui_flow.mjs
```

```bash
python tests/e2e/verify_output.py
```

`held` の書類（`tests/gen/templates.mjs` の h で始まる型）は検出の調整に使わない。実力を測るときだけ使う。

## 同梱している部品とライセンス

| 部品 | ライセンス | 条件 |
|---|---|---|
| PP-OCRv5 mobile（PaddlePaddle、ONNX 変換 Satoru Nakamura） | Apache-2.0 | 表記の保持のみ |
| ONNX Runtime Web | MIT | 表記の保持のみ |
| PDF.js | Apache-2.0 | 表記の保持のみ |
| kuromoji.js ＋ mecab-ipadic | Apache-2.0 ＋ IPADIC 許諾 | 著作権表示の同梱（`public/licenses/`） |
| Noto Serif JP / Noto Sans JP（必要な文字だけ抜粋） | SIL OFL 1.1 | 名前の扱い・ライセンスの同梱 |

`public/vendor/kuromoji/kuromoji.js` は1か所だけ手を加えている（配信側が gzip を解いて渡した場合に壊れないよう、先頭2バイトを見てから解凍する）。

## ライセンス

自作のコードは [PolyForm Shield License 1.0.0](https://polyformproject.org/licenses/shield/1.0.0)（`LICENSE`）。

- 法律事務所や企業の業務を含め、無料で使える。改変もできる
- このソフトや作者の製品と競合する製品を提供するために使うことはできない
- 無保証で、利用の結果について作者は責任を負わない
- オープンソースのライセンスではなく、ソースコードを公開しているもの

同梱の部品はそれぞれのライセンスに従う（`public/licenses/`）。
