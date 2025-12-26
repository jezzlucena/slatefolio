import type { Project } from '@/types/Project';
import type { LocalizedString } from '@/types/LocalizedString';
import { notFound } from 'next/navigation';
import styles from "./Project.module.scss"
import Heading from '@/components/Heading/Heading';
import Image from 'next/image';
import Keywords from '@/components/Keywords/Keywords';
import Link from 'next/link';
import Button from '@/components/Button/Button';
import { getTranslations } from 'next-intl/server';

// Use internal Docker network URL for server-side requests, fallback to localhost for local dev
const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

// Fetch project from API
async function getProject(key: string): Promise<Project | null> {
  try {
    const response = await fetch(`${API_URL}/projects/${key}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.project;
  } catch (error) {
    console.error('Error fetching project:', error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string; locale: string }>
}) {
  const t = await getTranslations();
  const { key, locale } = await params;
  const project = await getProject(key);
  const lang = locale as keyof LocalizedString;

  if (project) return { title: `${project.name[lang]} - ${t("common.jezzLucena")}` };
}

/**
 * Page that displays an individual detailed project
 */
export default async function Project({
  params,
}: {
  params: Promise<{ key: string; locale: string }>
}) {
  const t = await getTranslations();
  const { key, locale } = await params;
  const project = await getProject(key);
  const lang = locale as keyof LocalizedString;

  if (!project) {
    notFound();
  }

  return (
    <div className={`${styles.content} bg-white relative`}>
      <div className={`${styles.anchor} absolute -top-[60px]`} id="content"></div>

      <div className={`${styles.project} w-[100%] mx-auto py-[70px] px-[50px]`}>
        <div className={styles.textContainer}>
          <Heading>{ project.name[lang] }</Heading>

          {project.thumbVideoUrl ? (
            <div className={`${styles.projectPicture} max-w-[900px] mx-auto`}>
              <video className={styles.profileVideoBackground} src={project.thumbVideoUrl} autoPlay muted playsInline loop></video>
              <video className={styles.profileVideo} src={project.thumbVideoUrl} autoPlay muted playsInline loop></video>
            </div>
          ) : (
            <Image src={project.thumbImgUrl} width={0} height={0} unoptimized className={`${styles.projectPicture} max-w-[900px] mx-auto`} alt="Project Preview Image"/>
          )}
          
          <div className={`${styles.description} max-w-[900px] mx-auto`}>
            <div className={styles.projectName}>
              <span className={styles.label}>{t("projects.project")}</span>
              { project.description[lang] }
            </div>
            <div className={styles.projectCompany}>
              <span className={styles.label}>{t("projects.company")}</span>
              { project.company[lang] }
            </div>
            <div className={styles.projectYear}>
              <span className={styles.label}>{t("projects.shipped")}</span>
              { project.year }
            </div>
            <div className={styles.projectRole}>
              <span className={styles.label}>{t("projects.role")}</span>
              { project.role[lang] }
            </div>

            <br/>

            <Keywords label="Stack" keywords={project.stack} />
            <br/>

            <Keywords label="Platforms" keywords={project.platforms} />
            <br/>

            <div className={styles.projectButtons}>
              <span className={styles.label}>{t("projects.related")}</span>
              {project.liveDemoUrl && (
                <Link
                  href={project.liveDemoUrl}
                  target="_blank"
                >
                  <Button className={styles.button}>{t("projects.tryLiveDemo")}</Button>
                </Link>
              )}
              {project.videoUrl && (
                <Link
                  href={project.videoUrl}
                  target="_blank"
                >
                  <Button className={styles.button}>{t("projects.watchVideo")}</Button>
                </Link>
              )}
              {project.behanceUrl && (
                <Link
                  href={project.behanceUrl}
                  target="_blank"
                >
                  <Button className={styles.button}>{t("projects.onBehance")}</Button>
                </Link>
              )}
              {project.githubUrl && (
                <Link
                  href={project.githubUrl}
                  target="_blank"
                >
                  <Button className={styles.button}>{t("projects.onGitHub")}</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
