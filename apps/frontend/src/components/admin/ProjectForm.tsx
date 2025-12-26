'use client';

import { useState, useRef } from 'react';
import styles from './ProjectForm.module.scss';

interface LocalizedString {
  en: string;
  es: string;
  pt: string;
}

interface ProjectData {
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

interface ProjectFormProps {
  initialData?: Partial<ProjectData>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
  isEditMode?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

const emptyLocalizedString = (): LocalizedString => ({
  en: '',
  es: '',
  pt: '',
});

export default function ProjectForm({
  initialData,
  onSubmit,
  isSubmitting,
  isEditMode = false,
}: ProjectFormProps) {
  const [formData, setFormData] = useState<ProjectData>({
    key: initialData?.key || '',
    name: initialData?.name || emptyLocalizedString(),
    description: initialData?.description || emptyLocalizedString(),
    company: initialData?.company || emptyLocalizedString(),
    role: initialData?.role || emptyLocalizedString(),
    year: initialData?.year || new Date().getFullYear(),
    platforms: initialData?.platforms || [],
    stack: initialData?.stack || [],
    thumbImgUrl: initialData?.thumbImgUrl || '',
    thumbAspectRatio: initialData?.thumbAspectRatio,
    thumbVideoUrl: initialData?.thumbVideoUrl || '',
    thumbGifUrl: initialData?.thumbGifUrl || '',
    behanceUrl: initialData?.behanceUrl || '',
    videoUrl: initialData?.videoUrl || '',
    githubUrl: initialData?.githubUrl || '',
    liveDemoUrl: initialData?.liveDemoUrl || '',
  });

  const [platformsInput, setPlatformsInput] = useState(
    initialData?.platforms?.join(', ') || ''
  );
  const [stackInput, setStackInput] = useState(
    initialData?.stack?.join(', ') || ''
  );
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const thumbImgRef = useRef<HTMLInputElement>(null);
  const thumbVideoRef = useRef<HTMLInputElement>(null);
  const thumbGifRef = useRef<HTMLInputElement>(null);

  const handleLocalizedChange = (
    field: keyof Pick<ProjectData, 'name' | 'description' | 'company' | 'role'>,
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

  const handleChange = (
    field: keyof ProjectData,
    value: string | number | string[]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileUpload = async (
    file: File,
    field: 'thumbImgUrl' | 'thumbVideoUrl' | 'thumbGifUrl'
  ) => {
    setUploadingField(field);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/admin/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      setFormData((prev) => {
        const updates: Partial<ProjectData> = {
          [field]: data.url,
        };

        // Set aspect ratio for images
        if (field === 'thumbImgUrl' && data.aspectRatio) {
          updates.thumbAspectRatio = parseFloat(data.aspectRatio);
        }

        return { ...prev, ...updates };
      });
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(`Failed to upload ${field}`);
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Parse comma-separated arrays
    const platforms = platformsInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s);
    const stack = stackInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s);

    await onSubmit({
      ...formData,
      platforms,
      stack,
    });
  };

  const renderLocalizedInput = (
    field: keyof Pick<ProjectData, 'name' | 'description' | 'company' | 'role'>,
    label: string,
    isTextarea = false
  ) => (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>{label}</label>
      <div className={styles.localizedInputs}>
        {(['en', 'es', 'pt'] as const).map((lang) => (
          <div key={lang} className={styles.localizedField}>
            <span className={styles.langLabel}>{lang.toUpperCase()}</span>
            {isTextarea ? (
              <textarea
                value={formData[field][lang]}
                onChange={(e) =>
                  handleLocalizedChange(field, lang, e.target.value)
                }
                className={styles.textarea}
                rows={3}
                required
              />
            ) : (
              <input
                type="text"
                value={formData[field][lang]}
                onChange={(e) =>
                  handleLocalizedChange(field, lang, e.target.value)
                }
                className={styles.input}
                required
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderFileUpload = (
    field: 'thumbImgUrl' | 'thumbVideoUrl' | 'thumbGifUrl',
    label: string,
    accept: string,
    ref: React.RefObject<HTMLInputElement | null>
  ) => (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>{label}</label>
      <div className={styles.fileUpload}>
        {formData[field] && (
          <div className={styles.preview}>
            {field === 'thumbVideoUrl' ? (
              <video src={formData[field]} controls muted />
            ) : (
              <img src={formData[field]} alt="Preview" />
            )}
          </div>
        )}
        <div className={styles.uploadControls}>
          <input
            ref={ref}
            type="file"
            accept={accept}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, field);
            }}
            className={styles.fileInput}
          />
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className={styles.uploadButton}
            disabled={uploadingField === field}
          >
            {uploadingField === field ? 'Uploading...' : 'Choose File'}
          </button>
          {formData[field] && (
            <button
              type="button"
              onClick={() => handleChange(field, '')}
              className={styles.clearButton}
            >
              Clear
            </button>
          )}
        </div>
        <input
          type="text"
          value={formData[field] || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          placeholder="Or enter URL directly"
          className={styles.input}
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {uploadError && <div className={styles.error}>{uploadError}</div>}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Basic Information</h2>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Project Key (URL slug)</label>
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
            placeholder="e.g., my-awesome-project"
            disabled={isEditMode}
            required
          />
          {isEditMode && (
            <p className={styles.hint}>Project key cannot be changed</p>
          )}
        </div>

        {renderLocalizedInput('name', 'Project Name')}
        {renderLocalizedInput('description', 'Description', true)}
        {renderLocalizedInput('company', 'Company')}
        {renderLocalizedInput('role', 'Role')}

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Year</label>
          <input
            type="number"
            value={formData.year}
            onChange={(e) => handleChange('year', parseInt(e.target.value))}
            className={styles.input}
            min={1990}
            max={2100}
            required
          />
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Media</h2>

        {renderFileUpload(
          'thumbImgUrl',
          'Thumbnail Image *',
          'image/*',
          thumbImgRef
        )}
        {renderFileUpload(
          'thumbVideoUrl',
          'Preview Video (optional)',
          'video/*',
          thumbVideoRef
        )}
        {renderFileUpload(
          'thumbGifUrl',
          'Preview GIF (optional)',
          'image/gif',
          thumbGifRef
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Technical Details</h2>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Platforms (comma-separated)</label>
          <input
            type="text"
            value={platformsInput}
            onChange={(e) => setPlatformsInput(e.target.value)}
            className={styles.input}
            placeholder="e.g., Web, iOS, Android"
            required
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Tech Stack (comma-separated)</label>
          <input
            type="text"
            value={stackInput}
            onChange={(e) => setStackInput(e.target.value)}
            className={styles.input}
            placeholder="e.g., React, Node.js, MongoDB"
            required
          />
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>External Links (optional)</h2>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Live Demo URL</label>
          <input
            type="url"
            value={formData.liveDemoUrl}
            onChange={(e) => handleChange('liveDemoUrl', e.target.value)}
            className={styles.input}
            placeholder="https://..."
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>GitHub URL</label>
          <input
            type="url"
            value={formData.githubUrl}
            onChange={(e) => handleChange('githubUrl', e.target.value)}
            className={styles.input}
            placeholder="https://github.com/..."
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Behance URL</label>
          <input
            type="url"
            value={formData.behanceUrl}
            onChange={(e) => handleChange('behanceUrl', e.target.value)}
            className={styles.input}
            placeholder="https://behance.net/..."
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Video URL</label>
          <input
            type="url"
            value={formData.videoUrl}
            onChange={(e) => handleChange('videoUrl', e.target.value)}
            className={styles.input}
            placeholder="https://youtube.com/..."
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'Saving...'
            : isEditMode
            ? 'Update Project'
            : 'Create Project'}
        </button>
      </div>
    </form>
  );
}

