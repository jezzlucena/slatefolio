/**
 * Slyce physics — the pure simulation core of the pong header artwork.
 *
 * No DOM, no canvas, no React in this file: Logo3.tsx drives it from a
 * requestAnimationFrame loop, ai.ts rolls cloned balls through it to
 * predict curved flight, and the reduced-motion still frame is a
 * deterministic pre-roll of the same code.
 *
 * ── Conventions (every sign in this file derives from these) ──────────────
 * - Coordinates are CSS pixels, origin top-left, x right, **y down**.
 * - Velocities are px/s, accelerations px/s².
 * - Spin ω is rad/s, **positive = clockwise as seen on screen**. With y-down
 *   the surface velocity of a point r from the center is ω·(−r.y, r.x), so
 *   the ball's top surface (r = (0,−R)) moves +ωR in x — check: the right
 *   side of the ball (r = (R,0)) moves +y = down = clockwise. ✓
 * - The court is vertically INSET from the viewport: walls live at y0/y1
 *   (not 0/h) so the ball never hides behind the fixed TopBar (~62 px) or
 *   the viewport edges — it must be visible at all times.
 *
 * ── dt-scaling invariants ─────────────────────────────────────────────────
 * - The sim runs on a fixed substep (C.PHYS_DT). Magnus is the only
 *   per-substep force; spin decay uses exp(−k·dt) so any step size is exact.
 * - Wall kicks and paddle impulses are one-shot events, never multiplied by
 *   dt. Each contact repositions the ball out of overlap in the same substep,
 *   which is what guarantees an impulse can't re-fire while overlapping.
 * - Magnus acceleration is perpendicular to velocity, so it curves the path
 *   without changing speed — speed changes come ONLY from paddle hits and
 *   wall grip, which keeps the [MIN_SPEED, MAX_SPEED] clamp honest.
 */

/** All tuning lives here. Values are starting points chosen for a ~1400×900
 * viewport; everything meaningful is proportional to court size except the
 * speed envelope. */
