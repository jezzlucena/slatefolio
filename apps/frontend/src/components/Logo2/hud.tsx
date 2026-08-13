/**
 * Glass-cockpit HUD for Logo2: three inline-SVG instruments (artificial
 * horizon, heading compass tape, altitude tape) overlaid on the WebGL canvas.
 *
 * Architecture: <Hud> renders a static, hydration-stable skeleton once (every
 * tick and label comes from a deterministic loop — no randomness, no
 * client-only branches). Per-frame values then flow in through updateHud(),
 * called from the rAF loop in Logo2.tsx, which writes transforms/text
 * directly onto the ref'd elements — React state is never touched per frame.
 *
 * Every instrument has a fixed viewBox so the per-frame transforms are
 * written in user units; CSS (Logo2.module.scss) sizes the instruments
 * responsively without ever changing the math here.
 */

import type { RefObject } from 'react';
import type { FlightState } from './autopilot';
import styles from './Logo2.module.scss';

export type HudRefs = {
  /** Moving part of the artificial horizon (sky/ground + pitch ladder). */
  ladder: RefObject<SVGGElement | null>;
  compassTape: RefObject<SVGGElement | null>;
  headingText: RefObject<SVGTextElement | null>;
  altTape: RefObject<SVGGElement | null>;
  altText: RefObject<SVGTextElement | null>;
  /** Group of per-POI compass markers — children indexed in POI order. */
  compassPois: RefObject<SVGGElement | null>;
  /** Container of per-POI viewport markers — children in POI order. */
  poiLayer: RefObject<HTMLDivElement | null>;
  /** Terrain backdrop of the minimap — painted once by Logo2's effect. */
  minimapCanvas: RefObject<HTMLCanvasElement | null>;
  /** Drone arrow on the minimap — translated/rotated per frame. */
  minimapDrone: RefObject<SVGPolygonElement | null>;
};

/**
 * World-unit radius covered by the minimap (viewBox center 50, edge 100).
 * MUST cover FLIGHT.hardRadius (600) and every POI position in Logo2.tsx
 * with some margin, or the drone/POIs would slide off the map.
 */
export const MINIMAP_RANGE = 700;

/** Static identity of a POI, for the markup skeleton. */
export type PoiHud = {
  letter: string;
  colorCss: string;
  /** Minimap position in its 0..100 viewBox (from world x/z / MINIMAP_RANGE). */
  mapX: number;
  mapY: number;
};

/**
 * Per-frame POI display state, computed by the render loop in Logo2.tsx
 * (it owns the camera) and consumed here. One mutable object per POI,
 * reused across frames — array order MUST match the `pois` prop given to
 * <Hud>, which both index the same underlying authoring list.
 */
export type PoiFrame = {
  /** Bearing to the POI relative to the current heading, degrees in
   *  (-180, 180]. The compass marker shows while this is inside the
   *  ±90° tape window; conversion to SVG units happens in updateHud. */
  bearingDeltaDeg: number;
  /** Inside the viewport? Then the marker is just the letter, pinned to the
   *  POI's projected center; otherwise it's arrow + letter on the edge. */
  onScreen: boolean;
  /** Marker position, CSS pixels relative to the wrapper: the projected POI
   *  center when on screen, a clamped point on the screen border otherwise. */
  x: number;
  y: number;
  /** Direction the arrow points, CSS degrees (0 = right, clockwise);
   *  meaningless while onScreen (the arrow is hidden). */
  angleDeg: number;
  /** Distance fade: near-full when close, floor when out by the fog. */
  opacity: number;
};

/** SVG user units per degree of pitch — MUST match the ladder rung spacing
 *  below (rungs every 10 degrees, 22 units apart). */
export const HORIZON_PX_PER_DEG = 2.2;
/** SVG user units per degree of heading — MUST match the compass tick
 *  x-positions below (ticks every 5 degrees, 15 units apart). */
export const COMPASS_PX_PER_DEG = 3;
/** SVG user units per metre — MUST match the altitude tick spacing below
 *  (ticks every 10 m, 24 units apart). */
export const ALT_PX_PER_M = 2.4;

