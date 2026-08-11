'use client'

import Link from "next/link"
import { CSSProperties, useEffect, useRef, useState } from "react";
import styles from "./Logo5.module.scss"

const SIDE = 180;
const TRI_HEIGHT = SIDE * Math.sqrt(3) / 2;
/** Seconds between a tetrahedron starting and its neighbors peeling off
 * (shorter than the 300px-tile era: smaller tiles mean more generations
 * to the viewport edge, and this keeps the total fill time similar) */
const GENERATION_DELAY = 0.2;
/** Safety cap for very large viewports (180px tiles need ~750 to fill 4K) */
const MAX_CELLS = 800;

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

/** How far (px) a selected tetrahedron rises toward the camera. The
 * perspective magnifies it by PERSPECTIVE / (PERSPECTIVE - SELECT_Z), so
 * 2200px turns a 180px tile into a ~400px centerpiece. */
const SELECT_Z = 2200;

/** Pointer travel (px) between down and up beyond which the release is a
 * drag (rotating the selected tetrahedron), not a tap that dismisses it */
const DRAG_PX = 8;
/**
 * Faces tilt 70.53deg from the ground, so they turn edge-on (then backface)
 * once the local view ray tilts past 90 - 70.53 = 19.47deg. Ray tilt is
 * screen-distance-from-origin / perspective, so the origin must never swing
 * far enough that any corner of the viewport exceeds this — edge-on faces
 * render as shimmering slivers that flicker as the origin transitions.
 * 17deg keeps a safety margin.
 */
const MAX_RAY_TILT = Math.tan(17 * Math.PI / 180);

/**
 * Palette: the aurora gradient from Logo.tsx — teal, violet, magenta, gold
 * stops as [hue, saturation, lightness] — flowing top to bottom across the
 * viewport, exactly like the mosaic's gradient phase (teal apex to gold
 * base). Each tetrahedron samples the gradient at its centroid's height; its
 * three faces read as shades of that color via the per-face brightness
 * filters in Logo5.module.scss, and the shimmer glints around it.
 */
const AURORA_STOPS: [number, number, number][] = [
  [172, 78, 55], // teal
  [258, 84, 66], // violet
  [318, 80, 62], // magenta
  [402, 92, 60], // gold (402 = 42 + 360, so the hue keeps rising smoothly)
];

/** Piecewise-linear sample of the aurora at t in [0, 1] — a port of
 * Logo.tsx's auroraAt */
const auroraAt = (t: number): string => {
  const pos = Math.min(Math.max(t, 0), 1) * (AURORA_STOPS.length - 1);
  const i = Math.min(Math.floor(pos), AURORA_STOPS.length - 2);
  const frac = pos - i;
  const [h1, s1, l1] = AURORA_STOPS[i];
  const [h2, s2, l2] = AURORA_STOPS[i + 1];
  const h = Math.round((h1 + (h2 - h1) * frac) % 360);
  const s = Math.round(s1 + (s2 - s1) * frac);
  const l = Math.round(l1 + (l2 - l1) * frac);
  return `hsl(${h}, ${s}%, ${l}%)`;
};

type Cell = {
  key: string;
  x: number;
  y: number;
  deg: number;
  /** The cell's color: the aurora gradient sampled at its centroid's height */
  color: string;
  /**
   * Unfold start time. Also drives the shimmer phase (see Logo5.module.scss):
   * each cell's glint loop starts a fixed beat after its own unfold, so the
   * shimmer sweeps outward as the same wave the growth traced. Safe from
   * wagon-wheel aliasing because the delay advances ~0.2-0.3s per ring,
   * well under half the 2.7s shimmer period.
   */
  delay: number;
  isSeed: boolean;
  /** Footprint centroid, for pointer distance checks */
  cx: number;
  cy: number;
};

/** Deterministic 0..1 hash so delay jitter feels organic yet survives
 * re-renders and resizes (the multiply-xorshift finalizer decorrelates
 * near-identical keys — same helper as Logo6's) */
const rand01 = (key: string): number => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
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
    // (centroids sit exactly on a SIDE/4 x SIDE*sqrt(3)/6 grid), NOT by rounded
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
      color: auroraAt(cy / h),
      delay: node.delay,
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
        delay: node.delay + GENERATION_DELAY + rand01(`${key}|${Math.round(b[0])},${Math.round(b[1])}`) * 0.1,
        isSeed: false,
      });
    }
  }

  return cells;
}