export const C = {
  // --- court ---
  PADDLE_INSET: 0.1, // paddle planes at 10% / 90% of width — dodges the
  //                    Header's arrow buttons hugging the viewport edges
  WALL_TOP: 70, // px from the viewport top to the top wall — clears the
  //               fixed TopBar (~62 px) so the ball is never hidden under it
  WALL_BOTTOM: 70, // px from the viewport bottom to the bottom wall
  PADDLE_H_FRAC: 0.18, // of court span (y1−y0), clamped:
  PADDLE_H_MIN: 90,
  PADDLE_H_MAX: 170,
  PADDLE_W: 12, // 3 art pixels — everything drawn snaps to Logo3's PIX grid
  BALL_R: 8, // half-side of the square ball: 16 px = 4 art pixels

  // --- ball speed envelope ---
  SERVE_SPEED: 620,
  SPEED_UP: 1.035, // per paddle hit — the classic pong rally acceleration
  MIN_SPEED: 420,
  MAX_SPEED: 1250,
  MAX_SPEED_SUPER: 1900, // super rallies get a higher ceiling
  MIN_VX_FRAC: 0.3, // |vx| ≥ 30% of speed after any paddle hit — extreme
  //                   slices can't create an unlosable near-vertical rally

  // --- spin / Magnus ---
  MAGNUS_K: 0.07, // a_perp = K·ω·|v|; turn rate = K·ω rad/s. There is no
  //                 static ω cap — the cap is geometric, see maxOmega below:
  //                 the turn radius may never drop under the court span,
  //                 so a curved ball can never come back to its hitter
  SPIN_DECAY: 0.12, // 1/s exponential, half-life ≈ 5.8 s

  // --- wall grip (see the wall-contact derivation in stepBallFree) ---
  SPIN_LEVER: 12, // effective slip radius; larger than BALL_R on purpose so
  //                 spin reads at the wall even at modest ω
  WALL_GRIP: 0.35, // impulse = −GRIP · slip
  WALL_KICK_MAX: 260, // px/s cap on a single wall's tangential kick
  WALL_TORQUE: 0.04, // Δω per px/s of kick — friction bleeds spin into speed
  WALL_VY_MIN: 60, // px/s minimum rebound away from a wall, so Magnus can't
  //                  pin a skimming ball against it indefinitely

  // --- slice / super hit ---
  SLICE_SPIN: 0.045, // Δω rad/s per px/s of paddle velocity at contact — a
  //                    CONSTANT rate wherever on the court the hit happens;
  //                    only the geometric maxOmega cap trims the result
  SLICE_CARRY: 0.35, // fraction of paddle vy carried into ball vy
  OFFSET_VY: 340, // px/s of vy per unit contact offset (classic pong control)
  SUPER_SPEED: 1400, // |paddle vy| ≥ this at contact = super hit
  SUPER_BOOST: 1.45, // speed multiplier on super
  SUPER_SPIN: 1.5, // spin multiplier on super

  // --- super-hit theatrics ---
  SUPER_FREEZE: 0.45, // s of hitstop: the WHOLE sim (ball, paddles, AI)
  //                     pauses while "SUPER SPIN" is announced
  SUPER_TEXT: 0.6, // s the announcement shows, counted from the hit
  GLOW_FADE: 0.4, // s the speedlines take to fade once the super flight
  //                 ends — while the ball IS super they run at full strength
  CRACK_TTL: 1.6, // s a wall crack stays on screen
  CRACK_MAX: 4, // live cracks cap — oldest is evicted (they're screen-sized)

  // --- player input ---
  PLAYER_MAX_SPEED: 2600, // finite but generous: deliberate flicks clear
  //                         SUPER_SPEED easily, dt spikes and far-landing
  //                         touches can't fake one (capped follow)
  VEL_EMA_TAU: 0.05, // s — paddle-velocity smoothing time constant

  // --- AI opponent (right paddle; see ai.ts) ---
  AI_MAX_SPEED: 620,
  AI_REPREDICT_MS: 280, // prediction staleness — late-breaking curves win
  AI_REACTION_MS: 160, // human-feel delay after the ball turns toward it
  AI_ERROR_PX: 14,
  AI_LOCK_FRAC: 0.25, // commits (stops re-predicting) in the final quarter
  AI_IDLE_DRIFT: 0.4, // fraction of max speed when drifting back to center

  // --- attract-mode showman (left paddle; see ai.ts) ---
  SHOW_CRUISE: 900, // px/s while positioning
  SHOW_SWING_T: 0.18, // s the sweep lasts before contact. Must stay ≥ ~3×
  //                     VEL_EMA_TAU: the slice reads the EMA velocity, and
  //                     0.18 s warms it to ~97% of sweep speed — any shorter
  //                     and the showman's "super" swings would land under
  //                     SUPER_SPEED at contact. Park offset = speed·SWING_T.
  SHOW_SWEEP_MIN: 600, // px/s slice sweep range…
  SHOW_SWEEP_VAR: 400,
  SHOW_SUPER_MIN: 1500, // …and the super-swing range (≥ SUPER_SPEED)
  SHOW_SUPER_VAR: 300,
  SHOW_SUPER_CHANCE: 0.25,
  SHOW_REPREDICT_S: 0.1,

  // --- flow ---
  SERVE_DELAY: 0.9, // s between a point and the re-serve
  IDLE_TO_ATTRACT_MS: 15000,
  FLASH_DECAY: 6, // 1/s — paddle hit-glow fade

  // --- integration ---
  PHYS_DT: 1 / 240, // fixed substep. At MAX_SPEED_SUPER the ball moves
  //                   7.9 px/substep < BALL_R + PADDLE_W, so plane-crossing
  //                   checks per substep can't tunnel
  MAX_FRAME_DT: 0.05, // clamp on real frame dt (tab-restore spikes)

  // --- trail ---
  // Points are laid on an EXACT distance lattice — one every TRAIL_SPACING
  // px along the flight path, interpolated, never "at least" — and fade by
  // TIME (TRAIL_LIFE from birth). The renderer draws each point as a block
  // exactly TRAIL_SPACING wide, so blocks tile edge to edge with zero
  // overlap: nothing about a block ever changes except its alpha, which is
  // monotonic — that's what keeps the ribbon flicker-free.
  TRAIL_N: 256, // ring size ≥ MAX_SPEED_SUPER·TRAIL_LIFE/TRAIL_SPACING (214)
  TRAIL_LIFE: 0.9, // s a trail point lives
  TRAIL_SPACING: 8, // px between points — 2 art pixels, and the block size
};

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  omega: number; // spin, rad/s, clockwise-positive (see file header)
  theta: number; // visual rotation angle — dθ = ω·dt, so the drawn square
  //                whirls at exactly the physical spin rate
  super: boolean; // flight is "super" until the next paddle hit or score
}

