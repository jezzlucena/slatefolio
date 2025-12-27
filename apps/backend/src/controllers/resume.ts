import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Resume from '../models/Resume';
import { AuthRequest } from '../middleware/auth';

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
const RESUMES_DIR = path.join(UPLOADS_DIR, 'resumes');

// Ensure resumes directory exists
if (!fs.existsSync(RESUMES_DIR)) {
  fs.mkdirSync(RESUMES_DIR, { recursive: true });
}

// Configure multer for PDF uploads only
const storage = multer.memoryStorage();

const pdfFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'));
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter: pdfFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max for resumes
  },
});

// Generate a hashed filename from ObjectId
function generateHashedFilename(id: mongoose.Types.ObjectId): string {
  const hash = crypto.createHash('sha256').update(id.toString()).digest('hex');
  return `${hash.substring(0, 16)}.pdf`;
}

// Get all resumes (admin)
export const getAllResumes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const resumes = await Resume.find().sort({ createdAt: -1 });
    res.json({ resumes });
  } catch (error) {
    console.error('Error fetching resumes:', error);
    res.status(500).json({ error: 'Failed to fetch resumes' });
  }
};

// Get active resume (public)
export const getActiveResume = async (_req: Request, res: Response): Promise<void> => {
  try {
    const resume = await Resume.findOne({ isActive: true });
    if (!resume) {
      res.status(404).json({ error: 'No active resume found' });
      return;
    }
    res.json({ resume });
  } catch (error) {
    console.error('Error fetching active resume:', error);
    res.status(500).json({ error: 'Failed to fetch active resume' });
  }
};

// Upload a new resume (admin)
export const uploadResume = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const file = req.file;
    const originalName = file.originalname;
    const filename = req.body.filename || path.basename(originalName, '.pdf');

    // Create a new ObjectId for the resume
    const resumeId = new mongoose.Types.ObjectId();
    const storedName = generateHashedFilename(resumeId);
    const filePath = path.join(RESUMES_DIR, storedName);

    // Save file to disk
    await fs.promises.writeFile(filePath, file.buffer);

    // Create resume record
    const resume = new Resume({
      _id: resumeId,
      filename,
      originalName,
      storedName,
      mimeType: file.mimetype,
      size: file.buffer.length,
      isActive: false,
    });

    await resume.save();

    res.json({
      success: true,
      resume,
    });
  } catch (error) {
    console.error('Error uploading resume:', error);
    res.status(500).json({ error: 'Failed to upload resume' });
  }
};

// Set a resume as active (admin)
export const setActiveResume = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if resume exists
    const resume = await Resume.findById(id);
    if (!resume) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    // Deactivate all resumes
    await Resume.updateMany({}, { isActive: false });

    // Activate the selected resume
    resume.isActive = true;
    await resume.save();

    res.json({
      success: true,
      resume,
    });
  } catch (error) {
    console.error('Error setting active resume:', error);
    res.status(500).json({ error: 'Failed to set active resume' });
  }
};

// Delete a resume (admin)
export const deleteResume = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const resume = await Resume.findById(id);
    if (!resume) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    // Delete file from disk
    const filePath = path.join(RESUMES_DIR, resume.storedName);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    // Delete from database
    await Resume.findByIdAndDelete(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({ error: 'Failed to delete resume' });
  }
};

// Serve resume file (public)
export const serveResume = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const resume = await Resume.findById(id);
    if (!resume) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    const filePath = path.join(RESUMES_DIR, resume.storedName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Resume file not found' });
      return;
    }

    // Set headers for PDF viewing/download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${resume.originalName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving resume:', error);
    res.status(500).json({ error: 'Failed to serve resume' });
  }
};

// Serve active resume file (public) - convenience endpoint
export const serveActiveResume = async (_req: Request, res: Response): Promise<void> => {
  try {
    const resume = await Resume.findOne({ isActive: true });
    if (!resume) {
      res.status(404).json({ error: 'No active resume found' });
      return;
    }

    const filePath = path.join(RESUMES_DIR, resume.storedName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Resume file not found' });
      return;
    }

    // Set headers for PDF viewing/download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${resume.originalName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving active resume:', error);
    res.status(500).json({ error: 'Failed to serve resume' });
  }
};

export default {
  uploadMiddleware,
  getAllResumes,
  getActiveResume,
  uploadResume,
  setActiveResume,
  deleteResume,
  serveResume,
  serveActiveResume,
};

