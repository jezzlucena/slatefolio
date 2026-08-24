'use client'

import Link from "next/link"
import { CSSProperties, useEffect, useRef, useState } from "react";
import styles from "./Logo9.module.scss"

/**
 * Glitch transmission — a broken broadcast. The viewport is a test card of
 * vertical bars in the family's aurora hues, cut into horizontal scan bands.
 * Every band paints the same image (so the picture reads as one continuous
 * card while calm) and tears sideways on its own clock: the band translates,
 * its red and cyan channel layers drift apart (the channel-split math lives
 * in the SCSS module), and quantized macroblocks flash over the top.
 * Scanlines, crawling static and a VHS tracking band ride above everything;
 * a CRT power-on flash is the entrance; a click slams every band sideways
 * (WAAPI with composite: 'add', so the jolt stacks on top of each band's CSS
 * tear loop instead of fighting it for the transform).
 *
 * All variation is deterministic — rand01 keyed by slice/block index, clicks
 * reseeded by a click counter — so re-renders and resizes never reshuffle
 * the artwork.
 */

/** Safety cap for very large viewports */
const MAX_SLICES = 160;
/** Macroblock quantization grid (px) — corruption snaps to it, like codec damage */
const BLOCK_GRID = 36;
/** Peak click-jolt amplitude (px). Counted in the SCSS overscan budget. */
const JOLT_AMP = 120;

/** The aurora anchors shared across the logo family (see Logo, Logo7) */
const AURORA_HUES = [172, 195, 258, 285, 318, 345, 12, 42];

/** Deterministic 0..1 hash, stable across re-renders and resizes */
const rand01 = (i: number, salt: number) =>
  (((i * 197 + salt * 89) * 137 + (i + salt) * 71) % 997) / 997;

type Slice = {
  top: number;
  height: number;
  /** Tear jump distance (px, signed). |jx| ≤ 250 — see the SCSS overscan budget */
  jx: number;
  /** Chromatic-aberration offset at the tear (px) */
  split: number;
  /** Tear cycle length (s) — every band glitches on its own clock */
  gt: number;
  /** Negative start delay (s) so the clocks are desynchronized from frame one */
  gd: number;
};

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  /** Flash cycle length / negative start delay (s), same scheme as slices */
  bt: number;
  bd: number;
};

/** Cut the viewport height into scan bands: mostly thin ribbons, some tall
 * stable regions, so tears read as damage to one picture rather than stripes */
function buildSlices(h: number): Slice[] {
  const slices: Slice[] = [];
  let y = 0;
  for (let i = 0; y < h && slices.length < MAX_SLICES; i++) {
    const kind = rand01(i, 11);
    const height = Math.ceil(
      kind < 0.5 ? 7 + rand01(i, 13) * 14
      : kind < 0.85 ? 20 + rand01(i, 13) * 34
      : 56 + rand01(i, 13) * 72,
    );
    // ~1 in 6 bands is a "big tear" — a violent jump with a wide color split;
    // the rest jitter by a few px so the card never sits perfectly still
    const big = rand01(i, 5) < 0.16;
    const dir = rand01(i, 7) < 0.5 ? -1 : 1;
    const gt = 1.7 + rand01(i, 19) * 3.6;
    slices.push({
      top: y,
      height,
      jx: Math.round(dir * (big ? 90 + rand01(i, 17) * 160 : 6 + rand01(i, 17) * 30)),
      split: +(1.5 + rand01(i, 23) * (big ? 7 : 3.5)).toFixed(1),
      gt: +gt.toFixed(2),
      gd: +(-rand01(i, 29) * gt).toFixed(2),
    });
    y += height;
  }
  return slices;
}

