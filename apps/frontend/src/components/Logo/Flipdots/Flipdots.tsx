'use client'

import Link from "next/link"
import { useEffect, useRef } from "react";
import styles from "./Flipdots.module.scss"
import { loadOpenCv, type BackgroundSubtractorMOG2, type Mat, type OpenCv } from "./opencv";

/** One flip-dot cell (px). The grid is ceil()ed past the header's edges and
 * centered, so it always covers the header and the excess is cropped evenly */
const CELL = 40;
/** Disc radius inside its cell, and the recessed socket around it */
const DISC_R = 16.5;
const SOCKET_R = 18.5;

/** How often (ms) a new camera frame is sampled and the panel re-targeted.
 * Real flip-dot panels refresh at a mechanical ~15 Hz */
const SAMPLE_MS = 66;
/** MOG2 sees the camera at SUB× the panel's resolution (≈ 190×110 px on a
 * 1080p header): enough detail for clean silhouettes, cheap enough to run
 * every sample in wasm */
const SUB = 4;

/** One half-turn of a disc (ms), and the column sweep: real panels drive
 * their coils column by column, so a full-panel change ripples left→right */
const FLIP_MS = 1000;
const SWEEP_MS_PER_COL = 7;

/** OpenCV's MOG2 background subtractor (a per-pixel Gaussian mixture).
 * HISTORY is in samples: at 15 Hz, 900 ≈ 1 min before something that stops
 * moving — a sitter holding still — is absorbed into the background.
 * VAR_THRESHOLD is the squared Mahalanobis distance that marks a pixel as
 * foreground (OpenCV's default is 16; a touch higher ignores sensor noise) */
const MOG2_HISTORY = 900;
const MOG2_VAR_THRESHOLD = 20;
/** Samples fed to MOG2 before it drives the panel (its first frames are all
 * "foreground" while the mixture is still forming) */
const WARMUP_FRAMES = 15;
/** MOG2 marks shadows 127 and foreground 255: thresholding between keeps a
 * sitter's cast shadow from lighting up the wall behind them */
const SHADOW_CUT = 200;
/** A cell turns on when this share of its pixels is foreground, and off below
 * the second: hysteresis, so dots on the silhouette's edge don't chatter */
const ON_COVER = 0.4;
const OFF_COVER = 0.25;

/** Disc thickness (px): seen edge-on, a disc is a white line this wide */
const DISC_T = 2;

/** Panel colors, and the warm white of painted flip-dot discs (face + rim) */
const PANEL = '#080808';
const SOCKET = '#030303';
const WHITE_FACE = [244, 241, 230];
const RIM = 'rgb(236, 233, 222)';

/** The "off" face is a shimmering purple: a ramp from shadowed violet to a
 * lilac glint, indexed by each disc's light level */
