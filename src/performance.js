// performance.js — low-power detection, reduced-motion, WebGL capability
export const Perf = {
  lowPower: false,
  webgl: true,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  _listeners: [],

  init() {
    if (this.reducedMotion) document.body.classList.add('reduced-motion');

    // WebGL capability probe
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      this.webgl = !!gl;
    } catch { this.webgl = false; }
    if (!this.webgl) document.body.classList.add('no-webgl');

    // 3s FPS probe → low-power mode
    let frames = 0;
    const t0 = performance.now();
    const probe = (t) => {
      frames++;
      if (t - t0 < 3000) requestAnimationFrame(probe);
      else {
        const fps = frames / ((t - t0) / 1000);
        if (fps < 45) this.enterLowPower(`avg fps ${fps.toFixed(1)}`);
      }
    };
    requestAnimationFrame(probe);

    // swallow media loading noise (content-first: warn internally, no console errors)
    window.addEventListener('error', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'VIDEO' || t.tagName === 'IMG')) {
        e.stopImmediatePropagation();
        console.info('[deck] media failed to load (fallback ok):', t.currentSrc || t.src);
      }
    }, true);
  },

  onLowPower(fn) { this._listeners.push(fn); },

  enterLowPower(reason) {
    if (this.lowPower) return;
    this.lowPower = true;
    document.body.classList.add('low-power');
    console.info('[deck] low-power mode:', reason);
    this._listeners.forEach((fn) => { try { fn(); } catch { /* noop */ } });
  },

  get quiet() { return this.lowPower || this.reducedMotion; },
};
