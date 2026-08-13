/**
 * Scenery for Logo2's world: low-poly trees (forest clusters + isolated
 * loners) and a few ships on the deeper water.
 *
 * Placement is fully deterministic — every coordinate comes from hash2 on a
 * ':scenery'-derived seed, so the same map seed always grows the same woods
 * and anchors the same fleet.
 *
 * Collision contract with the autopilot: the drone's terrain-following
 * IGNORES scenery on purpose (FLIGHT.lookAheadDistances sample bare ground),
 * so nothing here may come close to FLIGHT.clearance (45) above its footing:
 *   - tallest tree = (2.6 + 12) * 1.4 max scale ≈ 20.5 above ground;
 *   - ships reach ≈ 5 above the water plane.
 * If you make taller scenery, raise FLIGHT.clearance with it.
 *
 * Perf: all trees land in TWO InstancedMesh draw calls (trunks + canopies);
 * ships are a handful of shared-geometry meshes.
 */

import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { hash2, hashSeed } from './noise';
import type { MapConfig } from './terrain';

const FOREST_CLUSTERS = 10;
/** Cluster centers land within this radius of the map center — the zone the
 *  flight envelope (hardRadius 600) actually tours. */
const CLUSTER_RANGE = 1000;
const ISOLATED_TREES = 45;
const ISOLATED_RANGE = 1600; // must stay < MAP.size / 2 (2000)
const SHIP_COUNT = 6;
const SHIP_RANGE = 1000;

/** Trees grow between the sand line and the rock line (normalized
 *  elevation) — mirrors the grass/forest bands in MAP.bands. */
const TREE_MIN_T = 0.365;
const TREE_MAX_T = 0.68;

export type Scenery = {
  group: Group;
  dispose: () => void;
};

export const buildScenery = (
  cfg: MapConfig,
  sampleElevation: (x: number, z: number) => number,
  waterY: number,
): Scenery => {
  const seed = hashSeed(cfg.seed + ':scenery');
  const group = new Group();

  // --- Trees: gather eligible spots first, then instance them ------------
  type TreeSpot = { x: number; z: number; y: number; s: number };
  const trees: TreeSpot[] = [];
  const tryTree = (x: number, z: number, lane: number) => {
    const e = sampleElevation(x, z);
    const t = e / cfg.amplitude;
    if (t < TREE_MIN_T || t > TREE_MAX_T) return; // beach, water, or rock
    trees.push({ x, z, y: e, s: 0.75 + hash2(lane, 91, seed) * 0.65 });
  };

  let lane = 0; // running hash lane so every draw is decorrelated
  for (let c = 0; c < FOREST_CLUSTERS; c++) {
    const cx = (hash2(c, 11, seed) * 2 - 1) * CLUSTER_RANGE;
    const cz = (hash2(c, 12, seed) * 2 - 1) * CLUSTER_RANGE;
    const radius = 50 + hash2(c, 13, seed) * 45;
    const count = 18 + Math.floor(hash2(c, 14, seed) * 13);
    for (let i = 0; i < count; i++) {
      lane++;
      const a = hash2(lane, 21, seed) * Math.PI * 2;
      // sqrt on the radial draw => uniform density over the disc area
      // (a linear draw would pile trees up at the cluster center).
      const r = Math.sqrt(hash2(lane, 22, seed)) * radius;
      tryTree(cx + Math.cos(a) * r, cz + Math.sin(a) * r, lane);
    }
  }
  for (let i = 0; i < ISOLATED_TREES; i++) {
    lane++;
    tryTree(
      (hash2(lane, 31, seed) * 2 - 1) * ISOLATED_RANGE,
      (hash2(lane, 32, seed) * 2 - 1) * ISOLATED_RANGE,
      lane,
    );
  }

  // Geometries are baked with their base at y=0 so an instance's position
  // is simply its footing on the terrain.
  const trunkGeo = new CylinderGeometry(0.7, 1.1, 3.2, 5);
  trunkGeo.translate(0, 1.6, 0);
  const canopyGeo = new ConeGeometry(4.6, 12, 6);
  canopyGeo.translate(0, 6, 0);
  const trunkMat = new MeshLambertMaterial({ color: 0x5a4632, flatShading: true });
  const canopyMat = new MeshLambertMaterial({ flatShading: true }); // color per instance
  const trunks = new InstancedMesh(trunkGeo, trunkMat, trees.length);
  const canopies = new InstancedMesh(canopyGeo, canopyMat, trees.length);

  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const sc = new Vector3();
  const canopyA = new Color(0x35703a);
  const canopyB = new Color(0x1e4a28);
  const mix = new Color();
  trees.forEach((t, i) => {
    m.compose(p.set(t.x, t.y, t.z), q, sc.set(t.s, t.s, t.s));
    trunks.setMatrixAt(i, m);
    // Canopy starts a little below the trunk top so no seam shows.
    m.compose(p.set(t.x, t.y + 2.6 * t.s, t.z), q, sc.set(t.s, t.s, t.s));
    canopies.setMatrixAt(i, m);
    canopies.setColorAt(i, mix.lerpColors(canopyA, canopyB, hash2(i, 71, seed)));
  });
  group.add(trunks, canopies);

  // --- Ships: a few hulls on deep water -----------------------------------
  const hullGeo = new BoxGeometry(15, 4, 5);
  const cabinGeo = new BoxGeometry(4.5, 3, 4);
  const hullMat = new MeshLambertMaterial({ color: 0x717a86, flatShading: true });
  const cabinMat = new MeshLambertMaterial({ color: 0xd9dee6, flatShading: true });

  let ships = 0;
  for (let i = 0; i < 40 && ships < SHIP_COUNT; i++) {
    const x = (hash2(i, 41, seed) * 2 - 1) * SHIP_RANGE;
    const z = (hash2(i, 42, seed) * 2 - 1) * SHIP_RANGE;
    // Demand deep water under the hull AND a boat-length around it, so no
    // ship ends up beached on a sandbank.
    let deep = true;
    for (const [dx, dz] of [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12]] as const) {
      if (sampleElevation(x + dx, z + dz) > waterY - 8) {
        deep = false;
        break;
      }
    }
    if (!deep) continue;

    const ship = new Group();
    const hull = new Mesh(hullGeo, hullMat);
    hull.position.y = 0.6; // waterline: hull mostly above, slightly immersed
    const cabin = new Mesh(cabinGeo, cabinMat);
    cabin.position.set(-3.5, 3.4, 0); // aft superstructure
    ship.add(hull, cabin);
    ship.position.set(x, waterY, z);
    ship.rotation.y = hash2(i, 43, seed) * Math.PI * 2;
    group.add(ship);
    ships++;
  }

  return {
    group,
    dispose: () => {
      trunkGeo.dispose();
      canopyGeo.dispose();
      trunkMat.dispose();
      canopyMat.dispose();
      trunks.dispose(); // frees the instance buffers
      canopies.dispose();
      hullGeo.dispose();
      cabinGeo.dispose();
      hullMat.dispose();
      cabinMat.dispose();
    },
  };
};
