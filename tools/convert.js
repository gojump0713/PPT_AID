/**
 * PPTX → HTML converter for ScrollDeck Pro (PPT_AID)
 * Reads an extracted .pptx directory and emits js/content.js with
 * per-slide absolutely-positioned 1920x1080 HTML + metadata + notes.
 *
 * Usage: node convert.js <extracted-pptx-dir> <output-repo-dir>
 */
const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) { console.error('usage: node convert.js <pptx-dir> <repo-dir>'); process.exit(1); }

const EMU = 6350; // EMU per px at 1920x1080 for 12192000 EMU width

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  trimValues: false,
});

// ---------- ordered-tree helpers ----------
function tagName(node) { return Object.keys(node).find(k => k !== ':@'); }
function attrs(node) { return node[':@'] || {}; }
function kids(node) { const t = tagName(node); return t ? (node[t] || []) : []; }
function child(node, name) { return kids(node).find(n => tagName(n) === name); }
function childAll(node, name) { return kids(node).filter(n => tagName(n) === name); }
function descend(node, ...names) {
  let cur = node;
  for (const n of names) { if (!cur) return undefined; cur = child(cur, n); }
  return cur;
}
function textOf(node) { // concatenated #text of direct children
  if (!node) return '';
  return kids(node).filter(n => tagName(n) === '#text').map(n => n['#text']).join('');
}
function parseXml(file) {
  const arr = parser.parse(fs.readFileSync(file, 'utf8'));
  return arr.find(n => tagName(n) !== '?xml');
}

// ---------- theme colors ----------
const themeRoot = parseXml(path.join(SRC, 'ppt/theme/theme1.xml'));
const clrScheme = descend(themeRoot, 'a:themeElements', 'a:clrScheme');
const THEME = {};
if (clrScheme) {
  for (const c of kids(clrScheme)) {
    const name = tagName(c).replace('a:', '');
    const srgb = child(c, 'a:srgbClr');
    const sys = child(c, 'a:sysClr');
    THEME[name] = srgb ? attrs(srgb).val : (sys ? (attrs(sys).lastClr || 'FFFFFF') : 'FFFFFF');
  }
}
// clrMap (master): bg1->lt1 tx1->dk1 bg2->lt2 tx2->dk2 by default
const CLRMAP = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}
function rgbToCss([r, g, b], alpha) {
  r = Math.round(clamp(r, 0, 255)); g = Math.round(clamp(g, 0, 255)); b = Math.round(clamp(b, 0, 255));
  if (alpha === undefined || alpha >= 1) return `rgb(${r},${g},${b})`;
  return `rgba(${r},${g},${b},${+alpha.toFixed(3)})`;
}
// resolve a color element (a:srgbClr / a:schemeClr / a:sysClr / a:prstClr) with modifiers
const PRST_CLR = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080' };
function resolveColorNode(cnode) {
  if (!cnode) return null;
  const t = tagName(cnode);
  let hex = null;
  if (t === 'a:srgbClr') hex = attrs(cnode).val;
  else if (t === 'a:schemeClr') {
    let v = attrs(cnode).val;
    if (CLRMAP[v]) v = CLRMAP[v];
    hex = THEME[v] || '000000';
  } else if (t === 'a:sysClr') hex = attrs(cnode).lastClr || '000000';
  else if (t === 'a:prstClr') hex = PRST_CLR[attrs(cnode).val] || '808080';
  if (!hex) return null;
  let rgb = hexToRgb(hex);
  let alpha = 1;
  for (const m of kids(cnode)) {
    const mt = tagName(m); if (!mt || mt === '#text') continue;
    const val = attrs(m).val !== undefined ? Number(attrs(m).val) : undefined;
    switch (mt) {
      case 'a:alpha': alpha = val / 100000; break;
      case 'a:shade': rgb = rgb.map(c => c * val / 100000); break;
      case 'a:tint': rgb = rgb.map(c => 255 - (255 - c) * val / 100000); break;
      case 'a:lumMod': rgb = rgb.map(c => c * val / 100000); break;
      case 'a:lumOff': rgb = rgb.map(c => c + 255 * val / 100000); break;
      case 'a:satMod': { // approximate: move away from gray
        const g = (rgb[0] + rgb[1] + rgb[2]) / 3, f = val / 100000;
        rgb = rgb.map(c => g + (c - g) * f); break;
      }
    }
  }
  return { css: rgbToCss(rgb, alpha), rgb, alpha };
}
function firstColorNode(node) {
  if (!node) return undefined;
  return kids(node).find(n => ['a:srgbClr', 'a:schemeClr', 'a:sysClr', 'a:prstClr'].includes(tagName(n)));
}

