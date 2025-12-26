'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import styles from './Projects.module.scss';

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
  createdAt: string;
  updatedAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

export default function AdminProjectsPage() {
  const { isLoading: authLoading, isLoggedIn } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      const response = await fetch(`${API_URL}/projects`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      setProjects(data.projects);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchProjects();
    }
  }, [isLoggedIn]);

  const handleDelete = async (key: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/projects/${key}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      setProjects(projects.filter(p => p.key !== key));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting project:', err);
      setError('Failed to delete project');
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
          <Link href="/admin" className={styles.backLink}>
            ← Back to Dashboard
          </Link>
          <h1 className={styles.title}>Manage Projects</h1>
        </div>
        <Link href="/admin/projects/new" className={styles.addButton}>
          + Add Project
        </Link>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {isLoading ? (
        <div className={styles.loading}>Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className={styles.empty}>
          <p>No projects found. Create your first project!</p>
          <Link href="/admin/projects/new" className={styles.addButton}>
            + Add Project
          </Link>
        </div>
      ) : (
        <div className={styles.projectList}>
          {projects.map((project) => (
            <div key={project._id} className={styles.projectItem}>
              <div className={styles.projectThumb}>
                <img src={project.thumbImgUrl} alt={project.name.en} />
              </div>
              <div className={styles.projectInfo}>
                <h3 className={styles.projectName}>{project.name.en}</h3>
                <p className={styles.projectMeta}>
                  {project.company.en} · {project.year}
                </p>
                <p className={styles.projectRole}>{project.role.en}</p>
              </div>
              <div className={styles.projectActions}>
                <Link
                  href={`/admin/projects/${project.key}/edit`}
                  className={styles.editButton}
                >
                  Edit
                </Link>
                {deleteConfirm === project.key ? (
                  <div className={styles.deleteConfirm}>
                    <span>Delete?</span>
                    <button
                      onClick={() => handleDelete(project.key)}
                      className={styles.confirmYes}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className={styles.confirmNo}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(project.key)}
                    className={styles.deleteButton}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

