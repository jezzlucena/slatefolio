'use client'

import Link from "next/link"
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
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

// Entrance choreography (ms): after load the pattern assembles in waves —
// the striped backdrop fades in bottom-up, then each row of crescents blooms
// bottom-up with the wave rolling left to right, and the plus/cross
// texture fades in last. Every element carries its own --delay custom
// property; the SCSS keyframes just honor it.
/** One row of the sweep per beat (stripes and circle rows share the cadence
 * because VSTEP === R) */
const ROW_BEAT = 150;
/** Left-to-right roll within a wave */
const COL_BEAT = 35;
/** Circles trail the stripe sweep by this much */
const CIRCLE_LEAD = 400;
/** Longest entrance animation: must match the .hatch fade (1s) in
 * Logo8.module.scss, which outlasts the 0.6s circle bloom */
const ENTRANCE_ANIM_MS = 1000;

// ————— Plus/cross texture & knock-off interaction —————
// The tile geometry lives here (not in the SCSS) because it is the single
// source of truth for three consumers that must agree exactly: the hatch's
// mask tile (inline style below), the pointer hit-testing against glyph
// positions, and the holes punched where bits were knocked off.
/** Tile viewBox size. Glyphs are drawn at the same unit sizes as the
 * original 48-unit tile, so the 64-unit tile adds spacing, not glyph size */
const TILE_UNITS = 64;
/** On-screen tile: 58.7px keeps the original glyph scale (44px / 48 units) */
const TILE_PX = 58.7;
/** Screen px per tile unit */
const UNIT = TILE_PX / TILE_UNITS;
/** The +/x glyphs sit at (32a, 32b) tile units for a ≡ b (mod 2): 'x' when
 * both are even (tile corners), '+' when both are odd (tile centers) */
const GLYPH_STEP_U = 32;
/** Dashes sit at (16 + 32m, 16 + 32n), rotated +45deg when m + n is even
 * (each lies along the diagonal connecting the two glyphs it separates) */
const DASH_OFFSET_U = 16;
const PLUS_PATH = 'M-6 0 H6 M0 -6 V6';
const DASH_PATH = 'M-3 0 H3';
// One tile of the pattern (must draw the corner 'x' at all four corners so
// the repeat is seamless). Path/rotation data must match PLUS_PATH/DASH_PATH
// and the lattice constants above.
const TILE_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cg stroke='white' stroke-width='2' stroke-linecap='round' fill='none'%3E%3Cg transform='translate(32 32)'%3E%3Cpath d='${PLUS_PATH}'/%3E%3C/g%3E%3Cg transform='translate(0 0) rotate(45)'%3E%3Cpath d='${PLUS_PATH}'/%3E%3C/g%3E%3Cg transform='translate(64 0) rotate(45)'%3E%3Cpath d='${PLUS_PATH}'/%3E%3C/g%3E%3Cg transform='translate(0 64) rotate(45)'%3E%3Cpath d='${PLUS_PATH}'/%3E%3C/g%3E%3Cg transform='translate(64 64) rotate(45)'%3E%3Cpath d='${PLUS_PATH}'/%3E%3C/g%3E%3Cg transform='translate(16 16) rotate(45)'%3E%3Cpath d='${DASH_PATH}'/%3E%3C/g%3E%3Cg transform='translate(48 16) rotate(-45)'%3E%3Cpath d='${DASH_PATH}'/%3E%3C/g%3E%3Cg transform='translate(16 48) rotate(-45)'%3E%3Cpath d='${DASH_PATH}'/%3E%3C/g%3E%3Cg transform='translate(48 48) rotate(45)'%3E%3Cpath d='${DASH_PATH}'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;
/** Pointer must pass within these radii (tile units) to knock a bit off
 * while grazing (hover / touch-drag) */
const GLYPH_KNOCK_U = 12;
const DASH_KNOCK_U = 9;
/** Burst (click or drag-less tap) radius, tile units (~119px on screen) */
const BURST_RADIUS_U = 130;
/** Burst knock probability is (1 - d/radius)^2: certain at the epicenter,
 * vanishing at the rim */
