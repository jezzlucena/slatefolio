import { create } from 'zustand';

export interface ResumeData {
  _id: string;
  filename: string;
  originalName: string;
}

interface ResumeState {
  resume: ResumeData | null;
  isLoading: boolean;
  error: string | null;
  hasFetched: boolean;
  fetchResume: () => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

export const useResumeStore = create<ResumeState>((set, get) => ({
  resume: null,
  isLoading: false,
  error: null,
  hasFetched: false,

  fetchResume: async () => {
    // If already fetched or currently fetching, don't fetch again
    if (get().hasFetched || get().isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_URL}/resume/active`);
      if (response.ok) {
        const data = await response.json();
        set({ 
          resume: data.resume || null, 
          isLoading: false,
          hasFetched: true 
        });
      } else if (response.status === 404) {
        set({ 
          resume: null,
          error: 'No resume available', 
          isLoading: false,
          hasFetched: true 
        });
      } else {
        set({ 
          error: 'Failed to fetch resume', 
          isLoading: false,
          hasFetched: true 
        });
      }
    } catch (error) {
      console.error('Error fetching resume:', error);
      set({ 
        error: 'Failed to load resume', 
        isLoading: false,
        hasFetched: true 
      });
    }
  },
}));

// Custom hook for easy usage with auto-fetch
export function useActiveResume() {
  const { resume, isLoading, error, fetchResume, hasFetched } = useResumeStore();

  // Trigger fetch on first use (will only fetch once due to hasFetched check)
  if (!hasFetched && !isLoading) {
    fetchResume();
  }

  const resumeFileUrl = resume ? `${API_URL}/resume/file/${resume._id}` : null;

  return { resume, resumeFileUrl, isLoading, error };
}

