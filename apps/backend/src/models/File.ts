import mongoose, { Document, Schema } from 'mongoose';

export interface IFile extends Document {
  _id: mongoose.Types.ObjectId;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  folder: 'images' | 'videos';
  variant?: 'original' | 'thumb' | 'optimized';
  parentFile?: mongoose.Types.ObjectId; // Reference to main file for variants
  aspectRatio?: number;
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema = new Schema<IFile>(
  {
    originalName: {
      type: String,
      required: true,
    },
    storedName: {
      type: String,
      required: true,
      unique: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    folder: {
      type: String,
      enum: ['images', 'videos'],
      required: true,
    },
    variant: {
      type: String,
      enum: ['original', 'thumb', 'optimized'],
      default: null,
    },
    parentFile: {
      type: Schema.Types.ObjectId,
      ref: 'File',
      default: null,
    },
    aspectRatio: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for quick lookups (storedName already indexed via unique: true)
FileSchema.index({ parentFile: 1 });

export default mongoose.model<IFile>('File', FileSchema);

