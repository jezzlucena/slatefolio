import { Request, Response } from 'express';
import sharp from 'sharp';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import File from '../models/File';

// Upload directory configuration
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');

// Ensure upload directories exist
const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir(path.join(UPLOADS_DIR, 'images'));
ensureDir(path.join(UPLOADS_DIR, 'videos'));

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// Generate a hash from MongoDB ObjectId
function generateHashedFilename(id: mongoose.Types.ObjectId, extension: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(id.toString())
    .digest('hex')
    .substring(0, 16); // Use first 16 chars for shorter filename
  return `${hash}${extension}`;
}

// Image processing options
interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
  variant: 'optimized' | 'thumb' | 'original';
  extension: string;
}

async function processImage(
  buffer: Buffer,
  mimetype: string
): Promise<ProcessedImage[]> {
  const results: ProcessedImage[] = [];

  // Original as WebP (optimized)
  const webpBuffer = await sharp(buffer)
    .webp({ quality: 85 })
    .toBuffer();

  results.push({
    buffer: webpBuffer,
    contentType: 'image/webp',
    variant: 'optimized',
    extension: '.webp',
  });

  // Thumbnail (400px width)
  const thumbBuffer = await sharp(buffer)
    .resize(400, null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  results.push({
    buffer: thumbBuffer,
    contentType: 'image/webp',
    variant: 'thumb',
    extension: '.webp',
  });

  // If it's a GIF, also keep original for animation
  if (mimetype === 'image/gif') {
    results.push({
      buffer,
      contentType: mimetype,
      variant: 'original',
      extension: '.gif',
    });
  }

  return results;
}

async function saveFileToDb(
  originalName: string,
  storedName: string,
  mimeType: string,
  size: number,
  folder: 'images' | 'videos',
  variant?: 'original' | 'thumb' | 'optimized',
  parentFile?: mongoose.Types.ObjectId,
  aspectRatio?: number
): Promise<mongoose.Types.ObjectId> {
  const file = new File({
    originalName,
    storedName,
    mimeType,
    size,
    folder,
    variant,
    parentFile,
    aspectRatio,
  });
  await file.save();
  return file._id;
}

async function saveFileToDisk(
  buffer: Buffer,
  folder: string,
  filename: string
): Promise<void> {
  const filePath = path.join(UPLOADS_DIR, folder, filename);
  await fs.promises.writeFile(filePath, buffer);
}

// Upload single file (image or video)
export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const file = req.file;
    const originalName = file.originalname;
    const ext = path.extname(originalName);
    const folder = file.mimetype.startsWith('video/') ? 'videos' : 'images';

    const urls: { [key: string]: string } = {};
    let mainFileId: mongoose.Types.ObjectId | null = null;
    let aspectRatio: number | undefined;

    if (file.mimetype.startsWith('image/')) {
      // Get image dimensions for aspect ratio
      const metadata = await sharp(file.buffer).metadata();
      if (metadata.width && metadata.height) {
        aspectRatio = metadata.height / metadata.width;
      }

      // Process and save images
      const processed = await processImage(file.buffer, file.mimetype);

      for (const img of processed) {
        // Create file record first to get ID
        const fileId = new mongoose.Types.ObjectId();
        const storedName = generateHashedFilename(fileId, img.extension);

        // Save to disk
        await saveFileToDisk(img.buffer, folder, storedName);

        // Save to database
        const savedId = await saveFileToDb(
          originalName,
          storedName,
          img.contentType,
          img.buffer.length,
          folder as 'images' | 'videos',
          img.variant,
          mainFileId || undefined,
          img.variant === 'optimized' ? aspectRatio : undefined
        );

        // Build URL using file ID
        const url = `/files/${savedId}`;

        if (img.variant === 'optimized') {
          urls.url = url;
          mainFileId = savedId;
        } else if (img.variant === 'thumb') {
          urls.thumbUrl = url;
        } else if (img.variant === 'original') {
          urls.originalUrl = url;
        }
      }

      if (aspectRatio) {
        urls.aspectRatio = String(aspectRatio);
      }
    } else if (file.mimetype.startsWith('video/')) {
      // Create file record first to get ID
      const fileId = new mongoose.Types.ObjectId();
      const storedName = generateHashedFilename(fileId, ext);

      // Save video to disk
      await saveFileToDisk(file.buffer, folder, storedName);

      // Save to database
      const savedId = await saveFileToDb(
        originalName,
        storedName,
        file.mimetype,
        file.buffer.length,
        folder as 'images' | 'videos'
      );

      urls.url = `/files/${savedId}`;
    }

    res.json({
      success: true,
      ...urls,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

// Serve file with original filename
export const serveFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid file ID' });
      return;
    }

    const file = await File.findById(id);

    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, file.folder, file.storedName);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }

    // Set content type
    res.setHeader('Content-Type', file.mimeType);

    // Set Content-Disposition with original filename for downloads
    // Using 'inline' allows browsers to display the file, but provides the original name for downloads
    const encodedFilename = encodeURIComponent(file.originalName);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.originalName}"; filename*=UTF-8''${encodedFilename}`
    );

    // Set caching headers
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
};

// Delete file from local storage and database
export const deleteFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { url } = req.body;

    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    // Extract file ID from URL (e.g., /files/507f1f77bcf86cd799439011)
    const match = url.match(/\/files\/([a-f0-9]{24})/);
    if (!match) {
      res.status(400).json({ error: 'Invalid file URL' });
      return;
    }

    const fileId = match[1];
    const file = await File.findById(fileId);

    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Delete file from disk
    const filePath = path.join(UPLOADS_DIR, file.folder, file.storedName);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    // Delete all variants if this is a main file
    const variants = await File.find({ parentFile: file._id });
    for (const variant of variants) {
      const variantPath = path.join(UPLOADS_DIR, variant.folder, variant.storedName);
      if (fs.existsSync(variantPath)) {
        await fs.promises.unlink(variantPath);
      }
      await variant.deleteOne();
    }

    // Delete the file record
    await file.deleteOne();

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

export default {
  upload,
  uploadFile,
  serveFile,
  deleteFile,
  UPLOADS_DIR,
};
