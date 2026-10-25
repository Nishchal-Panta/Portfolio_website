/**
 * The ambient field.
 *
 *   dark   a night sky: blue-noise stars, each with its own home
 *   light  a constellation that is generated as you scroll
 *
 * Canvas2D only, CPU only, no dependencies and no shader code.
 *
 * Two ideas hold it together:
 *
 *   Parallax is expressed as **screen velocity** - factor x scroll velocity -
 *   not as a share of page movement. A star therefore moves the same slow
 *   distance on screen however fast the page is scrolled, which is what makes
 *   the sky read like a view through a window rather than particles flying
 *   past. A tanh soft clamp and a 150ms filter on the scroll velocity keep it
 *   calm.
 *
 *   The cursor stirs **one shared flow field**, a low-resolution velocity grid,
 *   and every particle rides it. Because neighbours sample the same field they
 *   move together, so a swept cursor leaves a coherent wake with swirls at its
 *   edges, like a finger dragged through water. Every particle still has a home
 *   and a damped spring back to it, so nothing accumulates.
 *
 * Everything works in pixels per second against a real elapsed time, so motion
 * is identical at 60, 120 and 144Hz.
 */

import { FIGURES, magTier } from '../data/constellations.ts';

/** A measured text block: the field keeps quiet behind it. */
export interface TextBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  kind: 'large' | 'body';
  /** The element's computed colour, so legibility can be measured, not guessed. */
  colour: string;
}

export interface Frame {
  /** Document scroll in CSS pixels. Only used for wrapping, never for speed. */
  scroll: number;
  /** Signed scroll velocity in CSS px per frame; converted to px/s internally. */
  scrollVel: number;
  pointer: { x: number; y: number } | null;
  /** Signed pointer velocity in CSS px per frame. */
  pointerVel: { x: number; y: number };
  pointerDown: boolean;
  time: number;
  /**
   * The real duration of the frame that produced this one, in seconds.
   *
   * `scrollVel` and `pointerVel` above are per-frame displacements, and turning
   * a displacement into a rate needs the length of the frame it happened over.
   * Without this the conversion can only assume 60Hz, which is what
   * `scrollVel * 60` did. Supplied by the caller so the field never has to
   * infer it from its own simulation clock.
   */
  dt?: number;
  /** 0 = sky, 1 = constellation. Eased by the caller. */
  mix: number;
  textBoxes: TextBox[];
  /**
   * Regions to keep a figure OUT of when choosing where it goes: the text
   * columns, plus photographs and diagrams. Media is in this list and not in
   * `textBoxes` because a picture does not need the field dimmed behind it the
   * way type does - it needs the figures to be somewhere else.
   */
  avoid: TextBox[];
  chapter: number;
}

export const MORPH_DEFAULT = 0.6;

/* --------------------------------------------------------------- utilities */

function hash(i: number): number {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

type RGB = [number, number, number];

function readColour(value: string, fallback: RGB): RGB {
  const m = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return fallback;
  let hex = m[1];
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const mix = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
const smooth = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/* --------------------------------------------------- the quiet text field */

const FEATHER = 52;
const LINK_CEILING = 0.18;
const HEADLINE_LINK_CEILING = 0.1;
const NODE_CEILING = 0.25;

function outsideDistance(x: number, y: number, b: TextBox): number {
  const dx = Math.max(b.left - x, 0, x - b.right);
  const dy = Math.max(b.top - y, 0, y - b.bottom);
  return Math.hypot(dx, dy);
}

function strengthAt(x: number, y: number, boxes: TextBox[], ceiling: number): number {
  if (!boxes.length) return 1;
  let s = 1;
  for (const b of boxes) {
    const d = outsideDistance(x, y, b);
    if (d === 0) return Math.min(s, ceiling);
    s = Math.min(s, mix(ceiling, 1, smooth(d / FEATHER)));
  }
  return s;
}

function insideText(x: number, y: number, boxes: TextBox[]): boolean {
  for (const b of boxes) if (outsideDistance(x, y, b) === 0) return true;
  return false;
}

function ceilingAt(x: number, y: number, boxes: TextBox[]) {
  let c = 1;
  for (const b of boxes) if (b.kind === 'large') c = Math.min(c, HEADLINE_LINK_CEILING);
  return c;
}

/* -------------------------------------------------------------- shared grid */

class Grid {
  /* Declared and assigned here rather than as constructor parameter
     properties, so this file can be imported by Node's type-stripping loader
     and the flow grid unit test can run against the real implementation. The
     assignment order is unchanged: w, h and cols are set before `size()` is
     called, exactly as parameter properties would have been. */
  private w: number;
  private h: number;
  private cols: number;
  private cells: number[][] = [];
  constructor(w: number, h: number, cols: number) {
    this.w = w;
    this.h = h;
    this.cols = cols;
    this.cells = Array.from({ length: this.size() }, () => [] as number[]);
  }
  private rows() {
    return Math.max(1, Math.round((this.cols * this.h) / this.w));
  }
  private size() {
    return this.cols * this.rows();
  }
  resize(w: number, h: number, cols: number) {
    this.w = w;
    this.h = h;
    this.cols = cols;
    this.cells = Array.from({ length: this.size() }, () => [] as number[]);
  }
  reset() {
    for (const c of this.cells) c.length = 0;
  }
  add(x: number, y: number, i: number) {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor((x / this.w) * this.cols)));
    const r = Math.min(this.rows() - 1, Math.max(0, Math.floor((y / this.h) * this.rows())));
    this.cells[r * this.cols + c]?.push(i);
  }
  near(x: number, y: number, radius: number, fn: (i: number) => void) {
    const rows = this.rows();
    const spanX = Math.ceil((radius / this.w) * this.cols);
    const spanY = Math.ceil((radius / this.h) * rows);
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor((x / this.w) * this.cols)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor((y / this.h) * this.rows())));
    for (let r = Math.max(0, cy - spanY); r <= Math.min(rows - 1, cy + spanY); r++) {
      for (let c = Math.max(0, cx - spanX); c <= Math.min(this.cols - 1, cx + spanX); c++) {
        const cell = this.cells[r * this.cols + c];
        if (!cell) continue;
        for (let k = 0; k < cell.length; k++) fn(cell[k]);
      }
    }
  }
}

/* ---------------------------------------------------------------- the strip */

/* The strip is wider than the viewport by a margin, and the 500ms fade-in and
   fade-out happens inside that margin - off-screen. A star is therefore already
   at full brightness by the time it enters the window, so scrolling never dims
   the sky, which is what the coverage check measures. */
const MARGIN = 170;

function screenFromStrip(u: number, h: number) {
  return u * (h + 2 * MARGIN) - MARGIN;
}

/** Wrap a strip-space pixel coordinate into [-MARGIN, h + MARGIN]. */
function wrapStrip(px: number, h: number) {
  const span = h + 2 * MARGIN;
  let v = (px + MARGIN) % span;
  if (v < 0) v += span;
  return v - MARGIN;
}

/* ------------------------------------------------------------ blue noise */

/**
 * Bridson Poisson-disk sampling: points spread evenly with no clumps, lines or
 * columns, which is what a sky needs and random placement cannot give.
 */
function poissonDisk(w: number, h: number, count: number, seed: number): [number, number][] {
  let r = seed >>> 0 || 1;
  const rnd = () => {
    r ^= r << 13;
    r ^= r >>> 17;
    r ^= r << 5;
    r >>>= 0;
    return r / 4294967296;
  };
  const minD = Math.sqrt((w * h) / Math.max(1, count)) * 0.78;
  const cell = minD / Math.SQRT2;
  const cols = Math.max(1, Math.ceil(w / cell));
  const rows = Math.max(1, Math.ceil(h / cell));
  const grid = new Int32Array(cols * rows).fill(-1);
  const pts: [number, number][] = [];
  const active: number[] = [];

  const firstX = w * 0.5 + (rnd() - 0.5) * w * 0.4;
  const firstY = h * 0.5 + (rnd() - 0.5) * h * 0.4;
  pts.push([firstX, firstY]);
  active.push(0);
  grid[Math.min(rows - 1, Math.floor(firstY / cell)) * cols + Math.min(cols - 1, Math.floor(firstX / cell))] = 0;

  let guard = count * 200;
  while (pts.length < count && active.length && guard-- > 0) {
    const ai = Math.floor(rnd() * active.length);
    const base = pts[active[ai]];
    let placed = false;
    for (let k = 0; k < 24 && !placed; k++) {
      const ang = rnd() * Math.PI * 2;
      const rad = minD * (1 + rnd() * 1.6);
      const nx = base[0] + Math.cos(ang) * rad;
      const ny = base[1] + Math.sin(ang) * rad;
      if (nx < 4 || ny < 4 || nx > w - 4 || ny > h - 4) continue;
      const cx = Math.min(cols - 1, Math.floor(nx / cell));
      const cy = Math.min(rows - 1, Math.floor(ny / cell));
      let ok = true;
      for (let j = Math.max(0, cy - 2); j <= Math.min(rows - 1, cy + 2) && ok; j++) {
        for (let i = Math.max(0, cx - 2); i <= Math.min(cols - 1, cx + 2); i++) {
          const idx = grid[j * cols + i];
          if (idx < 0) continue;
          if (Math.hypot(pts[idx][0] - nx, pts[idx][1] - ny) < minD) {
            ok = false;
            break;
          }
        }
      }
      if (!ok) continue;
      const idx = pts.length;
      pts.push([nx, ny]);
      active.push(idx);
      grid[cy * cols + cx] = idx;
      placed = true;
    }
    if (!placed) active.splice(ai, 1);
  }
  return pts;
}

