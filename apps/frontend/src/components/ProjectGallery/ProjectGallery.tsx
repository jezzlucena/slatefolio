'use client'

import { useCallback, useEffect, useState } from 'react';
import useWindowScroll from '@/hooks/useWindowScroll';
import type { Project } from '@/types/Project';
import { debounce } from 'lodash';
// import useEventListener from '../hooks/useEventListener';
import styles from './ProjectGallery.module.scss'
import GalleryItem from './GalleryItem';

// Project with key included (from API response)
export interface ProjectWithKey extends Project {
  key: string;
  _id?: string;
}

interface ProjectGalleryProps {
  galleryMode: 'columns' | 'list',
  isShowingGallery: boolean,
  resizeCount: number
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

export default function ProjectGallery({ galleryMode, isShowingGallery, resizeCount }: ProjectGalleryProps) {
  const { scrollY } = useWindowScroll();
  const [isMasonryActive, setMasonryActive] = useState(false);
  const [projects, setProjects] = useState<ProjectWithKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch projects from API
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch(`${API_URL}/projects`);
        if (!response.ok) {
          throw new Error('Failed to fetch projects');
        }
        const data = await response.json();
        setProjects(data.projects);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError('Failed to load projects');
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const getColumns = useCallback((numColumns: number) => {
    const colArrays: string[][] = Array.from({ length: numColumns }, () => []);
    let columnIndex = 0;

    for (const project of projects) {
      colArrays[columnIndex].push(project.key);
      columnIndex = (columnIndex + 1) % numColumns;
    }

    return colArrays;
  }, [projects]);

  const [columns, setColumns] = useState<string[][]>([]);

  // Create a map for quick project lookup by key
  const projectsMap = projects.reduce((acc, project) => {
    acc[project.key] = project;
    return acc;
  }, {} as Record<string, ProjectWithKey>);

  const handleMasonryLayout = () => {
    if (typeof window === 'undefined') return;

    const galleryBox = document.querySelector('.gallery')?.getBoundingClientRect();
    document.querySelectorAll('.column .item').forEach(item => {
      const masonryItem = document.querySelector(`.masonryItem[data-key=${item.getAttribute('data-key')}]`);
      const itemBox = item.getBoundingClientRect();
      const roundedBox = {
        height: Math.round(itemBox.height * 10) / 10,
        width: Math.round(itemBox.width * 10) / 10,
        x: Math.round((itemBox.x - (galleryBox?.left || 0)) * 10) / 10,
        y: Math.round((itemBox.y - (galleryBox?.top || 0 + scrollY)) * 10) / 10,
      }
      masonryItem?.setAttribute('style', `height: ${roundedBox.height}px; width: ${roundedBox.width}px; transform: translate(${roundedBox.x}px, ${roundedBox.y}px)`);
    });
    setMasonryActive(true);
  }

  const handleWindowResize = debounce(() => {
    let numColumns: number;

    if (galleryMode === 'list') {
      numColumns = 1;
    } else if (typeof window === 'undefined' || window.innerWidth >= 1280) { // xl
      numColumns = 5;
    } else if (window.innerWidth >= 1024) { // lg
      numColumns = 4;
    } else if (window.innerWidth >= 768) { // md
      numColumns = 3;
    } else if (window.innerWidth >= 393) { // iPhone 14 Pro viewport dimensions
      numColumns = 2;
    } else { // xs and lower
      numColumns = 1;
    }

    setColumns(getColumns(numColumns));

    setTimeout(handleMasonryLayout, 0);
  }, 100);

  // Re-calculate columns when projects are loaded
  useEffect(() => {
    if (projects.length > 0) {
      handleWindowResize();
    }
  }, [projects, handleWindowResize]);

  useEffect(() => {
    handleWindowResize()
  }, [resizeCount, handleWindowResize]);

  useEffect(() => {
    handleWindowResize();
  });

  // useEventListener('resize', handleWindowResize);

  if (isLoading) {
    return (
      <div className={`gallery relative ${styles.gallery} ${styles.loading}`}>
        <div className={styles.loadingIndicator}>Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`gallery relative ${styles.gallery} ${styles.error}`}>
        <div className={styles.errorMessage}>{error}</div>
      </div>
    );
  }

  return (
    <div
      className={`gallery relative ${styles.gallery} ${isShowingGallery ? styles.show : ""} ${galleryMode === 'columns' ? styles.column : styles.list} ${isMasonryActive ? styles.masonryActive : ""}`}
    >
      {columns.map((projectKeys, index) => (
        <div className={`column ${styles.column}`} key={index}>
          <div className={styles.layoutItem}>
            {projectKeys.map(key => projectsMap[key] && (
              <GalleryItem
                project={projectsMap[key]}
                key={key}
                projectKey={key}
                galleryMode={galleryMode}
              />
            ))}
          </div>
        </div>
      ))}
      {projects.map(project => (
        <div
          className={`absolute top-0 left-0 masonryItem ${styles.masonryItem}`}
          data-key={project.key}
          key={project.key}
        >
          <GalleryItem
            project={project}
            projectKey={project.key}
            galleryMode={galleryMode}
          />
        </div>
      ))}
    </div>
  )
}