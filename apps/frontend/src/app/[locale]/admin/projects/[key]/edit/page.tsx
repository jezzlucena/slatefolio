'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import ProjectForm from '@/components/admin/ProjectForm';
import styles from '../../Projects.module.scss';

interface LocalizedString {
  en: string;
  es: string;
  pt: string;
}

interface Project {
  _id: string;
  key: string;
  name: LocalizedString;
  description: LocalizedString;
  company: LocalizedString;
  role: LocalizedString;
  year: number;
  platforms: string[];
  stack: string[];
  thumbImgUrl: string;
  thumbAspectRatio?: number;
  thumbVideoUrl?: string;
  thumbGifUrl?: string;
  behanceUrl?: string;
  videoUrl?: string;
  githubUrl?: string;
  liveDemoUrl?: string;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

export default function EditProjectPage() {
  const { isLoading: authLoading, isLoggedIn } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectKey = params.key as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`${API_URL}/projects/${projectKey}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Project not found');
        }

        const data = await response.json();
        setProject(data.project);
      } catch (err) {
        console.error('Error fetching project:', err);
        setError('Failed to load project');
      } finally {
        setIsLoading(false);
      }
    };

    if (isLoggedIn && projectKey) {
      fetchProject();
    }
  }, [isLoggedIn, projectKey]);

  const handleSubmit = async (projectData: Record<string, unknown>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/admin/projects/${projectKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update project');
      }

      router.push('/admin/projects');
    } catch (err) {
      console.error('Error updating project:', err);
      setError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Access Denied</h1>
          <p>Please log in to access the admin panel.</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Project Not Found</h1>
          <p>The project you are looking for does not exist.</p>
          <Link href="/admin/projects" className={styles.backLink}>
            ← Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/admin/projects" className={styles.backLink}>
            ← Back to Projects
          </Link>
          <h1 className={styles.title}>Edit: {project.name.en}</h1>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <ProjectForm
        initialData={project}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        isEditMode
      />
    </div>
  );
}

