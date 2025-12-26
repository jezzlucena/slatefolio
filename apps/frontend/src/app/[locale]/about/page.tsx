'use client'

import { useEffect, useState } from "react"
import styles from "./About.module.scss"
import Link from "next/link";
import { PROFILE_KEYWORDS } from "@/utils/constants";
import Button from "@/components/Button/Button";
import Heading from "@/components/Heading/Heading";
import Keywords from "@/components/Keywords/Keywords";
import Testimonial from "@/components/Testimonial/Testimonial";
import { useTranslations } from "next-intl";

/**
 * Page that displays details about Jezz's career, including testimonials from former
 * coworkers and academic partners
 */
export default function About() {
  const t = useTranslations("about");
  const commonT = useTranslations("common");
  const [isTextCollapsed, setTextCollapsed] = useState(true);
  
  useEffect(() => {
    if (typeof document !== 'undefined') document.title = `${commonT("about")} - ${commonT("jezzLucena")}`;
  });

  return (
    <div className={`${styles.content} relative bg-white`}>
      <div className={`${styles.anchor} absolute -top-[60px]`} id="content"></div>
        <div className="w-[100%] mx-auto py-[30px] px-[20px] md:px-[30px] lg:px-[50px]">
          <div className={`${styles.aboutContainer}`}>
            <div className={`${styles.description}`}>
              <Link className={`${styles.profilePicture}`} target="_blank" href="http://linkedin.com/in/jezzlucena" />
              <Link target="_blank" href="http://linkedin.com/in/jezzlucena">
                <div className={`${styles.profileName}`}>{commonT("jezzLucena")}</div>
                <div className={`${styles.profileTitle}`}>{commonT("fullStackEngineer")}</div>
              </Link>
              
              <Keywords label="Keywords" keywords={PROFILE_KEYWORDS} />
            </div>
          </div>
          <div className={`${styles.textContainer} relative ${isTextCollapsed ? styles.collapsed : "" }`}>
            <p className={styles.paragraph}>{t("blurb.p0")}</p>
            <p className={styles.paragraph}>{t("blurb.p1")}</p>
            <p className={styles.paragraph}>{t("blurb.p2")}</p>

            <div className={`${styles.readMoreContainer}`}>
              <Button
                className={ styles.button }
                onClick={() => setTextCollapsed(!isTextCollapsed)}
              >{isTextCollapsed ? t("readMore") : t("collapse")}</Button>
            </div>
          </div>
          <div style={{ clear: "both" }}></div>
        </div>

        <div className={ styles.testimonials }>
          <Heading>{t("testimonials.title")}</Heading>

          <div className={styles.container}>
            <Testimonial
              href={t("testimonials.chris.link")}
              author={t("testimonials.chris.author")}
              role={t("testimonials.chris.role")}
              connection={t("testimonials.chris.connection")}
            >
              <p className={styles.paragraph}>{t("testimonials.chris.quote")}</p>
            </Testimonial>

            <Testimonial
              href={t("testimonials.klew.link")}
              author={t("testimonials.klew.author")}
              role={t("testimonials.klew.role")}
              connection={t("testimonials.klew.connection")}
            >
              <p className={styles.paragraph}>{t("testimonials.klew.quote1")}</p>
              <p className={styles.paragraph}>{t("testimonials.klew.quote2")}</p>
              <p className={styles.paragraph}>{t("testimonials.klew.quote3")}</p>
            </Testimonial>

            <Testimonial
              href={t("testimonials.chaima.link")}
              author={t("testimonials.chaima.author")}
              role={t("testimonials.chaima.role")}
              connection={t("testimonials.chaima.connection")}
            >
              <p className={styles.paragraph}>{t("testimonials.chaima.quote")}</p>
            </Testimonial>
          </div>
      </div>
    </div>
  );
}
