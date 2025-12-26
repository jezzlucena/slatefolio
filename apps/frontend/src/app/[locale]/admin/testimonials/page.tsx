'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import styles from './Testimonials.module.scss';

interface LocalizedString {
  en: string;
  es: string;
  pt: string;
}

interface Testimonial {
  _id: string;
  key: string;
  author: string;
  url: string;
  quote: LocalizedString;
  role?: LocalizedString;
  connection: LocalizedString;
  createdAt: string;
  updatedAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

export default function AdminTestimonialsPage() {
  const { isLoading: authLoading, isLoggedIn } = useAuth();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchTestimonials = async () => {
    try {
      const response = await fetch(`${API_URL}/testimonials`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch testimonials');
      }

      const data = await response.json();
      setTestimonials(data.testimonials);
    } catch (err) {
      console.error('Error fetching testimonials:', err);
      setError('Failed to load testimonials');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchTestimonials();
    }
  }, [isLoggedIn]);

  const handleDelete = async (key: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/testimonials/${key}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete testimonial');
      }

      setTestimonials(testimonials.filter(t => t.key !== key));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting testimonial:', err);
      setError('Failed to delete testimonial');
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
          <h1 className={styles.title}>Manage Testimonials</h1>
        </div>
        <Link href="/admin/testimonials/new" className={styles.addButton}>
          + Add Testimonial
        </Link>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {isLoading ? (
        <div className={styles.loading}>Loading testimonials...</div>
      ) : testimonials.length === 0 ? (
        <div className={styles.empty}>
          <p>No testimonials found. Create your first testimonial!</p>
          <Link href="/admin/testimonials/new" className={styles.addButton}>
            + Add Testimonial
          </Link>
        </div>
      ) : (
        <div className={styles.testimonialList}>
          {testimonials.map((testimonial) => (
            <div key={testimonial._id} className={styles.testimonialItem}>
              <div className={styles.testimonialInfo}>
                <h3 className={styles.testimonialAuthor}>{testimonial.author}</h3>
                <p className={styles.testimonialRole}>
                  {testimonial.role?.en || testimonial.connection.en}
                </p>
                <p className={styles.testimonialQuote}>
                  &ldquo;{testimonial.quote.en.substring(0, 100)}...&rdquo;
                </p>
              </div>
              <div className={styles.testimonialActions}>
                <Link
                  href={`/admin/testimonials/${testimonial.key}/edit`}
                  className={styles.editButton}
                >
                  Edit
                </Link>
                {deleteConfirm === testimonial.key ? (
                  <div className={styles.deleteConfirm}>
                    <span>Delete?</span>
                    <button
                      onClick={() => handleDelete(testimonial.key)}
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
                    onClick={() => setDeleteConfirm(testimonial.key)}
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

