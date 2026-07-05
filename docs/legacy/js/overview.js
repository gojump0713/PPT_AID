// overview.js — Overview Mode: live-DOM thumbnails, keyboard/mouse navigation
(function () {
  'use strict';
  const CFG = window.DECK_CONFIG;

  const Overview = {
    el: null, grid: null,
    open: false,
    focusIdx: 0,
    built: false,

    init() {
      this.el = document.getElementById('overview');
      this.grid = document.getElementById('overview-grid');
      document.getElementById('btn-overview').addEventListener('click', () => this.toggle());
    },

    sectionOf(num) {
      return CFG.sections.find(s => num >= s.from && num <= s.to);
    },

    build() {
      if (this.built) return;
      const frag = document.createDocumentFragment();
      window.SLIDES.forEach((s, i) => {
        const card = document.createElement('div');
        card.className = 'ov-card';
        card.setAttribute('role', 'option');
        card.setAttribute('tabindex', '-1');
        card.dataset.idx = i;
        const sec = this.sectionOf(s.num);
        const thumb = document.createElement('div');
        thumb.className = 'ov-thumb';
        // live scaled clone of the actual slide DOM (not a static capture)
        const clone = document.createElement('div');
        clone.className = 'slide';
        clone.style.background = s.bg;
        clone.innerHTML = s.html;
        // strip videos in thumbnails (keep poster imgs) to save memory
        clone.querySelectorAll('video').forEach(v => {
          const ph = document.createElement('div');
          ph.style.cssText = 'width:100%;height:100%;background:#111 center/38px no-repeat url("data:image/svg+xml,' +
            encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00e5ff"><path d="M8 5v14l11-7z"/></svg>') + '")';
          if (v.poster) { ph.style.background = `#111 url('${v.poster}') center/cover no-repeat`; }
          v.parentNode.replaceChild(ph, v);
        });
        thumb.appendChild(clone);
        const label = document.createElement('div');
        label.className = 'ov-label';
        label.innerHTML = `<span class="ov-num">${String(s.num).padStart(2, '0')}</span><span class="ov-title"></span>`;
        label.querySelector('.ov-title').textContent = s.title;
        const secTag = document.createElement('span');
        secTag.className = 'ov-sec';
        secTag.textContent = sec ? sec.name : '';
        if (sec) secTag.style.setProperty('--sec-color', sec.color);
        card.appendChild(secTag);
        card.appendChild(thumb);
        card.appendChild(label);
        card.title = `${s.num}. ${s.title}`;
        card.addEventListener('click', () => {
          this.close();
          window.Deck.goTo(i, 'zoom');
        });
        card.style.animationDelay = `${Math.min(i * 18, 500)}ms`;
        frag.appendChild(card);
      });
      this.grid.appendChild(frag);
      this.built = true;
      this.scaleThumbs();
      window.addEventListener('resize', () => this.scaleThumbs());
    },

    scaleThumbs() {
      const first = this.grid.querySelector('.ov-thumb');
      if (!first) return;
      const w = first.clientWidth || 218;
      const scale = w / CFG.design.width;
      this.grid.querySelectorAll('.ov-thumb > .slide').forEach(el => {
        el.style.transform = `scale(${scale})`;
      });
    },

    toggle() { this.open ? this.close() : this.show(); },

    show() {
      if (this.open) return;
      this.build();
      this.open = true;
      this.el.hidden = false;
      this.focusIdx = window.Deck.current;
      this.highlight();
      this.scaleThumbs();
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
        c.classList.toggle('current', i === window.Deck.current);
        c.classList.toggle('focused', i === this.focusIdx);
      });
      const f = this.grid.children[this.focusIdx];
      if (f) f.scrollIntoView({ block: 'nearest' });
    },

    /** overview-mode key handling; returns true if consumed */
    key(e) {
      if (!this.open) return false;
      const cols = Math.max(1, Math.round(this.grid.clientWidth / 234));
      switch (e.key) {
        case 'Escape': case 'o': case 'O': this.close(); return true;
        case 'ArrowRight': this.focusIdx = Math.min(window.SLIDES.length - 1, this.focusIdx + 1); this.highlight(); return true;
        case 'ArrowLeft': this.focusIdx = Math.max(0, this.focusIdx - 1); this.highlight(); return true;
        case 'ArrowDown': this.focusIdx = Math.min(window.SLIDES.length - 1, this.focusIdx + cols); this.highlight(); return true;
        case 'ArrowUp': this.focusIdx = Math.max(0, this.focusIdx - cols); this.highlight(); return true;
        case 'Enter': {
          const idx = this.focusIdx;
          this.close();
          window.Deck.goTo(idx, 'zoom');
          return true;
        }
      }
      return false;
    },
  };

  window.Overview = Overview;
})();
