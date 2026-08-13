'use client'

import Link from "next/link"
import { useCallback, useEffect, useRef } from "react";
import useWindowScroll from "../../hooks/useWindowScroll";
import styles from "./Logo4.module.scss"
import useTabActive from "../../hooks/useTabActive";

/** Breathing phases: bloom → tracery → ember → void */
const PHASE_COUNT = 4;

const CX = 500;
const CY = 500;

const round = (n: number) => Math.round(n * 10) / 10;

const polar = (radius: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [round(CX + radius * Math.cos(rad)), round(CY + radius * Math.sin(rad))];
};

/**
 * The rose window: two families of ellipse petals spun around the center
 * like a spirograph, held by a halo ring and an inner ring.
 */
const PETAL_FAMILIES = [
  { rx: 300, ry: 108, count: 12, offset: 0 },
  { rx: 208, ry: 72, count: 12, offset: 7.5 },
];

const PETALS: { rx: number; ry: number; angle: number }[] = PETAL_FAMILIES.flatMap(
  ({ rx, ry, count, offset }) =>
    Array.from({ length: count }, (_, i) => ({ rx, ry, angle: offset + i * (180 / count) }))
);

const RINGS = [310, 96];

/**
 * The knot of primal forms: circle, square and triangle interlocked in a
 * cyclic weave — triangle over square, square over circle, circle over
 * triangle. No stacking order can produce that cycle, which is what makes it
 * impossible: draw order gives triangle-over-square and circle-over-everything
 * for free, then two patch segments re-draw the square on top of the circle
 * at both of their crossings. Patch casings are clipped flush (shorter than
 * their cores) so no black edge or round cap ever betrays them.
 */
const KNOT_OFF = 66;
const TRI_CR = 165;
const SQ_HALF = 105;
const CIRC_R = 130;
const PATCH_HALF = 30;

/** The three balanced seats the forms wander between, 120° apart */
const ANCHORS: [number, number][] = [polar(KNOT_OFF, 270), polar(KNOT_OFF, 30), polar(KNOT_OFF, 150)];

/** Home seats: triangle at anchor 0, square at 1, circle at 2 */
const TRI_CENTER = ANCHORS[0];
const SQ_CENTER = ANCHORS[1];
const CIRC_CENTER = ANCHORS[2];

/** Every way to deal [triangle, square, circle] onto the three anchors */
const ARRANGEMENTS: [number, number, number][] = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

type Seg = [number, number, number, number];

const TRI_EDGES: Seg[] = (() => {
  const v = [270, 30, 150].map(a => {
    const rad = (a * Math.PI) / 180;
    return [
      round(TRI_CENTER[0] + TRI_CR * Math.cos(rad)),
      round(TRI_CENTER[1] + TRI_CR * Math.sin(rad)),
    ];
  });
  return v.map((p, k) => [p[0], p[1], v[(k + 1) % 3][0], v[(k + 1) % 3][1]]);
})();

const SQ_EDGES: Seg[] = (() => {
  const [sx, sy] = SQ_CENTER;
  const v = [
    [sx - SQ_HALF, sy - SQ_HALF],
    [sx + SQ_HALF, sy - SQ_HALF],
    [sx + SQ_HALF, sy + SQ_HALF],
    [sx - SQ_HALF, sy + SQ_HALF],
  ];
  return v.map((p, k) => [p[0], p[1], v[(k + 1) % 4][0], v[(k + 1) % 4][1]]);
})();

const lineCircleIntersect = (seg: Seg, cx: number, cy: number, r: number): [number, number][] => {
  const [x1, y1, x2, y2] = seg;
  const dx = x2 - x1, dy = y2 - y1;
  const fx = x1 - cx, fy = y1 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc <= 0) return [];
  const s = Math.sqrt(disc);
  return [(-b - s) / (2 * a), (-b + s) / (2 * a)]
    .filter(t => t > 0 && t < 1)
    .map(t => [x1 + t * dx, y1 + t * dy]);
};

/** Rectangle clipping a patch casing flush, inset from both ends */
const patchClip = (seg: Seg): string => {
  const [x1, y1, x2, y2] = seg;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const px = -uy;
  const py = ux;
  const w = 17;      // casing half-width (15) plus margin
  const endTrim = 4; // stop the black casing short of the core's ends
  const sx = x1 + ux * endTrim, sy = y1 + uy * endTrim;
  const ex = x2 - ux * endTrim, ey = y2 - uy * endTrim;
  return [
    [sx + px * w, sy + py * w],
    [ex + px * w, ey + py * w],
    [ex - px * w, ey - py * w],
    [sx - px * w, sy - py * w],
  ].map(([x, y]) => `${round(x)},${round(y)}`).join(' ');
};