/* ------------------------------------------------------------- flow field */

/**
 * One shared velocity grid that the cursor stirs and every particle rides.
 *
 * Each step: advect the field by its own velocity so motion carries and
 * swirls, diffuse it slightly so the wake stays coherent, then apply viscous
 * damping so it dies away over about 0.9 seconds.
 */
/**
 * The flow grid: advection, diffusion, damping.
 *
 * Exported rather than kept private so the click ring can be unit-tested in
 * Node against the real implementation - see `tools/_ring.test.mjs`. It is plain
 * array maths with no canvas, no DOM and no frame loop, so it runs headless.
 */
export class Flow {
  cols = 64;
  rows = 40;
  u = new Float32Array(0);
  v = new Float32Array(0);
  private u2 = new Float32Array(0);
  private v2 = new Float32Array(0);
  private w = 1;
  private h = 1;
  private cw = 1;
  private ch = 1;
  peak = 0;

  resize(w: number, h: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    // About 64 x 40 for a desktop viewport, scaled with the screen.
    this.cols = clamp(Math.round(this.w / 22), 40, 72);
    this.rows = clamp(Math.round((this.cols * this.h) / this.w), 24, 48);
    this.cw = this.w / this.cols;
    this.ch = this.h / this.rows;
    const n = this.cols * this.rows;
    this.u = new Float32Array(n);
    this.v = new Float32Array(n);
    this.u2 = new Float32Array(n);
    this.v2 = new Float32Array(n);
  }

  /** Inject a Gaussian blob of velocity, the cursor's contribution. */
  inject(x: number, y: number, vx: number, vy: number, radius: number) {
    const i0 = Math.max(0, Math.floor((x - radius) / this.cw));
    const i1 = Math.min(this.cols - 1, Math.ceil((x + radius) / this.cw));
    const j0 = Math.max(0, Math.floor((y - radius) / this.ch));
    const j1 = Math.min(this.rows - 1, Math.ceil((y + radius) / this.ch));
    const sig2 = 2 * (radius * 0.42) * (radius * 0.42);
    for (let j = j0; j <= j1; j++) {
      const cy = (j + 0.5) * this.ch - y;
      for (let i = i0; i <= i1; i++) {
        const cx = (i + 0.5) * this.cw - x;
        const d2 = cx * cx + cy * cy;
        if (d2 > radius * radius) continue;
        const g = Math.exp(-d2 / sig2);
        const k = j * this.cols + i;
        this.u[k] += vx * g * INJECT;
        this.v[k] += vy * g * INJECT;
      }
    }
  }

  /**
   * A click sends out a RING, not a disc: an annulus of outward velocity. The
   * field advects itself, so that annulus travels outward (radius grows) while
   * viscous damping and diffusion weaken it (amplitude decays) - which is what
   * the click test measures. Filling the whole disc instead made the centre
   * strongest, so it read as a puff under the cursor rather than a ripple
   * crossing the sky.
   */
  pulse(x: number, y: number, radius: number, amp: number) {
    const i0 = Math.max(0, Math.floor((x - radius) / this.cw));
    const i1 = Math.min(this.cols - 1, Math.ceil((x + radius) / this.cw));
    const j0 = Math.max(0, Math.floor((y - radius) / this.ch));
    const j1 = Math.min(this.rows - 1, Math.ceil((y + radius) / this.ch));
    const ring = radius * 0.45;
    const sig = radius * 0.16;
    const sig2 = 2 * sig * sig;
    for (let j = j0; j <= j1; j++) {
      const cy = (j + 0.5) * this.ch - y;
      for (let i = i0; i <= i1; i++) {
        const cx = (i + 0.5) * this.cw - x;
        const d = Math.hypot(cx, cy);
        if (d > radius || d < 1) continue;
        const e = d - ring;
        const g = Math.exp(-(e * e) / sig2);
        if (g < 0.02) continue;
        const k = j * this.cols + i;
        this.u[k] += (cx / d) * amp * g;
        this.v[k] += (cy / d) * amp * g;
      }
    }
  }

  /**
   * One step of advection, diffusion and damping.
   *
   * Scroll does NOT belong here. This used to add `driftY * 0.05` to every cell
   * on every step, on the theory of a gentle scroll carry. Damping only takes
   * 2.35% back per step, so the steady state was about 2.12x screen velocity -
   * which reached the 240px/s ceiling as soon as the page scrolled faster than
   * ~113px/s. Measured at 4000px/s: the whole grid pinned at 240, 158 of 209
   * stars read as influenced, and since a star's brightness is base x (1 +
   * heat * 0.8) with heat = flow / cap, every one of them brightened by 1.8x and
   * swelled to 1.6x radius. That is brightness depending on scroll speed, which
   * the spec forbids outright, and it made the entire sky flare whenever the
   * page was flicked. Parallax already carries the world past the window, and
   * the cursor is the only thing that stirs the liquid.
   */
  step(dt: number) {
    const { cols, rows, cw, ch } = this;
    // Advection: the field moves through itself, so a wake carries and swirls.
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const bx = i * cw + cw * 0.5 - this.u[k] * dt;
        const by = j * ch + ch * 0.5 - this.v[k] * dt;
        const fx = clamp(bx / cw - 0.5, 0, cols - 1.001);
        const fy = clamp(by / ch - 0.5, 0, rows - 1.001);
        const i0 = Math.floor(fx);
        const j0 = Math.floor(fy);
        const tx = fx - i0;
        const ty = fy - j0;
        const a = j0 * cols + i0;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        this.u2[k] = this.u[a] * (1 - tx) * (1 - ty) + this.u[b] * tx * (1 - ty) + this.u[c] * (1 - tx) * ty + this.u[d] * tx * ty;
        this.v2[k] = this.v[a] * (1 - tx) * (1 - ty) + this.v[b] * tx * (1 - ty) + this.v[c] * (1 - tx) * ty + this.v[d] * tx * ty;
      }
    }
    // Diffusion: keeps the wake coherent instead of ragged.
    const kd = Math.min(0.24, dt * 6);
    let peak = 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const l = i > 0 ? k - 1 : k;
        const r = i < cols - 1 ? k + 1 : k;
        const u0 = i > 0 ? j * cols + i - 1 : k;
        const d0 = i < cols - 1 ? j * cols + i + 1 : k;
        this.u2[k] += kd * (this.u2[l] + this.u2[r] + this.u2[u0] + this.u2[d0] - 4 * this.u2[k]);
        this.v2[k] += kd * (this.v2[l] + this.v2[r] + this.v2[u0] + this.v2[d0] - 4 * this.v2[k]);
      }
    }
    // Viscous damping, about 0.9s to die.
    const damp = Math.exp(-dt / 0.7);
    for (let k = 0; k < cols * rows; k++) {
      let u = this.u2[k] * damp;
      let v = this.v2[k] * damp;
      // Hard ceiling, so the liquid can never look frantic however fast the sweep.
      const s2 = u * u + v * v;
      if (s2 > FLOW_MAX * FLOW_MAX) {
        const s = Math.sqrt(s2);
        u = (u / s) * FLOW_MAX;
        v = (v / s) * FLOW_MAX;
      }
      this.u[k] = u;
      this.v[k] = v;
      const s = Math.hypot(u, v);
      if (s > peak) peak = s;
    }
    this.peak = peak;
  }

  /** Bilinear sample of the field at a screen position, in px/s. */
  sample(x: number, y: number): [number, number] {
    const fx = clamp(x / this.cw - 0.5, 0, this.cols - 1.001);
    const fy = clamp(y / this.ch - 0.5, 0, this.rows - 1.001);
    const i0 = Math.floor(fx);
    const j0 = Math.floor(fy);
    const tx = fx - i0;
    const ty = fy - j0;
    const a = j0 * this.cols + i0;
    const b = a + 1;
    const c = a + this.cols;
    const d = c + 1;
    const u = this.u[a] * (1 - tx) * (1 - ty) + this.u[b] * tx * (1 - ty) + this.u[c] * (1 - tx) * ty + this.u[d] * tx * ty;
    const v = this.v[a] * (1 - tx) * (1 - ty) + this.v[b] * tx * (1 - ty) + this.v[c] * (1 - tx) * ty + this.v[d] * tx * ty;
    return [u, v];
  }

  /** Mean curl, so the test can prove a swirl exists at a wake's edge. */
  curlAt(x: number, y: number): number {
    const i = clamp(Math.round(x / this.cw - 0.5), 1, this.cols - 2);
    const j = clamp(Math.round(y / this.ch - 0.5), 1, this.rows - 2);
    const k = j * this.cols + i;
    return (this.v[k + 1] - this.v[k - 1]) / (2 * this.cw) - (this.u[k + this.cols] - this.u[k - this.cols]) / (2 * this.ch);
  }
}

