import { Document, Schema, model } from 'mongoose';
import { IModmailTicket } from '../../types';

export interface ModmailTicketDocument extends Omit<IModmailTicket, '_id'>, Document {}

const modmailTicketSchema = new Schema<ModmailTicketDocument>(
  {
    ticketNumber: { type: Number, required: true, unique: true },
    ticketId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    userTag: { type: String, required: true, trim: true },
    userAvatarUrl: { type: String, required: true, trim: true },
    guildId: { type: String, required: true },
    channelId: { type: String, required: true, unique: true },
    category: {
      type: String,
      enum: ['purchase', 'support', 'inquiry'],
      required: true,
    },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    closedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

modmailTicketSchema.index({ userId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'open' } });

export const ModmailTicketModel = model<ModmailTicketDocument>('ModmailTicket', modmailTicketSchema);