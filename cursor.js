// Page transitions: when a link goes to another page of the site, the violet and pink bands
// (main::before / main::after in style.css) wipe in to cover the content, then the next page loads
// and wipes open.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download') || a.hasAttribute('data-open-resume') || a.hasAttribute('data-open-poster')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
    if (url.pathname === location.pathname) return;
    e.preventDefault();
    root.classList.add('wipe-out');
    setTimeout(() => { location.href = url.href; }, 470);
  });
  addEventListener('pageshow', e => { if (e.persisted) root.classList.remove('wipe-out'); });
})();

// Themed custom cursor: a pink pixel dot, a violet square that trails behind and
// turns into a diamond over anything clickable, and a short trail of dithered pixels.
(() => {
  if (!matchMedia('(pointer: fine)').matches) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  root.classList.add('custom-cursor');

  const make = cls => { const d = document.createElement('div'); d.className = cls; d.setAttribute('aria-hidden', 'true'); document.body.appendChild(d); return d; };
  const dot = make('cursor-dot');
  const ring = make('cursor-ring');

  let x = -100, y = -100, rx = -100, ry = -100, lastX = 0, lastY = 0, seen = false;
  const COLORS = ['#ee8cff', '#8f5bff', '#2f8cff', '#bb00dd'];
  let pixels = 0;

  const spawn = (px, py) => {
    if (reduce || pixels > 36) return;
    const p = document.createElement('div');
    p.className = 'cursor-pixel';
    p.style.left = px + 'px';
    p.style.top = py + 'px';
    p.style.background = COLORS[(Math.random() * COLORS.length) | 0];
    p.style.setProperty('--dx', ((Math.random() - .5) * 26).toFixed(1) + 'px');
    p.style.setProperty('--dy', (8 + Math.random() * 18).toFixed(1) + 'px');
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