/* ------------------------------------------------------------ shared pieces */

const POINTER_RADIUS = 210;
const SCROLL_TAU = 0.15;

/* The scroll response, in px/s, lives in `scroll-response.ts` so it can be
   unit-tested in Node with no browser, no display and no frame pacing involved
   - see `tools/_scroll-response.test.mjs`. That module owns three things: the
   one conversion from a per-frame distance to a rate, the 7200px/s ceiling,
   and the single number that sets how hard the sky pushes back. This file only
   ever consumes a rate from it. */
import { fieldRate, rateFromPerFrame } from './scroll-response.ts';
const STAR_CAP = 110;
const NODE_CAP = 90;
/** The active cap eases with the morph, so a theme change mid-flight is smooth. */
const capFor = (mix: number) => mix * NODE_CAP + (1 - mix) * STAR_CAP;
/** The grid cannot grow without limit: injection is scaled, then clamped. */
const INJECT = 0.038;
const FLOW_MAX = 240;

/** Depth to parallax factor. Screen velocity = factor x scroll velocity. */
const PARALLAX_FAR = 0.04;
const PARALLAX_MID = 0.08;
const PARALLAX_NEAR = 0.14;
const PARALLAX_HUB = 0.18;

function parallaxFor(z: number, hub: boolean) {
  if (hub) return PARALLAX_HUB;
  // Three bands rather than a ramp, so the depth reads as discrete layers.
  if (z < 0.34) return PARALLAX_FAR;
  if (z < 0.7) return PARALLAX_MID;
  return PARALLAX_NEAR;
}

/** tanh soft clamp: never exceeds `limit`, never has a hard corner. */
function softClamp(v: number, limit: number) {
  return limit * Math.tanh(v / limit);
}

/* ------------------------------------------------------------------- stars */

interface Star {
  hx: number;
  /** Home y in strip pixels, before parallax. */
  homeY: number;
  /** Accumulated parallax offset, driven by screen velocity. */
  off: number;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  z: number;
  r: number;
  base: number;
  seed: number;
  twPhase: number;
  twPeriod: number;
  nPhase: number;
  age: number;
  life: number;
  heat: number;
}

class Stars {
  list: Star[] = [];
  born = 0;
  retired = 0;
  maxSpeed = 0;
  private w = 1;
  private h = 1;
  private count: number;

  constructor(count: number) {
    this.count = count;
    this.build();
  }

  private build() {
    this.list = [];
    const h = this.h || 900;
    const w = this.w || 1440;
    const pts = poissonDisk(w, h + 2 * MARGIN, this.count, 1);
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const z = hash(i * 7 + 11);
      const bright = hash(i * 3 + 2);
      const base = bright > 0.95 ? 0.85 : bright > 0.8 ? 0.5 : 0.22 + hash(i * 5 + 3) * 0.12;
      this.list.push({
        hx: x,
        homeY: y - MARGIN,
        off: 0,
        sx: x,
        /* Seed, never 0: the wrap test compares against the previous y, so a
           star born at 0 whose home is past the midpoint looks like it has just
           wrapped - which zeroes its fade-in and inflates born/retired on the
           very first frame, before anything has moved. */
        sy: wrapStrip(y - MARGIN, h),
        ox: 0,
        oy: 0,
        vx: 0,
        vy: 0,
        z,
        r: base > 0.7 ? 1.7 + z * 1.3 : base > 0.4 ? 1.0 + z * 0.7 : 0.55 + z * 0.55,
        base,
        seed: hash(i * 13 + 5),
        twPhase: hash(i * 17 + 7) * Math.PI * 2,
        twPeriod: 3 + hash(i * 19 + 9) * 5,
        nPhase: hash(i * 23 + 11) * Math.PI * 2,
        age: 1,
        life: 1,
        heat: 0,
      });
    }
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.build();
  }

  /** Parallax as screen velocity, soft clamped and filtered by the caller. */
  scrollStep(dt: number, screenVel: number) {
    for (const s of this.list) s.off += screenVel * parallaxFor(s.z, false) * dt;
  }

  step(dt: number, t: number, f: Frame, flow: Flow | null) {
    const h = this.h;
    /* The cap eases with the morph, so stars are already tightening toward the
       light-theme limit by the time the constellation appears. */
    const cap = capFor(f.mix);
    let maxSpeed = 0;
    for (let i = 0; i < this.list.length; i++) {
      const s = this.list[i];
      const prevY = s.sy;
      s.sy = wrapStrip(s.homeY - s.off, h);
      if (Math.abs(s.sy - prevY) > h * 0.5) {
        s.age = 0;
        if (s.sy > prevY) this.born++;
        else this.retired++;
      }
      s.age += dt;

      /* Ride the shared flow. Neighbours sample the same field, so the wake is
         coherent rather than each star reacting on its own. */
      let fx = 0;
      let fy = 0;
      let flowSpeed = 0;
      if (flow) {
        const [fu, fv] = flow.sample(s.sx, s.sy);
        fx = fu;
        fy = fv;
        flowSpeed = Math.hypot(fu, fv);
      }
      s.heat = Math.min(1, Math.max(0, flowSpeed / cap));

      // Drag toward the flow, plus a damped spring home.
      const drag = 1 - Math.exp(-dt * 12);
      s.vx += (fx - s.vx) * drag;
      s.vy += (fy - s.vy) * drag;
      s.vx += (-80 * s.ox - 13.2 * s.vx) * dt;
      s.vy += (-80 * s.oy - 13.2 * s.vy) * dt;

      /* A mild bow wave: stars directly ahead of the cursor are nudged aside so
         the flow opens around it. */
      if (f.pointer) {
        const dx = s.sx - f.pointer.x;
        const dy = s.sy - f.pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < POINTER_RADIUS && d > 1) {
          const sp = Math.hypot(f.pointerVel.x, f.pointerVel.y);
          if (sp > 2) {
            const dirx = f.pointerVel.x / sp;
            const diry = f.pointerVel.y / sp;
            const ahead = (dx * dirx + dy * diry) / d;
            if (ahead > 0.15) {
              const push = ahead * ahead * (1 - d / POINTER_RADIUS) * sp * 0.5;
              s.vx += (-diry * push - dx / d * push * 0.6) * dt * 6;
              s.vy += (dirx * push - dy / d * push * 0.6) * dt * 6;
            }
          }
        }
      }

      // Hard cap, eased so onset is never abrupt.
      let sp = Math.hypot(s.vx, s.vy);
      if (sp > cap) {
        s.vx = (s.vx / sp) * cap;
        s.vy = (s.vy / sp) * cap;
        sp = cap;
      }
      if (sp > maxSpeed) maxSpeed = sp;

      s.ox += s.vx * dt;
      s.oy += s.vy * dt;
      const wanderX = Math.sin(t * 0.11 + s.nPhase) * 1.6 + Math.sin(t * 0.047 + s.nPhase * 2.3) * 2.2;
      s.sx = s.hx + wanderX + s.ox;
      const edge = Math.min(s.sy + MARGIN, h + MARGIN - s.sy);
      // A 500ms fade in and out, so recycling never pops.
      s.life = smooth(Math.min(1, Math.max(0, edge / 90))) * smooth(Math.min(1, s.age / 0.5));
    }
    this.maxSpeed = maxSpeed;
  }

  speeds(): number[] {
    return this.list.map((s) => Math.hypot(s.vx, s.vy));
  }

  /** Velocity vectors, for the wake test: cosine similarity needs direction. */
  velocities(): [number, number][] {
    return this.list.map((s) => [s.vx, s.vy]);
  }
}

