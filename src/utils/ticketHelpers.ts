import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Guild,
  GuildMember,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { config } from '../config/config';
import { ProductDocument } from '../database/models/Product';
import { TicketDocument, TicketModel } from '../database/models/Ticket';
import { CustomIds, TicketType } from './constants';
import { getProductDescription, getProductPrice, getProductTitle } from './productHelpers';

export function generateTicketId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(-8);
}

export async function resolveOpenTicket(
  guild: Guild,
  userId: string,
  type: TicketType
): Promise<TicketDocument | null> {
  const ticket = await TicketModel.findOne({
    guildId: guild.id,
    userId,
    type,
    status: 'open',
  });

  if (!ticket) {
    return null;
  }

  try {
    const channel = await guild.channels.fetch(ticket.channelId);
    if (channel) {
      return ticket;
    }
  } catch {
    // If the channel was deleted or cannot be fetched, close the stale record below.
  }

  ticket.status = 'closed';
  await ticket.save();
  return null;
}

function getChannelPrefix(type: TicketType): string {
  switch (type) {
    case 'purchase':
      return 'Purchase';
    case 'support':
      return 'Support';
    case 'inquiry':
      return 'Inquiry';
  }
}

export async function createTicketChannel(
  guild: Guild,
  member: GuildMember,
  type: TicketType,
  options?: {
    product?: ProductDocument;
    licenseKey?: string;
  }
): Promise<{ channel: TextChannel; ticketId: string }> {
  const ticketId = generateTicketId();
  const prefix = getChannelPrefix(type);
  const channelName = `[${prefix}] ticket-${ticketId}`.toLowerCase().slice(0, 100);

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  if (config.staffRoleId) {
    permissionOverwrites.push({
      id: config.staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    // Only set parent if configured and the category exists
    parent: config.ticketCategoryId && guild.channels.cache.has(config.ticketCategoryId) ? config.ticketCategoryId : undefined,
    permissionOverwrites,
    topic: `Ticket ${ticketId} | User: ${member.user.tag} | Type: ${type}`,
  });

  const ticket = await TicketModel.create({
    ticketId,
    channelId: channel.id,
    guildId: guild.id,
    userId: member.id,
    type,
    productId: options?.product?._id?.toString(),
    licenseKey: options?.licenseKey,
    status: 'open',
  });

  const embed = buildTicketEmbed(type, member, options);
  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CustomIds.TICKET_CLOSE}:${channel.id}`)
      .setLabel('Close Ticket / Ticketi Kapat')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `${member}`,
    embeds: [embed],
    components: [closeRow],
  });

  // Attempt to DM the user a copy/jump link for their ticket
  try {
    const jumpUrl = `https://discord.com/channels/${guild.id}/${channel.id}`;
    const dmEmbed = new EmbedBuilder()
      .setColor(type === 'purchase' ? 0x5865f2 : 0x57f287)
      .setTitle(type === 'purchase' ? 'Purchase Ticket Created' : 'Ticket Created')
      .setDescription('Your ticket has been created. Click the link below to jump to the channel.')
      .addFields({ name: 'Channel', value: `[Open Ticket](${jumpUrl})` }, { name: 'Ticket ID', value: ticketId })
      .setTimestamp();

    const dm = await member.user.send({ embeds: [dmEmbed] }).catch(() => null);
    // eslint-disable-next-line no-console
    console.log(`[Ticket] DM sent to user=${member.id} ticket=${ticketId} msg=${dm?.id}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[Ticket] failed to DM user about ticket', err);
  }

  return { channel, ticketId: ticket.ticketId };
}

function buildTicketEmbed(
  type: TicketType,
  member: GuildMember,
  options?: {
    product?: ProductDocument;
    licenseKey?: string;
  }
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(type === 'purchase' ? 0x5865f2 : 0x57f287)
    .setTimestamp()
    .setFooter({ text: `User ID: ${member.id}` });

  if (type === 'purchase' && options?.product) {
    embed
      .setTitle('Purchase Ticket / Satın Alma Talebi')
      .setDescription(
        '**EN:** Your purchase ticket has been opened. Our team will assist you shortly.\n' +
          '**TR:** Satın alma talebiniz açıldı. Ekibimiz kısa süre içinde size yardımcı olacaktır.'
      )
      .addFields(
        {
          name: 'Product / Ürün',
          value: getProductTitle(options.product),
          inline: true,
        },
        {
          name: 'Price / Fiyat',
          value: getProductPrice(options.product),
          inline: true,
        },
        {
          name: 'Description / Açıklama',
          value: getProductDescription(options.product),
        }
      );
    return embed;
  }

  const typeLabel =
    type === 'support'
      ? 'Technical Support / Teknik Destek'
      : 'Product Inquiry / Ürün Sorgulama';

  embed
    .setTitle(`${typeLabel} Ticket`)
    .setDescription(
      '**EN:** Your ticket has been opened. Please wait for staff assistance.\n' +
        '**TR:** Talebiniz açıldı. Lütfen yetkili ekibin yanıt vermesini bekleyin.'
    );

  if (options?.licenseKey) {
    embed.addFields({
      name: 'License Key / Lisans Anahtarı',
      value: `\`${options.licenseKey}\``,
    });
  }

  return embed;
}

export function buildTicketPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('Support Center / Destek Merkezi')
    .setDescription(
      '**EN:** Select a button below to open a ticket. Our team is ready to help you.\n\n' +
        '**TR:** Talep açmak için aşağıdaki butonlardan birini seçin. Ekibimiz size yardımcı olmaya hazır.\n\n' +
        '🛒 **Purchase / Satın Alma** — Buy a product\n' +
        '🛠️ **Support / Teknik Destek** — Technical assistance\n' +
        'ℹ️ **Product Inquiry / Ürün Sorgula** — Ask about products'
    )
    .setTimestamp();
}

export function buildFeedbackPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('Feedback / Geri Bildirim')
    .setDescription(
      '**EN:** We value your opinion! Click the button below to submit your feedback.\n\n' +
        '**TR:** Görüşleriniz bizim için değerli! Geri bildiriminizi göndermek için aşağıdaki butona tıklayın.'
    )
    .setTimestamp();
}
