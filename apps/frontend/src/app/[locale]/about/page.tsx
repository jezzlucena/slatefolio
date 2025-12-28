'use client'

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import styles from "./About.module.scss"
import Link from "next/link";
import Button from "@/components/Button/Button";
import Heading from "@/components/Heading/Heading";
import Keywords from "@/components/Keywords/Keywords";
import Testimonial from "@/components/Testimonial/Testimonial";
import { useProfile } from "@/stores/profileStore";
import type { LocalizedString } from "@/types/LocalizedString";

interface TestimonialData {
  _id: string;
  key: string;
  author: string;
  url: string;
  quote: LocalizedString;
  role?: LocalizedString;
  connection: LocalizedString;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

/**
 * Page that displays details about your career, including testimonials
 * from former coworkers and academic partners
 */
export default function About() {
  const t = useTranslations("about");
  const commonT = useTranslations("common");
  const locale = useLocale() as keyof LocalizedString;
  const { profile, isLoading: isLoadingProfile } = useProfile();
  const [isTextCollapsed, setTextCollapsed] = useState(true);
  const [testimonials, setTestimonials] = useState<TestimonialData[]>([]);
  const [isLoadingTestimonials, setIsLoadingTestimonials] = useState(true);

  // Fetch testimonials
  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const response = await fetch(`${API_URL}/testimonials`);
        if (response.ok) {
          const data = await response.json();
          setTestimonials(data.testimonials || []);
        }
      } catch (error) {
        console.error('Error fetching testimonials:', error);
      } finally {
        setIsLoadingTestimonials(false);
      }
    };

    fetchTestimonials();
  }, []);

  // Update document title
  useEffect(() => {
    const name = profile?.name[locale] || profile?.name?.en;
    if (typeof document !== 'undefined') {
      document.title = `${commonT("about")}${name ? ` - ${name}` : ''}`;
    }
  }, [profile, locale, commonT]);

  // Get localized content with fallback
  const getName = () => profile?.name[locale] || profile?.name.en;
  const getRole = () => profile?.role[locale] || profile?.role.en;
  const getBlurb = () => profile?.blurb[locale] || profile?.blurb.en || '';
  const getKeywords = () => profile?.keywords || [];
  const getLinkedInUrl = () => profile?.linkedinUrl || 'http://linkedin.com/';
  const getProfileImageUrl = () => profile?.profileImageUrl ? `${API_URL}${profile.profileImageUrl}` : null;

  return (
    <div className={`${styles.content} relative bg-white`}>
      <div className={`${styles.anchor} absolute -top-[60px]`} id="content"></div>
        <div className="w-[100%] mx-auto py-[30px] px-[20px] md:px-[30px] lg:px-[50px]">
          {isLoadingProfile ? (
            <div className={styles.loadingProfile}>Loading profile...</div>
          ) : (
            <>
              <div className={`${styles.aboutContainer}`}>
                <div className={`${styles.description}`}>
                  <Link 
                    className={`${styles.profilePicture} ${!getProfileImageUrl() ? styles.noImage : ''}`} 
                    target="_blank" 
                    href={getLinkedInUrl()}
                    style={getProfileImageUrl() ? { backgroundImage: `url('${getProfileImageUrl()}')` } : undefined}
                  >
                    {!getProfileImageUrl() && (
                      <svg
                        className={styles.silhouette}
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    )}
                  </Link>
                  <Link target="_blank" href={getLinkedInUrl()}>
                    <div className={`${styles.profileName}`}>{getName()}</div>
                    <div className={`${styles.profileTitle}`}>{getRole()}</div>
                  </Link>
                  
                  {getKeywords().length > 0 && (
                    <Keywords label="Keywords" keywords={getKeywords()} />
                  )}
                </div>
              </div>
              {getBlurb() && (
                <div className={`${styles.textContainer} relative ${isTextCollapsed ? styles.collapsed : "" }`}>
                  <div className={styles.blurbContent}>
                    <ReactMarkdown>{getBlurb()}</ReactMarkdown>
                  </div>

                  <div className={`${styles.readMoreContainer}`}>
                    <Button
                      className={ styles.button }
                      onClick={() => setTextCollapsed(!isTextCollapsed)}
                    >{isTextCollapsed ? t("readMore") : t("collapse")}</Button>
                  </div>
                </div>
              )}
            </>
          )}
          <div style={{ clear: "both" }}></div>
        </div>

        <div className={ styles.testimonials }>
          <Heading>{t("testimonials.title")}</Heading>

          <div className={styles.container}>
            {isLoadingTestimonials ? (
              <p className={styles.loading}>Loading testimonials...</p>
            ) : testimonials.length === 0 ? (
              <p className={styles.noTestimonials}>No testimonials available.</p>
            ) : (
              testimonials.map((testimonial) => (
                <Testimonial
                  key={testimonial._id}
                  href={testimonial.url}
                  author={testimonial.author}
                  role={testimonial.role?.[locale] || testimonial.role?.en || ''}
                  connection={testimonial.connection[locale] || testimonial.connection.en}
                  quote={testimonial.quote[locale] || testimonial.quote.en}
                />
              ))
            )}
          </div>
      </div>
    </div>
  );
}