/* --------------------------------------------------------- constellations */

/**
 * The light theme: real constellations riding the same flow field as the sky.
 *
 * A figure is a RIGID BODY. Its stars keep exactly the positions the catalogue
 * gives them, at every frame, forever - every distance, angle and line length
 * inside a figure is invariant, and that is checked frame by frame by the
 * shape-fidelity test. The only things a figure may do are translate and
 * rotate, as a whole:
 *
 *   - a slow ambient drift, a smooth time-based wander that always returns
 *   - one parallax factor for the whole shape, never per star
 *   - a response to the flow: the MEAN flow across the figure's footprint
 *     drives a translation, the MEAN CURL across it drives a small rotation,
 *     and both go through the same underdamped spring, so a figure settles
 *     back the way liquid does
 *
 * Nothing about how a figure LOOKS may respond to anything. Brightness, alpha,
 * line width and colour are fixed numbers. The only changes permitted are the
 * spawn and retire fades, and the quieting behind measured text. A click does
 * nothing here at all - no ripple, no pulse, nothing injected into the field.
 */

const SHAPE_SCALE_MIN = 140;
const SHAPE_SCALE_MAX = 320;
/** One fixed rotation per instance, chosen at spawn and never touched again. */
const SHAPE_ROT_MAX = (25 * Math.PI) / 180;
const SHAPE_DISP_CAP = 80;
const SHAPE_ROT_CAP = (10 * Math.PI) / 180;
/* Springs, picked against the two hard numbers: a figure near the sweep path
   must reach 40-70px of displacement and still be home inside 2.5s, with no
   more than about 15% overshoot.
     zeta = C / (2 sqrt K) = 1.35 / (2 x 1.342) = 0.503  ->  ~12% overshoot
     steady travel at the 90px/s cap = 90 / 1.8         ->  50px
     return from 50px reaches 2px in ln(25)/1.8          ->  1.8s
   A stiffer spring would settle faster but could never get to 40-70px: at the
   speed cap the reachable travel is the cap divided by the stiffness. */
/**
 * The home spring. Chosen by simulating the real integrator (tools/spring-tune.mjs)
 * against four constraints at once rather than by eye: 40-70px of travel under a
 * strong sweep, home within 2px inside 2.5s, no more than 15% overshoot, and
 * speed never above the 90px/s cap.
 *
 * Zeta 0.55 keeps the overshoot near 10%, which the design wants to see. The
 * stiffness is the interesting variable: it decides both how far a figure gets
 * pushed and how long the whole return-and-overshoot dance takes. A soft spring
 * (1.8) got 62px of travel but needed six seconds to settle; a stiffer one gets
 * back inside 2px sooner AND finishes its overshoot sooner, because the two
 * scale together. K=6 lands the travel at 41px, just inside the floor, and puts
 * the whole settle inside 2.5s where the softer springs did not.
 */
const SHAPE_K = 6;
const SHAPE_C = 2.69;
const SHAPE_ROT_K = 5.2;
const SHAPE_ROT_C = 2.3;
/** Pointer influence radius, falling off smoothly to nothing. */
const SHAPE_INFLUENCE = 240;
/**
 * Mean footprint curl, in rotation radians per second per unit of curl. The
 * rotation is whatever the curl of the field happens to be under a figure, so
 * this is a gain rather than a value: the design wants up to about 8 degrees
 * under a strong sweep, and the measured curl under a 750px/s sweep turns a
 * figure about 4.6 degrees at gain 6. Eight puts a hard sweep near six and lets
 * a faster flick approach the eight; the 10 degree cap below still holds.
 */
const CURL_TO_ROT = 8.0;
/**
 * Ambient drift. The figure is asked for 4-12 px/s of slow wandering, so the
 * amplitude and the rate are set together: a 16-34px excursion over a 13-20
 * second cycle peaks near 4 px/s at the slow end and near 13 at the fast one.
 * It is a home PATH, not an offset - the spring always aims at where the drift
 * currently is, so what the return test measures is the error from it.
 */
const DRIFT_AMP_MIN = 16;
const DRIFT_AMP_MAX = 34;
const DRIFT_RATE_MIN = 0.32;
const DRIFT_RATE_MAX = 0.5;
/** Spawn: stars fade first, then the lines draw. Retire: a plain fade. */
const SPAWN_STARS = 0.5;
const SPAWN_LINES = 0.6;
const SPAWN_STAGGER = 0.45;
const RETIRE_TIME = 0.6;
/* The fixed look. These are the whole of the light theme's appearance. */
const STAR_ALPHA = 0.37;
const LINE_ALPHA = 0.16;
const STAR_R = [1.6, 2.4, 3.6];

interface Shape {
  /** Index into FIGURES. */
  fig: number;
  /** Centre x, screen px. */
  cx: number;
  /** Centre y at spawn; the live position is cy - off + oy. */
  cy: number;
  /** Accumulated parallax for the whole shape. */
  off: number;
  z: number;
  /**
   * True once x has been chosen against measured text. Seeded figures have no
   * boxes to avoid yet - the boxes are read from the first painted frame - so
   * they choose again on that frame rather than landing in a column of type.
   */
  placed: boolean;
  /** Pixels per unit box; the drawn figure is `scale` across. */
  scale: number;
  /** Fixed base rotation, radians. */
  rot: number;
  ph: number;
  wr: number;
  driftAmp: number;
  /** Rigid-body displacement and rotation from home. */
  ox: number;
  oy: number;
  th: number;
  /** Where the ambient drift currently is: a path offset, not a spring target. */
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  wv: number;
  /** Star screen positions, filled once per step so draw and step agree. */
  px: number[];
  py: number[];
  age: number;
  /** Seconds since retiring began, or -1 while live. */
  retire: number;
  /**
   * Which way the figure is travelling: -1 up (the page is scrolling down, so
   * new figures arrive from below), +1 down, 0 until the first scroll. Only the
   * edge a figure is heading TOWARD may retire it, which is what stops a figure
   * that has just arrived at the bottom from retiring itself at once.
   */
  dir: number;
  radius: number;
  /** Last frame's entrainment: how strongly the field was holding this figure. */
  driveIn: number;
  heat: number;
  peakDisp: number;
  peakRot: number;
}

class Sky {
  shapes: Shape[] = [];
  born = 0;
  retired = 0;
  maxSpeed = 0;
  maxDisp = 0;
  maxRot = 0;
  /** Worst deviation of any pair of stars from its built separation. */
  deviation = 0;
  private w = 1;
  private h = 1;
  private target = 5;
  private rnd = 20261020;
  private last = -1;
  private edgeOrder: number[][] = [];

  private next(): number {
    this.rnd = (this.rnd * 1103515245 + 12345) % 2147483648;
    return this.rnd / 2147483648;
  }

  /** How many figures should be out at once: four to seven. */
  private retarget(w: number, h: number) {
    this.target = clamp(Math.round((w * h) / 220000), 4, 7);
  }

  resize(w: number, h: number) {
    const first = this.w <= 1;
    const prevW = this.w;
    const prevH = this.h;
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.retarget(this.w, this.h);
    if (first) {
      this.seed();
      return;
    }
    /* Rescale rather than rebuild, so a resize does not restart every
       entrance. Centres and scales follow the viewport; the rigid offsets and
       the rotation are untouched, because those are the figure's motion and
       not its layout. */
    for (const s of this.shapes) {
      s.cx = (s.cx / prevW) * this.w;
      s.cy = (s.cy / prevH) * this.h;
      s.scale = (s.scale / prevW) * this.w;
      s.radius = s.scale * 0.5;
    }
  }

  /** First paint: figures spread down the strip, already fully formed. */
  private seed() {
    this.shapes = [];
    for (let i = 0; i < this.target; i++) {
      const s = this.make(i % FIGURES.length, ((i + 0.5) / this.target) * (this.h + 2 * MARGIN) - MARGIN, 0);
      s.age = SPAWN_STARS + SPAWN_LINES;
      this.shapes.push(s);
    }
    this.last = this.shapes.length ? this.shapes[this.shapes.length - 1].fig : -1;
  }

