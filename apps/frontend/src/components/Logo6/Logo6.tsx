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
/** The wall is scaled well down so lots of small cubes fit the viewport
 * (must match the .wall transform in Logo6.module.scss) */
const SCALE = 0.4;
/** Safety cap for very large viewports (~113px cubes need ~900 to fill 4K) */
const MAX_CUBES = 900;

/**
 * The cascade: rows open top to bottom, columns from the right, with a
 * slight extra beat on every other row — the wall peels from the top-right.
 * The column beat MUST stay exactly three fold beats (3 * $swing in
 * Logo6.module.scss): each cube unfolds top -> right -> left at one $swing
 * per fold, and its left-hand neighbor's top face peels off this cube's
 * left face the beat after it lands — so the wall reads as one continuous
 * chain of unfolds. The shimmer loops key off this delay too, so the glint
 * travels as the same wave.
 */
const cubeDelay = (row: number, colsFromRight: number) =>
  0.25 * row + 0.06 * ((row + 1) % 2) + 0.36 * colsFromRight;

/**
 * Palette: the hues of the mosaic logo's cycle-0 fills — indigo (#c arm),
 * violet (#b arm), green (#a arm) — plus the shimmer's gold. Each cube wears
 * one hue picked at random, in a randomly lightened or darkened shade; its
 * three faces read as shades of it via the per-face depth filters.
 */
const CUBE_HUES: [number, number, number][] = [
  [48, 65, 168],  // indigo (#3041a8)
  [115, 0, 227],  // violet (#7300e3)
  [0, 200, 0],    // green (#00c800)
  [245, 193, 92], // gold (#f5c15c)
];

/** Deterministic 0..1 hash so each cube's hue survives re-renders/resizes.
 * The multiply-xorshift finalizer matters: a plain polynomial hash gives
 * near-consecutive values for keys that differ only in their trailing
 * digits (`hue|0,1` vs `hue|0,2`), which bucketizes whole rows into one
 * hue; avalanching decorrelates neighboring cubes. */
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

/** A random shade of a random palette hue for the cube at (row, col):
 * darkened up to 25% or lightened up to 45% of the way to white */
const cubeColor = (row: number, col: number): string => {
  const rgb = CUBE_HUES[Math.floor(rand01(`hue|${row},${col}`) * CUBE_HUES.length)];
  const v = rand01(`shade|${row},${col}`) * 0.7 - 0.25;
  const target = v < 0 ? 0 : 255;
  const [r, g, b] = rgb.map(c => Math.round(c + (target - c) * Math.abs(v)));
  return `rgb(${r}, ${g}, ${b})`;
};

type Line = {
  top: number;
  offset: boolean;
  cubes: { delay: number; color: string }[];
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
      color: cubeColor(i, j),
    })),
  }));
}

/**
 * One isometric cube corner: three faces that unfold into place, origami
 * style. The top face swings in around its right edge (peeling off the spot
 * where the previous cube's left face just landed) while it fades in; the
 * right face peels off the top face around their shared edge; the left face
 * peels off the right face around theirs — and the next cube's top face
 * peels off it in turn. Each face carries an inset ::after plate (the gold
 * and the shimmer), so the 2px seams between plates never disturb the fold
 * geometry — see Logo6.module.scss for the hinge math.
 */
type CubeProps = {
  delay: number;
  /** The cube's hue: a random shade of a random CUBE_HUES entry */
  color: string;
  selected: boolean;
  /** Still gliding back after deselection — keeps the cube above the wall */
  returning: boolean;
  /** Inline transform that carries the selected cube to center screen */
  selectedTransform?: string;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** The cube's own transform transition finished */
  onSettled: () => void;
};

function Cube({ delay, color, selected, returning, selectedTransform, onClick, onSettled }: CubeProps) {
  return (
    <div
      className={`${styles.cube}${selected ? ` ${styles.selected}` : ''}${returning ? ` ${styles.returning}` : ''}`}
      style={{
        '--delay': `${delay.toFixed(2)}s`,
        '--cube-color': color,
        ...(selected && selectedTransform ? { transform: selectedTransform } : {}),
      } as CSSProperties}
      onClick={onClick}
      onTransitionEnd={e => {
        // Only the cube's own transform glide, not bubbled plate filters
        if (e.target === e.currentTarget && e.propertyName === 'transform') onSettled();
      }}
    >
      <div className={styles.iso}>
        <div className={styles.content}>
          <div className={`${styles.face} ${styles.top}`}/>
          <div className={`${styles.face} ${styles.right}`}/>
          <div className={`${styles.face} ${styles.left}`}/>
        </div>
      </div>
    </div>
  );
}

/**
 * A wall of isometric cubes, dressed in the mosaic logo's cycle-0 ramps,
 * that unfolds cube by cube from the top-right corner until it covers the
 * viewport, then shimmers — a port of the cubes-mask transition from
 * Transformation_ADN, rebuilt with per-cube animation delays instead of
 * scripted timers.
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
    ? `translate(${selected.dx.toFixed(1)}px, ${selected.dy.toFixed(1)}px) scale(3) perspective(4000px) rotateY(180deg)`
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
                    delay={cube.delay}
                    color={cube.color}
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
