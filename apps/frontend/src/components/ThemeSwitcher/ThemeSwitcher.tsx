'use client'

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./ThemeSwitcher.module.scss";

export type ThemePreference = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'theme';
const ORDER: ThemePreference[] = ['auto', 'light', 'dark'];

// 8 sun rays evenly spaced around the core, pointing outward (inner radius
// 8.2, outer 10.3 in the 24x24 viewBox). Computed once — deterministic, so
// server and client render identical markup.
const RAYS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4;
  const ray = (radius: number, trig: (a: number) => number) =>
    Math.round((12 + trig(angle) * radius) * 100) / 100;
  return {
    x1: ray(8.2, Math.sin), y1: ray(-8.2, Math.cos),
    x2: ray(10.3, Math.sin), y2: ray(-10.3, Math.cos),
  };
});

/** Applies a theme preference: "auto" means no data-theme attribute, letting
 * globals.css follow prefers-color-scheme. Mirrors the pre-paint script in
 * layout.tsx — keep the two in sync. */
function applyPreference(pref: ThemePreference) {
  const root = document.documentElement;
  try {
    if (pref === 'auto') {
      delete root.dataset.theme;
      localStorage.removeItem(STORAGE_KEY);
    } else {
      root.dataset.theme = pref;
      localStorage.setItem(STORAGE_KEY, pref);
    }
  } catch {
    // localStorage may be unavailable (private mode) — the attribute alone
    // still themes this page view
  }
}

/**
 * Cycles Auto → Light → Dark. The icon morphs between a sun and a moon; in
 * Auto it shows the OS-resolved theme plus an "A" badge.
 */
export default function ThemeSwitcher() {
  const t = useTranslations('common');
  // useId's ":r0:" format breaks SVG url(#...) references — strip the colons
  const maskId = `theme-moon-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [pref, setPref] = useState<ThemePreference>('auto');
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {}
    if (stored === 'light' || stored === 'dark') {
      setPref(stored);
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(media.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setPref(next);
    applyPreference(next);
  };

  const isDark = pref === 'dark' || (pref === 'auto' && systemDark);
  const label =
    pref === 'auto' ? t('themeAuto') : pref === 'light' ? t('themeLight') : t('themeDark');

  return (
    <button
      type="button"
      className={`${styles.switcher} ${isDark ? styles.dark : ''}`}
      onClick={cycle}
      aria-label={label}
      title={label}
    >
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <mask id={maskId}>
          <rect x="0" y="0" width="24" height="24" fill="white" />
          {/* Slides over the core to carve the moon's crescent */}
          <circle className={styles.moonMask} cx="30" cy="0" r="8" fill="black" />
        </mask>
        <circle
          className={styles.core}
          cx="12"
          cy="12"
          r="5.25"
          fill="currentColor"
          mask={`url(#${maskId})`}
        />
        <g className={styles.rays} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {RAYS.map((ray, i) => (
            <line key={i} {...ray} />
          ))}
        </g>
      </svg>
      {pref === 'auto' && <span className={styles.autoBadge}>A</span>}
    </button>
  );
}