/**
 * Square-over-circle patches at both crossings, each along its square edge —
 * precomputed for every square/circle seating (pair "ij" = square at anchor
 * i, circle at anchor j). Only the active pair's patches are shown, fading
 * in once the forms have settled.
 */
const PATCH_SETS: { pair: string; patches: { seg: Seg; clip: string }[] }[] = (() => {
  const sets: { pair: string; patches: { seg: Seg; clip: string }[] }[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (i === j) continue;
      const dx = ANCHORS[i][0] - SQ_CENTER[0];
      const dy = ANCHORS[i][1] - SQ_CENTER[1];
      const patches = SQ_EDGES.flatMap(([ex1, ey1, ex2, ey2]) => {
        const edge: Seg = [
          round(ex1 + dx), round(ey1 + dy),
          round(ex2 + dx), round(ey2 + dy),
        ];
        return lineCircleIntersect(edge, ANCHORS[j][0], ANCHORS[j][1], CIRC_R).map(p => {
          const [x1, y1, x2, y2] = edge;
          const len = Math.hypot(x2 - x1, y2 - y1);
          const ux = (x2 - x1) / len;
          const uy = (y2 - y1) / len;
          let seg: Seg;
          if (ANCHORS[i][1] === ANCHORS[j][1]) {
            // Side-by-side seating: the circle's casing hugs the edge between
            // the crossing and the nearest square corner, biting the beam
            // beyond a centered patch. Run the patch all the way to that
            // corner — its round cap replicates the square's own corner cap —
            // and a little further past the crossing on the other side.
            const tc = (p[0] - x1) * ux + (p[1] - y1) * uy;
            const toStart = tc < len / 2;
            const corner = toStart ? [x1, y1] : [x2, y2];
            const dir = toStart ? 1 : -1;
            seg = [
              round(corner[0]), round(corner[1]),
              round(p[0] + dir * ux * (PATCH_HALF + 8)),
              round(p[1] + dir * uy * (PATCH_HALF + 8)),
            ];
          } else {
            seg = [
              round(p[0] - ux * PATCH_HALF), round(p[1] - uy * PATCH_HALF),
              round(p[0] + ux * PATCH_HALF), round(p[1] + uy * PATCH_HALF),
            ];
          }
          return { seg, clip: patchClip(seg) };
        });
      });
      sets.push({ pair: `${i}${j}`, patches });
    }
  }
  return sets;
})();

const PATCH_CLIP_ID = 'logo4-patch-clip';

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

/** Petals run teal lying flat to gold standing upright, mirrored on both axes */
const petalColor = (angleDeg: number): string =>
  auroraAt((1 - Math.cos((angleDeg * Math.PI) / 90)) / 2);

/** Deterministic 0..1 jitter (no Math.random — keeps SSR and client markup identical) */
const jitter = (i: number) => ((i * 37) % 23) / 23;

/** Petals bloom around the dial, inner family first, with organic variance */
const petalStyle = (angle: number, i: number) => ({
  '--c': petalColor(angle),
  '--d': `${((i / PETALS.length) * 2 + jitter(i) * 0.6).toFixed(2)}s`,
  '--dur': `${(1.8 + jitter(i * 7 + 3) * 1.4).toFixed(2)}s`,
} as React.CSSProperties);

const ringStyle = (r: number, i: number) => ({
  '--c': auroraAt(r / 320),
  '--d': `${(0.4 + jitter(i * 11 + 5) * 0.8).toFixed(2)}s`,
  '--dur': `${(2 + jitter(i * 5 + 1) * 1.2).toFixed(2)}s`,
} as React.CSSProperties);

/** One voice per form: teal triangle, gold square, violet circle */
const shapeStyle = (t: number, i: number) => ({
  '--c': auroraAt(t),
  '--d': `${(0.8 + jitter(i * 5 + 11) * 0.9).toFixed(2)}s`,
  '--dur': `${(1.8 + jitter(i * 3 + 7) * 1.2).toFixed(2)}s`,
} as React.CSSProperties);

const TRI_STYLE = shapeStyle(0.02, 1);
const SQ_STYLE = shapeStyle(0.98, 2);
const CIRC_STYLE = shapeStyle(0.5, 3);

/**
 * Fourth of the logo family: a spirograph rose window of
 * ellipse petals with the three primal forms — circle, square, triangle —
 * locked at its heart in an impossible cyclic weave. The rose creeps around
 * by an uneven number of petal-steps each cycle while the forms wander to a
 * fresh balanced arrangement: the knot unweaves as they drift, then locks
 * again in a new combination.
 */
