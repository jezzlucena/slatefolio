'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Heading from "@/components/Heading/Heading";
import Link from "next/link";
import Image from "next/image";
import styles from "./Resume.module.scss";
import { useActiveResume } from "@/stores/resumeStore";

/**
 * Page that displays an embedded resumé, with a link for download 
 */
export default function Resume() {
  const t = useTranslations("common");
  const { resumeFileUrl, isLoading, error } = useActiveResume();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = t("resume");
    }
  }, [t]);

  return (
    <div className="relative bg-white">
      <div className="absolute -top-[60px]" id="content"></div>
      <div className="relative w-[100%] max-w-[1280px] mx-auto py-[30px] px-[20px] md:px-[30px] lg:px-[50px]">
        <Heading>
          <span>{t("resume")}</span>
          {resumeFileUrl && (
            <Link
              href={resumeFileUrl}
              target="_blank"
              download
            >
              <div className={styles.icon}>
                <Image src="/img/download.png" width={0} height={0} unoptimized className={styles.symbol} alt="Download Resumé" />
              </div>
            </Link>
          )}
        </Heading>

        {isLoading ? (
          <div className={styles.loading}>Loading resume...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : resumeFileUrl ? (
          <div className={`relative w-[100%] ${styles.pdfContainer}`}>
            <embed
              className="absolute top-0 left-0 w-[100%] h-[100%]"
              src={`${resumeFileUrl}#toolbar=1&navpanes=0&scrollbar=0&view=FitH`}
            />
          </div>
        ) : (
          <div className={styles.noResume}>No resume available</div>
        )}
      </div>
    </div>
  );
}
