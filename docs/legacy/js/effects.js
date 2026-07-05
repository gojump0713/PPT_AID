// effects.js — particle signature scenes (hero/closing) + mouse parallax + shape reveal
(function () {
  'use strict';
  const W = 1920, H = 1080;

  const FX = {
    canvas: null, ctx: null,
    particles: [],
    running: false,
    raf: 0,
    mouse: { x: W / 2, y: H / 2 },

    init() {
      this.canvas = document.getElementById('fx-canvas');
      try {
        this.ctx = this.canvas.getContext('2d');
      } catch (e) {
        this.ctx = null;
      }
      if (!this.ctx) {
        window.Perf && window.Perf.enterLowPower('canvas 2d unavailable');
        return;
      }
      document.addEventListener('mousemove', (e) => {
        const r = this.canvas.getBoundingClientRect();
        if (r.width === 0) return;
        this.mouse.x = ((e.clientX - r.left) / r.width) * W;
        this.mouse.y = ((e.clientY - r.top) / r.height) * H;
      });
    },

    seed(count) {
      const n = (window.Perf && window.Perf.lowPower) ? 0 : count;
      this.particles = [];
      for (let i = 0; i < n; i++) {
        this.particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: 0.6 + Math.random() * 2.2,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          a: 0.15 + Math.random() * 0.5,
          hue: Math.random() < 0.7 ? 168 : 190, // brand green / cyan
        });
      }
    },

    start(slideNum) {
      if (!this.ctx || (window.Perf && window.Perf.lowPower)) return;
      if (window.Perf && window.Perf.reducedMotion) return;
      this.seed(1400);
      if (this.running) return;
      this.running = true;
      const loop = () => {
        if (!this.running) return;
        this.step();
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    },

    stop() {
      this.running = false;
      cancelAnimationFrame(this.raf);
      if (this.ctx) this.ctx.clearRect(0, 0, W, H);
      this.particles = [];
    },

    step() {
      const c = this.ctx;
      c.clearRect(0, 0, W, H);
      const mx = this.mouse.x, my = this.mouse.y;
      for (const p of this.particles) {
        p.x += p.vx; p.y += p.vy;
        // gentle mouse parallax repulsion
        const dx = p.x - mx, dy = p.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < 22500 && d2 > 1) {
          const f = 40 / d2;
          p.x += dx * f; p.y += dy * f;
        }
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, 6.2832);
        c.fillStyle = `hsla(${p.hue}, 100%, 62%, ${p.a})`;
        c.fill();
      }
    },
  };

  // ---- entrance reveal: stagger .shp children of a slide ----
  const Reveal = {
    MAX: 24, // don't stagger crowded slides too long
    run(slideEl) {
      if ((window.Perf && (window.Perf.reducedMotion || window.Perf.lowPower))) return;
      const shapes = Array.from(slideEl.children).filter(el => el.classList && (el.classList.contains('shp') || el.classList.contains('grp')));
      if (shapes.length < 3 || shapes.length > this.MAX) return;
      slideEl.classList.add('reveal');
      shapes.forEach(s => { s.classList.add('rv'); s.classList.remove('rv-on'); });
      // force style flush so transition applies
      void slideEl.offsetWidth;
      shapes.forEach((s, i) => {
        setTimeout(() => s.classList.add('rv-on'), 120 + i * 70);
      });
      // cleanup: after all shown, drop reveal machinery
      setTimeout(() => {
        shapes.forEach(s => { s.classList.remove('rv', 'rv-on'); });
        slideEl.classList.remove('reveal');
      }, 120 + shapes.length * 70 + 900);
    },
    cancel(slideEl) {
      slideEl.classList.remove('reveal');
      Array.from(slideEl.querySelectorAll('.rv')).forEach(s => s.classList.remove('rv', 'rv-on'));
    },
  };

  window.FX = FX;
  window.Reveal = Reveal;
})();