export interface Paddle {
  x: number; // plane center (constant per court size)
  y: number;
  vy: number; // EMA-smoothed velocity — THE slice input at contact
  targetY: number; // controllers (pointer / AI) only ever write this
  maxSpeed: number; // capped-follow speed toward targetY
  h: number;
  flash: number; // hit glow, decays exp(−FLASH_DECAY·dt); 2 on a super
}

export interface TrailPoint {
  x: number;
  y: number;
  t: number; // game.time at birth — age (and fade) derive from this alone
  spinNorm: number; // spinNorm(ball, span) sampled when recorded — curvature
  //                   as a fraction of the geometric maximum
  super: boolean;
}

/** A pixel-crack left on a wall by a super-hit bounce. Purely visual, but it
 * lives here because the contact event that spawns it does. The crack's
 * jagged shape is derived deterministically from `seed` at draw time. */
export interface Crack {
  x: number;
  y: number; // on the wall line (y0 or y1)
  wallSign: -1 | 1; // +1 top wall (branches grow down), −1 bottom (grow up)
  ttl: number; // s remaining; alpha = ttl / CRACK_TTL
  seed: number;
}

/** The minimal court geometry stepBallFree needs — Game satisfies it, and
 * ai.ts passes Game directly when rolling out cloned balls. */
export interface Court {
  w: number;
  y0: number; // top wall
  y1: number; // bottom wall
}

export interface Game extends Court {
  h: number; // full viewport height (y0/y1 derive from it)
  ball: Ball;
  left: Paddle;
  right: Paddle;
  scoreL: number;
  scoreR: number;
  serveTimer: number; // >0: ball parked at center counting down to serve
  servingTo: -1 | 1; // −1 = toward the left paddle
  rallyHits: number; // paddle hits since last serve — hashes AI variety
  mode: 'attract' | 'player';
  time: number; // sim clock, s — advances every substep, freeze included
  freezeTimer: number; // >0: super-hit hitstop — the whole sim is paused
  announceTimer: number; // >0: "SUPER SPIN" is on screen
  superGlow: number; // speedline strength: 1 while the flight is super,
  //                    then fades to 0 over GLOW_FADE
  cracks: Crack[];
  crackSeq: number;
  trail: TrailPoint[]; // ring buffer, oldest→newest via trailHead/trailLen
  trailHead: number;
  trailLen: number;
}

/** Deterministic 0..1 hash (same helper as Logo5/Logo6 — the family
 * convention is per-component copies, not a shared util). Keeps serves and
 * AI error reproducible across re-renders; no Math.random anywhere. */
export const rand01 = (key: string): number => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** Wall positions for a viewport height — the fixed insets, softened on
 * very short viewports so the court never collapses. */
const courtBounds = (h: number): [number, number] => {
  const y0 = Math.min(C.WALL_TOP, h * 0.15);
  const y1 = Math.max(h - Math.min(C.WALL_BOTTOM, h * 0.15), y0 + 1);
  return [y0, y1];
};

