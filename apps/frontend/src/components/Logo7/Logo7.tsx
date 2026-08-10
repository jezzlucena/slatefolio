'use client'

import Link from "next/link"
import { CSSProperties, useEffect, useRef, useState } from "react";
import styles from "./Logo7.module.scss"

/** Grid pitch; tiles are 2px smaller, leaving the family's black seams */
const PITCH = 92;
/** Safety cap for very large viewports */
const MAX_TILES = 600;

/** How far (px) the click chain reaction reaches */
const PULSE_RADIUS = 620;
/** How fast (px/s) it travels outward */
const PULSE_SPEED = 1100;

/** The aurora anchors from Logo's mosaic: teal, cyan, violet, purple,
 * magenta, pink, orange, gold */
const AURORA_HUES = [172, 195, 258, 285, 318, 345, 12, 42];

const hue = (band: number, bright: boolean) =>
  `hsl(${AURORA_HUES[((band % 8) + 8) % 8]}, ${bright ? 84 : 76}%, ${bright ? 60 : 52}%)`;

/** Deterministic 0..1 jitter, stable across re-renders */
const jitter = (row: number, col: number) => ((row * 67 + col * 113) % 83) / 83;

type Tile = {
  key: string;
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
 * Homage to Victor Vasarely's Vega series: a polychromatic checker grid
 * distorted by a spherical bulge — except here the bulge is real 3D. A
 * registered --bump-x/--bump-y/--amp trio (inherited by every tile) drives a
 * per-tile gaussian computed with CSS exp(): tiles lift toward the viewer,
 * tilt like a sphere's surface, and their discs swell inside the bulge. The
 * bump chases the pointer through custom-property transitions, breathes on
 * its own when idle, and clicks send a chain-reaction flash through the grid.
 */
export default function Logo7() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const tileRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const compute = () => {
      const el = wrapper.current;
      if (!el) return;
      setTiles(buildTiles(el.clientWidth, el.clientHeight));
      // Rest the bulge at the grid center (unitless numbers, in wrapper px)
      el.style.setProperty('--bump-x', `${el.clientWidth / 2}`);
      el.style.setProperty('--bump-y', `${el.clientHeight / 2}`);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  /** The bulge chases the pointer; the CSS transition supplies the glide */
  const followPointer = (clientX: number, clientY: number) => {
    const el = wrapper.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--bump-x', `${(clientX - rect.left).toFixed(1)}`);
    el.style.setProperty('--bump-y', `${(clientY - rect.top).toFixed(1)}`);
  };

  /** Ease the bulge back to center when the pointer leaves */
  const releasePointer = () => {
    const el = wrapper.current;
    if (!el) return;
    el.style.setProperty('--bump-x', `${el.clientWidth / 2}`);
    el.style.setProperty('--bump-y', `${el.clientHeight / 2}`);
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
              '--tx': tile.cx,
              '--ty': tile.cy,
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
