/**
 * Slyce live-match client — transport, snapshot codec, and the remote view.
 *
 * Authority model: one machine — the SIM — runs the whole simulation,
 * including the AI opponent (which must always run on a player's machine),
 * and streams ~60 Hz snapshots through the backend's WebSocket relay
 * (apps/backend/src/slyce.ts). Everyone else runs ZERO physics: the second
 * player and the spectators interpolate snapshots, trace the trail locally
 * along the interpolated path, and rebuild wall cracks from the relayed
 * deterministic seeds. Attract mode is never synced — an idle room means
 * every visitor watches their own local attract rally.
 *
 * The sim starts as player 1 (left). If they leave mid-match, the server
 * PROMOTES the second player: their machine takes over the physics on
 * their own paddle side, the AI covers the vacated side, and that side
 * opens up for any spectator to claim.
 *
 * The sim's viewport is the canonical court: its (w, h) rides in every
 * snapshot, remote clients adopt that exact geometry and letterbox it into
 * their own viewport with a canvas transform — nobody ever sees the ball
 * leave their screen because their aspect differs. Positions on the wire
 * are court-normalized (x/w and (y−y0)/span).
 *
 * Liveness: any message refreshes the sender's lastSeen on the server; the
 * sim's snapshots and the peer's inputs double as heartbeats, and the
 * server drops a player silent for ~8 s (see PLAYER_TIMEOUT_MS server-side),
 * promoting/ending or reviving the AI as appropriate.
 */

import { C, Crack, Game } from './physics';

/** Wire snapshot — kept terse; ~60 of these per second. */
export interface Snapshot {
  vp: [number, number]; // the SIM machine's viewport (w, h) in its CSS px —
  // the canonical court every other client letterboxes (walls derive from h
  // via the same courtBounds, so [w, h] pins the whole geometry)
  st: 0 | 1 | 2; // 0 = serve pause, 1 = in flight, 2 = super-hit freeze
  pause: 0 | 1; // sim menu-paused / tab-hidden: remote clocks hold too
  b: [number, number, number, number, number]; // nx, ny, theta, spinNorm, super(0|1)
  l: [number, number]; // left paddle: ny, flash
  r: [number, number]; // right paddle: ny, flash
  s: [number, number]; // scoreL, scoreR
  glow: number; // superGlow
  ann: 0 | 1; // "SUPER SPIN" announcement showing
  cr: [number, 1 | -1, number][]; // cracks since last snapshot: nx, wallSign, seed
}

/** 'sim' = this machine runs the physics (and the AI); 'player' = second
 * player streaming inputs from the opposite paddle; 'spectator' = neither.
 * A 'role: sim' arriving while we are 'player' is a PROMOTION — player 1
 * left and our machine takes over the simulation, keeping our paddle side. */
export type NetRole = 'sim' | 'player' | 'spectator';

export type PaddleSide = -1 | 1; // -1 left, +1 right (matches physics `side`)

export interface NetEvents {
  onRoom(live: boolean, guestFree: boolean): void;
  onRole(role: NetRole, side: PaddleSide | null): void;
  onSnapshot(s: Snapshot): void;
  onInput(yNorm: number): void; // sim only: the peer's paddle target
  onPeerJoined(side: PaddleSide): void; // sim only
  onPeerLeft(): void; // sim only
  onPromoteOffer(): void; // player only: the sim left — take over? Consent
  // is explicit: promoteAccept()/promoteDecline() below; silence ends the
  // match server-side after its offer window
  onEnded(): void; // match over: nobody simulating and nobody accepted
}

const span = (g: Game): number => g.y1 - g.y0;

/** Host → wire. `sinceCrackSeq` lets the caller send each crack exactly once. */
export function encodeSnapshot(g: Game, paused: boolean, sinceCrackSeq: number): Snapshot {
  const s = span(g);
  const b = g.ball;
  const sn = Math.min(
    Math.abs(b.omega) / Math.max(Math.hypot(b.vx, b.vy) / (C.MAGNUS_K * s), 1e-6),
    1,
  );
  return {
    vp: [g.w, g.h],
    st: g.freezeTimer > 0 ? 2 : g.serveTimer > 0 ? 0 : 1,
    pause: paused ? 1 : 0,
    b: [b.x / g.w, (b.y - g.y0) / s, b.theta, b.vx || b.vy ? sn : 0, b.super ? 1 : 0],
    l: [(g.left.y - g.y0) / s, g.left.flash],
    r: [(g.right.y - g.y0) / s, g.right.flash],
    s: [g.scoreL, g.scoreR],
    glow: g.superGlow,
    ann: g.announceTimer > 0 ? 1 : 0,
    cr: g.cracks
      .filter((c) => c.seed >= sinceCrackSeq)
      .map((c) => [c.x / g.w, c.wallSign, c.seed]),
  };
}

