'use client'

import Link from "next/link"
import { CSSProperties, useEffect, useRef, useState } from "react";
import styles from "./Logo8.module.scss"

// The drawn SVG template, transcribed: circles of r=500 stacked every 250
// (half a radius) in columns 968 apart, alternating white/black. Outer-style
// columns stack upward (higher circles paint over lower ones, so each circle
// shows only its bottom crescent); the alternate columns stack downward
// (showing top crescents); and columns paint over the ones to their left.
// Everything scaled to 0.2 of the drawn size so more waves fit the viewport.
const SCALE = 0.3;
/** Circle radius (was 500) */
const R = 500 * SCALE;
/** Vertical step between circles in a column (was 250) */
const VSTEP = 500 * SCALE;
/** Horizontal distance between column centers (was 968) */
const COL_PITCH = 1000 * SCALE;
/** Safety cap for very large viewports */
const MAX_CIRCLES = 800;

type Circle = { top: number; z: number; white: boolean };
type Column = { x: number; circles: Circle[] };
type Stripe = { top: number; white: boolean };

/** Horizontal bands R tall on multiples of R, alternating like the circles */
function buildStripes(h: number): Stripe[] {
  const nMin = -1;
  const nMax = Math.ceil(h / R);
  return Array.from({ length: nMax - nMin + 1 }, (_, i) => {
    const n = nMin + i;
    return {
      top: n * R,
      white: ((n % 2) + 2) % 2 === 0,
    };
  });
}

function buildColumns(w: number, h: number): Column[] {
  const colCount = Math.min(Math.ceil(w / COL_PITCH) + 1, 40);
  // Circle centers sit on multiples of VSTEP; run from one diameter above
  // the viewport to one below so crescents at the edges stay covered
  const kMin = Math.floor(-2 * R / VSTEP);
  const kMax = Math.min(
    Math.ceil((h + 2 * R) / VSTEP),
    kMin + Math.floor(MAX_CIRCLES / Math.max(1, colCount)),
  );

  return Array.from({ length: colCount }, (_, c) => ({
    x: c * COL_PITCH,
    circles: Array.from({ length: kMax - kMin + 1 }, (_, i) => {
      const k = kMin + i;
      return {
        top: k * VSTEP - R,
        // Even columns: higher circles on top (bottom crescents show).
        // Odd columns: lower circles on top (top crescents show).
        z: c % 2 === 0 ? kMax - k : k - kMin,
        // The drawn alternation: white on odd steps, black on even
        white: ((k % 2) + 2) % 2 === (c % 2 === 0 ? 1 : 0),
      };
    }),
  }));
}

/**
 * The wave template from the drawn SVG, rebuilt as plain positioned divs so
 * the pattern can fill any viewport (no viewBox) and each crescent is a real
 * element we can animate later.
 */
export default function Logo8() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [stripes, setStripes] = useState<Stripe[]>([]);

  useEffect(() => {
    const compute = () => {
      if (!wrapper.current) return;
      setColumns(buildColumns(wrapper.current.clientWidth, wrapper.current.clientHeight));
      setStripes(buildStripes(wrapper.current.clientHeight));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  return (
    <Link href="/">
      <div
        className={styles.wrapper}
        ref={wrapper}
        style={{ '--d': `${2 * R}px` } as CSSProperties}
      >
        <div className={styles.stripes}>
          {stripes.map((stripe, i) => (
            <div
              key={i}
              className={`${styles.stripe} ${stripe.white ? styles.white : styles.black}`}
              style={{ top: `${stripe.top.toFixed(1)}px` }}
            />
          ))}
        </div>
        {/* Diamond-plate texture: pairs of little strokes on a diagonal
            lattice, neighbors perpendicular, blended with difference — black
            strokes on white waves, white on black. The stud tile is a mask;
            the two drifting gradient sheets inside supply each stud's
            opacity, so the field shimmers in crossing diagonal waves */}
        <div className={styles.hatch} aria-hidden>
          <div className={`${styles.shimmerWave} ${styles.waveA}`} />
          <div className={`${styles.shimmerWave} ${styles.waveB}`} />
        </div>
        {columns.map((column, c) => (
          // Each column is its own stacking context (like the SVG's paint
          // order: every column paints over the ones to its left)
          <div
            key={c}
            className={styles.column}
            style={{ left: `${column.x}px`, zIndex: c + 1 }}
          >
            {column.circles.map((circle, i) => (
              <div
                key={i}
                className={`${styles.circle} ${circle.white ? styles.white : styles.black}`}
                style={{ top: `${circle.top.toFixed(1)}px`, zIndex: circle.z }}
              />
            ))}
          </div>
        ))}
      </div>
    </Link>
  )
}
