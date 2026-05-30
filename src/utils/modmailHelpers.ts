import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { ModmailCategory } from '../types';
import { CustomIds } from './constants';

export function getModmailCategoryLabel(category: ModmailCategory): string {
  switch (category) {
    case 'purchase':
      return 'Satın Alma / Purchase';
    case 'support':
      return 'Destek / Support';
    case 'inquiry':
      return 'Ürün Sorgula / Product Inquiry';
  }
}

export function buildModmailPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('DM Ticket / Modmail')
    .setDescription(
      'Bir konu seçtiğinizde işlem DM üzerinden başlar ve yetkili sunucusunda özel bir kanal açılır.\n\n' +
        '**Satın Alma** - sipariş desteği\n' +
        '**Destek** - teknik yardım\n' +
        '**Ürün Sorgula** - ürün hakkında soru'
    )
    .setTimestamp();
}

export function buildModmailSelectMenu(): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(CustomIds.MODMAIL_START)
    .setPlaceholder('Bir konu seçin / Choose a category')
    .addOptions(
      { label: 'Satın Alma', value: 'purchase', emoji: '🛒', description: 'Ürün satın alma desteği' },
      { label: 'Destek', value: 'support', emoji: '🛠️', description: 'Teknik destek talebi' },
      { label: 'Ürün Sorgula', value: 'inquiry', emoji: 'ℹ️', description: 'Ürün hakkında soru' }
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

export function buildModmailIntroEmbed(params: {
  userTag: string;
  userId: string;
  userAvatarUrl: string;
  createdAt: Date;
  category: ModmailCategory;
  ticketId: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Yeni Ticket / New Modmail Ticket')
    .setThumbnail(params.userAvatarUrl)
    .addFields(
      { name: 'Kullanıcı', value: params.userTag, inline: true },
      { name: 'Kullanıcı ID', value: params.userId, inline: true },
      { name: 'Kategori', value: getModmailCategoryLabel(params.category), inline: true },
      { name: 'Hesap Açılış', value: `<t:${Math.floor(params.createdAt.getTime() / 1000)}:F>`, inline: false },
      { name: 'Ticket ID', value: `#${params.ticketId}`, inline: true }
    )
    .setTimestamp();
}

export function buildModmailCloseButton(channelId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CustomIds.MODMAIL_CLOSE}:${channelId}`)
      .setLabel('Kapat / Close')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒')
  );
}

export function formatRelayMessage(prefix: 'Müşteri' | 'Yetkili', displayName: string, content: string): string {
  const clean = content.trim();
  const body = clean.length > 0 ? clean : '[ek gönderildi]';
  return `**[${prefix}] ${displayName}:** ${body}`;
}