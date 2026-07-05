// main.js — deck bootstrap: stage scaling, scene mount, navigation, HUD,
// overview, speaker notes, blackout, timer. Ties the scene registry
// (scenes.js) to the DOM shell declared in index.html.
import './styles/reset.css';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/animations.css';
import './styles/scenes.css';
import './styles/fallback.css';

import { gsap } from 'gsap';
import { CONFIG } from './config.js';
import { mountScenes, SCENES, SECTIONS, sectionOf } from './scenes.js';
import { Perf } from './performance.js';

const $ = (id) => document.getElementById(id);
const TOTAL = SCENES.length;

const Deck = {
  current: 0,
  blackout: false,
  startTime: 0,
  locked: false,
  mounts: [],

  init() {
    Perf.init();

    const stage = $('stage');
    this.mounts = mountScenes(stage);
    if (!this.mounts.length) { console.error('[deck] no scenes mounted'); return; }

    this.fitStage();
    window.addEventListener('resize', () => { this.fitStage(); Overview.scaleJourney(); });

    Overview.init();
    Notes.init();
    this.bindKeys();
    this.bindPointer();
    window.addEventListener('hashchange', () => this.fromHash());

    // initial scene: hash > localStorage > 0
    let idx = this.idxFromHash();
    if (idx === null) {
      const saved = parseInt(localStorage.getItem(CONFIG.storageKey), 10);
      idx = Number.isFinite(saved) && saved >= 0 && saved < TOTAL ? saved : 0;
    }

    this.startTime = performance.now();
    this.show(idx);
    this.timerLoop();
    document.body.classList.add('ready');
  },

  fitStage() {
    const { width, height } = CONFIG.design;
    const scale = Math.min(window.innerWidth / width, window.innerHeight / height);
    $('stage').style.transform = `scale(${scale})`;
  },

  // ───────── navigation ─────────
  next() { this.goTo(this.current + 1); },
  prev() { this.goTo(this.current - 1); },

  /** first render — no transition */
  show(idx) {
    this.current = idx;
    const m = this.mounts[idx];
    m.el.classList.add('active');
    m.enter();
    this.syncState();
  },

  goTo(idx) {
    if (this.locked) return;
    if (idx < 0 || idx >= TOTAL || idx === this.current) return;

    const prev = this.current;
    const outM = this.mounts[prev];
    const inM = this.mounts[idx];
    this.current = idx;

    if (Perf.reducedMotion) {
      outM.el.classList.remove('active');
      outM.el.style.opacity = '';
      outM.leaveCleanup();
      inM.el.classList.add('active');
      inM.enter();
      this.syncState();
      return;
    }

    this.locked = true;
    const dur = 0.55;

    // incoming: build + reveal timeline immediately, fade its root in
    inM.el.classList.add('active');
    inM.enter();
    gsap.fromTo(inM.el, { opacity: 0 }, { opacity: 1, duration: dur, ease: 'power2.out' });

    // outgoing: fade out, then deactivate + release scene resources
    gsap.to(outM.el, {
      opacity: 0,
      duration: dur * 0.8,
      ease: 'power2.in',
      onComplete: () => {
        outM.el.classList.remove('active');
        outM.el.style.opacity = '';
        outM.leaveCleanup();
      },
    });

    setTimeout(() => { this.locked = false; }, dur * 1000 + CONFIG.transitionLockPad);
    this.syncState();
  },

  // ───────── state / HUD ─────────
  idxFromHash() {
    const m = /#\/scene-(\d+)/.exec(location.hash);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return (n >= 1 && n <= TOTAL) ? n - 1 : null;
  },

  fromHash() {
    const idx = this.idxFromHash();
    if (idx !== null && idx !== this.current) this.goTo(idx);
  },

  syncState() {
    const num = this.current + 1;
    const sec = sectionOf(this.mounts[this.current].scene);

    const newHash = `#/scene-${num}`;
    if (location.hash !== newHash) history.replaceState(null, '', newHash);
    localStorage.setItem(CONFIG.storageKey, String(this.current));

    $('hud-page').innerHTML = `<b>${String(num).padStart(2, '0')}</b> / ${TOTAL}`;
    const hs = $('hud-section');
    hs.textContent = sec ? sec.name : '';
    if (sec) hs.style.setProperty('--sec-color', sec.color);
    $('progress-bar').style.width = `${(num / TOTAL) * 100}%`;

    document.body.classList.toggle('at-start', this.current === 0);
    if (Overview.open) Overview.highlight();
    Notes.render();
  },

  // ───────── blackout / timer ─────────
  toggleBlackout(force) {
    this.blackout = force !== undefined ? force : !this.blackout;
    $('blackout').hidden = !this.blackout;
  },

  resetTimer() { this.startTime = performance.now(); },

  elapsed() {
    const s = Math.floor((performance.now() - this.startTime) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  },

  timerLoop() {
    $('hud-timer').textContent = this.elapsed();
    if (Notes.open) Notes.tick();
    setTimeout(() => this.timerLoop(), 1000);
  },

  // ───────── input ─────────
  bindKeys() {
    let buf = '', bufTimer = 0;
    const clearGoto = () => { buf = ''; clearTimeout(bufTimer); $('goto-box').hidden = true; };
    const showGoto = () => {
      const box = $('goto-box');
      box.hidden = false;
      box.innerHTML = `<div>${buf}</div><small>Enter로 이동</small>`;
      clearTimeout(bufTimer);
      bufTimer = setTimeout(clearGoto, 3000);
    };

    document.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (Overview.key(e)) { e.preventDefault(); return; }

      if (this.blackout && e.key !== 'F5') { this.toggleBlackout(false); e.preventDefault(); return; }

      if (/^[0-9]$/.test(e.key)) { buf += e.key; showGoto(); return; }
      if (e.key === 'Enter' && buf) {
        const n = parseInt(buf, 10);
        clearGoto();
        if (n >= 1 && n <= TOTAL) this.goTo(n - 1);
        e.preventDefault();
        return;
      }

      switch (e.key) {
        case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); this.next(); break;
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); this.prev(); break;
        case 'Home': e.preventDefault(); this.goTo(0); break;
        case 'End': e.preventDefault(); this.goTo(TOTAL - 1); break;
        case 'o': case 'O': e.preventDefault(); Overview.toggle(); break;
        case 'Escape': e.preventDefault(); if (Overview.open) Overview.close(); break;
        case 'f': case 'F': e.preventDefault(); this.fullscreen(); break;
        case 'b': case 'B': case '.': e.preventDefault(); this.toggleBlackout(); break;
        case 'n': case 'N': e.preventDefault(); Notes.toggle(); break;
        case 'r': case 'R': e.preventDefault(); this.resetTimer(); break;
        default: clearGoto();
      }
    });
  },

  bindPointer() {
    let wheelLock = 0, touchX = null;
    window.addEventListener('wheel', (e) => {
      if (Overview.open) return;
      const now = performance.now();
      if (now - wheelLock < 620) return;
      if (Math.abs(e.deltaY) < 18) return;
      wheelLock = now;
      e.deltaY > 0 ? this.next() : this.prev();
    }, { passive: true });

    window.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    window.addEventListener('touchend', (e) => {
      if (touchX === null || Overview.open) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) < 60) return;
      dx < 0 ? this.next() : this.prev();
    }, { passive: true });

    $('stage').addEventListener('click', (e) => {
      if (e.target.closest('video, a, button, .cta-btn')) return;
      if (Overview.open || this.blackout) return;
      this.next();
    });
  },

  fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  },
};

