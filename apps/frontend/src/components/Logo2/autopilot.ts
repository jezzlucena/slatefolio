/**
 * Autopilot for Logo2's invisible drone.
 *
 * Pure math — no three.js imports; positions and angles are plain numbers so
 * this module is trivially testable and reusable. Logo2.tsx maps the state
 * onto the camera each frame.
 *
 * Conventions (must match the camera mapping in Logo2.tsx):
 *   - heading: radians, 0 = flying toward -Z, increasing clockwise seen from
 *     above (+X is "east"). Advance direction is (sin h, -cos h) on XZ, which
 *     is exactly what camera.rotation.y = -heading looks along.
 *   - pitch: radians, positive = nose up (camera.rotation.x = pitch).
 *   - roll: aviation sign, positive = right wing down. The camera banks with
 *     rotation.z = -roll, and the HUD's artificial horizon counter-rotates by
 *     the same angle.
 *
 * Determinism: the wander noise is sampled at an internal simTime accumulator
 * that only advances inside update(), so a given seed always flies the same
 * path over the same amount of simulated time — pauses (tab hidden, scrolled
 * past) don't advance or reshuffle the flight.
 */

import { fbm1 } from './noise';

export type FlightConfig = {
  /** Constant forward speed, world units / s. */
  speed: number;
  /** Minimum height kept above the sampled terrain (or water) below/ahead. */
  clearance: number;
  /** Distance from map center where homing starts blending in. */
  softRadius: number;
  /** Distance where homing reaches full strength — the flight envelope. */
  hardRadius: number;
  /** rad/s. */
  maxTurnRate: number;
  /** rad — bank angle at full turn rate. */
  maxBank: number;
  /** 1/s — exponential response rate for altitude changes. */
  altResponse: number;
  /** 1/s — exponential response rate for pitch/roll presentation. */
  attitudeResponse: number;
  /** Time scale of the heading wander (higher = twitchier flight). */
  wanderFrequency: number;
  /** Distances ahead (world units) sampled for terrain-following; include 0
   *  so the drone also respects the ground directly beneath it. */
  lookAheadDistances: number[];
  startAltitude: number;
};

export type FlightState = {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  /** = y; named for what the HUD altitude tape displays. */
  altitudeMSL: number;
  /** heading normalized to 0..360 for the HUD compass. */
  headingDeg: number;
};

/** Wrap an angle difference into (-PI, PI] so steering takes the short way. */
const shortestAngle = (a: number): number => {
  const twoPi = Math.PI * 2;
  return a - twoPi * Math.round(a / twoPi);
};

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(Math.max(v, lo), hi);

export const createAutopilot = (
  cfg: FlightConfig,
  sampleElevation: (x: number, z: number) => number,
  waterY: number,
  flightSeed: number,
): { update: (dt: number) => FlightState } => {
  let x = 0;
  let z = 0;
  let y = cfg.startAltitude;
  // Deterministic initial heading — a different seed also takes off in a
  // different direction, not just over different terrain.
  let heading = (Math.floor(fbm1(0.5, flightSeed, 1) * 8) / 8) * Math.PI * 2;
  let pitch = 0;
  let roll = 0;
  let simTime = 0;

  // One mutable state object reused across frames — update() runs inside a
  // rAF loop, so per-frame allocation would just feed the GC.
  const state: FlightState = {
    x, y, z, heading, pitch, roll,
    altitudeMSL: y,
    headingDeg: 0,
  };

  const update = (dt: number): FlightState => {
    // --- Steering: noise wander, overridden by homing near the edge -------
    const wander =
      (fbm1(simTime * cfg.wanderFrequency, flightSeed, 3) - 0.5) *
      2 *
      cfg.maxTurnRate;

    const r = Math.hypot(x, z);
    // 0 inside softRadius, 1 at hardRadius: how urgently to steer home.
    const homing = clamp((r - cfg.softRadius) / (cfg.hardRadius - cfg.softRadius), 0, 1);
    // Heading whose advance direction (sin h, -cos h) points at the origin.
    const headingToCenter = Math.atan2(-x, z);
    const error = shortestAngle(headingToCenter - heading);
    // Proportional steering saturating past ~0.5 rad of error — a sign()
    // here would chatter when already pointed home.
    const homeTurn = clamp(error / 0.5, -1, 1) * cfg.maxTurnRate;

    const turnRate = clamp(
      wander * (1 - homing) + homeTurn * homing,
      -cfg.maxTurnRate,
      cfg.maxTurnRate,
    );

    heading += turnRate * dt;
    x += Math.sin(heading) * cfg.speed * dt;
    z += -Math.cos(heading) * cfg.speed * dt;

    // --- Altitude: clear the highest ground along the flight path ---------
    let targetY = -Infinity;
    for (const d of cfg.lookAheadDistances) {
      const ax = x + Math.sin(heading) * d;
      const az = z - Math.cos(heading) * d;
      const ground = Math.max(sampleElevation(ax, az), waterY);
      targetY = Math.max(targetY, ground + cfg.clearance);
    }
    // 1 - exp(-k*dt) is the frame-rate-independent form of exponential
    // smoothing — a naive per-frame lerp factor would fly differently at
    // 30fps vs 144fps.
    const altBlend = 1 - Math.exp(-cfg.altResponse * dt);
    const prevY = y;
    y += (targetY - y) * altBlend;

    // --- Attitude presentation: pitch from climb, bank from turn ----------
    const climbRate = dt > 0 ? (y - prevY) / dt : 0;
    const targetPitch = Math.atan2(climbRate, cfg.speed);
    const targetRoll = (turnRate / cfg.maxTurnRate) * cfg.maxBank;
    const attBlend = 1 - Math.exp(-cfg.attitudeResponse * dt);
    pitch += (targetPitch - pitch) * attBlend;
    roll += (targetRoll - roll) * attBlend;

    simTime += dt;

    state.x = x;
    state.y = y;
    state.z = z;
    state.heading = heading;
    state.pitch = pitch;
    state.roll = roll;
    state.altitudeMSL = y;
    state.headingDeg = (((heading * 180) / Math.PI) % 360 + 360) % 360;
    return state;
  };

  return { update };
};
