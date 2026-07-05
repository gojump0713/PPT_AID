// main.js — deck bootstrap: stage scaling, slide mount, state, HUD
(function () {
  'use strict';
  const CFG = window.DECK_CONFIG;

  const Deck = {
    current: 0,
    blackout: false,
    startTime: Date.now(),
    els: [],

    init() {
      if (!window.SLIDES || !window.SLIDES.length) {
        console.error('[deck] no slide content');
        return;
      }
      this.mount();
      this.fitStage();
      window.addEventListener('resize', () => this.fitStage());

      window.FX.init();
      window.Overview.init();
      window.Nav.init();
      window.Perf.init();

      // initial slide: hash > localStorage > 0
      let idx = this.idxFromHash();
      if (idx === null) {
        const saved = parseInt(localStorage.getItem(CFG.storageKey), 10);
        idx = Number.isFinite(saved) && saved >= 0 && saved < window.SLIDES.length ? saved : 0;
      }
      this.show(idx, true);
      this.timerLoop();
      document.body.classList.add('hud-visible');
    },

    mount() {
      const host = document.getElementById('slides');
      const frag = document.createDocumentFragment();
      window.SLIDES.forEach((s, i) => {
        const el = document.createElement('section');
        el.className = 'slide';
        el.dataset.slide = s.num;
        el.dataset.title = s.title;
        el.setAttribute('aria-label', `슬라이드 ${s.num}: ${s.title}`);
        el.style.background = s.bg;
        el.innerHTML = s.html;
        frag.appendChild(el);
        this.els.push(el);
      });
      host.appendChild(frag);
    },

    fitStage() {
      const stage = document.getElementById('stage');
      const scale = Math.min(window.innerWidth / CFG.design.width, window.innerHeight / CFG.design.height);
      stage.style.transform = `scale(${scale})`;
    },

    sectionOf(num) {
      return CFG.sections.find(s => num >= s.from && num <= s.to);
    },

    // ---------- navigation ----------
    next() { this.goTo(this.current + 1); },
    prev() { this.goTo(this.current - 1); },

    goTo(idx, forcedKind) {
      if (window.Transitions.locked) return;
      if (idx < 0 || idx >= window.SLIDES.length || idx === this.current) return;
      const outEl = this.els[this.current];
      const inEl = this.els[idx];
      const kind = forcedKind || window.Transitions.pick(this.current + 1, idx + 1);
      const prevIdx = this.current;
      this.current = idx;
      this.leaveSlide(outEl, prevIdx);
      // start shape reveal alongside the transition so content is never blank after it
      window.Reveal.run(inEl);
      window.Transitions.run(outEl, inEl, kind, () => this.enterSlide(inEl, idx, true));
      this.syncState();
    },

    show(idx, initial) {
      this.current = idx;
      const el = this.els[idx];
      el.classList.add('active');
      this.enterSlide(el, idx);
      this.syncState(initial);
    },

    enterSlide(el, idx, revealAlreadyRunning) {
      const num = idx + 1;
      if (!revealAlreadyRunning) window.Reveal.run(el);
      if (CFG.particleSlides.includes(num)) window.FX.start(num);
      else window.FX.stop();
      // lazily set video preload when its slide becomes current
      el.querySelectorAll('video[preload="none"]').forEach(v => { v.preload = 'metadata'; });
      // background footage videos: muted autoplay loop while slide is active
      el.querySelectorAll('video[data-autoplay]').forEach(v => {
        v.muted = true;
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      });
      if (window.Notes) window.Notes.render();
    },

    leaveSlide(el, idx) {
      window.Reveal.cancel(el);
      el.querySelectorAll('video').forEach(v => { try { v.pause(); } catch (e) {} });
    },

    // ---------- state / HUD ----------
    idxFromHash() {
      const m = /#\/slide-(\d+)/.exec(location.hash);
      if (!m) return null;
      const n = parseInt(m[1], 10);
      return (n >= 1 && n <= window.SLIDES.length) ? n - 1 : null;
    },

    fromHash() {
      const idx = this.idxFromHash();
      if (idx !== null && idx !== this.current) this.goTo(idx);
    },

    syncState(initial) {
      const num = this.current + 1;
      const total = window.SLIDES.length;
      const sec = this.sectionOf(num);
      // hash without triggering hashchange loops
      const newHash = `#/slide-${num}`;
      if (location.hash !== newHash) history.replaceState(null, '', newHash);
      localStorage.setItem(CFG.storageKey, String(this.current));
      // HUD
      document.getElementById('hud-page').innerHTML = `<b>${String(num).padStart(2, '0')}</b> / ${total}`;
      document.getElementById('hud-section').textContent = sec ? sec.name : '';
      if (sec) document.getElementById('hud-section').style.borderColor = sec.color;
      document.getElementById('progress-bar').style.width = `${(num / total) * 100}%`;
      if (window.Overview.open) window.Overview.highlight();
    },

    // ---------- blackout / timer ----------
    toggleBlackout(force) {
      this.blackout = force !== undefined ? force : !this.blackout;
      document.getElementById('blackout').hidden = !this.blackout;
    },

    resetTimer() {
      this.startTime = Date.now();
    },

    elapsed() {
      const s = Math.floor((Date.now() - this.startTime) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      return `${mm}:${ss}`;
    },

    timerLoop() {
      document.getElementById('hud-timer').textContent = this.elapsed();
      setTimeout(() => this.timerLoop(), 1000);
    },
  };

  window.Deck = Deck;
  document.addEventListener('DOMContentLoaded', () => Deck.init());
})();
