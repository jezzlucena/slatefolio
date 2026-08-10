'use client'

import Link from "next/link"
import { CSSProperties, useEffect, useRef, useState } from "react";
import styles from "./Logo6.module.scss"

// Grid metrics: the exact isometric lattice. The demo advanced 278/240 to
// deliberately overlap cubes and seal cracks; we tile edge-to-edge instead so
// the plate insets read as uniform seams.
/** Horizontal advance per cube: silhouette width, 200px * sqrt(2) */
const COL_PITCH = 282.843;
/** Vertical advance per row: 200 * (cos35deg + sin35deg * cos45deg) */
const ROW_PITCH = 244.949;
/** The wall is blown up slightly, so fewer cubes cover the viewport */
const SCALE = 1.14;
/** Safety cap for very large viewports */
const MAX_CUBES = 400;

/**
 * The demo's cascade: rows open top to bottom, columns from the right, with
 * a slight extra beat on every other row — the wall peels from the top-right.
 */
const cubeDelay = (row: number, colsFromRight: number) =>
  0.25 * row + 0.12 * ((row + 1) % 2) + 0.4 * colsFromRight;

/** Deterministic mix of hinge orientations, stable across re-renders */
const orientation = (row: number, col: number): 'top' | 'left' =>
  (row * 7 + col * 13) % 3 === 0 ? 'top' : 'left';

/**
 * Per-cube shimmer phase, 0..12s: hash-scattered (NOT a spatial gradient) so
 * adjacent cubes sit at very different points of their glint loops
 */
const shimmerPhase = (row: number, col: number) =>
  ((row * 73 + col * 131) % 97) / 97 * 12;

type Line = {
  top: number;
  offset: boolean;
  cubes: { delay: number; shimmer: number; from: 'top' | 'left' }[];
};

function buildLines(w: number, h: number): Line[] {
  const cols = Math.min(Math.ceil(w / (COL_PITCH * SCALE)) + 2, 40);
  const rows = Math.min(
    Math.ceil(h / (ROW_PITCH * SCALE)) + 2,
    Math.max(1, Math.floor(MAX_CUBES / Math.max(1, cols))),
  );

  return Array.from({ length: rows }, (_, i) => ({
    top: i * ROW_PITCH,
    offset: i % 2 === 1,
    cubes: Array.from({ length: cols }, (_, j) => ({
      delay: cubeDelay(i, cols - j),
      shimmer: shimmerPhase(i, j),
      from: orientation(i, j),
    })),
  }));
}

/**
 * One isometric cube corner: three faces that unfold into place. The whole
 * three-face assembly starts folded 270deg behind its top or right hinge and
 * swings in; then the left face folds out around its left edge and the
 * bottom face around its bottom edge. Each face is a full-size hinge (which
 * carries the fold and its exact transform-origin) holding an inset plate
 * (which carries the gold and the shimmer), so the 2px seams between plates
 * never disturb the fold geometry.
 */
type CubeProps = {
  from: 'top' | 'left';
  delay: number;
  /** Phase offset for the glint loops, decorrelated from neighbors */
  shimmer: number;
  selected: boolean;
  /** Still gliding back after deselection — keeps the cube above the wall */
  returning: boolean;
  /** Inline transform that carries the selected cube to center screen */
  selectedTransform?: string;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** The cube's own transform transition finished */
  onSettled: () => void;
};