  private make(fig: number, y: number, off: number): Shape {
    const n = FIGURES[fig].x.length;
    const scale = SHAPE_SCALE_MIN + this.next() * (SHAPE_SCALE_MAX - SHAPE_SCALE_MIN);
    const z = this.next();
    return {
      fig,
      cx: this.w * (0.14 + this.next() * 0.72),
      cy: y + off,
      off,
      z,
      placed: false,
      scale,
      rot: (this.next() * 2 - 1) * SHAPE_ROT_MAX,
      ph: this.next() * 6.283,
      wr: DRIFT_RATE_MIN + this.next() * (DRIFT_RATE_MAX - DRIFT_RATE_MIN),
      driftAmp: DRIFT_AMP_MIN + this.next() * (DRIFT_AMP_MAX - DRIFT_AMP_MIN),
      ox: 0,
      oy: 0,
      th: 0,
      dx: 0,
      dy: 0,
      vx: 0,
      vy: 0,
      wv: 0,
      px: new Array(n).fill(0),
      py: new Array(n).fill(0),
      age: 0,
      retire: -1,
      dir: 0,
      radius: scale * 0.5,
      driveIn: 0,
      heat: 0,
      peakDisp: 0,
      peakRot: 0,
    };
  }

  /** Pick a figure that is neither on screen now nor the one just retired. */
  private chooseFigure(): number {
    const live = new Set(this.shapes.map((s) => s.fig));
    const free: number[] = [];
    for (let i = 0; i < FIGURES.length; i++) if (!live.has(i) && i !== this.last) free.push(i);
    const pool = free.length ? free : FIGURES.map((_, i) => i).filter((i) => !live.has(i));
    const fi = pool[Math.floor(this.next() * pool.length)] ?? 0;
    this.last = fi;
    return fi;
  }

  /**
   * Choose x: out of the text and the media, preferring the margins, and clear
   * of the figures already out there.
   *
   * Clearance is sampled across the whole footprint rather than at the centre
   * only - a figure whose middle is clear but whose left third lands on the
   * navigation rail is not a placement that kept the copy quiet. The candidate
   * list is also clamped by the figure's own radius, so a 320px figure is never
   * spawned a place it cannot fit and get chopped by the right edge.
   */
  private placeX(s: Shape, y0: number, boxes: TextBox[]): number {
    const lo = Math.min(0.45, s.radius / this.w);
    /* A figure spawning off the leading edge has to be judged where it is
       ABOUT to be, not where it starts: a point below the viewport sits in no
       text box at all, so every candidate would look clear and the figure
       would settle into a column of type the moment it arrived. */
    const y = Math.max(24, Math.min(this.h - 24, y0));
    const ts = [0.07, 0.16, 0.27, 0.39, 0.5, 0.61, 0.73, 0.84, 0.93].filter(
      (t) => t >= lo && t <= 1 - lo
    );
    if (!ts.length) return this.w * 0.5;
    const clear = (x: number) => {
      const r = s.radius * 0.5;
      return (
        strengthAt(x, y, boxes, NODE_CEILING) +
        strengthAt(x - r, y, boxes, NODE_CEILING) +
        strengthAt(x + r, y, boxes, NODE_CEILING) +
        strengthAt(x, y - r, boxes, NODE_CEILING) +
        strengthAt(x, y + r, boxes, NODE_CEILING)
      ) / 5;
    };
    let bestX = this.w * 0.5;
    let best = -Infinity;
    for (const t of ts) {
      const x = t * this.w;
      // Clear of the measured copy, and further out is calmer still.
      let score = clear(x) * 4;
      // Prefer the margins, where the columns of type are not.
      score += Math.abs(t - 0.5) * 2 * 1.6;
      for (const o of this.shapes) {
        if (o === s) continue;
        const d = Math.hypot(x - o.cx, y - (o.cy - o.off + o.oy));
        const need = s.radius + o.radius;
        if (d < need) score -= ((need - d) / need) * 8;
      }
      if (score > best) {
        best = score;
        bestX = x;
      }
    }
    return bestX;
  }

  /** Re-seat a shape just past the leading edge, as a different figure. */
  private respawn(s: Shape, y: number, f: Frame, dir: number) {
    s.fig = this.chooseFigure();
    const n = FIGURES[s.fig].x.length;
    s.scale = SHAPE_SCALE_MIN + this.next() * (SHAPE_SCALE_MAX - SHAPE_SCALE_MIN);
    s.radius = s.scale * 0.5;
    s.rot = (this.next() * 2 - 1) * SHAPE_ROT_MAX;
    s.ph = this.next() * 6.283;
    s.wr = DRIFT_RATE_MIN + this.next() * (DRIFT_RATE_MAX - DRIFT_RATE_MIN);
    s.driftAmp = DRIFT_AMP_MIN + this.next() * (DRIFT_AMP_MAX - DRIFT_AMP_MIN);
    s.z = this.next();
    s.px = new Array(n).fill(0);
    s.py = new Array(n).fill(0);
    s.ox = 0;
    s.oy = 0;
    s.th = 0;
    s.vx = 0;
    s.vy = 0;
    s.wv = 0;
    s.age = 0;
    s.retire = -1;
    s.dir = dir;
    s.heat = 0;
    s.driveIn = 0;
    s.peakDisp = 0;
    s.peakRot = 0;
    s.cy = y + s.off;
    s.cx = this.placeX(s, y, f.avoid);
    s.placed = true;
  }

  /** Screen velocity from the last scroll step, so respawn knows the leading edge. */
  private scrollVel = 0;

  scrollStep(dt: number, screenVel: number) {
    /* One parallax factor for the whole shape. The figure moves as a unit, so
       no star ever slides against another because of scrolling. */
    this.scrollVel = screenVel;
    const dir = screenVel > 1 ? -1 : screenVel < -1 ? 1 : 0;
    for (const s of this.shapes) {
      s.off += screenVel * parallaxFor(s.z, false) * dt;
      // Record the direction of travel only while actually travelling, so a
      // pause does not erase which edge the figure is headed for.
      if (dir) s.dir = dir;
    }
  }