// ───────── Overview ─────────
const Overview = {
  el: null, grid: null, journey: null,
  open: false, focusIdx: 0, built: false,

  init() {
    this.el = $('overview');
    this.grid = $('overview-grid');
    this.journey = $('overview-journey');
    $('btn-overview').addEventListener('click', () => this.toggle());
  },

  build() {
    if (this.built) return;
    const frag = document.createDocumentFragment();
    SCENES.forEach((scene, i) => {
      const sec = sectionOf(scene);
      const card = document.createElement('div');
      card.className = 'ov-card';
      card.setAttribute('role', 'option');
      card.setAttribute('tabindex', '-1');
      card.dataset.idx = i;
      card.style.setProperty('--sec-color', sec ? sec.color : '');
      card.style.animationDelay = `${Math.min(i * 16, 420)}ms`;

      const title = scene.title || (scene.headline || '').replace(/\n/g, ' ');
      const desc = scene.body || scene.speakerNote || '';
      card.innerHTML =
        `<div class="ov-card__num"><span>${String(i + 1).padStart(2, '0')}</span>` +
        `<span class="ov-card__sec">${escapeHtml(sec ? sec.name : '')}</span></div>` +
        `<div class="ov-card__title">${escapeHtml(title)}</div>` +
        `<div class="ov-card__desc">${escapeHtml(desc)}</div>`;

      card.addEventListener('click', () => { this.close(); Deck.goTo(i); });
      frag.appendChild(card);
    });
    this.grid.appendChild(frag);
    this.built = true;
  },

  toggle() { this.open ? this.close() : this.show(); },

  show() {
    if (this.open) return;
    this.build();
    this.open = true;
    this.el.hidden = false;
    this.focusIdx = Deck.current;
    this.highlight();
    this.scaleJourney();
    const cur = this.grid.children[this.focusIdx];
    if (cur) cur.scrollIntoView({ block: 'center' });
  },

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.hidden = true;
  },

  highlight() {
    Array.from(this.grid.children).forEach((c, i) => {
      c.classList.toggle('current', i === Deck.current);
      c.classList.toggle('focused', i === this.focusIdx);
    });
    const f = this.grid.children[this.focusIdx];
    if (f) f.scrollIntoView({ block: 'nearest' });
  },

  /** decorative journey line linking one card per section */
  scaleJourney() {
    if (!this.open || !this.journey || !this.built) return;
    const svg = this.journey;
    svg.innerHTML = '';
    const seen = new Set();
    const pts = [];
    Array.from(this.grid.children).forEach((card, i) => {
      const secName = sectionOf(SCENES[i])?.id;
      if (secName && !seen.has(secName)) {
        seen.add(secName);
        const r = card.getBoundingClientRect();
        pts.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, color: card.style.getPropertyValue('--sec-color') });
      }
    });
    if (pts.length < 2) return;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'rgba(0,229,255,0.18)');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-dasharray', '4 8');
    svg.appendChild(path);
  },

  key(e) {
    if (!this.open) return false;
    const cols = Math.max(1, Math.round(this.grid.clientWidth / 233));
    switch (e.key) {
      case 'Escape': case 'o': case 'O': this.close(); return true;
      case 'ArrowRight': this.focusIdx = Math.min(TOTAL - 1, this.focusIdx + 1); this.highlight(); return true;
      case 'ArrowLeft': this.focusIdx = Math.max(0, this.focusIdx - 1); this.highlight(); return true;
      case 'ArrowDown': this.focusIdx = Math.min(TOTAL - 1, this.focusIdx + cols); this.highlight(); return true;
      case 'ArrowUp': this.focusIdx = Math.max(0, this.focusIdx - cols); this.highlight(); return true;
      case 'Enter': { const i = this.focusIdx; this.close(); Deck.goTo(i); return true; }
    }
    return false;
  },
};

