import {
  ButtonInteraction,
  ChannelType,
  Guild,
  Message,
  PermissionFlagsBits,
  StringSelectMenuInteraction,
  TextChannel,
  User,
} from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { config } from '../../config/config';
import { ModmailTicketDocument, ModmailTicketModel } from '../../database/models/ModmailTicket';
import { ModmailCategory } from '../../types';
import {
  buildModmailCloseButton,
  buildModmailIntroEmbed,
  formatRelayMessage,
  getModmailCategoryLabel,
} from '../../utils/modmailHelpers';

export class ModmailService {
  private readonly byUser = new Map<string, ModmailTicketDocument>();
  private readonly byChannel = new Map<string, ModmailTicketDocument>();
  private bootstrapped = false;

  constructor(private readonly client: BotClient) {}

  public async bootstrap(): Promise<void> {
    if (this.bootstrapped) {
      return;
    }

    const openTickets = await ModmailTicketModel.find({ status: 'open' });

    for (const ticket of openTickets) {
      const exists = await this.channelExists(ticket.channelId);
      if (!exists) {
        ticket.status = 'closed';
        ticket.closedAt = new Date();
        await ticket.save().catch(() => undefined);
        continue;
      }

      this.byUser.set(ticket.userId, ticket);
      this.byChannel.set(ticket.channelId, ticket);
    }

    this.bootstrapped = true;
    console.log(`[Modmail] bootstrap complete. open=${this.byUser.size}`);
  }

