'use client'

import Link from "next/link"
import { useCallback, useEffect, useRef } from "react";
import useWindowScroll from "../../hooks/useWindowScroll";
import styles from "./Logo3.module.scss"
import useTabActive from "../../hooks/useTabActive";

/** Breathing phases: bloom → starfield → ember → void */
const PHASE_COUNT = 4;

const CX = 500;
const CY = 500;

/** Golden-angle phyllotaxis: the seed arrangement of a sunflower head */
const GOLDEN_ANGLE = 137.50776405;
const SEED_COUNT = 347;
const SEED_SCALE = 19;
const MAX_DIST = SEED_SCALE * Math.sqrt(SEED_COUNT);

const round = (n: number) => Math.round(n * 10) / 10;

const polar = (radius: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [round(CX + radius * Math.cos(rad)), round(CY + radius * Math.sin(rad))];
};

/** Each seed: position on the spiral, size growing toward the rim */
const SEEDS: [number, number, number][] = Array.from({ length: SEED_COUNT }, (_, k) => {
  const n = k + 1;
  const [x, y] = polar(SEED_SCALE * Math.sqrt(n), n * GOLDEN_ANGLE);
  return [x, y, round(4.7 + (n / SEED_COUNT) * 7.4)];
});

/**
 * The impossible tribar: three straight beams forming a triangle, each
 * extended past its corners and drawn over the previous one — then a patch
 * segment of the first beam re-drawn on top of the last closes the loop
 * into a Penrose weave where every beam is over one neighbor and under
 * the other.
 */
const TRI_R = 205;
const BAR_EXT = 46;
const TRI_ANGLES = [270, 30, 150];

const TRI_V = TRI_ANGLES.map(a => polar(TRI_R, a));

const BARS: [number, number, number, number][] = TRI_V.map((v, k) => {
  const w = TRI_V[(k + 1) % 3];
  const len = Math.hypot(w[0] - v[0], w[1] - v[1]);
  const ux = (w[0] - v[0]) / len;
  const uy = (w[1] - v[1]) / len;
  return [
    round(v[0] - ux * BAR_EXT), round(v[1] - uy * BAR_EXT),
    round(w[0] + ux * BAR_EXT), round(w[1] + uy * BAR_EXT),
  ];
});

/** Piece of the first beam re-drawn over the last one, around their shared corner */
const PATCH: [number, number, number, number] = (() => {
  const [x1, y1, x2, y2] = BARS[0];
  const len = Math.hypot(x2 - x1, y2 - y1);
  const t = (BAR_EXT + 22) / len;
  return [x1, y1, round(x1 + (x2 - x1) * t), round(y1 + (y2 - y1) * t)];
})();

const TRIBAR: [number, number, number, number][] = [...BARS, PATCH];

/**
 * Clip rectangle aligned to the patch beam, applied to its black casing only.
 * The tip end extends past the round cap (which sits exactly on bar 0's own
 * cap, so it must stay); the far end trims the casing a few pixels short of
 * the core, so no black edge ever crosses the beam. The patch's core needs no
 * clip: its round cap lands on bar 0's identical core and disappears.
 */
const PATCH_CLIP_ID = 'logo3-patch-clip';
const PATCH_CLIP_POINTS: string = (() => {
  const [x1, y1, x2, y2] = PATCH;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const px = -uy;
  const py = ux;
  const w = 17;      // casing half-width (15) plus margin
  const tipExt = 20; // keep the tip cap
  const endTrim = 4; // stop the black casing short of the core's far end
  const sx = x1 - ux * tipExt, sy = y1 - uy * tipExt;
  const ex = x2 - ux * endTrim, ey = y2 - uy * endTrim;
  return [
    [sx + px * w, sy + py * w],
    [ex + px * w, ey + py * w],
    [ex - px * w, ey - py * w],
    [sx - px * w, sy - py * w],
  ].map(([x, y]) => `${round(x)},${round(y)}`).join(' ');
})();

/** Aurora gradient stops as [hue, saturation, lightness] — teal, violet, magenta, gold */
const AURORA_STOPS: [number, number, number][] = [
  [172, 78, 55],
  [258, 84, 66],
  [318, 80, 62],
  [402, 92, 60],
];

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

/** Seeds run teal at the core to gold at the rim — a radial aurora */
const seedColor = (x: number, y: number): string =>
  auroraAt(Math.hypot(x - CX, y - CY) / MAX_DIST);

/** Beams take their hue from direction: teal up top flowing to gold below */
const beamColor = (x: number, y: number): string => {
  const angle = Math.atan2(y - CY, x - CX);
  return auroraAt((1 - Math.cos(angle + Math.PI / 2)) / 2);
};

