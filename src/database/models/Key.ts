import { Document, Schema, model } from 'mongoose';

export type KeyStatus = 'unused' | 'used' | 'expired';

export interface KeyDocument extends Document {
  key: string;
  status: KeyStatus;
  durationMonths: number;
  hwid?: string | null;
  activatedAt?: Date | null;
  expiresAt?: Date | null;
}

const keySchema = new Schema<KeyDocument>(
  {
    key: { type: String, required: true, unique: true },
    status: { type: String, enum: ['unused', 'used', 'expired'], default: 'unused' },
    durationMonths: { type: Number, required: true, default: 1 },
    hwid: { type: String, default: null },
    activatedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

keySchema.index({ key: 1 }, { unique: true });

export const KeyModel = model<KeyDocument>('Key', keySchema);