/**
 * Compass viewBox size in user units. 540 / COMPASS_PX_PER_DEG = a
 * 180-degree-wide window; the height is 40 of tape + a 16-unit POI lane
 * underneath. MUST match the aspect-ratio of .compass in Logo2.module.scss
 * (540 / 56) — CSS stretches the window, never widens it.
 */
const COMPASS_VIEW_W = 540;
const COMPASS_VIEW_H = 56;
/** Where the lubber line / readout sit, and where updateHud pins the
 *  current heading. */
const COMPASS_CENTER = COMPASS_VIEW_W / 2;

/**
 * Compass ticks are rendered for a full extra half-turn on each side of
 * 0..360, so the tape cycles seamlessly through the wrap in either direction
 * with plenty of labeled tape in view. The margin (180 degrees) MUST stay
 * greater than the window half-width (90 degrees: COMPASS_VIEW_W /
 * COMPASS_PX_PER_DEG / 2), or the window scrolls onto blank tape at the wrap.
 */
const COMPASS_MIN = -180;
const COMPASS_MAX = 540;

/**
 * Altitude viewBox height in user units. 480 / ALT_PX_PER_M = a 200 m
 * window (±100 m around the readout). MUST match the aspect-ratio of
 * .altitude in Logo2.module.scss (64 / 480).
 */
const ALT_VIEW_H = 480;
/** Where the caret / readout sit, and where updateHud pins the altitude. */
const ALT_CENTER = ALT_VIEW_H / 2;

/**
 * Altitude tape range. The window half-height is 100 m (ALT_CENTER /
 * ALT_PX_PER_M), so:
 *   - ALT_MAX MUST exceed MAP.amplitude + FLIGHT.clearance (in Logo2.tsx)
 *     plus 100 m of window, or the tape goes blank over the highest peaks
 *     (current worst case: 200 + 45 + 100 = 345 m).
 *   - ALT_MIN MUST sit at least 100 m below the lowest flight altitude
 *     (~water level + clearance, comfortably positive), so the visible
 *     edge never scrolls past the last negative tick.
 * Negative ticks are deliberate: low flight shows real tape under the 0
 * line instead of empty space.
 */
const ALT_MIN = -100;
const ALT_MAX = 400;

/** Pitch ladder rungs, degrees. Flight pitch stays well inside ±40. */
const LADDER_DEGS = [-40, -30, -20, -10, 10, 20, 30, 40];

/** Roll bezel tick angles, degrees from straight up. */
const ROLL_TICKS = [-45, -30, -20, -10, 10, 20, 30, 45];

const CARDINALS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

const headingLabel = (deg: number): string => {
  const norm = ((deg % 360) + 360) % 360;
  return CARDINALS[norm] ?? String(norm).padStart(3, '0');
};

/** Only touch the DOM when the rounded value actually changed. */
const setText = (el: SVGTextElement | null, next: string): void => {
  if (el && el.textContent !== next) el.textContent = next;
};

const RAD2DEG = 180 / Math.PI;

