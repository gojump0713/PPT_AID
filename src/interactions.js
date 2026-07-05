// interactions.js — shared interaction/effect primitives used by scene builders
import { gsap } from 'gsap';

/** create element helper */
export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}
export function svgEl(tag, attrs = {}) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

/** escape text */
export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** headline with accent keywords wrapped */
export function accentify(text, keywords = [], cls = 'hl') {
  let out = esc(text);
  for (const kw of keywords) {
    const k = esc(kw);
    if (out.includes(k)) out = out.replace(k, `<span class="${cls}">${k}</span>`);
  }
  return out;
}

/** SVG path draw-in (returns tween target setup; call in scene timeline) */
export function preparePathDraw(path) {
  const len = path.getTotalLength ? path.getTotalLength() : 300;
  path.style.strokeDasharray = `${len}`;
  path.style.strokeDashoffset = `${len}`;
  return len;
}
export function drawPath(tl, path, dur = 1.1, pos = '<') {
  preparePathDraw(path);
  tl.to(path, { strokeDashoffset: 0, duration: dur, ease: 'power2.inOut' }, pos);
}

/** count-up number */
export function counterTo(tl, node, value, { decimals = 0, prefix = '', suffix = '', duration = 1.6 } = {}, pos = '<') {
  const state = { v: 0 };
  tl.to(state, {
    v: value,
    duration,
    ease: 'power2.out',
    onUpdate() {
      node.textContent = prefix + state.v.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
    },
  }, pos);
}

/** text scramble-in */
const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function scrambleTo(tl, node, finalText, { duration = 1.0 } = {}, pos = '<') {
  const state = { p: 0 };
  tl.to(state, {
    p: 1,
    duration,
    ease: 'power2.out',
    onUpdate() {
      const n = Math.floor(finalText.length * state.p);
      let out = finalText.slice(0, n);
      for (let i = n; i < finalText.length; i++) {
        out += finalText[i] === ' ' || finalText[i] === '\n'
          ? finalText[i]
          : SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
      }
      node.textContent = out;
    },
    onComplete() { node.textContent = finalText; },
  }, pos);
}

/** kinetic typography: split into chars and stagger */
export function splitChars(node) {
  const text = node.textContent;
  node.textContent = '';
  node.setAttribute('aria-label', text);
  const spans = [];
  for (const ch of text) {
    const s = el('span');
    s.textContent = ch;
    s.style.display = 'inline-block';
    s.style.whiteSpace = 'pre';
    s.setAttribute('aria-hidden', 'true');
    node.appendChild(s);
    spans.push(s);
  }
  return spans;
}

/** typing effect */
export function typeIn(tl, node, text, { cps = 26 } = {}, pos = '<') {
  const state = { n: 0 };
  node.textContent = '';
  node.classList.add('type-caret');
  tl.to(state, {
    n: text.length,
    duration: text.length / cps,
    ease: 'none',
    onUpdate() { node.textContent = text.slice(0, Math.floor(state.n)); },
    onComplete() { node.classList.remove('type-caret'); },
  }, pos);
}

/** magnetic hover (cards/buttons) — registered per scene, cleaned on leave */
export function makeMagnetic(node, strength = 14) {
  const onMove = (e) => {
    const r = node.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    gsap.to(node, { x: dx * strength, y: dy * strength, rotateX: -dy * 3, rotateY: dx * 3, duration: 0.4, ease: 'power2.out' });
  };
  const onLeave = () => gsap.to(node, { x: 0, y: 0, rotateX: 0, rotateY: 0, duration: 0.6, ease: 'elastic.out(1, 0.55)' });
  node.addEventListener('mousemove', onMove);
  node.addEventListener('mouseleave', onLeave);
  return () => {
    node.removeEventListener('mousemove', onMove);
    node.removeEventListener('mouseleave', onLeave);
  };
}