// ---------- fills ----------
function gradientCss(gradFill) {
  const gsLst = child(gradFill, 'a:gsLst');
  if (!gsLst) return null;
  const stops = childAll(gsLst, 'a:gs').map(gs => ({
    pos: Number(attrs(gs).pos) / 1000, // percent
    color: resolveColorNode(firstColorNode(gs)),
  })).filter(s => s.color).sort((a, b) => a.pos - b.pos);
  if (!stops.length) return null;
  const lin = child(gradFill, 'a:lin');
  let angleCss = 180; // pptx ang 5400000 (=90deg, top->bottom) -> css 180deg
  if (lin && attrs(lin).ang !== undefined) {
    const deg = Number(attrs(lin).ang) / 60000;
    angleCss = (deg + 90) % 360;
  }
  const path = child(gradFill, 'a:path');
  const stopsCss = stops.map(s => `${s.color.css} ${+s.pos.toFixed(2)}%`).join(', ');
  if (path && attrs(path).path === 'circle') return `radial-gradient(circle, ${stopsCss})`;
  return `linear-gradient(${angleCss}deg, ${stopsCss})`;
}
// returns {css:'background value', img: 'relTarget'|undefined, none:bool}
function fillOf(spPr, rels) {
  if (!spPr) return {};
  for (const n of kids(spPr)) {
    const t = tagName(n);
    if (t === 'a:noFill') return { none: true };
    if (t === 'a:solidFill') {
      const c = resolveColorNode(firstColorNode(n));
      return c ? { css: c.css } : {};
    }
    if (t === 'a:gradFill') {
      const g = gradientCss(n);
      return g ? { css: g } : {};
    }
    if (t === 'a:blipFill') {
      const blip = child(n, 'a:blip');
      const rid = blip && attrs(blip)['r:embed'];
      const target = rid && rels[rid];
      if (target) return { img: target, tile: !!child(n, 'a:tile') };
    }
    if (t === 'a:pattFill') {
      const fg = resolveColorNode(firstColorNode(child(n, 'a:fgClr')));
      const bg = resolveColorNode(firstColorNode(child(n, 'a:bgClr')));
      if (fg && bg) return { css: `repeating-linear-gradient(45deg, ${fg.css} 0 2px, ${bg.css} 2px 5px)` };
    }
  }
  return {};
}
function lineOf(spPr) {
  const ln = spPr && child(spPr, 'a:ln');
  if (!ln) return null;
  if (child(ln, 'a:noFill')) return { none: true };
  const fill = child(ln, 'a:solidFill');
  const grad = child(ln, 'a:gradFill');
  let color = fill ? resolveColorNode(firstColorNode(fill)) : null;
  if (!color && grad) {
    const gs = descend(grad, 'a:gsLst');
    const first = gs && child(gs, 'a:gs');
    color = first ? resolveColorNode(firstColorNode(first)) : null;
  }
  const w = attrs(ln).w ? Number(attrs(ln).w) / 9525 : 1; // pt->px approx (12700 EMU/pt * 72/96)
  const dash = child(ln, 'a:prstDash');
  const dashVal = dash ? attrs(dash).val : 'solid';
  if (!color) return null;
  return { width: Math.max(0.75, w), color: color.css, dash: dashVal };
}
function shadowOf(spPr) {
  const shdw = descend(spPr, 'a:effectLst', 'a:outerShdw');
  if (!shdw) return null;
  const a = attrs(shdw);
  const dist = (Number(a.dist) || 0) / EMU;
  const dirRad = ((Number(a.dir) || 0) / 60000) * Math.PI / 180;
  const blur = (Number(a.blurRad) || 0) / EMU;
  const c = resolveColorNode(firstColorNode(shdw));
  if (!c) return null;
  return `${(dist * Math.cos(dirRad)).toFixed(1)}px ${(dist * Math.sin(dirRad)).toFixed(1)}px ${blur.toFixed(1)}px ${c.css}`;
}

// ---------- fonts ----------
function mapFont(typeface, runBold) {
  if (!typeface) return null;
  const t = typeface.trim();
  const w = (def) => {
    if (/heavy/i.test(t)) return 900;
    if (/extrabold|black/i.test(t)) return 800;
    if (/semibold/i.test(t)) return 600;
    if (/bold/i.test(t)) return 700;
    if (/light/i.test(t)) return 300;
    if (/medium/i.test(t)) return 500;
    return def;
  };
  if (/나눔스퀘어 네오|NanumSquare Neo/i.test(t)) return { family: `'NanumSquareNeo','A2Z',sans-serif`, weight: w(400) };
  if (/나눔스퀘어|NanumSquare/i.test(t)) return { family: `'NanumSquareNeo','A2Z',sans-serif`, weight: w(400) };
  if (/Pretendard|Noto|Spoqa|맑은 고딕|Malgun|굴림|KoPub|프리젠테이션/i.test(t)) return { family: `'NanumSquareNeo',sans-serif`, weight: w(runBold ? 700 : 400) };
  if (/Arial|Helvetica/i.test(t)) return { family: `Arial,'NanumSquareNeo',sans-serif`, weight: w(runBold ? 700 : 400) };
  if (/Wingdings/i.test(t)) return { family: `'NanumSquareNeo',sans-serif`, weight: 400, wingdings: true };
  return { family: `'NanumSquareNeo',sans-serif`, weight: w(runBold ? 700 : 400) };
}

