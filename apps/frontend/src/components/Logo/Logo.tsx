'use client'

import Link from "next/link"
import { useCallback, useEffect, useRef } from "react";
import useWindowScroll from "../../hooks/useWindowScroll";
import styles from "./Logo.module.scss"
import useTabActive from "../../hooks/useTabActive";

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

const VIEWBOX_WIDTH = 1571;
const VIEWBOX_HEIGHT = 1362;

/** One full glint loop of the molten-gold shimmer, in seconds — must match the
 * `.shimmer` animation duration in Logo.module.scss */
const SHIMMER_DURATION = 2.2;

/** How long tiles rest on plain gold after the glint stops, so the next
 * phase's fill transition has a stable color to start from */
const SHIMMER_SETTLE_MS = 60;
/** Head start before the shimmer kicks in, leaving room for the crossfade into gold */
const SHIMMER_LEAD_IN = 2.5;

/**
 * Per-face glint: each face of the prism catches the light along its own axis
 * (a unit vector the tile positions are projected onto) and in sequence, a
 * third of a loop apart, so the shine circulates around the triangle —
 * up the right arm, down the left arm, then rightward along the base.
 */
const FACE_SHIMMER: { dir: [number, number], offset: number }[] = [
  { dir: [-0.4, -0.92], offset: 0 },
  { dir: [-0.59, 0.81], offset: SHIMMER_DURATION / 3 },
  { dir: [0.99, 0.11], offset: (SHIMMER_DURATION * 2) / 3 },
];

/** How far the hover glow reaches around the cursor, in viewBox units */
const HOVER_RADIUS = 200;

/** Center of each shape in <defs>, relative to the x/y anchor of its <use> tag */
const SHAPE_CENTERS: Record<string, [number, number]> = {
  '#a': [0, -49.65],
  '#b': [-43, 24.8],
  '#c': [43, 24.8],
  '#d': [-28.7, -16.6],
};

/** The style a tile had before the glow touched it, so it can be put back */
type GlowBase = {
  style: string | null;
  color: [number, number, number];
  opacity: number;
};

const parseColor = (color: string): [number, number, number] | null => {
  const channels = color.match(/[\d.]+/g);
  if (!channels || channels.length < 3) return null;
  return [Number(channels[0]), Number(channels[1]), Number(channels[2])];
};

const restoreTile = (elm: SVGUseElement, base: GlowBase) => {
  if (base.style === null) elm.removeAttribute('style');
  else elm.setAttribute('style', base.style);
};

/**
 * Style phases the mosaic cycles through. String phases apply to every
 * triangle alike (properties left out fall back to each triangle's own color
 * from the stylesheet); function phases are computed per triangle from its
 * position in the figure.
 */
type StylePhase = {
  style: string | ((x: number, y: number, face: number) => string);
  /** whether tiles wear the golden glint animation class during this phase */
  shimmer?: boolean;
};

const SVG_STYLE_CYCLES: StylePhase[] = [
  { style: 'opacity: 1;' },                              // aurora: every triangle in its own color
  {
    style: (_x, y) => {                                  // gradient: the chaos organizes itself —
      const color = auroraAt(y / VIEWBOX_HEIGHT);        // teal apex flowing to a gold base
      return `opacity: 1; fill: ${color}; stroke: ${color};`;
    },
  },
  { style: 'opacity: 1; fill: white; stroke: black;' },  // porcelain: white tiles, black seams
  {
    style: (_x, y) => {
      const color = auroraAt(y / VIEWBOX_HEIGHT);
      return `opacity: 1; fill: black; stroke: ${color};`;
    },
  },                                                     // ink: black tiles, colored seams
  {
    style: (x, y, face) => {                                // ember: molten gold, a glint sweeping each face
      const { dir: [dx, dy], offset } = FACE_SHIMMER[face] ?? FACE_SHIMMER[0];
      // Project the tile onto the face's sweep axis, normalized to [0, 1]
      const sweep = (x * dx + y * dy + VIEWBOX_WIDTH + VIEWBOX_HEIGHT) / (2 * (VIEWBOX_WIDTH + VIEWBOX_HEIGHT));
      return `opacity: 1; fill: #f5c15c; stroke: #221a08; animation-delay: ${(SHIMMER_LEAD_IN + offset + sweep * SHIMMER_DURATION).toFixed(2)}s;`;
    },
    shimmer: true,
  },
  { style: 'opacity: 1;' }                               // void: dissolve, then bloom again
];

/** 
 * Container for the very large (and optimized) interactive SVG that decorates every page
 */
