/**
 * Points of Interest for Logo2's world: persistent, hand-authored landmarks
 * that exist in three places at once —
 *   1. in the 3D scene (built here): ground POIs are flat bullseyes laid on
 *      the terrain (perspective skews them naturally at grazing angles), air
 *      POIs are nested "bullseye spheres" floating at a fixed altitude;
 *   2. on the HUD compass, at their current bearing (hud.tsx);
 *   3. as edge-of-screen markers when outside the viewport (hud.tsx).
 * The letter/color identity is shared by all three representations; the
 * authoring list lives in Logo2.tsx next to MAP and FLIGHT.
 *
 * Everything uses unlit MeshBasicMaterial so the markers read as emissive
 * beacons rather than terrain — fog still applies, so they fade with
 * distance like everything else.
 */

import {
  BufferGeometry,
  CircleGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';

export type PoiConfig = {
  /** Single identifying letter, shown on the compass and edge markers. */
  letter: string;
  color: number;
  kind: 'ground' | 'air';
  x: number;
  z: number;
  /** Air POIs only: world-unit altitude (clamped above the local terrain). */
  altitude?: number;
};

export type Poi = {
  letter: string;
  color: number;
  /** Resolved world position — ground POIs get their y from the terrain. */
  position: Vector3;
};

export type PoiSet = {
  group: Group;
  /** Same order as the input configs — the HUD markup indexes by this. */
  pois: Poi[];
  dispose: () => void;
};

/** '#rrggbb' for the HUD side (SVG fills, DOM colors). */
export const cssColor = (c: number): string =>
  `#${c.toString(16).padStart(6, '0')}`;

/** Ground bullseye radii: solid heart, two rings around it. */
const BULL_HEART = 8;
const BULL_RINGS: [number, number][] = [
  [16, 22],
  [30, 36],
];
/** Outermost bullseye radius — the terrain is sampled out to here so a
 *  slope can't poke through the rings. */
const BULL_EXTENT = 36;

/** Air bullseye-sphere shells: [radius, opacity], innermost first (solid). */
const SPHERE_SHELLS: [number, number][] = [
  [7, 1],
  [15, 0.22],
  [23, 0.1],
];

export const buildPois = (
  configs: PoiConfig[],
  sampleElevation: (x: number, z: number) => number,
  waterY: number,
): PoiSet => {
  const group = new Group();
  const pois: Poi[] = [];
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  for (const cfg of configs) {
    let position: Vector3;

    if (cfg.kind === 'ground') {
      // Sit the bullseye above the highest terrain under its full extent
      // (center + the four cardinal edge points), not just its center —
      // otherwise a slope slices through the outer ring. The +1.5 lifts it
      // clear of z-fighting with the terrain facets.
      let ground = sampleElevation(cfg.x, cfg.z);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        ground = Math.max(
          ground,
          sampleElevation(cfg.x + dx * BULL_EXTENT, cfg.z + dz * BULL_EXTENT),
        );
      }
      position = new Vector3(cfg.x, Math.max(ground, waterY) + 1.5, cfg.z);

      const heart = new CircleGeometry(BULL_HEART, 24);
      const rings = BULL_RINGS.map(([inner, outer]) => new RingGeometry(inner, outer, 40));
      for (const geo of [heart, ...rings]) {
        geo.rotateX(-Math.PI / 2); // born facing +Z; lay it flat facing up
        const mat = new MeshBasicMaterial({ color: cfg.color });
        const mesh = new Mesh(geo, mat);
        mesh.position.copy(position);
        group.add(mesh);
        geometries.push(geo);
        materials.push(mat);
      }
    } else {
      // Air POI: keep authored altitude but never let it sink into a peak.
      const ground = Math.max(sampleElevation(cfg.x, cfg.z), waterY);
      position = new Vector3(cfg.x, Math.max(cfg.altitude ?? 0, ground + 40), cfg.z);

      for (const [radius, opacity] of SPHERE_SHELLS) {
        const geo = new SphereGeometry(radius, 20, 14);
        const mat = new MeshBasicMaterial({
          color: cfg.color,
          transparent: opacity < 1,
          opacity,
          // Translucent shells must not write depth or they'd occlude the
          // solid heart and each other in draw order.
          depthWrite: opacity === 1,
        });
        const mesh = new Mesh(geo, mat);
        mesh.position.copy(position);
        group.add(mesh);
        geometries.push(geo);
        materials.push(mat);
      }
    }

    pois.push({ letter: cfg.letter, color: cfg.color, position });
  }

  return {
    group,
    pois,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
};