const paddleHeight = (span: number): number =>
  clamp(span * C.PADDLE_H_FRAC, C.PADDLE_H_MIN, C.PADDLE_H_MAX);

const makePaddle = (x: number, y0: number, y1: number, maxSpeed: number): Paddle => ({
  x,
  y: (y0 + y1) / 2,
  vy: 0,
  targetY: (y0 + y1) / 2,
  maxSpeed,
  h: paddleHeight(y1 - y0),
  flash: 0,
});

export function createGame(w: number, h: number): Game {
  const trail: TrailPoint[] = [];
  for (let i = 0; i < C.TRAIL_N; i++) {
    trail.push({ x: 0, y: 0, t: -1, spinNorm: 0, super: false });
  }
  const [y0, y1] = courtBounds(h);
  return {
    w,
    h,
    y0,
    y1,
    ball: { x: w / 2, y: (y0 + y1) / 2, vx: 0, vy: 0, omega: 0, theta: 0, super: false },
    left: makePaddle(w * C.PADDLE_INSET, y0, y1, C.SHOW_CRUISE),
    right: makePaddle(w * (1 - C.PADDLE_INSET), y0, y1, C.AI_MAX_SPEED),
    scoreL: 0,
    scoreR: 0,
    serveTimer: C.SERVE_DELAY,
    servingTo: -1,
    rallyHits: 0,
    mode: 'attract',
    time: 0,
    freezeTimer: 0,
    announceTimer: 0,
    superGlow: 0,
    cracks: [],
    crackSeq: 0,
    trail,
    trailHead: 0,
    trailLen: 0,
  };
}

/** Recompute court-derived geometry and pull everything back in bounds.
 * Called from Logo3's resize handler; scores and rally state survive. */
export function resizeGame(g: Game, w: number, h: number): void {
  g.w = w;
  g.h = h;
  [g.y0, g.y1] = courtBounds(h);
  for (const p of [g.left, g.right]) {
    p.h = paddleHeight(g.y1 - g.y0);
    p.y = clamp(p.y, g.y0 + p.h / 2, g.y1 - p.h / 2);
    p.targetY = clamp(p.targetY, g.y0 + p.h / 2, g.y1 - p.h / 2);
  }
  g.left.x = w * C.PADDLE_INSET;
  g.right.x = w * (1 - C.PADDLE_INSET);
  const b = g.ball;
  b.x = clamp(b.x, C.BALL_R, w - C.BALL_R);
  b.y = clamp(b.y, g.y0 + C.BALL_R, g.y1 - C.BALL_R);
}

export function clearTrail(g: Game): void {
  g.trailHead = 0;
  g.trailLen = 0;
}

function layTrailPoint(g: Game, x: number, y: number, sn: number, sup: boolean): void {
  const tp = g.trail[g.trailHead];
  tp.x = x;
  tp.y = y;
  tp.t = g.time;
  tp.spinNorm = sn;
  tp.super = sup;
  g.trailHead = (g.trailHead + 1) % C.TRAIL_N;
  g.trailLen = Math.min(g.trailLen + 1, C.TRAIL_N);
}

/** Lay trail points on an exact TRAIL_SPACING lattice along a path toward
 * (x, y). When the ball has flown past one or more lattice steps since the
 * last point, the new points are placed by INTERPOLATION at exactly
 * TRAIL_SPACING intervals — never at "wherever the step happened to land".
 * Even spacing + even block size (renderer) = edge-to-edge tiling with no
 * overlap, which is what keeps the ribbon's brightness constant instead of
 * shimmering. Exported for the remote view (net.ts): guests and spectators
 * run no physics, so they trace the trail from interpolated snapshot
 * positions with the spin/super values the host reported. */