// ---------- text ----------
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const ALIGN = { l: 'left', ctr: 'center', r: 'right', just: 'justify', dist: 'justify' };

function runHtml(r, paraDefRPr, fontScale) {
  const t = tagName(r);
  if (t === 'a:br') return '<br/>';
  if (t !== 'a:r' && t !== 'a:fld') return '';
  const rPr = child(r, 'a:rPr') || paraDefRPr;
  const text = textOf(child(r, 'a:t'));
  if (text === '' && t === 'a:r') return '';
  const st = [];
  let cls = '';
  const a = rPr ? attrs(rPr) : {};
  let sz = a.sz ? Number(a.sz) / 100 : (paraDefRPr && attrs(paraDefRPr).sz ? Number(attrs(paraDefRPr).sz) / 100 : 18);
  sz *= fontScale;
  st.push(`font-size:${+(sz * 4 / 3).toFixed(2)}px`);
  const bold = a.b === '1';
  const latin = rPr && child(rPr, 'a:latin');
  const ea = rPr && child(rPr, 'a:ea');
  const face = (ea && attrs(ea).typeface) || (latin && attrs(latin).typeface);
  const fm = mapFont(face, bold);
  if (fm) { st.push(`font-family:${fm.family}`); st.push(`font-weight:${bold ? Math.max(700, fm.weight) : fm.weight}`); }
  else if (bold) st.push('font-weight:700');
  if (a.i === '1') st.push('font-style:italic');
  if (a.u && a.u !== 'none') st.push('text-decoration:underline');
  if (a.strike && a.strike !== 'noStrike') st.push('text-decoration:line-through');
  if (a.spc) st.push(`letter-spacing:${+(Number(a.spc) / 100 * 4 / 3 / 10).toFixed(2)}px`);
  const fillN = rPr && child(rPr, 'a:solidFill');
  const inheritFill = !fillN && paraDefRPr && child(paraDefRPr, 'a:solidFill');
  const c = resolveColorNode(firstColorNode(fillN || inheritFill));
  if (c) st.push(`color:${c.css}`);
  const hl = rPr && child(rPr, 'a:highlight');
  const hc = hl && resolveColorNode(firstColorNode(hl));
  if (hc) st.push(`background-color:${hc.css}`);
  const shdw = rPr && descend(rPr, 'a:effectLst', 'a:outerShdw');
  if (shdw) {
    const sc = resolveColorNode(firstColorNode(shdw));
    if (sc) st.push(`text-shadow:1px 1px 3px ${sc.css}`);
  }
  return `<span${cls} style="${st.join(';')}">${esc(text)}</span>`;
}

function paragraphHtml(p, bodyDefaults, fontScale) {
  const pPr = child(p, 'a:pPr');
  const st = [];
  const a = pPr ? attrs(pPr) : {};
  const algn = a.algn || bodyDefaults.algn;
  if (algn && ALIGN[algn]) st.push(`text-align:${ALIGN[algn]}`);
  // line spacing
  let lh = null;
  const lnSpc = pPr && descend(pPr, 'a:lnSpc', 'a:spcPct');
  const lnSpcPts = pPr && descend(pPr, 'a:lnSpc', 'a:spcPts');
  if (lnSpc) lh = Number(attrs(lnSpc).val) / 100000 * 1.25;
  else if (lnSpcPts) st.push(`line-height:${+(Number(attrs(lnSpcPts).val) / 100 * 4 / 3).toFixed(2)}px`);
  if (lh) st.push(`line-height:${+lh.toFixed(3)}`);
  else if (!lnSpcPts) st.push('line-height:1.25');
  const spcBef = pPr && descend(pPr, 'a:spcBef', 'a:spcPts');
  if (spcBef) st.push(`margin-top:${+(Number(attrs(spcBef).val) / 100 * 4 / 3).toFixed(1)}px`);
  const spcAft = pPr && descend(pPr, 'a:spcAft', 'a:spcPts');
  if (spcAft) st.push(`margin-bottom:${+(Number(attrs(spcAft).val) / 100 * 4 / 3).toFixed(1)}px`);
  const marL = a.marL ? Number(a.marL) / EMU : 0;
  const indent = a.indent ? Number(a.indent) / EMU : 0;
  // bullet
  let bullet = '';
  const buChar = pPr && child(pPr, 'a:buChar');
  const buAuto = pPr && child(pPr, 'a:buAutoNum');
  const buNone = pPr && child(pPr, 'a:buNone');
  if (marL > 0) { st.push(`padding-left:${marL.toFixed(1)}px`); }
  if (buChar && !buNone) {
    let ch = attrs(buChar).char || '•';
    // Wingdings bullets → sensible unicode
    const buFont = child(pPr, 'a:buFont');
    if (buFont && /Wingdings|Webdings/i.test(attrs(buFont).typeface || '')) {
      const map = { 'l': '●', 'n': '■', 'u': '◆', 'F': '☞', 'Ø': '➤', 'q': '❑', 'v': '❖', '§': '▪' };
      ch = map[ch] || '•';
    }
    bullet = `<span class="bu">${esc(ch)} </span>`;
    if (indent < 0) { st.push(`text-indent:${indent.toFixed(1)}px`); }
  } else if (indent) {
    st.push(`text-indent:${indent.toFixed(1)}px`);
  }
  const defRPr = pPr && child(pPr, 'a:defRPr');
  const runs = kids(p).filter(n => ['a:r', 'a:br', 'a:fld'].includes(tagName(n)));
  let inner = runs.map(r => runHtml(r, defRPr, fontScale)).join('');
  if (!inner) {
    // empty paragraph = vertical space; use endParaRPr size
    const endPr = child(p, 'a:endParaRPr');
    const sz = endPr && attrs(endPr).sz ? Number(attrs(endPr).sz) / 100 * 4 / 3 : 18;
    return `<div class="p" style="${st.join(';')}"><span style="font-size:${sz.toFixed(1)}px">&nbsp;</span></div>`;
  }
  return `<div class="p" style="${st.join(';')}">${bullet}${inner}</div>`;
}