const BURST_FALLOFF_EXP = 2;
/** The burst detaches bits as an expanding shockwave: each bit's fall is
 * delayed by its distance from the epicenter at this rate */
const BURST_WAVE_MS_PER_U = 1.5;
/** A press that moves no farther than this (px) counts as a click/tap;
 * anything longer is a drag, which knocks by grazing instead */
const TAP_SLOP_PX = 8;
/** Hole radii punched into the mask — enough to fully erase a glyph
 * (arm 6u + stroke half-width + round cap ≈ 7.4u) without grazing the
 * neighboring dashes 22.6u away */
const GLYPH_HOLE_U = 9;
const DASH_HOLE_U = 5.5;
/** Fixed intrinsic size of the holes mask layer (px). Knocked-off glyphs
 * never respawn, so ALL holes live in this one extra SVG mask layer (the
 * layer count stays at 2 however much gets mowed down); the fixed size
 * keeps the holes pixel-anchored to the top-left, like the tile itself,
 * across window resizes */
const HOLES_LAYER_PX = 8192;

/** Deterministic 0..1 hash (same helper as Logo3/Logo5/Logo6 — the family
 * convention is per-component copies, not a shared util). Seeded by bit id,
 * so a given glyph always falls with the same trajectory. */
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

type Circle = { top: number; z: number; white: boolean; delay: number };
type Column = { x: number; circles: Circle[] };
type Stripe = { top: number; white: boolean; delay: number };
type BitKind = 'plus' | 'cross' | 'dash';
/** A glyph knocked out of the pattern — permanently: the entry stays in the
 * map forever, feeding the mask hole and blocking a re-knock; only the
 * falling clone is transient (removed once `fallen`) */
type Bit = {
  x: number; y: number;      // glyph center, px in wrapper space
  kind: BitKind;
  tilt: number;              // dash lattice rotation (+/-45), 0 for +/x
  dx: number;                // horizontal drift over the whole fall, px
  hop: number;               // initial upward pop, px (negative = up)
  spin: number;              // total rotation, deg
  fall: number;              // vertical distance to clear the viewport, px
  dur: number;               // fall duration, s
  delay: number;             // detach delay, ms (burst shockwave stagger)
  fallen: boolean;           // fall finished: clone element removed
};

/** Extra impulse a burst gives a bit; grazes use the defaults */
type Shove = {
  delay?: number;    // ms before the bit detaches
  dxBias?: number;   // radial horizontal push away from the epicenter, px
  hopBoost?: number; // multiplier on the upward pop
  hopBias?: number;  // extra upward launch (negative px) for bits above the epicenter
};

function makeBit(
  id: string, xu: number, yu: number, kind: BitKind, tilt: number,
  viewportH: number, shove: Shove = {},
): [string, Bit] {
  const { delay = 0, dxBias = 0, hopBoost = 1, hopBias = 0 } = shove;
  const x = xu * UNIT;
  const y = yu * UNIT;
  const fall = viewportH - y + 80; // +80 so a spinning bit fully clears
  return [id, {
    x, y, kind, tilt,
    // Burst bits drift mostly along their radial shove (small jitter);
    // grazed bits tumble whichever way the hash says
    dx: dxBias + (rand01(`${id}:dx`) - 0.5) * (dxBias !== 0 ? 40 : 90),
    hop: -(8 + rand01(`${id}:hop`) * 18) * hopBoost + hopBias,
    spin: (rand01(`${id}:spin`) - 0.5) * 1080,
    // Free-fall-ish timing: duration grows with the square root of the
    // drop, plus a hash-jittered fudge for the hop segment
    dur: 0.25 + Math.sqrt(Math.max(fall, 0) / 900) * (0.9 + rand01(`${id}:t`) * 0.25),
    fall,
    delay,
    fallen: false,
  }];
}

/** Visits every lattice site (+/x glyphs and dashes) whose center lies in
 * the given tile-unit bounding box */
