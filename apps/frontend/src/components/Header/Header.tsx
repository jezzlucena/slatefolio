'use client';

import { useEffect } from "react";
import { useLocale } from "next-intl";
import Logo from "../Logo/Logo";
import Logo2 from "../Logo2/Logo2";
import Logo3 from "../Logo3/Logo3";
import Logo4 from "../Logo4/Logo4";
import TopBar from "../TopBar/TopBar";
import styles from "./Header.module.scss"
import { LOGO_COOKIE } from "./logoRotation";
import { useProfile } from "@/stores/profileStore";
import { LocalizedString } from "@/types/LocalizedString";

/** The rotation order: one logo per full page load */
const LOGOS = [Logo, Logo2, Logo3, Logo4];

interface HeaderProps {
  /** Which logo to show this load — read from the cookie by the server layout */
  logoIndex?: number;
}

export default function Header({ logoIndex = 0 }: HeaderProps) {
  const { profile } = useProfile();
  const locale = useLocale() as keyof LocalizedString;

  const CurrentLogo = LOGOS[((logoIndex % LOGOS.length) + LOGOS.length) % LOGOS.length];

  // Advance the sequence so the next full page load shows the next logo
  useEffect(() => {
    const next = (logoIndex + 1) % LOGOS.length;
    document.cookie = `${LOGO_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, [logoIndex]);

  return (
    <>
      <TopBar />

      <div className={`${styles.header} ${styles.fixed}`}>
        <CurrentLogo />
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