/** Called from the rAF loop — writes straight to the SVG/DOM, no React. */
export const updateHud = (refs: HudRefs, s: FlightState, pois: PoiFrame[]): void => {
  const pitchDeg = s.pitch * RAD2DEG;
  const rollDeg = s.roll * RAD2DEG;

  // Rotate BEFORE translate: the pitch offset is applied inside the rolled
  // frame, so the ladder slides perpendicular to the tilted horizon — this
  // order is how a real attitude indicator behaves, don't swap it.
  // Negative roll: banking right (positive aviation roll) shows the horizon
  // rotated counterclockwise against the fixed aircraft symbol.
  refs.ladder.current?.setAttribute(
    'transform',
    `rotate(${(-rollDeg).toFixed(2)} 100 100) translate(0 ${(pitchDeg * HORIZON_PX_PER_DEG).toFixed(2)})`,
  );

  refs.compassTape.current?.setAttribute(
    'transform',
    `translate(${(COMPASS_CENTER - s.headingDeg * COMPASS_PX_PER_DEG).toFixed(2)} 0)`,
  );
  setText(refs.headingText.current, String(Math.round(s.headingDeg) % 360).padStart(3, '0'));

  // Tick for altitude `a` sits at y = -a * ALT_PX_PER_M in tape coordinates,
  // so this translate puts the current altitude at the window center
  // (ALT_CENTER) and the tape slides DOWN as the drone climbs.
  refs.altTape.current?.setAttribute(
    'transform',
    `translate(0 ${(ALT_CENTER + s.altitudeMSL * ALT_PX_PER_M).toFixed(2)})`,
  );
  setText(refs.altText.current, String(Math.round(s.altitudeMSL)));

  // Minimap: the world is static and north-up; only the drone arrow moves.
  const drone = refs.minimapDrone.current;
  if (drone) {
    const mx = 50 + (s.x / MINIMAP_RANGE) * 50;
    const my = 50 + (s.z / MINIMAP_RANGE) * 50; // +z is south => down, as drawn
    drone.setAttribute(
      'transform',
      `translate(${mx.toFixed(2)} ${my.toFixed(2)}) rotate(${s.headingDeg.toFixed(1)})`,
    );
  }

  // POI overlays: compass markers slide to their current bearing; viewport
  // markers translate/rotate/fade in CSS pixels. Children are indexed in
  // POI order — the skeleton below renders them from the same list.
  const compassMarkers = refs.compassPois.current?.children;
  const viewportMarkers = refs.poiLayer.current?.children;
  for (let i = 0; i < pois.length; i++) {
    const f = pois[i];

    const cm = compassMarkers?.[i] as SVGGElement | undefined;
    if (cm) {
      // Window half-width in degrees: COMPASS_VIEW_W / COMPASS_PX_PER_DEG / 2.
      if (Math.abs(f.bearingDeltaDeg) <= COMPASS_VIEW_W / COMPASS_PX_PER_DEG / 2) {
        cm.setAttribute('visibility', 'visible');
        cm.setAttribute(
          'transform',
          `translate(${(COMPASS_CENTER + f.bearingDeltaDeg * COMPASS_PX_PER_DEG).toFixed(1)} 0)`,
        );
      } else {
        cm.setAttribute('visibility', 'hidden');
      }
    }

    const em = viewportMarkers?.[i] as HTMLDivElement | undefined;
    if (em) {
      em.style.opacity = f.opacity.toFixed(2);
      // Second translate centers the marker box on the point, so an
      // on-screen letter sits exactly on the bullseye/sphere center.
      em.style.transform = `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px) translate(-50%, -50%)`;
      const arrow = em.firstElementChild as HTMLElement | null;
      if (arrow) {
        // display (not visibility): a hidden-but-laid-out arrow would push
        // the letter off the POI center in on-screen mode.
        arrow.style.display = f.onScreen ? 'none' : 'block';
        if (!f.onScreen) arrow.style.transform = `rotate(${f.angleDeg.toFixed(1)}deg)`;
      }
    }
  }
};

