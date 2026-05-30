import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  token: requireEnv('DISCORD_TOKEN'),
  clientId: requireEnv('CLIENT_ID'),
  guildId: process.env.GUILD_ID,
  mongoUri: requireEnv('MONGODB_URI'),
  ticketCategoryId: requireEnv('TICKET_CATEGORY_ID'),
  staffRoleId: process.env.STAFF_ROLE_ID,
  feedbackChannelId: process.env.FEEDBACK_CHANNEL_ID ?? null,
} as const;
