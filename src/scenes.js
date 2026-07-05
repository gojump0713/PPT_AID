// scenes.js — 31개 씬의 DOM 빌더 + 진입 연출 (타입 레지스트리)
import { gsap } from 'gsap';
import { SCENES, SECTIONS, sectionOf, DECK } from './content.js';
import { el, svgEl, esc, accentify, drawPath, counterTo, scrambleTo, splitChars, typeIn, makeMagnetic, mouseParallax, icon } from './interactions.js';
import { ambientParticles, convergenceParticles } from './particles.js';
import { createNetworkScene } from './three-scenes.js';
import { Perf } from './performance.js';

import logoUrl from './assets/media/tilon-logo.png';
import vTst1 from './assets/media/tstation-demo-1.mp4';
import vTst2 from './assets/media/tstation-demo-2.mp4';
import vCbt1 from './assets/media/cbt-demo-1.mp4';
import vCbt2 from './assets/media/cbt-demo-2.mp4';

const MEDIA = {
  'tstation-demo-1': vTst1,
  'tstation-demo-2': vTst2,
  'cbt-demo-1': vCbt1,
  'cbt-demo-2': vCbt2,
};

/* ───────────────────────── shared scaffolding ───────────────────────── */

function skeleton(scene, idx) {
  const sec = sectionOf(scene);
  const root = el('section', `scene scene--${scene.type}`);
  root.dataset.id = scene.id;
  root.style.setProperty('--sec-color', sec.color);

  if (!['hero', 'closing'].includes(scene.type)) {
    root.appendChild(el('div', 'scene__kicker', `${esc(sec.name)} · ${String(idx + 1).padStart(2, '0')}`));
    const h = el('h1', 'scene__headline');
    h.innerHTML = accentify(scene.headline, scene.keywords || []);
    root.appendChild(h);
    if (scene.body) root.appendChild(el('p', 'scene__body', esc(scene.body)));
  }
  const stage = el('div', 'scene__stage');
  root.appendChild(stage);
  return { root, stage };
}

