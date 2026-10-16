/**
 * Procedural low-poly terrain builder for Logo2.
 *
 * The world is one finite square map built once from a MapConfig — no
 * chunking, no streaming. The illusion of an endless world comes from fog:
 * the autopilot never leaves FLIGHT.hardRadius, and the map edge is always
 * farther away than MAP.fogFar (invariant spelled out in Logo2.tsx), so the
 * edge is never visible.
 *
 * Faceting comes from geometry, not tricks: the displaced plane is converted
 * to non-indexed triangles so computeVertexNormals() yields one true normal
 * per face, and each face gets a single flat color from its centroid's
 * elevation band.
 */

import {
  BufferAttribute,
  Color,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  BufferGeometry,
} from 'three';
import { fbm2, hash2, hashSeed } from './noise';

/**
 * The map authoring surface. An instance of this lives at the top of
 * Logo2.tsx — edit it (especially `seed`) to author a new world.
 */
export type MapConfig = {
  /** Everything derives from this string: terrain, star field, flight path. */
  seed: string;
  /** World units per side of the square map. */
  size: number;
  /** Grid cells per side. 200 => 80,000 triangles — one static draw call. */
  segments: number;
  /** World-unit height of a 1.0 normalized elevation. */
  amplitude: number;
  /** Macro noise cycles across the whole map at octave 0. */
  baseFrequency: number;
  octaves: number;
  /** Frequency multiplier per octave (~2.0). */
  lacunarity: number;
  /** Amplitude multiplier per octave (~0.5). */
  persistence: number;
  /** Elevation shaping: pow(fbm, exponent). >1 widens valleys, sharpens peaks. */
  exponent: number;
  /** Normalized (0..1) height of the water plane. */
  waterLevel: number;
  /** Ascending elevation color stops; a face uses the first band whose
   *  `upTo` its normalized centroid elevation does not exceed. */
  bands: { upTo: number; color: number }[];
  waterColor: number;
  /** MUST equal the scene background color set in Logo2.tsx, so terrain
   *  dissolves seamlessly into sky with no visible horizon seam. */
  fogColor: number;
  fogNear: number;
  fogFar: number;
  starCount: number;
};

export type Terrain = {
  /** The faceted land mass. */
  mesh: Mesh;
  /** Translucent still-water plane at waterLevel * amplitude. */
  water: Mesh;
  /** Star dome; the caller re-centers it on the camera every frame so it
   *  behaves like a skybox (infinitely far away). */
  stars: Points;
  /**
   * World-unit ground height at any (x, z). This is the single source of
   * elevation truth: the geometry displacement above AND the autopilot's
   * terrain-following both call it, so they can never drift apart.
   */
  sampleElevation: (x: number, z: number) => number;
  dispose: () => void;
};

/** Dome radius — MUST sit between MAP.fogFar (1300) and the camera far
 *  plane in Logo2.tsx (1500): under fogFar, stars would pass the depth test
 *  in front of still-visible mountain silhouettes (their material is
 *  depth-tested even with depthWrite off); past the far plane, they'd be
 *  clipped out of existence. */
const STAR_DOME_RADIUS = 1400;

export const buildTerrain = (cfg: MapConfig): Terrain => {
  const seed = hashSeed(cfg.seed);

  const sampleElevation = (x: number, z: number): number => {
    const nx = (x / cfg.size) * cfg.baseFrequency;
    const nz = (z / cfg.size) * cfg.baseFrequency;
    const n = fbm2(nx, nz, seed, cfg.octaves, cfg.lacunarity, cfg.persistence);
    return Math.pow(n, cfg.exponent) * cfg.amplitude;
  };

  // --- Land: displace a plane, then de-index it for per-face shading ------
  const indexed = new PlaneGeometry(cfg.size, cfg.size, cfg.segments, cfg.segments);
  indexed.rotateX(-Math.PI / 2); // plane is born in XY; lay it flat on XZ
  const src = indexed.attributes.position;
  for (let i = 0; i < src.count; i++) {
    src.setY(i, sampleElevation(src.getX(i), src.getZ(i)));
  }

  // toNonIndexed() duplicates shared vertices so each triangle owns its
  // three — the prerequisite for both true face normals and per-face color.
  const geometry = indexed.toNonIndexed();
  indexed.dispose();

  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const bandColors = cfg.bands.map((b) => new Color(b.color));
  for (let i = 0; i < pos.count; i += 3) {
    const centroidY = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const t = centroidY / cfg.amplitude;
    let band = bandColors[bandColors.length - 1];
    for (let b = 0; b < cfg.bands.length; b++) {
      if (t <= cfg.bands[b].upTo) {
        band = bandColors[b];
        break;
      }
    }
    for (let v = i; v < i + 3; v++) {
      colors[v * 3] = band.r;
      colors[v * 3 + 1] = band.g;
      colors[v * 3 + 2] = band.b;
    }
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  // On non-indexed geometry this produces one normal per face => faceting.
  geometry.computeVertexNormals();

  const landMaterial = new MeshLambertMaterial({
    vertexColors: true,
    flatShading: true, // belt-and-braces with the face normals above
  });
  const mesh = new Mesh(geometry, landMaterial);

  // --- Water: a single still quad at the configured level -----------------
  const waterGeometry = new PlaneGeometry(cfg.size, cfg.size);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new MeshLambertMaterial({
    color: cfg.waterColor,
    transparent: true,
    opacity: 0.86, // just enough see-through for the submerged shelf to read
  });
  const water = new Mesh(waterGeometry, waterMaterial);
  water.position.y = cfg.waterLevel * cfg.amplitude;

  // --- Stars: deterministic points on the upper hemisphere ----------------
  // Uniform y in [0.12, 1] is uniform area on the sphere (Archimedes' hat-box
  // theorem), so the sky doesn't clump at the zenith; the 0.12 floor keeps
  // stars from poking through the fogged terrain at the horizon.
  const starSeed = hashSeed(cfg.seed + ':stars');
  const starPositions = new Float32Array(cfg.starCount * 3);
  for (let i = 0; i < cfg.starCount; i++) {
    const azimuth = hash2(i, 1, starSeed) * Math.PI * 2;
    const yUnit = 0.12 + 0.88 * hash2(i, 2, starSeed);
    const rxz = Math.sqrt(1 - yUnit * yUnit);
    starPositions[i * 3] = Math.cos(azimuth) * rxz * STAR_DOME_RADIUS;
    starPositions[i * 3 + 1] = yUnit * STAR_DOME_RADIUS;
    starPositions[i * 3 + 2] = Math.sin(azimuth) * rxz * STAR_DOME_RADIUS;
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new BufferAttribute(starPositions, 3));
  const starMaterial = new PointsMaterial({
    color: 0xcfe0ff,
    size: 2,
    sizeAttenuation: false, // constant pixel size — they read as infinitely far
    fog: false, // the dome sits beyond fogFar; fogging it would erase it
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const stars = new Points(starGeometry, starMaterial);

  return {
    mesh,
    water,
    stars,
    sampleElevation,
    dispose: () => {
      geometry.dispose();
      landMaterial.dispose();
      waterGeometry.dispose();
      waterMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
    },
  };
};
