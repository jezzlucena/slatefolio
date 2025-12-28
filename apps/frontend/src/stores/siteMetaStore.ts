import { create } from 'zustand';

interface SiteMetaState {
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;
  hasFetched: boolean;
  fetchSiteMeta: () => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

export const useSiteMetaStore = create<SiteMetaState>((set, get) => ({
  lastUpdated: null,
  isLoading: false,
  error: null,
  hasFetched: false,

  fetchSiteMeta: async () => {
    // If already fetched or currently fetching, don't fetch again
    if (get().hasFetched || get().isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_URL}/meta`);
      if (response.ok) {
        const data = await response.json();
        set({ 
          lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : null, 
          isLoading: false,
          hasFetched: true 
        });
      } else {
        set({ 
          error: 'Failed to fetch site metadata', 
          isLoading: false,
          hasFetched: true 
        });
      }
    } catch (error) {
      console.error('Error fetching site metadata:', error);
      set({ 
        error: 'Failed to fetch site metadata', 
        isLoading: false,
        hasFetched: true 
      });
    }
  },
}));

// Custom hook for easy usage with auto-fetch
export function useSiteMeta() {
  const { lastUpdated, isLoading, error, fetchSiteMeta, hasFetched } = useSiteMetaStore();

  // Trigger fetch on first use (will only fetch once due to hasFetched check)
  if (!hasFetched && !isLoading) {
    fetchSiteMeta();
  }

  return { lastUpdated, isLoading, error };
}