// ───────── Speaker notes (in-page modal) ─────────
const Notes = {
  el: null, open: false,

  init() { this.el = $('notes-modal'); },

  toggle() { this.open ? this.close() : this.show(); },

  show() { this.open = true; this.el.hidden = false; this.render(); },
  close() { this.open = false; this.el.hidden = true; },

  render() {
    if (!this.open || !this.el) return;
    const i = Deck.current;
    const scene = SCENES[i];
    const next = SCENES[i + 1];
    const sec = sectionOf(scene);
    const title = scene.title || (scene.headline || '').replace(/\n/g, ' ');
    const nextTitle = next ? (next.title || (next.headline || '').replace(/\n/g, ' ')) : '';
    this.el.innerHTML =
      `<div id="time" style="float:right;font-weight:800">${Deck.elapsed()}</div>` +
      `<h3>${String(i + 1).padStart(2, '0')} / ${TOTAL} — ${escapeHtml(title)}</h3>` +
      `<h4>${escapeHtml(sec ? sec.name : '')}</h4>` +
      `<div class="note-body">${escapeHtml(scene.speakerNote || '(이 장면에는 노트가 없습니다)')}</div>` +
      (next
        ? `<div class="note-next">다음 → <b>${escapeHtml(nextTitle)}</b></div>`
        : `<div class="note-next">마지막 장면입니다.</div>`);
  },

  tick() {
    if (!this.open || !this.el) return;
    const t = this.el.querySelector('#time');
    if (t) t.textContent = Deck.elapsed();
  },
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Deck.init(), { once: true });
} else {
  Deck.init();
}
