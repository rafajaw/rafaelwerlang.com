// Speed read (RSVP): words flash at a fixed focus point; one anchor letter per word stays in place.
// No dependencies. Opens from any [data-speed] button and reads the current post's .prose.
(() => {
  'use strict';
  const KEY = 'speed-wpm', MIN = 200, MAX = 900, STEP = 25;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let wpm = 350;
  try { const v = parseInt(localStorage.getItem(KEY), 10); if (v >= MIN && v <= MAX) wpm = v; } catch (e) {}

  let ov, els = {}, items = [], i = 0, playing = false, timer = 0, opener = null;

  // ---- text → items: {t:'w', w, end, sent, src} | {t:'card', kind, text, words, src}
  function build(prose, title) {
    const out = [];
    if (title) out.push({ t: 'card', kind: 'title', text: title, words: 3, src: null, sent: true });
    const blocks = prose.querySelectorAll(':scope > *');
    blocks.forEach(b => {
      const tag = b.tagName;
      if (/^H[1-6]$/.test(tag)) { out.push({ t: 'card', kind: 'h', text: b.textContent.trim(), words: 3, src: b, sent: true }); return; }
      if (tag === 'BLOCKQUOTE' || tag === 'PRE' || tag === 'TABLE' || b.classList.contains('code') || b.classList.contains('table')) {
        const text = b.textContent.replace(/\s+/g, ' ').trim();
        if (text) out.push({ t: 'card', kind: tag === 'BLOCKQUOTE' ? 'quote' : 'block', text, words: text.split(' ').length, src: b, sent: true });
        return;
      }
      const parts = tag === 'UL' || tag === 'OL' ? [...b.querySelectorAll('li')] : [b];
      parts.forEach(p => {
        const words = p.textContent.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
        words.forEach((w, k) => {
          const prev = out[out.length - 1];
          const sent = k === 0 || !prev || prev.t === 'card' || /[.!?]["'”’)]*$/.test(prev.w || '');
          out.push({ t: 'w', w, end: k === words.length - 1, sent, src: b });
        });
      });
    });
    return out;
  }

  // anchor letter: about a third into the word, ignoring leading punctuation
  function pivot(w) {
    const lead = (w.match(/^[^\p{L}\p{N}$€£]*/u) || [''])[0].length;
    const core = w.slice(lead).replace(/[^\p{L}\p{N}]+$/u, '');
    const n = core.length || 1;
    const p = n <= 1 ? 0 : n <= 5 ? 1 : n <= 9 ? 2 : n <= 13 ? 3 : 4;
    return Math.min(lead + p, w.length - 1);
  }

  function dur(it) {
    const base = 60000 / wpm;
    if (it.t === 'card') return it.kind === 'title' || it.kind === 'h' ? Math.max(900, base * 3) : Math.max(2200, it.words * base * 1.4);
    let m = 1;
    const w = it.w;
    if (/[.!?]["'”’)]*$/.test(w)) m = 2.3;
    else if (/[,;:—–]["'”’)]*$/.test(w)) m = 1.6;
    const len = w.replace(/[^\p{L}\p{N}]/gu, '').length;
    if (len > 12) m *= 1.6; else if (len > 8) m *= 1.3;
    if (it.end) m = Math.max(m, 2.4);
    return base * m;
  }

  // ---- UI
  function mount() {
    ov = document.createElement('div');
    ov.className = 'speed';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Speed read');
    ov.innerHTML = `
      <div class="speed-top mono"><span>Speed read</span><button type="button" class="speed-x" aria-label="Close speed read">Esc ✕</button></div>
      <div class="speed-stage" aria-live="off">
        <div class="speed-guide" aria-hidden="true"></div>
        <div class="speed-word"><span class="sw-l"></span><span class="sw-p"></span><span class="sw-r"></span></div>
        <div class="speed-card" hidden></div>
        <p class="speed-hint mono">Space or tap to start · ← → sentence · ↑ ↓ speed</p>
      </div>
      <div class="speed-bar" aria-hidden="true"><i></i></div>
      <div class="speed-ctl mono">
        <div class="speed-grp">
          <button type="button" data-a="prev" aria-label="Previous sentence">←</button>
          <button type="button" data-a="play" class="speed-play" aria-label="Play">Play</button>
          <button type="button" data-a="next" aria-label="Next sentence">→</button>
        </div>
        <div class="speed-grp">
          <button type="button" data-a="slow" aria-label="Slower">−</button>
          <label class="speed-wpm"><input id="speed-wpm" type="range" min="${MIN}" max="${MAX}" step="${STEP}" value="${wpm}" aria-label="Words per minute"><output>${wpm} wpm</output></label>
          <button type="button" data-a="fast" aria-label="Faster">+</button>
        </div>
        <span class="speed-left">—</span>
      </div>`;
    document.body.append(ov);
    els = {
      l: ov.querySelector('.sw-l'), p: ov.querySelector('.sw-p'), r: ov.querySelector('.sw-r'),
      word: ov.querySelector('.speed-word'), card: ov.querySelector('.speed-card'), hint: ov.querySelector('.speed-hint'),
      bar: ov.querySelector('.speed-bar i'), left: ov.querySelector('.speed-left'), play: ov.querySelector('.speed-play'),
      range: ov.querySelector('#speed-wpm'), out: ov.querySelector('output')
    };
    ov.querySelector('.speed-x').addEventListener('click', close);
    ov.querySelector('.speed-stage').addEventListener('click', toggle);
    ov.querySelector('.speed-ctl').addEventListener('click', e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      ({ play: toggle, prev: () => jump(-1), next: () => jump(1), slow: () => setWpm(wpm - STEP), fast: () => setWpm(wpm + STEP) })[a.dataset.a]();
    });
    els.range.addEventListener('input', () => setWpm(+els.range.value));
  }

  function show() {
    const it = items[i]; if (!it) return;
    if (it.t === 'card') {
      els.word.hidden = true; els.card.hidden = false;
      els.card.className = 'speed-card is-' + it.kind;
      els.card.textContent = it.text;
    } else {
      els.card.hidden = true; els.word.hidden = false;
      const k = pivot(it.w);
      els.l.textContent = it.w.slice(0, k); els.p.textContent = it.w[k]; els.r.textContent = it.w.slice(k + 1);
    }
    els.bar.style.transform = `scaleX(${items.length > 1 ? i / (items.length - 1) : 1})`;
    let ms = 0; for (let k = i; k < items.length; k++) ms += dur(items[k]);
    const s = Math.round(ms / 1000);
    els.left.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left`;
  }

  function tick() {
    show();
    if (!playing) return;
    timer = setTimeout(() => {
      if (i >= items.length - 1) { pause(); els.hint.textContent = 'Done · Esc to close · ← to go back'; els.hint.hidden = false; return; }
      i++; tick();
    }, dur(items[i]));
  }
  function play() {
    if (i >= items.length - 1) i = 0;
    playing = true; els.hint.hidden = true;
    els.play.textContent = 'Pause'; els.play.setAttribute('aria-label', 'Pause');
    clearTimeout(timer); tick();
  }
  function pause() {
    playing = false; clearTimeout(timer);
    els.play.textContent = 'Play'; els.play.setAttribute('aria-label', 'Play');
  }
  function toggle() { playing ? pause() : play(); }
  function jump(d) {
    const was = playing; pause();
    if (d < 0) { let k = i - 1; while (k > 0 && !items[k].sent) k--; if (k === i - 1 && k > 0) { k--; while (k > 0 && !items[k].sent) k--; } i = Math.max(0, k); }
    else { let k = i + 1; while (k < items.length - 1 && !items[k].sent) k++; i = Math.min(items.length - 1, k); }
    was ? play() : show();
  }
  function setWpm(v) {
    wpm = Math.max(MIN, Math.min(MAX, Math.round(v / STEP) * STEP));
    els.range.value = wpm; els.out.textContent = wpm + ' wpm';
    try { localStorage.setItem(KEY, wpm); } catch (e) {}
    if (playing) { clearTimeout(timer); tick(); } else show();
  }

  function key(e) {
    if (!ov || ov.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === ' ' || e.key === 'k') { if (e.target.tagName === 'BUTTON') return; e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); jump(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); jump(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setWpm(wpm + STEP); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setWpm(wpm - STEP); }
  }

  function open(btn) {
    const prose = document.querySelector('#app .prose') || document.querySelector('.prose');
    if (!prose) return;
    const title = (document.querySelector('#app .post-title') || {}).getAttribute ? document.querySelector('#app .post-title').getAttribute('aria-label') || document.querySelector('#app .post-title').textContent.trim() : '';
    items = build(prose, title); if (!items.length) return;
    if (!ov) mount();
    opener = btn; i = 0; pause();
    els.hint.textContent = 'Space or tap to start · ← → sentence · ↑ ↓ speed'; els.hint.hidden = false;
    ov.hidden = false; ov.classList.toggle('no-anim', reduced);
    requestAnimationFrame(() => ov.classList.add('on'));
    document.documentElement.classList.add('speed-open');
    show(); ov.querySelector('.speed-x').focus({ preventScroll: true });
    try { window.goatcounter && window.goatcounter.count && window.goatcounter.count({ path: 'speed-read' + location.pathname, title: 'Speed read', event: true }); } catch (e) {}
  }
  function close() {
    if (!ov || ov.hidden) return;
    pause();
    const src = items[i] && items[i].src;
    ov.classList.remove('on'); ov.hidden = true;
    document.documentElement.classList.remove('speed-open');
    if (src && src.scrollIntoView) src.scrollIntoView({ block: 'center' });
    if (opener) opener.focus({ preventScroll: true });
  }

  document.addEventListener('click', e => { const b = e.target.closest('[data-speed]'); if (b) { e.preventDefault(); open(b); } });
  document.addEventListener('keydown', key);
  // leaving the page (SPA navigation or history) closes the reader
  addEventListener('popstate', close);
})();

// ---- share bar: copy link (with fallback) and native share where the device has it
(() => {
  const label = (b, txt) => { const o = b.dataset.o || (b.dataset.o = b.textContent); b.textContent = txt; b.classList.add('is-done'); clearTimeout(b._t); b._t = setTimeout(() => { b.textContent = o; b.classList.remove('is-done'); }, 1800); };
  const reveal = () => { if (navigator.share) document.querySelectorAll('.share-native').forEach(b => { b.hidden = false; }); };
  reveal(); new MutationObserver(reveal).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', async e => {
    const c = e.target.closest('[data-copy]');
    if (c) {
      const url = c.dataset.copy;
      try { await navigator.clipboard.writeText(url); label(c, 'Copied'); }
      catch (err) {
        const ta = document.createElement('textarea'); ta.value = url; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
        document.body.append(ta); ta.select();
        let ok = false; try { ok = document.execCommand('copy'); } catch (x) {}
        ta.remove(); label(c, ok ? 'Copied' : url);
      }
      try { window.goatcounter && window.goatcounter.count({ path: 'share-copy' + location.pathname, title: 'Copy link', event: true }); } catch (x) {}
      return;
    }
    const n = e.target.closest('[data-native]');
    if (n && navigator.share) {
      const t = document.querySelector('#app .post-title');
      try { await navigator.share({ title: t ? (t.getAttribute('aria-label') || t.textContent.trim()) : document.title, url: n.dataset.native }); } catch (x) {}
      return;
    }
    const a = e.target.closest('.share a.share-b');
    if (a) { try { window.goatcounter && window.goatcounter.count({ path: 'share-' + a.textContent.trim().toLowerCase() + location.pathname, title: 'Share', event: true }); } catch (x) {} }
  });
})();
