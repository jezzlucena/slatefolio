'use client'

import Link from "next/link"
import { useCallback, useEffect, useRef } from "react";
import useWindowScroll from "../../hooks/useWindowScroll";
import styles from "./Logo2.module.scss"
import useTabActive from "../../hooks/useTabActive";

/** Breathing phases: aurora → constellation → ember → void */
const PHASE_COUNT = 4;

const CX = 500;
const CY = 500;
const STEP = 150;
const CIRCLE_R = STEP / 2;
const MAX_DIST = STEP * 2 + CIRCLE_R;

/** Pointy-top hexagon directions, in degrees (SVG y grows downward) */
const HEX_ANGLES = [270, 330, 30, 90, 150, 210];

const round = (n: number) => Math.round(n * 10) / 10;

const polar = (radius: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [round(CX + radius * Math.cos(rad)), round(CY + radius * Math.sin(rad))];
};

/** The 13 circle centers of Metatron's Cube: center, inner ring, outer ring */
const CENTERS: [number, number][] = [
  [CX, CY],
  ...HEX_ANGLES.map(a => polar(STEP, a)),
  ...HEX_ANGLES.map(a => polar(STEP * 2, a)),
];

/** All 78 lines connecting every pair of centers */
const LINES: [number, number, number, number][] = [];
for (let i = 0; i < CENTERS.length; i++) {
  for (let j = i + 1; j < CENTERS.length; j++) {
    LINES.push([CENTERS[i][0], CENTERS[i][1], CENTERS[j][0], CENTERS[j][1]]);
  }
}

/**
 * The impossible cube at the heart of the mandala: two offset squares joined
 * by connectors, drawn back-to-front so near beams occlude far ones — except
 * for one patch segment re-drawn on top, where a far edge passes impossibly
 * in front of a near edge.
 */
const CUBE_HALF = 130;
const CUBE_OFF = 52;

const cubeSquare = (cx: number, cy: number): [number, number][] => [
  [cx - CUBE_HALF, cy - CUBE_HALF],
  [cx + CUBE_HALF, cy - CUBE_HALF],
  [cx + CUBE_HALF, cy + CUBE_HALF],
  [cx - CUBE_HALF, cy + CUBE_HALF],
];

const NEAR = cubeSquare(CX - CUBE_OFF, CY + CUBE_OFF);
const FAR = cubeSquare(CX + CUBE_OFF, CY - CUBE_OFF);

const edge = (a: [number, number], b: [number, number]): [number, number, number, number] =>
  [a[0], a[1], b[0], b[1]];

/** Where the far-left edge crosses the near-top edge — the impossible over-pass */
const CROSS_X = FAR[0][0];
const CROSS_Y = NEAR[0][1];

const BEAMS: [number, number, number, number][] = [
  ...FAR.map((c, k) => edge(c, FAR[(k + 1) % 4])),
  ...NEAR.map((c, k) => edge(c, FAR[k])),
  ...NEAR.map((c, k) => edge(c, NEAR[(k + 1) % 4])),
  [CROSS_X, CROSS_Y - 105, CROSS_X, CROSS_Y + 147],
];

/** Aurora gradient stops as [hue, saturation, lightness] — teal, violet, magenta, gold */
const AURORA_STOPS: [number, number, number][] = [
  [172, 78, 55],
  [258, 84, 66],
  [318, 80, 62],
  [402, 92, 60],
];

/** Teal at the top of the figure flowing to gold at the bottom, mirrored left/right */
const auroraColor = (x: number, y: number): string => {
  const angle = Math.atan2(y - CY, x - CX);
  const t = (1 - Math.cos(angle + Math.PI / 2)) / 2;
  const pos = t * (AURORA_STOPS.length - 1);
  const i = Math.min(Math.floor(pos), AURORA_STOPS.length - 2);
  const frac = pos - i;
  const [h1, s1, l1] = AURORA_STOPS[i];
  const [h2, s2, l2] = AURORA_STOPS[i + 1];
  const h = Math.round((h1 + (h2 - h1) * frac) % 360);
  const s = Math.round(s1 + (s2 - s1) * frac);
  const l = Math.round(l1 + (l2 - l1) * frac);
  return `hsl(${h}, ${s}%, ${l}%)`;
};

/** Deterministic 0..1 jitter (no Math.random — keeps SSR and client markup identical) */
const jitter = (i: number) => ((i * 37) % 23) / 23;

/** Phase changes bloom outward from the center with organic per-element variance */
const glyphStyle = (x1: number, y1: number, x2: number, y2: number, i: number) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dist = Math.hypot(mx - CX, my - CY);
  const delay = (dist / MAX_DIST) * 2.2 + jitter(i) * 0.6;
  const duration = 1.8 + jitter(i * 7 + 3) * 1.4;
  return {
    '--c': auroraColor(mx, my),
    '--d': `${delay.toFixed(2)}s`,
    '--dur': `${duration.toFixed(2)}s`,
  } as React.CSSProperties;
};

/**
 * Spiritual successor to Logo: a Metatron's Cube mandala with an impossible
 * cube woven into its center, breathing through slow aurora-colored cycles
 */
export default function Logo2() {
  const { scrollY } = useWindowScroll();
  const isTabActive = useTabActive();
  const svg = useRef<SVGSVGElement>(null);
  const animationInterval = useRef<NodeJS.Timeout | null>(null);

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

      // Re-seat the impossible cube in a random diagonal orientation each cycle
      const x = Math.floor(Math.random() * 4);
      svg.current.style.setProperty('--cube-rot', `${45 + 90 * x}deg`);
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
        {LINES.map(([x1, y1, x2, y2], i) => (
          <line key={`line-${i}`} className={styles.line}
            x1={x1} y1={y1} x2={x2} y2={y2}
            style={glyphStyle(x1, y1, x2, y2, i)} />
        ))}
        {CENTERS.map(([cx, cy], i) => (
          <circle key={`circle-${i}`} className={styles.circle}
            cx={cx} cy={cy} r={CIRCLE_R}
            style={glyphStyle(cx, cy, cx, cy, i + LINES.length)} />
        ))}
        {CENTERS.map(([cx, cy], i) => (
          <circle key={`node-${i}`} className={styles.node}
            cx={cx} cy={cy} r={5}
            style={glyphStyle(cx, cy, cx, cy, i + LINES.length + CENTERS.length)} />
        ))}
        <g className={styles.cube}>
          {BEAMS.map(([x1, y1, x2, y2], i) => (
            <g key={`beam-${i}`}>
              <line className={styles.casing} x1={x1} y1={y1} x2={x2} y2={y2} />
              <line className={styles.core}
                x1={x1} y1={y1} x2={x2} y2={y2}
                style={glyphStyle(x1, y1, x2, y2, i * 5 + 11)} />
            </g>
          ))}
        </g>
      </svg>
    </Link>
  )
}
