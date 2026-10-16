'use client'

import Link from "next/link"
import { CSSProperties, useEffect, useRef, useState } from "react";
import styles from "./Vasarely.module.scss"

/** Grid pitch; tiles are 2px smaller, leaving the family's black seams */
const PITCH = 92;
/** Safety cap for very large viewports */
const MAX_TILES = 600;

/** How far (px) the click chain reaction reaches */
const PULSE_RADIUS = 620;
/** How fast (px/s) it travels outward */
const PULSE_SPEED = 1100;

/** Bulge sphere radius as a share of the wrapper's short side, clamped */
const SPHERE_SHARE = 0.42;
const SPHERE_MIN = 170;
const SPHERE_MAX = 340;
/** The cap is a third of the sphere's surface: height 2R/3, so the cutting
 * plane sits R/3 above the sphere's center and the base radius is R·√(8/9) */
const CAP_PLANE = 1 / 3;
const CAP_BASE = Math.sqrt(1 - CAP_PLANE * CAP_PLANE);
/** Eye distance above the grid, in sphere radii. Must stay above 8/3 so the
 * whole cap faces the eye (no fold-over); just above it the flanks
 * foreshorten hard, which is what makes the dome read */
const EYE = 3;
/** Glide time constants (s) for the bulge's position and height */
const FOLLOW_TAU = 0.11;
const HEIGHT_TAU = 0.22;
/** At rest (pointer away) the bulge breathes between these cap fractions */
const IDLE_MIN = 0.28;
const IDLE_MAX = 0.48;
const BREATHE_PERIOD = 6.5;
/** The bulge rises once the entrance bloom has played */
const RISE_DELAY = 2.2;

/** The aurora anchors from Logo's mosaic: teal, cyan, violet, purple,
 * magenta, pink, orange, gold */
const AURORA_HUES = [172, 195, 258, 285, 318, 345, 12, 42];

const hue = (band: number, bright: boolean) =>
  `hsl(${AURORA_HUES[((band % 8) + 8) % 8]}, ${bright ? 84 : 76}%, ${bright ? 60 : 52}%)`;

/** Deterministic 0..1 jitter, stable across re-renders */
const jitter = (row: number, col: number) => ((row * 67 + col * 113) % 83) / 83;

type Tile = {
  key: string;
  row: number;
  col: number;
  x: number;
  y: number;
  /** Tile center, also used by the ripple's distance math */
  cx: number;
  cy: number;
  delay: number;
  bg: string;
  disc: string;
};

function buildTiles(w: number, h: number): Tile[] {
  const cols = Math.min(Math.ceil(w / PITCH) + 1, 40);
  const rows = Math.min(
    Math.ceil(h / PITCH) + 1,
    Math.max(1, Math.floor(MAX_TILES / Math.max(1, cols))),
  );

  const tiles: Tile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * PITCH;
      const y = r * PITCH;
      const cx = x + PITCH / 2 - 1;
      const cy = y + PITCH / 2 - 1;
      // Two-tile-wide diagonal bands walk the aurora wheel; the checker
      // parity swaps square and disc colors — Vasarely's alternation
      const band = Math.floor((r + c) / 2);
      const parity = (r + c) % 2 === 0;
      tiles.push({
        key: `${r}-${c}`,
        row: r,
        col: c,
        x,
        y,
        cx,
        cy,
        // The entrance blooms radially from the grid center
        delay: Math.hypot(cx - w / 2, cy - h / 2) * 0.0009 + jitter(r, c) * 0.25,
        bg: hue(band + (parity ? 0 : 3), !parity),
        disc: hue(band + (parity ? 3 : 0), parity),
      });
    }
  }
  return tiles;
}

/**
 * The 2D projective transform [a b c; d e f; g h 1] taking the unit square
 * onto the quad p0..p3 (clockwise from top-left) — Heckbert's square-to-quad.
 */