export function traceTrail(g: Game, x: number, y: number, sn: number, sup: boolean): void {
  if (g.trailLen === 0) {
    layTrailPoint(g, x, y, sn, sup);
    return;
  }
  let lx = g.trail[(g.trailHead - 1 + C.TRAIL_N) % C.TRAIL_N].x;
  let ly = g.trail[(g.trailHead - 1 + C.TRAIL_N) % C.TRAIL_N].y;
  // A physics substep moves the ball at most ~8 px, so this loop runs 0–2
  // times locally; a remote frame after a stall may lay a longer run.
  for (;;) {
    const dx = x - lx;
    const dy = y - ly;
    const dist = Math.hypot(dx, dy);
    if (dist < C.TRAIL_SPACING) return;
    const f = C.TRAIL_SPACING / dist;
    lx += dx * f;
    ly += dy * f;
    layTrailPoint(g, lx, ly, sn, sup);
  }
}

/** The local sim's per-substep trail hook. */
function pushTrail(g: Game): void {
  traceTrail(g, g.ball.x, g.ball.y, spinNorm(g.ball, g.y1 - g.y0), g.ball.super);
}

/**
 * The no-self-return spin cap. Magnus is perpendicular to velocity at
 * constant speed, so a spinning ball flies a circular arc of radius
 * R = |v| / (MAGNUS_K·ω). To reverse horizontal direction the heading must
 * turn past vertical, and turning from horizontal to vertical consumes R px
 * of lateral room — so with R ≥ span (span = y1−y0 being the MAXIMUM
 * distance between a paddle contact point and the far wall) the ball always
 * meets a wall at ≤ 90° before it could curve back to its hitter. The wall
 * reflection then resets the geometry. Hence: |ω| ≤ |v| / (MAGNUS_K·span),
 * re-enforced after every event that changes ω or speed (slice, super,
 * wall grip).
 */
export const maxOmega = (b: Ball, span: number): number =>
  Math.hypot(b.vx, b.vy) / (C.MAGNUS_K * span);

/** Spin as a fraction of the geometric cap — i.e. literally "how curved is
 * this flight relative to the most curve the court allows". Drives the
 * trail color and the ball's spin styling. */
export const spinNorm = (b: Ball, span: number): number => {
  const m = maxOmega(b, span);
  return m > 0 ? Math.min(Math.abs(b.omega) / m, 1) : 0;
};

const clampSpin = (b: Ball, span: number): void => {
  const m = maxOmega(b, span);
  b.omega = clamp(b.omega, -m, m);
};

/** Rescale velocity to a given speed, preserving direction. */
const setSpeed = (b: Ball, s: number): void => {
  const cur = Math.hypot(b.vx, b.vy);
  if (cur === 0) return;
  const f = s / cur;
  b.vx *= f;
  b.vy *= f;
};

const clampSpeed = (b: Ball): void => {
  const max = b.super ? C.MAX_SPEED_SUPER : C.MAX_SPEED;
  const cur = Math.hypot(b.vx, b.vy);
  if (cur > max) setSpeed(b, max);
  else if (cur > 0 && cur < C.MIN_SPEED) setSpeed(b, C.MIN_SPEED);
};

/**
 * Free flight: Magnus + integration + wall contact. No paddles, no scoring —
 * ai.ts rolls cloned balls through this exact function, which is what makes
 * the attract showman "curve-aware" while the real opponent stays blind.
 * Returns the wall touched this substep (+1 top / −1 bottom / 0 none) so
 * stepGame can spawn crack effects — the rollout clones just ignore it.
 */
