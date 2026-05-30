import { Schema, model, Document } from 'mongoose';
import { IFeedback } from '../../types';

export interface FeedbackDocument extends Omit<IFeedback, '_id'>, Document {}

const feedbackSchema = new Schema<FeedbackDocument>(
  {
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    licenseKey: { type: String, required: true, trim: true },
    feedback: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const FeedbackModel = model<FeedbackDocument>('Feedback', feedbackSchema);
