// Layered meadow scenery (sky, hills, trees, tulips, butterflies, fireflies) drawn to the real
// viewport size so it never stretches on phones or wide screens. Moods are CSS variables in
// styles/theme.css (.scenery[data-mood=...]), so switching mood crossfades.
// Ported from the reviewed Sproutly Interactive HTML (assets/scenery.js). Use through <SceneryBackdrop>.
import { foliageUrl } from './plantSprites'

const NS = 'http://www.w3.org/2000/svg';

function rng(seed) { // mulberry32 — stable layout between redraws
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ridge(W, base, amp, rand, freq) {
  const waves = [0, 1, 2].map((k) => ({ a: amp * [1, .45, .2][k], f: freq * [1, 2.3, 5.1][k], p: rand() * Math.PI * 2 }));
  const step = Math.max(24, W / 40);
  const pts = [];
  for (let x = -step; x <= W + step; x += step) {
    let y = base;
    waves.forEach((w) => { y -= w.a * Math.sin((x / W) * Math.PI * 2 * w.f + w.p); });
    pts.push([x, y]);
  }
  return pts;
}
function smoothPath(pts, H) {
  let d = `M${pts[0][0]},${H + 2} L${pts[0][0]},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last[0]},${H + 2} Z`;
}
function yAt(pts, x) {
  for (let i = 0; i < pts.length - 1; i++) {
    if (x >= pts[i][0] && x <= pts[i + 1][0]) {
      const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
      return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
    }
  }
  return pts[pts.length - 1][1];
}
const el = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

const FLOWER_COLORS = ['#ffffff', '#ffffff', '#f9c9d3', '#f7d86e', '#cdb9f2', '#f2899b', '#fde7b0'];
const TULIPS = ['tulip-pink-4', 'tulip-red-4', 'tulip-purple-4', 'tulip-yellow-4', 'tulip-white-4', 'tulip-pink-3'];

function drawLand(root, opts) {
  const W = Math.max(320, root.clientWidth), H = Math.max(320, root.clientHeight);
  const rand = rng(opts.seed || 7);
  const tall = H / W > 1.15;
  const horizon = H * (opts.horizon ?? (tall ? 0.7 : 0.62));
  const span = H - horizon;
  const svg = el('svg', { class: 'land', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });

  const layers = [];
  const spec = [ // base offset (fraction of land span), amplitude, frequency
    [0.0, 0.16, 0.9], [0.14, 0.14, 1.3], [0.32, 0.12, 1.1], [0.55, 0.1, 1.6], [0.8, 0.08, 1.2],
  ];
  spec.forEach(([off, amp, f], i) => {
    const pts = ridge(W, horizon + off * span, amp * span * (tall ? .8 : 1), rand, f * (tall ? .7 : 1));
    layers.push(pts);
  });

  // tree line behind/along the second ridge
  const trees = el('g', {});
  const treeCount = Math.round(W / 70);
  for (let t = 0; t < treeCount; t++) {
    const x = rand() * W;
    if (opts.clearCenter && Math.abs(x - W / 2) < W * 0.16 && rand() < .7) continue;
    const y = yAt(layers[0], x) + 6;
    const s = (0.6 + rand() * 0.9) * Math.min(1.4, Math.max(.7, span / 380));
    const n = 3 + Math.floor(rand() * 3);
    if (rand() < .22) { // poplar
      trees.append(el('ellipse', { class: 'tr2', cx: x, cy: y - 34 * s, rx: 9 * s, ry: 38 * s }));
      continue;
    }
    for (let k = 0; k < n; k++) {
      trees.append(el('circle', { class: k % 2 ? 'tr' : 'tr2', cx: x + (k - n / 2) * 11 * s + rand() * 6, cy: y - (12 + rand() * 22) * s, r: (13 + rand() * 9) * s }));
    }
  }

  layers.forEach((pts, i) => {
    svg.append(el('path', { class: 'h' + (i + 1), d: smoothPath(pts, H) }));
    if (i === 0) svg.append(trees);
    if (i >= 2) { // flower dots on the nearer hills
      const g = el('g', { class: 'fl' });
      const next = layers[i + 1];
      const density = (opts.flowers ?? 1) * (W * span) / (i === 4 ? 2600 : 5200);
      const count = Math.min(i === 4 ? 520 : 260, Math.round(density * (i === 2 ? .5 : 1)));
      for (let k = 0; k < count; k++) {
        const x = rand() * W;
        const top = yAt(pts, x) + 4;
        const bottom = next ? yAt(next, x) - 2 : H;
        if (bottom <= top) continue;
        const y = top + Math.pow(rand(), 1.4) * (bottom - top);
        const depth = (y - horizon) / span;
        const r = (0.8 + depth * 3.2) * (0.7 + rand() * 0.7);
        const c = FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)];
        g.append(el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(2), fill: c }));
        if (r > 2.6) g.append(el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: (r * .35).toFixed(2), fill: '#f2b33d' }));
      }
      svg.append(g);
    }
    if (i === 4) { // grass blades along the front ridge
      const g = el('g', { class: 'fl' });
      for (let x = 0; x < W; x += 7 + rand() * 9) {
        const y = yAt(pts, x) + 3, h = 6 + rand() * 12, lean = (rand() - .5) * 8;
        g.append(el('path', { d: `M${x - 2},${y} Q${x + lean / 2},${y - h * .6} ${x + lean},${y - h} Q${x + lean / 3},${y - h * .4} ${x + 2},${y} Z`, class: 'h5' }));
      }
      svg.append(g);
    }
  });
  return { svg, W, H, horizon, span, layers, rand };
}

