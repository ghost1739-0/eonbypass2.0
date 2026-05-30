import mongoose from 'mongoose';
import { config } from '../config/config';

export class Database {
  private static connected = false;

  public static async connect(): Promise<void> {
    if (this.connected) return;

    mongoose.set('strictQuery', true);

    await mongoose.connect(config.mongoUri);
    this.connected = true;
    console.log('[Database] MongoDB connected successfully.');
  }

  public static async disconnect(): Promise<void> {
    if (!this.connected) return;
    await mongoose.disconnect();
    this.connected = false;
    console.log('[Database] MongoDB disconnected.');
  }
}