/** Deterministic 0..1 jitter (no Math.random — keeps SSR and client markup identical) */
const jitter = (i: number) => ((i * 37) % 23) / 23;

/** Phase changes sweep along the spiral, seed by seed, with organic variance */
const seedStyle = (x: number, y: number, i: number) => ({
  '--c': seedColor(x, y),
  '--d': `${((i / SEED_COUNT) * 2.4 + jitter(i) * 0.5).toFixed(2)}s`,
  '--dur': `${(1.6 + jitter(i * 7 + 3) * 1.6).toFixed(2)}s`,
} as React.CSSProperties);

const beamStyle = (x1: number, y1: number, x2: number, y2: number, i: number) => ({
  '--c': beamColor((x1), (y2)),
  '--d': `${(0.8 + jitter(i * 5 + 11) * 0.9).toFixed(2)}s`,
  '--dur': `${(1.8 + jitter(i * 3 + 7) * 1.2).toFixed(2)}s`,
} as React.CSSProperties);

/** The patch (index 3) must be indistinguishable from bar 0, so it shares its style */
const BEAM_STYLES = TRIBAR.map((_, i) => {
  const [x1, y1, x2, y2] = BARS[i % BARS.length];
  return beamStyle(x1, y1, x2, y2, i % BARS.length);
});

/**
 * Sibling in the logo family: a golden-angle sunflower spiral
 * of seeds with an impossible Penrose tribar woven over its heart. The seed
 * field swirls forward by one golden angle each cycle while the tribar
 * re-seats on a random sixth-turn.
 */
export default function Logo3() {
  const { scrollY } = useWindowScroll();
  const isTabActive = useTabActive();
  const svg = useRef<SVGSVGElement>(null);
  const animationInterval = useRef<NodeJS.Timeout | null>(null);
  const twist = useRef(0);

  const animateSVG = useCallback(() => {
    if (!svg.current) return;
    let cycleIndex = 0;

    svg.current.setAttribute('style', 'opacity: 1;');

    const runCycle = () => {
      if (!svg.current // SVG element not rendered or ref not instantiated properly
      || scrollY >= svg.current.getBoundingClientRect().height // Page scrolled, logo hidden
      || !isTabActive) // Browser tab is not on focus
        return;

      svg.current.dataset.phase = `${cycleIndex}`;
      cycleIndex = (cycleIndex + 1) % PHASE_COUNT;

      // The seed field swirls forward by one golden angle each cycle
      twist.current += GOLDEN_ANGLE;
      svg.current.style.setProperty('--twist', `${twist.current.toFixed(1)}deg`);

      // Re-seat the impossible tribar on a random sixth-turn each cycle
      const x = Math.floor(Math.random() * 6);
      svg.current.style.setProperty('--tri-rot', `${60 * x}deg`);
    };

    animationInterval.current = setInterval(runCycle, 8000);
    setTimeout(runCycle, 1000);
  }, [isTabActive, scrollY]);

  useEffect(() => {
    animateSVG();

    return () => {
      if (animationInterval.current) clearInterval(animationInterval.current);
    };
  }, [animateSVG]);

  return (
    <Link href="/">
      <svg className={styles.svg} ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox="100 100 800 800">
        <g className={styles.field}>
          {SEEDS.map(([x, y, size], i) => (
            <circle key={`seed-${i}`} className={styles.seed}
              cx={x} cy={y} r={size}
              style={seedStyle(x, y, i)} />
          ))}
        </g>
        <defs>
          <clipPath id={PATCH_CLIP_ID}>
            <polygon points={PATCH_CLIP_POINTS} />
          </clipPath>
        </defs>
        <g className={styles.tribar}>
          {BARS.map(([x1, y1, x2, y2], k) => (
            <g key={`bar-${k}`} className={`${styles.bar} ${k === 0 ? styles.barA : ''}`}>
              <line className={styles.casing} x1={x1} y1={y1} x2={x2} y2={y2} />
              <line className={styles.core}
                x1={x1} y1={y1} x2={x2} y2={y2}
                style={BEAM_STYLES[k]} />
            </g>
          ))}
          <g className={styles.patch}>
            <line className={styles.casing} clipPath={`url(#${PATCH_CLIP_ID})`}
              x1={PATCH[0]} y1={PATCH[1]} x2={PATCH[2]} y2={PATCH[3]} />
            <line className={styles.core}
              x1={PATCH[0]} y1={PATCH[1]} x2={PATCH[2]} y2={PATCH[3]}
              style={BEAM_STYLES[BARS.length]} />
          </g>
        </g>
      </svg>
    </Link>
  )
}
