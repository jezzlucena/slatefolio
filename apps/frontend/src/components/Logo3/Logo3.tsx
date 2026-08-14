'use client';

/**
 * Logo3 — "Slyce": 8-bit pong as a header artwork, built around the slice.
 *
 * Hit the ball with a MOVING paddle and it spins; spin curves the flight
 * (Magnus) and grips the walls (speed up / slow down by spin direction) —
 * but never enough to curve back to its hitter (the geometric cap in
 * physics.ts). The right-side AI predicts straight lines only, so curve
 * balls beat it. A really fast paddle at contact is a SUPER HIT: extra
 * speed, extra spin, rainbow trail — announced with a hitstop freeze,
 * "SUPER SPIN" in bitmap letters, and speedlines that run for the whole
 * super flight; when a super ball slams a wall it shatters a glass-web
 * crack across the court. The court is inset from the viewport (walls at
 * y0/y1) so the ball never hides behind the TopBar or leaves the header.
 *
 * On load two AIs rally (the left "showman" slices on purpose so the artwork
 * demos itself) under a translated "Click to Start…" CTA; a click/tap hands
 * the visitor the left paddle, a click while playing PAUSES — the whole sim
 * clock stops, so trail fade, speedlines, and the announcement hold exactly
 * as they are — and a translated 8-bit menu offers Resume / Instructions
 * (a dismissable modal) / Restart. 15 s of idle hands the paddle back.
 *
 * Everything on the canvas snaps to a PIX-sized art-pixel grid — square
 * ball and paddles, a pixel-block trail, and a 3×5 bitmap font for the
 * score and the SUPER SPIN callout. The menu/CTA/modal are DOM overlays
 * instead: they carry next-intl translations (accents and all), which the
 * bitmap font can't.
 *
 * Architecture: physics.ts is the pure fixed-substep sim, ai.ts the two
 * controllers; this file owns the Logo2-pattern lifecycle (imperative canvas,
 * rAF loop with start/stop/sync, paired listeners, total teardown — the
 * Header live-swaps logos with a 350 ms fade) and all Canvas-2D rendering.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { createOpponent, createShowman } from './ai';
import { encodeSnapshot, NetRole, PaddleSide, RemoteView, SlyceNet } from './net';
import { C, clearTrail, Crack, createGame, maxOmega, rand01, resetMatch, resizeGame, spinNorm, stepGame, traceTrail } from './physics';
import styles from './Logo3.module.scss';

/** Backing-store resolution cap — same rationale as Logo2's MAX_DPR. */
const MAX_DPR = 2;

/** Art-pixel size in CSS px. Every drawn element is built from and snapped
 * to this grid — PADDLE_W and BALL_R in physics.ts are multiples of it. */
const PIX = 4;

const snap = (v: number): number => Math.round(v / PIX) * PIX;

/** A click that traveled further than this since pointerdown is a paddle
 * drag, not a pause request (Logo5's wasDrag idea). */
const DRAG_PX = 8;

/** 3×5 bitmap glyphs (rows top→bottom, 3 bits per row, MSB = left column).
 * Digits for the score plus just the letters "SUPER SPIN" needs — all
 * translated text lives in the DOM overlays instead. */
const GLYPHS: Record<string, number[]> = {
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b001, 0b010, 0b010],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
  E: [0b111, 0b100, 0b111, 0b100, 0b111],
  I: [0b111, 0b010, 0b010, 0b010, 0b111],
  N: [0b101, 0b111, 0b111, 0b101, 0b101],
  P: [0b111, 0b101, 0b111, 0b100, 0b100],
  R: [0b111, 0b101, 0b111, 0b110, 0b101],
  S: [0b111, 0b100, 0b111, 0b001, 0b111],
  U: [0b101, 0b101, 0b101, 0b101, 0b111],
  ' ': [0, 0, 0, 0, 0],
};

/** Glyphs are 3 cells wide + 1 cell gap. */
const textCells = (text: string): number => text.length * 4 - 1;

const drawPixelText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, // left edge
  y: number, // top edge
  cell: number,
): void => {
  let cx = x;
  for (const ch of text) {
    const rows = GLYPHS[ch];
    if (rows) {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          if (rows[r] & (1 << (2 - c))) {
            ctx.fillRect(cx + c * cell, y + r * cell, cell, cell);
          }
        }
      }
    }
    cx += 4 * cell;
  }
};

/** Aurora gradient stops as [hue, saturation, lightness] — teal, violet,
 * magenta, gold. The family palette (same values as Logo/Logo7); here it
 * maps spin: flat balls stay white, heavy curve walks the ramp to gold. */
const AURORA_STOPS: [number, number, number][] = [
  [172, 78, 55],
  [258, 84, 66],
  [318, 80, 62],
  [402, 92, 60],
];

const auroraAt = (t: number): string => {
  const pos = Math.min(Math.max(t, 0), 1) * (AURORA_STOPS.length - 1);
  const i = Math.min(Math.floor(pos), AURORA_STOPS.length - 2);
  const frac = pos - i;
  const [h1, s1, l1] = AURORA_STOPS[i];
  const [h2, s2, l2] = AURORA_STOPS[i + 1];
  const h = Math.round((h1 + (h2 - h1) * frac) % 360);
  const s = Math.round(s1 + (s2 - s1) * frac);
  const l = Math.round(l1 + (l2 - l1) * frac);
  return `hsl(${h}, ${s}%, ${l}%)`;
};