export function stepBallFree(b: Ball, court: Court, dt: number): -1 | 0 | 1 {
  // Magnus: a = MAGNUS_K·ω·perp(v). Perpendicular to velocity, so it turns
  // the flight without changing speed (see the dt invariants in the header).
  // Sanity: rightward ball (vx>0) with clockwise spin (ω>0, topspin) gets
  // ay > 0 = downward — a topspin ball dips, backspin floats. ✓
  const ax = C.MAGNUS_K * b.omega * -b.vy;
  const ay = C.MAGNUS_K * b.omega * b.vx;
  // Semi-implicit Euler: velocity first, then position.
  b.vx += ax * dt;
  b.vy += ay * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.omega *= Math.exp(-C.SPIN_DECAY * dt);
  b.theta += b.omega * dt;

  // Wall contact. wallSign = +1 top, −1 bottom (also the "away from the
  // wall" direction in y). Reposition inside the SAME substep so the
  // impulse below fires exactly once per contact.
  let wallSign: -1 | 0 | 1 = 0;
  if (b.y <= court.y0 + C.BALL_R) {
    wallSign = 1;
    b.y = court.y0 + C.BALL_R;
  } else if (b.y >= court.y1 - C.BALL_R) {
    wallSign = -1;
    b.y = court.y1 - C.BALL_R;
  }
  if (wallSign !== 0) {
    // Reflect, with a minimum rebound so Magnus can't hold the ball pinned
    // against the wall (each re-contact would re-fire the grip impulse).
    b.vy = wallSign * Math.max(Math.abs(b.vy), C.WALL_VY_MIN);

    // Grip: the contact point's slip along the wall is
    //   slip = vx + wallSign·ω·SPIN_LEVER
    // (top wall: contact at r=(0,−R), surface velocity +ωL in x, adds to
    // slip; bottom wall: contact at r=(0,+R), surface velocity −ωL. ✓)
    // Friction opposes slip. Sanity checks:
    //  • top wall, rightward ball, ω<0 (counter-clockwise): slip = vx−|ω|L
    //    < 0 → kick > 0 → SPEEDS UP — a wheel driving along the ceiling. ✓
    //  • same ball with clockwise spin: slip large → kick < 0 → slows. ✓
    //  • bottom wall, rightward topspin (ω>0): slip = vx−|ω|L → speeds up —
    //    a car wheel on the floor. ✓
    const slip = b.vx + wallSign * b.omega * C.SPIN_LEVER;
    const kick = clamp(-C.WALL_GRIP * slip, -C.WALL_KICK_MAX, C.WALL_KICK_MAX);
    b.vx += kick;

    // The same friction torques the ball toward rolling: top wall contact at
    // r=(0,−R) with F=(kick,0) gives τ = −r.y·F.x = +R·kick, bottom gives
    // −R·kick — i.e. Δω = wallSign·kick·TORQUE. Bleeds spin plausibly and
    // can flip a light spin's sign on a hard slip.
    b.omega += wallSign * kick * C.WALL_TORQUE;
    clampSpeed(b);
    clampSpin(b, court.y1 - court.y0); // a slow-down kick shrinks the
    //                                    allowed turn radius too
  }
  return wallSign;
}

/** One paddle contact — the slice mechanic lives here. side: −1 left, +1
 * right. Returns true if the ball was hit. */
