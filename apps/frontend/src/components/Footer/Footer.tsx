'use client';

import Link from "next/link";
import styles from "./Footer.module.scss"
import Button from "../Button/Button";
import { useLocale, useTranslations } from "next-intl";
import { useProfile } from "@/stores/profileStore";
import { useActiveResume } from "@/stores/resumeStore";
import { useSiteMeta } from "@/stores/siteMetaStore";

/**
 * Component that displays the footer, to be imported in every page
 */
export default function Footer() {
  const t = useTranslations();
  const locale = useLocale();
  const { profile } = useProfile();
  const { resume } = useActiveResume();
  const { lastUpdated } = useSiteMeta();

  return (
    <div className={styles.footer}>
      <div className={styles.buttonAreaWrapper}>
        <div className={styles.buttonArea}>
          {profile?.linkedinUrl && (
            <Link href={profile?.linkedinUrl} target="_blank">
              <Button theme="light" className={ styles.button }>{t("footer.linkedIn")}</Button>
            </Link>
          )}
          {profile?.githubUrl && (
            <Link href={profile?.githubUrl} target="_blank">
              <Button theme="light" className={ styles.button }>{t("footer.gitHub")}</Button>
            </Link>
          )}
          {resume && (
            <Link href="/resume#content">
              <Button theme="light" className={ styles.button }>{t("common.resume")}</Button>
            </Link>
          )}
          {process.env.NEXT_PUBLIC_SMTP_ENABLED === 'true' && (
            <Link href="/contact#content">
              <Button theme="light" className={ styles.button }>{t("common.contact")}</Button>
            </Link>
          )}

          <br/>
          <br/>

          {profile?.email && (
            <div className={styles.emailText}>
              {t("footer.orDirectly")} <b><u><a href={`mailto:${profile?.email}`}>{profile?.email}</a></u></b>
            </div>
          )}
        </div>
      </div>

      <div className={styles.disclaimer}>
        {t("footer.creativeCommons")}<br/>
        {lastUpdated && (
          <>
            {t("footer.lastUpdated")} {lastUpdated.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}.{' '}
          </>
        )}
        <a target="_blank" href="http://creativecommons.org/licenses/by-nc-sa/2.0/">{t("footer.someRightsReserved")}</a>.<br/>
      </div>
    </div>
  )
}