  public async openTicketForPurchase(user: User, meta?: { productTitle?: string; productPrice?: string; productDescription?: string }) {
    const existing = await this.getOpenTicketByUser(user.id);
    if (existing) {
      return existing;
    }

    const ticket = await this.createTicket('purchase', user, meta);

    // Send a single DM to user with jump link and ticket id (Purchase Ticket Created embed)
    try {
      const guildId = config.modmailManagementGuildId;
      const jumpUrl = `https://discord.com/channels/${guildId}/${ticket.channelId}`;

      await user.send({
        embeds: [
          {
            title: 'Purchase Ticket Created',
            color: 0x5865f2,
            description: 'Your ticket has been created. Click the link below to jump to the channel.',
            fields: [
              { name: 'Channel', value: `[Open Ticket](${jumpUrl})` },
              { name: 'Ticket ID', value: `#${ticket.ticketId}` },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch {
      /* ignore DM failures */
    }

    return ticket;
  }

  public async openFromPanel(interaction: StringSelectMenuInteraction): Promise<void> {
    const category = interaction.values[0] as ModmailCategory;
    if (!this.isValidCategory(category)) {
      await interaction.reply({ content: 'Geçersiz kategori.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const existing = await this.getOpenTicketByUser(interaction.user.id);
    if (existing) {
      await interaction.editReply({ content: `❌ Zaten açık bir ticketınız var: <#${existing.channelId}>` });
      return;
    }

    const ticket = await this.createTicket(category, interaction.user);

    await interaction.editReply({
      content: `✅ İşleminiz DM üzerinden başlatıldı, lütfen DM kutunuzu kontrol edin.\nTicket ID: #${ticket.ticketId}`,
    });

    await interaction.user.send({
      embeds: [
        {
          title: 'Ticket Başlatıldı / Ticket Started',
          color: 0x5865f2,
          description:
            `Konu: ${getModmailCategoryLabel(category)}\n` +
            'Mesajlarınız artık DM ile yetkili sunucusundaki ticket kanalına iletiliyor.',
          footer: { text: `Ticket ID: #${ticket.ticketId}` },
          timestamp: new Date().toISOString(),
        },
      ],
    }).catch(() => undefined);
  }

  public async closeTicket(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Geçersiz işlem.', ephemeral: true });
      return;
    }

    const channelId = interaction.customId.split(':').pop();
    if (!channelId) {
      await interaction.reply({ content: 'Geçersiz ticket.', ephemeral: true });
      return;
    }

    const ticket = await this.getOpenTicketByChannel(channelId);
    if (!ticket) {
      await interaction.reply({ content: 'Bu ticket bulunamadı veya zaten kapatılmış.', ephemeral: true });
      return;
    }

    if (!this.canManageTicket(interaction)) {
      await interaction.reply({ content: '❌ Bu ticketi kapatma yetkiniz yok.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    await this.closeTicketByRecord(ticket, interaction.user.tag);
    await interaction.editReply({ content: '✅ Ticket kapatıldı ve kanal siliniyor.' });
  }

  public async handleUserMessage(message: Message): Promise<void> {
    if (message.author.bot) {
      return;
    }

    const ticket = await this.getOpenTicketByUser(message.author.id);
    if (!ticket) {
      await (message.channel as any)
        .send('Aktif bir ticket bulunamadı. Lütfen panelden ticket başlatın.')
        .catch(() => undefined);
      return;
    }

    const channel = await this.fetchTextChannel(ticket.channelId);
    if (!channel) {
      await this.closeStaleTicket(ticket);
      await (message.channel as any)
        .send('Ticket kanalı bulunamadı, kayıt kapatıldı. Lütfen yeniden ticket açın.')
        .catch(() => undefined);
      return;
    }

    await channel.send({
      content: formatRelayMessage('Müşteri', message.author.username, message.content),
      files: [...message.attachments.values()].map((attachment) => attachment.url),
      allowedMentions: { parse: [] },
    });
  }

  public async handleStaffMessage(message: Message): Promise<void> {
    if (message.author.bot || !message.guild || message.guild.id !== config.modmailManagementGuildId) {
      return;
    }

    const ticket = await this.getOpenTicketByChannel(message.channel.id);
    if (!ticket) {
      return;
    }

    if (!this.isStaffAuthor(message)) {
      return;
    }

    const targetUser = await this.client.users.fetch(ticket.userId).catch(() => null);
    if (!targetUser) {
      await this.closeStaleTicket(ticket);
      return;
    }

    await targetUser.send({
      content: formatRelayMessage('Yetkili', message.author.username, message.content),
      files: [...message.attachments.values()].map((attachment) => attachment.url),
      allowedMentions: { parse: [] },
    }).catch(() => undefined);
  }

  private async createTicket(
    category: ModmailCategory,
    user: User,
    meta?: { productTitle?: string; productPrice?: string; productDescription?: string }
  ): Promise<ModmailTicketDocument> {
    const guild = await this.client.guilds.fetch(config.modmailManagementGuildId);
    const parent = this.getParentCategory(guild, category);

    const channel = await guild.channels.create({
      name: `ticket-${user.id}`,
      type: ChannelType.GuildText,
      parent: parent ?? undefined,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: config.modmailStaffRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
      ],
      topic: `Modmail ticket for ${user.tag} (${user.id}) | ${category}`,
    });

    let ticket: ModmailTicketDocument;
    try {
      ticket = await ModmailTicketModel.create({
        ticketId: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        userId: user.id,
        userTag: user.tag,
        userAvatarUrl: user.displayAvatarURL({ size: 256 }),
        guildId: guild.id,
        channelId: channel.id,
        category,
        status: 'open',
      });
    } catch (error) {
      await channel.delete('Modmail ticket record creation failed').catch(() => undefined);
      throw error;
    }

    this.byUser.set(user.id, ticket);
    this.byChannel.set(channel.id, ticket);

    const intro = await channel.send({
      content: `Yeni modmail ticketı açıldı: ${user.tag}`,
      embeds: [
        buildModmailIntroEmbed({
          userTag: user.tag,
          userId: user.id,
          userAvatarUrl: user.displayAvatarURL({ size: 256 }),
          createdAt: user.createdAt,
          category,
          ticketId: ticket.ticketId,
        }),
      ],
      components: [buildModmailCloseButton(channel.id)],
      allowedMentions: { parse: [] },
    });

    await intro.pin().catch(() => undefined);

    // If product metadata provided, add a product summary embed into the ticket channel.
    if (meta?.productTitle) {
      await channel.send({
        embeds: [
          {
            title: 'Product / Ürün',
            description: meta.productDescription ?? '—',
            fields: [
              { name: 'Title', value: meta.productTitle, inline: true },
              { name: 'Price', value: meta.productPrice ?? '—', inline: true },
            ],
          },
        ],
      }).catch(() => undefined);
    }
    return ticket;
  }

  private async closeTicketByRecord(ticket: ModmailTicketDocument, closedBy: string): Promise<void> {
    ticket.status = 'closed';
    ticket.closedAt = new Date();
    await ticket.save();

    this.byUser.delete(ticket.userId);
    this.byChannel.delete(ticket.channelId);

    const user = await this.client.users.fetch(ticket.userId).catch(() => null);
    if (user) {
      await user.send('Ticketınız yetkililer tarafından sonlandırılmıştır.').catch(() => undefined);
    }

    const channel = await this.fetchTextChannel(ticket.channelId);
    if (channel) {
      await channel.send(`🔒 Ticket kapatıldı. Kapatan: ${closedBy}`).catch(() => undefined);
      setTimeout(() => {
        void channel.delete('Modmail ticket closed').catch(() => undefined);
      }, 3000);
    }
  }

  private async closeStaleTicket(ticket: ModmailTicketDocument): Promise<void> {
    ticket.status = 'closed';
    ticket.closedAt = new Date();
    await ticket.save().catch(() => undefined);
    this.byUser.delete(ticket.userId);
    this.byChannel.delete(ticket.channelId);
  }

  private async getOpenTicketByUser(userId: string): Promise<ModmailTicketDocument | null> {
    const cached = this.byUser.get(userId);
    if (cached?.status === 'open') {
      return cached;
    }

    const ticket = await ModmailTicketModel.findOne({ userId, status: 'open' });
    if (!ticket) {
      return null;
    }

    if (!(await this.channelExists(ticket.channelId))) {
      await this.closeStaleTicket(ticket);
      return null;
    }

    this.byUser.set(userId, ticket);
    this.byChannel.set(ticket.channelId, ticket);
    return ticket;
  }

  private async getOpenTicketByChannel(channelId: string): Promise<ModmailTicketDocument | null> {
    const cached = this.byChannel.get(channelId);
    if (cached?.status === 'open') {
      return cached;
    }

    const ticket = await ModmailTicketModel.findOne({ channelId, status: 'open' });
    if (!ticket) {
      return null;
    }

    this.byUser.set(ticket.userId, ticket);
    this.byChannel.set(channelId, ticket);
    return ticket;
  }

  private async fetchTextChannel(channelId: string): Promise<TextChannel | null> {
    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return null;
    }

    return channel as TextChannel;
  }

  private async channelExists(channelId: string): Promise<boolean> {
    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    return Boolean(channel);
  }

  private getParentCategory(guild: Guild, category: ModmailCategory): string | null {
    switch (category) {
      case 'purchase':
        return guild.channels.cache.has(config.modmailPurchaseCategoryId) ? config.modmailPurchaseCategoryId : null;
      case 'support':
        return guild.channels.cache.has(config.modmailSupportCategoryId) ? config.modmailSupportCategoryId : null;
      case 'inquiry':
        return guild.channels.cache.has(config.modmailInquiryCategoryId) ? config.modmailInquiryCategoryId : null;
    }
  }

  private isValidCategory(value: string): value is ModmailCategory {
    return value === 'purchase' || value === 'support' || value === 'inquiry';
  }

  private canManageTicket(interaction: ButtonInteraction): boolean {
    const isAdmin = interaction.memberPermissions?.has('Administrator') ?? false;
    const member = interaction.member as any;
    const hasStaffRole = Boolean(member?.roles?.cache?.has?.(config.modmailStaffRoleId));

    return isAdmin || hasStaffRole;
  }

  private isStaffAuthor(message: Message): boolean {
    return !!message.member && (message.member.permissions.has('Administrator') || message.member.roles.cache.has(config.modmailStaffRoleId));
  }
}