/**
 * Seeded value-noise toolkit for Logo2's procedural world.
 *
 * Everything here is a pure function of its inputs — no Math.random anywhere
 * in this folder (family rule: deterministic variation only). That gives us
 * two guarantees the component depends on:
 *   1. Same seed string => same map and same flight path, every load.
 *   2. SSR and client never disagree, because nothing is time- or
 *      entropy-dependent.
 */

/** FNV-1a: hash an authoring seed string down to a uint32 lattice seed. */
export const hashSeed = (seed: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/**
 * Integer lattice hash: (ix, iz, seed) -> [0, 1). Murmur3-style finalizer —
 * the avalanche passes are what keep neighboring lattice cells uncorrelated,
 * so don't simplify them away.
 */
export const hash2 = (ix: number, iz: number, seed: number): number => {
  let h = seed ^ Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/** Quintic fade (6t^5 - 15t^4 + 10t^3): C2-continuous, so facet lighting
 *  never shows lattice-cell seams the way linear interpolation would. */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/** 2D value noise in [0, 1): hashed lattice corners, quintic bilinear blend. */
export const valueNoise2 = (x: number, z: number, seed: number): number => {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = fade(x - x0);
  const tz = fade(z - z0);
  const c00 = hash2(x0, z0, seed);
  const c10 = hash2(x0 + 1, z0, seed);
  const c01 = hash2(x0, z0 + 1, seed);
  const c11 = hash2(x0 + 1, z0 + 1, seed);
  const nx0 = c00 + (c10 - c00) * tx;
  const nx1 = c01 + (c11 - c01) * tx;
  return nx0 + (nx1 - nx0) * tz;
};

/** Per-octave seed decorrelation so octaves don't stack their lattice grids. */
const octaveSeed = (seed: number, o: number): number =>
  (seed ^ Math.imul(o + 1, 0x9e3779b1)) >>> 0;

/**
 * Fractal Brownian motion: `octaves` layers of value noise, each `lacunarity`
 * times finer and `persistence` times fainter. Normalized back to [0, 1] so
 * callers can treat the result as an absolute elevation fraction.
 */
export const fbm2 = (
  x: number,
  z: number,
  seed: number,
  octaves: number,
  lacunarity: number,
  persistence: number,
): number => {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise2(x * freq, z * freq, octaveSeed(seed, o)) * amp;
    norm += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return sum / norm;
};

/** 1D fBm (a slice of the 2D field) — drives the autopilot's heading wander. */
export const fbm1 = (t: number, seed: number, octaves: number): number =>
  fbm2(t, 0.5, seed, octaves, 2.0, 0.5);
