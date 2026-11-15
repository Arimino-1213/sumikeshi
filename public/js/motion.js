// 動きの部品（依存なし・外部の読み込みなし）。読み込むだけで、ページの data-rv と data-progress が動く。
// 「動きを減らす」設定の端末と、URL に ?motion=off を付けたときは何も動かさず、最初から全部見える。
//   data-rv        画面の下にある要素を、スクロールで近づいたときに出す（最初から画面に入っている要素は動かさない）
//   data-stagger   子要素を順番に data-rv 扱いにする（値＝間隔ms・既定70）
//   data-progress  ページの読み進み具合の線（空の要素に付ける）
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
if (/[?&]motion=off\b/.test(location.search)) root.classList.add('still');

export const motionOn = () => !reduce.matches && !root.classList.contains('still');

// 数を from から to へ数え上げる。動かさないときは、すぐ最後の数にする
export function countTo(node, to, from = 0, dur = 520) {
  cancelAnimationFrame(node._raf);
  if (!motionOn() || from === to) { node.textContent = String(to); return; }
  node.textContent = String(from);
  const t0 = performance.now();
  const step = (t) => {
    // rAF の時刻は呼んだ時刻より前のことがあるので、0 未満にしない（負の数が一瞬出ていた）
    const p = Math.min(1, Math.max(0, (t - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
    node.textContent = String(Math.round(from + (to - from) * e));
    if (p < 1) node._raf = requestAnimationFrame(step);
  };
  node._raf = requestAnimationFrame(step);
}

// 要素に一度だけ動きの class を付け、終わったら外す（作り直さない要素用）
export function replay(el, cls) {
  if (!motionOn() || !el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  el.addEventListener('animationend', function done(e) { if (e.target === el) { el.classList.remove(cls); el.removeEventListener('animationend', done); } });
}

function initReveal() {
  for (const p of document.querySelectorAll('[data-stagger]')) {
    const gap = parseFloat(p.dataset.stagger) || 70;
    [...p.children].forEach((c, i) => { if (!c.hasAttribute('data-rv')) c.setAttribute('data-rv', ''); c.dataset.rvDelay = String(i * gap); });
  }
  const els = [...document.querySelectorAll('[data-rv]')];
  if (!els.length || !motionOn() || !('IntersectionObserver' in window)) return;
  // 最初から画面にある要素は隠さない（読み込みの途中で一瞬消えるのを避ける）
  const below = els.filter((el) => el.getBoundingClientRect().top > innerHeight * 0.96);
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const el = en.target; io.unobserve(el);
      el.style.setProperty('--rv-delay', `${el.dataset.rvDelay || 0}ms`);
      el.classList.add('in');
    }
  }, { rootMargin: '0px 0px -6% 0px' });
  for (const el of below) { el.classList.add('rv'); io.observe(el); }
}

function initProgress() {
  const bar = document.querySelector('[data-progress]');
  if (!bar) return;
  if (!motionOn()) { bar.hidden = true; return; }
  let tick = false;
  const draw = () => {
    tick = false;
    const max = Math.max(1, root.scrollHeight - innerHeight);
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, scrollY / max)).toFixed(4)})`;
  };
  const ask = () => { if (!tick) { tick = true; requestAnimationFrame(draw); } };
  addEventListener('scroll', ask, { passive: true }); addEventListener('resize', ask); draw();
}

const start = () => { initReveal(); initProgress(); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
