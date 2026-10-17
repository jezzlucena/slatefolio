'use client';

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Mosaic,
  Drone,
  Slyce,
  Rose,
  Tetra,
  Origami,
  Vasarely,
  Copacabana,
  Glitch,
  Interference,
  Flipdots
} from "../Logo";
import TopBar from "../TopBar/TopBar";
import LogoSwitcher from "../LogoSwitcher/LogoSwitcher";
import styles from "./Header.module.scss"
import { useSearchParams } from "next/navigation";
import { LOGO_COOKIE, LOGO_THEMES } from "./logoRotation";
import { useProfile } from "@/stores/profileStore";
import { LocalizedString } from "@/types/LocalizedString";

/** The rotation order: one logo per full page load.
 * Order must match LOGO_CATALOG in logoRotation.ts (the ?logo= deep links and
 * the LogoSwitcher coverflow). */
const LOGOS = [
  Mosaic, 
  Drone, 
  Slyce, 
  Rose, 
  Tetra, 
  Origami, 
  Vasarely, 
  Copacabana, 
  Glitch, 
  Interference,
  Flipdots
];

interface HeaderProps {
  /** Which logo to show this load — read from the cookie by the server layout */
  logoIndex?: number;
}

/** How long the logo takes to fade out (and back in) when rotating manually */
const FADE_MS = 350;

export default function Header({ logoIndex = 0 }: HeaderProps) {
  const { profile } = useProfile();
  const locale = useLocale() as keyof LocalizedString;
  const t = useTranslations('logoSwitcher');
  // Deep link: ?logo=<theme> (see LOGO_THEMES) picks a logo directly,
  // overriding the rotation cookie. Safe to read here without a Suspense
  // boundary: the layout's cookies() call keeps every route dynamic, and
  // the same params are available during SSR — no flash, no mismatch.
  const searchParams = useSearchParams();
  const themeParam = searchParams.get('logo')?.toLowerCase() ?? null;
  const themeIndex = themeParam ? LOGO_THEMES.indexOf(themeParam) : -1;
  const [index, setIndex] = useState(themeIndex >= 0 ? themeIndex : logoIndex);
  const [visible, setVisible] = useState(true);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const fadeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Client-side navigations can change the param after mount; an unknown or
  // absent theme leaves the current rotation alone.
  useEffect(() => {
    if (themeIndex >= 0) setIndex(themeIndex);
  }, [themeIndex]);

  const CurrentLogo = LOGOS[((index % LOGOS.length) + LOGOS.length) % LOGOS.length];

  /** Fade the current logo out, swap it for `target`, and let the newcomer
   * fade in. `target` may be an index or an updater of the current one. */
  const showLogo = (target: number | ((i: number) => number)) => {
    if (fadeTimeout.current) return; // ignore clicks mid-transition
    setVisible(false);
    fadeTimeout.current = setTimeout(() => {
      fadeTimeout.current = null;
      setIndex(i => {
        const next = typeof target === 'function' ? target(i) : target;
        return ((next % LOGOS.length) + LOGOS.length) % LOGOS.length;
      });
      setVisible(true);
    }, FADE_MS);
  };

  /** Step the rotation by `dir` (the hero's chevrons) */
  const rotate = (dir: number) => showLogo(i => i + dir);

  /** The switcher picked a logo: close it, then cross-fade the hero */
  const pickLogo = (target: number) => {
    setSwitcherOpen(false);
    if (target !== index) showLogo(target);
  };

  useEffect(() => () => {
    if (fadeTimeout.current) clearTimeout(fadeTimeout.current);
  }, []);

  // Advance the sequence so the next full page load shows the logo after the
  // one last seen, whether it was reached by rotation, the arrows or the
  // switcher
  useEffect(() => {
    const next = (index + 1) % LOGOS.length;
    document.cookie = `${LOGO_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, [index]);

  return (
    <>
      <TopBar />

      <div className={`${styles.header} ${styles.fixed}`}>
        <div className={`${styles.logoStage} ${visible ? '' : styles.faded}`}>
          <CurrentLogo />
        </div>
        <button
          type="button"
          className={`${styles.arrow} ${styles.left}`}
          aria-label="Previous logo"
          onClick={() => rotate(-1)}
        >&#8249;</button>
        <button
          type="button"
          className={`${styles.arrow} ${styles.right}`}
          aria-label="Next logo"
          onClick={() => rotate(1)}
        >&#8250;</button>
      </div>

      <div className={`${styles.header} ${styles.relative}`}>
        <div className={`${styles.text}`}>
          <span>{profile?.name[locale] || profile?.name?.en || "Slatefolio"}</span>
          <span className={`${styles.title}`}>{profile?.role[locale] || profile?.role?.en}</span>
          {/* Bottom-right of the hero, riding the frosted name bar so it reads
              on any logo. Hides with the bar while a Slyce game is on. */}
          <button
            type="button"
            className={styles.switcherButton}
            aria-label={t('open')}
            title={t('open')}
            aria-haspopup="dialog"
            aria-expanded={switcherOpen}
            onClick={() => setSwitcherOpen(true)}
          >
            {/* Coverflow glyph: a front card flanked by two receding ones */}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.5 7.8 6.5 6.4v11.2l-4-1.4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M21.5 7.8 17.5 6.4v11.2l4-1.4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <rect x="8.25" y="4.75" width="7.5" height="14.5" rx="1" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      {switcherOpen && (
        <LogoSwitcher
          current={index}
          onSelect={pickLogo}
          onClose={() => setSwitcherOpen(false)}
        />
      )}
    </>
  );
}