export default function Logo() {
  const { scrollY } = useWindowScroll();
  const isTabActive = useTabActive();
  const svg = useRef<SVGSVGElement>(null);
  const animationInterval = useRef<NodeJS.Timeout | null>(null);
  const tileCenters = useRef<Map<SVGUseElement, { cx: number, cy: number, face: Element | null }> | null>(null);
  const glowBases = useRef(new Map<SVGUseElement, GlowBase>());
  const cursor = useRef<[number, number]>([0, 0]);
  const hoveredFace = useRef<Element | null>(null);
  const glowFrame = useRef(0);

  /** Whiten tiles of the hovered face within HOVER_RADIUS of the cursor, strongest at the center */
  const applyGlow = useCallback(() => {
    glowFrame.current = 0;
    if (!svg.current) return;
    const ctm = svg.current.getScreenCTM();
    if (!ctm) return;

    if (!tileCenters.current) {
      tileCenters.current = new Map();
      for (const elm of svg.current.querySelectorAll('use')) {
        const [dx, dy] = SHAPE_CENTERS[elm.getAttribute('href') ?? '#a'];
        tileCenters.current.set(elm, {
          cx: (Number(elm.getAttribute('x')) || 0) + dx,
          cy: (Number(elm.getAttribute('y')) || 0) + dy,
          face: elm.closest('g[data-role="face"]'),
        });
      }
    }

    const [clientX, clientY] = cursor.current;
    const { x, y } = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());

    for (const [elm, { cx, cy, face }] of tileCenters.current) {
      const dist = Math.hypot(cx - x, cy - y);
      let base = glowBases.current.get(elm);

      if (dist >= HOVER_RADIUS || !face || face !== hoveredFace.current) {
        if (base) {
          restoreTile(elm, base);
          glowBases.current.delete(elm);
        }
        continue;
      }

      if (!base) {
        const computed = getComputedStyle(elm);
        base = {
          style: elm.getAttribute('style'),
          color: parseColor(computed.fill) ?? [255, 255, 255],
          opacity: Number(computed.opacity) || 0,
        };
        glowBases.current.set(elm, base);
      }

      const falloff = 1 - dist / HOVER_RADIUS;
      const t = falloff * falloff * (3 - 2 * falloff); // smoothstep
      const [r, g, b] = base.color.map(c => Math.round(c + (255 - c) * t));
      const glowColor = `rgb(${r}, ${g}, ${b})`;
      const opacity = (base.opacity + (1 - base.opacity) * t).toFixed(3);
      elm.setAttribute(
        'style',
        `opacity: ${opacity}; fill: ${glowColor}; stroke: ${glowColor}; transition-duration: 0s, 0s, 0s; animation: none;`
      );
    }
  }, []);

  const glowAt = (clientX: number, clientY: number, target: Element | null) => {
    cursor.current = [clientX, clientY];
    hoveredFace.current = target?.closest('g[data-role="face"]') ?? null;
    if (!glowFrame.current) glowFrame.current = requestAnimationFrame(applyGlow);
  };

  const handleGlowMove = (event: React.MouseEvent<SVGSVGElement>) =>
    glowAt(event.clientX, event.clientY, event.target as Element);

  const handleGlowTouch = (event: React.TouchEvent<SVGSVGElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    // A touch event's target stays wherever the finger first landed, so
    // hit-test the finger's current position instead
    glowAt(touch.clientX, touch.clientY, document.elementFromPoint(touch.clientX, touch.clientY));
  };

  const handleGlowLeave = () => {
    if (glowFrame.current) {
      cancelAnimationFrame(glowFrame.current);
      glowFrame.current = 0;
    }
    for (const [elm, base] of glowBases.current) restoreTile(elm, base);
    glowBases.current.clear();
  };

  const animateSVG = useCallback(() => {
    if (!svg.current) return;
    const stripes = svg.current.querySelectorAll('g[data-role="stripe"]');
    const faces = Array.from(svg.current.querySelectorAll('g[data-role="face"]'));
    let cycleIndex = 0;

    svg.current.setAttribute('style', 'opacity: 1;');
    
    const runCycle = () => {
      if (!svg.current // SVG element not rendered or ref not instantiated properly
      || scrollY >= svg.current.getBoundingClientRect().height // Page scrolled, logo hidden
      || !isTabActive) // Browser tab is not on focus
        return; 

      const phaseIndex = cycleIndex;
      const phase = SVG_STYLE_CYCLES[phaseIndex];
      const prevPhase = SVG_STYLE_CYCLES[(phaseIndex + SVG_STYLE_CYCLES.length - 1) % SVG_STYLE_CYCLES.length];

      const applyPhase = () => {
        if (!svg.current) return;

        for (const [index, stripe] of stripes.entries()) {
          const faceIndex = Math.max(0, faces.indexOf(stripe.parentElement as Element));
          for (const elm of stripe.querySelectorAll('use')) {
            const delay = (index * 0.05).toFixed(2) + 's';
            const originalFill = elm.getAttribute('fill');
            elm.setAttribute('style', `${
              typeof phase.style === 'string'
                ? phase.style
                : phase.style(Number(elm.getAttribute('x')) || 0, Number(elm.getAttribute('y')) || 0, faceIndex)
              } transition-delay: ${delay}; ${phaseIndex === 0 ? `fill: ${originalFill}; stroke: ${originalFill};` : ''}`
            )
            elm.classList.toggle(styles.shimmer, !!phase.shimmer);
          }
        }

        // The cycle just rewrote every tile's style, so the glow snapshots are stale
        glowBases.current.clear();
      };

      if (prevPhase.shimmer && !phase.shimmer) {
        // A fill transition can't take over from a running animation — the fill
        // would jump. Strip the glint first, let the browser paint plain gold
        // for a beat, and only then fade into the next phase.
        for (const elm of svg.current.querySelectorAll('use')) elm.classList.remove(styles.shimmer);
        setTimeout(applyPhase, SHIMMER_SETTLE_MS);
      } else {
        applyPhase();
      }

      cycleIndex = (phaseIndex + 1) % SVG_STYLE_CYCLES.length;
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
      <svg
        className={styles.svg}
        ref={svg}
        onMouseMove={handleGlowMove}
        onMouseLeave={handleGlowLeave}
        onTouchStart={handleGlowTouch}
        onTouchMove={handleGlowTouch}
        onTouchEnd={handleGlowLeave}
        onTouchCancel={handleGlowLeave}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1571 1362"
      >
        <defs>
            <clipPath id="aClip"><path id="a" d="M0,0l28.36-49.65h-56.72Zm0-99.3,28.36,49.65h-56.72Z" shapeRendering="geometricPrecision"/></clipPath>
            <clipPath id="bClip"><path id="b" d="M0,0l-57.4,0,28.36,49.12Zm-86.08,49.68,28.846-49.4,28.36,49.12Z" shapeRendering="geometricPrecision"/></clipPath>
            <clipPath id="cClip"><path id="c" d="M0,0l28.881,49.45,28.3-49.26Zm86.059,49.65-57.181-.2,28.3-49.26Z" shapeRendering="geometricPrecision"/></clipPath>
            <clipPath id="dClip"><path id="d" d="M0,0l-57.2,0l29.2-49.3l0,0z" shapeRendering="geometricPrecision"/></clipPath>
        </defs>
        <g data-role="face">
          <g data-role="stripe">
              <use className={styles.use} data-index="1" x="1458.3" y="1362.4" href="#a" fill="#000400" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="2" x="1486.3" y="1313.9" href="#a" fill="#000800" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="3" x="1514.3" y="1265.4" href="#a" fill="#000d00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="4" x="1542.3" y="1216.9" href="#a" fill="#001100" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="5" x="1430.3" y="1313.9" href="#a" fill="#000b00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="6" x="1458.3" y="1265.4" href="#a" fill="#000f00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="7" x="1486.3" y="1216.9" href="#a" fill="#001400" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="8" x="1514.3" y="1168.3" href="#a" fill="#001900" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="9" x="1402.3" y="1265.4" href="#a" fill="#001300" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="10" x="1430.3" y="1216.9" href="#a" fill="#001700" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="11" x="1458.3" y="1168.3" href="#a" fill="#001c00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="12" x="1486.3" y="1119.8" href="#a" fill="#002100" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="13" x="1374.3" y="1216.9" href="#a" fill="#001b00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="14" x="1402.3" y="1168.3" href="#a" fill="#001f00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="15" x="1430.3" y="1119.8" href="#a" fill="#002300" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="16" x="1458.3" y="1071.3" href="#a" fill="#002900" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="17" x="1346.3" y="1168.8" href="#a" fill="#002200" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="18" x="1374.3" y="1120.3" href="#a" fill="#002700" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="19" x="1402.3" y="1071.8" href="#a" fill="#002b00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="20" x="1430.3" y="1023.3" href="#a" fill="#003100" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="21" x="1318.3" y="1120.3" href="#a" fill="#002b00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="22" x="1346.3" y="1071.8" href="#a" fill="#002e00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="23" x="1374.3" y="1023.3" href="#a" fill="#003300" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="24" x="1402.3" y="974.8" href="#a" fill="#003900" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="25" x="1290.3" y="1071.8" href="#a" fill="#003300" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="26" x="1318.3" y="1023.3" href="#a" fill="#003600" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="27" x="1346.3" y="974.8" href="#a" fill="#003b00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="28" x="1374.3" y="926.2" href="#a" fill="#004100" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="29" x="1262.3" y="1023.3" href="#a" fill="#003b00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="30" x="1290.3" y="974.8" href="#a" fill="#003e00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="31" x="1318.3" y="926.2" href="#a" fill="#004300" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="32" x="1346.3" y="877.7" href="#a" fill="#004900" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="33" x="1234.3" y="974.3" href="#a" fill="#004200" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="34" x="1262.3" y="925.7" href="#a" fill="#004700" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="35" x="1290.3" y="877.2" href="#a" fill="#004d00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="36" x="1318.3" y="828.7" href="#a" fill="#005400" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="37" x="1206.3" y="925.7" href="#a" fill="#004d00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="38" x="1234.3" y="877.2" href="#a" fill="#005100" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="39" x="1262.3" y="828.7" href="#a" fill="#005700" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="40" x="1290.3" y="780.2" href="#a" fill="#006000" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="41" x="1178.3" y="877.2" href="#a" fill="#005600" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="42" x="1206.3" y="828.7" href="#a" fill="#005c00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="43" x="1234.3" y="780.2" href="#a" fill="#006500" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="44" x="1262.3" y="731.7" href="#a" fill="#007100" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="45" x="1150.3" y="828.7" href="#a" fill="#006400" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="46" x="1178.3" y="780.2" href="#a" fill="#006b00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="47" x="1206.3" y="731.7" href="#a" fill="#007700" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="48" x="1234.3" y="683.1" href="#a" fill="#008600" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="49" x="1122.3" y="779.7" href="#a" fill="#007700" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="50" x="1150.3" y="731.2" href="#a" fill="#008000" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="51" x="1178.3" y="682.6" href="#a" fill="#008d00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="52" x="1206.3" y="634.1" href="#a" fill="#009b00" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="53" x="1094.3" y="731.2" href="#a" fill="#008a00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="54" x="1122.3" y="682.6" href="#a" fill="#009500" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="55" x="1150.3" y="634.1" href="#a" fill="#00a200" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="56" x="1178.3" y="585.6" href="#a" fill="#00b100" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="57" x="1066.3" y="682.6" href="#a" fill="#009f00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="58" x="1094.3" y="634.1" href="#a" fill="#00ab00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="59" x="1122.3" y="585.6" href="#a" fill="#00b800" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="60" x="1150.3" y="537.1" href="#a" fill="#00c500" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="61" x="1038.3" y="634.1" href="#a" fill="#00b500" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="62" x="1066.3" y="585.6" href="#a" fill="#00c000" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="63" x="1094.3" y="537.1" href="#a" fill="#00cc00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="64" x="1122.3" y="488.6" href="#a" fill="#00d800" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="65" x="1010.3" y="585.1" href="#a" fill="#00ca00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="66" x="1038.3" y="536.6" href="#a" fill="#00d400" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="67" x="1066.3" y="488.1" href="#a" fill="#00df00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="68" x="1094.3" y="439.5" href="#a" fill="#00e900" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="69" x="982.3" y="536.6" href="#a" fill="#00db00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="70" x="1010.3" y="488.1" href="#a" fill="#00e600" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="71" x="1038.3" y="439.5" href="#a" fill="#00ee00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="72" x="1066.3" y="391" href="#a" fill="#00f600" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="73" x="954.3" y="488.1" href="#a" fill="#00eb00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="74" x="982.3" y="439.5" href="#a" fill="#00f300" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="75" x="1010.3" y="391" href="#a" fill="#01fa01" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="76" x="1038.3" y="342.5" href="#a" fill="#0afe0a" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="77" x="926.3" y="439.5" href="#a" fill="#00f900" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="78" x="954.3" y="391" href="#a" fill="#05fe05" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="79" x="982.3" y="342.5" href="#a" fill="#17ff17" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="80" x="1010.3" y="294" href="#a" fill="#33ff33" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="81" x="898.3" y="390.5" href="#a" fill="#10ff10" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="82" x="926.3" y="342" href="#a" fill="#29ff29" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="83" x="954.3" y="293.5" href="#a" fill="#48ff48" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="84" x="982.3" y="244.9" href="#a" fill="#70ff70" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="85" x="786.3" y="585.5" href="#a" fill="#00e800" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="86" x="814.3" y="536.9" href="#a" fill="#00f000" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="87" x="842.3" y="488.4" href="#a" fill="#00f700" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="88" x="870.3" y="439.8" href="#a" fill="#03fd03" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="89" x="674.3" y="779.6" href="#a" fill="#00c000" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="90" x="702.3" y="731" href="#a" fill="#00cd00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="91" x="730.3" y="682.5" href="#a" fill="#00d600" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="92" x="758.3" y="633.9" href="#a" fill="#00e000" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="93" x="562.3" y="973.7" href="#a" fill="#009100" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="94" x="590.3" y="925.1" href="#a" fill="#009d00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="95" x="618.3" y="876.6" href="#a" fill="#00aa00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="96" x="646.3" y="828" href="#a" fill="#00b500" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="97" x="562.3" y="973.6" href="#d" fill="#008200" clipPath="url(#dClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="98" x="870.3" y="342" href="#a" fill="#3eff3e" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="99" x="898.3" y="293.5" href="#a" fill="#5fff5f" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="100" x="926.3" y="244.9" href="#a" fill="#8fff8f" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="101" x="954.3" y="196.4" href="#a" fill="#bcffbc" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="102" x="758.3" y="536.9" href="#a" fill="#00f500" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="103" x="786.3" y="488.4" href="#a" fill="#01fc01" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="104" x="814.3" y="439.8" href="#a" fill="#0bfe0b" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="105" x="842.3" y="391.3" href="#a" fill="#21ff21" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="106" x="646.3" y="731" href="#a" fill="#00d200" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="107" x="674.3" y="682.5" href="#a" fill="#00da00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="108" x="702.3" y="633.9" href="#a" fill="#00e500" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="109" x="730.3" y="585.4" href="#a" fill="#00ee00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="110" x="534.3" y="925.1" href="#a" fill="#00a000" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="111" x="562.3" y="876.6" href="#a" fill="#00ab00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="112" x="590.3" y="828" href="#a" fill="#00ba00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="113" x="618.3" y="779.5" href="#a" fill="#00c500" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="114" x="506.3" y="973.6" href="#d" fill="#008600" clipPath="url(#dClip)"/>
              <use className={styles.use} data-index="115" x="506.3" y="973.6" href="#a" fill="#009400" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="116" x="842.3" y="293.5" href="#a" fill="#81ff81" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="117" x="870.3" y="244.9" href="#a" fill="#aeffae" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="118" x="898.3" y="196.4" href="#a" fill="#d5ffd5" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="119" x="926.3" y="147.9" href="#a" fill="#f0fff0" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="120" x="730.3" y="488.4" href="#a" fill="#06fe06" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="121" x="758.3" y="439.8" href="#a" fill="#1aff1a" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="122" x="786.3" y="391.3" href="#a" fill="#36ff36" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="123" x="814.3" y="342.7" href="#a" fill="#59ff59" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="124" x="618.3" y="682.5" href="#a" fill="#00e200" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="125" x="646.3" y="633.9" href="#a" fill="#00eb00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="126" x="674.3" y="585.4" href="#a" fill="#00f200" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="127" x="702.3" y="536.8" href="#a" fill="#00f900" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="128" x="506.3" y="876.6" href="#a" fill="#00b300" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="129" x="534.3" y="828" href="#a" fill="#00c000" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="130" x="562.3" y="779.5" href="#a" fill="#00cc00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="131" x="590.3" y="730.9" href="#a" fill="#00d700" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="132" x="450.3" y="973.6" href="#d" fill="#008f00" clipPath="url(#dClip)"/>
              <use className={styles.use} data-index="133" x="450.3" y="973.6" href="#a" fill="#009a00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="134" x="478.3" y="925.1" href="#a" fill="#00a700" clipPath="url(#aClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="135" x="814.3" y="244.9" href="#a" fill="#caffca" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="136" x="842.3" y="196.4" href="#a" fill="#eaffea" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="137" x="870.3" y="147.9" href="#a" fill="#f4fff4" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="138" x="898.3" y="99.4" href="#a" fill="#e2ffe2" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="139" x="702.3" y="439.8" href="#a" fill="#2cff2c" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="140" x="730.3" y="391.3" href="#a" fill="#4cff4c" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="141" x="758.3" y="342.7" href="#a" fill="#76ff76" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="142" x="786.3" y="294.2" href="#a" fill="#a2ffa2" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="143" x="590.3" y="633.9" href="#a" fill="#00f000" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="144" x="618.3" y="585.4" href="#a" fill="#00f800" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="145" x="646.3" y="536.8" href="#a" fill="#03fd03" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="146" x="674.3" y="488.3" href="#a" fill="#12ff12" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="147" x="478.3" y="828" href="#a" fill="#00c800" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="148" x="506.3" y="779.5" href="#a" fill="#00d400" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="149" x="534.3" y="730.9" href="#a" fill="#00de00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="150" x="562.3" y="682.4" href="#a" fill="#00e800" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="151" x="394.3" y="973.6" href="#d" fill="#009b00" clipPath="url(#dClip)"/>
              <use className={styles.use} data-index="152" x="394.3" y="973.6" href="#a" fill="#00a400" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="153" x="422.3" y="925.1" href="#a" fill="#00af00" clipPath="url(#aClip)"/>
              <use className={styles.use} data-index="154" x="450.3" y="876.5" href="#a" fill="#00bd00" clipPath="url(#aClip)"/>
          </g>
        </g>
        <g data-role="face">
          <g data-role="stripe">
              <use className={styles.use} data-index="155" x="899.7" y="1.4" href="#b" fill="#0a0012" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="156" x="843.7" y="1.4" href="#b" fill="#0a0016" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="157" x="787.7" y="1.4" href="#b" fill="#0d001b" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="158" x="731.6" y="1.4" href="#b" fill="#10001f" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="159" x="871.7" y="49.9" href="#b" fill="#0d001a" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="160" x="815.7" y="49.9" href="#b" fill="#0e001e" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="161" x="759.6" y="49.9" href="#b" fill="#110022" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="162" x="703.6" y="50" href="#b" fill="#120026" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="163" x="843.7" y="98.4" href="#b" fill="#100022" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="164" x="787.6" y="98.4" href="#b" fill="#120025" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="165" x="731.6" y="98.5" href="#b" fill="#130029" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="166" x="675.6" y="98.5" href="#b" fill="#16002e" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="167" x="815.6" y="146.9" href="#b" fill="#130028" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="168" x="759.6" y="146.9" href="#b" fill="#15002b" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="169" x="703.6" y="147" href="#b" fill="#17002f" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="170" x="647.6" y="147" href="#b" fill="#190035" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="171" x="788" y="195.2" href="#b" fill="#170030" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="172" x="732" y="195.2" href="#b" fill="#180032" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="173" x="676" y="195.2" href="#b" fill="#1a0036" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="174" x="620" y="195.2" href="#b" fill="#1c003b" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="175" x="760" y="243.7" href="#b" fill="#1b0039" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="176" x="704" y="243.7" href="#b" fill="#1c003a" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="177" x="648" y="243.7" href="#b" fill="#1d003c" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="178" x="592" y="243.7" href="#b" fill="#1f0042" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="179" x="732" y="292.2" href="#b" fill="#1f0040" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="180" x="676" y="292.2" href="#b" fill="#1f0042" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="181" x="620" y="292.2" href="#b" fill="#200045" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="182" x="564" y="292.2" href="#b" fill="#24004c" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="183" x="704" y="340.7" href="#b" fill="#230049" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="184" x="648" y="340.7" href="#b" fill="#24004a" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="185" x="592" y="340.7" href="#b" fill="#260050" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="186" x="535.9" y="340.8" href="#b" fill="#2b005a" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="187" x="675.5" y="389.5" href="#b" fill="#290057" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="188" x="619.5" y="389.5" href="#b" fill="#2c005c" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="189" x="563.5" y="389.5" href="#b" fill="#2f0062" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="190" x="507.5" y="389.5" href="#b" fill="#360070" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="191" x="647.5" y="438" href="#b" fill="#360070" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="192" x="591.5" y="438" href="#b" fill="#35006f" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="193" x="535.5" y="438" href="#b" fill="#3b007b" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="194" x="479.5" y="438" href="#b" fill="#450090" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="195" x="619.5" y="486.5" href="#b" fill="#400085" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="196" x="563.5" y="486.5" href="#b" fill="#45008e" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="197" x="507.5" y="486.5" href="#b" fill="#4c009c" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="198" x="451.4" y="486.5" href="#b" fill="#5500ad" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="199" x="591.5" y="535" href="#b" fill="#4f00a2" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="200" x="535.5" y="535" href="#b" fill="#5400ab" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="201" x="479.4" y="535" href="#b" fill="#5c00b9" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="202" x="423.4" y="535" href="#b" fill="#6500cc" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="203" x="563" y="583.8" href="#b" fill="#5f00c1" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="204" x="507" y="583.8" href="#b" fill="#6500ca" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="205" x="451" y="583.8" href="#b" fill="#6c00d7" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="206" x="395" y="583.8" href="#b" fill="#7300e3" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="207" x="535" y="632.3" href="#b" fill="#6c00d7" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="208" x="479" y="632.3" href="#b" fill="#7200e1" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="209" x="423" y="632.3" href="#b" fill="#7900eb" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="210" x="366.9" y="632.3" href="#b" fill="#8000f4" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="211" x="507" y="680.8" href="#b" fill="#7900eb" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="212" x="451" y="680.8" href="#b" fill="#7e00f2" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="213" x="394.9" y="680.8" href="#b" fill="#8401fa" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="214" x="338.9" y="680.8" href="#b" fill="#900bfe" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="215" x="479" y="729.3" href="#b" fill="#8301f9" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="216" x="422.9" y="729.3" href="#b" fill="#8c07fe" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="217" x="366.9" y="729.3" href="#b" fill="#9c1bff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="218" x="310.9" y="729.3" href="#b" fill="#aa34ff" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="219" x="450.5" y="778.1" href="#b" fill="#9817ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="220" x="394.5" y="778.1" href="#b" fill="#a82eff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="221" x="338.5" y="778.1" href="#b" fill="#b448ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="222" x="282.5" y="778.1" href="#b" fill="#c46cff" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="223" x="422.5" y="826.6" href="#b" fill="#b243ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="224" x="366.5" y="826.6" href="#b" fill="#bf5eff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="225" x="310.5" y="826.6" href="#b" fill="#d28fff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="226" x="254.4" y="826.6" href="#b" fill="#e9c8ff" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="227" x="394.5" y="875.1" href="#b" fill="#cc80ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="228" x="338.5" y="875.1" href="#b" fill="#e0b5ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="229" x="282.4" y="875.1" href="#b" fill="#f3e3ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="230" x="226.4" y="875.1" href="#b" fill="#f6e9ff" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="231" x="366.5" y="923.6" href="#b" fill="#efdaff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="232" x="310.4" y="923.6" href="#b" fill="#f8ebff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="233" x="254.4" y="923.6" href="#b" fill="#ebceff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="234" x="198.4" y="923.6" href="#b" fill="#d89fff" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="235" x="338" y="972.3" href="#b" fill="#edd8ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="236" x="282" y="972.4" href="#b" fill="#d9a3ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="237" x="226" y="972.4" href="#b" fill="#c673ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="238" x="169.9" y="972.4" href="#b" fill="#bd5bff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="239" x="562.8" y="971.9" href="#b" fill="#c36aff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="240" x="506.8" y="971.9" href="#b" fill="#d89eff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="241" x="450.7" y="971.9" href="#b" fill="#ecd1ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="242" x="394.7" y="971.9" href="#b" fill="#f7edff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="243" x="786.9" y="971.8" href="#b" fill="#8a04fc" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="244" x="730.9" y="971.8" href="#b" fill="#9615ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="245" x="674.8" y="971.9" href="#b" fill="#a52aff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="246" x="618.8" y="971.9" href="#b" fill="#b343ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="247" x="1011" y="971.7" href="#b" fill="#6a00d2" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="248" x="955" y="971.8" href="#b" fill="#7200de" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="249" x="899" y="971.8" href="#b" fill="#7800ea" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="250" x="842.9" y="971.8" href="#b" fill="#8000f6" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="251" x="1039" y="1020.3" href="#d" fill="#6200c3" clipPath="url(#dClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="252" x="310" y="1020.9" href="#b" fill="#cc7eff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="253" x="254" y="1020.9" href="#b" fill="#bb57ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="254" x="197.9" y="1020.9" href="#b" fill="#af40ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="255" x="141.9" y="1020.9" href="#b" fill="#a225ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="256" x="534.8" y="1020.4" href="#b" fill="#eac8ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="257" x="478.7" y="1020.4" href="#b" fill="#f7ebff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="258" x="422.7" y="1020.4" href="#b" fill="#f4e6ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="259" x="366.6" y="1020.5" href="#b" fill="#e2b5ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="260" x="758.9" y="1020.3" href="#b" fill="#a224ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="261" x="702.8" y="1020.4" href="#b" fill="#ad37ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="262" x="646.8" y="1020.4" href="#b" fill="#b952ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="263" x="590.8" y="1020.4" href="#b" fill="#cf89ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="264" x="983" y="1020.3" href="#b" fill="#7700e6" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="265" x="927" y="1020.3" href="#b" fill="#7e00f2" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="266" x="870.9" y="1020.3" href="#b" fill="#8602fa" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="267" x="814.9" y="1020.3" href="#b" fill="#940fff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="268" x="1067" y="1068.8" href="#d" fill="#6800ce" clipPath="url(#dClip)"/>
              <use className={styles.use} data-index="269" x="1039" y="1020.3" href="#b" fill="#6f00db" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="270" x="282" y="1069.4" href="#b" fill="#b245ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="271" x="225.9" y="1069.4" href="#b" fill="#a42aff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="272" x="169.9" y="1069.4" href="#b" fill="#9410ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="273" x="113.9" y="1069.4" href="#b" fill="#8703fc" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="274" x="506.7" y="1068.9" href="#b" fill="#f8ebff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="275" x="450.7" y="1068.9" href="#b" fill="#eac9ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="276" x="394.6" y="1069" href="#b" fill="#d596ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="277" x="338.6" y="1069" href="#b" fill="#c266ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="278" x="730.8" y="1068.8" href="#b" fill="#b64bff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="279" x="674.8" y="1068.9" href="#b" fill="#c875ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="280" x="618.8" y="1068.9" href="#b" fill="#e1b4ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="281" x="562.7" y="1068.9" href="#b" fill="#f4e4ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="282" x="955" y="1068.8" href="#b" fill="#8301f8" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="283" x="898.9" y="1068.8" href="#b" fill="#900bfe" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="284" x="842.9" y="1068.8" href="#b" fill="#9e1eff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="285" x="786.8" y="1068.9" href="#b" fill="#aa33ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="286" x="1095" y="1117.3" href="#d" fill="#6f00db" clipPath="url(#dClip)"/>
              <use className={styles.use} data-index="287" x="1067" y="1068.8" href="#b" fill="#7500e3" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="288" x="1010.9" y="1068.8" href="#b" fill="#7d00ef" clipPath="url(#bClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="289" x="253.9" y="1117.9" href="#b" fill="#9816ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="290" x="197.9" y="1117.9" href="#b" fill="#8a05fd" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="291" x="141.9" y="1117.9" href="#b" fill="#8301f8" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="292" x="85.9" y="1117.9" href="#b" fill="#7d01f2" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="293" x="478.7" y="1117.4" href="#b" fill="#dcaaff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="294" x="422.6" y="1117.5" href="#b" fill="#c97aff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="295" x="366.6" y="1117.5" href="#b" fill="#b954ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="296" x="310.6" y="1117.5" href="#b" fill="#a832ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="297" x="702.8" y="1117.4" href="#b" fill="#dca8ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="298" x="646.8" y="1117.4" href="#b" fill="#f1dcff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="299" x="590.7" y="1117.4" href="#b" fill="#f9efff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="300" x="534.7" y="1117.5" href="#b" fill="#eed6ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="301" x="926.9" y="1117.3" href="#b" fill="#9b1bff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="302" x="870.9" y="1117.3" href="#b" fill="#a82fff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="303" x="814.8" y="1117.4" href="#b" fill="#b446ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="304" x="758.8" y="1117.4" href="#b" fill="#c772ff" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="305" x="1122.2" y="1165.7" href="#d" fill="#7701e7" clipPath="url(#dClip)"/>
              <use className={styles.use} data-index="306" x="1095" y="1117.3" href="#b" fill="#7c01ef" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="307" x="1038.9" y="1117.3" href="#b" fill="#8201f7" clipPath="url(#bClip)"/>
              <use className={styles.use} data-index="308" x="982.9" y="1117.3" href="#b" fill="#8d08fe" clipPath="url(#bClip)"/>
          </g>
        </g>
        <g data-role="face">
          <g data-role="stripe">
              <use className={styles.use} data-index="309" x=".8" y="1166.2" href="#c" fill="#02040f" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="310" x="28.9" y="1214.7" href="#c" fill="#000102" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="311" x="57" y="1263.3" href="#c" fill="#000000" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="312" x="85.1" y="1311.9" href="#c" fill="#000000" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="313" x="56.8" y="1166.1" href="#c" fill="#030618" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="314" x="84.9" y="1214.7" href="#c" fill="#010209" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="315" x="113" y="1263.2" href="#c" fill="#000000" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="316" x="141.1" y="1311.8" href="#c" fill="#000000" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="317" x="112.9" y="1166" href="#c" fill="#040821" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="318" x="140.9" y="1214.6" href="#c" fill="#020410" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="319" x="169" y="1263.2" href="#c" fill="#010103" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="320" x="197.1" y="1311.8" href="#c" fill="#000000" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="321" x="168.9" y="1166" href="#c" fill="#050a28" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="322" x="197" y="1214.5" href="#c" fill="#030719" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="323" x="225" y="1263.1" href="#c" fill="#02030a" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="324" x="253.1" y="1311.7" href="#c" fill="#000000" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="325" x="224.5" y="1165.7" href="#c" fill="#060b2f" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="326" x="252.6" y="1214.2" href="#c" fill="#040720" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="327" x="280.6" y="1262.8" href="#c" fill="#030512" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="328" x="308.7" y="1311.4" href="#c" fill="#010104" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="329" x="280.5" y="1165.6" href="#c" fill="#080e36" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="330" x="308.6" y="1214.2" href="#c" fill="#050a27" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="331" x="336.6" y="1262.8" href="#c" fill="#03071a" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="332" x="364.7" y="1311.3" href="#c" fill="#02030c" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="333" x="336.5" y="1165.5" href="#c" fill="#0a113d" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="334" x="364.6" y="1214.1" href="#c" fill="#060b2e" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="335" x="392.7" y="1262.7" href="#c" fill="#040822" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="336" x="420.7" y="1311.3" href="#c" fill="#030514" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="337" x="392.5" y="1165.5" href="#c" fill="#0d1446" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="338" x="420.6" y="1214.1" href="#c" fill="#080e35" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="339" x="448.7" y="1262.7" href="#c" fill="#050b29" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="340" x="476.8" y="1311.2" href="#c" fill="#04081c" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="341" x="449" y="1165.7" href="#c" fill="#0f1851" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="342" x="477.1" y="1214.3" href="#c" fill="#0a113b" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="343" x="505.1" y="1262.8" href="#c" fill="#070c2f" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="344" x="533.2" y="1311.4" href="#c" fill="#050823" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="345" x="505" y="1165.6" href="#c" fill="#121c5b" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="346" x="533.1" y="1214.2" href="#c" fill="#0d1442" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="347" x="561.2" y="1262.8" href="#c" fill="#080e34" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="348" x="589.2" y="1311.4" href="#c" fill="#060b2a" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="349" x="561" y="1165.6" href="#c" fill="#162062" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="350" x="589.1" y="1214.2" href="#c" fill="#0f184a" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="351" x="617.2" y="1262.7" href="#c" fill="#0b103a" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="352" x="645.3" y="1311.3" href="#c" fill="#070d30" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="353" x="617" y="1165.5" href="#c" fill="#1b2772" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="354" x="645.1" y="1214.1" href="#c" fill="#131c53" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="355" x="673.2" y="1262.7" href="#c" fill="#0e1441" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="356" x="701.3" y="1311.2" href="#c" fill="#090f37" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="357" x="673.5" y="1165.7" href="#c" fill="#1f2c7c" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="358" x="701.6" y="1214.3" href="#c" fill="#17215e" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="359" x="729.7" y="1262.9" href="#c" fill="#10184a" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="360" x="757.7" y="1311.4" href="#c" fill="#0b113c" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="361" x="729.5" y="1165.7" href="#c" fill="#253389" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="362" x="757.6" y="1214.2" href="#c" fill="#1b266c" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="363" x="785.7" y="1262.8" href="#c" fill="#141c54" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="364" x="813.8" y="1311.4" href="#c" fill="#0e1545" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="365" x="785.5" y="1165.6" href="#c" fill="#2a3996" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="366" x="813.6" y="1214.2" href="#c" fill="#202d7b" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="367" x="841.7" y="1262.8" href="#c" fill="#182263" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="368" x="869.8" y="1311.3" href="#c" fill="#101a52" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="369" x="841.6" y="1165.5" href="#c" fill="#3141a5" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="370" x="869.6" y="1214.1" href="#c" fill="#25348b" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="371" x="897.7" y="1262.7" href="#c" fill="#1d2976" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="372" x="925.8" y="1311.3" href="#c" fill="#152169" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="373" x="898" y="1165.7" href="#c" fill="#3c4db7" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="374" x="926.1" y="1214.3" href="#c" fill="#2e3ea1" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="375" x="954.2" y="1262.9" href="#c" fill="#23328c" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="376" x="982.2" y="1311.5" href="#c" fill="#1a287e" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="377" x="954" y="1165.7" href="#c" fill="#4657c2" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="378" x="982.1" y="1214.3" href="#c" fill="#3848b1" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="379" x="1010.2" y="1262.8" href="#c" fill="#2b3ba1" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="380" x="1038.3" y="1311.4" href="#c" fill="#202f8f" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="381" x="1010" y="1165.6" href="#c" fill="#5767cf" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="382" x="1038.1" y="1214.2" href="#c" fill="#4354bf" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="383" x="1066.2" y="1262.8" href="#c" fill="#3445af" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="384" x="1094.3" y="1311.3" href="#c" fill="#2738a1" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="385" x="1066.1" y="1165.6" href="#c" fill="#6a78d8" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="386" x="1094.2" y="1214.1" href="#c" fill="#5060c9" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="387" x="1122.2" y="1262.7" href="#c" fill="#3e4fbb" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="388" x="1150.3" y="1311.3" href="#c" fill="#2f41ac" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="389" x="1122.5" y="1165.8" href="#c" fill="#7e8cdf" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="390" x="1150.6" y="1214.3" href="#c" fill="#616fd3" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="391" x="1178.7" y="1262.9" href="#c" fill="#4a5ac5" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="392" x="1206.8" y="1311.5" href="#c" fill="#394ab7" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="393" x="1009.5" y="971" href="#c" fill="#f5f7fd" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="394" x="1037.6" y="1019.6" href="#c" fill="#f2f3fb" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="395" x="1065.7" y="1068.2" href="#c" fill="#d4daf5" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="396" x="1093.8" y="1116.8" href="#c" fill="#aab2ea" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="397" x="897.1" y="776.7" href="#c" fill="#5a6ad0" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="398" x="925.2" y="825.3" href="#c" fill="#8b96e2" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="399" x="953.3" y="873.9" href="#c" fill="#b8beee" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="400" x="981.4" y="922.5" href="#c" fill="#dbdff5" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="401" x="784.8" y="582.4" href="#c" fill="#1b276e" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="402" x="812.9" y="631" href="#c" fill="#243287" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="403" x="841" y="679.6" href="#c" fill="#2f3fa0" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="404" x="869.1" y="728.1" href="#c" fill="#3d4db8" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="405" x="842.8" y="583.5" href="#d" fill="#0d1442" clipPath="url(#dClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="406" x="1178.5" y="1165.7" href="#c" fill="#98a3e6" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="407" x="1206.6" y="1214.3" href="#c" fill="#7785db" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="408" x="1234.7" y="1262.8" href="#c" fill="#5868ce" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="409" x="1262.8" y="1311.4" href="#c" fill="#4354c0" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="410" x="1065.5" y="971" href="#c" fill="#e8e9f9" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="411" x="1093.6" y="1019.6" href="#c" fill="#f9fafe" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="412" x="1121.7" y="1068.2" href="#c" fill="#e5e8f8" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="413" x="1149.8" y="1116.8" href="#c" fill="#ced3f2" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="414" x="953.2" y="776.7" href="#c" fill="#4e5ec8" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="415" x="981.3" y="825.2" href="#c" fill="#7381db" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="416" x="1009.4" y="873.8" href="#c" fill="#a0a9e8" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="417" x="1037.5" y="922.4" href="#c" fill="#c7cdf1" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="418" x="840.8" y="582.3" href="#c" fill="#162161" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="419" x="868.9" y="630.9" href="#c" fill="#1e2b79" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="420" x="897" y="679.5" href="#c" fill="#293793" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="421" x="925.1" y="728.1" href="#c" fill="#3746ae" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="423" x="870.8" y="534.9" href="#d" fill="#0b123f" clipPath="url(#dClip)"/>
              <use className={styles.use} data-index="422" x="812.8" y="533.8" href="#c" fill="#0f184c" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="424" x="1234.6" y="1165.6" href="#c" fill="#b2b9ed" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="425" x="1262.6" y="1214.2" href="#c" fill="#8d98e3" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="426" x="1290.7" y="1262.8" href="#c" fill="#6977d7" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="427" x="1318.8" y="1311.4" href="#c" fill="#4e60c9" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="428" x="1121.5" y="970.9" href="#c" fill="#d5daf5" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="429" x="1149.7" y="1019.5" href="#c" fill="#f4f4fb" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="430" x="1177.8" y="1068.1" href="#c" fill="#f4f5fd" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="431" x="1205.9" y="1116.7" href="#c" fill="#d8dcf5" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="432" x="1009.2" y="776.6" href="#c" fill="#4859c4" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="433" x="1037.3" y="825.2" href="#c" fill="#6474d6" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="434" x="1065.4" y="873.8" href="#c" fill="#8a95e2" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="435" x="1093.5" y="922.4" href="#c" fill="#b2b9ec" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="436" x="896.9" y="582.3" href="#c" fill="#131c55" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="437" x="925" y="630.9" href="#c" fill="#1a256d" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="438" x="953.1" y="679.5" href="#c" fill="#24338d" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="439" x="981.2" y="728.1" href="#c" fill="#3343ac" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="442" x="898.7" y="486.2" href="#d" fill="#060b2c" clipPath="url(#dClip)"/>
              <use className={styles.use} data-index="440" x="840.7" y="485.1" href="#c" fill="#090f38" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="441" x="868.8" y="533.7" href="#c" fill="#0d1444" clipPath="url(#cClip)"/>
          </g>
          <g data-role="stripe">
              <use className={styles.use} data-index="443" x="1290.6" y="1165.6" href="#c" fill="#ccd2f2" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="444" x="1318.7" y="1214.2" href="#c" fill="#a7b0ea" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="445" x="1346.7" y="1262.7" href="#c" fill="#818edf" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="446" x="1374.8" y="1311.3" href="#c" fill="#6171d2" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="447" x="1177.6" y="970.9" href="#c" fill="#c6ccf1" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="448" x="1205.7" y="1019.5" href="#c" fill="#e5e8f9" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="449" x="1233.8" y="1068.1" href="#c" fill="#f9fafe" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="450" x="1261.9" y="1116.7" href="#c" fill="#ebecf8" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="451" x="1065.3" y="776.6" href="#c" fill="#4254bf" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="452" x="1093.3" y="825.2" href="#c" fill="#5c6cd0" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="453" x="1121.5" y="873.7" href="#c" fill="#7a87dd" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="454" x="1149.6" y="922.3" href="#c" fill="#9fa9e8" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="455" x="952.9" y="582.2" href="#c" fill="#121b50" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="456" x="981" y="630.8" href="#c" fill="#1b2670" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="457" x="1009.1" y="679.4" href="#c" fill="#23328b" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="458" x="1037.2" y="728" href="#c" fill="#3041a8" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="462" x="926.7" y="437.6" href="#d" fill="#030617" clipPath="url(#dClip)"/>
              <use className={styles.use} data-index="459" x="868.7" y="436.5" href="#c" fill="#070b26" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="460" x="896.8" y="485.1" href="#c" fill="#090f33" clipPath="url(#cClip)"/>
              <use className={styles.use} data-index="461" x="924.9" y="533.7" href="#c" fill="#0e1440" clipPath="url(#cClip)"/>
          </g>
        </g>
      </svg>
    </Link>
  )
}