const PURPLE_STOPS = [[34, 10, 64], [104, 40, 184], [204, 160, 255]];
const PURPLE_STEPS = 64;
const PURPLE = Array.from({ length: PURPLE_STEPS }, (_, i) => {
  const t = (i / (PURPLE_STEPS - 1)) * 2;
  const [a, b] = t < 1 ? [PURPLE_STOPS[0], PURPLE_STOPS[1]] : [PURPLE_STOPS[1], PURPLE_STOPS[2]];
  const k = t < 1 ? t : t - 1;
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(',')})`;
});
/** The purple shimmers with the flip itself: its light level is a function
 * of the face's tilt a = acos(cos θ) ∈ [0, π/2] — resting at PURPLE_REST,
 * swelling gradually into a lilac glint as the face sweeps through
 * GLINT_ANGLE (rad) on its way over, then fading as it turns edge-on */
const PURPLE_REST = 0.4;
const GLINT_GAIN = 0.6;
const GLINT_ANGLE = 0.75;
const GLINT_WIDTH = 0.32;

/** Disc sprite atlas. A disc's look depends on nothing but its phase, so
 * every frame of the flip is painted once — ATLAS_STEPS per half-turn, plus
 * ATLAS_PAD frames past each rest for the clack's overshoot (≈ 0.05 turn) —
 * and the panel just blits sprites. Each sprite is painted at SUPERSAMPLE×
 * resolution and halved down step by step: canvas antialiasing composites
 * every fill's edge on its own, so where the rim's edge lies on (or within a
 * pixel of) the face's, their partial coverages leak into each other and the
 * thin rim breaks into stair-stepped pixels. At 4× those leaks shrink below a
 * quarter pixel and the box-filter halvings average them away. */
const ATLAS_STEPS = 128;
const ATLAS_PAD = 10;
const SUPERSAMPLE = 4;

/** Deterministic 0..1 jitter, stable across re-renders */
const jitter = (row: number, col: number) => ((row * 67 + col * 113) % 83) / 83;

/** easeOutBack with a small overshoot: the magnet slams the disc past flat
 * and it settles — the panel's mechanical clack */
const clack = (t: number) => {
  const s = 1.15;
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};

/**
 * A flip-dot display fed by the webcam. Each frame is cropped to the panel's
 * aspect (object-fit: cover), mirrored like a selfie view, and segmented by
 * OpenCV.js's BackgroundSubtractorMOG2: foreground cells (you) flip to their
 * white face, everything else shows the shimmering purple one.
 *
 * The mask pipeline, per sample: MOG2 on the frame at SUB× panel resolution →
 * drop its shadow class (SHADOW_CUT) → morphological open (removes speckle)
 * and close (fills pinholes) → INTER_AREA resize to one value per cell, which
 * is the share of the cell that's foreground → on/off with hysteresis. MOG2
 * learns its background from what it sees, so a sitter already in frame when
 * it starts reads as background until they move, and one who holds still
 * fades out over MOG2_HISTORY. OpenCV (~10 MB) loads lazily, only once a
 * camera is streaming (see ./opencv.ts); without a camera (no device, denied,
 * or still loading / warming up) the panel plays drifting metaballs instead.
 *
 * Rendering is a canvas, not DOM: each disc is drawn as the orthographic
 * projection of a DISC_T-thick coin rotating about its cell's diagonal. Each
 * face projects to an ellipse whose diagonal axis keeps the full radius while
 * the perpendicular one shrinks by |cos θ|; the two faces sit ±DISC_T/2 along
 * the coin's normal, so their projections part by DISC_T·sin θ across the
 * diagonal, and the white rim is the hull between them — a white line
 * DISC_T wide when the coin is edge-on. The purple face shows for cos θ ≥ 0,
 * the white one past edge-on. The discs are pre-painted, supersampled, into a
 * sprite atlas (see ATLAS_STEPS) and blitted pixel-aligned. Frames go no
 * further than the browser: nothing is uploaded.
 */
export default function Flipdots() {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = wrapper.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!el || !canvas || !ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let disposed = false;

    // ---- Grid + per-dot flip state (rebuilt on resize) ----
    let w = 0, h = 0, cols = 0, rows = 0, ox = 0, oy = 0;
    /** Shown face as a fraction of a half-turn: 0 purple, 1 white */
    let phase = new Float32Array(0);
    let fromPhase = new Float32Array(0);
    let goal = new Uint8Array(0);
    let startAt = new Float64Array(0);
    let animating = 0;
    let dirty = true;
    /** Panel + sockets, prerendered once per size */
    const plate = document.createElement('canvas');
    /** Device-pixel ratio and sprite size (device px) of the current atlas */
    let dpr = 1;
    let sprite = 0;

    // ---- Camera sampling + MOG2 segmentation (rebuilt on resize) ----
    const sampler = document.createElement('canvas');
    const sctx = sampler.getContext('2d', { willReadFrequently: true });
    let cv: OpenCv | null = null;
    /** MOG2 and its working buffers, allocated in the wasm heap: they must be
     * delete()d, so they live in one bundle that's torn down as a unit */
    let vision: {
      mog2: BackgroundSubtractorMOG2;
      rgb: Mat;
      fg: Mat;
      cover: Mat;
      kernel: Mat;
      cells: object;
    } | null = null;
    let cellMask = new Uint8Array(0);
    let modelFrames = 0;

    const disposeVision = () => {
      if (!vision) return;
      vision.mog2.delete();
      vision.rgb.delete();
      vision.fg.delete();
      vision.cover.delete();
      vision.kernel.delete();
      vision = null;
    };

    const layout = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      const nextDpr = Math.min(2, window.devicePixelRatio || 1);
      if (nextDpr !== dpr || sprite === 0) {
        dpr = nextDpr;
        buildAtlas();
      }
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);

      cols = Math.max(1, Math.ceil(w / CELL));
      rows = Math.max(1, Math.ceil(h / CELL));
      ox = (w - cols * CELL) / 2;
      oy = (h - rows * CELL) / 2;
      const n = cols * rows;
      phase = new Float32Array(n);
      fromPhase = new Float32Array(n);
      goal = new Uint8Array(n);
      startAt = new Float64Array(n);
      animating = 0;

      // The frame size changed: MOG2's per-pixel model starts over
      sampler.width = cols * SUB;
      sampler.height = rows * SUB;
      disposeVision();
      cellMask = new Uint8Array(n);
      modelFrames = 0;

      plate.width = canvas.width;
      plate.height = canvas.height;
      const pctx = plate.getContext('2d');
      if (pctx) {
        pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        pctx.fillStyle = PANEL;
        pctx.fillRect(0, 0, w, h);
        pctx.fillStyle = SOCKET;
        pctx.beginPath();
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = ox + c * CELL + CELL / 2;
            const y = oy + r * CELL + CELL / 2;
            pctx.moveTo(x + SOCKET_R, y);
            pctx.arc(x, y, SOCKET_R, 0, Math.PI * 2);
          }
        }
        pctx.fill();
      }
      dirty = true;
    };

    /** Point every dot at a new target face; changed dots start flipping */
    const retarget = (next: Uint8Array, now: number) => {
      for (let i = 0; i < next.length; i++) {
        if (next[i] === goal[i]) continue;
        const c = i % cols;
        goal[i] = next[i];
        fromPhase[i] = phase[i];
        startAt[i] = reduced ? now : now + c * SWEEP_MS_PER_COL + jitter(Math.floor(i / cols), c) * 25;
      }
      animating = 1;
    };

    // ---- Idle source: drifting metaballs ----
    const idleMask = (now: number) => {
      const next = new Uint8Array(cols * rows);
      const t = now / 1000;
      const s = Math.min(cols, rows);
      const balls = [
        [cols * (0.5 + 0.32 * Math.sin(t * 0.37)), rows * (0.5 + 0.28 * Math.sin(t * 0.53 + 1)), s * 0.24],
        [cols * (0.5 + 0.30 * Math.sin(t * 0.29 + 2)), rows * (0.5 + 0.30 * Math.cos(t * 0.41)), s * 0.2],
        [cols * (0.5 + 0.36 * Math.cos(t * 0.23 + 4)), rows * (0.5 + 0.22 * Math.sin(t * 0.31 + 3)), s * 0.17],
      ];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let field = 0;
          for (const [bx, by, br] of balls) {
            const dx = c + 0.5 - bx;
            const dy = r + 0.5 - by;
            field += (br * br) / (dx * dx + dy * dy + 1e-3);
          }
          next[r * cols + c] = field > 1 ? 1 : 0;
        }
      }
      return next;
    };

    // ---- Camera source ----
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    let stream: MediaStream | null = null;
    let cameraReady = false;

    navigator.mediaDevices?.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    }).then(s => {
      if (disposed) {
        s.getTracks().forEach(t => t.stop());
        return;
      }
      stream = s;
      video.srcObject = s;
      // OpenCV is only worth its download once there's a picture to segment
      return Promise.all([video.play(), loadOpenCv()])
        .then(([, loaded]) => {
          if (disposed) return;
          cv = loaded.cv;
          cameraReady = true;
        });
    }).catch(() => {
      // No camera, permission denied, or OpenCV failed to load: the metaballs
      // keep playing
    });

    /** Draw the cover-cropped, mirrored frame into the sampler */
    const sampleFrame = () => {
      if (!sctx) return null;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;
      const aspect = cols / rows;
      let sw = vw, sh = vh, sx = 0, sy = 0;
      if (vw / vh > aspect) {
        sw = vh * aspect;
        sx = (vw - sw) / 2;
      } else {
        sh = vw / aspect;
        sy = (vh - sh) / 2;
      }
      sctx.setTransform(-1, 0, 0, 1, sampler.width, 0);
      sctx.drawImage(video, sx, sy, sw, sh, 0, 0, sampler.width, sampler.height);
      return sctx.getImageData(0, 0, sampler.width, sampler.height);
    };

    /** Segment the sampled frame with MOG2 and reduce it to one bit per cell */
    const cameraMask = (): Uint8Array | null => {
      if (!cv) return null;
      const image = sampleFrame();
      if (!image) return null;
      if (!vision) {
        vision = {
          mog2: new cv.BackgroundSubtractorMOG2(MOG2_HISTORY, MOG2_VAR_THRESHOLD, true),
          rgb: new cv.Mat(),
          fg: new cv.Mat(),
          cover: new cv.Mat(),
          kernel: cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3)),
          cells: new cv.Size(cols, rows),
        };
      }
      const { mog2, rgb, fg, cover, kernel, cells } = vision;

      // MOG2 models 1- or 3-channel images; the canvas hands over RGBA
      const rgba = cv.matFromImageData(image);
      cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
      rgba.delete();
      mog2.apply(rgb, fg, -1);
      if (modelFrames < WARMUP_FRAMES) {
        modelFrames++;
        return null;
      }

      cv.threshold(fg, fg, SHADOW_CUT, 255, cv.THRESH_BINARY);
      cv.morphologyEx(fg, fg, cv.MORPH_OPEN, kernel);
      cv.morphologyEx(fg, fg, cv.MORPH_CLOSE, kernel);
      // INTER_AREA averages each SUB×SUB block: 0..255 = foreground share
      cv.resize(fg, cover, cells, 0, 0, cv.INTER_AREA);

      const share = cover.data;
      const next = new Uint8Array(cols * rows);
      for (let i = 0; i < next.length; i++) {
        const limit = (cellMask[i] ? OFF_COVER : ON_COVER) * 255;
        next[i] = share[i] > limit ? 1 : 0;
      }
      cellMask = next;
      return next;
    };

    // ---- Render ----
    const whiteFor = (k: number) =>
      `rgb(${(WHITE_FACE[0] * k) | 0},${(WHITE_FACE[1] * k) | 0},${(WHITE_FACE[2] * k) | 0})`;
    const AXIS = Math.PI / 4;
    /** The flip axis (cell diagonal) and its in-plane perpendicular */
    const ax = Math.SQRT1_2, ay = Math.SQRT1_2;
    const ux = -Math.SQRT1_2, uy = Math.SQRT1_2;

    /** Paint one disc at phase p, centered on (x, y), every length × k */
    const paintDisc = (g: CanvasRenderingContext2D, x: number, y: number, k: number, p: number) => {
      const R = DISC_R * k;
      // Rotation θ = p·π about the cell's diagonal; the face toward the
      // viewer flips when the coin passes edge-on (cos θ = 0)
      const theta = p * Math.PI;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const minor = R * Math.abs(cos);
      const white = cos < 0;

      // The faces' projected centers part along u by DISC_T·sin θ; the
      // hidden face's ellipse plus the band joining the two is the rim
      const off = (DISC_T / 2) * k * sin * (white ? -1 : 1);
      const fx = x + ux * off, fy = y + uy * off;
      if (Math.abs(off) > 0.01 * k) {
        const bx = x - ux * off, by = y - uy * off;
        g.fillStyle = RIM;
        g.beginPath();
        g.ellipse(bx, by, R, minor, AXIS, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(bx + ax * R, by + ay * R);
        g.lineTo(fx + ax * R, fy + ay * R);
        g.lineTo(fx - ax * R, fy - ay * R);
        g.lineTo(bx - ax * R, by - ay * R);
        g.closePath();
        g.fill();
      }

      if (white) {
        // Tilted faces catch less light than one square to the viewer
        g.fillStyle = whiteFor(0.62 + 0.38 * Math.abs(cos));
      } else {
        const a = Math.acos(cos);
        const gl = (a - GLINT_ANGLE) / GLINT_WIDTH;
        const level = (PURPLE_REST + GLINT_GAIN * Math.exp(-gl * gl)) * (0.7 + 0.3 * cos);
        g.fillStyle = PURPLE[Math.round(Math.min(1, level) * (PURPLE_STEPS - 1))];
      }
      g.beginPath();
      g.ellipse(fx, fy, R, minor, AXIS, 0, Math.PI * 2);
      g.fill();
    };

    /** Frames laid out in a grid of ATLAS_COLS sprites per row */
    const FRAMES = ATLAS_STEPS + 1 + ATLAS_PAD * 2;
    const ATLAS_COLS = 16;
    const atlas = document.createElement('canvas');

    const buildAtlas = () => {
      sprite = Math.round(CELL * dpr);
      atlas.width = sprite * ATLAS_COLS;
      atlas.height = sprite * Math.ceil(FRAMES / ATLAS_COLS);
      const actx = atlas.getContext('2d');
      if (!actx) return;
      actx.imageSmoothingEnabled = true;
      actx.imageSmoothingQuality = 'high';

      // Paint at SUPERSAMPLE×, then halve until sprite size: each halving
      // averages 2×2 blocks, a clean box filter
      const levels: HTMLCanvasElement[] = [];
      for (let size = sprite * SUPERSAMPLE; size >= sprite; size /= 2) {
        const lv = document.createElement('canvas');
        lv.width = lv.height = size;
        levels.push(lv);
      }
      const hctx = levels[0].getContext('2d');
      if (!hctx) return;
      const k = levels[0].width / CELL;

      for (let f = 0; f < FRAMES; f++) {
        hctx.clearRect(0, 0, levels[0].width, levels[0].height);
        paintDisc(hctx, levels[0].width / 2, levels[0].height / 2, k, (f - ATLAS_PAD) / ATLAS_STEPS);
        for (let i = 1; i < levels.length; i++) {
          const lctx = levels[i].getContext('2d');
          if (!lctx) return;
          lctx.imageSmoothingQuality = 'high';
          lctx.clearRect(0, 0, levels[i].width, levels[i].height);
          lctx.drawImage(levels[i - 1], 0, 0, levels[i].width, levels[i].height);
        }
        actx.drawImage(
          levels[levels.length - 1],
          (f % ATLAS_COLS) * sprite,
          Math.floor(f / ATLAS_COLS) * sprite,
        );
      }
    };

    const draw = () => {
      // Everything here is in device pixels, so sprites blit 1:1 with no
      // resampling blur
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(plate, 0, 0);
      for (let r = 0; r < rows; r++) {
        const y = Math.round((oy + r * CELL) * dpr);
        for (let c = 0; c < cols; c++) {
          const x = Math.round((ox + c * CELL) * dpr);
          const f = Math.min(FRAMES - 1, Math.max(0,
            Math.round(phase[r * cols + c] * ATLAS_STEPS) + ATLAS_PAD));
          ctx.drawImage(
            atlas,
            (f % ATLAS_COLS) * sprite, Math.floor(f / ATLAS_COLS) * sprite, sprite, sprite,
            x, y, sprite, sprite,
          );
        }
      }
    };

    // ---- Loop ----
    let lastSample = -Infinity;
    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);

      if (now - lastSample >= SAMPLE_MS) {
        lastSample = now;
        // The camera drives the panel once its background model has warmed
        // up; until then (or without a camera) the metaballs do. A dropped
        // camera frame after warm-up just holds the current picture.
        let next = cameraReady ? cameraMask() : null;
        if (!next && (!cameraReady || modelFrames < WARMUP_FRAMES)) next = idleMask(now);
        if (next) retarget(next, now);
      }

      if (animating) {
        let moving = false;
        for (let i = 0; i < phase.length; i++) {
          const target = goal[i];
          if (phase[i] === target) continue;
          moving = true;
          if (now < startAt[i]) continue;
          const span = FLIP_MS * Math.max(0.35, Math.abs(target - fromPhase[i]));
          const t = reduced ? 1 : Math.min(1, (now - startAt[i]) / span);
          phase[i] = t >= 1 ? target : fromPhase[i] + (target - fromPhase[i]) * clack(t);
        }
        animating = moving ? 1 : 0;
        dirty = true;
      }

      if (dirty) {
        dirty = false;
        draw();
      }
    };

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(el);
    frame = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      stream?.getTracks().forEach(t => t.stop());
      video.srcObject = null;
      disposeVision();
    };
  }, []);

  return (
    <Link href="/">
      <div className={styles.wrapper} ref={wrapper}>
        <canvas className={styles.canvas} ref={canvasRef} />
      </div>
    </Link>
  )
}