  step(dt: number, f: Frame, flow: Flow | null) {
    const cap = NODE_CAP;
    let maxSpeed = 0;
    let maxDisp = 0;
    let maxRot = 0;

    /* Separation first: if two figures would come closer than they may, the one
       further from the cursor has its motion damped, so they never overlap. */
    const damp = new Array(this.shapes.length).fill(1);
    const ptr = f.pointer;
    for (let i = 0; i < this.shapes.length; i++) {
      for (let j = i + 1; j < this.shapes.length; j++) {
        const a = this.shapes[i];
        const b = this.shapes[j];
        const ay = a.cy - a.off + a.dy + a.oy;
        const by = b.cy - b.off + b.dy + b.oy;
        const need = (a.radius + b.radius) * 0.55 + 24;
        const d = Math.hypot(a.cx - b.cx, ay - by);
        if (d >= need) continue;
        const da = ptr ? Math.hypot(a.cx - ptr.x, ay - ptr.y) : 0;
        const db = ptr ? Math.hypot(b.cx - ptr.x, by - ptr.y) : 0;
        const loser = da > db ? i : j;
        damp[loser] = Math.min(damp[loser], 0.3);
      }
    }

    for (let si = 0; si < this.shapes.length; si++) {
      const s = this.shapes[si];
      const fig = FIGURES[s.fig];
      /* --- ambient drift: slow, smooth, and part of the PATH ----------- */
      /* Applied to the position directly rather than fed to the spring as a
         moving target. A spring that has to chase a moving home always lags it
         by (C/K) x its speed - about 4px at 8 px/s with these constants, which
         is more than the 2px the design allows for a figure that has been left
         alone. Making the drift part of where the figure lives instead of what
         it is trying to reach means the spring's error is purely the pointer's
         doing, and it goes back to exactly zero. */
      if (flow) {
        s.ph += dt * s.wr;
        s.dx = Math.sin(s.ph) * s.driftAmp * 0.42 + Math.sin(s.ph * 1.7 + 1.3) * s.driftAmp * 0.3;
        s.dy = Math.cos(s.ph * 0.83 + 0.9) * s.driftAmp * 0.34;
      }

      const y = s.cy - s.off + s.dy;
      const rot = s.rot + s.th;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const half = s.scale * 0.5;

      /* Seeded figures choose their x against the real text boxes, now that
         the first frame has measured them. One frame in, so no one sees it. */
      if (!s.placed && f.avoid.length) {
        s.cx = this.placeX(s, y - s.dy, f.avoid);
        s.placed = true;
      }

      /* --- retire and recycle -------------------------------------------
         A figure retires at the edge it is heading for, while part of it is
         still on screen, so the exit fade is actually seen rather than
         happening somewhere off the page. It is only replaced from the leading
         edge once that fade has finished - and the leading edge is where new
         content arrives: scrolling down sends figures up, so replacements come
         back from below, and scrolling up sends them down. */
      if (s.retire < 0 && s.age > 0.3 && ((s.dir < 0 && y < 0) || (s.dir > 0 && y > this.h))) {
        s.retire = 0;
        this.retired++;
      }
      s.age += dt;
      if (s.retire >= 0) {
        s.retire += dt;
        if (s.retire >= RETIRE_TIME) {
          // It left through the edge it was heading for, so it comes back in
          // through the opposite one: a full figure, clear of the viewport.
          const dir = s.dir || -1;
          this.respawn(s, dir < 0 ? this.h + half * 0.6 : -half * 0.6, f, dir);
          this.born++;
          continue;
        }
      }

      /* --- the rigid transform, shared by every star -------------------- */
      for (let i = 0; i < fig.x.length; i++) {
        const ux = fig.x[i] * s.scale;
        const uy = fig.y[i] * s.scale;
        s.px[i] = s.cx + s.dx + s.ox + ux * cos - uy * sin;
        s.py[i] = y + s.oy + ux * sin + uy * cos;
      }

      /* --- flow response: mean translation, mean curl as rotation ------ */
      let fx = 0;
      let fy = 0;
      let fc = 0;
      let w = 0;
      if (flow) {
        let n = 0;
        for (let i = 0; i < fig.x.length; i++) {
          const [fu, fv] = flow.sample(s.px[i], s.py[i]);
          fx += fu;
          fy += fv;
          fc += flow.curlAt(s.px[i], s.py[i]);
          n++;
        }
        if (n) {
          fx /= n;
          fy /= n;
          fc /= n;
        }
        /* Influence falls off with distance from the cursor, so a figure near
           the sweep moves clearly and one far away barely stirs. */
        if (ptr) {
          const d = Math.hypot(s.cx + s.dx + s.ox - ptr.x, y + s.oy - ptr.y);
          w = smooth(1 - clamp(d / SHAPE_INFLUENCE, 0, 1));
        }
        s.heat = Math.min(1, Math.hypot(fx, fy) / cap);
      }

      /* --- riding the flow ---------------------------------------------
         Two things are needed and only one of them was there. The figure has
         to be held by the field when the field is moving, and it has to be
         let go when it is not.
         The coupling term has a gain of six per second, twenty times the
         spring's stiffness, so even a trace of it swamps the spring: with the
         pointer parked at the edge of the influence radius it was still
         forcing the figure's velocity to about sixths of what the spring
         wanted, and a figure that had been swept turned into one that took six
         seconds to come home. So the coupling now scales with how much flow is
         actually under the figure, and dies away with it.
         `drive` is the distance weight; `entrain` is that weight times how
         strong the field is here. Everything below rides the real flow, never
         a decaying ghost of it. */
      const drive = w * damp[si];
      const entrain = drive * Math.min(1, Math.hypot(fx, fy) / 8);
      /* Published so a test can tell "the pointer missed it" from "the field
         did not move it": two figures under the same sweep are not necessarily
         under the same drive, and separation damping quietly halves one of them. */
      s.driveIn = entrain;
      if (flow && entrain > 0.002) {
        const drag = 1 - Math.exp(-dt * 6 * entrain);
        s.vx += (fx * drive - s.vx) * drag;
        s.vy += (fy * drive - s.vy) * drag;
        s.wv += (fc * CURL_TO_ROT * drive - s.wv) * drag;
      }

      /* --- spring home, so the liquid settles -------------------------- */
      s.vx += (-SHAPE_K * s.ox - SHAPE_C * s.vx) * dt;
      s.vy += (-SHAPE_K * s.oy - SHAPE_C * s.vy) * dt;
      s.wv += (-SHAPE_ROT_K * s.th - SHAPE_ROT_C * s.wv) * dt;

      /* --- caps, eased so onset is never abrupt ------------------------- */
      let v = Math.hypot(s.vx, s.vy);
      if (v > cap) {
        s.vx = (s.vx / v) * cap;
        s.vy = (s.vy / v) * cap;
        v = cap;
      }
      if (v > maxSpeed) maxSpeed = v;
      s.ox += s.vx * dt;
      s.oy += s.vy * dt;
      const travel = Math.hypot(s.ox, s.oy);
      if (travel > s.peakDisp) s.peakDisp = travel;
      if (travel > maxDisp) maxDisp = travel;
      if (Math.abs(s.th) > SHAPE_ROT_CAP) {
        s.th = Math.sign(s.th) * SHAPE_ROT_CAP;
        s.wv = 0;
      }
      s.wv = clamp(s.wv, -1.4, 1.4);
      s.th += s.wv * dt;
      if (Math.abs(s.th) > s.peakRot) s.peakRot = Math.abs(s.th);
      if (Math.abs(s.th) > maxRot) maxRot = Math.abs(s.th);

      /* Rebuild the star positions with this step's rotation and translation,
         so what the tests measure is exactly what gets painted rather than
         where the figure was one tick ago. The transform is rigid by
         construction: one cos/sin pair, one translation, applied to every star. */
      const cos2 = Math.cos(s.rot + s.th);
      const sin2 = Math.sin(s.rot + s.th);
      for (let i = 0; i < fig.x.length; i++) {
        const ux = fig.x[i] * s.scale;
        const uy = fig.y[i] * s.scale;
        s.px[i] = s.cx + s.dx + s.ox + ux * cos2 - uy * sin2;
        s.py[i] = y + s.oy + ux * sin2 + uy * cos2;
      }
    }

    this.maxSpeed = maxSpeed;
    this.maxDisp = maxDisp;
    this.maxRot = maxRot;
    this.deviation = this.measureDeviation();
  }