function collidePaddle(g: Game, p: Paddle, side: -1 | 1, prevX: number): boolean {
  const b = g.ball;
  // Ball-center x at contact with the paddle's front face.
  const contactX = p.x - side * (C.PADDLE_W / 2 + C.BALL_R);
  const movingToward = side === -1 ? b.vx < 0 : b.vx > 0;
  const crossed =
    side === -1
      ? prevX > contactX && b.x <= contactX
      : prevX < contactX && b.x >= contactX;
  if (!movingToward || !crossed) return false;
  if (Math.abs(b.y - p.y) > p.h / 2 + C.BALL_R) return false;

  b.x = contactX; // out of overlap in the same substep — one impulse per hit
  b.vx = -b.vx;
  setSpeed(b, Math.hypot(b.vx, b.vy) * C.SPEED_UP);

  // Classic pong angle control: contact offset steers the return.
  const u = clamp((b.y - p.y) / (p.h / 2), -1, 1);
  b.vy = 0.25 * b.vy + u * C.OFFSET_VY;

  // Slice: a moving paddle drags the ball's contact face. Contact is at
  // r = (−side·R, 0); friction F = (0, k·pvy); torque τ = r.x·F.y =
  // −side·R·k·pvy… so the spin sign is side·SLICE_SPIN·pvy with side = −1
  // left / +1 right. Sanity: the LEFT paddle swiping DOWN (pvy>0) imparts
  // ω<0 (counter-clockwise) — a backspin for the rightward return, which
  // Magnus then floats UPWARD, exactly the tennis slice. ✓
  const pvy = p.vy;
  const isSuper = Math.abs(pvy) >= C.SUPER_SPEED;
  const spinScale = isSuper ? C.SUPER_SPIN : 1;
  b.omega += side * C.SLICE_SPIN * pvy * spinScale;
  b.vy += C.SLICE_CARRY * pvy;

  b.super = isSuper; // the rainbow belongs to this flight only
  if (isSuper) setSpeed(b, Math.hypot(b.vx, b.vy) * C.SUPER_BOOST);
  clampSpeed(b);

  // Keep the return honest: enforce |vx| ≥ MIN_VX_FRAC·speed (preserving
  // speed) so an extreme slice can't produce a near-vertical stall.
  const speed = Math.hypot(b.vx, b.vy);
  const minVx = C.MIN_VX_FRAC * speed;
  if (Math.abs(b.vx) < minVx) {
    const sx = b.vx < 0 ? -1 : 1;
    const sy = b.vy < 0 ? -1 : 1;
    b.vx = sx * minVx;
    b.vy = sy * Math.sqrt(Math.max(speed * speed - minVx * minVx, 0));
  }
  // Trim to the geometric cap LAST, once the outgoing speed is final —
  // the spin a slice imparts is constant, only the cap depends on speed.
  clampSpin(b, g.y1 - g.y0);

  if (isSuper) {
    // Hitstop: the whole sim pauses while "SUPER SPIN" is announced. The
    // speedlines need no timer — superGlow tracks ball.super itself.
    g.freezeTimer = C.SUPER_FREEZE;
    g.announceTimer = C.SUPER_TEXT;
  }
  p.flash = isSuper ? 2 : 1;
  g.rallyHits += 1;
  return true;
}

/** A super-hit bounce leaves a pixel crack on the wall at the contact
 * point. Shape is derived from `seed` at draw time (Logo3.tsx). */
function spawnCrack(g: Game, x: number, wallSign: -1 | 1): void {
  if (g.cracks.length >= C.CRACK_MAX) g.cracks.shift();
  g.cracks.push({
    x,
    y: wallSign === 1 ? g.y0 : g.y1,
    wallSign,
    ttl: C.CRACK_TTL,
    seed: g.crackSeq++,
  });
}

function launchServe(g: Game): void {
  const b = g.ball;
  // Deterministic serve angle within ±25° of horizontal, toward the side
  // that conceded the last point (they receive).
  const a =
    (rand01(`slyce:serve:${g.scoreL}:${g.scoreR}`) - 0.5) * 2 * (25 * Math.PI / 180);
  b.x = g.w / 2;
  b.y = (g.y0 + g.y1) / 2;
  b.vx = g.servingTo * Math.cos(a) * C.SERVE_SPEED;
  b.vy = Math.sin(a) * C.SERVE_SPEED;
  b.omega = 0;
  b.super = false;
}

function score(g: Game, conceded: -1 | 1): void {
  if (conceded === -1) g.scoreR += 1;
  else g.scoreL += 1;
  g.servingTo = conceded;
  g.serveTimer = C.SERVE_DELAY;
  g.rallyHits = 0;
  g.ball.x = g.w / 2;
  g.ball.y = (g.y0 + g.y1) / 2;
  g.ball.vx = 0;
  g.ball.vy = 0;
  g.ball.omega = 0;
  g.ball.super = false;
  clearTrail(g);
}

/** Restart the match from the pause menu: fresh scores and a fresh serve,
 * every effect cleared. Court geometry survives; the mode is the caller's
 * call (Logo3's Restart drops back to attract). */