/**
 * A field of aurora-tinted tetrahedra seen from directly above, built from
 * CSS triangles on 3D transforms. The seed tetrahedron assembles origami-style
 * in the center; then each neighbor's first face peels outward over their
 * shared ground edge, folds itself into a tetrahedron, and spawns its own
 * neighbors — until the viewport is tiled with shimmering tetrahedra.
 *
 * Clicking a tetrahedron lifts it front and center (a translate3d glide up
 * the z axis); while selected it rotates to follow the pointer (or a touch
 * drag), and a tap or click anywhere sends it gliding back. The base face
 * exists only for this — a rotated tetrahedron would show a hollow shell
 * without it — so it is only mounted while its cell is selected or
 * gliding home.
 */
export default function Logo5() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const solidRefs = useRef(new Map<string, HTMLDivElement>());
  /** The lifted tetrahedron: its key, in-plane rotation (for screen-aligned
   * spin axes), and the inline transform that centers it */
  const [selected, setSelected] = useState<{ key: string; deg: number; transform: string } | null>(null);
  // Dismissed but still gliding home; keeps the cell above the field
  const [returning, setReturning] = useState<string | null>(null);
  /** Where the current press started, to tell taps from rotation drags */
  const downAt = useRef<[number, number] | null>(null);
  /** rAF throttle for pointermove: only the latest position is applied, once
   * per frame — raw events can arrive several times per frame on 120Hz+
   * pointers, each one re-measuring rects and retargeting transitions */
  const pointerFrame = useRef(0);
  const lastPointer = useRef<[number, number]>([0, 0]);

  const cancelPointerFrame = () => {
    if (pointerFrame.current) {
      cancelAnimationFrame(pointerFrame.current);
      pointerFrame.current = 0;
    }
  };

  useEffect(() => {
    const compute = () => {
      if (!wrapper.current) return;
      setSelected(null);
      setReturning(null);
      // The cells are rebuilt but keyed elements are reused, so any inline
      // pointer rotation must not survive into the new layout
      for (const el of solidRefs.current.values()) el.style.removeProperty('transform');
      setCells(buildCells(wrapper.current.clientWidth, wrapper.current.clientHeight));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('resize', compute);
      cancelPointerFrame();
    };
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
      const el = solidRefs.current.get(cell.key);
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
    // A queued frame must not re-apply the vars right after the release
    cancelPointerFrame();
    const el = wrapper.current;
    if (!el) return;
    el.style.removeProperty('--origin-x');
    el.style.removeProperty('--origin-y');
  };

  /** One pointer effect per frame: the latest position drives either the
   * selected tetrahedron's rotation or the vanishing-point chase */
  const handlePointerMove = (clientX: number, clientY: number) => {
    lastPointer.current = [clientX, clientY];
    if (pointerFrame.current) return;
    pointerFrame.current = requestAnimationFrame(() => {
      pointerFrame.current = 0;
      const [x, y] = lastPointer.current;
      if (selected) rotateSelected(x, y);
      else followPointer(x, y);
    });
  };

  /** True when the pointer traveled since pointerdown — a rotation drag
   * releasing, not a tap */
  const wasDrag = (e: React.MouseEvent) =>
    !!downAt.current && Math.hypot(e.clientX - downAt.current[0], e.clientY - downAt.current[1]) > DRAG_PX;

  /** Send the selected tetrahedron gliding home: the scene transitions back
   * to its lattice transform, the solid untwists to its stylesheet identity */
  const dismiss = () => {
    if (!selected) return;
    // A queued rotation frame would re-twist the solid mid-glide home
    cancelPointerFrame();
    solidRefs.current.get(selected.key)?.style.removeProperty('transform');
    setReturning(selected.key);
    setSelected(null);
  };

  /**
   * Rotate the lifted tetrahedron with the pointer: its position maps to a
   * full spin across the viewport width and a base-revealing tilt across the
   * height. The two outer rotates conjugate away the cell's in-plane lattice
   * rotation, so the spin axes read screen-aligned for every cell. Mutates
   * the style directly — the .solid transition supplies the glide.
   */
  const rotateSelected = (clientX: number, clientY: number) => {
    if (!selected) return;
    const el = solidRefs.current.get(selected.key);
    const rect = wrapper.current?.getBoundingClientRect();
    if (!el || !rect) return;
    const spin = (((clientX - rect.left) / rect.width - 0.5) * 360).toFixed(1);
    // Negative: dragging down pulls the near side down (grabbing the solid),
    // rather than cranking it away like a wheel
    const tilt = (((clientY - rect.top) / rect.height - 0.5) * -180).toFixed(1);
    el.style.transform =
      `rotate(${-selected.deg}deg) rotateX(${tilt}deg) rotateY(${spin}deg) rotate(${selected.deg}deg)`;
  };

  /**
   * Select a tetrahedron: lift it SELECT_Z toward the camera and center it.
   * The magnified centroid must land at the viewport center, and perspective
   * scales positions away from the resting perspective-origin (50px above
   * center), so the pre-projection target is pulled toward that origin.
   * A click while anything is selected dismisses instead.
   */
  const handleCellClick = (e: React.MouseEvent, cell: Cell) => {
    // The field lives inside a Link — selection clicks must not navigate
    e.preventDefault();
    e.stopPropagation();
    if (wasDrag(e)) return;
    if (selected) {
      dismiss();
      return;
    }
    const rect = wrapper.current?.getBoundingClientRect();
    if (!rect) return;
    releasePointer(); // park the vanishing point while inspecting
    const mag = PERSPECTIVE / (PERSPECTIVE - SELECT_Z);
    const originY = rect.height / 2 - 50; // rest perspective-origin (see SCSS)
    const targetX = rect.width / 2;
    const targetY = originY + (rect.height / 2 - originY) / mag;
    setSelected({
      key: cell.key,
      deg: cell.deg,
      transform: `translate3d(${(cell.x + targetX - cell.cx).toFixed(1)}px, ${(cell.y + targetY - cell.cy).toFixed(1)}px, ${SELECT_Z}px) rotate(${cell.deg}deg)`,
    });
  };

  /** Taps on the seams/background dismiss if something is selected,
   * otherwise fall through to the Link's navigation */
  const handleWrapperClick = (e: React.MouseEvent) => {
    if (!selected) return;
    e.preventDefault();
    e.stopPropagation();
    if (!wasDrag(e)) dismiss();
  };

  return (
    <Link href="/">
      <div
        className={styles.wrapper}
        ref={wrapper}
        // While a tetrahedron is selected, touch drags rotate it instead of
        // scrolling the page
        style={{ touchAction: selected ? 'none' : undefined }}
        onClick={handleWrapperClick}
        onPointerDown={e => {
          downAt.current = [e.clientX, e.clientY];
          if (!selected) pulseFrom(e.clientX, e.clientY);
        }}
        onPointerMove={e => handlePointerMove(e.clientX, e.clientY)}
        onPointerLeave={releasePointer}
        onPointerCancel={releasePointer}
      >
        {cells.map(cell => {
          const isSelected = selected?.key === cell.key;
          return (
            <div
              key={cell.key}
              className={`${styles.scene}${isSelected ? ` ${styles.selected}` : ''}${returning === cell.key ? ` ${styles.returning}` : ''}`}
              style={{
                transform: isSelected
                  ? selected.transform
                  : `translate3d(${cell.x}px, ${cell.y}px, 0) rotate(${cell.deg}deg)`,
                '--cell-delay': `${cell.delay.toFixed(2)}s`,
                '--cell-color': cell.color,
              } as CSSProperties}
              onClick={e => handleCellClick(e, cell)}
              onTransitionEnd={e => {
                // Only the scene's own glide home, not bubbled face effects
                if (e.target === e.currentTarget && e.propertyName === 'transform')
                  setReturning(cur => (cur === cell.key ? null : cur));
              }}
            >
              <div
                className={styles.solid}
                ref={el => {
                  if (el) solidRefs.current.set(cell.key, el);
                  else solidRefs.current.delete(cell.key);
                }}
              >
                {(isSelected || returning === cell.key) && (
                  <div className={`${styles.face} ${styles.faceBase}`} />
                )}
                <div className={`${styles.face} ${cell.isSeed ? styles.faceA : styles.peelA}`} />
                <div className={`${styles.face} ${styles.faceB}`} />
                <div className={`${styles.face} ${styles.faceC}`} />
              </div>
            </div>
          );
        })}
      </div>
    </Link>
  )
}