  /**
   * Worst relative change in any pair of star separations, measured from where
   * the figure is actually drawn. A rigid body scores zero here no matter how
   * far it has travelled or how far it has turned, because translation and
   * rotation preserve every distance - which is exactly what this is checking.
   */
  private measureDeviation(): number {
    let worst = 0;
    for (const s of this.shapes) {
      if (s.retire >= 0 || s.age < SPAWN_STARS + SPAWN_LINES) continue;
      const fig = FIGURES[s.fig];
      const n = fig.x.length;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const bx = (fig.x[i] - fig.x[j]) * s.scale;
          const by = (fig.y[i] - fig.y[j]) * s.scale;
          const built = Math.hypot(bx, by);
          if (built < 1e-6) continue;
          const live = Math.hypot(s.px[i] - s.px[j], s.py[i] - s.py[j]);
          const err = Math.abs(live - built) / built;
          if (err > worst) worst = err;
        }
      }
    }
    return worst;
  }

  onScreen(): number {
    let c = 0;
    for (const s of this.shapes) {
      const y = s.cy - s.off + s.dy + s.oy;
      if (y + s.radius >= 0 && y - s.radius <= this.h) c++;
    }
    return c;
  }

  speeds(): number[] {
    return this.shapes.map((s) => Math.hypot(s.vx, s.vy));
  }

  sampleLayers() {
    let far = 0;
    let farN = 0;
    let near = 0;
    let nearN = 0;
    for (const s of this.shapes) {
      const p = parallaxFor(s.z, false);
      if (p === PARALLAX_FAR) {
        far += s.off;
        farN++;
      } else {
        near += s.off;
        nearN++;
      }
    }
    return { far: farN ? far / farN : 0, mid: 0, near: nearN ? near / nearN : 0, hub: 0, scroll: 0 };
  }

  /** Per-figure records, so the rigid-motion and separation tests can read them. */
  records() {
    return this.shapes.map((s) => ({
      abbr: FIGURES[s.fig].abbr,
      name: FIGURES[s.fig].name,
      x: s.cx + s.dx + s.ox,
      y: s.cy - s.off + s.dy + s.oy,
      /* The flow's displacement from where the figure would otherwise be. This
         is what the return test watches go back to zero: the drift is part of
         the path rather than a target being chased, so nothing here has to
         include it. */
      ox: s.ox,
      oy: s.oy,
      /* The ambient drift, added to the path rather than sprung toward. */
      dx: s.dx,
      dy: s.dy,
      th: s.th,
      scale: s.scale,
      radius: s.radius,
      /** How strongly the field was holding this figure last frame, 0 to 1. */
      drive: s.driveIn,
      alpha: s.retire >= 0 ? 1 - smooth(clamp(s.retire / RETIRE_TIME, 0, 1)) : smooth(clamp(s.age / SPAWN_STARS, 0, 1)),
      drawing: s.retire >= 0 ? 1 : smooth(clamp((s.age - SPAWN_STARS) / SPAWN_LINES, 0, 1)),
      off: s.off,
      z: s.z,
    }));
  }

  /**
   * Every star of every figure at its true screen position, in the same order
   * they are drawn.
   *
   * `positions()` collapses the light theme to one point per figure, which is
   * all the overlay needs and nothing like enough for the shape-fidelity test:
   * the whole claim there is that no pair of stars in a figure ever changes its
   * distance from any other, and a centre point cannot show a shape deforming.
   */
  starPoints() {
    return this.shapes.map((s) => ({
      abbr: FIGURES[s.fig].abbr,
      alpha: s.retire >= 0 ? 1 - smooth(clamp(s.retire / RETIRE_TIME, 0, 1)) : smooth(clamp(s.age / SPAWN_STARS, 0, 1)),
      pts: s.px.map((x, i) => [x, s.py[i]] as [number, number]),
    }));
  }

  draw(ctx: CanvasRenderingContext2D, f: Frame, mix: number, accRGB: string, inkRGB: string) {
    if (mix <= 0.02) return;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1;
    for (const s of this.shapes) {
      const fig = FIGURES[s.fig];
      const y = s.cy - s.off + s.dy;
      const alpha =
        s.retire >= 0 ? 1 - smooth(clamp(s.retire / RETIRE_TIME, 0, 1)) : 1;
      const fade = alpha * mix;
      if (fade <= 0.002) continue;
      const half = s.scale * 0.5;
      if (y + half < -40 || y - half > this.h + 40) continue;

      /* Stars first: they fade in before any line is drawn. */
      const starA = fade * smooth(clamp(s.age / SPAWN_STARS, 0, 1));
      if (starA > 0.004) {
        ctx.fillStyle = `rgba(${inkRGB},1)`;
        for (let i = 0; i < fig.x.length; i++) {
          const q = strengthAt(s.px[i], s.py[i], f.textBoxes, NODE_CEILING);
          const a = STAR_ALPHA * starA * q * f.mix;
          if (a <= 0.004) continue;
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(s.px[i], s.py[i], STAR_R[magTier(fig.mag[i])], 0, Math.PI * 2);
          ctx.fill();
        }
      }

      /* Then the lines, each growing from one star toward the next, staggered
         outward from the brightest star so the figure assembles the way an eye
         would read it. This changes only how much of a line is drawn - never
         where its endpoints are. */
      const lineT = smooth(clamp((s.age - SPAWN_STARS) / SPAWN_LINES, 0, 1));
      if (lineT > 0.004) {
        const order = this.orderFor(s.fig);
        const span = 1 - SPAWN_STAGGER;
        ctx.strokeStyle = `rgba(${accRGB},1)`;
        for (let e = 0; e < fig.edges.length; e++) {
          const [ai, bi] = fig.edges[e];
          const t0 = (order[e] / Math.max(1, fig.edges.length)) * SPAWN_STAGGER;
          const grow = smooth(clamp((lineT - t0) / span, 0, 1));
          if (grow <= 0.02) continue;
          const ax = s.px[ai];
          const ay = s.py[ai];
          const bx = s.px[bi];
          const by = s.py[bi];
          const q = Math.min(
            strengthAt(ax, ay, f.textBoxes, LINK_CEILING),
            strengthAt(bx, by, f.textBoxes, LINK_CEILING),
            strengthAt((ax + bx) / 2, (ay + by) / 2, f.textBoxes, LINK_CEILING)
          );
          const a = LINE_ALPHA * fade * q * f.mix;
          if (a <= 0.003) continue;
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax + (bx - ax) * grow, ay + (by - ay) * grow);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Edge draw order: outward from the brightest star. */
  private orderFor(fi: number): number[] {
    const cached = this.edgeOrder[fi];
    if (cached) return cached;
    const fig = FIGURES[fi];
    let b = 0;
    for (let i = 1; i < fig.mag.length; i++) if (fig.mag[i] < fig.mag[b]) b = i;
    const scored = fig.edges.map(([a, c], i) => ({
      i,
      d: Math.min(
        Math.hypot(fig.x[a] - fig.x[b], fig.y[a] - fig.y[b]),
        Math.hypot(fig.x[c] - fig.x[b], fig.y[c] - fig.y[b])
      ),
    }));
    scored.sort((p, q) => p.d - q.d);
    const order = new Array(fig.edges.length);
    scored.forEach((p, k) => (order[p.i] = k));
    this.edgeOrder[fi] = order;
    return order;
  }
}

/* ------------------------------------------------------------------ facade */

export interface Stats {
  /** Figures resident in the light theme, however many are on screen. */
  constellations: number;
  /** Figures whose centre is inside the viewport: four to seven. */
  onScreen: number;
  stars: number;
  /** Worst relative change in any pair of star separations, as drawn. */
  deviation: number;
  influenced: number;
  born: number;
  retired: number;
  maxSpeed: number;
  peakFlow: number;
}

/** One constellation instance, as the tests read it. */
export interface ShapeRecord {
  abbr: string;
  name: string;
  x: number;
  y: number;
  ox: number;
  oy: number;
  /** Where the ambient drift currently is: a path offset, not a spring target. */
  dx: number;
  dy: number;
  th: number;
  scale: number;
  radius: number;
  /** How strongly the field was holding this figure last frame, 0 to 1. */
  drive: number;
  alpha: number;
  drawing: number;
  off: number;
  z: number;
}

export interface Field {
  draw(f: Frame): void;
  resize(w: number, h: number): void;
  setPalette(ink: string, accent: string): void;
  setSky(colour: string): void;
  backend(): string;
  stats(): Stats;
  sampleLayers(): { far: number; near: number; hub: number; scroll: number };
  speeds(): { shape: number[]; star: number[] };
  positions(): [number, number][];
  /** Per-star velocity vectors, px/s, for the wake's cosine-similarity test. */
  starVelocities(): [number, number][];
  /** Home positions, for the blue-noise separation test. */
  starHomes(): [number, number][];
  /** Displacement from home, so the return test can read a true home error. */
  disp(): [number, number][];
  /** Per-figure state: identity, centre, rigid offsets, rotation, fades. */
  shapes(): ShapeRecord[];
  /** Every constellation star at screen position, for shape-fidelity testing. */
  starPoints(): { abbr: string; alpha: number; pts: [number, number][] }[];
  flowCurl(x: number, y: number): number;
  flowPeak(): number;
  /** The flow at a point, in px/s, for the wake and swirl tests. */
  flowSample(x: number, y: number): [number, number];
}

export function createField(
  canvas: HTMLCanvasElement,
  starCount: number,
  flowEnabled: boolean
): Field | null {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    console.warn('[field] no 2d context; the field is dropped');
    return null;
  }
  const stars = new Stars(starCount);
  /* Sky sizes itself from the viewport: how many figures are out at once is an
     area decision, not a budget passed in from the caller. The mote era's
     nodeCount used to be handed here and was already being ignored. */
  const sky = new Sky();
  // One shared field, so a theme change mid-interaction continues smoothly.
  const flow = flowEnabled ? new Flow() : null;

  let ink: RGB = [0.31, 0.29, 0.26];
  let accent: RGB = [0.1, 0.27, 0.77];
  let starRGB: RGB = [0.9, 0.89, 0.86];
  let w = 1;
  let h = 1;
  let dpr = 1;
  let lastTick = -1;
  let lastMix = 0;
  let scrollFilt = 0;
  let influenced = 0;
  let wasDown = false;

  const rgb = (c: RGB) => `${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)}`;

  /* The click ring starts wide enough to read as a ripple crossing the sky
     rather than a puff under the cursor, and scales with the smaller side of
     the window so it looks the same on a laptop and on a wide monitor. */
  const pulseRadius = () => Math.max(240, Math.min(w, h) * 0.45);

  function resize(nw: number, nh: number) {
    w = Math.max(1, nw);
    h = Math.max(1, nh);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    sky.resize(w, h);
    stars.resize(w, h);
    flow?.resize(w, h);
  }

  function simulate(dt: number, f: Frame, screenVel: number) {
    if (flow) flow.step(dt);

    stars.scrollStep(dt, screenVel);
    sky.scrollStep(dt, screenVel);
    stars.step(dt, f.time, f, flow);
    sky.step(dt, f, flow);
  }

  function draw(f: Frame) {
    lastMix = f.mix;
    const tick = Math.floor(f.time * 60);

    /* A click is an EDGE, not a tick.
       This used to sit inside the catch-up block below, where it ran only on
       frames that had simulation time to catch up on. At 144Hz every other
       frame is one of those, so a press landing entirely between two ticks
       produced no ring at all - the ring's presence depended on frame timing.
       It is tested every frame instead, and the latch is written on exactly the
       path that reads it, so one press makes one ring whatever the frame rate.
       The light theme is deliberately excluded: a click there must inject
       nothing, which is what the light-theme click test asserts. */
    if (flow && f.pointerDown && !wasDown && f.pointer && lastMix < 0.5) {
      /* 140, comfortably under FLOW_MAX's 240, so the ring is born below the
         ceiling and spends its life fading rather than sitting pinned against
         it for the best part of a second. It is still more flow than a fast
         sweep puts beneath a single star, so it reads clearly. */
      flow.pulse(f.pointer.x, f.pointer.y, pulseRadius(), 140);
    }
    wasDown = f.pointerDown;

    if (tick !== lastTick) {
      /* One fixed step of 1/60s per elapsed tick, not per frame.
         Stepping once per frame would make the simulation run in slow motion
         whenever the browser dropped below 60fps, so decay times and settling
         would disagree between a headless run and a headed one. Catching up by
         the number of ticks that actually elapsed keeps simulation time equal
         to wall-clock time at any frame rate. */
      const steps = lastTick < 0 ? 1 : Math.min(6, Math.max(1, tick - lastTick));
      lastTick = tick;
      const dt = 1 / 60;

      /* Scroll velocity, low-passed over about 150ms, soft clamped, then
         applied as *screen* velocity. A fast flick eases in and out rather than
         throwing the sky past the window.

         `f.scrollVel` arrives as a per-frame *distance* - that is the unit the
         browser hands us - and `fieldRate` converts it to a rate using the real
         length of this frame. The conversion, the 7200px/s ceiling and the one
         strength constant live in `scroll-response.ts`; there is no per-frame
         assumption left in this file. */
      const frameSeconds = f.dt && f.dt > 0 ? f.dt : 1 / 60;
      const raw = fieldRate(f.scrollVel, frameSeconds);
      scrollFilt += (raw - scrollFilt) * (1 - Math.exp((-steps * dt) / SCROLL_TAU));
      const screenVel = softClamp(scrollFilt, 900);

      /* Injection is the pointer's contribution for this whole frame, so it
         happens once - doing it per catch-up step would stir harder exactly
         when the browser is already struggling. Same conversion as above, in
         px/s, but no scroll strength applied: this is the cursor, not the page. */
      if (flow) {
        const pvx = rateFromPerFrame(f.pointerVel.x, frameSeconds);
        const pvy = rateFromPerFrame(f.pointerVel.y, frameSeconds);
        const sp = Math.hypot(pvx, pvy);
        if (f.pointer && sp > 1) {
          flow.inject(f.pointer.x, f.pointer.y, softClamp(pvx, 320), softClamp(pvy, 320), POINTER_RADIUS);
        }
      }

      for (let i = 0; i < steps; i++) simulate(dt, f, screenVel);
      influenced = flow ? countInfluenced(f, flow, lastMix, w, h) : 0;
    }

    ctx!.clearRect(0, 0, w, h);
    const inkRGB = rgb(ink);
    const accRGB = rgb(accent);
    const starCol = rgb(starRGB);

    /* ---- the sky ---- */
    if (f.mix < 0.999) {
      const fade = 1 - f.mix;
      ctx!.fillStyle = `rgba(${starCol},1)`;
      for (const s of stars.list) {
        if (s.life <= 0.02 || s.sy < -6 || s.sy > h + 6) continue;
        /* Brightness depends on the twinkle and the flow only, never on scroll
           speed: the sky must not dip or streak while the page moves. */
        const tw = 1 + 0.25 * Math.sin((f.time / s.twPeriod) * Math.PI * 2 + s.twPhase);
        const q = strengthAt(s.sx, s.sy, f.textBoxes, NODE_CEILING);
        const a = Math.min(0.92, s.base * s.life * tw * fade * q * (0.55 + s.z * 0.6) * (1 + s.heat * 0.8));
        if (a <= 0.006) continue;
        ctx!.globalAlpha = a;
        ctx!.beginPath();
        ctx!.arc(s.sx, s.sy, s.r * (1 + s.heat * 0.6), 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    /* ---- the constellations ---- */
    /* Delegated wholesale to Sky. Its look is a set of fixed numbers that must
       not respond to the pointer, the flow, a click or the scroll velocity, and
       it is easier to keep that promise in one place than to trust a second
       copy of the drawing code not to drift. */
    sky.draw(ctx!, f, f.mix, accRGB, inkRGB);
  }

  /** Particles sitting in moving flow, for the debug overlay. */
  function countInfluenced(f: Frame, fl: Flow, mix: number, vw: number, vh: number) {
    const cap = mix > 0.5 ? NODE_CAP : STAR_CAP;
    let n = 0;
    if (mix > 0.5) {
      /* In the light theme a whole figure counts once, judged at its centre:
         all of its stars ride the same shape, so counting them separately
         would report the same event once per star. */
      for (const s of sky.records()) {
        if (s.x < -20 || s.x > vw + 20 || s.y < -20 || s.y > vh + 20) continue;
        const [u, v] = fl.sample(s.x, s.y);
        if (Math.hypot(u, v) > cap * 0.08) n++;
      }
    } else {
      for (const s of stars.list) {
        if (s.sx < -20 || s.sx > vw + 20 || s.sy < -20 || s.sy > vh + 20) continue;
        const [u, v] = fl.sample(s.sx, s.sy);
        if (Math.hypot(u, v) > cap * 0.08) n++;
      }
    }
    void f;
    return n;
  }

  return {
    backend: () => 'canvas2d',
    stats: () => ({
      constellations: sky.shapes.length,
      onScreen: sky.onScreen(),
      /* Named `stars` because that is what Stats declares and what the dark
         probe reads; the number is the whole strip, margin included, rather
         than the on-screen subset - the label in that tool overstates it. */
      stars: stars.list.length,
      /* Worst relative change in any pair of star separations, in the figures
         as actually drawn. A rigid body reads zero here however far it has
         travelled, because translation and rotation cannot change a distance -
         which is the whole claim the light theme makes. */
      deviation: sky.deviation,
      influenced,
      born: sky.born + stars.born,
      retired: sky.retired + stars.retired,
      maxSpeed: Math.max(sky.maxSpeed, stars.maxSpeed),
      peakFlow: flow ? flow.peak : 0,
    }),
    sampleLayers: () => sky.sampleLayers(),
    speeds: () => ({ shape: sky.speeds(), star: stars.speeds() }),
    /* Positions and displacements are deliberately the same length and order,
       so index i in one is index i in the other. A wake measurement that mixed
       a filtered list with an unfiltered one would compare the wrong pairs. */
    positions: () =>
      lastMix > 0.5
        ? sky.records().map((s) => [s.x, s.y] as [number, number])
        : stars.list.map((s) => [s.sx, s.sy] as [number, number]),
    starHomes: () => stars.list.map((s) => [s.hx, s.homeY + MARGIN] as [number, number]),
    starVelocities: () => stars.velocities(),
    disp: () =>
      lastMix > 0.5
        ? sky.records().map((s) => [s.ox, s.oy] as [number, number])
        : stars.list.map((s) => [s.ox, s.oy] as [number, number]),
    /** Per-figure state: identity, centre, translation, rotation, fades. */
    shapes: () => sky.records(),
    starPoints: () => sky.starPoints(),
    flowCurl: (x: number, y: number) => (flow ? flow.curlAt(x, y) : 0),
    flowPeak: () => (flow ? flow.peak : 0),
    flowSample: (x: number, y: number): [number, number] => (flow ? flow.sample(x, y) : [0, 0]),
    resize,
    setPalette(inkToken, accentToken) {
      ink = readColour(inkToken, ink);
      accent = readColour(accentToken, accent);
    },
    setSky(colourToken) {
      starRGB = readColour(colourToken, starRGB);
    },
    draw,
  };
}