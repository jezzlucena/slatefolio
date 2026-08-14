'use client';

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import Logo from "../Logo/Logo";
import Logo2 from "../Logo2/Logo2";
import Logo3 from "../Logo3/Logo3";
import Logo4 from "../Logo4/Logo4";
import Logo5 from "../Logo5/Logo5";
import Logo6 from "../Logo6/Logo6";
import Logo7 from "../Logo7/Logo7";
import Logo8 from "../Logo8/Logo8";
import TopBar from "../TopBar/TopBar";
import styles from "./Header.module.scss"
import { useSearchParams } from "next/navigation";
import { LOGO_COOKIE, LOGO_THEMES } from "./logoRotation";
import { useProfile } from "@/stores/profileStore";
import { LocalizedString } from "@/types/LocalizedString";

/** The rotation order: one logo per full page load.
 * Order must match LOGO_THEMES in logoRotation.ts (the ?logo= deep links). */
const LOGOS = [Logo, Logo2, Logo3, Logo4, Logo5, Logo6, Logo7, Logo8];

interface HeaderProps {
  /** Which logo to show this load — read from the cookie by the server layout */
  logoIndex?: number;
}

/** How long the logo takes to fade out (and back in) when rotating manually */
const FADE_MS = 350;

export default function Header({ logoIndex = 0 }: HeaderProps) {
  const { profile } = useProfile();
  const locale = useLocale() as keyof LocalizedString;
  // Deep link: ?logo=<theme> (see LOGO_THEMES) picks a logo directly,
  // overriding the rotation cookie. Safe to read here without a Suspense
  // boundary: the layout's cookies() call keeps every route dynamic, and
  // the same params are available during SSR — no flash, no mismatch.
  const searchParams = useSearchParams();
  const themeParam = searchParams.get('logo')?.toLowerCase() ?? null;
  const themeIndex = themeParam ? LOGO_THEMES.indexOf(themeParam) : -1;
  const [index, setIndex] = useState(themeIndex >= 0 ? themeIndex : logoIndex);
  const [visible, setVisible] = useState(true);
  const fadeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Client-side navigations can change the param after mount; an unknown or
  // absent theme leaves the current rotation alone.
  useEffect(() => {
    if (themeIndex >= 0) setIndex(themeIndex);
  }, [themeIndex]);

  const CurrentLogo = LOGOS[((index % LOGOS.length) + LOGOS.length) % LOGOS.length];

  /** Fade the current logo out, swap it, and let the newcomer fade in */
  const rotate = (dir: number) => {
    if (fadeTimeout.current) return; // ignore clicks mid-transition
    setVisible(false);
    fadeTimeout.current = setTimeout(() => {
      fadeTimeout.current = null;
      setIndex(i => (((i + dir) % LOGOS.length) + LOGOS.length) % LOGOS.length);
      setVisible(true);
    }, FADE_MS);
  };

  useEffect(() => () => {
    if (fadeTimeout.current) clearTimeout(fadeTimeout.current);
  }, []);

  // Advance the sequence so the next full page load shows the logo after the
  // one last seen, whether it was reached by rotation or by the arrows
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
        </div>
      </div>
    </>
  );
}
