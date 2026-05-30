import { Document, Schema, model } from 'mongoose';

export interface ModmailRelayMessageDocument extends Document {
  sourceMessageId: string;
  sourceChannelId: string;
  direction: 'user-to-staff' | 'staff-to-user';
  createdAt: Date;
}

const modmailRelayMessageSchema = new Schema<ModmailRelayMessageDocument>(
  {
    sourceMessageId: { type: String, required: true, unique: true },
    sourceChannelId: { type: String, required: true },
    direction: {
      type: String,
      enum: ['user-to-staff', 'staff-to-user'],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

modmailRelayMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const ModmailRelayMessageModel = model<ModmailRelayMessageDocument>(
  'ModmailRelayMessage',
  modmailRelayMessageSchema
);