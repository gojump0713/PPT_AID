// transitions.js — cinematic slide transitions with input locking
(function () {
  'use strict';
  const CFG = window.DECK_CONFIG;

  function sectionIndexOf(num) {
    return CFG.sections.findIndex(s => num >= s.from && num <= s.to);
  }

  const Transitions = {
    locked: false,

    /** pick transition kind for moving from slide a -> b (1-based) */
    pick(a, b) {
      const ov = CFG.transitionOverrides[b];
      if (ov) return ov;
      if (a === 0) return 'fade'; // initial show
      const sa = sectionIndexOf(a), sb = sectionIndexOf(b);
      if (sa !== sb) return 'wipe';        // chapter boundary
      return b > a ? 'push-fwd' : 'push-back'; // within chapter
    },

    /** animate outgoing/incoming slide elements; resolves when done */
    run(outEl, inEl, kind, done) {
      this.locked = true;
      const finish = () => {
        if (outEl) {
          outEl.classList.remove('active', 'transitioning', 'incoming');
          outEl.className = outEl.className.replace(/\bt-[\w-]+/g, '').trim();
          outEl.classList.remove('active');
        }
        inEl.className = inEl.className.replace(/\bt-[\w-]+/g, '').trim();
        inEl.classList.remove('transitioning', 'incoming');
        inEl.classList.add('active');
        this.locked = false;
        done && done();
      };

      if (!outEl || (window.Perf && window.Perf.reducedMotion)) {
        // instant-ish path
        inEl.classList.add('active');
        if (outEl && outEl !== inEl) outEl.classList.remove('active');
        this.locked = false;
        done && done();
        return;
      }

      const map = {
        'fade':      { out: 't-fade-out', in: 't-fade-in', dur: 850 },
        'push-fwd':  { out: 't-push-out-l', in: 't-push-in-r', dur: 850 },
        'push-back': { out: 't-push-out-r', in: 't-push-in-l', dur: 850 },
        'wipe':      { out: 't-fade-out', in: 't-wipe-in', dur: 1150 },
        'zoom':      { out: 't-zoom-out', in: 't-zoom-in', dur: 900 },
      };
      const m = map[kind] || map.fade;

      outEl.classList.add('transitioning', m.out);
      inEl.classList.add('transitioning', 'incoming', m.in);

      let finished = false;
      const onEnd = () => {
        if (finished) return;
        finished = true;
        finish();
      };
      inEl.addEventListener('animationend', onEnd, { once: true });
      // safety net in case animationend never fires
      setTimeout(onEnd, m.dur + 250);
    },
  };

  window.Transitions = Transitions;
})();