/** Interpolation delay: render this far behind the newest snapshot so there
 * is (nearly) always a pair to lerp between. At the 60 Hz send cadence
 * (~17 ms apart) this covers several intervals of jitter while keeping the
 * remote view snappy. */
const INTERP_MS = 60;

const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

/**
 * The remote render state: applies interpolated snapshots onto the local
 * Game object that render() already knows how to draw. No physics — but
 * plausible ball velocity/omega are reconstructed so the existing
 * spin-styling code (spinNorm reads |v| and ω) works untouched.
 */
export class RemoteView {
  private prev: { at: number; s: Snapshot } | null = null;
  private next: { at: number; s: Snapshot } | null = null;
  private seenCrackSeq = -1;

  push(s: Snapshot): void {
    this.prev = this.next;
    this.next = { at: performance.now(), s };
  }

  hasState(): boolean {
    return this.next !== null;
  }

  reset(): void {
    this.prev = null;
    this.next = null;
    this.seenCrackSeq = -1;
  }

  /** The sim machine's viewport from the freshest snapshot, or null. */
  court(): [number, number] | null {
    return this.next ? this.next.s.vp : null;
  }

  /** Write the interpolated state into `g` for this frame. `own`: a second
   * player predicts their own paddle locally for zero-lag feel (whichever
   * side is theirs); everything else comes from the snapshots. */
  apply(g: Game, nowMs: number, dt: number, own: { y: number; side: PaddleSide } | null): void {
    if (!this.next) return;
    const cs = span(g);
    const a = this.prev;
    const b = this.next;
    let f = 1;
    let sA = b.s;
    if (a && b.at > a.at) {
      f = Math.min(Math.max((nowMs - INTERP_MS - a.at) / (b.at - a.at), 0), 1);
      sA = a.s;
    }
    const sB = b.s;

    const paused = sB.pause === 1;
    if (!paused) g.time += dt;

    const prevX = g.ball.x;
    const prevY = g.ball.y;
    g.ball.x = lerp(sA.b[0], sB.b[0], f) * g.w;
    g.ball.y = g.y0 + lerp(sA.b[1], sB.b[1], f) * cs;
    g.ball.theta = lerp(sA.b[2], sB.b[2], f);
    g.ball.super = sB.b[4] === 1;
    const sn = lerp(sA.b[3], sB.b[3], f);
    // Reconstruct plausible motion so spinNorm(ball, span) — which the
    // renderer uses for the ball's styling — reproduces the host's value.
    g.ball.vx = dt > 0 ? (g.ball.x - prevX) / dt : 0;
    g.ball.vy = dt > 0 ? (g.ball.y - prevY) / dt : 0;
    const speed = Math.hypot(g.ball.vx, g.ball.vy) || C.SERVE_SPEED;
    g.ball.omega = (sn * speed) / (C.MAGNUS_K * cs);

    if (own === null || own.side !== -1) {
      g.left.y = g.y0 + lerp(sA.l[0], sB.l[0], f) * cs;
      g.left.flash = lerp(sA.l[1], sB.l[1], f);
    } else {
      g.left.y = Math.min(Math.max(own.y, g.y0 + g.left.h / 2), g.y1 - g.left.h / 2);
    }
    if (own === null || own.side !== 1) {
      g.right.y = g.y0 + lerp(sA.r[0], sB.r[0], f) * cs;
      g.right.flash = lerp(sA.r[1], sB.r[1], f);
    } else {
      g.right.y = Math.min(Math.max(own.y, g.y0 + g.right.h / 2), g.y1 - g.right.h / 2);
    }

    g.scoreL = sB.s[0];
    g.scoreR = sB.s[1];
    g.serveTimer = sB.st === 0 ? 1 : 0; // render only checks > 0
    g.superGlow = sB.glow;
    g.announceTimer = sB.ann === 1 ? 1 : 0;

    // Cracks arrive as deterministic seeds — hashing rebuilds the exact
    // same shard pattern the host sees. Tick their ttl here (no stepGame).
    for (const [nx, wallSign, seed] of sB.cr) {
      if (seed <= this.seenCrackSeq) continue;
      this.seenCrackSeq = seed;
      if (g.cracks.length >= C.CRACK_MAX) g.cracks.shift();
      const crack: Crack = {
        x: nx * g.w,
        y: wallSign === 1 ? g.y0 : g.y1,
        wallSign,
        ttl: C.CRACK_TTL,
        seed,
      };
      g.cracks.push(crack);
    }
    if (!paused) {
      for (let i = g.cracks.length - 1; i >= 0; i--) {
        g.cracks[i].ttl -= dt;
        if (g.cracks[i].ttl <= 0) g.cracks.splice(i, 1);
      }
    }
  }

