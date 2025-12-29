'use client';

import { useLocale } from "next-intl";
import { useState, useEffect } from "react";
import Logo from "../Logo/Logo";
import SacredGeometry from "../SacredGeometry/SacredGeometry";
import HolyGeometry from "../HolyGeometry/HolyGeometry";
import CellularAutomata from "../CellularAutomata/CellularAutomata";
import TopBar from "../TopBar/TopBar";
import styles from "./Header.module.scss"
import { useProfile } from "@/stores/profileStore";
import { LocalizedString } from "@/types/LocalizedString";

type HeaderArt = 'logo' | 'sacred' | 'holy' | 'cellular';

export default function Header() {
  const [headerArt, setHeaderArt] = useState<HeaderArt>('logo');
  const [isClient, setIsClient] = useState(false);
  const { profile } = useProfile();
  const locale = useLocale() as keyof LocalizedString;

  // Randomly decide which art to show (1/4 each)
  useEffect(() => {
    setIsClient(true);
    const random = Math.random();
    if (random < 0.25) {
      setHeaderArt('logo');
    } else if (random < 0.5) {
      setHeaderArt('sacred');
    } else if (random < 0.75) {
      setHeaderArt('holy');
    } else {
      setHeaderArt('cellular');
    }
  }, []);

  const renderHeaderArt = () => {
    switch (headerArt) {
      case 'sacred':
        return <SacredGeometry />;
      case 'holy':
        return <HolyGeometry />;
      case 'cellular':
        return <CellularAutomata />;
      case 'logo':
      default:
        return <Logo />;
    }
  };

  return (
    <>
      <TopBar />

      <div className={`${styles.header} ${styles.fixed}`}>
        {isClient && renderHeaderArt()}
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