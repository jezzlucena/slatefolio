'use client'

import { Ref, useEffect, useRef, useState } from 'react';
import type { Project } from '@/types/Project';
import type { LocalizedString } from '@/types/LocalizedString';
import useVisibility from '@/hooks/useVisibility';
import Link from 'next/link';
import styles from './GalleryItem.module.scss'
import Image from 'next/image';
import { useLocale } from 'next-intl';

interface GalleryItemProps {
  project: Project,
  projectKey: string,
  galleryMode: 'list' | 'columns'
}

/**
 * Component that displays a project in the gallery, considering different configurations
 * (e.g. List vs Columns)
 * 
 * @prop {Project} project Instance of the project to be displayed
 * @prop {string} projectKey Key of the currently displayed project, to be used for permalinking
 * @prop {'list' | 'column'} galleryMode Current mode of the gallery, influencing the configuration of the gallery item (e.g. List vs Columns)
 */
export default function GalleryItem({ project, projectKey, galleryMode }: GalleryItemProps) {
  const locale = useLocale() as keyof LocalizedString;
  const wrapper = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const playPromise = useRef<Promise<void>>(undefined);
  const [isVisible, currentElement] = useVisibility(100);
  const [isTriggered, setTriggered] = useState(false);

  useEffect(() => {
    setTriggered(isTriggered || isVisible);
  }, [isVisible, isTriggered, currentElement]);

  const playVideo = () => {
    playPromise.current = video.current?.play();
  }

  const pauseVideo = () => {
    playPromise.current?.then(() => {
      video.current?.pause();
    });
  }

  return (
    <Link
      ref={currentElement as unknown as Ref<HTMLAnchorElement> | undefined}
      href={`/projects/${projectKey}#content`}
      className={`item trigger mb-[10px] md:mb-[20px] ${styles.item} ${galleryMode === 'columns' ? styles.columns : styles.list} ${isTriggered ? styles.triggered : ""} ${(!project.thumbVideoUrl && !project.thumbGifUrl) ? styles.noVideo : ""}`}
      data-key={projectKey}
      onMouseEnter={playVideo}
      onMouseLeave={pauseVideo}
      onTouchStart={playVideo}
      onTouchMove={playVideo}
      onTouchEnd={pauseVideo}
    >
      <div className={styles.wrapper} ref={wrapper}>
        <div className={`${styles.thumbContainer} ${styles.loadingGradient}"`} style={{ paddingBottom: `${(project.thumbAspectRatio || 0.56) * 100}%` }}>
          {project.thumbVideoUrl && (
            <video ref={video} className={styles.thumbVideo} preload="none" poster={project.thumbImgUrl} muted playsInline loop src={project.thumbVideoUrl}></video>
          )}
          {!project.thumbVideoUrl && project.thumbGifUrl && (
            <Image className={styles.thumbVideo} width={0} height={0} unoptimized style={{ width: "100%", height: "100%" }} src={project.thumbGifUrl} alt="Project Preview" />
          )}
          <Image className={styles.thumb} width={0} height={0} unoptimized style={{ width: "100%", height: "100%" }} src={project.thumbImgUrl} alt="Project Image" />
        </div>

        <div className={styles.detailsContainer}>
          <div className={`${styles.name} ${styles.loadingGradient}`}>{project.name[locale]}</div>
          <div className={`${styles.subtitle} ${styles.loadingGradient}`}>
            <span className={styles.role}>{project.role[locale]}</span>
            <span className={styles.company}>{project.company[locale]}</span>
            <span className={styles.year}>{project.year}</span>
          </div>
          <div className={`${styles.description} ${styles.loadingGradient}`}>{project.description[locale]}</div>
        </div>
      </div>
    </Link>
  );
}