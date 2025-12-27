'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Heading from "@/components/Heading/Heading";
import Link from "next/link";
import Image from "next/image";
import styles from "./Resume.module.scss";

interface Resume {
  _id: string;
  filename: string;
  originalName: string;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

/**
 * Page that displays an embedded resumé, with a link for download 
 */
export default function Resume() {
  const t = useTranslations("common");
  const [resume, setResume] = useState<Resume | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${t("resume")} - ${t("jezzLucena")}`;
    }
  }, [t]);

  useEffect(() => {
    const fetchActiveResume = async () => {
      try {
        const response = await fetch(`${API_URL}/resume/active`);
        if (response.ok) {
          const data = await response.json();
          setResume(data.resume);
        } else if (response.status === 404) {
          setError('No resume available');
        } else {
          throw new Error('Failed to fetch resume');
        }
      } catch (err) {
        console.error('Error fetching resume:', err);
        setError('Failed to load resume');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveResume();
  }, []);

  const resumeFileUrl = resume ? `${API_URL}/resume/file/${resume._id}` : null;

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
