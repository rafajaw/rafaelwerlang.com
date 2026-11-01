// rafaelwerlang.com — texto que se monta, marquee, palavras que acendem ao rolar, cursor, cortina entre páginas. Sem dependências.
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ── quebra texto em letras (mantém os <span class="line"> do HTML) ──
  function split(el) {
    if (el.dataset.split) return; el.dataset.split = '1';
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.trim());
    let d = 0;
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          for (const ch of part) {
            const c = document.createElement('span'); c.className = 'c';
            const i = document.createElement('span'); i.textContent = ch; i.style.setProperty('--d', d); d += 28;
            c.append(i); w.append(c);
          }
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk(el);
  }
  // letras que "rolam" no hover
  function roll(el) {
    if (el.dataset.rolled) return; el.dataset.rolled = '1';
    const txt = el.textContent; el.setAttribute('aria-label', txt); el.textContent = '';
    [...txt].forEach((ch, k) => { const s = document.createElement('span'); s.className = 'r'; s.textContent = ch; s.dataset.c = ch; s.style.setProperty('--d', k); s.setAttribute('aria-hidden', 'true'); el.append(s); });
    // cada letra mede a largura da versão itálica e a caixa acompanha durante a rolagem (sem letras grudadas)
    const on = () => fitRoll(el, true), off = () => fitRoll(el, false);
    el.addEventListener('mouseenter', on); el.addEventListener('focus', on);
    el.addEventListener('mouseleave', off); el.addEventListener('blur', off);
    measureRoll(el);
  }
  function measureRoll(el) {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-family:var(--serif);font-style:italic;font-weight:400;letter-spacing:0';
    el.append(probe);
    el.querySelectorAll('.r').forEach(r => {
      r.style.width = '';
      r.dataset.up = r.getBoundingClientRect().width;
      probe.textContent = r.dataset.c;
      r.dataset.it = probe.getBoundingClientRect().width;
      r.style.width = r.dataset.up + 'px';
    });
    probe.remove();
    if (el.matches(':hover, :focus')) fitRoll(el, true);
  }
  function fitRoll(el, rolled) {
    el.querySelectorAll('.r').forEach(r => { if (r.dataset.up) r.style.width = (rolled ? r.dataset.it : r.dataset.up) + 'px'; });
  }
  const remeasure = () => document.querySelectorAll('.roll[data-rolled]').forEach(measureRoll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(remeasure, 150); });
  // palavras da declaração acendem conforme a rolagem
  function words(el) {
    if (el.dataset.words) return; el.dataset.words = '1';
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="wd" aria-hidden="true">${w}</span>`).join(' ');
  }

  let io;
  function prepare() {
    io && io.disconnect();
    document.querySelectorAll('#app .split').forEach(split);
    document.querySelectorAll('.roll').forEach(roll);
    document.querySelectorAll('#app .words').forEach(words);
    const els = document.querySelectorAll('#app .split, #app .prose > *, #app .toc, #app .post-desc, #app .tags, #app .hero-foot, #app .row');
    if (reduced || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
                                  { rootMargin: '0px 0px -6% 0px', threshold: 0.02 });
    els.forEach(e => io.observe(e));
  }

  // ── marquee: corre sempre, acelera com a velocidade da rolagem ──
  let mq = null, mx = 0, lastY = scrollY, vel = 0;
  function setupMarquee() {
    const t = document.querySelector('#app .track');
    if (!t) { mq = null; return; }
    if (!t.dataset.dup) { t.dataset.dup = '1'; t.innerHTML += t.innerHTML; }
    mq = t; mx = 0;
  }

  // ── laço: marquee, parallax do nome, palavras, cursor ──
  const cur = document.querySelector('.cursor');
  let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
  function frame() {
    const y = scrollY; vel += ((y - lastY) - vel) * 0.1; lastY = y;
    if (!reduced) {
      if (mq) {
        mx -= 0.6 + Math.min(14, Math.abs(vel) * 0.35);
        const half = mq.scrollWidth / 2; if (-mx >= half) mx += half;
        mq.style.transform = `translate3d(${mx}px,0,0)`;
      }
      const mega = document.querySelector('#app .hero .mega');
      if (mega && y < innerHeight * 1.2) { mega.style.transform = `translate3d(0, ${y * 0.22}px, 0)`; mega.style.opacity = String(Math.max(0, 1 - y / (innerHeight * 0.9))); }
      if (fine && cur) { cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2; cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`; }
    }
    const st = document.querySelector('#app .words');
    if (st) {
      const r = st.getBoundingClientRect(), p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
      const ws = st.querySelectorAll('.wd'), n = Math.round(p * ws.length);
      ws.forEach((w, k) => w.classList.toggle('on', reduced || k < n));
    }
    requestAnimationFrame(frame);
  }
  if (fine && cur) {
    addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; cur.classList.add('on'); }, { passive: true });
    document.addEventListener('pointerleave', () => cur.classList.remove('on'));
    document.addEventListener('pointerover', e => cur.classList.toggle('big', !!e.target.closest('a, button')));
  }

  // ── relógio de Pescara no rodapé ──
  const clock = document.querySelector('.clock');
  const tick = () => { if (clock) clock.textContent = 'Pescara ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }); };
  tick(); setInterval(tick, 30000);

  // ── navegação interna sem recarregar, com cortina ──
  const cache = new Map();
  const internal = a => a && a.origin === location.origin && !a.hasAttribute('download') && a.target !== '_blank'
    && !/\.(xml|pdf|png|jpe?g|svg|zip)$/i.test(a.pathname) && a.pathname !== location.pathname;
  const get = url => { if (!cache.has(url)) cache.set(url, fetch(url).then(r => { if (!r.ok) throw r.status; return r.text(); })); return cache.get(url); };
  const curtain = document.querySelector('.curtain');
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function markNav() {
    document.querySelectorAll('.nav a').forEach(a => {
      const on = a.origin === location.origin && (a.pathname === location.pathname || (a.pathname === '/' && location.pathname.startsWith('/posts/')));
      on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
    });
  }
  let busy = false;
  async function go(url, push) {
    if (busy) return; busy = true;
    const from = location.href;
    const page = get(url).catch(() => null);
    if (!reduced) { curtain.classList.remove('leave'); void curtain.offsetWidth; curtain.classList.add('cover'); await wait(620); }
    const text = await page;
    const doc = text && new DOMParser().parseFromString(text, 'text/html');
    const next = doc && doc.querySelector('#app');
    if (!next) { location.href = url; return; }
    document.querySelector('#app').replaceWith(next);
    document.title = doc.title;
    document.body.dataset.kind = doc.body.dataset.kind || '';
    ['description', 'og:title', 'og:description', 'og:url', 'og:type'].forEach(k => {
      const sel = k.startsWith('og:') ? `meta[property="${k}"]` : `meta[name="${k}"]`;
      const a = document.querySelector(sel), b = doc.querySelector(sel); if (a && b) a.setAttribute('content', b.getAttribute('content'));
    });
    const can = document.querySelector('link[rel=canonical]'), can2 = doc.querySelector('link[rel=canonical]'); if (can && can2) can.href = can2.href;
    if (push) history.pushState({}, '', url);
    const h = new URL(url, location.href).hash;
    if (h && document.querySelector(h)) document.querySelector(h).scrollIntoView(); else scrollTo(0, 0);
    prepare(); setupMarquee(); markNav();
    if (window.goatcounter && goatcounter.count) goatcounter.count({ referrer: from });  // visita na navegação sem recarregar
    if (!reduced) { curtain.classList.remove('cover'); curtain.classList.add('leave'); await wait(720); curtain.classList.remove('leave'); }
    busy = false;
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!internal(a) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault(); go(a.href, true);
  });
  ['mouseover', 'touchstart'].forEach(ev => document.addEventListener(ev, e => {
    const a = e.target.closest && e.target.closest('a'); if (internal(a)) get(a.href).catch(() => cache.delete(a.href));
  }, { passive: true }));
  addEventListener('popstate', () => go(location.href, false));

  prepare(); setupMarquee(); markNav(); requestAnimationFrame(frame);
})();
