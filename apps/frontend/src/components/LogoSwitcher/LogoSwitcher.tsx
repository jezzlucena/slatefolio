'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { LOGO_CATALOG } from "../Header/logoRotation";
import styles from "./LogoSwitcher.module.scss";

interface LogoSwitcherProps {
  /** Index (into LOGO_CATALOG) of the logo currently on the hero */
  current: number;
  /** The visitor picked a logo: show it and close */
  onSelect: (index: number) => void;
  /** Closed without picking (Escape, backdrop, the × button) */
  onClose: () => void;
}

// Coverflow geometry. Each card is placed by its signed distance from the
// active one: it slides sideways by STEP_X card-widths, recedes STEP_Z px per
// step and turns its outer edge away by TILT degrees. Cards further than
// REACH steps are hidden (they would just be slivers behind the last one).
const STEP_X = 0.46;
const STEP_Z = 140;
const TILT = 52;
const REACH = 4;

/** Wheel ticks within this window after a step are swallowed, so one flick of
 * a trackpad moves one card instead of five */
const WHEEL_COOLDOWN_MS = 320;
/** Pointer travel (px) that counts as a swipe rather than a click */
const SWIPE_PX = 40;

const count = LOGO_CATALOG.length;
const wrap = (i: number) => ((i % count) + count) % count;

/**
 * Coverflow-style picker for the header artwork. Opens as a native modal
 * <dialog> (top layer, focus trapped, Escape closes). Arrow keys, arrow
 * buttons, a horizontal wheel/trackpad swipe, a pointer drag, or clicking a
 * side card browse; clicking the centered card (or "Show this logo") picks it.
 * Thumbnails come from LOGO_CATALOG; entries without one get a placeholder.
 */
export default function LogoSwitcher({ current, onSelect, onClose }: LogoSwitcherProps) {
  const t = useTranslations('logoSwitcher');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(wrap(current));
  const lastWheel = useRef(0);
  const dragStartX = useRef<number | null>(null);
  const swiped = useRef(false);

  // showModal() puts the dialog in the top layer with a focus trap; the
  // native "close" event (Escape) is routed to onClose below
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, []);

  const step = useCallback((dir: number) => setActive(i => wrap(i + dir)), []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowLeft': step(-1); break;
      case 'ArrowRight': step(1); break;
      case 'Home': setActive(0); break;
      case 'End': setActive(count - 1); break;
      default: return;
    }
    event.preventDefault();
  };

  const onWheel = (event: React.WheelEvent) => {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const now = performance.now();
    if (Math.abs(delta) < 4 || now - lastWheel.current < WHEEL_COOLDOWN_MS) return;
    lastWheel.current = now;
    step(delta > 0 ? 1 : -1);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    dragStartX.current = event.clientX;
    swiped.current = false;
  };
  const onPointerUp = (event: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    const travel = event.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(travel) < SWIPE_PX) return;
    swiped.current = true; // the click that follows a swipe is not a pick
    step(travel < 0 ? 1 : -1);
  };

  const onCardClick = (index: number) => {
    if (swiped.current) { swiped.current = false; return; }
    if (index === active) onSelect(index);
    else setActive(index);
  };

  const activeLogo = LOGO_CATALOG[active];
  const isCurrent = active === wrap(current);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={t('title')}
      onClose={onClose}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={onKeyDown}
      // Only a click on the dialog box itself (i.e. the backdrop) closes it
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={styles.panel}>
        <button
          type="button"
          className={styles.close}
          aria-label={t('close')}
          onClick={onClose}
        >&times;</button>

        <div
          className={styles.stage}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { dragStartX.current = null; }}
        >
          {LOGO_CATALOG.map((logo, index) => {
            // Signed distance to the active card, taking the short way round
            // so the ring never shows a seam between last and first
            let offset = index - active;
            if (offset > count / 2) offset -= count;
            if (offset < -count / 2) offset += count;
            const distance = Math.abs(offset);
            const hidden = distance > REACH;
            const side = Math.sign(offset);
            const transform =
              `translateX(${(offset * STEP_X * 100).toFixed(1)}%) ` +
              `translateZ(${-distance * STEP_Z}px) ` +
              `rotateY(${-side * TILT}deg)`;

            return (
              <button
                key={logo.slug}
                type="button"
                className={`${styles.card} ${offset === 0 ? styles.active : ''}`}
                style={{
                  transform,
                  zIndex: REACH + 1 - distance,
                  opacity: hidden ? 0 : 1,
                  pointerEvents: hidden ? 'none' : undefined,
                  // Side cards fall into shadow the further out they sit
                  ['--shade' as string]: Math.min(0.7, distance * 0.22),
                }}
                tabIndex={offset === 0 ? 0 : -1}
                aria-hidden={hidden || undefined}
                aria-label={offset === 0 ? t('show', { name: logo.name }) : t('preview', { name: logo.name })}
                onClick={() => onCardClick(index)}
              >
                {logo.thumbnail ? (
                  <Image
                    src={logo.thumbnail}
                    alt=""
                    fill
                    sizes="(max-width: 600px) 70vw, 460px"
                    draggable={false}
                  />
                ) : (
                  <span className={styles.placeholder} aria-hidden="true">
                    <span className={styles.placeholderName}>{logo.name}</span>
                  </span>
                )}
                {index === wrap(current) && (
                  <span className={styles.badge}>{t('nowShowing')}</span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            className={`${styles.arrow} ${styles.left}`}
            aria-label={t('previous')}
            onClick={() => step(-1)}
          >&#8249;</button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.right}`}
            aria-label={t('next')}
            onClick={() => step(1)}
          >&#8250;</button>
        </div>

        <div className={styles.caption} aria-live="polite">
          <h2 className={styles.name}>{activeLogo.name}</h2>
          <p className={styles.tagline}>{t(`taglines.${activeLogo.slug}`)}</p>
          <button
            type="button"
            className={styles.pick}
            disabled={isCurrent}
            onClick={() => onSelect(active)}
          >
            {isCurrent ? t('nowShowing') : t('showThis')}
          </button>
        </div>

        <div className={styles.dots} role="tablist" aria-label={t('title')}>
          {LOGO_CATALOG.map((logo, index) => (
            <button
              key={logo.slug}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={logo.name}
              tabIndex={-1}
              className={`${styles.dot} ${index === active ? styles.dotActive : ''}`}
              onClick={() => setActive(index)}
            />
          ))}
        </div>
      </div>
    </dialog>
  );
}
