'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProjectForm from '@/components/admin/ProjectForm';
import styles from '../Projects.module.scss';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

export default function NewProjectPage() {
  const { isLoading: authLoading, isLoggedIn } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (projectData: Record<string, unknown>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/admin/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create project');
      }

      router.push('/admin/projects');
    } catch (err) {
      console.error('Error creating project:', err);
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/admin/projects" className={styles.backLink}>
            ← Back to Projects
          </Link>
          <h1 className={styles.title}>New Project</h1>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <ProjectForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}

