import { Request, Response } from 'express';
import Project from '../models/Project';
import { AuthRequest } from '../middleware/auth';

// Get all projects (public)
export const getAllProjects = async (_req: Request, res: Response): Promise<void> => {
  try {
    const projects = await Project.find().sort({ year: -1 });
    res.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

// Get single project by key (public)
export const getProjectByKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const project = await Project.findOne({ key });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

// Create a new project (admin only)
export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectData = req.body;

    // Validate required fields
    if (!projectData.key) {
      res.status(400).json({ error: 'Project key is required' });
      return;
    }

    // Check if key already exists
    const existingProject = await Project.findOne({ key: projectData.key });
    if (existingProject) {
      res.status(400).json({ error: 'Project with this key already exists' });
      return;
    }

    // Validate localized strings
    const requiredLocalizedFields = ['name', 'description', 'company', 'role'];
    for (const field of requiredLocalizedFields) {
      if (!projectData[field] || !projectData[field].en || !projectData[field].es || !projectData[field].pt) {
        res.status(400).json({ error: `${field} must have en, es, and pt translations` });
        return;
      }
    }

    if (!projectData.year || !projectData.thumbImgUrl) {
      res.status(400).json({ error: 'Year and thumbnail image are required' });
      return;
    }

    const project = new Project(projectData);
    await project.save();

    res.status(201).json({ project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

// Update an existing project (admin only)
export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const updateData = req.body;

    // Don't allow changing the key via update
    if (updateData.key && updateData.key !== key) {
      res.status(400).json({ error: 'Cannot change project key' });
      return;
    }

    const project = await Project.findOneAndUpdate(
      { key },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

// Delete a project (admin only)
export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { key } = req.params;

    const project = await Project.findOneAndDelete({ key });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

export default {
  getAllProjects,
  getProjectByKey,
  createProject,
  updateProject,
  deleteProject,
};