function squareToQuad(q: Float64Array): number[] {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0;
  let h = 0;
  const den = dx1 * dy2 - dx2 * dy1;
  // A parallelogram is affine (g = h = 0); anything else needs perspective
  if (Math.abs(dx3) + Math.abs(dy3) > 1e-9 && Math.abs(den) > 1e-12) {
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  return [
    x1 - x0 + g * x1, x3 - x0 + h * x3, x0,
    y1 - y0 + g * y1, y3 - y0 + h * y3, y0,
    g, h,
  ];
}

/**
 * Homage to Victor Vasarely's Vega series: a polychromatic checker grid
 * distorted by a spherical bulge. Under the pointer the grid rises into a cap
 * of a third of a sphere (height 2R/3), seen in perspective from straight
 * above it.
 *
 * Rigid tiles can't cover a sphere — any tilt opens cracks between them. So
 * the surface is solved on the grid's CORNERS: each corner is lifted onto the
 * sphere and projected, and each tile gets the projective matrix3d that
 * stretches its pitch cell onto the four projected corners it shares with its
 * neighbours. Shared corners joined by straight edges can't drift apart, so
 * however steep the flank, the only gaps are the designed 2px seams. Discs
 * swell with height, the bulge glides after the pointer and breathes at rest,
 * and clicks send a chain-reaction flash through the grid.
 */
export default function Vasarely() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const tileRefs = useRef(new Map<string, HTMLDivElement>());
  /** Pointer position in wrapper px; null while the pointer is away */
  const target = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const compute = () => {
      const el = wrapper.current;
      if (!el) return;
      setTiles(buildTiles(el.clientWidth, el.clientHeight));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  useEffect(() => {
    const el = wrapper.current;
    if (!el || tiles.length === 0) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cols = tiles[tiles.length - 1].col + 1;
    const rows = tiles[tiles.length - 1].row + 1;
    const stride = cols + 1;
    /** Projected corner lattice, (rows+1) × (cols+1), xy interleaved */
    const corners = new Float64Array((rows + 1) * stride * 2);
    const quad = new Float64Array(8);
    /** Tiles warped last frame, so they're flattened once the bulge leaves */
    let warped = new Set<Tile>();

    let bx = el.clientWidth / 2;
    let by = el.clientHeight / 2;
    let height = 0;
    const startedAt = performance.now();
    let last = startedAt;
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const elapsed = (now - startedAt) / 1000;
      const w = el.clientWidth;
      const h = el.clientHeight;

      // Glide toward the pointer (or home to center); rise to the full cap
      // under the pointer, breathe gently at rest
      const aim = target.current ?? { x: w / 2, y: h / 2 };
      const follow = reduced ? 1 : 1 - Math.exp(-dt / FOLLOW_TAU);
      bx += (aim.x - bx) * follow;
      by += (aim.y - by) * follow;
      let goal: number;
      if (target.current) goal = 1;
      else if (reduced) goal = IDLE_MIN;
      else {
        const phase = (1 - Math.cos((elapsed / BREATHE_PERIOD) * Math.PI)) / 2;
        goal = IDLE_MIN + (IDLE_MAX - IDLE_MIN) * phase;
      }
      if (!reduced && elapsed < RISE_DELAY) goal = 0;
      height += (goal - height) * (reduced ? 1 : 1 - Math.exp(-dt / HEIGHT_TAU));

      const R = Math.min(SPHERE_MAX, Math.max(SPHERE_MIN, Math.min(w, h) * SPHERE_SHARE));
      const base = R * CAP_BASE;
      const plane = R * CAP_PLANE;
      const eye = R * EYE;

      // Lift the corners inside the cap onto the sphere (scaled by the current
      // height) and project them from the eye above the bulge's center
      const reach = base + PITCH;
      const c0 = Math.max(0, Math.floor((bx - reach) / PITCH));
      const c1 = Math.min(cols, Math.ceil((bx + reach) / PITCH));
      const r0 = Math.max(0, Math.floor((by - reach) / PITCH));
      const r1 = Math.min(rows, Math.ceil((by + reach) / PITCH));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const dx = c * PITCH - bx;
          const dy = r * PITCH - by;
          const d2 = dx * dx + dy * dy;
          const z = d2 < base * base ? height * (Math.sqrt(R * R - d2) - plane) : 0;
          const k = eye / (eye - z);
          const i = (r * stride + c) * 2;
          corners[i] = bx + dx * k;
          corners[i + 1] = by + dy * k;
        }
      }

      const next = new Set<Tile>();
      for (const tile of tiles) {
        const node = tileRefs.current.get(tile.key);
        if (!node) continue;
        const { row: r, col: c } = tile;
        const tdx = tile.x + PITCH / 2 - bx;
        const tdy = tile.y + PITCH / 2 - by;
        const d2 = tdx * tdx + tdy * tdy;
        // A tile is warped while any of its corners can be inside the cap
        const near = height > 1e-3 && r >= r0 && r < r1 && c >= c0 && c < c1
          && d2 < (base + PITCH * 0.75) ** 2;
        if (!near) {
          if (warped.has(tile)) {
            node.style.transform = '';
            node.style.removeProperty('--lift');
          }
          continue;
        }
        next.add(tile);

        const i0 = (r * stride + c) * 2;
        const i3 = i0 + stride * 2;
        quad[0] = corners[i0]; quad[1] = corners[i0 + 1];
        quad[2] = corners[i0 + 2]; quad[3] = corners[i0 + 3];
        quad[4] = corners[i3 + 2]; quad[5] = corners[i3 + 3];
        quad[6] = corners[i3]; quad[7] = corners[i3 + 1];
        const [a, b, tx, d, e, ty, g, hh] = squareToQuad(quad);
        // Tile px → unit cell (÷PITCH) → wrapper px → relative to the tile's
        // own left/top (transform-origin 0 0); matrix3d is column-major
        const m11 = (a - tile.x * g) / PITCH, m12 = (b - tile.x * hh) / PITCH;
        const m21 = (d - tile.y * g) / PITCH, m22 = (e - tile.y * hh) / PITCH;
        const m31 = g / PITCH, m32 = hh / PITCH;
        node.style.transform =
          `matrix3d(${m11},${m21},0,${m31},${m12},${m22},0,${m32},0,0,1,0,${tx - tile.x},${ty - tile.y},0,1)`;

        // The tile center's height on the dome, 0 flat → 1 at the apex
        const lift = d2 < base * base
          ? (height * (Math.sqrt(R * R - d2) - plane)) / (R - plane)
          : 0;
        node.style.setProperty('--lift', lift.toFixed(3));
      }
      warped = next;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [tiles]);

  /** The bulge chases the pointer; the render loop supplies the glide */
  const followPointer = (clientX: number, clientY: number) => {
    const el = wrapper.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    target.current = { x: clientX - rect.left, y: clientY - rect.top };
  };

  /** Ease the bulge back to center, down to its resting breath */
  const releasePointer = () => {
    target.current = null;
  };

  /** Chain reaction: a brightness flash sweeping outward from the click */
  const pulse = (clientX: number, clientY: number) => {
    const el = wrapper.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (const tile of tiles) {
      const dist = Math.hypot(tile.cx - x, tile.cy - y);
      if (dist > PULSE_RADIUS) continue;
      const node = tileRefs.current.get(tile.key);
      if (!node) continue;
      const strength = 1 - dist / PULSE_RADIUS;
      node.animate([
        { filter: 'brightness(1)' },
        { filter: `brightness(${(1.2 + strength).toFixed(2)})`, offset: 0.3 },
        { filter: 'brightness(1)' },
      ], {
        duration: 600,
        delay: (dist / PULSE_SPEED) * 1000,
        easing: 'ease-in-out',
        composite: 'add',
      });
    }
  };

  return (
    <Link href="/">
      <div
        className={styles.wrapper}
        ref={wrapper}
        onPointerMove={e => followPointer(e.clientX, e.clientY)}
        onPointerLeave={releasePointer}
        onPointerCancel={releasePointer}
        onPointerDown={e => pulse(e.clientX, e.clientY)}
      >
        {tiles.map(tile => (
          <div
            key={tile.key}
            className={styles.tile}
            ref={node => {
              if (node) tileRefs.current.set(tile.key, node);
              else tileRefs.current.delete(tile.key);
            }}
            style={{
              left: `${tile.x}px`,
              top: `${tile.y}px`,
              backgroundColor: tile.bg,
              '--d': `${tile.delay.toFixed(2)}s`,
            } as CSSProperties}
          >
            <div className={styles.disc} style={{ backgroundColor: tile.disc }} />
          </div>
        ))}
      </div>
    </Link>
  )
}
