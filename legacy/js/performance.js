// performance.js — low-power detection & reduced-motion handling
(function () {
  'use strict';
  const Perf = {
    lowPower: false,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,

    init() {
      if (this.reducedMotion) document.body.classList.add('reduced-motion');
      // 3-second FPS sampling; drop to low-power mode below 45fps average
      let frames = 0;
      const start = performance.now();
      const sample = (t) => {
        frames++;
        if (t - start < 3000) requestAnimationFrame(sample);
        else {
          const fps = frames / ((t - start) / 1000);
          if (fps < 45) this.enterLowPower('avg fps ' + fps.toFixed(1));
        }
      };
      requestAnimationFrame(sample);

      // canvas 2d context failure check happens in effects.js -> enterLowPower
      window.addEventListener('error', (e) => {
        // swallow media element load noise; real script errors keep bubbling to console
        if (e.target && (e.target.tagName === 'VIDEO' || e.target.tagName === 'IMG')) {
          e.stopImmediatePropagation();
        }
      }, true);
    },

    enterLowPower(reason) {
      if (this.lowPower) return;
      this.lowPower = true;
      document.body.classList.add('low-power');
      if (window.FX) window.FX.stop();
      console.info('[deck] low-power mode: ' + reason);
    },
  };
  window.Perf = Perf;
})();
