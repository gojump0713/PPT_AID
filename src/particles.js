// particles.js — canvas 2D particle systems (accent layers, convergence)
import { Perf } from './performance.js';

/** ambient drifting particles on a scene canvas; returns stop() */
export function ambientParticles(canvas, { count = 900, hueA = 187, hueB = 225 } = {}) {
  if (Perf.quiet) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const W = (canvas.width = 1920);
  const H = (canvas.height = 1080);
  const ps = Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: 0.5 + Math.random() * 1.9,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    a: 0.08 + Math.random() * 0.4,
    h: Math.random() < 0.6 ? hueA : hueB,
  }));
  let raf = 0, running = true;
  let mx = W / 2, my = H / 2;
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    mx = ((e.clientX - r.left) / r.width) * W;
    my = ((e.clientY - r.top) / r.height) * H;
  };
  window.addEventListener('mousemove', onMove);
  const step = () => {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy;
      const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
      if (d2 < 16000 && d2 > 1) { const f = 26 / d2; p.x += dx * f; p.y += dy * f; }
      if (p.x < -8) p.x = W + 8; else if (p.x > W + 8) p.x = -8;
      if (p.y < -8) p.y = H + 8; else if (p.y > H + 8) p.y = -8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fillStyle = `hsla(${p.h},100%,64%,${p.a})`;
      ctx.fill();
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('mousemove', onMove);
    ctx.clearRect(0, 0, W, H);
  };
}

/** particles converge from edges into a target region (closing / synergy) */
export function convergenceParticles(canvas, { count = 1200, cx = 960, cy = 470, radius = 220 } = {}) {
  if (Perf.quiet) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const W = (canvas.width = 1920);
  const H = (canvas.height = 1080);
  const ps = Array.from({ length: count }, () => {
    const edge = Math.random();
    let x, y;
    if (edge < 0.25) { x = -12; y = Math.random() * H; }
    else if (edge < 0.5) { x = W + 12; y = Math.random() * H; }
    else if (edge < 0.75) { x = Math.random() * W; y = -12; }
    else { x = Math.random() * W; y = H + 12; }
    const ang = Math.random() * Math.PI * 2;
    const rr = radius * (0.35 + Math.random() * 0.65);
    return {
      x, y,
      tx: cx + Math.cos(ang) * rr,
      ty: cy + Math.sin(ang) * rr * 0.62,
      r: 0.6 + Math.random() * 2,
      a: 0.14 + Math.random() * 0.5,
      sp: 0.006 + Math.random() * 0.02,
      h: Math.random() < 0.65 ? 187 : 258,
      orbit: Math.random() * Math.PI * 2,
    };
  });
  let raf = 0, running = true, t = 0;
  const step = () => {
    if (!running) return;
    t += 0.016;
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.x += (p.tx - p.x) * p.sp * 3;
      p.y += (p.ty - p.y) * p.sp * 3;
      p.orbit += p.sp * 2;
      const ox = Math.cos(p.orbit) * 6, oy = Math.sin(p.orbit) * 4;
      ctx.beginPath();
      ctx.arc(p.x + ox, p.y + oy, p.r, 0, 6.2832);
      ctx.fillStyle = `hsla(${p.h},100%,66%,${p.a})`;
      ctx.fill();
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => { running = false; cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); };
}
