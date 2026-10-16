'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import styles from './Interference.module.scss';

/** Two engraved plates, slightly out of register. Their intersections invert
 * the ink, making broad optical folds out of simple concentric ellipses. */
const COMPOSITIONS = [
  { name: 'Converge', spread: 0.22, angle: -0.2, aspect: 0.86, phase: 0 },
  { name: 'Orbit', spread: 0.09, angle: 0.68, aspect: 0.69, phase: 0.36 },
  { name: 'Fold', spread: 0.34, angle: -0.54, aspect: 1.12, phase: 0.68 },
];
const TAP_SLOP = 9;
const MAX_PIXELS = 6_000_000;
const TAU = Math.PI * 2;

type Engine = {
  move: (x: number, y: number) => void;
  release: () => void;
  compose: (index: number) => void;
};

type Press = { id: number; x: number; y: number; moved: boolean };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function Interference() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const press = useRef<Press | null>(null);
  const suppressClick = useRef(false);
  const compositionIndex = useRef(0);
  const keyboardPoint = useRef({ x: 0, y: 0 });
  const [composition, setComposition] = useState(0);
  const instructionsId = useId();

  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    const ctx = surface.getContext('2d', { alpha: false });
    if (!ctx) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motion.matches;
    let width = 0;
    let height = 0;
    let ratio = 1;
    let frame = 0;
    let lastTime = 0;
    let disposed = false;
    const initial = COMPOSITIONS[compositionIndex.current];
    const current = { x: 0, y: 0, ...initial };
    const target = { ...current };

    const draw = () => {
      if (!width || !height) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#090a0e';
      ctx.fillRect(0, 0, width, height);

      const unit = Math.min(width * 0.82, height * 0.88);
      const centerX = width / 2;
      // Shares the family's center above the frosted name / role bar.
      const centerY = height / 2 - Math.min(50, height * 0.08);
      // At least 18 CSS px per band pair: the figure/ground stays legible
      // on a phone and ring count remains bounded on large displays.
      const pitch = Math.max(18, Math.min(width, height) / 31);
      const radius = Math.hypot(width, height) * 1.7;
      const count = Math.min(180, Math.ceil(radius / pitch) + 2);
      const offsetX = current.x * unit * 0.16;
      const offsetY = current.y * unit * 0.13;

      // Color is printed into selected bands, leaving most of the piece
      // in warm ivory and ink. These are the family's aurora anchors.
      const aurora = ctx.createLinearGradient(0, centerY - unit * 0.4, width, centerY + unit * 0.4);
      aurora.addColorStop(0, '#68dccb');
      aurora.addColorStop(0.34, '#b9adf0');
      aurora.addColorStop(0.65, '#e99bbb');
      aurora.addColorStop(1, '#edc578');

      for (let plate = 0; plate < 2; plate++) {
        const side = plate === 0 ? -1 : 1;
        ctx.save();
        ctx.translate(
          centerX + side * unit * current.spread + (plate === 1 ? offsetX : -offsetX * 0.25),
          centerY + side * unit * 0.045 + (plate === 1 ? offsetY : -offsetY * 0.25),
        );
        ctx.rotate(side * current.angle);
        ctx.scale(1, plate === 0 ? current.aspect : 1 / current.aspect);
        if (plate === 1) ctx.globalCompositeOperation = 'difference';
        ctx.lineWidth = pitch * 0.48;

        for (let ring = 0; ring < count; ring++) {
          const r = (ring + 0.65 + plate * current.phase) * pitch;
          ctx.strokeStyle = plate === 0 && ring % 9 < 2 ? aurora : '#eeeae0';
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, TAU);
          ctx.stroke();
        }
        ctx.restore();
      }

      // A quiet ink vignette gives the engraving a center without blurring
      // the fine edges responsible for the illusion.
      ctx.globalCompositeOperation = 'source-over';
      const vignette = ctx.createRadialGradient(centerX, centerY, unit * 0.18, centerX, centerY, Math.hypot(width, height) * 0.66);
      vignette.addColorStop(0, 'rgba(9, 10, 14, 0)');
      vignette.addColorStop(1, 'rgba(9, 10, 14, 0.56)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    };

    const values = ['x', 'y', 'spread', 'angle', 'aspect', 'phase'] as const;

    const render = (time: number) => {
      frame = 0;
      if (disposed || document.hidden) return;
      const elapsed = lastTime ? Math.min(time - lastTime, 50) : 16;
      lastTime = time;
      const blend = reducedMotion ? 1 : 1 - Math.exp(-elapsed / 145);
      let moving = false;
      for (const key of values) {
        const distance = target[key] - current[key];
        if (Math.abs(distance) < 0.0003 || reducedMotion) current[key] = target[key];
        else {
          current[key] += distance * blend;
          moving = true;
        }
      }
      draw();
      // No idle animation. A settled engraving consumes no animation frames.
      if (moving) frame = window.requestAnimationFrame(render);
      else lastTime = 0;
    };

    const requestRender = () => {
      if (!disposed && !document.hidden && !frame) frame = window.requestAnimationFrame(render);
    };

    const resize = () => {
      const rect = surface.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      // Bound both retina resolution and total backing-store allocation.
      ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / Math.max(1, width * height)));
      surface.width = Math.max(1, Math.round(width * ratio));
      surface.height = Math.max(1, Math.round(height * ratio));
      requestRender();
    };

    const updateMotion = () => {
      reducedMotion = motion.matches;
      // Reduced motion has no pointer chase. Composition changes still
      // produce a new, immediately drawn static print.
      if (reducedMotion) target.x = target.y = 0;
      requestRender();
    };

    const updateVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
      } else requestRender();
    };

    engine.current = {
      move(x, y) {
        if (reducedMotion) return;
        target.x = clamp(x, -1, 1);
        target.y = clamp(y, -1, 1);
        requestRender();
      },
      release() {
        target.x = target.y = 0;
        requestRender();
      },
      compose(index) {
        Object.assign(target, COMPOSITIONS[index]);
        requestRender();
      },
    };

    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    window.addEventListener('resize', resize);
    motion.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    resize();

    return () => {
      disposed = true;
      engine.current = null;
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      motion.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  const shift = () => {
    const next = (compositionIndex.current + 1) % COMPOSITIONS.length;
    compositionIndex.current = next;
    setComposition(next);
    engine.current?.compose(next);
  };

  const follow = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary) return;
    const start = press.current;
    if (start?.id === event.pointerId) {
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.hypot(dx, dy) > TAP_SLOP) start.moved = true;
      // Horizontal touch exploration coexists with normal vertical page
      // scrolling and pinch zoom; a browser-owned pan cancels the press.
      if (event.pointerType === 'touch' && (!start.moved || Math.abs(dx) <= Math.abs(dy))) return;
    } else if (event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    engine.current?.move(
      ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      ((event.clientY - rect.top) / rect.height - 0.5) * 2,
    );
  };

  const release = () => {
    keyboardPoint.current = { x: 0, y: 0 };
    engine.current?.release();
  };

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const point = keyboardPoint.current;
    switch (event.key) {
      case 'ArrowLeft': point.x -= 0.2; break;
      case 'ArrowRight': point.x += 0.2; break;
      case 'ArrowUp': point.y -= 0.2; break;
      case 'ArrowDown': point.y += 0.2; break;
      case 'Escape': release(); return;
      default: return; // Enter / Space use the native button's activation.
    }
    event.preventDefault();
    point.x = clamp(point.x, -1, 1);
    point.y = clamp(point.y, -1, 1);
    engine.current?.move(point.x, point.y);
  };

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.surface}
        aria-label="Change Interference composition"
        aria-describedby={instructionsId}
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          suppressClick.current = false;
          press.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
        }}
        onPointerMove={follow}
        onPointerUp={event => {
          if (press.current?.id !== event.pointerId) return;
          suppressClick.current = press.current.moved;
          press.current = null;
          if (event.pointerType === 'touch') release();
        }}
        onPointerCancel={event => {
          if (!event.isPrimary) return;
          press.current = null;
          suppressClick.current = true;
          release();
        }}
        onPointerLeave={event => {
          if (!event.isPrimary) return;
          if (press.current) suppressClick.current = true;
          press.current = null;
          release();
        }}
        onBlur={release}
        onClick={event => {
          if (event.detail !== 0 && suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          shift();
        }}
        onKeyDown={handleKey}
      >
        <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
      </button>

      <div className={styles.caption} aria-hidden="true">
        <span className={styles.edition}>10 / INTERFERENCE</span>
        <span className={styles.composition}>{String(composition + 1).padStart(2, '0')} — {COMPOSITIONS[composition].name}</span>
      </div>
      <div className={styles.hint} aria-hidden="true">
        <span className={styles.pointerHint}><span className={styles.motionHint}>Move to bend · </span>Click to shift</span>
        <span className={styles.touchHint}><span className={styles.motionHint}>Drag to bend · </span>Tap to shift</span>
        <span className={styles.keyboardHint}><span className={styles.motionHint}>Arrows to bend · </span>Enter to shift</span>
      </div>
      <p id={instructionsId} className={styles.srOnly}>
        Move the pointer or drag horizontally to bend the optical pattern.
        Click, tap, or press Enter or Space to change composition.
        Arrow keys move the pattern; Escape recenters it. With reduced motion,
        changing composition displays a new static pattern.
      </p>
      <span className={styles.srOnly} role="status">{COMPOSITIONS[composition].name} composition</span>
    </div>
  );
}
