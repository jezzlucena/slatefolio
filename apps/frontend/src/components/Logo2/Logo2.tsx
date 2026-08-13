'use client'

/**
 * Logo2 — first flight of the family: an invisible drone on autopilot over a
 * seeded low-poly world, seen first-person through a working glass-cockpit
 * HUD (artificial horizon, heading tape, altitude tape).
 *
 * Moving parts, each in its own module:
 *   noise.ts     — seeded value-noise fBm (deterministic, no Math.random)
 *   terrain.ts   — builds the faceted land / water / star meshes from MAP
 *   autopilot.ts — pure-math flight model driven by FLIGHT
 *   hud.tsx      — static SVG instruments + the per-frame updateHud writer
 *
 * This file owns the three.js lifecycle: one renderer, one scene, one rAF
 * loop, all created in a single mount effect and torn down completely on
 * unmount (the Header arrows swap logos live, so unmount is frequent —
 * leak-free disposal is mandatory, not a nicety).
 */

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { createAutopilot, type FlightConfig } from './autopilot';
import { Hud, updateHud, MINIMAP_RANGE, type HudRefs, type PoiFrame, type PoiHud } from './hud';
import { hashSeed } from './noise';
import { buildPois, cssColor, type PoiConfig } from './pois';
import { buildScenery } from './scenery';
import { buildTerrain, type MapConfig } from './terrain';
import styles from './Logo2.module.scss';

/* ===================== MAP & FLIGHT AUTHORING ============================
 * Edit these (and only these) to author a new world. Same seed => same map,
 * same star field, same flight path, deterministically — SSR-safe because
 * nothing in this folder touches Math.random. */

const MAP: MapConfig = {
  seed: 'slatefolio',
  size: 4000,
  segments: 200, // 80,000 triangles, one static draw call (20-unit cells)
  amplitude: 200,
  baseFrequency: 4,
  octaves: 6,
  lacunarity: 2.0,
  persistence: 0.55, // > 0.5 keeps more high-frequency energy => rougher relief
  exponent: 1.6, // widens valleys, sharpens peaks
  waterLevel: 0.32,
  bands: [
    { upTo: 0.3, color: 0x1d4e6b }, // submerged shelf (under the water plane)
    { upTo: 0.36, color: 0xc9b47a }, // sand
    { upTo: 0.55, color: 0x4a7a3a }, // grass
    { upTo: 0.7, color: 0x35592e }, // forest
    { upTo: 0.86, color: 0x6e6a63 }, // rock
    { upTo: 1.01, color: 0xe8ecef }, // snow (1.01 so t=1.0 can't fall through)
  ],
  waterColor: 0x2e6f8e,
  fogColor: 0x0b1026, // must match scene.background below — seamless horizon
  fogNear: 350,
  fogFar: 1300,
  starCount: 350,
};

const FLIGHT: FlightConfig = {
  speed: 60,
  clearance: 45,
  softRadius: 420,
  hardRadius: 600,
  maxTurnRate: 0.35,
  maxBank: (28 * Math.PI) / 180,
  altResponse: 1.2,
  attitudeResponse: 3.0,
  wanderFrequency: 0.05,
  lookAheadDistances: [0, 45, 90, 150, 220], // extra far sample: steep peaks need earlier climbs
  startAltitude: 120,
};

/**
 * Points of Interest: persistent landmarks at hand-authored positions.
 * Ground POIs read their height from the terrain (skewed bullseyes); air
 * POIs float at their authored altitude (bullseye spheres). Letters/colors
 * are fixed identity: A red, B green, C blue, D cyan, E yellow, F magenta.
 * Keep every position inside FLIGHT.hardRadius (600) so the autopilot
 * actually roams near them.
 */
const POIS: PoiConfig[] = [
  { letter: 'A', color: 0xff4545, kind: 'ground', x: 260, z: -180 },
  { letter: 'B', color: 0x35d465, kind: 'air', x: -330, z: 150, altitude: 300 },
  { letter: 'C', color: 0x3b82ff, kind: 'ground', x: 80, z: 430 },
  { letter: 'D', color: 0x35e0dc, kind: 'air', x: 430, z: 310, altitude: 340 },
  { letter: 'E', color: 0xffd93b, kind: 'ground', x: -460, z: -360 },
  { letter: 'F', color: 0xff54e1, kind: 'air', x: -90, z: -530, altitude: 260 },
];

/** Static POI identity handed to the HUD skeleton — same order as POIS
 *  (updateHud indexes markers by position in this list). Minimap coords
 *  share MINIMAP_RANGE with the drone arrow and the canvas backdrop. */
const POI_HUD: PoiHud[] = POIS.map((p) => ({
  letter: p.letter,
  colorCss: cssColor(p.color),
  mapX: 50 + (p.x / MINIMAP_RANGE) * 50,
  mapY: 50 + (p.z / MINIMAP_RANGE) * 50,
}));

