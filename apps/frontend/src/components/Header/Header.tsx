import { useTranslations } from "next-intl";
import Logo from "../Logo/Logo";
import TopBar from "../TopBar/TopBar";
import styles from "./Header.module.scss"

export default function Header() {
  const t = useTranslations('common');

  return (
    <>
      <TopBar />

      <div className={`${styles.header} ${styles.fixed}`}>
        <Logo />
      </div>

      <div className={`${styles.header} ${styles.relative}`}>
        <div className={`${styles.text}`}>
          <span>{t("jezzLucena")}</span>
          <span className={`${styles.title}`}>{t("fullStackEngineer")}</span>
        </div>
      </div>
    </>
  );
}