  /** Whether trail should be traced this frame (ball actually in flight). */
  inFlight(): boolean {
    return this.next !== null && this.next.s.st === 1 && this.next.s.pause === 0;
  }

  /** Serve pause (ball parked at center after a score). The sim clears its
   * trail at the score — remote views mirror that here. */
  serving(): boolean {
    return this.next !== null && this.next.s.st === 0;
  }

  paused(): boolean {
    return this.next !== null && this.next.s.pause === 1;
  }
}

interface ServerMsg {
  type?: string;
  role?: NetRole;
  side?: 'L' | 'R';
  live?: boolean;
  guestFree?: boolean;
  y?: number;
  [key: string]: unknown;
}

const sideOf = (s: 'L' | 'R' | undefined): PaddleSide | null =>
  s === 'L' ? -1 : s === 'R' ? 1 : null;

const RETRY_MS = 5000;

/** Thin WebSocket wrapper: connect/retry, typed sends, event fan-out.
 * With no backend reachable every send is a silent no-op — the logo then
 * behaves exactly like the offline, purely local game. */
export class SlyceNet {
  private ws: WebSocket | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(private events: NetEvents) {}

  connect(): void {
    if (this.disposed) return;
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';
    let ws: WebSocket;
    try {
      ws = new WebSocket(base.replace(/^http/, 'ws') + '/slyce');
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onmessage = (e) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      switch (msg.type) {
        case 'welcome':
        case 'room':
          this.events.onRoom(msg.live === true, msg.guestFree === true);
          if (msg.type === 'welcome' && msg.role) this.events.onRole(msg.role, sideOf(msg.side));
          break;
        case 'role':
          if (msg.role) this.events.onRole(msg.role, sideOf(msg.side));
          break;
        case 'snapshot':
          this.events.onSnapshot(msg as unknown as Snapshot);
          break;
        case 'input':
          if (typeof msg.y === 'number') this.events.onInput(msg.y);
          break;
        case 'peer-joined':
          this.events.onPeerJoined(sideOf(msg.side) ?? 1);
          break;
        case 'peer-left':
          this.events.onPeerLeft();
          break;
        case 'promote-offer':
          this.events.onPromoteOffer();
          break;
        case 'ended':
          this.events.onEnded();
          break;
      }
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      // A dropped connection ends any live involvement — the server has
      // already released our slot on its side.
      this.events.onEnded();
      this.events.onRoom(false, false);
      this.scheduleRetry();
    };
    ws.onerror = () => ws.close();
  }

  private scheduleRetry(): void {
    if (this.disposed || this.retry) return;
    this.retry = setTimeout(() => {
      this.retry = null;
      this.connect();
    }, RETRY_MS);
  }

  private send(msg: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  claim(): void {
    this.send({ type: 'claim' });
  }
  leave(): void {
    this.send({ type: 'leave' });
  }
  promoteAccept(): void {
    this.send({ type: 'promote-accept' });
  }
  promoteDecline(): void {
    this.send({ type: 'promote-decline' });
  }
  heartbeat(): void {
    this.send({ type: 'hb' });
  }
  sendInput(yNorm: number): void {
    this.send({ type: 'input', y: yNorm });
  }
  sendSnapshot(s: Snapshot): void {
    this.send({ type: 'snapshot', ...s });
  }

  dispose(): void {
    this.disposed = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.ws) {
      this.ws.onclose = null; // no onEnded churn during unmount
      this.ws.close();
      this.ws = null;
    }
  }
}
