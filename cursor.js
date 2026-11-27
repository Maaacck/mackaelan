// Cloud theme: a layer of wispy halftone clouds that loop across the sky behind the page, and
// page transitions made of long horizontal clouds. Arriving pages start covered by the clouds,
// which slide off to the right; leaving for another page of the site slides them back in from the left.
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layer = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.setAttribute('aria-hidden', 'true'); d.innerHTML = html; document.body.appendChild(d); return d; };

  layer('sky-clouds',
    '<i class="c" style="width:900px;height:70px;top:10%;--dur:110s;--del:-44s;--bob:9s;--o:0.85"></i>' +
    '<i class="c soft" style="width:700px;height:90px;top:18%;--dur:150s;--del:-112.5s;--bob:11s"></i>' +
    '<i class="c" style="width:620px;height:50px;top:34%;--dur:125s;--del:-12.5s;--bob:8s;--o:0.7"></i>' +
    '<i class="c" style="width:1100px;height:90px;top:52%;--dur:140s;--del:-77s;--bob:12s;--o:0.8"></i>' +
    '<i class="c soft" style="width:900px;height:110px;top:60%;--dur:170s;--del:-34s;--bob:10s"></i>' +
    '<i class="c" style="width:560px;height:44px;top:44%;--dur:100s;--del:-90s;--bob:7s;--o:0.6"></i>' +
    '<i class="c" style="width:1000px;height:80px;top:72%;--dur:130s;--del:-39s;--bob:10s;--o:0.75"></i>');

  if (reduce) return;
  const delays = [.12, 0, .2, .06, .24, .1];
  const wipe = layer('cloud-wipe arrive', delays.map((d, i) => '<i class="band" style="top:' + (i * 18 - 6) + '%;--d:' + d + 's"></i>').join(''));
  root.classList.add('clouds-ready');

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download') || a.hasAttribute('data-open-resume') || a.hasAttribute('data-open-poster')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
    if (url.pathname === location.pathname) return;
    e.preventDefault();
    wipe.classList.remove('arrive');
    root.classList.add('wipe-out');
    setTimeout(() => { location.href = url.href; }, 760);
  });
  addEventListener('pageshow', e => { if (e.persisted) root.classList.remove('wipe-out'); });
})();