export default function Logo4() {
  const { scrollY } = useWindowScroll();
  const isTabActive = useTabActive();
  const svg = useRef<SVGSVGElement>(null);
  const animationInterval = useRef<NodeJS.Timeout | null>(null);
  const twist = useRef(0);
  const arrangement = useRef(0);

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

      // The rose window creeps forward by one to three petal-steps each cycle
      twist.current += 15 * (1 + Math.floor(Math.random() * 3));
      svg.current.style.setProperty('--twist', `${twist.current}deg`);

      // Deal the three forms onto fresh seats — always a new combination
      let next = arrangement.current;
      while (next === arrangement.current) next = Math.floor(Math.random() * ARRANGEMENTS.length);
      arrangement.current = next;
      const [ta, sa, ca] = ARRANGEMENTS[next];
      svg.current.style.setProperty('--tri-t',
        `${ANCHORS[ta][0] - TRI_CENTER[0]}px, ${ANCHORS[ta][1] - TRI_CENTER[1]}px`);
      svg.current.style.setProperty('--sq-t',
        `${ANCHORS[sa][0] - SQ_CENTER[0]}px, ${ANCHORS[sa][1] - SQ_CENTER[1]}px`);
      svg.current.style.setProperty('--circ-t',
        `${ANCHORS[ca][0] - CIRC_CENTER[0]}px, ${ANCHORS[ca][1] - CIRC_CENTER[1]}px`);

      // The patches for the new square/circle seating fade in on arrival
      svg.current.dataset.combo = `${sa}${ca}`;
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
      <svg className={styles.svg} ref={svg} data-combo="12"
        xmlns="http://www.w3.org/2000/svg" viewBox="100 100 800 800">
        <defs>
          {PATCH_SETS.flatMap(({ pair, patches }) =>
            patches.map(({ clip }, k) => (
              <clipPath key={`clip-${pair}-${k}`} id={`${PATCH_CLIP_ID}-${pair}-${k}`}>
                <polygon points={clip} />
              </clipPath>
            ))
          )}
        </defs>
        <g className={styles.rose}>
          {RINGS.map((r, i) => (
            <circle key={`ring-${i}`} className={styles.ring}
              cx={CX} cy={CY} r={r}
              style={ringStyle(r, i)} />
          ))}
          {PETALS.map(({ rx, ry, angle }, i) => (
            <ellipse key={`petal-${i}`} className={styles.petal}
              cx={CX} cy={CY} rx={rx} ry={ry}
              transform={`rotate(${angle} ${CX} ${CY})`}
              style={petalStyle(angle, i)} />
          ))}
        </g>
        <g className={styles.knot}>
          <g className={`${styles.shape} ${styles.shapeSquare}`}>
            {SQ_EDGES.map(([x1, y1, x2, y2], i) => (
              <line key={`sq-casing-${i}`} className={styles.casing}
                x1={x1} y1={y1} x2={x2} y2={y2} />
            ))}
            {SQ_EDGES.map(([x1, y1, x2, y2], i) => (
              <line key={`sq-core-${i}`} className={styles.core}
                x1={x1} y1={y1} x2={x2} y2={y2}
                style={SQ_STYLE} />
            ))}
          </g>
          <g className={`${styles.shape} ${styles.shapeTri}`}>
            {TRI_EDGES.map(([x1, y1, x2, y2], i) => (
              <line key={`tri-casing-${i}`} className={styles.casing}
                x1={x1} y1={y1} x2={x2} y2={y2} />
            ))}
            {TRI_EDGES.map(([x1, y1, x2, y2], i) => (
              <line key={`tri-core-${i}`} className={styles.core}
                x1={x1} y1={y1} x2={x2} y2={y2}
                style={TRI_STYLE} />
            ))}
          </g>
          <g className={`${styles.shape} ${styles.shapeCirc}`}>
            <circle className={styles.casing}
              cx={CIRC_CENTER[0]} cy={CIRC_CENTER[1]} r={CIRC_R} />
            <circle className={styles.core}
              cx={CIRC_CENTER[0]} cy={CIRC_CENTER[1]} r={CIRC_R}
              style={CIRC_STYLE} />
          </g>
          {PATCH_SETS.map(({ pair, patches }) => (
            <g key={`patches-${pair}`} className={styles.patches} data-pair={pair}>
              {patches.map(({ seg }, k) => (
                <g key={`patch-${pair}-${k}`}>
                  <line className={styles.casing} clipPath={`url(#${PATCH_CLIP_ID}-${pair}-${k})`}
                    x1={seg[0]} y1={seg[1]} x2={seg[2]} y2={seg[3]} />
                  <line className={styles.core}
                    x1={seg[0]} y1={seg[1]} x2={seg[2]} y2={seg[3]}
                    style={SQ_STYLE} />
                </g>
              ))}
            </g>
          ))}
        </g>
      </svg>
    </Link>
  )
}