const ANCHOR = { t: 'flex-start', ctr: 'center', b: 'flex-end', just: 'center', dist: 'center' };
function txBodyHtml(txBody) {
  if (!txBody) return '';
  const bodyPr = child(txBody, 'a:bodyPr');
  const ba = bodyPr ? attrs(bodyPr) : {};
  const anchor = ANCHOR[ba.anchor || 't'] || 'flex-start';
  const insets = {
    l: ba.lIns !== undefined ? Number(ba.lIns) / EMU : 91440 / EMU,
    r: ba.rIns !== undefined ? Number(ba.rIns) / EMU : 91440 / EMU,
    t: ba.tIns !== undefined ? Number(ba.tIns) / EMU : 45720 / EMU,
    b: ba.bIns !== undefined ? Number(ba.bIns) / EMU : 45720 / EMU,
  };
  let fontScale = 1;
  const autofit = bodyPr && child(bodyPr, 'a:normAutofit');
  if (autofit && attrs(autofit).fontScale) fontScale = Number(attrs(autofit).fontScale) / 100000;
  const wrap = ba.wrap === 'none' ? 'nowrap' : 'normal';
  const paras = childAll(txBody, 'a:p');
  const inner = paras.map(p => paragraphHtml(p, {}, fontScale)).join('');
  if (!inner.replace(/<[^>]+>|&nbsp;|\s/g, '')) return '';
  const st = [
    `padding:${insets.t.toFixed(1)}px ${insets.r.toFixed(1)}px ${insets.b.toFixed(1)}px ${insets.l.toFixed(1)}px`,
    `justify-content:${anchor}`,
    `white-space:${wrap}`,
  ];
  // East-Asian vertical text (eaVert/vert) and rotated vertical (vert270)
  if (ba.vert === 'eaVert' || ba.vert === 'vert') st.push('writing-mode:vertical-rl');
  else if (ba.vert === 'vert270') st.push('writing-mode:vertical-rl', 'transform:rotate(180deg)');
  return `<div class="tx" style="${st.join(';')}">${inner}</div>`;
}

// ---------- geometry ----------
function xfrmOf(spPr) {
  const x = spPr && child(spPr, 'a:xfrm');
  if (!x) return null;
  const off = child(x, 'a:off'), ext = child(x, 'a:ext');
  const chOff = child(x, 'a:chOff'), chExt = child(x, 'a:chExt');
  const a = attrs(x);
  return {
    x: off ? Number(attrs(off).x) / EMU : 0,
    y: off ? Number(attrs(off).y) / EMU : 0,
    w: ext ? Number(attrs(ext).cx) / EMU : 0,
    h: ext ? Number(attrs(ext).cy) / EMU : 0,
    rot: a.rot ? Number(a.rot) / 60000 : 0,
    flipH: a.flipH === '1', flipV: a.flipV === '1',
    chX: chOff ? Number(attrs(chOff).x) / EMU : 0,
    chY: chOff ? Number(attrs(chOff).y) / EMU : 0,
    chW: chExt ? Number(attrs(chExt).cx) / EMU : 0,
    chH: chExt ? Number(attrs(chExt).cy) / EMU : 0,
  };
}
function posStyle(f) {
  const st = [`left:${f.x.toFixed(1)}px`, `top:${f.y.toFixed(1)}px`, `width:${Math.max(0.5, f.w).toFixed(1)}px`, `height:${Math.max(0.5, f.h).toFixed(1)}px`];
  const tf = [];
  if (f.rot) tf.push(`rotate(${f.rot.toFixed(2)}deg)`);
  if (f.flipH) tf.push('scaleX(-1)');
  if (f.flipV) tf.push('scaleY(-1)');
  if (tf.length) st.push(`transform:${tf.join(' ')}`);
  return st;
}