// Cloud cursor: a tiny white cloud, a halftone-dot ring that trails behind and puffs up
// over anything clickable, and a trail of small puffs that float upward and fade.
(() => {
  if (!matchMedia('(pointer: fine)').matches) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  root.classList.add('custom-cursor');

  const make = cls => { const d = document.createElement('div'); d.className = cls; d.setAttribute('aria-hidden', 'true'); document.body.appendChild(d); return d; };
  const dot = make('cursor-dot');
  const ring = make('cursor-ring');

  // Pop-ups (<dialog>) open in the browser's top layer, above everything else on the page. To keep the
  // cursor visible over them, the dot and ring are popovers too, and get re-raised above each pop-up as it opens.
  const raiseCursor = () => {
    if (!dot.showPopover) return;
    for (const el of [ring, dot]) { try { if (el.matches(':popover-open')) el.hidePopover(); el.showPopover(); } catch (err) {} }
  };
  if (dot.showPopover) { dot.popover = 'manual'; ring.popover = 'manual'; raiseCursor(); }
  new MutationObserver(ms => { if (ms.some(m => m.target.open)) raiseCursor(); })
    .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  // Embedded frames (like the resume PDF) draw their own cursor, so hide this one while over them.
  addEventListener('pointerover', e => { if (e.target.tagName === 'IFRAME') root.classList.remove('cursor-on'); }, { passive: true });
  addEventListener('pointermove', e => { if (seen && (!e.pointerType || e.pointerType === 'mouse')) root.classList.add('cursor-on'); }, { passive: true });

  let x = -100, y = -100, rx = -100, ry = -100, lastX = 0, lastY = 0, seen = false;
  const COLORS = ['#f6f4ff', '#ffffff', '#cfc8ff', '#9a8cff'];
  let pixels = 0;

  const spawn = (px, py) => {
    if (reduce || pixels > 36) return;
    const p = document.createElement('div');
    p.className = 'cursor-pixel';
    p.style.left = px + 'px';
    p.style.top = py + 'px';
    p.style.background = COLORS[(Math.random() * COLORS.length) | 0];
    p.style.setProperty('--dx', ((Math.random() - .5) * 26).toFixed(1) + 'px');
    p.style.setProperty('--dy', (-8 - Math.random() * 16).toFixed(1) + 'px');
    const sz = (3 + Math.random() * 5).toFixed(1) + 'px'; p.style.width = sz; p.style.height = sz;
    pixels++;
    p.addEventListener('animationend', () => { p.remove(); pixels--; });
    document.body.appendChild(p);
  };

  addEventListener('pointermove', e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    if (!seen) { rx = x; ry = y; seen = true; root.classList.add('cursor-on'); }
    dot.style.transform = `translate(${x}px, ${y}px)`;
    if (Math.hypot(x - lastX, y - lastY) > 14) { spawn(x, y); lastX = x; lastY = y; }
  }, { passive: true });

  const CLICKABLE = 'a, button, summary, [role="button"], .ig-post, label, input, select, textarea';
  addEventListener('pointerover', e => { ring.classList.toggle('hover', !!(e.target.closest && e.target.closest(CLICKABLE))); }, { passive: true });
  addEventListener('pointerdown', () => ring.classList.add('down'), { passive: true });
  addEventListener('pointerup', () => ring.classList.remove('down'), { passive: true });
  document.addEventListener('mouseleave', () => root.classList.remove('cursor-on'));
  document.addEventListener('mouseenter', () => { if (seen) root.classList.add('cursor-on'); });

  const tick = () => {
    rx += (x - rx) * (reduce ? 1 : 0.2);
    ry += (y - ry) * (reduce ? 1 : 0.2);
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();

// Box select: dragging on the page draws a rectangle and highlights only the words inside it
// (instead of the browser's usual line-by-line selection). Cmd/Ctrl+C copies the highlighted words.
(() => {
  if (!window.CSS || !CSS.highlights || !window.Highlight) return;
  const SKIP = 'a, button, input, textarea, select, summary, label, dialog, video, iframe, .ig-track, [contenteditable]';
  const root = document.documentElement;
  const hl = new Highlight(); CSS.highlights.set('box-select', hl);
  let words = [], picked = [], start = null, box = null, raf = 0, last = null;

  const collect = () => {
    words = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        const p = n.parentElement;
        if (!p || !n.data.trim() || p.closest('script, style, noscript, dialog, .cursor-dot, .cursor-ring')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    for (let n; (n = walk.nextNode());) {
      for (const m of n.data.matchAll(/\S+/g)) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const b = r.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        words.push({ r, x1: b.left + scrollX, y1: b.top + scrollY, x2: b.right + scrollX, y2: b.bottom + scrollY });
      }
    }
  };

  const clear = () => { hl.clear(); picked = []; };

  const update = () => {
    raf = 0; if (!start || !last) return;
    const x = last.clientX + scrollX, y = last.clientY + scrollY;
    const L = Math.min(start.x, x), T = Math.min(start.y, y), R = Math.max(start.x, x), B = Math.max(start.y, y);
    Object.assign(box.style, { left: L + 'px', top: T + 'px', width: R - L + 'px', height: B - T + 'px' });
    hl.clear(); picked = [];
    for (const w of words) if (w.x2 > L && w.x1 < R && w.y2 > T && w.y1 < B) { hl.add(w.r); picked.push(w); }
  };

  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.detail > 1) return;
    if (e.target.closest && e.target.closest(SKIP)) { if (!e.target.closest('dialog')) clear(); return; }
    e.preventDefault();
    getSelection().removeAllRanges(); clear();
    start = { x: e.clientX + scrollX, y: e.clientY + scrollY, cx: e.clientX, cy: e.clientY, live: false };
  });

  addEventListener('pointermove', e => {
    if (!start) return;
    if (!start.live) {
      if (Math.hypot(e.clientX - start.cx, e.clientY - start.cy) < 4) return;
      start.live = true; collect(); root.classList.add('box-selecting');
      box = document.createElement('div'); box.className = 'select-box'; box.setAttribute('aria-hidden', 'true'); document.body.appendChild(box);
    }
    last = e; if (!raf) raf = requestAnimationFrame(update);
  });

  addEventListener('scroll', () => { if (start && start.live && last && !raf) raf = requestAnimationFrame(update); }, { passive: true });

  const end = () => {
    if (!start) return;
    start = null; last = null; root.classList.remove('box-selecting');
    if (box) { box.remove(); box = null; }
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
  addEventListener('keydown', e => { if (e.key === 'Escape') clear(); });

  document.addEventListener('copy', e => {
    if (!picked.length || (getSelection().toString())) return;
    let out = '', prev = null;
    for (const w of picked) {
      if (prev) out += (w.y1 >= prev.y2 - 2 || w.x1 < prev.x1) ? '\n' : ' ';
      out += w.r.toString(); prev = w;
    }
    e.clipboardData.setData('text/plain', out); e.preventDefault();
  });
})();