/** What the DOM layer shows on top of the canvas. 'attract' = the local
 * CTA; 'join' = spectating a live match with the guest slot free ("Click to
 * Join…"); 'watch' = spectating with both slots taken; 'promote' = player 1
 * left and we (player 2) are being ASKED whether to take over the sim —
 * promotion never happens without consent; 'paused' = the sim's menu;
 * 'instructions' = the modal (sim stays paused). */
type Ui = 'attract' | 'join' | 'watch' | 'promote' | 'none' | 'paused' | 'instructions';

interface Controls {
  resume(): void;
  restart(): void;
  openInstructions(): void;
  closeInstructions(): void;
  acceptPromotion(): void;
  declinePromotion(): void;
}

export default function Logo3() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [overlay, setOverlay] = useState<Ui>('attract');
  // Transient multiplayer toast (a translation key), auto-cleared by the effect.
  const [notice, setNotice] = useState<string | null>(null);
  // The mount effect owns the game and fills this in; the overlay buttons
  // call through it.
  const controls = useRef<Controls | null>(null);
  const t = useTranslations('slyce');

  /* One mount effect owns the whole game lifecycle (Logo2 discipline). All
   * sim state lives in this closure — nothing module-level or ref-cached
   * survives into a StrictMode re-run or the next logo. */
  useEffect(() => {
    const host = wrapper.current;
    if (!host) return;

    // The canvas is created here, not in JSX: cleanup removes it, so a dev
    // StrictMode re-run (and every Header logo swap) starts from a fresh
    // element with a fresh 2D context and transform — a JSX-owned canvas
    // would accumulate a duplicate or inherit a stale DPR transform.
    const cv = document.createElement('canvas');
    cv.className = styles.canvas;
    host.prepend(cv);

    // alpha:false — the header behind us is opaque black, and an opaque
    // canvas composites cheaper.
    const ctx = cv.getContext('2d', { alpha: false });
    if (!ctx) {
      cv.remove();
      host.dataset.ready = '';
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let rafId: number | null = null;
    let lastNow: number | null = null;
    let acc = 0; // fixed-substep accumulator (see physics.ts header)
    let hidden = document.visibilityState === 'hidden';
    let scrolledPast = window.scrollY >= window.innerHeight;
    let viewW = 1;
    let viewH = 1;
    let hostTop = 0; // host is position:fixed, so these only move on resize
    let hostLeft = 0;
    let lastPointerTs = 0;
    let lastRenderNow = 0; // s — paused/resized frames re-render with this,
    //                        so speedlines etc. hold their exact phase
    let downAt: [number, number] | null = null;
    let tookOverTs = -Infinity; // the takeover click must not instantly pause

    // Closure mirror of the React overlay state — everything inside the
    // loop reads this; setUi keeps both in sync.
    let ui: Ui = 'attract';
    const setUi = (v: Ui) => {
      ui = v;
      setOverlay(v);
    };

    const game = createGame(host.clientWidth || 1, host.clientHeight || 1);
    const showman = createShowman(); // left paddle while mode === 'attract'
    let opponent = createOpponent(1); // the AI — recreated per side whenever
    //                                   a remote player takes/returns a paddle

    /* ── live-match networking (see net.ts / backend slyce.ts) ─────────
     * Roles: 'sim' = we run the physics (and the AI — it always runs on a
     * player's machine) and broadcast snapshots; 'player' = we hold one
     * paddle by streaming inputs and render the sim's snapshots;
     * 'spectator' = render snapshots when a match is live, otherwise plain
     * local attract (attract is never synced). Authority and paddle side
     * are separate: the sim starts as player 1 (left), but a promotion can
     * hand the physics to the right-side player. */
    let netRole: NetRole = 'spectator';
    let playerSide: PaddleSide = -1; // OUR paddle (sim or remote player)
    let roomLive = false;
    let guestFree = false;
    let peerConnected = false; // sim: a remote player holds the other paddle
    let peerTargetN: number | null = null; // sim: peer's paddle target, 0..1
    let myRemoteY = 0; // player role: own pointer in SIM-court px (predicted)
    let wasRemote = false; // tracks entering/leaving the remote-render branch
    let textFaded = false; // mirrors the body attribute Header's SCSS fades on
    let traceX = 0; // remote view: where the trail tracer last saw the ball…
    let traceY = 0;
    let traced = false; // …so teleports (score respawns, catch-up jumps) can
    //                     be told apart from genuine flight
    let lastSentCrackSeq = 0;
    let hbCounter = 0;
    const remote = new RemoteView();
    let noticeTimer: ReturnType<typeof setTimeout> | null = null;
    const toast = (key: string) => {
      setNotice(key);
      if (noticeTimer) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => setNotice(null), 3000);
    };

    const paddleOf = (side: PaddleSide) => (side === -1 ? game.left : game.right);

    /** Hand the court back to the classic attract setup: showman left, AI
     * right, our (future) side back to player 1. */
    const backToAttract = () => {
      game.mode = 'attract';
      playerSide = -1;
      opponent = createOpponent(1);
    };

    /** Remote rendering applies when someone ELSE simulates a live match
     * and we have state for it. Until the first snapshot lands we keep
     * showing our own local attract. */
    const isRemoteView = () =>
      netRole === 'player' || (netRole === 'spectator' && roomLive && remote.hasState());

    let promoteOffered = false; // a promotion consent prompt is on screen

    const syncUi = () => {
      if (ui === 'paused' || ui === 'instructions') return; // sim menu wins
      if (promoteOffered && netRole === 'player') {
        setUi('promote');
        return;
      }
      if (netRole === 'player') setUi('none');
      else if (netRole !== 'sim' && roomLive) setUi(guestFree ? 'join' : 'watch');
      else if (game.mode === 'attract') setUi('attract');
      else setUi('none');
    };

    /** Promotion: we were the second player and player 1 left — OUR machine
     * takes over the physics, keeping our paddle side; the AI covers the
     * vacated side until a spectator claims it. Our viewport becomes the
     * canonical court now, scores survive, and the rally re-serves. */
    const promoteToSim = (side: PaddleSide) => {
      playerSide = side;
      // Carry our predicted paddle across the court switch (sim-court px →
      // normalized → our local court px), so the takeover doesn't jump.
      const n = Math.min(
        Math.max((myRemoteY - game.y0) / (game.y1 - game.y0), 0),
        1,
      );
      wasRemote = false; // we own the sim — suppress the attract-restore path
      remote.reset();
      resizeGame(game, viewW, viewH);
      const mine = paddleOf(playerSide);
      mine.y = mine.targetY = game.y0 + n * (game.y1 - game.y0);
      mine.maxSpeed = C.PLAYER_MAX_SPEED;
      mine.vy = 0;
      const aiSide: PaddleSide = playerSide === -1 ? 1 : -1;
      const ai = paddleOf(aiSide);
      ai.y = ai.targetY = (game.y0 + game.y1) / 2;
      opponent = createOpponent(aiSide);
      peerConnected = false;
      peerTargetN = null;
      // Scores survive (they arrived via snapshots); everything transient
      // resets and the match continues with a fresh serve toward us.
      game.mode = 'player';
      game.rallyHits = 0;
      game.freezeTimer = 0;
      game.announceTimer = 0;
      game.superGlow = 0;
      game.cracks.length = 0;
      clearTrail(game);
      game.ball.x = game.w / 2;
      game.ball.y = (game.y0 + game.y1) / 2;
      game.ball.vx = 0;
      game.ball.vy = 0;
      game.ball.omega = 0;
      game.ball.super = false;
      game.serveTimer = C.SERVE_DELAY;
      game.servingTo = playerSide;
      lastPointerTs = performance.now();
      lastSentCrackSeq = game.crackSeq;
      toast('promoted');
      setUi('none');
    };

    const net = new SlyceNet({
      onRoom(live, free) {
        roomLive = live;
        guestFree = free;
        // Reconnected mid-game (backend restart, dropped socket): if we're
        // still playing locally, quietly re-claim the sim slot.
        if (!live && netRole === 'spectator' && game.mode === 'player') net.claim();
        syncUi();
      },
      onRole(r, side) {
        const prev = netRole;
        netRole = r;
        if (r !== 'player') promoteOffered = false;
        if (r === 'player') {
          // We're the second player now — any local rally yields.
          playerSide = side ?? 1;
          game.mode = 'attract';
          myRemoteY = (game.y0 + game.y1) / 2;
        } else if (r === 'sim') {
          if (prev === 'player') {
            promoteToSim(side ?? playerSide);
          } else {
            playerSide = -1; // fresh match: the sim starts as player 1 (left)
            peerConnected = false;
          }
        }
        syncUi();
      },
      onSnapshot(s) {
        remote.push(s);
        // Lost a start race: someone else simulates — become a watcher.
        if (netRole === 'spectator' && game.mode === 'player') {
          backToAttract();
          syncUi();
        }
      },
      onInput(yNorm) {
        peerTargetN = Math.min(Math.max(yNorm, 0), 1);
      },
      onPeerJoined() {
        peerConnected = true;
        peerTargetN = null;
        toast('playerJoined');
      },
      onPeerLeft() {
        peerConnected = false;
        peerTargetN = null;
        // The local AI takes the vacated paddle back (opposite of ours).
        opponent = createOpponent(playerSide === -1 ? 1 : -1);
        toast('playerLeft');
      },
      onPromoteOffer() {
        // Player 1 left. Taking over the simulation is OUR choice — the
        // match holds (frozen view) until we answer or the offer expires.
        promoteOffered = true;
        syncUi();
      },
      onEnded() {
        // Nobody simulating and nobody accepted (or our socket dropped). As
        // sim we just keep playing offline; as player/spectator the tick's
        // wasRemote guard restores local attract on the next frame.
        if (netRole === 'player') toast('matchEnded');
        promoteOffered = false;
        netRole = 'spectator';
        roomLive = false;
        peerConnected = false;
        remote.reset();
        syncUi();
      },
    });

    /* ── rendering ─────────────────────────────────────────────────────── */

    const drawPaddle = (p: typeof game.left, fill: string) => {
      const x = snap(p.x - C.PADDLE_W / 2);
      const y = snap(p.y - p.h / 2);
      const h = snap(p.h);
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, C.PADDLE_W, h);
      if (p.flash > 0.02) {
        // Hit glow, 8-bit style: gold overlay plus a one-art-pixel halo
        // frame instead of a blur; supers start at flash = 2 so the halo
        // lingers twice as long.
        const a = Math.min(p.flash, 1);
        ctx.fillStyle = auroraAt(0.9);
        ctx.globalAlpha = 0.8 * a;
        ctx.fillRect(x, y, C.PADDLE_W, h);
        ctx.globalAlpha = 0.5 * a;
        ctx.fillRect(x - PIX, y - PIX, C.PADDLE_W + 2 * PIX, h + 2 * PIX);
        ctx.globalAlpha = 1;
      }
    };

    /** A super-hit wall crack, drawn like shattered glass: straight radial
     * shards that kink at discrete fracture points (never smooth curves),
     * tied together by concentric chord-rings — a spiderweb reaching most
     * of the court. Shape is hashed from the crack's seed so it's stable
     * frame to frame while its alpha fades out. */
    const drawCrack = (cr: Crack) => {
      const alpha = Math.min(cr.ttl / C.CRACK_TTL, 1);
      const span = game.y1 - game.y0;
      const stepLen = 2 * PIX;
      const reach = (0.6 + 0.35 * rand01(`crack:${cr.seed}:r`)) * span;
      const rays = 7 + Math.floor(rand01(`crack:${cr.seed}`) * 3); // 7–9 shards
      const fan = Math.PI * 0.92; // nearly the whole half-plane into the court
      const base = cr.wallSign * (Math.PI / 2);
      const inBounds = (x: number, y: number) =>
        x >= 0 && x <= game.w && y >= game.y0 - PIX && y <= game.y1 + PIX;
      ctx.fillStyle = '#fff';

      // Radial shards. Glass, not tentacles: the heading is CONSTANT along
      // a run and only snaps at sparse fracture points.
      for (let ri = 0; ri < rays; ri++) {
        let ang =
          base +
          ((ri + 0.5) / rays - 0.5) * fan +
          (rand01(`crack:${cr.seed}:${ri}`) - 0.5) * 0.12;
        let x = cr.x;
        let y = cr.y;
        const rayReach = reach * (0.55 + 0.45 * rand01(`crack:${cr.seed}:${ri}:r`));
        const steps = Math.max(8, Math.round(rayReach / stepLen));
        for (let s = 0; s < steps; s++) {
          const frac = s / steps;
          const size = frac < 0.12 ? 3 * PIX : frac < 0.45 ? 2 * PIX : PIX;
          ctx.globalAlpha = alpha * (0.75 - 0.55 * frac);
          ctx.fillRect(snap(x) - size / 2, snap(y) - size / 2, size, size);
          if (rand01(`crack:${cr.seed}:${ri}:${s}`) < 0.18) {
            ang += (rand01(`crack:${cr.seed}:${ri}:${s}:k`) - 0.5) * 0.7; // sharp kink
          }
          x += Math.cos(ang) * stepLen;
          y += Math.sin(ang) * stepLen;
          if (!inBounds(x, y)) break;
        }
      }

      // Concentric fracture rings. The radius is constant per inter-shard
      // segment (keyed to the nearest ray), so each ring reads as straight
      // chords strung between shards — a web, not circles.
      for (let j = 1; j <= 3; j++) {
        const rr = reach * (0.22 * j + 0.1) * (0.9 + 0.2 * rand01(`crack:${cr.seed}:ring:${j}`));
        const dTheta = Math.max((2.5 * PIX) / rr, 0.02);
        ctx.globalAlpha = alpha * 0.3;
        for (let th = base - fan / 2; th <= base + fan / 2; th += dTheta) {
          const seg = Math.floor(((th - (base - fan / 2)) / fan) * rays);
          const r = rr * (1 + (rand01(`crack:${cr.seed}:ring:${j}:${seg}`) - 0.5) * 0.22);
          const x = cr.x + Math.cos(th) * r;
          const y = cr.y + Math.sin(th) * r;
          if (!inBounds(x, y)) continue;
          ctx.fillRect(snap(x) - PIX / 2, snap(y) - PIX / 2, PIX, PIX);
        }
      }
      ctx.globalAlpha = 1;
    };

    /** now is seconds (performance.now()/1000) — drives pulses and the
     * super-trail rainbow drift. Paused frames re-render with the frozen
     * lastRenderNow so nothing advances visually.
     *
     * The drawn frame is game.w × game.h — locally that IS the viewport,
     * but in a remote view it's the SIM machine's viewport (the canonical
     * court), letterboxed into ours with a uniform transform so the whole
     * match is always on-screen regardless of aspect. */
    const render = (now: number) => {
      lastRenderNow = now;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, viewW, viewH);

      const fw = game.w;
      const fh = game.h;
      const fitted = fw !== viewW || fh !== viewH;
      if (fitted) {
        const s = Math.min(viewW / fw, viewH / fh);
        ctx.save();
        ctx.translate((viewW - fw * s) / 2, (viewH - fh * s) / 2);
        ctx.scale(s, s);
        // Outline the borrowed court so the letterbox reads as intentional.
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, fw - 2, fh - 2);
      }

      const y0 = game.y0;
      const y1 = game.y1;

      // Court: one-art-pixel wall bars sitting just OUTSIDE the physics
      // walls (the ball bounces at y0/y1, the bars never overlap it) and a
      // pixel-dot center line — a whisper of structure, the black field is
      // the artwork.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(0, snap(y0) - PIX, fw, PIX);
      ctx.fillRect(0, snap(y1), fw, PIX);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      const midX = snap(fw / 2) - PIX;
      for (let y = snap(y0); y < y1; y += 6 * PIX) {
        ctx.fillRect(midX, y, 2 * PIX, 2 * PIX);
      }

      // Super speedlines: horizontal pixel streaks sweeping OPPOSITE to the
      // ball's travel — at full strength for the whole super flight (paired
      // with the rainbow trail), fading over GLOW_FADE once it ends. Rows,
      // lengths, and phases are hashed per line index so the pattern is
      // stable while it animates.
      if (game.superGlow > 0) {
        const fx = game.superGlow;
        const dir = game.ball.vx >= 0 ? 1 : -1;
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 12; i++) {
          const ry = y0 + rand01(`sl:${i}`) * (y1 - y0 - PIX);
          const len = snap(60 + rand01(`sl:${i}:l`) * 160);
          const speed = 900 + rand01(`sl:${i}:v`) * 900;
          const phase = rand01(`sl:${i}:x`) * fw;
          const x = (((phase - dir * now * speed) % fw) + fw) % fw;
          ctx.globalAlpha = fx * (0.1 + 0.15 * rand01(`sl:${i}:a`));
          ctx.fillRect(snap(x), snap(ry), len, PIX);
        }
        ctx.globalAlpha = 1;
      }

      // Score: ghost bitmap numerals, watermark not HUD. Fixed inner edges
      // either side of the center line so growing digits never jitter.
      const cell = 3 * PIX; // 36×60 px digits
      const sL = String(game.scoreL);
      const sR = String(game.scoreR);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      drawPixelText(ctx, sL, snap(fw / 2) - 36 - textCells(sL) * cell, snap(y0) + 20, cell);
      drawPixelText(ctx, sR, snap(fw / 2) + 36, snap(y0) + 20, cell);

      // Wall cracks from super-hit bounces, under the trail and ball.
      for (const cr of game.cracks) drawCrack(cr);

      // Trail, oldest → newest: pixel blocks laid on an exact TRAIL_SPACING
      // lattice along the path (physics.ts pushTrail) and drawn at exactly
      // that size, so they tile edge to edge with ZERO overlap — overlapping
      // translucent blocks double-brighten, and any size change re-shapes
      // the overlap, which is what used to read as flicker. Here the only
      // thing that ever changes about a block is its alpha, monotonically,
      // from its own birth time. Straight flight is nearly invisible; curve
      // walks the aurora ramp and brightens; a super flight wears a rainbow
      // spread along the path, drifting with time.
      const tSize = C.TRAIL_SPACING; // block size === lattice spacing
      for (let k = 0; k < game.trailLen; k++) {
        const i = (game.trailHead - game.trailLen + k + 2 * C.TRAIL_N) % C.TRAIL_N;
        const tp = game.trail[i];
        const age = 1 - (game.time - tp.t) / C.TRAIL_LIFE; // 1 fresh → 0 gone
        if (age <= 0) continue;
        if (tp.super) {
          ctx.fillStyle = auroraAt((tp.t * 1.5 + now * 0.25) % 1);
          ctx.globalAlpha = age * 0.7;
        } else if (tp.spinNorm < 0.08) {
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = 0.1 * age;
        } else {
          ctx.fillStyle = auroraAt(tp.spinNorm);
          ctx.globalAlpha = age * (0.12 + 0.5 * tp.spinNorm);
        }
        ctx.fillRect(snap(tp.x) - tSize / 2, snap(tp.y) - tSize / 2, tSize, tSize);
      }
      ctx.globalAlpha = 1;

      // Ball: a square. During the serve pause it pulses at center; in
      // flight it rotates by ball.theta quantized to 16 frames — the spin
      // animation IS the physics, chunked like a sprite sheet. A colored
      // notch pixel breaks the square's 4-fold symmetry so the spin
      // direction reads, and a halo frame marks heavy curve.
      const ball = game.ball;
      const sn = spinNorm(ball, y1 - y0);
      const bx = snap(ball.x);
      const by = snap(ball.y);
      if (game.serveTimer > 0) {
        const half = Math.max(snap(C.BALL_R * (1 + 0.25 * Math.sin(now * 12))), PIX);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(bx - half, by - half, 2 * half, 2 * half);
      } else {
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(Math.round(ball.theta / (Math.PI / 8)) * (Math.PI / 8));
        if (sn > 0.3) {
          ctx.fillStyle = auroraAt(sn);
          ctx.globalAlpha = 0.25 + 0.35 * sn;
          ctx.fillRect(-C.BALL_R - PIX, -C.BALL_R - PIX, 2 * (C.BALL_R + PIX), 2 * (C.BALL_R + PIX));
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = '#fff';
        ctx.fillRect(-C.BALL_R, -C.BALL_R, 2 * C.BALL_R, 2 * C.BALL_R);
        ctx.fillStyle = auroraAt(sn);
        ctx.globalAlpha = 0.35 + 0.65 * sn;
        ctx.fillRect(-PIX / 2, -C.BALL_R + PIX / 2, PIX, PIX);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      drawPaddle(game.left, 'rgba(255, 255, 255, 0.92)');
      drawPaddle(game.right, 'rgba(255, 255, 255, 0.6)');

      // "SUPER SPIN" — announced over the frozen ball for SUPER_TEXT
      // seconds from the hit, cycling the aurora ramp.
      if (game.announceTimer > 0) {
        const msg = 'SUPER SPIN';
        const cell2 = 2 * PIX; // 24×40 px letters
        ctx.fillStyle = auroraAt((now * 0.8) % 1);
        ctx.globalAlpha = 0.9;
        drawPixelText(
          ctx,
          msg,
          snap(fw / 2) - snap((textCells(msg) * cell2) / 2),
          snap(y0 + (y1 - y0) * 0.3),
          cell2,
        );
        ctx.globalAlpha = 1;
      }

      if (fitted) ctx.restore();
    };

    /* ── simulation loop ───────────────────────────────────────────────── */

    /** The authoritative local simulation — runs when we're offline, in
     * attract, playing vs the AI, or the SIM of a live match (2P: the
     * peer's paddle is driven by their relayed input through the same
     * movePaddle physics, so remote slices work exactly like local ones). */
    const localFrame = (nowMs: number, dt: number) => {
      acc += dt;
      const peerTarget = netRole === 'sim' && peerConnected ? peerTargetN : null;
      const peerPaddle = paddleOf(playerSide === -1 ? 1 : -1); // opposite ours
      while (acc >= C.PHYS_DT) {
        // Controllers idle through the super-hit freeze — the AI must not
        // spend the announcement gathering reaction time.
        if (game.freezeTimer <= 0) {
          if (game.mode === 'attract') showman.update(game, C.PHYS_DT);
          if (peerTarget !== null) {
            peerPaddle.maxSpeed = C.PLAYER_MAX_SPEED;
            peerPaddle.targetY = game.y0 + peerTarget * (game.y1 - game.y0);
          } else {
            opponent.update(game, C.PHYS_DT); // the AI, always local
          }
        }
        stepGame(game, C.PHYS_DT);
        acc -= C.PHYS_DT;
      }
      if (game.mode === 'player' && nowMs - lastPointerTs > C.IDLE_TO_ATTRACT_MS) {
        // The showman reclaims the paddle from wherever it sits — no reset.
        // Getting it back takes another click (attract is click-gated).
        // A live match we simulate is over for everyone (the server
        // propagates it — or promotes our peer if we had one).
        backToAttract();
        net.leave();
        setUi('attract');
      }
      render(nowMs / 1000);
    };

    /** The remote view — a live match simulated elsewhere. Zero physics:
     * adopt the sim's court, lerp the snapshots, trace the trail along the
     * interpolated path. A second player's own paddle is predicted locally. */
    const remoteFrame = (nowMs: number, dt: number) => {
      const vp = remote.court();
      if (vp && (game.w !== vp[0] || game.h !== vp[1])) {
        // The SIM machine's viewport is the canonical court — adopt its
        // exact geometry; render() letterboxes it into ours.
        resizeGame(game, vp[0], vp[1]);
      }
      remote.apply(
        game,
        nowMs,
        dt,
        netRole === 'player' ? { y: myRemoteY, side: playerSide } : null,
      );
      if (remote.inFlight()) {
        const b = game.ball;
        // Teleport guard: a genuine flight moves at most MAX_SPEED_SUPER
        // px/s. Anything faster between two traced frames (a score respawn
        // the serve state didn't bracket, a stale-buffer catch-up jump) is
        // a teleport — restart the ribbon there instead of painting a
        // streak across the court.
        if (traced) {
          const jump = Math.hypot(b.x - traceX, b.y - traceY);
          const genuine =
            C.MAX_SPEED_SUPER * Math.max(dt, 1 / 30) * 1.5 + C.TRAIL_SPACING;
          if (jump > genuine) clearTrail(game);
        }
        traceTrail(game, b.x, b.y, spinNorm(b, game.y1 - game.y0), b.super);
        traceX = b.x;
        traceY = b.y;
        traced = true;
      } else {
        traced = false; // freeze/pause: the ribbon persists, the anchor resets
        // The serve pause follows a score — the sim cleared its trail then,
        // so the remote ribbon vanishes with it rather than lingering.
        if (remote.serving() && game.trailLen > 0) clearTrail(game);
      }
      render(remote.paused() ? lastRenderNow : nowMs / 1000);
    };

    const tick = (nowMs: number) => {
      const dt = lastNow === null ? 0 : Math.min((nowMs - lastNow) / 1000, C.MAX_FRAME_DT);
      lastNow = nowMs;
      const remoteNow = isRemoteView();
      if (remoteNow !== wasRemote) {
        // Crossing between local sim and remote view: neither state carries
        // over — clean court both ways (promotion bypasses this: it flips
        // wasRemote itself and preserves the scores).
        wasRemote = remoteNow;
        resetMatch(game);
        if (!remoteNow) {
          resizeGame(game, viewW, viewH); // our own court again
          backToAttract();
          remote.reset();
          syncUi();
        }
      }
      if (remoteNow) remoteFrame(nowMs, dt);
      else localFrame(nowMs, dt);
      // While THIS visitor holds a paddle (player 1 locally/as sim, or a
      // joined player 2), the frosted name/role bar fades out of the court —
      // Header.module.scss watches this body attribute.
      const playing = netRole === 'player' || game.mode === 'player';
      if (playing !== textFaded) {
        textFaded = playing;
        document.body.toggleAttribute('data-slyce-playing', playing);
      }
      rafId = requestAnimationFrame(tick);
    };

    // The menu pause works exactly like the tab-hidden pause: the loop just
    // stops, so the sim clock — and with it trail fade, speedlines, and the
    // SUPER SPIN callout — holds perfectly still until resumed.
    const menuPaused = () => ui === 'paused' || ui === 'instructions';
    const shouldRun = () => !hidden && !scrolledPast && !menuPaused() && !reducedMotion.matches;
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
      const rect = host.getBoundingClientRect();
      hostTop = rect.top;
      hostLeft = rect.left;
      viewW = host.clientWidth;
      viewH = host.clientHeight;
      // CSS owns the canvas display size (.canvas stretches to the wrapper);
      // this only sets the DPR-scaled backing store — two halves of one
      // contract with Logo3.module.scss.
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      cv.width = Math.round(viewW * dpr);
      cv.height = Math.round(viewH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // In a remote view the game keeps the SIM machine's court — our
      // resize only changes the letterbox render() computes.
      if (!isRemoteView()) resizeGame(game, viewW, viewH);
      // Keep a paused frame correct — with the frozen clock, not a new one.
      if (rafId === null) render(lastRenderNow);
    };

    /** Viewport → sim-court y for the remote-player role: invert render()'s
     * letterbox transform, then clamp into the court. */
    const toSimY = (clientY: number): number => {
      const s = Math.min(viewW / game.w, viewH / game.h);
      const oy = (viewH - game.h * s) / 2;
      const y = (clientY - hostTop - oy) / s;
      return Math.min(Math.max(y, game.y0), game.y1);
    };

    /* ── overlay controls (called from the React buttons via the ref) ──── */

    controls.current = {
      resume() {
        setUi('none');
        lastPointerTs = performance.now(); // don't idle out right after resuming
        sync();
      },
      restart() {
        // Back to square one: fresh match AND back to the attract rally —
        // the showman retakes the left paddle, the CTA returns, and the
        // next click starts a new game. A match we simulate is over for
        // everyone (or promoted to our peer, if we had one).
        resetMatch(game);
        backToAttract();
        net.leave();
        setUi('attract');
        sync();
      },
      openInstructions() {
        setUi('instructions'); // still menuPaused — the sim stays frozen
      },
      closeInstructions() {
        setUi('paused');
      },
      acceptPromotion() {
        // Explicit consent: only now does our machine take over the sim.
        promoteOffered = false;
        net.promoteAccept(); // server answers with role 'sim' → promoteToSim
      },
      declinePromotion() {
        promoteOffered = false;
        net.promoteDecline(); // server ends the match for everyone
        syncUi(); // watch/attract while the 'ended' round-trips
      },
    };

    /* ── input ─────────────────────────────────────────────────────────── */

    // Attract stays on until a CLICK/TAP on the field — pointer movement
    // alone never takes the paddle (visitors mousing across the header keep
    // watching the rally). A click while spectating a live match with the
    // guest slot free asks the server for that slot instead.
    const onPointerDown = (e: PointerEvent) => {
      if (scrolledPast || reducedMotion.matches) return;
      downAt = [e.clientX, e.clientY];
      if (ui === 'attract') {
        game.mode = 'player';
        playerSide = -1; // starting a match always begins on the left
        game.left.maxSpeed = C.PLAYER_MAX_SPEED;
        game.left.targetY = e.clientY - hostTop;
        lastPointerTs = performance.now();
        tookOverTs = performance.now();
        setUi('none');
        net.claim(); // optimistic: play locally now, own the room if granted
      } else if (ui === 'join') {
        net.claim(); // the server grants the free paddle if it still is
      }
    };

    // A clean click while playing = pause. Runs on the host (native,
    // BEFORE React's delegated handlers), so it checks ui first: menu
    // button clicks bubble through here while ui is 'paused' and fall out.
    const onHostClick = (e: MouseEvent) => {
      if (ui !== 'none' || game.mode !== 'player') return;
      if (scrolledPast || reducedMotion.matches) return;
      if (performance.now() - tookOverTs < 300) return; // the takeover click
      if (downAt) {
        const dx = e.clientX - downAt[0];
        const dy = e.clientY - downAt[1];
        if (dx * dx + dy * dy > DRAG_PX * DRAG_PX) return; // a paddle drag
      }
      setUi('paused');
      sync(); // stops the loop — the canvas keeps the exact current frame
    };

    // Window-level, not wrapper-level: the Header's arrow buttons overlay the
    // field at z-index 2 and would eat moves over their circles.
    const onPointerMove = (e: PointerEvent) => {
      if (netRole === 'player') {
        myRemoteY = toSimY(e.clientY); // predicted locally, streamed to the sim
        return;
      }
      if (ui !== 'none' || game.mode !== 'player') return;
      lastPointerTs = performance.now();
      paddleOf(playerSide).targetY = e.clientY - hostTop;
    };

    // Touch compromise: touch-action: pan-y in the SCSS keeps page scroll
    // alive on a fixed 100vh surface, and we preventDefault only for drags
    // on the player's half of the court while actually playing. Right-half
    // swipes always scroll the page.
    const onTouchMove = (e: TouchEvent) => {
      const t0 = e.touches[0];
      if (!t0) return;
      // Only OUR half of the court captures the drag; the other half keeps
      // scrolling the page. Which half that is follows our paddle side.
      const playing =
        netRole === 'player' || (ui === 'none' && game.mode === 'player');
      const x = t0.clientX - hostLeft;
      const onMySide = playerSide === -1 ? x < viewW * 0.55 : x > viewW * 0.45;
      if (playing && onMySide) e.preventDefault();
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

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('click', onHostClick);
    cv.addEventListener('touchmove', onTouchMove, { passive: false });
    reducedMotion.addEventListener('change', onMotionChange);

    // The 60 Hz network pulse: sim snapshots and player inputs double as
    // heartbeats; idle roles ping every ~2 s. It runs on an interval, NOT
    // the rAF loop, so a menu-paused or hidden-tab sim keeps heartbeating
    // (hidden-tab intervals are throttled to ~1 Hz — well inside the
    // server's 8 s abandonment timeout) with the pause flag set.
    const NET_HZ = 60;
    let netTimer: ReturnType<typeof setInterval> | null = null;
    if (!reducedMotion.matches) {
      net.connect();
      netTimer = setInterval(() => {
        if (netRole === 'sim') {
          if (game.mode === 'player') {
            net.sendSnapshot(encodeSnapshot(game, menuPaused() || hidden, lastSentCrackSeq));
            lastSentCrackSeq = game.crackSeq;
          } else {
            net.heartbeat();
          }
        } else if (netRole === 'player') {
          const n = (myRemoteY - game.y0) / (game.y1 - game.y0);
          net.sendInput(Math.min(Math.max(n, 0), 1));
        } else if (++hbCounter % (2 * NET_HZ) === 0) {
          net.heartbeat(); // spectators: every ~2 s
        }
      }, 1000 / NET_HZ);
    }

    onResize();

    if (reducedMotion.matches) {
      // One deterministic still that shows the whole idea: a mid-rally ball
      // with heavy spin pre-rolled through the real physics, leaving a
      // visibly curved aurora arc between offset paddles, mid-count score.
      // No CTA either — the game never runs under reduced motion.
      setUi('none');
      const span = game.y1 - game.y0;
      game.scoreL = 3;
      game.scoreR = 2;
      game.serveTimer = 0;
      game.ball.x = viewW * 0.3;
      game.ball.y = game.y0 + span * 0.42;
      // Velocity scales with the court so the 0.8 s pre-roll stays a
      // mid-court arc on any screen — it must never reach a paddle plane
      // (0.9·w) or a wall, or the still would show a hit instead of flight.
      game.ball.vx = viewW * 0.3;
      game.ball.vy = span * 0.15;
      game.ball.omega = maxOmega(game.ball, span) * 0.85;
      game.left.y = game.left.targetY = game.y0 + span * 0.4;
      game.right.y = game.right.targetY = game.y0 + span * 0.6;
      const steps = Math.round(0.8 / C.PHYS_DT);
      for (let i = 0; i < steps; i++) stepGame(game, C.PHYS_DT); // lays its own trail
      render(0);
    } else {
      start();
    }
    host.dataset.ready = ''; // drives the CSS fade-in

    return () => {
      stop();
      if (netTimer) clearInterval(netTimer);
      if (noticeTimer) clearTimeout(noticeTimer);
      net.dispose(); // closing the socket releases any slot server-side
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('click', onHostClick);
      cv.removeEventListener('touchmove', onTouchMove);
      reducedMotion.removeEventListener('change', onMotionChange);
      controls.current = null;
      document.body.removeAttribute('data-slyce-playing');
      cv.remove();
      delete host.dataset.ready;
    };
    // setOverlay is a stable setState — safe in a mount-only effect.
  }, []);

  /** Overlay buttons: stop the event before the wrapper/Link handlers see
   * it, then call into the game via the controls ref. */
  const act = (fn: (c: Controls) => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (controls.current) fn(controls.current);
  };

  return (
    <Link href="/">
      {/* The whole surface is the game — clicks start/pause it and must
          never navigate (Logo5 precedent for the suppression). Home stays
          reachable via the TopBar name. */}
      <div
        ref={wrapper}
        className={styles.wrapper}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* the canvas is created by the mount effect and prepended here —
            see the comment in the effect for why it isn't JSX */}
        {overlay === 'attract' && <span className={styles.cta}>{t('clickToStart')}</span>}
        {overlay === 'join' && <span className={styles.cta}>{t('clickToJoin')}</span>}
        {(overlay === 'join' || overlay === 'watch') && (
          <span className={styles.badge}>{t('watchingLive')}</span>
        )}
        {notice && <span className={styles.notice}>{t(notice)}</span>}
        {overlay === 'promote' && (
          <div className={styles.backdrop}>
            {/* Consent prompt: player 1 left — taking over the physics (and
                the match) is the second player's explicit choice. */}
            <div className={styles.panel}>
              <span className={styles.panelTitle}>{t('promoteTitle')}</span>
              <button type="button" onClick={act((c) => c.acceptPromotion())}>
                {t('promoteAccept')}
              </button>
              <button type="button" onClick={act((c) => c.declinePromotion())}>
                {t('promoteDecline')}
              </button>
            </div>
          </div>
        )}
        {(overlay === 'paused' || overlay === 'instructions') && (
          <div
            className={styles.backdrop}
            onClick={
              // The modal is dismissable by clicking outside it too.
              overlay === 'instructions' ? act((c) => c.closeInstructions()) : undefined
            }
          >
            {overlay === 'paused' ? (
              <div className={styles.panel}>
                <span className={styles.panelTitle}>{t('paused')}</span>
                <button type="button" onClick={act((c) => c.resume())}>
                  {t('resume')}
                </button>
                <button type="button" onClick={act((c) => c.openInstructions())}>
                  {t('instructions')}
                </button>
                <button type="button" onClick={act((c) => c.restart())}>
                  {t('restart')}
                </button>
              </div>
            ) : (
              <div className={`${styles.panel} ${styles.instructions}`} onClick={(e) => e.stopPropagation()}>
                <span className={styles.panelTitle}>{t('howToTitle')}</span>
                <ul>
                  <li>{t('howMove')}</li>
                  <li>{t('howSlice')}</li>
                  <li>{t('howWalls')}</li>
                  <li>{t('howSuper')}</li>
                  <li>{t('howAi')}</li>
                  <li>{t('howPause')}</li>
                </ul>
                <button type="button" onClick={act((c) => c.closeInstructions())}>
                  {t('close')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