// custGeom → svg path
function custGeomSvg(spPr, f, fill, line) {
  const cg = child(spPr, 'a:custGeom');
  if (!cg) return null;
  const pathLst = child(cg, 'a:pathLst');
  if (!pathLst) return null;
  let d = '';
  let vw = f.w, vh = f.h;
  for (const p of childAll(pathLst, 'a:path')) {
    const pa = attrs(p);
    const pw = Number(pa.w) || f.w * EMU, ph = Number(pa.h) || f.h * EMU;
    const sx = f.w / (pw || 1), sy = f.h / (ph || 1);
    const pt = (ptNode) => {
      const a = attrs(ptNode);
      return `${(Number(a.x) * sx).toFixed(1)},${(Number(a.y) * sy).toFixed(1)}`;
    };
    for (const cmd of kids(p)) {
      const t = tagName(cmd);
      if (t === 'a:moveTo') d += `M${pt(child(cmd, 'a:pt'))}`;
      else if (t === 'a:lnTo') d += `L${pt(child(cmd, 'a:pt'))}`;
      else if (t === 'a:cubicBezTo') d += `C${childAll(cmd, 'a:pt').map(pt).join(' ')}`;
      else if (t === 'a:quadBezTo') d += `Q${childAll(cmd, 'a:pt').map(pt).join(' ')}`;
      else if (t === 'a:close') d += 'Z';
    }
  }
  if (!d) return null;
  const fillAttr = fill.css ? (fill.css.includes('gradient') ? '#888' : fill.css) : (fill.none ? 'none' : 'none');
  const strokeAttr = line && !line.none ? `stroke="${line.color}" stroke-width="${line.width}"` : '';
  return `<svg width="${f.w.toFixed(0)}" height="${f.h.toFixed(0)}" viewBox="0 0 ${f.w.toFixed(0)} ${f.h.toFixed(0)}" style="position:absolute;inset:0;overflow:visible"><path d="${d}" fill="${fillAttr}" ${strokeAttr}/></svg>`;
}

// ---------- shape renderers ----------
function renderShape(sp, rels, ctx) {
  const spPr = child(sp, 'p:spPr') || child(sp, 'a:spPr');
  const f = xfrmOf(spPr);
  if (!f) return '';
  const prstG = child(spPr, 'a:prstGeom');
  const prst = prstG ? attrs(prstG).prst : (child(spPr, 'a:custGeom') ? 'custom' : 'rect');
  const fill = fillOf(spPr, rels);
  const line = lineOf(spPr);
  const shadow = shadowOf(spPr);
  const txBody = child(sp, 'p:txBody');
  const st = posStyle(f);
  let inner = '';

  if (prst === 'line' || prst === 'straightConnector1' || prst === 'bentConnector3' || prst === 'bentConnector2') {
    // render as SVG line
    const lw = line && !line.none ? line.width : 1;
    const lc = line && !line.none ? line.color : '#000';
    const dashAttr = line && line.dash && line.dash !== 'solid' ? `stroke-dasharray="${lw * 3},${lw * 2}"` : '';
    const w = Math.max(f.w, 0.5), h = Math.max(f.h, 0.5);
    let x1 = 0, y1 = 0, x2 = f.w, y2 = f.h;
    // flips handled by transform already
    inner = `<svg width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}" style="position:absolute;inset:0;overflow:visible"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${lc}" stroke-width="${lw}" ${dashAttr}/></svg>`;
    return `<div class="shp" style="position:absolute;${st.join(';')}">${inner}${txBodyHtml(txBody)}</div>`;
  }

  if (prst === 'custom') {
    const svg = custGeomSvg(spPr, f, fill, line);
    if (svg) return `<div class="shp" style="position:absolute;${st.join(';')}">${svg}${txBodyHtml(txBody)}</div>`;
  }

  // css box shapes
  if (fill.css) st.push(`background:${fill.css}`);
  if (fill.img) st.push(`background-image:url('${assetUrl(fill.img)}');background-size:${fill.tile ? 'auto' : '100% 100%'}`);
  if (line && !line.none) {
    const bstyle = line.dash && line.dash !== 'solid' ? 'dashed' : 'solid';
    st.push(`border:${line.width.toFixed(2)}px ${bstyle} ${line.color}`);
    st.push('box-sizing:border-box');
  }
  if (shadow) st.push(`box-shadow:${shadow}`);
  if (prst === 'ellipse') st.push('border-radius:50%');
  else if (prst === 'roundRect' || prst === 'round2SameRect') {
    let adj = 16667;
    const av = descend(spPr, 'a:prstGeom', 'a:avLst');
    const gd = av && childAll(av, 'a:gd').find(g => attrs(g).name === 'adj');
    if (gd) { const m = /val (\-?\d+)/.exec(attrs(gd).fmla); if (m) adj = Number(m[1]); }
    const r = Math.min(f.w, f.h) * clamp(adj, 0, 50000) / 100000;
    st.push(`border-radius:${r.toFixed(1)}px`);
  } else if (prst === 'rightArrow') {
    st.push('clip-path:polygon(0 25%, 60% 25%, 60% 0, 100% 50%, 60% 100%, 60% 75%, 0 75%)');
  } else if (prst === 'chevron') {
    st.push('clip-path:polygon(0 0, 75% 0, 100% 50%, 75% 100%, 0 100%, 25% 50%)');
  } else if (prst === 'triangle') {
    st.push('clip-path:polygon(50% 0, 100% 100%, 0 100%)');
  } else if (prst === 'diamond') {
    st.push('clip-path:polygon(50% 0, 100% 50%, 50% 100%, 0 50%)');
  } else if (prst === 'pie' || prst === 'arc' || prst === 'blockArc') {
    st.push('border-radius:50%');
  }
  return `<div class="shp" style="position:absolute;${st.join(';')}">${txBodyHtml(txBody)}</div>`;
}

