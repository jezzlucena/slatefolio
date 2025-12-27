import mongoose, { Document, Schema } from 'mongoose';

export interface IResume extends Document {
  filename: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ResumeSchema = new Schema<IResume>(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    storedName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      default: 'application/pdf',
    },
    size: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IResume>('Resume', ResumeSchema);