/** mouse parallax layers within a scene: elements with data-depth */
export function mouseParallax(sceneEl) {
  const layers = sceneEl.querySelectorAll('[data-depth]');
  if (!layers.length) return () => {};
  const onMove = (e) => {
    const cx = (e.clientX / window.innerWidth - 0.5) * 2;
    const cy = (e.clientY / window.innerHeight - 0.5) * 2;
    layers.forEach((l) => {
      const d = parseFloat(l.dataset.depth || '0.03');
      gsap.to(l, { x: -cx * d * 100, y: -cy * d * 60, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
    });
  };
  window.addEventListener('mousemove', onMove);
  return () => window.removeEventListener('mousemove', onMove);
}

/** inline icon set (stroke style, currentColor) */
export const ICONS = {
  work: '<path d="M9 14h26a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V17a3 3 0 0 1 3-3Z"/><path d="M16 14v-3a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3M6 24h32"/>',
  study: '<path d="M22 8 4 16l18 8 18-8-18-8Z"/><path d="M12 20v10c0 3 20 3 20 0V20"/>',
  admin: '<rect x="7" y="6" width="30" height="32" rx="3"/><path d="M14 15h16M14 22h16M14 29h9"/>',
  research: '<circle cx="19" cy="19" r="11"/><path d="m27 27 11 11"/>',
  student: '<circle cx="22" cy="14" r="7"/><path d="M8 38c2-8 7-12 14-12s12 4 14 12"/>',
  professor: '<circle cx="22" cy="13" r="6"/><path d="M10 38c2-7 6-10 12-10s10 3 12 10M14 24l8 4 8-4"/>',
  operator: '<rect x="6" y="8" width="32" height="20" rx="2"/><path d="M16 36h12M22 28v8"/>',
  scatter: '<circle cx="10" cy="12" r="4"/><circle cx="32" cy="9" r="3.4"/><circle cx="14" cy="32" r="3.4"/><circle cx="34" cy="30" r="4.6"/><path d="M13 15l16-4M16 29l15-12" stroke-dasharray="3 4"/>',
  gpu: '<rect x="6" y="12" width="32" height="20" rx="2.5"/><path d="M12 12V7M20 12V7M28 12V7M12 37v-5M20 37v-5M28 37v-5"/><rect x="13" y="18" width="10" height="8" rx="1.4"/>',
  remote: '<rect x="5" y="8" width="22" height="16" rx="2"/><rect x="27" y="18" width="12" height="18" rx="2.4"/><path d="M11 32h10"/>',
  shield: '<path d="M22 5 8 10v10c0 9 6 15.5 14 19 8-3.5 14-10 14-19V10L22 5Z"/><path d="m16 21 4.5 4.5L30 16"/>',
  cloud: '<path d="M32 32H13a7 7 0 0 1-1-13.9A10 10 0 0 1 31.6 16 8 8 0 0 1 32 32Z"/>',
  lock: '<rect x="10" y="19" width="24" height="18" rx="3"/><path d="M15 19v-5a7 7 0 0 1 14 0v5M22 27v4"/>',
  check: '<circle cx="22" cy="22" r="17"/><path d="m14 22 6 6 11-12"/>',
  cross: '<circle cx="22" cy="22" r="17"/><path d="m16 16 12 12M28 16 16 28"/>',
  chip: '<rect x="12" y="12" width="20" height="20" rx="3"/><path d="M22 4v8M13 4v8M31 4v8M22 32v8M13 32v8M31 32v8M4 22h8M4 13h8M4 31h8M32 22h8M32 13h8M32 31h8" transform="translate(0 0) scale(0.95)"/>',
  doc: '<path d="M12 5h14l8 8v26H12V5Z"/><path d="M26 5v9h9M17 22h11M17 29h11"/>',
  play: '<circle cx="22" cy="22" r="17"/><path d="m18 15 12 7-12 7V15Z"/>',
};
export function icon(name, size = 44) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.chip}</svg>`;
}
