'use client'

import Link from "next/link"
import { CSSProperties, useEffect, useRef, useState } from "react";
import styles from "./Logo5.module.scss"

const SIDE = 300;
const TRI_HEIGHT = SIDE * Math.sqrt(3) / 2;
/** Seconds between a tetrahedron starting and its neighbors peeling off */
const GENERATION_DELAY = 0.3;
/** Safety cap for very large viewports */
const MAX_CELLS = 400;

/** How far (px) the pointer chain reaction reaches */
const PULSE_RADIUS = 550;
/** How fast (px/s) the chain reaction travels outward */
const PULSE_SPEED = 900;

/**
 * How much of the pointer's offset from center moves the vanishing point.
 * Negative inverts: the origin swings opposite the pointer, so the field
 * leans toward the cursor instead of away from it.
 */
const ORIGIN_FACTOR = -0.35;

/** Must match the wrapper's perspective in Logo5.module.scss */
const PERSPECTIVE = 4000;
/**
 * Faces tilt 70.53deg from the ground, so they turn edge-on (then backface)
 * once the local view ray tilts past 90 - 70.53 = 19.47deg. Ray tilt is
 * screen-distance-from-origin / perspective, so the origin must never swing
 * far enough that any corner of the viewport exceeds this — edge-on faces
 * render as shimmering slivers that flicker as the origin transitions.
 * 17deg keeps a safety margin.
 */
const MAX_RAY_TILT = Math.tan(17 * Math.PI / 180);

type Cell = {
  key: string;
  x: number;
  y: number;
  deg: number;
  delay: number;
  /**
   * Phase offset for the glint loop. Deliberately NOT derived from `delay`:
   * the growth wave advances ~1.6s per ring, more than half the 2.7s shimmer
   * period, so keying the shimmer to it aliases into a phantom wave that
   * sweeps back inward (wagon-wheel effect). A gentle radial gradient —
   * well under half a period per ring — reads as one outward ripple.
   */
  shimmer: number;
  isSeed: boolean;
  /** Footprint centroid, for pointer distance checks */
  cx: number;
  cy: number;
};

/** Deterministic 0..1 jitter so delays feel organic yet survive re-renders */
const jitter = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
};

/**
 * Flood-fill the viewport with triangular footprints, breadth-first from a
 * seed cell in the middle. Every cell is the same tetrahedron template,
 * translated and rotated in-plane: its local B1->B2 hinge edge is placed on
 * the lattice edge it shares with its parent (interior on the far side), so
 * its first face peels open outward from the parent's face and the other two
 * faces fold on from there.
 */