/* Invariant arithmetic (each side commented at its definition):
 *   FLIGHT.hardRadius + MAP.fogFar = 600 + 1300 = 1900 < MAP.size / 2 = 2000
 *     => from anywhere the drone can be, the map edge is beyond the fog, so
 *        the finite world reads as infinite.
 *   CAM_FAR (1500) >= MAP.fogFar (1300), and > the 1400-unit star dome in
 *     terrain.ts => nothing pops out of existence before fog hides it.
 *   ALT_MAX in hud.tsx (400) > MAP.amplitude + FLIGHT.clearance + the 100 m
 *     tape half-window = 200 + 45 + 100 = 345 => the altitude tape never
 *     scrolls onto blank space over the highest peaks.
 *   FLIGHT.clearance (45) > the tallest scenery (~20.5-unit trees,
 *     ~5-unit ships — see the contract in scenery.ts) => the autopilot can
 *     ignore trees and ships without ever clipping one. */

/** Pixel-ratio cap: a full-viewport canvas above DPR 2 costs 4x+ the fill
 *  rate for no visible gain on the fogged low-poly look. */
const MAX_DPR = 2;
/** Clamp on the frame delta (s) so a tab-restore or GC spike can't teleport
 *  the drone. */
const MAX_DT = 0.1;
const CAM_FOV = 60;
const CAM_FAR = 1500;

/** Edge-marker insets, CSS px: keep markers clear of the TopBar (~62px
 *  tall) and readable at the side edges. The bottom inset is computed per
 *  frame instead (edgePadBottom below): the name/role bar's top sits at
 *  ~217px + 6vh from the viewport bottom (see the geometry note in
 *  Logo2.module.scss), so it needs the live viewport height. */
const EDGE_PAD_X = 32;
const EDGE_PAD_TOP = 86;
/** Clearance above the viewport bottom: the bar top (217px + 6vh) + gap. */
const edgePadBottom = (viewH: number) => viewH * 0.06 + 235;

const RAD2DEG = 180 / Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
/** Wrap a degree difference into (-180, 180]. */
const shortestDeg = (a: number) => a - 360 * Math.round(a / 360);

