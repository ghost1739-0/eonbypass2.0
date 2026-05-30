import {
  ButtonInteraction,
  ChannelType,
  EmbedBuilder,
  Guild,
  GuildBasedChannel,
  Message,
  PermissionFlagsBits,
  StringSelectMenuInteraction,
  TextChannel,
  User,
} from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { config } from '../../config/config';
import { ModmailCounterModel } from '../../database/models/ModmailCounter';
import { ModmailRelayMessageModel } from '../../database/models/ModmailRelayMessage';
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
  private readonly processedMessageIds = new Set<string>();
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

  public async openTicket(
    category: ModmailCategory,
    user: User,
    meta?: { productTitle?: string; productPrice?: string; productDescription?: string }
  ) {
    const existing = await this.getOpenTicketByUser(user.id);
    if (existing) {
      return existing;
    }

    const ticket = await this.createTicket(category, user, meta);

    try {
      const guildId = config.modmailManagementGuildId;
      const jumpUrl = `https://discord.com/channels/${guildId}/${ticket.channelId}`;

      await user.send({
        content: 'Talebiniz alındı, buraya yazabilirsiniz.',
        embeds: [
          {
            title: this.getOpenTicketTitle(category),
            color: 0x5865f2,
            description: `Yetkili kanalınız açıldı: [Ticket kanalına git](${jumpUrl})`,
            fields: [{ name: 'Ticket ID', value: `#${ticket.ticketId}` }],
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch {
      /* ignore DM failures */
    }

    return ticket;
  }

  public async openTicketForPurchase(
    user: User,
    meta?: { productTitle?: string; productPrice?: string; productDescription?: string }
  ) {
    return this.openTicket('purchase', user, meta);
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

    const ticket = await this.openTicket(category, interaction.user);

    await interaction.editReply({
      content: `✅ İşleminiz DM üzerinden başlatıldı, lütfen DM kutunuzu kontrol edin.\nTicket ID: #${ticket.ticketId}`,
    });
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

    if (!(await this.claimRelayLock(message.id, message.channel.id, 'user-to-staff'))) {
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

    // Post customer's message content as a normal message (no prefix), attachments forwarded.
    await channel.send({
      content: message.content || undefined,
      files: [...message.attachments.values()].map((attachment) => ({ attachment: attachment.url, name: attachment.name })),
      allowedMentions: { parse: [] },
    });
  }

  public async handleStaffMessage(message: Message): Promise<void> {
    if (message.author.bot || !message.guild || message.guild.id !== config.modmailManagementGuildId) {
      return;
    }

    if (!(await this.claimRelayLock(message.id, message.channel.id, 'staff-to-user'))) {
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

    const roleLabel = getModmailCategoryLabel(ticket.category);
    const staffPrefix = `${message.author.username} (${roleLabel}):`;
    await targetUser.send({
      content: `${staffPrefix} ${message.content || ''}`.trim(),
      files: [...message.attachments.values()].map((attachment) => ({ attachment: attachment.url, name: attachment.name })),
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
    const ticketNumber = await this.allocateTicketNumber();

    const channel = await guild.channels.create({
      name: `ticket-${ticketNumber}`,
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
        ticketNumber,
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

    const closedChannel = await this.fetchTextChannel(ticket.channelId);
    await this.sendTicketClosedLog(ticket, closedBy, closedChannel).catch(() => undefined);

    const user = await this.client.users.fetch(ticket.userId).catch(() => null);
    if (user) {
      await this.purgeBotDmMessages(user).catch(() => undefined);
      await user.send('Biletiniz sonlandırıldı').catch(() => undefined);
    }

    if (closedChannel) {
      const ticketNumber = this.resolveTicketNumber(ticket, closedChannel);
      await closedChannel.send(`🔒 Ticket kapatıldı. Kapatan: ${closedBy}`).catch(() => undefined);

      if (ticketNumber !== null) {
        await closedChannel.setName(`closed-ticket-${ticketNumber}`).catch(() => undefined);
      }

      const logCategoryId = await this.getLogCategoryId(ticket.category);
      if (logCategoryId) {
        await closedChannel.setParent(logCategoryId, { lockPermissions: true }).catch(() => undefined);
      }
    }
  }

  private async sendTicketClosedLog(
    ticket: ModmailTicketDocument,
    closedBy: string,
    closedChannel?: TextChannel | null
  ): Promise<void> {
    const guild = await this.client.guilds.fetch(config.modmailManagementGuildId).catch(() => null);
    if (!guild) {
      return;
    }

    const logChannelId = this.getLogChannelId(ticket.category);
    const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('Ticket Kapatıldı')
      .addFields(
        { name: 'Ticket No', value: `#${ticket.ticketNumber}`, inline: true },
        { name: 'Kullanıcı', value: ticket.userTag, inline: true },
        { name: 'Kullanıcı ID', value: ticket.userId, inline: true },
        { name: 'Kategori', value: getModmailCategoryLabel(ticket.category), inline: true },
        { name: 'Kanal', value: closedChannel ? `<#${closedChannel.id}>` : `<#${ticket.channelId}>`, inline: true },
        { name: 'Kapatan', value: closedBy, inline: true },
        { name: 'Ticket ID', value: `#${ticket.ticketId}`, inline: true }
      )
      .setTimestamp();

    if (logChannel && 'send' in logChannel) {
      await (logChannel as any).send({ embeds: [embed] }).catch(() => undefined);
      return;
    }

    if (closedChannel) {
      await closedChannel.send({ embeds: [embed] }).catch(() => undefined);
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

  private getLogChannelId(category: ModmailCategory): string {
    switch (category) {
      case 'purchase':
        return config.modmailPurchaseLogChannelId;
      case 'support':
        return config.modmailSupportLogChannelId;
      case 'inquiry':
        return config.modmailInquiryLogChannelId;
    }
  }

  private async getLogCategoryId(category: ModmailCategory): Promise<string | null> {
    const guild = await this.client.guilds.fetch(config.modmailManagementGuildId).catch(() => null);
    if (!guild) {
      return null;
    }

    const channelId = this.getLogChannelId(category);
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      return null;
    }

    if (channel.type === ChannelType.GuildCategory) {
      return channel.id;
    }

    if ('parentId' in channel && channel.parentId) {
      return channel.parentId;
    }

    return null;
  }

  private async allocateTicketNumber(): Promise<number> {
    const counter = await ModmailCounterModel.findOneAndUpdate(
      { _id: 'modmail-ticket-number' },
      { $inc: { value: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return counter?.value ?? 1;
  }

  private resolveTicketNumber(ticket: ModmailTicketDocument, channel?: TextChannel | null): number | null {
    if (typeof ticket.ticketNumber === 'number' && Number.isFinite(ticket.ticketNumber)) {
      return ticket.ticketNumber;
    }

    const name = channel?.name ?? '';
    const match = name.match(/^(?:ticket|closed-ticket)-(\d+)$/i);
    if (!match) {
      return null;
    }

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async claimRelayLock(
    sourceMessageId: string,
    sourceChannelId: string,
    direction: 'user-to-staff' | 'staff-to-user'
  ): Promise<boolean> {
    if (this.processedMessageIds.has(sourceMessageId)) {
      return false;
    }

    try {
      await ModmailRelayMessageModel.create({
        sourceMessageId,
        sourceChannelId,
        direction,
      });
      this.processedMessageIds.add(sourceMessageId);
      setTimeout(() => {
        this.processedMessageIds.delete(sourceMessageId);
      }, 10_000);
      return true;
    } catch (error: any) {
      if (error?.code === 11000) {
        return false;
      }

      throw error;
    }
  }

  private async purgeBotDmMessages(user: User): Promise<void> {
    const dmChannel = await user.createDM().catch(() => null);
    if (!dmChannel) {
      return;
    }

    let before: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const messages = await dmChannel.messages.fetch({ limit: 100, before }).catch(() => null);
      if (!messages || messages.size === 0) {
        break;
      }

      before = messages.last()?.id;

      for (const message of messages.values()) {
        if (message.author.id === this.client.user?.id) {
          await message.delete().catch(() => undefined);
        }
      }

      if (messages.size < 100) {
        break;
      }
    }
  }

  private getOpenTicketTitle(category: ModmailCategory): string {
    switch (category) {
      case 'purchase':
        return 'Purchase Ticket Created';
      case 'support':
        return 'Support Ticket Created';
      case 'inquiry':
        return 'Product Inquiry Ticket Created';
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