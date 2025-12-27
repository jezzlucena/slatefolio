import { Request, Response } from 'express';
import Profile from '../models/Profile';
import Project from '../models/Project';

/**
 * Get autocomplete suggestions from:
 * - Profile keywords
 * - Project platforms (all projects)
 * - Project tech stack (all projects)
 * 
 * Optional query param `q` to filter results
 */
export const getSuggestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = (req.query.q as string || '').toLowerCase().trim();
    const suggestions = new Set<string>();

    // Get existing profile keywords
    const profile = await Profile.findOne();
    if (profile?.keywords) {
      profile.keywords.forEach((keyword) => suggestions.add(keyword));
    }

    // Get all projects
    const projects = await Project.find();

    for (const project of projects) {
      // Add platforms
      if (project.platforms) {
        project.platforms.forEach((platform) => suggestions.add(platform));
      }

      // Add stack items
      if (project.stack) {
        project.stack.forEach((tech) => suggestions.add(tech));
      }
    }

    // Convert to sorted array
    let sortedSuggestions = Array.from(suggestions).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    // Filter by query if provided
    if (query) {
      sortedSuggestions = sortedSuggestions.filter((s) =>
        s.toLowerCase().includes(query)
      );
    }

    res.json({ suggestions: sortedSuggestions });
  } catch (error) {
    console.error('Error fetching autocomplete suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
};

export default {
  getSuggestions,
};

