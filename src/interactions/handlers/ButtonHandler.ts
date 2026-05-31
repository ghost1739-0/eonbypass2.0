import {
  ActionRowBuilder,
  ButtonInteraction,
  ModalBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { config } from '../../config/config';
import { ProductModel } from '../../database/models/Product';
import { TicketModel } from '../../database/models/Ticket';
import { KeyModel } from '../../database/models/Key';
import { CustomIds } from '../../utils/constants';
import { getProductDescription, getProductPrice, getProductTitle } from '../../utils/productHelpers';
import { createTicketChannel, resolveOpenTicket } from '../../utils/ticketHelpers';

export class ButtonHandler {
  constructor(private readonly client: BotClient) {}

  public async handle(interaction: ButtonInteraction): Promise<void> {
    const { customId } = interaction;

    if (customId === CustomIds.TICKET_PURCHASE) {
      await this.handlePurchaseButton(interaction);
      return;
    }

    if (customId === CustomIds.TICKET_SUPPORT || customId === CustomIds.TICKET_INQUIRY) {
      await this.showLicenseModal(interaction, customId);
      return;
    }

    if (customId.startsWith(`${CustomIds.TICKET_CLOSE}:`)) {
      await this.handleCloseTicket(interaction);
      return;
    }

    if (customId === CustomIds.FEEDBACK_OPEN) {
      await this.showFeedbackModal(interaction);
      return;
    }

    if (customId === CustomIds.PRODUCT_DELETE_ALL_CONFIRM) {
      await this.handleDeleteAllProductsConfirm(interaction);
      return;
    }

    if (customId === CustomIds.PRODUCT_DELETE_ALL_CANCEL) {
      await this.handleDeleteAllProductsCancel(interaction);
      return;
    }

    if (customId.startsWith(`${CustomIds.MODMAIL_CLOSE}:`)) {
      await this.client.modmail.closeTicket(interaction);
    }

    if (customId.startsWith(`${CustomIds.KEY_ADD_MONTH}:`) || customId.startsWith(`${CustomIds.KEY_ADD_MONTH}`)) {
      await this.keyAddMonth(interaction);
      return;
    }

    if (customId.startsWith(`${CustomIds.KEY_REMOVE_MONTH}:`) || customId.startsWith(`${CustomIds.KEY_REMOVE_MONTH}`)) {
      await this.keyRemoveMonth(interaction);
      return;
    }

    if (customId.startsWith(`${CustomIds.KEY_CONFIRM_CANCEL}:`) || customId.startsWith(`${CustomIds.KEY_CONFIRM_CANCEL}`)) {
      await this.keyConfirmCancel(interaction);
      return;
    }

    if (customId.startsWith(`${CustomIds.KEY_CANCEL_ABORT}:`) || customId.startsWith(`${CustomIds.KEY_CANCEL_ABORT}`)) {
      await this.keyAbortCancel(interaction);
      return;
    }
    if (customId.startsWith(`${CustomIds.KEY_ADJUST_MONTHS}:`) || customId.startsWith(`${CustomIds.KEY_ADJUST_MONTHS}`)) {
      await this.showAdjustModal(interaction);
      return;
    }
  }

  private async handlePurchaseButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: 'Bu işlem sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const openTicket = await resolveOpenTicket(interaction.guild, interaction.user.id, 'purchase');

    if (openTicket) {
      await interaction.reply({
        content: `❌ Zaten açık bir satın alma talebiniz var: <#${openTicket.channelId}>`,
        ephemeral: true,
      });
      return;
    }

    const products = await ProductModel.find().sort({ createdAt: -1 }).limit(25);

    if (products.length === 0) {
      await interaction.reply({
        content:
          '❌ Henüz ürün eklenmemiş. Yönetici /ürünekle komutunu kullanmalı.\n' +
          'No products available yet. An admin must add products with /ürünekle.',
        ephemeral: true,
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(CustomIds.PRODUCT_SELECT)
      .setPlaceholder('Ürün Seçin / Select a Product')
      .addOptions(
        products.map((p) => ({
          label: getProductTitle(p).slice(0, 100),
          description: `${getProductPrice(p)} — ${getProductDescription(p)}`.slice(0, 100),
          value: p._id.toString(),
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      content:
        '**EN:** Please select a product from the menu below.\n' +
        '**TR:** Lütfen aşağıdaki menüden bir ürün seçin.',
      components: [row],
      ephemeral: true,
    });
  }

  private async showAdjustModal(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const keyStr = parts[parts.length - 1];

    const modal = new ModalBuilder().setCustomId(`${CustomIds.MODAL_ADJUST_MONTHS}:${keyStr}`).setTitle('Anahtar Süresini Değiştir');

    const input = new TextInputBuilder()
      .setCustomId('months_delta')
      .setLabel('Kaç ekle/çıkar? (sayı + birim: d,gün; w,hafta; m,ay)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Örnek: 3m, -2m, 10d, -1w, 5 (varsayılan: ay)')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

    try {
      console.log('[ButtonHandler] showAdjustModal opening modal for key=', keyStr);
      await interaction.showModal(modal);
    } catch (err) {
      console.error('[ButtonHandler] showAdjustModal error', err);
      try {
        await interaction.reply({ content: 'Bir hata oluştu: modal açılamadı.', ephemeral: true });
      } catch {
        /* ignore */
      }
    }
  }

  private async showLicenseModal(
    interaction: ButtonInteraction,
    ticketButtonId: string
  ): Promise<void> {
    const ticketType = ticketButtonId === CustomIds.TICKET_SUPPORT ? 'support' : 'inquiry';

    const modal = new ModalBuilder()
      .setCustomId(`${CustomIds.MODAL_LICENSE}:${ticketType}`)
      .setTitle('License Verification / Lisans Doğrulama');

    const licenseInput = new TextInputBuilder()
      .setCustomId('license_key')
      .setLabel('License Key / Lisans Anahtarı')
      .setPlaceholder('XXXX-XXXX-XXXX-XXXX')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(licenseInput));

    await interaction.showModal(modal);
  }

  private async showFeedbackModal(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(CustomIds.MODAL_FEEDBACK)
      .setTitle('Submit Feedback / Geri Bildirim');

    const licenseInput = new TextInputBuilder()
      .setCustomId('license_key')
      .setLabel('License Key / Lisans Anahtarı')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const feedbackInput = new TextInputBuilder()
      .setCustomId('feedback_text')
      .setLabel('Your Feedback / Geri Bildiriminiz')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(licenseInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(feedbackInput)
    );

    await interaction.showModal(modal);
  }

  private async handleDeleteAllProductsConfirm(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({ content: '❌ Bu işlem için yönetici yetkisi gerekli.', ephemeral: true });
      return;
    }

    const result = await ProductModel.deleteMany({});

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('✅ Tüm Ürünler Silindi')
      .setDescription(`Veritabanından **${result.deletedCount}** ürün silindi.`)
      .setTimestamp();

    await interaction.update({
      embeds: [embed],
      components: [],
    });
  }

  private async keyAddMonth(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const keyStr = parts[parts.length - 1];
    const key = await KeyModel.findOne({ key: keyStr }).exec();
    if (!key) {
      await interaction.reply({ content: 'Anahtar bulunamadı.', ephemeral: true });
      return;
    }

    if (key.status === 'expired') {
      await interaction.reply({ content: 'Anahtar süresi dolmuş.', ephemeral: true });
      return;
    }

    if (key.status === 'used' && key.expiresAt) {
      key.expiresAt = new Date(key.expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      key.durationMonths = key.durationMonths + 1;
    }
    await key.save();
    await interaction.reply({ content: 'Anahtar 1 ay uzatıldı.', ephemeral: true });
    return;
  }

  private async keyRemoveMonth(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const keyStr = parts[parts.length - 1];
    const key = await KeyModel.findOne({ key: keyStr }).exec();
    if (!key) {
      await interaction.reply({ content: 'Anahtar bulunamadı.', ephemeral: true });
      return;
    }
    if (key.status === 'used' && key.expiresAt) {
      key.expiresAt = new Date(key.expiresAt.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (key.expiresAt.getTime() <= (key.activatedAt?.getTime() ?? 0)) {
        key.status = 'expired';
      }
    } else {
      key.durationMonths = Math.max(0, key.durationMonths - 1);
    }
    await key.save();
    await interaction.reply({ content: 'Anahtar süresi 1 ay azaltıldı.', ephemeral: true });
    return;
  }

  private async keyConfirmCancel(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const keyStr = parts[parts.length - 1];
    const key = await KeyModel.findOne({ key: keyStr }).exec();
    if (!key) {
      await interaction.reply({ content: 'Anahtar bulunamadı.', ephemeral: true });
      return;
    }

    key.status = 'expired';
    await key.save();
    await interaction.update({ content: `Anahtar ${key.key} iptal edildi.`, components: [] });
    return;
  }

  private async keyAbortCancel(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({ content: 'İptal işlemi iptal edildi.', components: [] });
    return;
  }

  private async handleDeleteAllProductsCancel(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({ content: '❌ Bu işlem için yönetici yetkisi gerekli.', ephemeral: true });
      return;
    }

    await interaction.update({
      content: 'İşlem iptal edildi.',
      components: [],
    });
  }

  private async handleCloseTicket(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Geçersiz işlem.', ephemeral: true });
      return;
    }

    const channelId = interaction.customId.split(':').pop();
    if (!channelId) {
      await interaction.reply({ content: 'Geçersiz ticket.', ephemeral: true });
      return;
    }

    const ticket = await TicketModel.findOne({ channelId, status: 'open' });
    if (!ticket) {
      await interaction.reply({
        content: 'Bu ticket bulunamadı veya zaten kapatılmış.',
        ephemeral: true,
      });
      return;
    }

    const isOwner = ticket.userId === interaction.user.id;
    const isAdmin = interaction.memberPermissions?.has('Administrator') ?? false;
    const isStaff =
      config.staffRoleId &&
      interaction.member &&
      'roles' in interaction.member &&
      interaction.member.roles instanceof Object &&
      'cache' in interaction.member.roles &&
      interaction.member.roles.cache.has(config.staffRoleId);

    if (!isOwner && !isAdmin && !isStaff) {
      await interaction.reply({
        content: '❌ Bu ticketi kapatma yetkiniz yok.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    ticket.status = 'closed';
    await ticket.save();

    const channel = interaction.guild.channels.cache.get(channelId);
    if (channel?.isTextBased()) {
      await channel.send(
        `🔒 Ticket closed by ${interaction.user}.\n` +
          `Ticket ${interaction.user} tarafından kapatıldı.`
      );
      setTimeout(async () => {
        try {
          await channel.delete('Ticket closed');
        } catch {
          /* channel may already be deleted */
        }
      }, 5000);
    }

    await interaction.editReply({
      content: '✅ Ticket kapatılıyor... Kanal 5 saniye içinde silinecek.',
    });
  }
}