/** Sparse corrupted macroblocks, positions and sizes quantized to BLOCK_GRID */
function buildBlocks(w: number, h: number): Block[] {
  const cols = Math.max(1, Math.ceil(w / BLOCK_GRID));
  const rows = Math.max(1, Math.ceil(h / BLOCK_GRID));
  const count = Math.min(64, Math.floor((cols * rows) / 18));
  return Array.from({ length: count }, (_, i) => {
    const bt = 2.6 + rand01(i, 61) * 5.8;
    // ~30% of blocks are dropouts (near-black holes); the rest flash a
    // saturated aurora hue at one of three quantized lightness levels
    const dark = rand01(i, 47) < 0.3;
    return {
      x: Math.floor(rand01(i, 31) * cols) * BLOCK_GRID,
      y: Math.floor(rand01(i, 37) * rows) * BLOCK_GRID,
      w: (1 + Math.floor(rand01(i, 41) * 3)) * BLOCK_GRID,
      h: (1 + Math.floor(rand01(i, 43) * 2)) * BLOCK_GRID,
      color: dark
        ? '#060606'
        : `hsl(${AURORA_HUES[Math.floor(rand01(i, 53) * 8) % 8]}, 90%, ${45 + Math.floor(rand01(i, 59) * 3) * 10}%)`,
      bt: +bt.toFixed(2),
      bd: +(-rand01(i, 67) * bt).toFixed(2),
    };
  });
}

export default function Logo9() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [slices, setSlices] = useState<Slice[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const sliceRefs = useRef(new Map<number, HTMLDivElement>());
  /** Click counter — each click is a fresh deterministic seed for the jolt */
  const tick = useRef(0);

  useEffect(() => {
    const compute = () => {
      const el = wrapper.current;
      if (!el) return;
      setSlices(buildSlices(el.clientHeight));
      setBlocks(buildBlocks(el.clientWidth, el.clientHeight));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  /** Manual interference: slam every band sideways for a beat. WAAPI with
   * composite: 'add' rides on top of the CSS tear loop's transform; the
   * steps() easing keeps the motion snapping instead of sliding. */
  const jolt = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = ++tick.current;
    for (let i = 0; i < slices.length; i++) {
      const node = sliceRefs.current.get(i);
      if (!node) continue;
      const amp = (rand01(i, t * 7 + 1) - 0.5) * 2 * JOLT_AMP;
      node.animate([
        { transform: 'translateX(0px)' },
        { transform: `translateX(${amp.toFixed(0)}px)` },
        { transform: `translateX(${(-0.35 * amp).toFixed(0)}px)` },
        { transform: 'translateX(0px)' },
      ], {
        duration: 380,
        delay: rand01(i, t * 3 + 2) * 130,
        easing: 'steps(1, end)',
        composite: 'add',
      });
    }
  };

  return (
    <Link href="/">
      <div className={styles.wrapper} ref={wrapper} onPointerDown={jolt}>
        {/* .field carries the occasional whole-picture sync-loss shift, so
            the wrapper (the overflow clip) never moves */}
        <div className={styles.field}>
          {slices.map((slice, i) => (
            <div
              key={i}
              className={styles.slice}
              ref={node => {
                if (node) sliceRefs.current.set(i, node);
                else sliceRefs.current.delete(i);
              }}
              style={{
                top: `${slice.top}px`,
                height: `${slice.height}px`,
                '--jx': slice.jx,
                '--split': slice.split,
                '--gt': `${slice.gt}s`,
                '--gd': `${slice.gd}s`,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className={styles.blocks} aria-hidden>
          {blocks.map((block, i) => (
            <div
              key={i}
              className={styles.block}
              style={{
                left: `${block.x}px`,
                top: `${block.y}px`,
                width: `${block.w}px`,
                height: `${block.h}px`,
                backgroundColor: block.color,
                '--bt': `${block.bt}s`,
                '--bd': `${block.bd}s`,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className={styles.roll} aria-hidden />
        <div className={styles.noise} aria-hidden />
        <div className={styles.scanlines} aria-hidden />
        <div className={styles.boot} aria-hidden />
      </div>
    </Link>
  )
}
