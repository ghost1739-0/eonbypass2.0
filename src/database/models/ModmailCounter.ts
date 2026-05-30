import { Schema, model } from 'mongoose';

export interface ModmailCounterDocument {
  _id: string;
  value: number;
}

const modmailCounterSchema = new Schema<ModmailCounterDocument>(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 },
  },
  { versionKey: false }
);

export const ModmailCounterModel = model<ModmailCounterDocument>('ModmailCounter', modmailCounterSchema);