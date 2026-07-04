// navigation.js — keyboard / wheel / touch / presenter-remote control
(function () {
  'use strict';

  const Nav = {
    gotoBuf: '',
    gotoTimer: 0,
    wheelLock: 0,
    touchX: null,

    init() {
      document.addEventListener('keydown', (e) => this.onKey(e));
      window.addEventListener('wheel', (e) => this.onWheel(e), { passive: true });
      window.addEventListener('touchstart', (e) => { this.touchX = e.touches[0].clientX; }, { passive: true });
      window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: true });
      window.addEventListener('hashchange', () => window.Deck.fromHash());
      // click empty stage area = next interaction step (avoid controls/videos/links)
      document.getElementById('stage').addEventListener('click', (e) => {
        if (e.target.closest('video, a, button, .vid')) return;
        if (window.Overview.open || window.Deck.blackout) return;
        window.Deck.next();
      });
    },

    onKey(e) {
      // never hijack typing in inputs (notes window etc. is separate document anyway)
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const D = window.Deck;

      if (window.Overview.key(e)) { e.preventDefault(); return; }

      // blackout: any key exits
      if (D.blackout && e.key !== 'F5') {
        D.toggleBlackout(false);
        e.preventDefault();
        return;
      }

      // number buffer for "digits + Enter" jump
      if (/^[0-9]$/.test(e.key)) {
        this.gotoBuf += e.key;
        this.showGoto();
        return;
      }
      if (e.key === 'Enter' && this.gotoBuf) {
        const n = parseInt(this.gotoBuf, 10);
        this.clearGoto();
        if (n >= 1 && n <= window.SLIDES.length) D.goTo(n - 1);
        e.preventDefault();
        return;
      }

      switch (e.key) {
        case 'ArrowRight': case 'PageDown': case ' ':
          e.preventDefault(); D.next(); break;
        case 'ArrowLeft': case 'PageUp':
          e.preventDefault(); D.prev(); break;
        case 'Home': e.preventDefault(); D.goTo(0); break;
        case 'End': e.preventDefault(); D.goTo(window.SLIDES.length - 1); break;
        case 'o': case 'O': e.preventDefault(); window.Overview.toggle(); break;
        case 'Escape': e.preventDefault(); window.Overview.toggle(); break;
        case 'f': case 'F': e.preventDefault(); this.fullscreen(); break;
        case 'b': case 'B': case '.': e.preventDefault(); D.toggleBlackout(); break;
        case 'n': case 'N': e.preventDefault(); window.Notes.open(); break;
        case 'r': case 'R': e.preventDefault(); D.resetTimer(); break;
        default: this.clearGoto();
      }
    },

    onWheel(e) {
      if (window.Overview.open) return; // native scroll in overview grid
      const now = Date.now();
      if (now - this.wheelLock < 550) return;
      if (Math.abs(e.deltaY) < 18) return;
      this.wheelLock = now;
      e.deltaY > 0 ? window.Deck.next() : window.Deck.prev();
    },

    onTouchEnd(e) {
      if (this.touchX === null || window.Overview.open) return;
      const dx = e.changedTouches[0].clientX - this.touchX;
      this.touchX = null;
      if (Math.abs(dx) < 60) return;
      dx < 0 ? window.Deck.next() : window.Deck.prev();
    },

    fullscreen() {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    },

    showGoto() {
      const box = document.getElementById('goto-box');
      box.hidden = false;
      box.innerHTML = '';
      const n = document.createElement('div');
      n.textContent = this.gotoBuf;
      const hint = document.createElement('small');
      hint.textContent = 'Enter로 이동';
      box.appendChild(n); box.appendChild(hint);
      clearTimeout(this.gotoTimer);
      this.gotoTimer = setTimeout(() => this.clearGoto(), 3000);
    },
    clearGoto() {
      this.gotoBuf = '';
      clearTimeout(this.gotoTimer);
      document.getElementById('goto-box').hidden = true;
    },
  };

  window.Nav = Nav;
})();