/** Static instrument skeleton. Rendered once; animated only via updateHud. */
export function Hud({ refs, pois }: { refs: HudRefs; pois: PoiHud[] }) {
  return (
    <>
      {/* ------- Artificial horizon (attitude indicator) ------- */}
      <svg className={styles.horizon} viewBox="0 0 200 200">
        <defs>
          <clipPath id="logo2-adi-clip">
            <circle cx={100} cy={100} r={90} />
          </clipPath>
        </defs>
        <g clipPath="url(#logo2-adi-clip)">
          {/* Moving frame: horizon at y=100 when pitch=0. Rects are oversized
              so no edge shows at any roll/pitch combination. */}
          <g ref={refs.ladder}>
            <rect x={-200} y={-400} width={600} height={500} fill="currentColor" opacity={0.08} />
            <rect x={-200} y={100} width={600} height={500} fill="currentColor" opacity={0.2} />
            <line x1={-80} y1={100} x2={280} y2={100} stroke="currentColor" strokeWidth={1.5} />
            {LADDER_DEGS.map((deg) => {
              // Rung spacing: 10 deg * HORIZON_PX_PER_DEG px/deg = 22 units.
              const y = 100 - deg * HORIZON_PX_PER_DEG;
              return (
                <g key={deg}>
                  <line
                    x1={78} y1={y} x2={122} y2={y}
                    stroke="currentColor" strokeWidth={1}
                    strokeDasharray={deg < 0 ? '4 3' : undefined}
                  />
                  <text x={72} y={y + 3} textAnchor="end" fontSize={9} fill="currentColor">
                    {Math.abs(deg)}
                  </text>
                  <text x={128} y={y + 3} textAnchor="start" fontSize={9} fill="currentColor">
                    {Math.abs(deg)}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
        {/* Fixed bezel: outline + roll ticks the horizon rotates against. */}
        <circle cx={100} cy={100} r={90} fill="none" stroke="currentColor" strokeWidth={1.5} />
        <polygon points="100,12 96,20 104,20" fill="currentColor" />
        {ROLL_TICKS.map((a) => (
          <line
            key={a}
            x1={100} y1={10} x2={100} y2={Math.abs(a) % 30 === 0 ? 2 : 5}
            stroke="currentColor" strokeWidth={1.5}
            transform={`rotate(${a} 100 100)`}
          />
        ))}
        {/* Fixed aircraft symbol — the reference the world tilts around. */}
        <path
          d="M 58 100 H 86 L 93 108 L 100 100 L 107 108 L 114 100 H 142"
          fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round"
        />
        <circle cx={100} cy={100} r={2.2} fill="currentColor" />
      </svg>

      {/* ------- Heading compass tape ------- */}
      <svg className={styles.compass} viewBox={`0 0 ${COMPASS_VIEW_W} ${COMPASS_VIEW_H}`}>
        {/* Initial transform = heading 0 (north) centered — matches what
            updateHud writes for headingDeg=0, so SSR markup is honest. */}
        <g ref={refs.compassTape} transform={`translate(${COMPASS_CENTER} 0)`}>
          {Array.from(
            { length: (COMPASS_MAX - COMPASS_MIN) / 5 + 1 },
            (_, i) => COMPASS_MIN + i * 5,
          ).map((deg) => {
            const major = deg % 30 === 0;
            return (
              <g key={deg}>
                <line
                  x1={deg * COMPASS_PX_PER_DEG} y1={2}
                  x2={deg * COMPASS_PX_PER_DEG} y2={major ? 12 : 8}
                  stroke="currentColor" strokeWidth={major ? 1.5 : 1}
                />
                {major && (
                  <text
                    x={deg * COMPASS_PX_PER_DEG} y={22}
                    textAnchor="middle" fontSize={9} fill="currentColor"
                  >
                    {headingLabel(deg)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
        {/* Fixed lubber line + boxed digital readout. */}
        <polygon
          points={`${COMPASS_CENTER},22 ${COMPASS_CENTER - 4},26 ${COMPASS_CENTER + 4},26`}
          fill="currentColor"
        />
        <rect x={COMPASS_CENTER - 19} y={26} width={38} height={13} rx={2} fill="rgba(0, 0, 0, 0.55)" stroke="currentColor" strokeWidth={1} />
        <text ref={refs.headingText} x={COMPASS_CENTER} y={36} textAnchor="middle" fontSize={11} fill="currentColor">
          000
        </text>
        {/* POI lane (y 42..56, below the readout box): one caret + letter
            per POI, slid to its bearing by updateHud. Hidden until the
            first frame computes real bearings — SSR shows an empty lane. */}
        <g ref={refs.compassPois}>
          {pois.map((p) => (
            <g key={p.letter} visibility="hidden">
              {/* Caret pointing at the tape, pin disc with a dark letter —
                  same treatment as the viewport badges (.poiBadge). */}
              <polygon points="0,42 -4,46 4,46" fill={p.colorCss} />
              <circle cx={0} cy={51} r={5} fill={p.colorCss} />
              <text x={0} y={54} textAnchor="middle" fontSize={9} fill="#0b1026">
                {p.letter}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* ------- Altitude tape ------- */}
      <svg className={styles.altitude} viewBox={`0 0 64 ${ALT_VIEW_H}`}>
        <line x1={1} y1={0} x2={1} y2={ALT_VIEW_H} stroke="currentColor" strokeWidth={1.5} />
        {/* Initial transform = 0 m centered; updateHud repositions on the
            very first frame, before the wrapper fades in. */}
        <g ref={refs.altTape} transform={`translate(0 ${ALT_CENTER})`}>
          {Array.from(
            { length: (ALT_MAX - ALT_MIN) / 10 + 1 },
            (_, i) => ALT_MIN + i * 10,
          ).map((alt) => {
            const major = alt % 50 === 0;
            return (
              <g key={alt}>
                {/* Tick lengths 6 minor / 10 major — same as the compass. */}
                <line
                  x1={1} y1={-alt * ALT_PX_PER_M}
                  x2={major ? 11 : 7} y2={-alt * ALT_PX_PER_M}
                  stroke="currentColor" strokeWidth={major ? 1.5 : 1}
                />
                {major && (
                  <text
                    x={16} y={-alt * ALT_PX_PER_M + 3}
                    textAnchor="start" fontSize={9} fill="currentColor"
                  >
                    {alt}
                  </text>
                )}
              </g>
            );
          })}
        </g>
        {/* Fixed readout: caret at the tape, boxed metres value. Box and
            text metrics (38x13, rx 2, font 11) MUST stay identical to the
            compass readout so the two instruments read as one family. */}
        <text x={31} y={ALT_CENTER - 16} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.7}>
          ALT · M
        </text>
        <polygon
          points={`4,${ALT_CENTER} 12,${ALT_CENTER - 5} 12,${ALT_CENTER + 5}`}
          fill="currentColor"
        />
        <rect x={12} y={ALT_CENTER - 6.5} width={38} height={13} rx={2} fill="rgba(0, 0, 0, 0.55)" stroke="currentColor" strokeWidth={1} />
        <text ref={refs.altText} x={31} y={ALT_CENTER + 3.5} textAnchor="middle" fontSize={11} fill="currentColor">
          0
        </text>
      </svg>

      {/* ------- Viewport POI markers ------- */}
      {/* One marker per POI, always tracking it: inside the viewport it's
          the bare letter pinned to the POI's projected center; outside, an
          arrow + letter on the screen edge aimed at where the POI would
          appear. updateHud drives transform/opacity/arrow per frame; the
          whole marker fades with distance. Starts invisible (opacity 0). */}
      <div ref={refs.poiLayer} className={styles.poiLayer}>
        {pois.map((p) => (
          <div key={p.letter} className={styles.poiMarker} style={{ opacity: 0 }}>
            {/* MUST stay the first child — updateHud rotates/hides
                firstElementChild. */}
            <svg className={styles.poiArrow} viewBox="0 0 12 12">
              <polygon points="2,1 11,6 2,11" fill={p.colorCss} />
            </svg>
            {/* Pin badge: dark letter on a disc of the POI color — readable
                over any terrain, for every hue (see .poiBadge). */}
            <span className={styles.poiBadge} style={{ backgroundColor: p.colorCss }}>
              {p.letter}
            </span>
          </div>
        ))}
      </div>

      {/* ------- Minimap ------- */}
      {/* North-up overview of the MINIMAP_RANGE-radius flight area. The
          canvas backdrop (terrain bands, top-down) is painted once by
          Logo2's mount effect; POIs are static dots; only the drone arrow
          moves (updateHud translates + rotates it by heading). */}
      <div className={styles.minimap}>
        <canvas ref={refs.minimapCanvas} width={96} height={96} className={styles.minimapCanvas} />
        <svg className={styles.minimapOverlay} viewBox="0 0 100 100">
          {pois.map((p) => (
            <g key={p.letter}>
              <circle cx={p.mapX} cy={p.mapY} r={2} fill={p.colorCss} />
              {/* White glyph with a dark outline (paint-order draws the
                  stroke behind the fill) — legible on any terrain color. */}
              <text
                x={p.mapX + 3.5} y={p.mapY + 2.5} fontSize={6}
                fill="#ffffff" paintOrder="stroke"
                stroke="rgba(11, 16, 38, 0.9)" strokeWidth={0.9}
              >
                {p.letter}
              </text>
            </g>
          ))}
          <polygon
            ref={refs.minimapDrone}
            points="0,-4.5 3,3.5 0,1.5 -3,3.5"
            fill="currentColor"
            transform="translate(50 50)"
          />
        </svg>
      </div>
    </>
  );
}