function buildCells(w: number, h: number): Cell[] {
  const cells: Cell[] = [];
  const seen = new Set<string>();
  const margin = SIDE;

  type Pending = { x: number; y: number; theta: number; delay: number; isSeed: boolean };
  const queue: Pending[] = [
    { x: w / 2 - SIDE / 2, y: h / 2 - TRI_HEIGHT / 3, theta: 0, delay: 0, isSeed: true },
  ];

  while (queue.length && cells.length < MAX_CELLS) {
    const node = queue.shift()!;
    const cos = Math.cos(node.theta), sin = Math.sin(node.theta);
    const at = (px: number, py: number): [number, number] =>
      [node.x + px * cos - py * sin, node.y + px * sin + py * cos];

    const v0: [number, number] = [node.x, node.y];
    const v1 = at(SIDE, 0);
    const v2 = at(SIDE / 2, TRI_HEIGHT);

    const cx = (v0[0] + v1[0] + v2[0]) / 3;
    const cy = (v0[1] + v1[1] + v2[1]) / 3;
    // Identify the cell by its lattice coordinates relative to the seed
    // (centroids sit exactly on a 75px x SIDE*sqrt(3)/6 grid), NOT by rounded
    // pixels: pixel centroids land on .5 boundaries whenever the viewport
    // width is odd, so float noise from different BFS paths rounded the same
    // triangle to different keys — duplicate cells stacked on one spot,
    // replaying the unfold with the longer path's delay.
    const key = `${Math.round((cx - w / 2) / (SIDE / 4))},${Math.round((cy - h / 2) / (TRI_HEIGHT / 3))}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const xs = [v0[0], v1[0], v2[0]], ys = [v0[1], v1[1], v2[1]];
    if (Math.max(...xs) < -margin || Math.min(...xs) > w + margin
      || Math.max(...ys) < -margin || Math.min(...ys) > h + margin) continue;

    cells.push({
      key,
      x: node.x,
      y: node.y,
      deg: Math.round(node.theta * 180 / Math.PI),
      delay: node.delay,
      shimmer: (Math.hypot(cx - w / 2, cy - h / 2) / Math.hypot(w / 2, h / 2)) * 2.7
        + jitter(`shimmer|${key}`) * 0.4,
      isSeed: node.isSeed,
      cx,
      cy,
    });

    // Neighbors across each footprint edge: the child's hinge is this edge
    // reversed, which puts its interior on the opposite side of the lattice
    for (const [a, b] of [[v0, v1], [v1, v2], [v2, v0]] as const) {
      queue.push({
        x: b[0],
        y: b[1],
        theta: Math.atan2(a[1] - b[1], a[0] - b[0]),
        delay: node.delay + GENERATION_DELAY + jitter(`${key}|${Math.round(b[0])},${Math.round(b[1])}`) * 0.1,
        isSeed: false,
      });
    }
  }

  return cells;
}

/**
 * A field of golden tetrahedra seen from directly above, built from CSS
 * triangles on 3D transforms. The seed tetrahedron assembles origami-style
 * in the center; then each neighbor's first face peels outward over their
 * shared ground edge, folds itself into a tetrahedron, and spawns its own
 * neighbors — until the viewport is tiled with shimmering tetrahedra.
 * Base faces are never visible from above, so they aren't drawn.
 */
export default function Logo5() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const sceneRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const compute = () => {
      if (!wrapper.current) return;
      setCells(buildCells(wrapper.current.clientWidth, wrapper.current.clientHeight));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  /**
   * Chain reaction: a one-shot golden flash on every cell within reach,
   * delayed by its distance from the pointer so the pulse visibly travels
   * outward through the neighbors. Web Animations API, so it layers on top
   * of the CSS entrance/shimmer animations without touching them.
   */
  const ripple = (x: number, y: number) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const cell of cells) {
      const dist = Math.hypot(cell.cx - x, cell.cy - y);
      if (dist > PULSE_RADIUS) continue;
      const el = sceneRefs.current.get(cell.key);
      if (!el) continue;
      const strength = 1 - dist / PULSE_RADIUS;
      // Flash the faces, not the scene: a filter is a grouping property that
      // forces transform-style: flat, so animating it on the scene would drop
      // the tetrahedron out of perspective (isometric) for the duration of
      // the flash. On the leaf faces it can't flatten anything, and
      // composite 'add' appends to each face's own brightness shading so the
      // flash multiplies it rather than replacing it.
      for (const face of Array.from(el.children)) {
        face.animate([
          { filter: 'brightness(1) saturate(1)' },
          {
            filter: `brightness(${(1.15 + 0.85 * strength).toFixed(2)}) saturate(${(1 - 0.3 * strength).toFixed(2)})`,
            offset: 0.3,
          },
          { filter: 'brightness(1) saturate(1)' },
        ], {
          duration: 650,
          delay: (dist / PULSE_SPEED) * 1000,
          easing: 'ease-in-out',
          composite: 'add',
        });
      }
    }
  };

  /** Fire the chain reaction from a click or tap */
  const pulseFrom = (clientX: number, clientY: number) => {
    const rect = wrapper.current?.getBoundingClientRect();
    if (!rect) return;
    ripple(clientX - rect.left, clientY - rect.top);
  };

  /** Let the vanishing point chase the pointer (mutates CSS vars directly —
   * no React re-render; the stylesheet's transition supplies the glide) */
  const followPointer = (clientX: number, clientY: number) => {
    const el = wrapper.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Resting origin (above the seed), nudged by a damped, inverted fraction
    // of the pointer's offset from it
    const restX = rect.width / 2;
    const restY = rect.height / 2 - 50;
    let dx = (clientX - rect.left - restX) * ORIGIN_FACTOR;
    let dy = (clientY - rect.top - restY) * ORIGIN_FACTOR;

    // Clamp the swing so the farthest viewport corner stays under the
    // grazing tilt — beyond it, corner faces go edge-on and flicker
    const cornerDist = Math.hypot(
      Math.max(restX, rect.width - restX),
      Math.max(restY, rect.height - restY),
    );
    const allowed = Math.max(0, PERSPECTIVE * MAX_RAY_TILT - cornerDist);
    const swing = Math.hypot(dx, dy);
    if (swing > allowed && swing > 0) {
      dx *= allowed / swing;
      dy *= allowed / swing;
    }

    el.style.setProperty('--origin-x', `${(restX + dx).toFixed(1)}px`);
    el.style.setProperty('--origin-y', `${(restY + dy).toFixed(1)}px`);
  };

  /** Ease the vanishing point back to its resting spot above the seed */
  const releasePointer = () => {
    const el = wrapper.current;
    if (!el) return;
    el.style.removeProperty('--origin-x');
    el.style.removeProperty('--origin-y');
  };

  return (
    <Link href="/">
      <div
        className={styles.wrapper}
        ref={wrapper}
        onPointerDown={e => pulseFrom(e.clientX, e.clientY)}
        onPointerMove={e => followPointer(e.clientX, e.clientY)}
        onPointerLeave={releasePointer}
        onPointerCancel={releasePointer}
      >
        {cells.map(cell => (
          <div
            key={cell.key}
            className={styles.scene}
            ref={el => {
              if (el) sceneRefs.current.set(cell.key, el);
              else sceneRefs.current.delete(cell.key);
            }}
            style={{
              transform: `translate3d(${cell.x}px, ${cell.y}px, 0) rotate(${cell.deg}deg)`,
              '--cell-delay': `${cell.delay.toFixed(2)}s`,
              '--shimmer-delay': `${cell.shimmer.toFixed(2)}s`,
            } as CSSProperties}
          >
            <div className={`${styles.face} ${cell.isSeed ? styles.faceA : styles.peelA}`} />
            <div className={`${styles.face} ${styles.faceB}`} />
            <div className={`${styles.face} ${styles.faceC}`} />
          </div>
        ))}
      </div>
    </Link>
  )
}
