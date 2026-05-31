import express from 'express';
import { KeyModel } from '../database/models/Key';

let server: any = null;

function daysToMs(days: number) {
  return days * 24 * 60 * 60 * 1000;
}

export async function startApiServer(port?: number): Promise<void> {
  const listenPort = Number(process.env.PORT || port || 10000);
  const app = express();
  app.use(express.json());

  app.post('/api/verify', async (req, res) => {
    const { key: keyString, hwid } = req.body as { key?: string; hwid?: string };
    if (!keyString) return res.json({ success: false, message: 'Invalid Key' });

    const key = await KeyModel.findOne({ key: keyString }).exec();
    if (!key) return res.json({ success: false, message: 'Invalid Key' });

    // expired
    if (key.status === 'expired') return res.json({ success: false, message: 'Key has expired' });

    const now = new Date();

    if (key.status === 'used') {
      if (!key.hwid) {
        // inconsistent: mark expired
        key.status = 'expired';
        await key.save().catch(() => undefined);
        return res.json({ success: false, message: 'Key has expired' });
      }

      if (key.hwid !== hwid) {
        return res.json({ success: false, message: 'HWID mismatch. Locked to another device' });
      }

      if (!key.expiresAt || now.getTime() > key.expiresAt.getTime()) {
        key.status = 'expired';
        await key.save().catch(() => undefined);
        return res.json({ success: false, message: 'Key has expired' });
      }

      return res.json({ success: true, message: 'Login successful', expiresAt: key.expiresAt });
    }

    if (key.status === 'unused') {
      // activate
      key.status = 'used';
      key.hwid = hwid ?? null;
      key.activatedAt = now;
      // treat a month as 30 days
      const ms = key.durationMonths * 30 * 24 * 60 * 60 * 1000;
      key.expiresAt = new Date(now.getTime() + ms);
      await key.save();
      return res.json({ success: true, message: 'Key activated successfully', expiresAt: key.expiresAt });
    }

    return res.json({ success: false, message: 'Invalid Key' });
  });

  server = app.listen(listenPort, () => {
    console.log(`[API] Key verify API listening on port ${listenPort}`);
  });
}

export async function stopApiServer(): Promise<void> {
  if (server) {
    await server.close();
    server = null;
  }
}
