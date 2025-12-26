import mongoose, { Document, Schema } from 'mongoose';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';

export interface IPasskey {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  passkeys: IPasskey[];
  currentChallenge?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PasskeySchema = new Schema<IPasskey>({
  credentialId: { type: String, required: true },
  publicKey: { type: String, required: true },
  counter: { type: Number, required: true, default: 0 },
  transports: [{ type: String }],
});

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    passkeys: {
      type: [PasskeySchema],
      default: [],
    },
    currentChallenge: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IUser>('User', UserSchema);