function Cube({ from, delay, shimmer, selected, returning, selectedTransform, onClick, onSettled }: CubeProps) {
  return (
    <div
      className={`${styles.cube}${selected ? ` ${styles.selected}` : ''}${returning ? ` ${styles.returning}` : ''}`}
      style={{
        '--delay': `${delay.toFixed(2)}s`,
        '--shimmer-delay': `${shimmer.toFixed(2)}s`,
        ...(selected && selectedTransform ? { transform: selectedTransform } : {}),
      } as CSSProperties}
      onClick={onClick}
      onTransitionEnd={e => {
        // Only the cube's own transform glide, not bubbled plate filters
        if (e.target === e.currentTarget && e.propertyName === 'transform') onSettled();
      }}
    >
      <div className={styles.iso}>
        <div className={`${styles.content} ${from === 'top' ? styles.fromTop : styles.fromLeft}`}>
          <div className={`${styles.hinge} ${styles.faceRight}`}><div className={styles.plate} /></div>
          <div className={`${styles.hinge} ${styles.faceLeft}`}><div className={styles.plate} /></div>
          <div className={`${styles.hinge} ${styles.faceBottom}`}><div className={styles.plate} /></div>
        </div>
      </div>
    </div>
  );
}

/**
 * A wall of golden isometric cubes that unfolds cube by cube from the
 * top-right corner until it covers the viewport, then shimmers — a faithful
 * port of the cubes-mask transition from Transformation_ADN, rebuilt with
 * per-cube animation delays instead of scripted timers.
 */
export default function Logo6() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [selected, setSelected] = useState<{ id: string; dx: number; dy: number } | null>(null);
  // Deselected but still gliding home; stays elevated until its transition ends
  const [returning, setReturning] = useState<string | null>(null);

  const deselect = () => {
    if (!selected) return;
    setReturning(selected.id);
    setSelected(null);
  };

  useEffect(() => {
    const compute = () => {
      if (!wrapper.current) return;
      setSelected(null);
      setReturning(null);
      setLines(buildLines(wrapper.current.clientWidth, wrapper.current.clientHeight));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  /**
   * Select a cube: measure how far its center sits from the wrapper's center
   * in screen px, then convert to the cube's own coordinate space (the wall
   * is scaled) so an inline translate lands it dead center. A click while
   * anything is selected deselects instead.
   */
  const handleCubeClick = (e: React.MouseEvent<HTMLDivElement>, id: string) => {
    // The wall lives inside a Link — selection clicks must not navigate
    e.preventDefault();
    e.stopPropagation();
    if (selected) {
      deselect();
      return;
    }
    const wrap = wrapper.current?.getBoundingClientRect();
    if (!wrap) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setSelected({
      id,
      dx: (wrap.left + wrap.width / 2 - (rect.left + rect.width / 2)) / SCALE,
      dy: (wrap.top + wrap.height / 2 - (rect.top + rect.height / 2)) / SCALE,
    });
  };

  /** Clicks on seams/background: deselect if something is selected,
   * otherwise let the Link do its usual navigation */
  const handleWrapperClick = (e: React.MouseEvent) => {
    if (!selected) return;
    e.preventDefault();
    e.stopPropagation();
    deselect();
  };

  // Keep the transform's function list identical to the .cube base transform
  // so the transition interpolates each function instead of matrix-morphing
  const selectedTransform = selected
    ? `translate(${selected.dx.toFixed(1)}px, ${selected.dy.toFixed(1)}px) scale(1.8) perspective(4000px) rotateX(180deg)`
    : undefined;

  return (
    <Link href="/">
      <div className={styles.wrapper} ref={wrapper} onClick={handleWrapperClick}>
        <div className={styles.wall}>
          {lines.map((line, i) => (
            <div
              key={i}
              className={`${styles.line} ${line.offset ? styles.lineOffset : ''}`}
              style={{ top: `${line.top}px` }}
            >
              {line.cubes.map((cube, j) => {
                const id = `${i}-${j}`;
                return (
                  <Cube
                    key={j}
                    from={cube.from}
                    delay={cube.delay}
                    shimmer={cube.shimmer}
                    selected={selected?.id === id}
                    returning={returning === id}
                    selectedTransform={selectedTransform}
                    onClick={e => handleCubeClick(e, id)}
                    onSettled={() => setReturning(cur => (cur === id ? null : cur))}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Link>
  )
}
