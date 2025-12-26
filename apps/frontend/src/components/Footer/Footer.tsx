import Link from "next/link";
import styles from "./Footer.module.scss"
import Button from "../Button/Button";
import { useTranslations } from "next-intl";

/**
 * Component that displays the footer, to be imported in every page
 */
export default function Footer() {
  const t = useTranslations();
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

  return (
    <div className={styles.footer}>
      <div className={styles.buttonAreaWrapper}>
        <div className={styles.buttonArea}>
          <Link href="https://linkedin.com/in/jezzlucena" target="_blank">
            <Button theme="light" className={ styles.button }>{t("footer.linkedIn")}</Button>
          </Link>
          <Link href="https://github.com/jezzlucena" target="_blank">
            <Button theme="light" className={ styles.button }>{t("footer.gitHub")}</Button>
          </Link>
          <Link href="/resume#content">
            <Button theme="light" className={ styles.button }>{t("common.resume")}</Button>
          </Link>
          <Link href="/contact#content">
            <Button theme="light" className={ styles.button }>{t("common.contact")}</Button>
          </Link>

          <br/>
          <br/>

          <div className={styles.emailText}>
            {t("footer.orDirectly")} <b><u><a href="mailto:jezzlucena@gmail.com">jezzlucena@gmail.com</a></u></b>
          </div>

          <br/>

          <Link href="https://jezzlucena.com">
            <Button theme="light" className={`${styles.button} ${styles.switch}`}>{t("common.switchToNuxt")}</Button>
          </Link>
        </div>
      </div>

      <div className={styles.disclaimer}>
        {t("footer.creativeCommons")}<br/>
        {t("footer.lastUpdated")} { (new Date(twoWeeksAgo)).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' }) }. <a target="_blank" href="http://creativecommons.org/licenses/by-nc-sa/2.0/">{t("footer.someRightsReserved")}</a>.<br/>
        Read our <Link href="/privacy#content">Privacy Policy.</Link> Use of this website or apps is subject to our <Link href="/terms#content">Terms and Conditions.</Link>
      </div>
    </div>
  )
}