export function resetMatch(g: Game): void {
  g.scoreL = 0;
  g.scoreR = 0;
  g.rallyHits = 0;
  g.servingTo = -1;
  g.serveTimer = C.SERVE_DELAY;
  g.freezeTimer = 0;
  g.announceTimer = 0;
  g.superGlow = 0;
  g.cracks.length = 0;
  clearTrail(g);
  const b = g.ball;
  b.x = g.w / 2;
  b.y = (g.y0 + g.y1) / 2;
  b.vx = 0;
  b.vy = 0;
  b.omega = 0;
  b.super = false;
  g.left.y = g.left.targetY = (g.y0 + g.y1) / 2;
  g.right.y = g.right.targetY = (g.y0 + g.y1) / 2;
  g.left.vy = 0;
  g.right.vy = 0;
  g.left.flash = 0;
  g.right.flash = 0;
}

/** Capped follow toward targetY + EMA velocity estimate. Controllers (the
 * pointer and both AIs) only ever write targetY; ALL velocity math happens
 * here at the fixed substep, so pointer-event burstiness and dt spikes can
 * never inject a phantom super-hit velocity. */
function movePaddle(p: Paddle, dt: number, y0: number, y1: number): void {
  const yStart = p.y;
  const maxStep = p.maxSpeed * dt;
  const want = clamp(p.targetY, y0 + p.h / 2, y1 - p.h / 2);
  p.y = yStart + clamp(want - yStart, -maxStep, maxStep);
  const raw = (p.y - yStart) / dt;
  p.vy += (raw - p.vy) * (1 - Math.exp(-dt / C.VEL_EMA_TAU));
  p.flash *= Math.exp(-C.FLASH_DECAY * dt);
}

/** One fixed substep of the whole game. Call only with dt = C.PHYS_DT (the
 * accumulator lives in Logo3's tick; the reduced-motion pre-roll calls this
 * directly). */
export function stepGame(g: Game, dt: number): void {
  // Effect clocks always run, even through the freeze (the speedlines,
  // cracks, and announcement are what the freeze exists to show).
  g.time += dt;
  if (g.announceTimer > 0) g.announceTimer = Math.max(g.announceTimer - dt, 0);
  // Speedlines run at full strength for the WHOLE super flight (paired with
  // the rainbow trail), then fade out over GLOW_FADE once it ends.
  g.superGlow =
    g.ball.super && g.serveTimer <= 0
      ? 1
      : Math.max(g.superGlow - dt / C.GLOW_FADE, 0);
  for (let i = g.cracks.length - 1; i >= 0; i--) {
    g.cracks[i].ttl -= dt;
    if (g.cracks[i].ttl <= 0) g.cracks.splice(i, 1);
  }

  // Hitstop: everything — ball, paddles, even the player — holds for the
  // announcement. Controller updates are skipped by Logo3's tick too, so
  // the AI gains no reaction time from the pause.
  if (g.freezeTimer > 0) {
    g.freezeTimer -= dt;
    return;
  }

  movePaddle(g.left, dt, g.y0, g.y1);
  movePaddle(g.right, dt, g.y0, g.y1);

  if (g.serveTimer > 0) {
    g.serveTimer -= dt;
    if (g.serveTimer <= 0) {
      g.serveTimer = 0;
      launchServe(g);
    }
    return;
  }

  const b = g.ball;
  const prevX = b.x;
  const wall = stepBallFree(b, g, dt);
  if (wall !== 0 && b.super) spawnCrack(g, b.x, wall);
  if (!collidePaddle(g, g.left, -1, prevX)) collidePaddle(g, g.right, 1, prevX);
  pushTrail(g);

  // A point only counts once the ball is fully past the edge.
  if (b.x < -2 * C.BALL_R) score(g, -1);
  else if (b.x > g.w + 2 * C.BALL_R) score(g, 1);
}
