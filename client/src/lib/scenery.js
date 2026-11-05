// The hand-drawn meadow ground (five ridges, tree line, flower dots, grass, tulips), drawn to the real size of its box
// so it never stretches on phones or wide screens. Colours come from the mood tokens in theme.css (svg.land .h1 ...).
// The sky, critters and moods live in SkyLayer / SceneCritters. Use this through <DrawnLand>.
import { foliageUrl } from './plantSprites'
import { seeded } from './shuffle'
import treeSvg from '@/assets/foliage/meadow-tree.svg?raw'
import shrubSvg from '@/assets/foliage/meadow-shrub.svg?raw'

const NS = 'http://www.w3.org/2000/svg';

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
const foliageSvg = { tree: treeSvg, shrub: shrubSvg };
const foliageTemplates = new Map();

function foliageTemplate(type) {
  if (foliageTemplates.has(type)) return foliageTemplates.get(type);
  const source = new DOMParser().parseFromString(foliageSvg[type], 'image/svg+xml').documentElement;
  const template = {
    viewBox: source.getAttribute('viewBox').split(/\s+/).map(Number),
    paths: [...source.querySelectorAll('[data-tone]')]
      .filter(path => path.getAttribute('data-tone') !== 'outline'
        && !(path.hasAttribute('stroke-width') && !path.hasAttribute('fill')))
      .map(path => {
      const clone = path.cloneNode();
      const tone = clone.getAttribute('data-tone');
      clone.setAttribute('class', tone === 'trunk' ? 'trunk' : `foliage-${tone}`);
      clone.removeAttribute('data-tone');
      clone.removeAttribute('stroke-width');
      clone.removeAttribute('stroke-linecap');
      clone.removeAttribute('stroke-linejoin');
      if (tone === 'trunk') {
        clone.setAttribute('fill', 'var(--tree2)');
        clone.style.filter = 'var(--mood-filter) var(--wx-filter)';
      } else {
        const color = tone === 'fill' ? 'var(--g-h4)'
          : tone === 'shade' ? 'var(--g-h5)'
            : 'var(--g-h3)';
        clone.style.fill = color;
      }
      return clone;
    }),
  };
  foliageTemplates.set(type, template);
  return template;
}

function appendFoliage(parent, type, x, baseline, width, height) {
  const { viewBox: [viewX, viewY, viewWidth, viewHeight], paths } = foliageTemplate(type);
  const group = el('g', {
    class: `foliage-${type}`,
    transform: `translate(${x - width / 2} ${baseline - height}) scale(${width / viewWidth} ${height / viewHeight}) translate(${-viewX} ${-viewY})`,
  });
  for (const path of paths) group.append(path.cloneNode());
  parent.append(group);
}

const BUSH_SCALE = 1.3; // size of the bush clusters on the far ridge
const FLOWER_COLORS = ['#ffffff', '#ffffff', '#f9c9d3', '#f7d86e', '#cdb9f2', '#f2899b', '#fde7b0'];
const TULIPS = ['tulip-pink-4', 'tulip-red-4', 'tulip-purple-4', 'tulip-yellow-4', 'tulip-white-4', 'tulip-pink-3'];

function drawLand(root, opts) {
  const W = Math.max(320, root.clientWidth), H = Math.max(320, root.clientHeight);
  const rand = seeded(opts.seed || 7);
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
    const y = yAt(layers[0], x) + 15;
    const s = (0.6 + rand() * 0.9) * Math.min(1.4, Math.max(.7, span / 380));
    if (rand() < .22) {
      const height = 76 * s;
      appendFoliage(trees, 'tree', x, y, height * 260 / 236, height);
      continue;
    }
    const n = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const baseRadius = (13 + rand() * 9) * s;
      const radius = baseRadius * BUSH_SCALE;
      const shrubHeight = radius * 2 * 100 / 170;
      appendFoliage(
        trees, 'shrub',
        x + (k - n / 2) * 11 * s * BUSH_SCALE + rand() * 6,
        y - (12 + rand() * 22) * s + baseRadius, // baseRadius, so bigger bushes grow upward and stay on the ridge
        radius * 2, shrubHeight,
      );
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
  return { svg, layers };
}

// a few big tulips (the app's own art) framing the sides, kept clear of the centre
function addTulips(root, layers, opts) {
  const W = root.clientWidth, H = root.clientHeight;
  // continue the stream SkyLayer used for its stars and clouds (70 stars x 4 draws, 5 draws per cloud),
  // so the tulips stand exactly where they did before the sky was split out
  const r = seeded((opts.seed || 7) + 99);
  for (let i = 0, skip = 280 + 5 * (opts.clouds ?? 5); i < skip; i++) r();

  const tCount = opts.tulips ?? (W < 600 ? 4 : W < 1100 ? 8 : 12);
  for (let i = 0; i < tCount; i++) {
    const side = i % 2 ? 1 : -1;
    const edge = Math.pow(r(), 1.6) * (W < 600 ? .28 : .3);
    const x = side < 0 ? edge * W : W - edge * W;
    const layer = layers[4];
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
}

// Draws into `root` and redraws when it is resized (ignoring the small height changes of mobile browser toolbars).
export function mountLand(root, opts = {}) {
  let lastW = 0, lastH = 0, t;
  const draw = () => {
    const w = root.clientWidth, h = root.clientHeight;
    if (Math.abs(w - lastW) < 30 && Math.abs(h - lastH) < 140) return;
    lastW = w; lastH = h;
    root.innerHTML = '';
    const { svg, layers } = drawLand(root, opts);
    root.append(svg);
    addTulips(root, layers, opts);
  };
  draw();
  const onResize = () => { clearTimeout(t); t = setTimeout(draw, 160); };
  window.addEventListener('resize', onResize);
  return { destroy() { window.removeEventListener('resize', onResize); clearTimeout(t); } };
}