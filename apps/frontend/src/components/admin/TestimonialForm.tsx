'use client';

import { useState } from 'react';
import styles from './TestimonialForm.module.scss';

interface LocalizedString {
  en: string;
  es: string;
  pt: string;
}

interface TestimonialData {
  key: string;
  author: string;
  url: string;
  quote: LocalizedString;
  role?: LocalizedString;
  connection: LocalizedString;
}

interface TestimonialFormProps {
  initialData?: Partial<TestimonialData>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
  isEditMode?: boolean;
}

const emptyLocalizedString = (): LocalizedString => ({
  en: '',
  es: '',
  pt: '',
});

const LANGUAGES = ['en', 'es', 'pt'] as const;
const LANGUAGE_LABELS = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
};

export default function TestimonialForm({
  initialData,
  onSubmit,
  isSubmitting,
  isEditMode = false,
}: TestimonialFormProps) {
  const [activeTab, setActiveTab] = useState<'en' | 'es' | 'pt'>('en');
  const [formData, setFormData] = useState<TestimonialData>({
    key: initialData?.key || '',
    author: initialData?.author || '',
    url: initialData?.url || '',
    quote: initialData?.quote || emptyLocalizedString(),
    role: initialData?.role || emptyLocalizedString(),
    connection: initialData?.connection || emptyLocalizedString(),
  });

  const handleLocalizedChange = (
    field: 'quote' | 'role' | 'connection',
    lang: keyof LocalizedString,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [lang]: value,
      },
    }));
  };

  const handleChange = (field: keyof TestimonialData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clean up role if all fields are empty
    const roleHasContent = formData.role && 
      (formData.role.en || formData.role.es || formData.role.pt);

    const submitData = {
      ...formData,
      role: roleHasContent ? formData.role : undefined,
    };

    await onSubmit(submitData);
  };

  const isTabComplete = (lang: keyof LocalizedString) => {
    return (
      formData.quote[lang]?.trim() !== '' &&
      formData.connection[lang]?.trim() !== ''
    );
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Basic Information</h2>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Testimonial Key (URL slug)</label>
          <input
            type="text"
            value={formData.key}
            onChange={(e) =>
              handleChange(
                'key',
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
              )
            }
            className={styles.input}
            placeholder="e.g., john-doe"
            disabled={isEditMode}
            required
          />
          {isEditMode && (
            <p className={styles.hint}>Testimonial key cannot be changed</p>
          )}
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Author Name</label>
          <input
            type="text"
            value={formData.author}
            onChange={(e) => handleChange('author', e.target.value)}
            className={styles.input}
            placeholder="e.g., John Doe"
            required
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Author URL (LinkedIn, Website, etc.)</label>
          <input
            type="url"
            value={formData.url}
            onChange={(e) => handleChange('url', e.target.value)}
            className={styles.input}
            placeholder="https://linkedin.com/in/johndoe"
            required
          />
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Localized Content</h2>
        <p className={styles.sectionDescription}>
          Fill in the content for each language. Switch between tabs to enter translations.
        </p>

        <div className={styles.tabs}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              className={`${styles.tab} ${activeTab === lang ? styles.activeTab : ''} ${isTabComplete(lang) ? styles.completeTab : ''}`}
              onClick={() => setActiveTab(lang)}
            >
              {LANGUAGE_LABELS[lang]}
              {isTabComplete(lang) && <span className={styles.checkmark}>✓</span>}
            </button>
          ))}
        </div>

        <div className={styles.tabContent}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Quote <span className={styles.langBadge}>{activeTab.toUpperCase()}</span>
            </label>
            <textarea
              value={formData.quote[activeTab]}
              onChange={(e) => handleLocalizedChange('quote', activeTab, e.target.value)}
              className={styles.textarea}
              rows={4}
              placeholder={`Enter the testimonial quote in ${LANGUAGE_LABELS[activeTab]}...`}
              required={activeTab === 'en'}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Role <span className={styles.langBadge}>{activeTab.toUpperCase()}</span>
              <span className={styles.optional}>(optional)</span>
            </label>
            <input
              type="text"
              value={formData.role?.[activeTab] || ''}
              onChange={(e) => handleLocalizedChange('role', activeTab, e.target.value)}
              className={styles.input}
              placeholder={`e.g., Senior Developer at TechCorp`}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Connection <span className={styles.langBadge}>{activeTab.toUpperCase()}</span>
            </label>
            <input
              type="text"
              value={formData.connection[activeTab]}
              onChange={(e) => handleLocalizedChange('connection', activeTab, e.target.value)}
              className={styles.input}
              placeholder={`e.g., Worked together at XYZ Company`}
              required={activeTab === 'en'}
            />
          </div>
        </div>

        <div className={styles.translationStatus}>
          {LANGUAGES.map((lang) => (
            <div
              key={lang}
              className={`${styles.statusItem} ${isTabComplete(lang) ? styles.complete : styles.incomplete}`}
            >
              <span className={styles.statusLang}>{lang.toUpperCase()}</span>
              <span className={styles.statusText}>
                {isTabComplete(lang) ? 'Complete' : 'Incomplete'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={isSubmitting || !LANGUAGES.every(isTabComplete)}
        >
          {isSubmitting
            ? 'Saving...'
            : isEditMode
            ? 'Update Testimonial'
            : 'Create Testimonial'}
        </button>
        {!LANGUAGES.every(isTabComplete) && (
          <p className={styles.warning}>
            Please complete all required fields in all languages before submitting.
          </p>
        )}
      </div>
    </form>
  );
}

