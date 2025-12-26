'use client'

import { useState } from "react";
import useWindowScroll from "../../hooks/useWindowScroll";
import { debounce } from "lodash";
import useEventListener from "../../hooks/useEventListener";
import styles from "./TobBar.module.scss"
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "../LocaleSwitcher/LocaleSwitcher";

/**
 * Top Bar used for navigation, to be imported on every page
 */
export default function TopBar() {
  const t = useTranslations("common");
  const { isScrolled } = useWindowScroll();
  const [isNavOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  const toggleNavOpen = () => {
    setNavOpen(!isNavOpen);
  }

  const handleWindowResize = debounce(() => {
    if (typeof window === 'undefined' || window.innerWidth > 768) {
      setNavOpen(false);
    }
  }, 500);

  useEventListener('resize', handleWindowResize);

  return (
    <>
      <div
        className={`${styles.topBarBg} ${isNavOpen ? styles.navOpen : ""}`}
        onClick={toggleNavOpen}
      ></div>
      <div
        className={`${styles.topBar} ${isScrolled ? styles.scrolled : ""} ${isNavOpen ? styles.navOpen : ""}`}
      >
        <div className="flex w-[100%] mx-auto lg:px-[50px] px-[10px]">
          <Link href="/" className={`${styles.logo} ${styles.link}`} onClick={() => setNavOpen(false)}>
            <Image
              src="/assets/img/logo.png"
              className="inline mr-3"
              height="40"
              width="40"
              alt="Jezz's Logo"
            />
            <span className={`${styles.name} pr-2`}>{t("jezzLucena")}</span>
            <span className={`${styles.title} pl-3`}>{t("fullStackEngineer")}</span>
          </Link>

          <div className="grow"></div>

          <div className={styles.hamburger} onClick={toggleNavOpen}>
            <div className={styles.line}></div>
            <div className={styles.line}></div>
            <div className={styles.line}></div>
          </div>

          <div className={styles.linksWrapper}>
            <Link 
              href="/about#content"
              className={`${styles.link} ${pathname.startsWith('/about') ? styles.routerLinkActive : ""}`}
              onClick={() => setNavOpen(false)}
            >{t("about")}</Link>
            <Link 
              href="/#content"
              className={`${styles.link} ${pathname.startsWith('/projects') || pathname === '/' ? styles.routerLinkActive : ""}`}
              onClick={() => setNavOpen(false)}
            >{t("portfolio")}</Link>
            <Link
              href="/resume#content"
              className={`${styles.link} ${pathname.startsWith('/resume') ? styles.routerLinkActive : ""}`}
              onClick={() => setNavOpen(false)}
            >{t("resume")}</Link>
            <Link
              href="/contact#content"
              className={`${styles.link} ${pathname.startsWith('/contact') ? styles.routerLinkActive : ""}`}
              onClick={() => setNavOpen(false)}
            >{t("contact")}</Link>
            <LocaleSwitcher />
          </div>
        </div>
      </div>
    </>
  );
}