function build(root, opts) {
  root.innerHTML = '';
  const r = rng((opts.seed || 7) + 99);
  const W = root.clientWidth, H = root.clientHeight;

  const stars = document.createElement('div'); stars.className = 'stars';
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('i');
    s.style.left = (r() * 100) + '%'; s.style.top = (r() * 100) + '%';
    s.style.animationDelay = (-r() * 3) + 's';
    if (r() < .2) { s.style.width = s.style.height = '3px'; }
    stars.append(s);
  }
  root.append(stars);

  const sun = document.createElement('div'); sun.className = 'sun';
  sun.style.left = `calc(${opts.sunX ?? 78}% - 60px)`; sun.style.top = `calc(${opts.sunY ?? 14}% - 60px)`;
  root.append(sun);

  for (let i = 0; i < (opts.clouds ?? 5); i++) {
    const c = document.createElement('div'); c.className = 'cloud';
    const w = 90 + r() * 140;
    c.style.width = w + 'px'; c.style.height = (w * .3) + 'px';
    c.style.top = (6 + r() * 30) + '%'; c.style.left = '0';
    const dur = 90 + r() * 120;
    c.style.animationDuration = dur + 's'; c.style.animationDelay = (-r() * dur) + 's';
    c.style.opacity = (.55 + r() * .4).toFixed(2);
    root.append(c);
  }

  const land = drawLand(root, opts);
  root.append(land.svg);

  // a few big tulips (the app's own art) framing the sides, kept clear of the centre
  const tCount = opts.tulips ?? (W < 600 ? 4 : W < 1100 ? 8 : 12);
  for (let i = 0; i < tCount; i++) {
    const side = i % 2 ? 1 : -1;
    const edge = Math.pow(r(), 1.6) * (W < 600 ? .28 : .3);
    const x = side < 0 ? edge * W : W - edge * W;
    const layer = land.layers[4];
    const ground = Math.min(H - 6, Math.max(yAt(layer, x) + 30 + r() * (H - yAt(layer, x)) * .55, yAt(layer, x) + 20));
    const name = TULIPS[i % TULIPS.length];
    const tall = name.endsWith('-4') ? 554 / 233 : 1; // bloom art is tall, bud art is square
    const h = ((W < 600 ? 90 : 120) + r() * (W < 600 ? 50 : 90)) * (tall > 1 ? 1 : .8);
    const w = h / tall;
    const img = document.createElement('img');
    img.src = foliageUrl(name); img.alt = ''; img.className = 'tulip';
    img.style.width = w + 'px'; img.style.height = h + 'px'; img.style.left = (x - w / 2) + 'px'; img.style.top = (ground - h * .98) + 'px';
    img.style.animationDelay = (-r() * 5) + 's'; img.style.animationDuration = (4 + r() * 3) + 's';
    root.append(img);
  }

  if (opts.butterflies !== 0) {
    const colors = [['#f6a5b6', '#e0546a'], ['#fbd56b', '#d99e2b'], ['#c9b6f0', '#8d72d6']];
    for (let i = 0; i < (opts.butterflies ?? 3); i++) {
      const b = document.createElement('div'); b.className = 'bfly';
      const [c1, c2] = colors[i % colors.length];
      b.innerHTML = `<svg viewBox="-13 -11 26 22"><g class="wing"><path d="M0 0C-4-10-14-12-12-3-11 3-4 3 0 0Z" fill="${c1}" stroke="${c2}" stroke-width="1"/><path d="M0 0C-3 6-10 10-10 5-10 2-5 1 0 0Z" fill="${c2}"/><path d="M0 0C4-10 14-12 12-3 11 3 4 3 0 0Z" fill="${c1}" stroke="${c2}" stroke-width="1"/><path d="M0 0C3 6 10 10 10 5 10 2 5 1 0 0Z" fill="${c2}"/></g><rect x="-1" y="-6" width="2" height="11" rx="1" fill="#4a362e"/></svg>`;
      b.style.left = (8 + r() * 60) + '%'; b.style.top = (30 + r() * 30) + '%';
      b.style.animationDuration = (16 + r() * 12) + 's'; b.style.animationDelay = (-r() * 20) + 's';
      root.append(b);
    }
  }

  const flies = document.createElement('div'); flies.className = 'flies';
  for (let i = 0; i < (W < 600 ? 18 : 34); i++) {
    const f = document.createElement('i');
    f.style.left = (r() * 100) + '%'; f.style.top = (40 + r() * 58) + '%';
    f.style.setProperty('--x1', ((r() - .5) * 120) + 'px'); f.style.setProperty('--y1', ((r() - .5) * 90) + 'px');
    f.style.setProperty('--x2', ((r() - .5) * 160) + 'px'); f.style.setProperty('--y2', ((r() - .5) * 120) + 'px');
    f.style.setProperty('--d', (7 + r() * 8) + 's');
    f.style.animationDelay = (-r() * 10) + 's, ' + (-r() * 2) + 's';
    flies.append(f);
  }
  root.append(flies);

  if (opts.petals) {
    for (let i = 0; i < opts.petals; i++) {
      const p = document.createElement('i'); p.className = 'petal';
      p.style.left = (r() * 110) + '%';
      p.style.setProperty('--drift', (-10 - r() * 25) + 'vw');
      const d = 10 + r() * 12; p.style.animationDuration = d + 's'; p.style.animationDelay = (-r() * d) + 's';
      if (r() < .4) p.style.background = '#fde7b0';
      root.append(p);
    }
  }
  if (opts.veil) { const v = document.createElement('div'); v.className = 'veil'; v.style.background = opts.veil; root.append(v); }
}

export function mountScenery(root, opts = {}) {
  if (typeof root === 'string') root = document.querySelector(root);
  if (!root) return;
  root.classList.add('scenery');
  root.dataset.mood = opts.mood || root.dataset.mood || 'day';
  const pageSky = opts.page ?? root.id === 'scenery'; // the full-page background tells the page which sky it's under
  if (pageSky) document.body.dataset.sky = root.dataset.mood;
  root.setAttribute('aria-hidden', 'true');
  let lastW = 0, lastH = 0, t;
  const draw = () => {
    const w = root.clientWidth, h = root.clientHeight;
    // ignore tiny height changes from mobile browser toolbars
    if (Math.abs(w - lastW) < 30 && Math.abs(h - lastH) < 140) return;
    lastW = w; lastH = h; build(root, opts);
  };
  draw();
  const onResize = () => { clearTimeout(t); t = setTimeout(draw, 160); };
  window.addEventListener('resize', onResize);
  return {
    destroy() { window.removeEventListener('resize', onResize); clearTimeout(t); if (pageSky) delete document.body.dataset.sky; },
    setMood(m) { root.dataset.mood = m; if (pageSky) document.body.dataset.sky = m; },
    get mood() { return root.dataset.mood; },
    el: root,
  };
}