function forEachSite(
  x0: number, y0: number, x1: number, y1: number,
  visit: (id: string, xu: number, yu: number, kind: BitKind, tilt: number) => void,
) {
  // +/x lattice at (32a, 32b), a ≡ b (mod 2): 'x' when both even, '+' odd
  for (let a = Math.ceil(x0 / GLYPH_STEP_U); a * GLYPH_STEP_U <= x1; a++) {
    for (let b = Math.ceil(y0 / GLYPH_STEP_U); b * GLYPH_STEP_U <= y1; b++) {
      if (((a + b) % 2 + 2) % 2 !== 0) continue; // parity mismatch: no glyph
      const cross = ((a % 2) + 2) % 2 === 0; // both even: corner 'x'
      visit(`g${a}:${b}`, a * GLYPH_STEP_U, b * GLYPH_STEP_U, cross ? 'cross' : 'plus', 0);
    }
  }
  // Dash lattice at (16 + 32m, 16 + 32n)
  for (let m = Math.ceil((x0 - DASH_OFFSET_U) / GLYPH_STEP_U); DASH_OFFSET_U + m * GLYPH_STEP_U <= x1; m++) {
    for (let n = Math.ceil((y0 - DASH_OFFSET_U) / GLYPH_STEP_U); DASH_OFFSET_U + n * GLYPH_STEP_U <= y1; n++) {
      const tilt = ((m + n) % 2 + 2) % 2 === 0 ? 45 : -45;
      visit(`d${m}:${n}`, DASH_OFFSET_U + m * GLYPH_STEP_U, DASH_OFFSET_U + n * GLYPH_STEP_U, 'dash', tilt);
    }
  }
}

/** Grazing (hover / touch-drag): everything the pointer touches at (px, py)
 * within the per-kind knock radii */
function hitBits(px: number, py: number, viewportH: number): [string, Bit][] {
  const hits: [string, Bit][] = [];
  const ux = px / UNIT;
  const uy = py / UNIT;
  const reach = Math.max(GLYPH_KNOCK_U, DASH_KNOCK_U);
  forEachSite(ux - reach, uy - reach, ux + reach, uy + reach, (id, xu, yu, kind, tilt) => {
    const r = kind === 'dash' ? DASH_KNOCK_U : GLYPH_KNOCK_U;
    if (Math.hypot(ux - xu, uy - yu) > r) return;
    hits.push(makeBit(id, xu, yu, kind, tilt, viewportH));
  });
  return hits;
}

/** Click/tap burst at (px, py): knocks a whole radius loose, densest at the
 * epicenter and sparser toward the rim, each bit shoved radially outward
 * and detaching in an expanding shockwave. The salt keeps repeat taps on
 * the same spot from re-rolling identical survivors (still no
 * Math.random — same tap sequence, same debris). */
function burstBits(px: number, py: number, viewportH: number, salt: number): [string, Bit][] {
  const hits: [string, Bit][] = [];
  const cx = px / UNIT;
  const cy = py / UNIT;
  const seed = `burst:${Math.round(cx)}:${Math.round(cy)}:${salt}`;
  forEachSite(
    cx - BURST_RADIUS_U, cy - BURST_RADIUS_U, cx + BURST_RADIUS_U, cy + BURST_RADIUS_U,
    (id, xu, yu, kind, tilt) => {
      const d = Math.hypot(xu - cx, yu - cy);
      if (d > BURST_RADIUS_U) return;
      const t = d / BURST_RADIUS_U;
      // Density falloff: knock probability 1 at the center, ~0 at the rim
      if (rand01(`${seed}:${id}`) >= (1 - t) ** BURST_FALLOFF_EXP) return;
      // Radial shove away from the epicenter, strongest at the center; a
      // dead-center bit gets a hash-picked direction
      const angle = rand01(`${seed}:${id}:a`) * 2 * Math.PI;
      const dirX = d < 1 ? Math.cos(angle) : (xu - cx) / d;
      const dirY = d < 1 ? Math.sin(angle) : (yu - cy) / d;
      const push = 10 + 85 * (1 - t);
      hits.push(makeBit(id, xu, yu, kind, tilt, viewportH, {
        delay: d * BURST_WAVE_MS_PER_U,
        dxBias: dirX * push,
        hopBoost: 1 + (1 - t) * 1.2,
        // Bits above the epicenter also launch upward; ones below just drop
        hopBias: Math.min(dirY * push * 0.5, 0),
      }));
    },
  );
  return hits;
}