export default function Logo2() {
  const wrapper = useRef<HTMLDivElement>(null);
  const ladder = useRef<SVGGElement>(null);
  const compassTape = useRef<SVGGElement>(null);
  const headingText = useRef<SVGTextElement>(null);
  const altTape = useRef<SVGGElement>(null);
  const altText = useRef<SVGTextElement>(null);
  const compassPois = useRef<SVGGElement>(null);
  const poiLayer = useRef<HTMLDivElement>(null);
  const minimapCanvas = useRef<HTMLCanvasElement>(null);
  const minimapDrone = useRef<SVGPolygonElement>(null);

  /* One mount effect owns the whole three.js lifecycle. Pause inputs (tab
   * visibility, scroll position, reduced motion) are read via listeners into
   * closure variables instead of hook state on purpose: the old Logo2 put
   * scrollY in its effect deps and tore the effect down on every scroll tick
   * — harmless for a setInterval, fatal for a WebGL context. */
  useEffect(() => {
    const host = wrapper.current;
    if (!host) return;

    // The canvas is created HERE, not in JSX, on purpose: cleanup ends with
    // forceContextLoss(), and React re-runs this effect on the same DOM in
    // dev StrictMode — a JSX-owned canvas would hand the second run its
    // already-lost context and nothing would ever render again. A fresh
    // element per effect run means a fresh WebGL context per run.
    const cv = document.createElement('canvas');
    cv.className = styles.canvas;
    host.prepend(cv); // before the HUD div, so the instruments paint on top

    const refs: HudRefs = {
      ladder, compassTape, headingText, altTape, altText,
      compassPois, poiLayer, minimapCanvas, minimapDrone,
    };
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas: cv, antialias: true });
    } catch {
      // No WebGL: leave the static HUD skeleton as the artwork and bail.
      cv.remove();
      host.dataset.ready = '';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));

    const scene = new Scene();
    scene.background = new Color(MAP.fogColor); // must equal MAP.fogColor
    scene.fog = new Fog(MAP.fogColor, MAP.fogNear, MAP.fogFar);

    // Cool sky bounce + a warm low sun: long facet shadows carry the whole
    // low-poly look — no shadow maps needed.
    const hemi = new HemisphereLight(0x8899cc, 0x223311, 0.6);
    const sun = new DirectionalLight(0xffe0c0, 1.4);
    sun.position.set(-600, 300, 400);
    scene.add(hemi, sun);

    const terrain = buildTerrain(MAP);
    scene.add(terrain.mesh, terrain.water, terrain.stars);

    const waterY = MAP.waterLevel * MAP.amplitude;

    const poiSet = buildPois(POIS, terrain.sampleElevation, waterY);
    scene.add(poiSet.group);

    // Trees and ships. The autopilot deliberately ignores them — scenery.ts
    // documents the height contract that keeps them below FLIGHT.clearance.
    const scenery = buildScenery(MAP, terrain.sampleElevation, waterY);
    scene.add(scenery.group);

    // Paint the minimap backdrop once: a top-down legend of the same
    // elevation field the mesh displaces, in the same band colors, covering
    // ±MINIMAP_RANGE (north/-Z up, so world +z paints downward).
    const mm = minimapCanvas.current;
    const mmCtx = mm?.getContext('2d');
    if (mm && mmCtx) {
      const N = mm.width;
      const img = mmCtx.createImageData(N, N);
      const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
      const bandRgb = MAP.bands.map((b) => rgb(b.color));
      const waterRgb = rgb(MAP.waterColor);
      for (let py = 0; py < N; py++) {
        const wz = (((py + 0.5) / N) * 2 - 1) * MINIMAP_RANGE;
        for (let px = 0; px < N; px++) {
          const wx = (((px + 0.5) / N) * 2 - 1) * MINIMAP_RANGE;
          const t = terrain.sampleElevation(wx, wz) / MAP.amplitude;
          let c = waterRgb;
          if (t > MAP.waterLevel) {
            c = bandRgb[bandRgb.length - 1];
            for (let b = 0; b < MAP.bands.length; b++) {
              if (t <= MAP.bands[b].upTo) {
                c = bandRgb[b];
                break;
              }
            }
          }
          const o = (py * N + px) * 4;
          img.data[o] = c[0];
          img.data[o + 1] = c[1];
          img.data[o + 2] = c[2];
          img.data[o + 3] = 255;
        }
      }
      mmCtx.putImageData(img, 0, 0);
    }

    const autopilot = createAutopilot(
      FLIGHT,
      terrain.sampleElevation, // single elevation source — shared with the geometry
      waterY,
      hashSeed(MAP.seed + ':flight'),
    );

    const camera = new PerspectiveCamera(CAM_FOV, 1, 1, CAM_FAR);
    // YXZ = yaw, then pitch, then roll — aviation order. Anything else makes
    // the horizon swim during banked turns.
    camera.rotation.order = 'YXZ';

    let rafId: number | null = null;
    let lastNow: number | null = null;
    let hidden = document.visibilityState === 'hidden';
    let scrolledPast = window.scrollY >= window.innerHeight;
    let viewW = 1; // CSS px, kept fresh by onResize — used by edge markers
    let viewH = 1;

    // Per-POI frame state, mutated in place each frame (no per-frame
    // allocation inside the rAF loop). Order matches POIS/POI_HUD.
    const poiFrames: PoiFrame[] = poiSet.pois.map(() => ({
      bearingDeltaDeg: 999, // outside the compass window until computed
      onScreen: false,
      x: 0,
      y: 0,
      angleDeg: 0,
      opacity: 0,
    }));
    const ndc = new Vector3(); // scratch: POI position in clip/NDC space
    const rel = new Vector3(); // scratch: camera -> POI vector
    const camDir = new Vector3();

    const updatePoiFrames = (s: { x: number; y: number; z: number; headingDeg: number }) => {
      // project() needs current camera matrices; renderer.render would also
      // update them, but only after we've already read the projections.
      camera.updateMatrixWorld();
      camera.getWorldDirection(camDir);

      for (let i = 0; i < poiSet.pois.length; i++) {
        const poi = poiSet.pois[i];
        const f = poiFrames[i];

        // --- Compass: bearing uses the same convention as heading (0 = -Z,
        // clockwise from above), so the delta drops straight onto the tape.
        const bearingDeg = Math.atan2(poi.position.x - s.x, -(poi.position.z - s.z)) * RAD2DEG;
        f.bearingDeltaDeg = shortestDeg(bearingDeg - s.headingDeg);

        // --- Viewport marker: project into NDC; a point behind the camera
        // comes out mirrored by the perspective divide, so flip it back to
        // get the true screen direction (standard offscreen-indicator trick).
        const inFront = rel.subVectors(poi.position, camera.position).dot(camDir) > 0;
        const dist = rel.length();
        ndc.copy(poi.position).project(camera);
        const nx = inFront ? ndc.x : -ndc.x;
        const ny = inFront ? ndc.y : -ndc.y;

        // Fade with distance from the drone; floor keeps far POIs findable.
        f.opacity = clamp(1.15 - dist / MAP.fogFar, 0.15, 1);

        if (inFront && Math.abs(nx) <= 1 && Math.abs(ny) <= 1) {
          // Visible in the 3D scene: pin the bare letter to the POI's
          // projected center (the bullseye/sphere heart).
          f.onScreen = true;
          f.x = (ndc.x * 0.5 + 0.5) * viewW;
          f.y = (1 - (ndc.y * 0.5 + 0.5)) * viewH;
        } else {
          // Push the NDC direction out to the unit square's edge, convert
          // to CSS px (NDC y is up, CSS y is down), then clamp into the
          // band the Header/TopBar chrome doesn't cover.
          const scale = 1 / Math.max(Math.abs(nx), Math.abs(ny));
          const ex = nx * scale;
          const ey = ny * scale;
          f.onScreen = false;
          f.x = clamp((ex * 0.5 + 0.5) * viewW, EDGE_PAD_X, viewW - EDGE_PAD_X);
          f.y = clamp((1 - (ey * 0.5 + 0.5)) * viewH, EDGE_PAD_TOP, viewH - edgePadBottom(viewH));
          f.angleDeg = Math.atan2(-ey, ex) * RAD2DEG;
        }
      }
    };

    const renderFrame = (dt: number) => {
      const s = autopilot.update(dt);
      camera.position.set(s.x, s.y, s.z);
      // Sign mapping must match the conventions doc in autopilot.ts:
      // rotation.y = -heading looks along (sin h, -cos h); rotation.z = -roll
      // banks the view right for positive (right-wing-down) aviation roll.
      camera.rotation.set(s.pitch, -s.heading, -s.roll);
      // The star dome tracks the camera on XZ so it behaves like a skybox.
      terrain.stars.position.set(s.x, 0, s.z);
      updatePoiFrames(s);
      updateHud(refs, s, poiFrames);
      renderer.render(scene, camera);
    };

    const tick = (now: number) => {
      const dt = lastNow === null ? 0 : Math.min((now - lastNow) / 1000, MAX_DT);
      lastNow = now;
      renderFrame(dt);
      rafId = requestAnimationFrame(tick);
    };

    const shouldRun = () => !hidden && !scrolledPast && !reducedMotion.matches;
    const start = () => {
      if (rafId === null && shouldRun()) {
        lastNow = null; // resume never produces a giant dt
        rafId = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
    const sync = () => (shouldRun() ? start() : stop());

    const onResize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      viewW = w;
      viewH = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // false: CSS owns the canvas display size (.canvas in Logo2.module.scss
      // stretches it to the wrapper) — setSize must not write inline styles.
      renderer.setSize(w, h, false);
      if (rafId === null) renderFrame(0); // keep a paused frame correct
    };

    const onVisibility = () => {
      hidden = document.visibilityState === 'hidden';
      sync();
    };
    const onScroll = () => {
      // The stage is position:fixed behind the page; once the viewport has
      // scrolled past one screen height the logo is fully hidden.
      scrolledPast = window.scrollY >= window.innerHeight;
      sync();
    };
    const onMotionChange = () => sync();
    const onContextLost = (e: Event) => {
      e.preventDefault(); // allow the browser to restore the context later
      stop();
    };
    const onContextRestored = () => {
      onResize();
      sync();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    reducedMotion.addEventListener('change', onMotionChange);
    cv.addEventListener('webglcontextlost', onContextLost);
    cv.addEventListener('webglcontextrestored', onContextRestored);

    onResize(); // sizes the renderer and paints the first frame

    if (reducedMotion.matches) {
      // Deterministic fast-forward: ~20s of simulated flight so the single
      // static frame is a mid-flight banked pose, not the bland takeoff.
      for (let i = 0; i < 600; i++) autopilot.update(1 / 30);
      renderFrame(0);
    } else {
      start();
    }
    host.dataset.ready = ''; // drives the CSS fade-in of canvas + HUD

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      reducedMotion.removeEventListener('change', onMotionChange);
      cv.removeEventListener('webglcontextlost', onContextLost);
      cv.removeEventListener('webglcontextrestored', onContextRestored);
      terrain.dispose();
      poiSet.dispose();
      scenery.dispose();
      renderer.dispose();
      // Safe because this canvas is discarded on the next line — the next
      // effect run (or the next logo) starts from a brand-new element.
      renderer.forceContextLoss();
      cv.remove();
      delete host.dataset.ready;
    };
  }, []);

  return (
    <Link href="/">
      <div ref={wrapper} className={styles.wrapper}>
        {/* the WebGL canvas is created by the mount effect and prepended
            here — see the comment in the effect for why it isn't JSX */}
        {/* pointer-events: none on .hud — clicks fall through to the Link */}
        <div className={styles.hud} aria-hidden="true">
          <Hud
            refs={{
              ladder, compassTape, headingText, altTape, altText,
              compassPois, poiLayer, minimapCanvas, minimapDrone,
            }}
            pois={POI_HUD}
          />
        </div>
      </div>
    </Link>
  );
}