let mediaCopied = new Set();
function assetUrl(target) {
  // target like ../media/image7.png
  const base = path.basename(target);
  mediaCopied.add(base);
  return `assets/media/${encodeURIComponent(base)}`;
}

function renderPic(pic, rels, ctx) {
  const spPr = child(pic, 'p:spPr');
  const f = xfrmOf(spPr);
  if (!f) return '';
  const st = posStyle(f);
  const nvPr = descend(pic, 'p:nvPicPr', 'p:nvPr');
  const videoFile = nvPr && child(nvPr, 'a:videoFile');
  const blipFill = child(pic, 'p:blipFill');
  const blip = blipFill && child(blipFill, 'a:blip');
  const rid = blip && attrs(blip)['r:embed'];
  const imgTarget = rid && rels[rid];
  const line = lineOf(spPr);
  const shadow = shadowOf(spPr);
  if (line && !line.none) { st.push(`border:${line.width.toFixed(2)}px solid ${line.color}`); st.push('box-sizing:border-box'); }
  if (shadow) st.push(`box-shadow:${shadow}`);
  const prstG = spPr && child(spPr, 'a:prstGeom');
  if (prstG && attrs(prstG).prst === 'ellipse') st.push('border-radius:50%;overflow:hidden');
  if (prstG && attrs(prstG).prst === 'roundRect') st.push('border-radius:16px;overflow:hidden');

  if (videoFile) {
    const vrid = attrs(videoFile)['r:link'];
    const vTarget = vrid && rels[vrid];
    const posterAttr = imgTarget ? ` poster="${assetUrl(imgTarget)}"` : '';
    if (vTarget) {
      // full-bleed videos behave as looping background footage; embedded clips keep controls
      const isBackground = f.w >= 1650 && f.h >= 920;
      const behavior = isBackground
        ? ' data-autoplay="1" muted loop'
        : ' controls';
      const fit = isBackground ? 'cover' : 'contain';
      return `<div class="shp vid" style="position:absolute;${st.join(';')}"><video src="${assetUrl(vTarget)}"${posterAttr} preload="none"${behavior} playsinline style="width:100%;height:100%;object-fit:${fit};background:#000"></video></div>`;
    }
  }
  if (!imgTarget) return '';
  // srcRect crop
  const srcRect = blipFill && child(blipFill, 'a:srcRect');
  if (srcRect) {
    const a = attrs(srcRect);
    const l = Number(a.l || 0) / 100000, r = Number(a.r || 0) / 100000, t = Number(a.t || 0) / 100000, b = Number(a.b || 0) / 100000;
    const wPct = 1 - l - r, hPct = 1 - t - b;
    if (wPct > 0 && hPct > 0 && (l || r || t || b)) {
      const iw = 100 / wPct, ih = 100 / hPct;
      const ml = -l * iw, mt = -t * ih;
      return `<div class="shp" style="position:absolute;${st.join(';')};overflow:hidden"><img src="${assetUrl(imgTarget)}" alt="" style="position:absolute;width:${iw.toFixed(2)}%;height:${ih.toFixed(2)}%;left:${ml.toFixed(2)}%;top:${mt.toFixed(2)}%"/></div>`;
    }
  }
  return `<div class="shp" style="position:absolute;${st.join(';')}"><img src="${assetUrl(imgTarget)}" alt="" style="width:100%;height:100%"/></div>`;
}

