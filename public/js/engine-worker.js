// 重い処理（OCR・検出）をまとめて動かすワーカー。外へは通信しない（CSP で禁止）。
import { OcrEngine } from './ocr-engine.js';
import { Detector } from './detect.js';
import { preparePage } from './prepare.js';

let ocr = null, detector = null, kuromojiBuilt = null;

async function loadTokenizer() {
  if (kuromojiBuilt) return kuromojiBuilt;
  kuromojiBuilt = (async () => {
    await import('../vendor/kuromoji/kuromoji.js');
    const km = self.kuromoji;
    const dicPath = new URL('../vendor/kuromoji/dict/', import.meta.url).pathname;
    return new Promise((ok, ng) => km.builder({ dicPath }).build((e, t) => (e ? ng(e) : ok(t))));
  })();
  return kuromojiBuilt;
}

self.onmessage = async (ev) => {
  const { id, cmd, payload } = ev.data;
  try {
    let result;
    if (cmd === 'init') {
      const hc = self.navigator.hardwareConcurrency || 4;
      ocr = new OcrEngine({ base: new URL('../', import.meta.url).href, threads: Math.max(1, Math.min(6, hc - 1)) });
      const info = await ocr.init();
      detector = new Detector({ tokenizer: await loadTokenizer() });
      result = info;
    } else if (cmd === 'ocr') {
      result = await ocr.recognize(payload);
    } else if (cmd === 'page') {
      result = await preparePage(ocr, payload);
    } else if (cmd === 'flip') {
      result = await ocr.flipScore(payload, payload.boxes);
    } else if (cmd === 'safeLabel') {
      result = detector.isSafeLabel(payload.label);
    } else if (cmd === 'detect') {
      result = detector.run(payload.docs, payload.options || {});
    } else throw new Error('不明な命令: ' + cmd);
    self.postMessage({ id, ok: true, result });
  } catch (e) {
    self.postMessage({ id, ok: false, error: String(e && e.message ? e.message : e) });
  }
};
