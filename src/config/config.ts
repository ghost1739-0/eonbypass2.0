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
  feedbackChannelId: process.env.FEEDBACK_CHANNEL_ID ?? '1510004727587410001',
  modmailManagementGuildId: requireEnv('MODMAIL_GUILD_ID'),
  modmailStaffRoleId: requireEnv('MODMAIL_STAFF_ROLE_ID'),
  modmailPurchaseCategoryId: requireEnv('MODMAIL_PURCHASE_CATEGORY_ID'),
  modmailSupportCategoryId: requireEnv('MODMAIL_SUPPORT_CATEGORY_ID'),
  modmailInquiryCategoryId: requireEnv('MODMAIL_INQUIRY_CATEGORY_ID'),
  modmailPurchaseLogChannelId: requireEnv('MODMAIL_PURCHASE_LOG_CHANNEL_ID'),
  modmailSupportLogChannelId: requireEnv('MODMAIL_SUPPORT_LOG_CHANNEL_ID'),
  modmailInquiryLogChannelId: requireEnv('MODMAIL_INQUIRY_LOG_CHANNEL_ID'),
} as const;
