/**
 * Slyce AI — two controllers that only ever write paddle.targetY (and pick
 * the paddle's maxSpeed lane). All actual movement, clamping, and velocity
 * estimation happen in physics.ts at the fixed substep.
 *
 * The asymmetry is the game design:
 * - The OPPONENT (right paddle, always) predicts with straight lines only.
 *   Its blindness to Magnus curvature — plus a throttled re-prediction
 *   cadence and a hard commit lock near its plane — is exactly why slicing
 *   curve balls beats it. Do NOT teach it about spin.
 * - The SHOWMAN (left paddle, attract mode) predicts by rolling a cloned
 *   ball through the real physics, so it can afford to spend every return
 *   showing off a slice — which is what a self-playing header artwork is for.
 */

import { Ball, C, Game, rand01, stepBallFree } from './physics';

export interface Controller {
  /** Called once per physics substep, before stepGame. */
  update(g: Game, dt: number): void;
}

/**
 * Straight-line + wall-fold prediction. DELIBERATELY ignores Magnus and wall
 * grip — that blindness is the game: curved balls land somewhere else.
 * The ball's center bounces inside [y0 + BALL_R, y1 − BALL_R], so the fold
 * is a triangle wave over that span.
 */
export function predictLinear(b: Ball, planeX: number, y0: number, y1: number): number {
  if (b.vx === 0) return b.y;
  const t = (planeX - b.x) / b.vx; // caller guarantees the ball moves toward planeX
  const span = y1 - y0 - 2 * C.BALL_R;
  const yr = b.y - (y0 + C.BALL_R) + b.vy * t;
  const period = 2 * span;
  const p = ((yr % period) + period) % period;
  return (p > span ? period - p : p) + y0 + C.BALL_R;
}

/** The shipping opponent: linear-only, throttled, committed. `side` picks
 * the paddle it drives (+1 right — the classic setup — or −1 left, which
 * happens after a promotion hands the sim to the right-side player). */
export function createOpponent(side: -1 | 1): Controller {
  let towardTime = 0; // s since the ball last turned toward us
  let sincePredict = Infinity; // s since the last prediction
  let target: number | null = null;
  let locked = false;

  return {
    update(g: Game, dt: number): void {
      const p = side === 1 ? g.right : g.left;
      const b = g.ball;
      const toward = side === 1 ? b.vx > 0 : b.vx < 0;
      p.maxSpeed = C.AI_MAX_SPEED;

      if (g.serveTimer > 0 || !toward) {
        // Ball parked or moving away: forget the rally and drift home slowly.
        towardTime = 0;
        sincePredict = Infinity;
        locked = false;
        target = null;
        p.maxSpeed = C.AI_MAX_SPEED * C.AI_IDLE_DRIFT;
        p.targetY = (g.y0 + g.y1) / 2;
        return;
      }

      towardTime += dt;
      if (sincePredict !== Infinity) sincePredict += dt;

      // Commit lock: inside the final AI_LOCK_FRAC of the court the AI stops
      // re-predicting. A heavy-spin ball drifts ~½·K·ω·|v|·t² ≈ 100–300 px
      // during that locked stretch — more than half a paddle — so genuinely
      // spun balls beat it. This IS the whiff mechanic; no curve compensation.
      if (side === 1 ? b.x >= p.x - g.w * C.AI_LOCK_FRAC : b.x <= p.x + g.w * C.AI_LOCK_FRAC) {
        locked = true;
      }

      if (
        !locked &&
        towardTime >= C.AI_REACTION_MS / 1000 &&
        (sincePredict === Infinity || sincePredict >= C.AI_REPREDICT_MS / 1000)
      ) {
        // Deterministic per-return error (stable across re-predictions of
        // the same return, so the target doesn't jitter).
        const err =
          (rand01(`slyce:ai:${g.rallyHits}:${g.scoreL}:${g.scoreR}`) - 0.5) *
          2 *
          C.AI_ERROR_PX;
        const contactX = p.x - side * (C.PADDLE_W / 2 + C.BALL_R);
        target = predictLinear(b, contactX, g.y0, g.y1) + err;
        sincePredict = 0;
      }

      p.targetY = target ?? p.y;
    },
  };
}