/** baseline entrance: kicker → headline → body → stage */
function baseIn(tl, root) {
  const parts = ['.scene__kicker', '.scene__headline', '.scene__body'].map((s) => root.querySelector(s)).filter(Boolean);
  if (parts.length) {
    tl.from(parts, { y: 34, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' }, 0);
  }
  const stage = root.querySelector('.scene__stage');
  if (stage) tl.from(stage, { y: 24, opacity: 0, duration: 0.7, ease: 'power3.out' }, 0.18);
}

function addCanvas(root) {
  const c = el('canvas', 'scene__canvas');
  c.width = 1920; c.height = 1080;
  root.prepend(c);
  return c;
}

function videoFrame(srcKey, label, { autoplay = true } = {}) {
  const item = el('div', 'dv-item');
  const frame = el('div', 'dv-frame glass');
  frame.innerHTML = '<div class="bar"><i></i><i></i><i></i><span>' + esc(label) + '</span></div>';
  const v = document.createElement('video');
  v.src = MEDIA[srcKey];
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
  if (autoplay) v.dataset.autoplay = '1';
  v.style.marginTop = '34px';
  frame.appendChild(v);
  item.appendChild(frame);
  item.appendChild(el('div', 'dv-label', esc(label)));
  return item;
}

function playVideos(root) {
  root.querySelectorAll('video[data-autoplay]').forEach((v) => {
    v.preload = 'auto';
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  });
}
function pauseVideos(root) {
  root.querySelectorAll('video').forEach((v) => { try { v.pause(); } catch { /* noop */ } });
}

/* ───────────────────────── type builders ─────────────────────────
   each: build(stage, scene, root) → optional { enter(tl, root, cleanups), idle } */

const BUILDERS = {

  /* S1 hero */
  hero(stage, scene, root) {
    root.appendChild(el('div', 'hero-fallback'));
    const holder = el('div', 'scene__canvas');
    root.appendChild(holder);
    const inner = el('div', 'hero-inner');
    inner.innerHTML = `
      <div class="hero-eyebrow">Interactive Presentation</div>
      <h1 class="scene__headline">${accentify(scene.headline, ['AI Native Campus'])}</h1>
      <p class="hero-sub">${esc(scene.body)}</p>
      <div class="hero-logo" data-depth="0.02"><img src="${logoUrl}" alt="Tilon"/></div>`;
    stage.style.display = 'contents';
    root.appendChild(inner);
    root.appendChild(el('div', 'hero-scroll-hint', 'PRESS → TO BEGIN'));

    let three = null;
    return {
      enter(tl, _root, cleanups) {
        three = createNetworkScene(holder, { mode: 'hero' });
        if (three) { three.start(); cleanups.push(() => { three.destroy(); three = null; }); }
        const h = inner.querySelector('.scene__headline');
        const chars = splitChars(h);
        tl.from(inner.querySelector('.hero-eyebrow'), { opacity: 0, letterSpacing: '1.2em', duration: 1.1, ease: 'power3.out' }, 0.1)
          .from(chars, { opacity: 0, y: 60, rotateX: -70, duration: 0.9, stagger: 0.018, ease: 'back.out(1.6)' }, 0.3)
          .from(inner.querySelector('.hero-sub'), { opacity: 0, y: 24, duration: 0.8 }, '-=0.4')
          .from(inner.querySelector('.hero-logo'), { opacity: 0, y: 16, duration: 0.7 }, '-=0.4')
          .from(root.querySelector('.hero-scroll-hint'), { opacity: 0, duration: 1 }, '-=0.2');
        cleanups.push(mouseParallax(root));
      },
    };
  },

  /* S2 question-orbit */
  'question-orbit'(stage, scene) {
    const d = scene.data;
    const wrap = el('div', 'qo-wrap');
    const orbit = el('div', 'qo-orbit');
    const svg = svgEl('svg', { viewBox: '0 0 620 620' });
    const ring = svgEl('circle', { cx: 310, cy: 310, r: 216, fill: 'none', stroke: 'rgba(79,124,255,0.35)', 'stroke-width': 1.5, 'stroke-dasharray': '5 7' });
    svg.appendChild(ring);
    const paths = [];
    d.orbit.forEach((o, i) => {
      const ang = (i / d.orbit.length) * Math.PI * 2 - Math.PI / 2;
      const x = 310 + Math.cos(ang) * 216, y = 310 + Math.sin(ang) * 216;
      const p = svgEl('path', { d: `M310 310 L${x} ${y}`, stroke: 'rgba(0,229,255,0.5)', 'stroke-width': 1.6, fill: 'none' });
      svg.appendChild(p); paths.push(p);
      const sat = el('div', 'qo-sat');
      sat.style.left = `${(x / 620) * 100}%`; sat.style.top = `${(y / 620) * 100}%`;
      sat.innerHTML = `<div class="card__icon">${icon(o.icon, 40)}</div><b>${esc(o.label)}</b>`;
      orbit.appendChild(sat);
    });
    orbit.prepend(svg);
    orbit.appendChild(el('div', 'qo-core', 'AI'));
    wrap.appendChild(orbit);

    const tlBox = el('div', 'qo-timeline');
    d.timeline.forEach((t, i) => {
      const row = el('div', `tl-row tl-row--${t.tone} glass`);
      row.innerHTML = `<span class="era">${esc(t.era)}</span><span class="label">${esc(t.label)}</span>`;
      tlBox.appendChild(row);
      if (i === 0) tlBox.appendChild(el('div', 'tl-arrow', '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 4v18m0 0-7-7m7 7 7-7"/></svg>'));
    });
    wrap.appendChild(tlBox);
    stage.appendChild(wrap);

    return {
      enter(tl) {
        paths.forEach((p) => drawPath(tl, p, 0.8, 0.35));
        tl.from(orbit.querySelectorAll('.qo-sat'), { opacity: 0, scale: 0.6, duration: 0.55, stagger: 0.1, ease: 'back.out(1.8)' }, 0.5)
          .from(orbit.querySelector('.qo-core'), { scale: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)' }, 0.35)
          .from(tlBox.children, { x: 60, opacity: 0, duration: 0.6, stagger: 0.18, ease: 'power3.out' }, 0.7);
        tl.to(ring, { rotation: 360, transformOrigin: '50% 50%', duration: 90, repeat: -1, ease: 'none' }, 1.4);
      },
    };
  },

  /* S3 voices */
  voices(stage, scene, root) {
    const d = scene.data;
    const gap = root.querySelector('.scene__headline');
    gap.classList.add('voices-gap');
    const row = el('div', 'voices-row');
    d.voices.forEach((v) => {
      const box = el('div', 'voice glass');
      box.innerHTML = `
        <div class="voice__icon">${icon(v.icon, 56)}</div>
        <div class="voice__bubble">“${esc(v.quote)}”</div>
        <div class="voice__who">${esc(v.who)}</div>`;
      row.appendChild(box);
    });
    stage.appendChild(row);
    return {
      enter(tl, _root, cleanups) {
        scrambleTo(tl, gap, 'Infrastructure Gap', { duration: 1.3 }, 0.15);
        tl.from(row.children, { y: 60, opacity: 0, duration: 0.7, stagger: 0.16, ease: 'power3.out' }, 0.4);
        tl.from(row.querySelectorAll('.voice__bubble'), { scale: 0.75, opacity: 0, duration: 0.5, stagger: 0.16, ease: 'back.out(2)' }, 0.8);
        row.querySelectorAll('.voice').forEach((c) => cleanups.push(makeMagnetic(c, 8)));
      },
    };
  },

  /* S4 node-map */
  'node-map'(stage, scene) {
    const d = scene.data;
    const map = el('div', 'nodemap');
    const svg = svgEl('svg', { class: 'links', viewBox: '0 0 1160 560' });
    map.appendChild(svg);
    const core = el('div', 'qo-core', esc(d.core));
    core.style.left = '50%'; core.style.top = '50%';
    core.style.position = 'absolute'; core.style.transform = 'translate(-50%,-50%)';
    map.appendChild(core);
    const paths = [], nodes = [];
    d.nodes.forEach((label, i) => {
      const ang = (i / d.nodes.length) * Math.PI * 2 - Math.PI / 2;
      const x = 580 + Math.cos(ang) * 400, y = 280 + Math.sin(ang) * 216;
      const p = svgEl('path', { d: `M580 280 Q ${(580 + x) / 2} ${(280 + y) / 2 - 34} ${x} ${y}`, stroke: 'rgba(0,229,255,0.45)', 'stroke-width': 1.6, fill: 'none' });
      svg.appendChild(p); paths.push(p);
      const n = el('div', 'diagram-node');
      n.style.left = `${(x / 1160) * 100}%`; n.style.top = `${(y / 560) * 100}%`;
      n.dataset.depth = (0.02 + i * 0.008).toFixed(3);
      n.innerHTML = `<div class="diagram-node__dot"></div><div class="diagram-node__label">${esc(label)}</div>`;
      map.appendChild(n); nodes.push(n);
    });
    stage.appendChild(map);
    return {
      enter(tl, root, cleanups) {
        tl.from(core, { scale: 0, duration: 0.9, ease: 'elastic.out(1, 0.5)' }, 0.25);
        paths.forEach((p, i) => drawPath(tl, p, 0.7, 0.45 + i * 0.08));
        tl.from(nodes, { opacity: 0, scale: 0.5, duration: 0.5, stagger: 0.08, ease: 'back.out(1.9)' }, 0.65);
        cleanups.push(mouseParallax(root));
      },
    };
  },

  /* S5 pain-cards */
  'pain-cards'(stage, scene) {
    const grid = el('div', 'pain-grid');
    scene.data.cards.forEach((c) => {
      const card = el('div', 'card');
      card.innerHTML = `<div class="card__icon">${icon(c.icon)}</div><div class="card__title">${esc(c.title)}</div><div class="card__desc">${esc(c.desc)}</div>`;
      grid.appendChild(card);
    });
    stage.appendChild(grid);
    return {
      enter(tl, _root, cleanups) {
        tl.from(grid.children, {
          y: 90, opacity: 0, rotate: (i) => [-5, 4, -3, 5][i % 4],
          duration: 0.8, stagger: 0.14, ease: 'power3.out',
        }, 0.3);
        grid.querySelectorAll('.card').forEach((c) => cleanups.push(makeMagnetic(c, 10)));
      },
    };
  },

  /* S6 framework */
  framework(stage, scene) {
    const d = scene.data;
    const wrap = el('div', 'fw-wrap');
    const models = el('div', 'fw-models');
    d.models.forEach((m) => {
      const box = el('div', `fw-model fw-model--${m.key} glass`);
      box.innerHTML = `<b>${esc(m.title)}</b><span>${esc(m.sub)}</span>`;
      models.appendChild(box);
    });
    wrap.appendChild(models);
    const svg = svgEl('svg', { class: 'fw-connect', viewBox: '0 0 1400 70', preserveAspectRatio: 'none' });
    const conns = [230, 700, 1170].map((x) => {
      const p = svgEl('path', { d: `M${x} 0 C ${x} 42, 700 26, 700 70`, stroke: 'rgba(0,229,255,0.5)', 'stroke-width': 1.8, fill: 'none' });
      svg.appendChild(p); return p;
    });
    wrap.appendChild(svg);
    const blocks = el('div', 'fw-blocks');
    d.blocks.forEach((b, i) => {
      blocks.appendChild(el('div', 'fw-block', `${esc(b)}<small>CORE ${i + 1}</small>`));
    });
    wrap.appendChild(blocks);
    stage.appendChild(wrap);
    return {
      enter(tl) {
        tl.from(models.children, { y: -40, opacity: 0, duration: 0.65, stagger: 0.14, ease: 'power3.out' }, 0.25);
        conns.forEach((p, i) => drawPath(tl, p, 0.55, 0.7 + i * 0.1));
        // lego assembly: blocks drop & snap
        tl.from(blocks.children, {
          y: 120, opacity: 0, scale: 0.85,
          duration: 0.6, stagger: 0.13, ease: 'back.out(1.7)',
        }, 1.0);
      },
    };
  },

  /* S7 user-types */
  'user-types'(stage, scene) {
    const row = el('div', 'ut-row');
    scene.data.types.forEach((t) => {
      const c = el('div', `ut-card ut-card--${t.key} card`);
      c.innerHTML = `<div class="en">${esc(t.en)}</div><div class="ko">${esc(t.ko)}</div><ul>${t.needs.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
      row.appendChild(c);
    });
    const link = svgEl('svg', { class: 'ut-link', viewBox: '0 0 1400 84', preserveAspectRatio: 'none' });
    const merge = [233, 700, 1167].map((x) => {
      const p = svgEl('path', { d: `M${x} 0 C ${x} 50, 700 30, 700 84`, stroke: 'rgba(124,92,255,0.55)', 'stroke-width': 2, fill: 'none' });
      link.appendChild(p); return p;
    });
    const coreDot = el('div', 'chip chip--accent', 'One Infrastructure');
    coreDot.style.cssText = 'font-family:var(--f-display);font-size:21px;padding:14px 30px;';
    const col = el('div', '');
    col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:0;width:100%;';
    col.appendChild(row); col.appendChild(link); col.appendChild(coreDot);
    stage.appendChild(col);
    return {
      enter(tl, _root, cleanups) {
        tl.from(row.children, { y: 70, opacity: 0, duration: 0.7, stagger: 0.15, ease: 'power3.out' }, 0.25);
        merge.forEach((p, i) => drawPath(tl, p, 0.6, 0.85 + i * 0.08));
        tl.from(coreDot, { scale: 0.6, opacity: 0, duration: 0.6, ease: 'back.out(2)' }, 1.25);
        row.querySelectorAll('.ut-card').forEach((c) => cleanups.push(makeMagnetic(c, 10)));
      },
    };
  },

  /* S8 tech-rings */
  'tech-rings'(stage, scene, root) {
    const canvas = addCanvas(root);
    const wrap = el('div', 'rings-wrap');
    const svg = svgEl('svg', { class: 'rings-svg', width: 820, height: 560, viewBox: '0 0 820 560' });
    const ring = svgEl('circle', { cx: 410, cy: 280, r: 236, fill: 'none', stroke: 'rgba(0,229,255,0.4)', 'stroke-width': 1.6 });
    svg.appendChild(ring);
    wrap.appendChild(svg);
    const core = el('div', 'rings-core');
    core.innerHTML = 'AI Infrastructure<small>Core</small>';
    wrap.appendChild(core);
    const items = scene.data.rings.map((r, i) => {
      const ang = (i / scene.data.rings.length) * Math.PI * 2 - Math.PI / 2;
      const item = el('div', 'ring-item');
      const R = 300;
      item.style.left = `calc(50% + ${Math.cos(ang) * R * 1.55}px)`;
      item.style.top = `calc(50% + ${Math.sin(ang) * R * 0.82}px)`;
      item.innerHTML = `<span class="n">${r.n}</span><b>${esc(r.title)}</b><span>${esc(r.sub)}</span>`;
      wrap.appendChild(item);
      return item;
    });
    stage.appendChild(wrap);
    let stopParticles = null;
    return {
      enter(tl, _root, cleanups) {
        stopParticles = ambientParticles(canvas, { count: 500 });
        cleanups.push(() => stopParticles && stopParticles());
        drawPath(tl, ring, 1.3, 0.3);
        tl.from(core, { scale: 0, duration: 0.9, ease: 'elastic.out(1, 0.5)' }, 0.35)
          .from(items, { opacity: 0, scale: 0.5, y: 20, duration: 0.55, stagger: 0.14, ease: 'back.out(1.9)' }, 0.8);
        items.forEach((it, i) => {
          tl.to(it.querySelector('.n'), { boxShadow: '0 0 26px rgba(0,229,255,0.8)', duration: 0.3, yoyo: true, repeat: 1 }, 1.1 + i * 0.14);
        });
      },
    };
  },

  /* S9 tech-vdi */
  'tech-vdi'(stage, scene) {
    const d = scene.data;
    const wrap = el('div', 'vdi-wrap');
    const dia = el('div', 'vdi-diagram');
    const svg = svgEl('svg', { viewBox: '0 0 760 520', preserveAspectRatio: 'none' });
    dia.appendChild(svg);
    const cloud = el('div', 'vdi-cloud glass');
    d.cloud.forEach((c) => cloud.appendChild(el('span', 'chip chip--accent', esc(c))));
    dia.appendChild(cloud);
    const devs = el('div', 'vdi-devices');
    const devIcons = ['remote', 'admin', 'work', 'study', 'chip'];
    d.devices.forEach((name, i) => {
      const dv = el('div', 'vdi-device');
      dv.innerHTML = `<div class="card__icon">${icon(devIcons[i % devIcons.length], 38)}</div><span>${esc(name)}</span>`;
      devs.appendChild(dv);
    });
    dia.appendChild(devs);
    const paths = d.devices.map((_, i) => {
      const x = 60 + (640 / (d.devices.length - 1)) * i;
      const p = svgEl('path', { d: `M380 118 C 380 300, ${x} 320, ${x} 428`, stroke: 'rgba(79,124,255,0.5)', 'stroke-width': 1.7, fill: 'none' });
      svg.appendChild(p); return p;
    });
    wrap.appendChild(dia);
    const cmp = el('div', 'vdi-compare');
    cmp.innerHTML = `
      <div class="cmp glass">${esc(d.compare.left)}</div>
      <div class="eq">=</div>
      <div class="cmp glass">${esc(d.compare.right)}</div>
      <div class="verdict">${esc(d.compare.eq)}</div>`;
    wrap.appendChild(cmp);
    stage.appendChild(wrap);
    return {
      enter(tl) {
        tl.from(cloud, { y: -50, opacity: 0, duration: 0.7, ease: 'power3.out' }, 0.25);
        paths.forEach((p, i) => drawPath(tl, p, 0.7, 0.5 + i * 0.07));
        tl.from(devs.children, { y: 40, opacity: 0, duration: 0.5, stagger: 0.08, ease: 'power3.out' }, 0.8)
          .from(cmp.children[0], { x: -60, opacity: 0, duration: 0.55 }, 1.1)
          .from(cmp.children[2], { x: 60, opacity: 0, duration: 0.55 }, 1.1)
          .from(cmp.children[1], { scale: 0, duration: 0.7, ease: 'elastic.out(1, 0.5)' }, 1.3)
          .from(cmp.children[3], { opacity: 0, y: 16, duration: 0.5 }, 1.55);
      },
    };
  },

  /* S10 gpu-compare */
  'gpu-compare'(stage, scene) {
    const d = scene.data;
    const wrap = el('div', 'gpu-wrap');
    const chart = el('div', 'gpu-chart');
    const mkBar = (cfg, cls) => {
      const box = el('div', `gpu-bar ${cls}`);
      box.innerHTML = `<div class="val">0%</div><div class="bar"></div><div class="lbl">${esc(cfg.label)}</div>`;
      chart.appendChild(box);
      return box;
    };
    const b1 = mkBar(d.before, 'gpu-bar--before');
    const b2 = mkBar(d.after, 'gpu-bar--after');
    wrap.appendChild(chart);
    const vs = el('div', 'gpu-vs');
    d.vs.forEach((v) => {
      const c = el('div', `vs-card glass ${v.hot ? 'hot' : ''}`);
      c.innerHTML = `<b>${esc(v.name)}</b><ul>${v.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`;
      vs.appendChild(c);
    });
    wrap.appendChild(vs);
    stage.appendChild(wrap);
    return {
      enter(tl) {
        const bar1 = b1.querySelector('.bar'), bar2 = b2.querySelector('.bar');
        gsap.set(bar1, { height: 0 }); gsap.set(bar2, { height: 0 });
        tl.to(bar1, { height: '15%', duration: 1.0, ease: 'power2.out' }, 0.35);
        tl.to(bar2, { height: '90%', duration: 1.6, ease: 'power3.inOut' }, 0.55);
        counterTo(tl, b1.querySelector('.val'), d.before.value, { prefix: d.before.prefix || '', suffix: '%', duration: 1.0 }, 0.35);
        counterTo(tl, b2.querySelector('.val'), d.after.value, { suffix: '%', duration: 1.6 }, 0.55);
        tl.from(vs.children, { x: 70, opacity: 0, duration: 0.65, stagger: 0.18, ease: 'power3.out' }, 0.8);
      },
    };
  },

  /* S11 sovereign */
  sovereign(stage, scene) {
    const d = scene.data;
    const wrap = el('div', 'sov-wrap');
    const left = el('div', 'sov-shield');
    const svg = svgEl('svg', { class: 'shield', width: 460, height: 520, viewBox: '0 0 460 520' });
    const shieldPath = svgEl('path', {
      d: 'M230 30 L400 90 V250 C400 370 320 450 230 490 C140 450 60 370 60 250 V90 Z',
      fill: 'rgba(0,229,255,0.05)', stroke: 'rgba(0,229,255,0.65)', 'stroke-width': 2.4,
    });
    svg.appendChild(shieldPath);
    const inner = svgEl('g', {});
    // internal data nodes inside shield
    const dataDots = [[230, 200], [170, 265], [290, 265], [230, 330]].map(([x, y]) => {
      const c = svgEl('circle', { cx: x, cy: y, r: 9, fill: '#00e5ff', opacity: 0.9 });
      inner.appendChild(c); return c;
    });
    const links = [[[230, 200], [170, 265]], [[230, 200], [290, 265]], [[170, 265], [230, 330]], [[290, 265], [230, 330]]].map(([[x1, y1], [x2, y2]]) => {
      const l = svgEl('line', { x1, y1, x2, y2, stroke: 'rgba(0,229,255,0.5)', 'stroke-width': 1.6, class: 'flow-line' });
      inner.appendChild(l); return l;
    });
    svg.appendChild(inner);
    // blocked external arrow
    const blocked = svgEl('g', {});
    blocked.appendChild(svgEl('path', { d: 'M400 160 L 452 130', stroke: 'rgba(255,92,122,0.8)', 'stroke-width': 2.4, 'stroke-dasharray': '6 6' }));
    blocked.appendChild(svgEl('circle', { cx: 430, cy: 143, r: 14, fill: 'none', stroke: '#ff5c7a', 'stroke-width': 2.4 }));
    blocked.appendChild(svgEl('line', { x1: 420, y1: 153, x2: 440, y2: 133, stroke: '#ff5c7a', 'stroke-width': 2.4 }));
    svg.appendChild(blocked);
    left.appendChild(svg);
    const label = el('div', 'chip chip--accent', '대학 내부 데이터');
    label.style.cssText = 'position:absolute;bottom:6%;left:50%;transform:translateX(-50%);';
    left.appendChild(label);
    wrap.appendChild(left);

    const right = el('div', 'sov-right');
    d.modules.forEach((m) => {
      const row = el('div', 'sov-mod glass');
      row.innerHTML = `<b>${esc(m.name)}</b><span>${esc(m.desc)}</span>`;
      right.appendChild(row);
    });
    const dn = el('div', 'sov-daynight');
    dn.innerHTML = `
      <div class="sov-dn sov-dn--day glass"><b>☀ 주간</b><span>${esc(d.dayNight.day)}</span></div>
      <div class="sov-dn sov-dn--night glass"><b>☾ 야간</b><span>${esc(d.dayNight.night)}</span></div>`;
    right.appendChild(dn);
    wrap.appendChild(right);
    stage.appendChild(wrap);
    return {
      enter(tl) {
        drawPath(tl, shieldPath, 1.4, 0.3);
        tl.from(dataDots, { scale: 0, transformOrigin: '50% 50%', duration: 0.5, stagger: 0.1, ease: 'back.out(2)' }, 1.0)
          .from(blocked, { opacity: 0, duration: 0.5 }, 1.4)
          .from(label, { opacity: 0, y: 14, duration: 0.5 }, 1.2)
          .from(right.querySelectorAll('.sov-mod'), { x: 70, opacity: 0, duration: 0.6, stagger: 0.15, ease: 'power3.out' }, 0.6)
          .from(dn.children, { y: 30, opacity: 0, duration: 0.5, stagger: 0.12 }, 1.5);
      },
    };
  },

  /* S12 case-feature (Jeju sovereign) */
  'case-feature'(stage, scene, root) {
    const d = scene.data;
    root.querySelector('.scene__headline').insertAdjacentElement('beforebegin', el('div', 'case-badge', esc(d.badge)));
    const col = el('div', 'feat-col');
    d.features.forEach((f, i) => {
      const row = el('div', 'feat-row glass');
      row.innerHTML = `<span class="idx">0${i + 1}</span><b>${esc(f.title)}</b><span>${esc(f.desc)}</span>`;
      col.appendChild(row);
    });
    stage.appendChild(col);
    return {
      enter(tl) {
        tl.from(col.children, { x: -80, opacity: 0, duration: 0.65, stagger: 0.16, ease: 'power3.out' }, 0.35);
      },
    };
  },

  /* S13 tokenizer */
  tokenizer(stage, scene) {
    const d = scene.data;
    const wrap = el('div', 'tok-wrap');
    const models = el('div', 'tok-models');
    const modelEls = d.models.map((m, i) => {
      const b = el('div', `tok-model glass ${i === 0 ? 'on' : ''}`, esc(m));
      models.appendChild(b); return b;
    });
    wrap.appendChild(models);
    const meter = el('div', 'tok-meter');
    meter.innerHTML = `<div class="row"><span>Token Usage</span><span class="val">0</span></div><div class="track"><div class="fill"></div></div>`;
    wrap.appendChild(meter);
    const flows = el('div', 'tok-flows');
    d.flows.forEach((f) => flows.appendChild(el('span', 'chip', esc(f) + ' 비용 배분')));
    wrap.appendChild(flows);
    wrap.appendChild(el('div', 'tok-insight', `${esc(d.insight.split('→')[0].trim())} <span class="arrow">→</span> <b style="color:var(--c-text)">${esc(d.insight.split('→')[1].trim())}</b>`));
    stage.appendChild(wrap);
    let switcher = 0;
    return {
      enter(tl, _root, cleanups) {
        tl.from(models.children, { y: 40, opacity: 0, duration: 0.55, stagger: 0.12, ease: 'power3.out' }, 0.3);
        counterTo(tl, meter.querySelector('.val'), 1284736, { duration: 2.0 }, 0.7);
        tl.to(meter.querySelector('.fill'), { width: '72%', duration: 2.0, ease: 'power2.out' }, 0.7);
        tl.from(flows.children, { scale: 0.6, opacity: 0, duration: 0.45, stagger: 0.1, ease: 'back.out(2)' }, 1.2);
        tl.from(wrap.querySelector('.tok-insight'), { opacity: 0, y: 20, duration: 0.6 }, 1.6);
        // idle: cycle active model
        const iv = setInterval(() => {
          switcher = (switcher + 1) % modelEls.length;
          modelEls.forEach((m, i) => m.classList.toggle('on', i === switcher));
        }, 2200);
        cleanups.push(() => clearInterval(iv));
      },
    };
  },

  /* S14 tstation */
  tstation(stage, scene) {
    const d = scene.data;
    const wrap = el('div', 'tst-wrap');
    const chaos = el('div', 'tst-chaos');
    d.chaos.forEach((c) => chaos.appendChild(el('span', 'chip', '⚠ ' + esc(c))));
    const mid = el('div', 'tst-mid');
    mid.innerHTML = `<div class="core">Tstation</div><small>INFRA AS CODE</small>`;
    const order = el('div', 'tst-order');
    d.order.forEach((o) => order.appendChild(el('span', 'chip', esc(o))));
    wrap.appendChild(chaos); wrap.appendChild(mid); wrap.appendChild(order);
    stage.appendChild(wrap);
    return {
      enter(tl) {
        tl.from(chaos.children, {
          x: () => gsap.utils.random(-90, 90), y: () => gsap.utils.random(-70, 70),
          opacity: 0, rotation: () => gsap.utils.random(-16, 16),
          duration: 0.8, stagger: 0.08, ease: 'power3.out',
        }, 0.3);
        tl.to(chaos.children, { filter: 'blur(1.5px)', opacity: 0.55, duration: 0.7 }, 1.3);
        tl.from(mid, { scale: 0.5, opacity: 0, duration: 0.8, ease: 'back.out(1.8)' }, 1.1);
        tl.from(order.children, { scale: 0.4, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'back.out(2)' }, 1.5);
      },
    };
  },

  /* S15 demo-video */
  'demo-video'(stage, scene) {
    const grid = el('div', 'dv-grid');
    scene.data.videos.forEach((v) => grid.appendChild(videoFrame(v.src, v.label)));
    stage.appendChild(grid);
    return {
      enter(tl, root) {
        tl.from(grid.children, { y: 60, opacity: 0, duration: 0.7, stagger: 0.2, ease: 'power3.out' }, 0.3)
          .call(() => playVideos(root), null, 0.9);
      },
      leave(root) { pauseVideos(root); },
    };
  },

  /* S16/S17 workflow */
  workflow(stage, scene) {
    const d = scene.data;
    const wrap = el('div', 'wf-wrap');
    wrap.appendChild(el('div', 'wf-persona', `PERSONA — ${esc(d.persona)}`));
    const track = el('div', 'wf-track');
    const line = svgEl('svg', { class: 'wf-line', viewBox: '0 0 1200 3', preserveAspectRatio: 'none' });
    const linePath = svgEl('path', { d: 'M0 1.5 H1200', stroke: 'rgba(0,229,255,0.55)', 'stroke-width': 3, fill: 'none' });
    line.appendChild(linePath);
    track.appendChild(line);
    d.steps.forEach((s, i) => {
      const step = el('div', 'wf-step glass');
      step.innerHTML = `<span class="num">${i + 1}</span><b>${esc(s.name)}</b><span>${esc(s.desc)}</span>`;
      track.appendChild(step);
    });
    wrap.appendChild(track);
    stage.appendChild(wrap);
    return {
      enter(tl) {
        drawPath(tl, linePath, 1.2, 0.35);
        tl.from(track.querySelectorAll('.wf-step'), { y: 60, opacity: 0, duration: 0.6, stagger: 0.2, ease: 'back.out(1.5)' }, 0.5);
      },
    };
  },

  /* S18 split-flow */
  'split-flow'(stage, scene) {
    const d = scene.data;
    const wrap = el('div', 'sf-wrap');
    const mkSide = (side, cls) => {
      const s = el('div', `sf-side sf-side--${cls} glass`);
      s.innerHTML = `<b>${esc(side.name)}</b><span>${esc(side.desc)}</span>`;
      return s;
    };
    const arrows = (flip) => {
      const svg = svgEl('svg', { class: 'sf-arrows', viewBox: '0 0 90 200' });
      [40, 100, 160].forEach((y) => {
        const p = svgEl('path', {
          d: flip ? `M90 ${y} L8 ${y} M20 ${y - 8} 8 ${y} 20 ${y + 8}` : `M0 ${y} L82 ${y} M70 ${y - 8} 82 ${y} 70 ${y + 8}`,
          stroke: 'rgba(0,229,255,0.6)', 'stroke-width': 2, fill: 'none',
        });
        svg.appendChild(p);
      });
      return svg;
    };
    const center = el('div', 'sf-center');
    d.center.forEach((c) => center.appendChild(el('div', 'chip chip--accent', esc(c))));
    wrap.appendChild(mkSide(d.left, 'internal'));
    wrap.appendChild(arrows(false));
    wrap.appendChild(center);
    wrap.appendChild(arrows(true));
    wrap.appendChild(mkSide(d.right, 'external'));
    stage.appendChild(wrap);
    return {
      enter(tl) {
        tl.from(wrap.children[0], { x: -70, opacity: 0, duration: 0.6 }, 0.3)
          .from(wrap.children[4], { x: 70, opacity: 0, duration: 0.6 }, 0.3)
          .from([wrap.children[1], wrap.children[3]], { opacity: 0, duration: 0.6 }, 0.7)
          .from(center.children, { scale: 0.6, opacity: 0, duration: 0.5, stagger: 0.12, ease: 'back.out(2)' }, 0.85);
      },
    };
  },

  /* S19 before-after (synergy) */
  'before-after'(stage, scene, root) {
    const d = scene.data;
    const canvas = addCanvas(root);
    const wrap = el('div', 'ba-wrap');
    const scattered = el('div', 'ba-scattered');
    const chipPos = [[6, 8], [58, 2], [20, 40], [64, 42], [8, 76], [55, 80]];
    d.scattered.forEach((s, i) => {
      const c = el('span', 'chip', esc(s));
      c.style.left = `${chipPos[i % chipPos.length][0]}%`;
      c.style.top = `${chipPos[i % chipPos.length][1]}%`;
      scattered.appendChild(c);
    });
    const core = el('div', 'ba-core');
    core.innerHTML = `통합 패키지<small>Single Integrated Package</small>`;
    const effects = el('div', 'ba-effects');
    d.effects3.forEach((e2) => {
      effects.appendChild(el('div', 'ba-effect', `<span class="lbl">${esc(e2.label)}</span><span class="word">${esc(e2.word)}</span>`));
    });
    wrap.appendChild(scattered); wrap.appendChild(core); wrap.appendChild(effects);
    stage.appendChild(wrap);
    let stop = null;
    return {
      enter(tl, _root, cleanups) {
        stop = convergenceParticles(canvas, { cx: 930, cy: 560, radius: 190, count: 900 });
        cleanups.push(() => stop && stop());
        tl.from(scattered.children, { opacity: 0, scale: 0.6, duration: 0.5, stagger: 0.09 }, 0.3);
        // scattered chips get pulled toward core
        tl.to(scattered.children, {
          x: 330, y: (i) => 190 - (chipPos[i % chipPos.length][1] * 4.2),
          opacity: 0.0, scale: 0.4,
          duration: 1.1, stagger: 0.07, ease: 'power2.in',
        }, 1.0);
        tl.from(core, { scale: 0, duration: 1.0, ease: 'elastic.out(1, 0.45)' }, 1.7);
        tl.from(effects.children, { x: 70, opacity: 0, duration: 0.6, stagger: 0.16, ease: 'power3.out' }, 2.2);
      },
    };
  },

  /* S20 orbit-platform */
  'orbit-platform'(stage, scene) {
    const d = scene.data;
    const wrap = el('div', 'op-wrap');
    const svg = svgEl('svg', { class: 'op-ring', width: 900, height: 560, viewBox: '0 0 900 560' });
    const ring = svgEl('ellipse', { cx: 450, cy: 280, rx: 380, ry: 218, fill: 'none', stroke: 'rgba(244,181,63,0.45)', 'stroke-width': 1.8 });
    svg.appendChild(ring);
    wrap.appendChild(svg);
    const core = el('div', 'op-core');
    core.innerHTML = `All-in-One<br/>Education Platform`;
    wrap.appendChild(core);
    const items = d.orbit.map((label, i) => {
      const ang = (i / d.orbit.length) * Math.PI * 2 - Math.PI / 2;
      const item = el('div', 'op-item glass', esc(label));
      item.style.left = `calc(50% + ${Math.cos(ang) * 380}px)`;
      item.style.top = `calc(50% + ${Math.sin(ang) * 218}px)`;
      wrap.appendChild(item);
      return item;
    });
    stage.appendChild(wrap);
    return {
      enter(tl) {
        drawPath(tl, ring, 1.3, 0.3);
        tl.from(core, { scale: 0, duration: 0.9, ease: 'elastic.out(1, 0.5)' }, 0.4)
          .from(items, { opacity: 0, scale: 0.4, duration: 0.55, stagger: 0.12, ease: 'back.out(2)' }, 0.8);
      },
    };
  },

  /* S21 ui-modules (CAS) */
  'ui-modules'(stage, scene) {
    const d = scene.data;
    const frame = el('div', 'um-frame');
    frame.innerHTML = `<div class="um-head"><i></i><i></i><i></i><span>CAS — Class As a Service</span></div>`;
    const body = el('div', 'um-body');
    const nav = el('div', 'um-nav');
    const content = el('div', 'um-content');
    const items = d.modules.map((m, i) => {
      const n = el('div', `nav-item ${i === 0 ? 'on' : ''}`, esc(m.name));
      nav.appendChild(n); return n;
    });
    const renderContent = (m) => {
      content.innerHTML = `<h5>${esc(m.name)}</h5><p>${esc(m.desc)}</p>
        <div class="um-mock"><div class="line" style="width:82%"></div><div class="line" style="width:64%"></div><div class="line" style="width:74%"></div><div class="line" style="width:40%"></div></div>`;
    };
    renderContent(d.modules[0]);
    body.appendChild(nav); body.appendChild(content);
    frame.appendChild(body);
    stage.appendChild(frame);
    let active = 0;
    const select = (i) => {
      active = i;
      items.forEach((n, j) => n.classList.toggle('on', j === i));
      renderContent(d.modules[i]);
      gsap.from(content.children, { y: 14, opacity: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' });
    };
    items.forEach((n, i) => n.addEventListener('click', () => select(i)));
    return {
      enter(tl, _root, cleanups) {
        tl.from(frame, { y: 60, opacity: 0, duration: 0.8, ease: 'power3.out' }, 0.3)
          .from(nav.children, { x: -30, opacity: 0, duration: 0.4, stagger: 0.08 }, 0.7);
        const iv = setInterval(() => select((active + 1) % d.modules.length), 2600);
        cleanups.push(() => clearInterval(iv));
      },
    };
  },

  /* S22 cbt-secure */
  'cbt-secure'(stage, scene) {
    const d = scene.data;
    const wrap = el('div', 'cbt-wrap');
    const vids = el('div', 'cbt-videos');
    d.videos.forEach((v) => vids.appendChild(videoFrame(v.src, v.label)));
    wrap.appendChild(vids);
    const side = el('div', 'cbt-side');
    const allow = el('div', 'cbt-list cbt-list--allow glass');
    allow.innerHTML = `<h6>${icon('check', 22)} 허용</h6><ul>${d.allowed.map((a) => `<li class="chip chip--green">${esc(a)}</li>`).join('')}</ul>`;
    const block = el('div', 'cbt-list cbt-list--block glass');
    block.innerHTML = `<h6>${icon('cross', 22)} 차단</h6><ul>${d.blocked.map((b) => `<li class="chip chip--danger">${esc(b)}</li>`).join('')}</ul>`;
    side.appendChild(allow); side.appendChild(block);
    side.appendChild(el('div', 'cbt-control', `${icon('lock', 20)} ${esc(d.control)}`));
    wrap.appendChild(side);
    stage.appendChild(wrap);
    return {
      enter(tl, root) {
        tl.from(vids.children, { y: 50, opacity: 0, duration: 0.65, stagger: 0.16, ease: 'power3.out' }, 0.3)
          .from(side.children, { x: 70, opacity: 0, duration: 0.6, stagger: 0.15, ease: 'power3.out' }, 0.5)
          .call(() => playVideos(root), null, 1.0);
        tl.from(block.querySelectorAll('.chip'), { scale: 1.25, opacity: 0, duration: 0.35, stagger: 0.1, ease: 'power2.out' }, 1.2);
      },
      leave(root) { pauseVideos(root); },
    };
  },

  /* S23 case-map */
  'case-map'(stage, scene, root) {
    const d = scene.data;
    const map = el('div', 'cmap');
    const svg = svgEl('svg', { viewBox: '0 0 1150 560' });
    map.appendChild(svg);
    // connective constellation between universities
    const pts = d.nodes.map((n) => [n.x * 11.5, n.y * 5.6]);
    const paths = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const p = svgEl('path', { d: `M${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 - 44} ${x2} ${y2}`, stroke: 'rgba(79,124,255,0.5)', 'stroke-width': 1.7, fill: 'none' });
      svg.appendChild(p); paths.push(p);
    }
    const nodes = d.nodes.map((n, i) => {
      const node = el('div', 'diagram-node');
      node.style.left = `${n.x}%`; node.style.top = `${n.y}%`;
      node.dataset.depth = (0.015 + i * 0.007).toFixed(3);
      node.innerHTML = `<div class="diagram-node__dot"></div><div class="diagram-node__label">${esc(n.name)}</div>`;
      map.appendChild(node);
      return node;
    });
    stage.appendChild(map);
    return {
      enter(tl, _root, cleanups) {
        paths.forEach((p, i) => drawPath(tl, p, 0.55, 0.4 + i * 0.14));
        tl.from(nodes, { opacity: 0, scale: 0.4, duration: 0.5, stagger: 0.13, ease: 'back.out(2)' }, 0.5);
        nodes.forEach((n, i) => {
          tl.to(n.querySelector('.diagram-node__dot'), { boxShadow: '0 0 30px rgba(0,229,255,0.9)', duration: 0.28, yoyo: true, repeat: 1 }, 1.2 + i * 0.14);
        });
        cleanups.push(mouseParallax(root));
      },
    };
  },

  /* S24 case-timeline (Sogang) */
  'case-timeline'(stage, scene, root) {
    const d = scene.data;
    root.querySelector('.scene__headline').insertAdjacentElement('beforebegin', el('div', 'case-badge', esc(d.univ)));
    const wrap = el('div', 'ctl-wrap');
    const lineSvg = svgEl('svg', { class: 'ctl-line', viewBox: '0 0 3 400', preserveAspectRatio: 'none' });
    const lp = svgEl('path', { d: 'M1.5 0 V400', stroke: 'rgba(0,229,255,0.5)', 'stroke-width': 3, fill: 'none' });
    lineSvg.appendChild(lp);
    wrap.appendChild(lineSvg);
    d.timeline.forEach((t) => {
      const item = el('div', 'ctl-item');
      item.innerHTML = `<div class="ctl-year">${esc(t.year)}</div><div class="ctl-body glass"><b>${esc(t.label)}</b><span>${esc(t.desc)}</span></div>`;
      wrap.appendChild(item);
    });
    stage.appendChild(wrap);
    return {
      enter(tl) {
        drawPath(tl, lp, 1.0, 0.35);
        tl.from(wrap.querySelectorAll('.ctl-item'), { x: -70, opacity: 0, duration: 0.7, stagger: 0.28, ease: 'power3.out' }, 0.5);
      },
    };
  },

  /* S25 case-stats (Jeju) */
  'case-stats'(stage, scene, root) {
    const d = scene.data;
    root.querySelector('.scene__headline').insertAdjacentElement('beforebegin', el('div', 'case-badge', esc(d.univ)));
    const wrap = el('div', 'cs-wrap');
    const stats = el('div', 'cs-stats');
    const statEls = d.stats.map((s) => {
      const box = el('div', 'cs-stat glass');
      box.innerHTML = `<div class="v">0</div><div class="l">${esc(s.label)}</div>`;
      stats.appendChild(box);
      return box;
    });
    wrap.appendChild(stats);
    const right = el('div', 'cs-3a');
    const aRow = el('div', 'a-row');
    d.threeA.forEach((a) => aRow.appendChild(el('span', 'a-chip', esc(a))));
    right.appendChild(aRow);
    const ul = el('ul', 'cs-points');
    d.points.forEach((p) => ul.appendChild(el('li', '', esc(p))));
    right.appendChild(ul);
    wrap.appendChild(right);
    stage.appendChild(wrap);
    return {
      enter(tl) {
        tl.from(stats.children, { y: 50, opacity: 0, duration: 0.6, stagger: 0.16 }, 0.3);
        d.stats.forEach((s, i) => {
          counterTo(tl, statEls[i].querySelector('.v'), s.value, { suffix: s.suffix, prefix: s.approx ? '약 ' : '', duration: 1.7 }, 0.5 + i * 0.2);
        });
        tl.from(aRow.children, { scale: 0.4, opacity: 0, duration: 0.55, stagger: 0.14, ease: 'back.out(2)' }, 0.8)
          .from(ul.children, { x: 50, opacity: 0, duration: 0.5, stagger: 0.12 }, 1.2);
      },
    };
  },

  /* S26 case-security (Dong-A) */
  'case-security'(stage, scene, root) {
    const d = scene.data;
    root.querySelector('.scene__headline').insertAdjacentElement('beforebegin', el('div', 'case-badge', esc(d.univ)));
    const wrap = el('div', 'csec-wrap');
    const net = el('div', 'csec-net glass');
    net.innerHTML = `<b>${esc(d.network)}</b><span>가상GPU 기반 설계 · AI 모델링 원격 실습</span>`;
    wrap.appendChild(net);
    const grid = el('div', 'csec-grid');
    d.compliance.forEach((c) => {
      const row = el('div', 'csec-item glass');
      row.innerHTML = `<div class="card__icon">${icon('shield', 34)}</div><b>${esc(c)}</b><span class="chip chip--green" style="margin-left:auto">ISMS-P</span>`;
      grid.appendChild(row);
    });
    grid.appendChild(el('div', 'csec-benefit', esc(d.benefit)));
    wrap.appendChild(grid);
    stage.appendChild(wrap);
    return {
      enter(tl) {
        tl.from(net, { x: -70, opacity: 0, duration: 0.65 }, 0.3)
          .from(grid.children, { x: 70, opacity: 0, duration: 0.55, stagger: 0.14, ease: 'power3.out' }, 0.5);
      },
    };
  },

  /* S27 case-morph (Baekseok) */
  'case-morph'(stage, scene, root) {
    const d = scene.data;
    root.querySelector('.scene__headline').insertAdjacentElement('beforebegin', el('div', 'case-badge', esc(d.univ)));
    const container = el('div', '');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;';
    const wrap = el('div', 'cm-wrap');
    const oldBox = el('div', 'cm-box cm-box--old glass');
    oldBox.innerHTML = `<b>${esc(d.before)}</b><div class="cm-sw"><span class="chip">저사양</span><span class="chip">노후 장비</span></div>`;
    const arrow = el('div', 'cm-arrow', '<svg width="60" height="40" viewBox="0 0 60 40" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M2 20h50m0 0-12-12m12 12-12 12"/></svg>');
    const newBox = el('div', 'cm-box cm-box--new glass');
    newBox.innerHTML = `<b>${esc(d.after)}</b><div class="cm-sw">${d.sw.map((s) => `<span class="chip chip--accent">${esc(s)}</span>`).join('')}</div>`;
    wrap.appendChild(oldBox); wrap.appendChild(arrow); wrap.appendChild(newBox);
    container.appendChild(wrap);
    container.appendChild(el('div', 'cm-ctx', esc(d.context)));
    stage.appendChild(container);
    return {
      enter(tl) {
        tl.from(oldBox, { x: -60, opacity: 0, duration: 0.6 }, 0.3)
          .from(arrow, { opacity: 0, x: -16, duration: 0.5 }, 0.7)
          .from(newBox, { x: 60, opacity: 0, scale: 0.92, duration: 0.7, ease: 'back.out(1.6)' }, 0.85)
          .from(newBox.querySelectorAll('.chip'), { scale: 0.4, opacity: 0, duration: 0.45, stagger: 0.1, ease: 'back.out(2)' }, 1.2)
          .from(container.querySelector('.cm-ctx'), { opacity: 0, duration: 0.5 }, 1.5);
      },
    };
  },

  /* S28 case-validation (Sangmyung) */
  'case-validation'(stage, scene, root) {
    const d = scene.data;
    root.querySelector('.scene__headline').insertAdjacentElement('beforebegin', el('div', 'case-badge', esc(d.univ)));
    const wrap = el('div', 'cv-wrap');
    const flow = el('div', 'cv-flow');
    d.flow.forEach((f, i) => {
      const node = el('div', 'cv-node glass');
      node.innerHTML = `<b>${esc(f.name)}</b><span>${esc(f.desc)}</span>`;
      flow.appendChild(node);
      if (i === 0) flow.appendChild(el('div', 'cm-arrow', '<svg width="50" height="34" viewBox="0 0 50 34" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M2 17h40m0 0-10-10m10 10-10 10"/></svg>'));
    });
    wrap.appendChild(flow);
    const os = el('div', 'cv-os');
    const osEls = d.os.map((o, i) => {
      const b = el('div', `os glass ${i === 0 ? 'on' : ''}`, esc(o));
      os.appendChild(b); return b;
    });
    wrap.appendChild(os);
    wrap.appendChild(el('div', 'cv-point', esc(d.point)));
    stage.appendChild(wrap);
    return {
      enter(tl, _root, cleanups) {
        tl.from(flow.children, { y: 40, opacity: 0, duration: 0.6, stagger: 0.18 }, 0.3)
          .from(os.children, { scale: 0.5, opacity: 0, duration: 0.5, stagger: 0.12, ease: 'back.out(2)' }, 0.9)
          .from(wrap.querySelector('.cv-point'), { opacity: 0, y: 16, duration: 0.5 }, 1.2);
        let cur = 0;
        const iv = setInterval(() => {
          cur = (cur + 1) % osEls.length;
          osEls.forEach((o, i) => o.classList.toggle('on', i === cur));
        }, 1800);
        cleanups.push(() => clearInterval(iv));
      },
    };
  },

  /* S29 case-kpi (CUK) */
  'case-kpi'(stage, scene, root) {
    const d = scene.data;
    root.querySelector('.scene__headline').insertAdjacentElement('beforebegin', el('div', 'case-badge', esc(d.univ)));
    const center = el('div', 'kpi-center');
    center.innerHTML = `<div class="big-num">+0%</div><div class="lbl">${esc(d.kpi.label)}</div>`;
    const chips = el('div', 'kpi-chips');
    d.lab.forEach((l) => chips.appendChild(el('span', 'chip', esc(l))));
    center.appendChild(chips);
    stage.appendChild(center);
    return {
      enter(tl) {
        counterTo(tl, center.querySelector('.big-num'), d.kpi.value, { prefix: '+', suffix: '%', decimals: 1, duration: 1.8 }, 0.4);
        tl.from(center.querySelector('.big-num'), { scale: 0.7, duration: 1.8, ease: 'power3.out' }, 0.4)
          .from(center.querySelector('.lbl'), { opacity: 0, y: 18, duration: 0.6 }, 1.0)
          .from(chips.children, { scale: 0.5, opacity: 0, duration: 0.5, stagger: 0.11, ease: 'back.out(2)' }, 1.4);
      },
    };
  },

  /* S30 kpi (total impact) */
  kpi(stage, scene, root) {
    const canvas = addCanvas(root);
    const row = el('div', 'kpi-row');
    const cards = scene.data.kpis.map((k) => {
      const card = el('div', `kpi-card glass ${k.value === null ? 'kpi-card--word' : ''}`);
      const ring = svgEl('svg', { class: 'impact-ring', viewBox: '0 0 100 100' });
      ring.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 44, fill: 'none', stroke: 'rgba(0,229,255,0.12)', 'stroke-width': 0.8 }));
      card.appendChild(ring);
      card.insertAdjacentHTML('beforeend', `<div class="v">${k.value === null ? esc(k.word) : '0'}</div><div class="l">${esc(k.label)}</div>`);
      row.appendChild(card);
      return { card, k };
    });
    stage.appendChild(row);
    let stop = null;
    return {
      enter(tl, _root, cleanups) {
        stop = ambientParticles(canvas, { count: 420 });
        cleanups.push(() => stop && stop());
        tl.from(row.children, { y: 80, opacity: 0, duration: 0.75, stagger: 0.2, ease: 'power3.out' }, 0.3);
        cards.forEach(({ card, k }, i) => {
          if (k.value !== null) {
            counterTo(tl, card.querySelector('.v'), k.value, { suffix: k.suffix, decimals: k.decimals || 0, duration: 1.7 }, 0.6 + i * 0.22);
          } else {
            tl.from(card.querySelector('.v'), { scale: 0.4, opacity: 0, duration: 0.8, ease: 'back.out(1.8)' }, 0.6 + i * 0.22);
          }
          tl.to(card.querySelector('.impact-ring'), { rotation: 180, duration: 12, repeat: -1, ease: 'none' }, 1);
        });
      },
    };
  },

  /* S31 closing */
  closing(stage, scene, root) {
    const d = scene.data;
    root.appendChild(el('div', 'hero-fallback'));
    const holder = el('div', 'scene__canvas');
    root.appendChild(holder);
    const canvas = addCanvas(root);
    const inner = el('div', 'hero-inner');
    inner.innerHTML = `
      <h1 class="scene__headline"><span class="hl">${esc(scene.headline)}</span></h1>
      <p class="hero-sub">${esc(scene.body)}</p>
      <div class="closing-cta">${d.cta.map((c) => `<button class="cta-btn">${esc(c)}</button>`).join('')}</div>
      <div class="closing-thanks">${esc(d.thanks)}</div>
      <div class="hero-logo"><img src="${logoUrl}" alt="Tilon"/></div>`;
    stage.style.display = 'contents';
    root.appendChild(inner);
    let three = null, stop = null;
    return {
      enter(tl, _root, cleanups) {
        three = createNetworkScene(holder, { mode: 'closing' });
        if (three) { three.start(); cleanups.push(() => { three.destroy(); three = null; }); }
        stop = convergenceParticles(canvas, { cx: 960, cy: 430, radius: 260, count: 1000 });
        cleanups.push(() => stop && stop());
        const h = inner.querySelector('.scene__headline');
        const chars = splitChars(h.querySelector('.hl') || h);
        tl.from(chars, { opacity: 0, y: 46, duration: 0.8, stagger: 0.03, ease: 'back.out(1.7)' }, 0.3)
          .from(inner.querySelector('.hero-sub'), { opacity: 0, y: 22, duration: 0.7 }, '-=0.4')
          .from(inner.querySelectorAll('.cta-btn'), { opacity: 0, y: 26, duration: 0.6, stagger: 0.14, ease: 'power3.out' }, '-=0.3')
          .from(inner.querySelector('.closing-thanks'), { opacity: 0, duration: 0.8 }, '-=0.2')
          .from(inner.querySelector('.hero-logo'), { opacity: 0, y: 14, duration: 0.6 }, '-=0.5');
        inner.querySelectorAll('.cta-btn').forEach((b) => cleanups.push(makeMagnetic(b, 16)));
      },
    };
  },
};

/* ───────────────────────── mounting ───────────────────────── */

export function mountScenes(stageEl) {
  return SCENES.map((scene, idx) => {
    const { root, stage } = skeleton(scene, idx);
    const builder = BUILDERS[scene.type];
    let hooks = {};
    if (builder) {
      try { hooks = builder(stage, scene, root) || {}; }
      catch (err) { console.warn('[deck] scene build fallback:', scene.id, err); }
    } else {
      console.warn('[deck] unknown scene type:', scene.type);
    }
    stageEl.appendChild(root);

    let activeTl = null;
    let cleanups = [];

    return {
      scene,
      el: root,
      enter() {
        this.leaveCleanup();
        activeTl = gsap.timeline({ defaults: { overwrite: 'auto' } });
        if (Perf.reducedMotion) {
          activeTl.timeScale(10);
        }
        try {
          baseIn(activeTl, root);
          if (hooks.enter) hooks.enter(activeTl, root, cleanups);
        } catch (err) {
          console.warn('[deck] scene enter fallback:', scene.id, err);
          gsap.set(root.querySelectorAll('.scene__kicker,.scene__headline,.scene__body,.scene__stage'), { clearProps: 'all', opacity: 1 });
        }
      },
      leaveCleanup() {
        if (activeTl) { activeTl.kill(); activeTl = null; }
        cleanups.forEach((fn) => { try { fn(); } catch { /* noop */ } });
        cleanups = [];
        if (hooks.leave) { try { hooks.leave(root); } catch { /* noop */ } }
        pauseVideos(root);
      },
    };
  });
}

export { SCENES, SECTIONS, sectionOf, DECK };
