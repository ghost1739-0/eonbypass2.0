import { Schema, model, Document } from 'mongoose';
import { ITicket } from '../../types';

export interface TicketDocument extends Omit<ITicket, '_id'>, Document {}

const ticketSchema = new Schema<TicketDocument>(
  {
    ticketId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    type: {
      type: String,
      enum: ['purchase', 'support', 'inquiry'],
      required: true,
    },
    productId: { type: String, default: null },
    licenseKey: { type: String, default: null },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ticketSchema.index({ guildId: 1, userId: 1, status: 1 });

export const TicketModel = model<TicketDocument>('Ticket', ticketSchema);
