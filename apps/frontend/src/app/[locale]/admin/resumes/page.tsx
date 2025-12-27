'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import styles from './Resumes.module.scss';

interface Resume {
  _id: string;
  filename: string;
  originalName: string;
  storedName: string;
  size: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminResumesPage() {
  const { isLoading: authLoading, isLoggedIn } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchResumes = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/resumes`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch resumes');
      }

      const data = await response.json();
      setResumes(data.resumes);
    } catch (err) {
      console.error('Error fetching resumes:', err);
      setError('Failed to load resumes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchResumes();
    }
  }, [isLoggedIn]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/admin/resumes`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload resume');
      }

      const data = await response.json();
      setResumes([data.resume, ...resumes]);
      setSuccess('Resume uploaded successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error uploading resume:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload resume');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/resumes/${id}/activate`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to set active resume');
      }

      // Update local state
      setResumes(resumes.map(r => ({
        ...r,
        isActive: r._id === id,
      })));
      setSuccess('Active resume updated!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error setting active resume:', err);
      setError('Failed to set active resume');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/resumes/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete resume');
      }

      setResumes(resumes.filter(r => r._id !== id));
      setDeleteConfirm(null);
      setSuccess('Resume deleted!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting resume:', err);
      setError('Failed to delete resume');
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
          <h1 className={styles.title}>Manage Resumes</h1>
        </div>
        <div className={styles.uploadArea}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleUpload}
            className={styles.fileInput}
            id="resume-upload"
            disabled={isUploading}
          />
          <label htmlFor="resume-upload" className={styles.uploadButton}>
            {isUploading ? 'Uploading...' : '+ Upload PDF'}
          </label>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.info}>
        <p>Upload your resume as a PDF file. Set one resume as active to display it on the public resume page.</p>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Loading resumes...</div>
      ) : resumes.length === 0 ? (
        <div className={styles.empty}>
          <p>No resumes uploaded yet. Upload your first resume!</p>
        </div>
      ) : (
        <div className={styles.resumeList}>
          {resumes.map((resume) => (
            <div
              key={resume._id}
              className={`${styles.resumeItem} ${resume.isActive ? styles.active : ''}`}
            >
              <div className={styles.resumeInfo}>
                <div className={styles.resumeHeader}>
                  <h3 className={styles.resumeName}>{resume.filename}</h3>
                  {resume.isActive && (
                    <span className={styles.activeBadge}>Active</span>
                  )}
                </div>
                <p className={styles.resumeMeta}>
                  {resume.originalName} • {formatFileSize(resume.size)} • Uploaded {formatDate(resume.createdAt)}
                </p>
              </div>
              <div className={styles.resumeActions}>
                <a
                  href={`${API_URL}/resume/file/${resume._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.viewButton}
                >
                  View
                </a>
                {!resume.isActive && (
                  <button
                    onClick={() => handleSetActive(resume._id)}
                    className={styles.activateButton}
                  >
                    Set Active
                  </button>
                )}
                {deleteConfirm === resume._id ? (
                  <div className={styles.deleteConfirm}>
                    <span>Delete?</span>
                    <button
                      onClick={() => handleDelete(resume._id)}
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
                    onClick={() => setDeleteConfirm(resume._id)}
                    className={styles.deleteButton}
                    disabled={resume.isActive}
                    title={resume.isActive ? 'Cannot delete active resume' : 'Delete resume'}
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