/**
 * The attract-mode showman: left paddle. Curve-aware (rolls the real
 * physics forward on a clone), and it never just blocks — it parks beyond
 * the intercept and sweeps through the contact point at slice speed, so
 * every attract return paints a curved, colored trail. Roughly every 4th
 * return (hash-selected) sweeps above SUPER_SPEED for a rainbow super hit.
 */
export function createShowman(): Controller {
  let predicted: { y: number; t: number } | null = null;
  let sincePredict = Infinity;
  let swinging = false;

  const rollout = (g: Game): { y: number; t: number } | null => {
    // Clone the ball and integrate the REAL flight (Magnus + wall grip) at a
    // coarse 1/60 step until it reaches our contact plane. ≤ 300 iterations
    // of pure arithmetic — cheap, and exact enough that rallies live long.
    const b: Ball = { ...g.ball };
    const contactX = g.left.x + C.PADDLE_W / 2 + C.BALL_R;
    const step = 1 / 60;
    for (let i = 0; i < 300; i++) {
      stepBallFree(b, g, step);
      if (b.x <= contactX) return { y: b.y, t: (i + 1) * step };
      if (b.x > g.w + 2 * C.BALL_R) break; // curved away past the far edge
    }
    return null; // heavy spin can loop the ball — give up and re-predict later
  };

  return {
    update(g: Game, dt: number): void {
      const p = g.left;
      const b = g.ball;

      if (g.serveTimer > 0 || b.vx >= 0) {
        predicted = null;
        sincePredict = Infinity;
        swinging = false;
        p.maxSpeed = C.SHOW_CRUISE;
        p.targetY = (g.y0 + g.y1) / 2;
        return;
      }

      if (sincePredict !== Infinity) sincePredict += dt;
      if (predicted) predicted.t -= dt; // keep time-to-contact current

      if (!swinging && (sincePredict === Infinity || sincePredict >= C.SHOW_REPREDICT_S)) {
        predicted = rollout(g) ?? predicted;
        sincePredict = 0;
      }
      if (!predicted) {
        p.maxSpeed = C.SHOW_CRUISE;
        p.targetY = (g.y0 + g.y1) / 2;
        return;
      }

      // Per-return choreography, hashed so it survives re-renders and stays
      // deterministic: sweep direction, sweep speed, and the occasional super.
      const key = `slyce:show:${g.rallyHits}:${g.scoreL}:${g.scoreR}`;
      const isSuper = rand01(`${key}:super`) < C.SHOW_SUPER_CHANCE;
      const sweepSpeed = isSuper
        ? C.SHOW_SUPER_MIN + rand01(`${key}:ss`) * C.SHOW_SUPER_VAR
        : C.SHOW_SWEEP_MIN + rand01(`${key}:s`) * C.SHOW_SWEEP_VAR;
      // Park offset = sweepSpeed·SWING_T, so the sweep always lasts SWING_T
      // seconds — long enough for the EMA velocity the slice reads to warm
      // to ~97% of sweepSpeed by contact (see SHOW_SWING_T in physics.ts).
      const amp = sweepSpeed * C.SHOW_SWING_T;
      let dir = rand01(`${key}:d`) < 0.5 ? -1 : 1;
      // Flip the sweep if the park spot would leave the court (the clamp in
      // movePaddle would desync the sweep timing).
      if (
        predicted.y - dir * amp < g.y0 + p.h / 2 ||
        predicted.y - dir * amp > g.y1 - p.h / 2
      ) {
        dir = -dir;
      }

      // Begin the sweep when the remaining flight time equals SWING_T — the
      // paddle center then crosses the intercept exactly at contact, moving
      // at sweepSpeed. That paddle velocity is what the slice math in
      // physics.ts reads.
      if (!swinging && predicted.t <= C.SHOW_SWING_T) swinging = true;

      if (swinging) {
        p.maxSpeed = sweepSpeed;
        p.targetY = predicted.y + dir * (amp + 600); // sweep THROUGH contact
      } else {
        p.maxSpeed = C.SHOW_CRUISE;
        p.targetY = predicted.y - dir * amp;
      }
    },
  };
}
