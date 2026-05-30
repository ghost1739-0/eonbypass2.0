import { BotClient } from './client/BotClient';
import { config } from './config/config';
import { Database } from './database/connection';

async function main(): Promise<void> {
  console.log('[Bot] Starting EonBypass 2.0...');

  await Database.connect();

  const client = new BotClient();
  await client.initialize();
  await client.start(config.token);

  const shutdown = async (signal: string) => {
    console.log(`[Bot] Received ${signal}, shutting down...`);
    client.destroy();
    await Database.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[Bot] Fatal error:', error);
  process.exit(1);
});
