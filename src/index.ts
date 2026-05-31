import { BotClient } from './client/BotClient';
import dns from 'dns';
import { config } from './config/config';
import { Database } from './database/connection';
import { startHealthServer, stopHealthServer } from './utils/healthServer';
import { startApiServer, stopApiServer } from './api/server';

async function main(): Promise<void> {
  console.log('[Bot] Starting EonBypass 2.0...');

  // Ensure DNS resolvers are set to reliable public servers to avoid SRV lookup failures
  try {
    dns.setServers(['1.1.1.1', '8.8.8.8']);
    console.log('[Bot] DNS servers set to Cloudflare and Google (1.1.1.1, 8.8.8.8)');
  } catch (err) {
    console.warn('[Bot] Unable to set DNS servers:', err);
  }

  startHealthServer();

  await Database.connect();

  const client = new BotClient();
  await client.initialize();
  // start the verification API (use process.env.PORT on Render if set)
  await startApiServer().catch((e) => console.error('[API] start error', e));

  await client.start(config.token);

  const shutdown = async (signal: string) => {
    console.log(`[Bot] Received ${signal}, shutting down...`);
    client.destroy();
    await stopApiServer().catch(() => undefined);
    await Database.disconnect();
    await stopHealthServer();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[Bot] Fatal error:', error);
  process.exit(1);
});