/** Horizontal bands R tall on multiples of R, alternating like the circles */
function buildStripes(h: number): Stripe[] {
  const nMin = -1;
  const nMax = Math.ceil(h / R);
  return Array.from({ length: nMax - nMin + 1 }, (_, i) => {
    const n = nMin + i;
    return {
      top: n * R,
      white: ((n % 2) + 2) % 2 === 0,
      // Bottom-up: the lowest band leads the sweep
      delay: (nMax - n) * ROW_BEAT,
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
        // Bottom-up rows, each wave rolling left to right
        delay: CIRCLE_LEAD + (kMax - k) * ROW_BEAT + c * COL_BEAT,
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
  // Once the entrance has played, .settled turns the animations off so
  // elements added by a later resize don't bloom in on their stale delays
  const [settled, setSettled] = useState(false);
  // Every glyph ever knocked out of the hatch this mount — permanent, so
  // holes never regrow and a fallen glyph can't be knocked twice
  const [bits, setBits] = useState<Map<string, Bit>>(new Map());

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

  // Last wave's start; also when the hatch texture begins fading in
  const maxDelay = useMemo(
    () =>
      columns.reduce(
        (max, column) => column.circles.reduce((m, circle) => Math.max(m, circle.delay), max),
        0,
      ),
    [columns],
  );

  useEffect(() => {
    if (settled || columns.length === 0) return;
    const timer = setTimeout(() => setSettled(true), maxDelay + ENTRANCE_ANIM_MS + 100);
    return () => clearTimeout(timer);
  }, [columns, maxDelay, settled]);

  // Where the current press started, for telling taps from drags
  const press = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  // Merge new knocks into the map; re-renders only when a still-attached
  // glyph was actually hit
  const addBits = (hits: [string, Bit][]) => {
    setBits((prev) => {
      const fresh = hits.filter(([id]) => !prev.has(id));
      if (fresh.length === 0) return prev;
      const next = new Map(prev);
      for (const [id, bit] of fresh) next.set(id, bit);
      return next;
    });
  };

  // Grazing (mouse hover, or a touch DRAG) knocks single bits along the path
  const graze = (event: React.PointerEvent) => {
    if (!wrapper.current) return;
    const rect = wrapper.current.getBoundingClientRect();
    addBits(hitBits(event.clientX - rect.left, event.clientY - rect.top, rect.height));
  };

  const pressStart = (event: React.PointerEvent) => {
    press.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  // A press that ends without dragging (click / tap) sets off a radial burst
  const pressEnd = (event: React.PointerEvent) => {
    const start = press.current;
    press.current = null;
    if (!start || start.pointerId !== event.pointerId || !wrapper.current) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP_PX) return;
    const rect = wrapper.current.getBoundingClientRect();
    addBits(burstBits(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.height,
      bits.size, // salt: repeat taps on one spot roll fresh rim survivors
    ));
  };

  // A clone finished falling: drop its element (the map entry stays — it
  // keeps the mask hole open and the glyph un-knockable forever)
  const markFallen = (id: string) => {
    setBits((prev) => {
      const bit = prev.get(id);
      if (!bit || bit.fallen) return prev;
      const next = new Map(prev);
      next.set(id, { ...bit, fallen: true });
      return next;
    });
  };

  // The hatch mask: the pattern tile minus every hole, all holes drawn as
  // circles in ONE extra SVG layer that the tile layer 'subtract's — two
  // mask layers total no matter how much of the pattern has been knocked
  // off. Standard mask-composite: modern Chromium/Firefox/Safari; if
  // unsupported, glyphs simply stay put behind their falling clones.
  const holesMask = useMemo(() => {
    if (bits.size === 0) return null;
    const circles = [...bits.values()]
      .map((bit) =>
        `%3Ccircle cx='${bit.x.toFixed(1)}' cy='${bit.y.toFixed(1)}' r='${((bit.kind === 'dash' ? DASH_HOLE_U : GLYPH_HOLE_U) * UNIT).toFixed(1)}'/%3E`)
      .join('');
    return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${HOLES_LAYER_PX}' height='${HOLES_LAYER_PX}' fill='black'%3E${circles}%3C/svg%3E")`;
  }, [bits]);
  const hatchStyle = (holesMask
    ? {
        maskImage: `${TILE_MASK}, ${holesMask}`,
        maskSize: `${TILE_PX}px ${TILE_PX}px, auto`,
        maskRepeat: 'repeat, no-repeat',
        maskComposite: 'subtract',
      }
    : {
        maskImage: TILE_MASK,
        maskSize: `${TILE_PX}px ${TILE_PX}px`,
        maskRepeat: 'repeat',
      }) as CSSProperties;

  return (
    <Link href="/">
      <div
        className={`${styles.wrapper} ${settled ? styles.settled : ''}`}
        ref={wrapper}
        style={{ '--d': `${2 * R}px`, '--hatch-delay': `${maxDelay}ms` } as CSSProperties}
        onPointerMove={graze}
        onPointerDown={pressStart}
        onPointerUp={pressEnd}
        onPointerCancel={() => { press.current = null; }}
      >
        <div className={styles.stripes}>
          {stripes.map((stripe, i) => (
            <div
              key={i}
              className={`${styles.stripe} ${stripe.white ? styles.white : styles.black}`}
              style={{ top: `${stripe.top.toFixed(1)}px`, '--delay': `${stripe.delay}ms` } as CSSProperties}
            />
          ))}
        </div>
        {/* Plus/cross texture: alternating +'s and x's on a diagonal
            lattice, each surrounded by a 45deg dash on its 4 diagonals,
            blended with difference — black strokes on white waves, white on
            black. The glyph tile is a mask (inline, so knocked-off bits can
            punch holes in it); the two drifting gradient sheets inside
            supply each glyph's opacity, so the field shimmers in crossing
            diagonal waves */}
        <div className={styles.hatch} style={hatchStyle} aria-hidden>
          <div className={`${styles.shimmerWave} ${styles.waveA}`} />
          <div className={`${styles.shimmerWave} ${styles.waveB}`} />
        </div>
        {/* Knocked-off bits mid-fall. Like .hatch, each must be a direct
            sibling of the wave columns (a wrapping container would create a
            stacking context that isolates their difference blend from the
            waves), so they render loose with their own blend mode */}
        {[...bits.entries()].filter(([, bit]) => !bit.fallen).map(([id, bit]) => (
          <svg
            key={id}
            className={styles.bit}
            viewBox="-8 -8 16 16"
            aria-hidden
            onAnimationEnd={() => markFallen(id)}
            style={{
              left: `${(bit.x - 8 * UNIT).toFixed(1)}px`,
              top: `${(bit.y - 8 * UNIT).toFixed(1)}px`,
              width: `${16 * UNIT}px`,
              height: `${16 * UNIT}px`,
              '--dx': `${bit.dx.toFixed(1)}px`,
              '--hop': `${bit.hop.toFixed(1)}px`,
              '--spin': `${bit.spin.toFixed(0)}deg`,
              '--fall': `${bit.fall.toFixed(0)}px`,
              '--fall-dur': `${bit.dur.toFixed(2)}s`,
              '--knock-delay': `${bit.delay.toFixed(0)}ms`,
            } as CSSProperties}
          >
            <g
              // The dash keeps its lattice tilt; the falling spin rotates the
              // whole svg element on top of it
              transform={bit.kind === 'plus' ? undefined : `rotate(${bit.kind === 'cross' ? 45 : bit.tilt})`}
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            >
              <path d={bit.kind === 'dash' ? DASH_PATH : PLUS_PATH} />
            </g>
          </svg>
        ))}
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
                style={{ top: `${circle.top.toFixed(1)}px`, zIndex: circle.z, '--delay': `${circle.delay}ms` } as CSSProperties}
              />
            ))}
          </div>
        ))}
      </div>
    </Link>
  )
}
