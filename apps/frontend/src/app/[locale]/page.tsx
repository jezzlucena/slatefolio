'use client'

import { useEffect, useRef, useState } from "react";
import styles from "./Portfolio.module.scss"
import Heading from "../../components/Heading/Heading";
import ProjectGallery from "../../components/ProjectGallery/ProjectGallery";
import useHoveredOnTouch from "@/hooks/useHoveredOnTouch";
import { useLocale, useTranslations } from "next-intl";
import { useProfile } from "@/stores/profileStore";
import type { LocalizedString } from "@/types/LocalizedString";

export default function Portfolio() {
  const t = useTranslations("home");
  const [galleryMode, setGalleryMode] = useState<'columns' | 'list'>('columns');
  const [isShowingGallery, setShowingGallery] = useState(true);
  const galleryTimeout = useRef<NodeJS.Timeout | null>(null);
  const [resizeCount, doResizeCount] = useState(0);
  const locale = useLocale() as keyof LocalizedString;
  const { profile } = useProfile();
  
  // Update document title
  useEffect(() => {
    const name = profile?.name[locale] || profile?.name?.en;
    if (typeof document !== 'undefined') {
      document.title = `Slatefolio${name ? ` - ${name}` : ''}`;
    }
  }, [profile, locale]);

  useHoveredOnTouch();

  const toggleGalleryMode = () => {
    setShowingGallery(false);

    if (galleryTimeout.current) clearTimeout(galleryTimeout.current);
    galleryTimeout.current = setTimeout(() => {
      if (galleryMode === 'columns') {
        setGalleryMode('list');
      } else {
        setGalleryMode('columns');
      }
      setShowingGallery(true);
      setTimeout(() => doResizeCount(prev => prev + 1), 0);
    }, 700);
  }

  return (
    <div className={`${styles.content} relative bg-white`}>
      <div className={`${styles.anchor} absolute -top-[60px]`} id="content"></div>
      <div className="w-[100%] mx-auto py-[30px] px-[10px] md:px-[30px] lg:px-[50px]">
        <Heading>
          <span>{t("myWork")}</span>

          <div className={`${styles.toggle} ${isShowingGallery ? styles.show : ""} ${galleryMode === 'columns' ? styles.columns : styles.list}`} onClick={toggleGalleryMode}>
            <div className={`${styles.icon} ${styles.columns}`}>
              <div className={styles.symbol}></div>
            </div>
            <div className={`${styles.icon} ${styles.list}`}>
              <div className={styles.symbol}></div>
            </div>
          </div>
        </Heading>

        <ProjectGallery
          galleryMode={galleryMode}
          isShowingGallery={isShowingGallery}
          resizeCount={resizeCount}
        />
      </div>
    </div>
  );
}
