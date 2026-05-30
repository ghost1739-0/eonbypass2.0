import { Schema, model, Document } from 'mongoose';

export interface PanelDocument extends Document {
  channelId: string;
  type: string;
  messageId?: string | null;
  createdAt?: Date;
}

const panelSchema = new Schema<PanelDocument>(
  {
    channelId: { type: String, required: true },
    type: { type: String, required: true },
    messageId: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

panelSchema.index({ channelId: 1, type: 1 }, { unique: true });

export const PanelModel = model<PanelDocument>('Panel', panelSchema);