function renderTable(gf, rels) {
  const f = xfrmOf(gf); // graphicFrame has p:xfrm
  const xf = child(gf, 'p:xfrm');
  let fr = f;
  if (xf) {
    const off = child(xf, 'a:off'), ext = child(xf, 'a:ext');
    fr = {
      x: Number(attrs(off).x) / EMU, y: Number(attrs(off).y) / EMU,
      w: Number(attrs(ext).cx) / EMU, h: Number(attrs(ext).cy) / EMU,
      rot: 0, flipH: false, flipV: false,
    };
  }
  if (!fr) return '';
  const tbl = descend(gf, 'a:graphic', 'a:graphicData', 'a:tbl');
  if (!tbl) return '';
  const grid = child(tbl, 'a:tblGrid');
  const cols = grid ? childAll(grid, 'a:gridCol').map(c => Number(attrs(c).w) / EMU) : [];
  const rows = childAll(tbl, 'a:tr');
  let html = `<table class="ptbl" style="width:${fr.w.toFixed(1)}px;height:${fr.h.toFixed(1)}px">`;
  html += '<colgroup>' + cols.map(w => `<col style="width:${w.toFixed(1)}px"/>`).join('') + '</colgroup>';
  for (const tr of rows) {
    const rh = Number(attrs(tr).h) / EMU;
    html += `<tr style="height:${rh.toFixed(1)}px">`;
    for (const tc of childAll(tr, 'a:tc')) {
      const ta = attrs(tc);
      if (ta.hMerge === '1' || ta.vMerge === '1') continue;
      const span = [];
      if (ta.gridSpan) span.push(`colspan="${ta.gridSpan}"`);
      if (ta.rowSpan) span.push(`rowspan="${ta.rowSpan}"`);
      const tcPr = child(tc, 'a:tcPr');
      const cellFill = fillOf(tcPr, rels);
      const cst = ['vertical-align:middle'];
      if (cellFill.css) cst.push(`background:${cellFill.css}`);
      // cell borders
      for (const [tag, side] of [['a:lnL', 'left'], ['a:lnR', 'right'], ['a:lnT', 'top'], ['a:lnB', 'bottom']]) {
        const lnN = tcPr && child(tcPr, tag);
        if (lnN) {
          if (child(lnN, 'a:noFill')) continue;
          const c = resolveColorNode(firstColorNode(child(lnN, 'a:solidFill')));
          const w = attrs(lnN).w ? Number(attrs(lnN).w) / 9525 : 1;
          if (c) cst.push(`border-${side}:${Math.max(0.75, w).toFixed(2)}px solid ${c.css}`);
        }
      }
      html += `<td ${span.join(' ')} style="${cst.join(';')}">${txBodyHtml(child(tc, 'a:txBody'))}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  return `<div class="shp" style="position:absolute;left:${fr.x.toFixed(1)}px;top:${fr.y.toFixed(1)}px;width:${fr.w.toFixed(1)}px;height:${fr.h.toFixed(1)}px">${html}</div>`;
}

function renderGroup(grp, rels, ctx) {
  const grpSpPr = child(grp, 'p:grpSpPr');
  const f = xfrmOf(grpSpPr);
  if (!f) return '';
  const sx = f.chW ? f.w / f.chW : 1;
  const sy = f.chH ? f.h / f.chH : 1;
  const st = [
    `left:${f.x.toFixed(1)}px`, `top:${f.y.toFixed(1)}px`,
    `width:${(f.chW || f.w).toFixed(1)}px`, `height:${(f.chH || f.h).toFixed(1)}px`,
  ];
  const tf = [];
  if (f.rot) tf.push(`rotate(${f.rot.toFixed(2)}deg)`);
  if (f.flipH) tf.push('scaleX(-1)');
  if (f.flipV) tf.push('scaleY(-1)');
  tf.push(`scale(${sx.toFixed(4)},${sy.toFixed(4)})`);
  st.push(`transform:${tf.join(' ')}`);
  st.push('transform-origin:0 0');
  // children are positioned in child coordinate space, offset by chOff
  const inner = renderShapeTree(grp, rels, ctx, { dx: -f.chX, dy: -f.chY });
  return `<div class="grp" style="position:absolute;${st.join(';')}">${inner}</div>`;
}

function renderShapeTree(parent, rels, ctx, offset) {
  let html = '';
  for (const node of kids(parent)) {
    const t = tagName(node);
    let piece = '';
    if (t === 'p:sp') piece = renderShape(node, rels, ctx);
    else if (t === 'p:pic') piece = renderPic(node, rels, ctx);
    else if (t === 'p:cxnSp') piece = renderShape(node, rels, ctx);
    else if (t === 'p:grpSp') piece = renderGroup(node, rels, ctx);
    else if (t === 'p:graphicFrame') piece = renderTable(node, rels);
    if (piece && offset && (offset.dx || offset.dy)) {
      piece = `<div style="position:absolute;left:${offset.dx.toFixed(1)}px;top:${offset.dy.toFixed(1)}px">${piece}</div>`;
    }
    html += piece;
  }
  return html;
}

// ---------- per-slide ----------
function loadRels(relsFile) {
  const map = {};
  if (!fs.existsSync(relsFile)) return map;
  const root = parseXml(relsFile);
  for (const r of childAll(root, 'Relationship')) {
    map[attrs(r).Id] = attrs(r).Target;
  }
  return map;
}

function slideBackground(sldRoot, rels) {
  const bg = descend(sldRoot, 'p:cSld', 'p:bg');
  if (!bg) return null;
  const bgPr = child(bg, 'p:bgPr');
  if (bgPr) {
    const fill = fillOf(bgPr, rels);
    if (fill.css) return fill.css;
    if (fill.img) return `url('${assetUrl(fill.img)}') center/cover`;
  }
  const bgRef = child(bg, 'p:bgRef');
  if (bgRef) {
    const c = resolveColorNode(firstColorNode(bgRef));
    if (c) return c.css;
  }
  return null;
}

function extractTexts(sldRoot) {
  // for title detection: collect (text, maxFontSize, y)
  const items = [];
  (function walk(node) {
    for (const n of kids(node)) {
      const t = tagName(n);
      if (t === 'p:sp') {
        const txBody = child(n, 'p:txBody');
        const f = xfrmOf(child(n, 'a:spPr') || child(n, 'p:spPr'));
        if (txBody) {
          let maxSz = 0; let text = '';
          for (const p of childAll(txBody, 'a:p')) {
            for (const r of childAll(p, 'a:r')) {
              const rPr = child(r, 'a:rPr');
              const sz = rPr && attrs(rPr).sz ? Number(attrs(rPr).sz) / 100 : 18;
              maxSz = Math.max(maxSz, sz);
              text += textOf(child(r, 'a:t'));
            }
            text += ' ';
          }
          text = text.replace(/\s+/g, ' ').trim();
          if (text) items.push({ text, sz: maxSz, y: f ? f.y : 0 });
        }
      } else if (['p:grpSp', 'p:spTree', 'p:cSld'].includes(t)) walk(n);
    }
  })(sldRoot);
  return items;
}

function notesText(noteFile) {
  if (!fs.existsSync(noteFile)) return '';
  const xml = fs.readFileSync(noteFile, 'utf8');
  const body = xml.split('<p:txBody>').slice(1).map(seg => {
    const texts = [...seg.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => m[1]);
    return texts.join('');
  }).join('\n').trim();
  // strip slide-number-only bodies
  return body.split('\n').filter(l => !/^\d+$/.test(l.trim())).join('\n').trim();
}

// ---------- main ----------
const presRels = loadRels(path.join(SRC, 'ppt/_rels/presentation.xml.rels'));
const presRoot = parseXml(path.join(SRC, 'ppt/presentation.xml'));
const sldIdLst = descend(presRoot, 'p:sldIdLst');
const slideFiles = childAll(sldIdLst, 'p:sldId').map(s => presRels[attrs(s)['r:id']]);

const slides = [];
slideFiles.forEach((rel, i) => {
  const file = path.join(SRC, 'ppt', rel);
  const relsMap = loadRels(path.join(SRC, 'ppt/slides/_rels', path.basename(rel) + '.rels'));
  const root = parseXml(file);
  const spTree = descend(root, 'p:cSld', 'p:spTree');
  const bg = slideBackground(root, relsMap);
  const body = renderShapeTree(spTree, relsMap, {});
  // notes
  const noteRel = Object.entries(relsMap).find(([, v]) => v.includes('notesSlide'));
  const notes = noteRel ? notesText(path.join(SRC, 'ppt/notesSlides', path.basename(noteRel[1]))) : '';
  const texts = extractTexts(root).sort((a, b) => b.sz - a.sz);
  const title = texts.length ? texts[0].text.slice(0, 60) : `Slide ${i + 1}`;
  slides.push({
    num: i + 1,
    src: path.basename(rel),
    title,
    notes,
    bg: bg || '#FFFFFF',
    html: body,
  });
  console.log(`slide ${i + 1} (${path.basename(rel)}): "${title.slice(0, 40)}" shapes-html ${body.length}B${notes ? ' +notes' : ''}`);
});

const out = `// AUTO-GENERATED by tools/convert.js — do not edit by hand.
// Source: PPT소스.pptx (${slides.length} slides)
window.SLIDES = ${JSON.stringify(slides, null, 1)};
`;
fs.writeFileSync(path.join(OUT, 'js/content.js'), out);
console.log(`\nWrote js/content.js: ${slides.length} slides, ${(out.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`Media referenced: ${mediaCopied.size} files`);
fs.writeFileSync(path.join(OUT, 'tools/media-used.json'), JSON.stringify([...mediaCopied], null, 1));
