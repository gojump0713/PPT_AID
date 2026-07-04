// speaker-notes.js — presenter notes popup window (N key)
(function () {
  'use strict';
  const Notes = {
    win: null,

    open() {
      if (this.win && !this.win.closed) { this.win.focus(); this.render(); return; }
      this.win = window.open('', 'deck-notes', 'width=560,height=640');
      if (!this.win) {
        console.info('[deck] popup blocked — speaker notes unavailable');
        return;
      }
      const d = this.win.document;
      d.title = '발표자 노트';
      d.head.innerHTML = '<meta charset="utf-8"><style>' +
        'body{background:#0b0e17;color:#eee;font-family:"Malgun Gothic",sans-serif;padding:20px;line-height:1.6}' +
        'h1{font-size:15px;color:#00e5ff;margin-bottom:4px}' +
        'h2{font-size:13px;color:#8a93a8;font-weight:400;margin-bottom:14px}' +
        '#notes{font-size:15px;white-space:pre-wrap;background:rgba(255,255,255,.05);border-radius:10px;padding:16px;min-height:200px}' +
        '#next{margin-top:16px;font-size:13px;color:#8a93a8}#next b{color:#00ab89}' +
        '#time{position:fixed;top:16px;right:20px;font-size:22px;font-variant-numeric:tabular-nums;color:#fff}' +
        '</style>';
      d.body.innerHTML = '<div id="time">00:00</div><h1 id="cur"></h1><h2 id="sec"></h2><div id="notes"></div><div id="next"></div>';
      this.render();
      this.tick();
    },

    render() {
      if (!this.win || this.win.closed) return;
      const d = this.win.document;
      const i = window.Deck.current;
      const s = window.SLIDES[i];
      const next = window.SLIDES[i + 1];
      const sec = window.DECK_CONFIG.sections.find(x => s.num >= x.from && s.num <= x.to);
      d.getElementById('cur').textContent = `${s.num} / ${window.SLIDES.length} — ${s.title}`;
      d.getElementById('sec').textContent = sec ? sec.name : '';
      d.getElementById('notes').textContent = s.notes || '(이 슬라이드에는 노트가 없습니다)';
      d.getElementById('next').innerHTML = next
        ? `다음 슬라이드 → <b></b>` : '마지막 슬라이드입니다.';
      if (next) d.querySelector('#next b').textContent = `${next.num}. ${next.title}`;
    },

    tick() {
      if (!this.win || this.win.closed) return;
      const el = this.win.document.getElementById('time');
      if (el) el.textContent = window.Deck.elapsed();
      setTimeout(() => this.tick(), 1000);
    },
  };
  window.Notes = Notes;
})();
