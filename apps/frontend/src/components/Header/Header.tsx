'use client';

import { useLocale } from "next-intl";
import Logo from "../Logo/Logo";
import TopBar from "../TopBar/TopBar";
import styles from "./Header.module.scss"
import { useProfile } from "@/stores/profileStore";
import { LocalizedString } from "@/types/LocalizedString";

export default function Header() {
  const { profile } = useProfile();
  const locale = useLocale() as keyof LocalizedString;

  return (
    <>
      <TopBar />

      <div className={`${styles.header} ${styles.fixed}`}>
        <Logo />
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