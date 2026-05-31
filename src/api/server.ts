import express from 'express';
import { KeyModel } from '../database/models/Key';

let server: any = null;

function daysToMs(days: number) {
  return days * 24 * 60 * 60 * 1000;
}

function formatDateDMY(d?: Date | null) {
  if (!d) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());
  return `${day}-${month}-${year}`;
}

function buildExpiresPayload(d?: Date | null) {
  if (!d) {
    return { expiresAt: null, expiresAtIso: null };
  }

  return {
    expiresAt: formatDateDMY(d),
    expiresAtIso: d.toISOString(),
  };
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
      if (key.hwid && key.hwid !== hwid) {
        return res.json({ success: false, message: 'HWID mismatch. Locked to another device' });
      }

      if (!key.expiresAt || now.getTime() > key.expiresAt.getTime()) {
        key.status = 'expired';
        await key.save().catch(() => undefined);
        return res.json({ success: false, message: 'Key has expired' });
      }

      return res.json({ success: true, message: 'Login successful', ...buildExpiresPayload(key.expiresAt) });
    }

    if (key.status === 'unused') {
      // activate
      key.status = 'used';
      key.hwid = hwid ? hwid : null;
      key.activatedAt = now;
      // treat a month as 30 days
      const ms = key.durationMonths * 30 * 24 * 60 * 60 * 1000;
      key.expiresAt = new Date(now.getTime() + ms);
      await key.save();
      return res.json({ success: true, message: 'Key activated successfully', ...buildExpiresPayload(key.expiresAt) });
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
