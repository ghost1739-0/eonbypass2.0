import { StringSelectMenuInteraction } from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { ProductModel } from '../../database/models/Product';
import { CustomIds } from '../../utils/constants';
import { KeyModel } from '../../database/models/Key';
import { getProductDescription, getProductPrice, getProductTitle } from '../../utils/productHelpers';

export class SelectMenuHandler {
  constructor(private readonly client: BotClient) {}

  public async handle(interaction: StringSelectMenuInteraction): Promise<void> {
    const { customId } = interaction;

    if (customId === CustomIds.PRODUCT_SELECT) {
      await this.handleProductSelect(interaction);
      return;
    }

    if (customId === CustomIds.PRODUCT_REMOVE) {
      await this.handleProductRemove(interaction);
      return;
    }

    if (customId === CustomIds.MODMAIL_START) {
      await this.handleModmailPanelSelect(interaction);
      return;
    }

    if (customId === CustomIds.KEY_SELECT) {
      await this.keySelect(interaction);
      return;
    }

    if (customId === CustomIds.KEY_CANCEL_SELECT) {
      await this.keyCancelSelect(interaction);
      return;
    }
  }

  private async handleModmailPanelSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const category = interaction.values[0] as 'purchase' | 'support' | 'inquiry';

    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: 'Geçersiz işlem.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const ticket = await this.client.modmail.openTicket(category, interaction.user);

    await interaction.editReply({
      content: `✅ İşleminiz DM üzerinden başlatıldı, lütfen DM kutunuzu kontrol edin.\nTicket ID: #${ticket.ticketId}`,
    });
  }

  private async keySelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const value = interaction.values[0];
    const key = await KeyModel.findOne({ key: value }).exec();
    if (!key) {
      await interaction.update({ content: 'Anahtar bulunamadı.', components: [] });
      return;
    }

    const addId = `${CustomIds.KEY_ADD_MONTH}:${key.key}`;
    const remId = `${CustomIds.KEY_REMOVE_MONTH}:${key.key}`;

    const row = new (require('discord.js').ActionRowBuilder)().addComponents(
      new (require('discord.js').ButtonBuilder)().setCustomId(addId).setLabel('+1 Ay').setStyle(require('discord.js').ButtonStyle.Primary),
      new (require('discord.js').ButtonBuilder)().setCustomId(remId).setLabel('-1 Ay').setStyle(require('discord.js').ButtonStyle.Secondary)
    );

    try {
      await interaction.update({ content: `Anahtar: ${key.key}\nDurum: ${key.status}\nAy: ${key.durationMonths}`, components: [row as any] });
    } catch {
      // ignore
    }
    return;
  }

  private async keyCancelSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const value = interaction.values[0];
    const key = await KeyModel.findOne({ key: value }).exec();
    if (!key) {
      await interaction.update({ content: 'Anahtar bulunamadı.', components: [] });
      return;
    }

    const confirmId = `${CustomIds.KEY_CONFIRM_CANCEL}:${key.key}`;
    const abortId = `${CustomIds.KEY_CANCEL_ABORT}:${key.key}`;

    const row = new (require('discord.js').ActionRowBuilder)().addComponents(
      new (require('discord.js').ButtonBuilder)().setCustomId(confirmId).setLabel('EVET - İptal Et').setStyle(require('discord.js').ButtonStyle.Danger),
      new (require('discord.js').ButtonBuilder)().setCustomId(abortId).setLabel('Vazgeç').setStyle(require('discord.js').ButtonStyle.Secondary)
    );

    await interaction.update({ content: `Bu anahtarı iptal etmeyi onaylıyor musunuz? ${key.key}`, components: [row as any] });
    return;
  }

  private async handleProductSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    try {
      if (!interaction.guild || !interaction.member) {
        await interaction.reply({ content: 'Geçersiz işlem.', ephemeral: true });
        return;
      }

      await interaction.deferUpdate();

      const productId = interaction.values[0];
      const product = await ProductModel.findById(productId);

      if (!product) {
        await interaction.reply({
          content: '❌ Seçilen ürün bulunamadı. / Selected product not found.',
          ephemeral: true,
        });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const ticket = await this.client.modmail.openTicketForPurchase(member.user, {
        productTitle: product.title,
        productPrice: product.price,
        productDescription: product.description,
      });

      await interaction.editReply({
        content: `✅ Ticket #${ticket.ticketId} created! Check your DMs.`,
        components: [],
      });
    } catch (error) {
      console.error('[SelectMenu] handleProductSelect error:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: '❌ Bir hata oluştu. Lütfen tekrar deneyin. / An error occurred.',
          components: [],
        }).catch(() => undefined);
      } else {
        await interaction.reply({
          content: '❌ Bir hata oluştu. Lütfen tekrar deneyin. / An error occurred.',
          ephemeral: true,
        }).catch(() => undefined);
      }
    }
  }

  private async handleProductRemove(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({
        content: '❌ Bu işlem için yönetici yetkisi gerekli.',
        ephemeral: true,
      });
      return;
    }

    const productId = interaction.values[0];
    const product = await ProductModel.findByIdAndDelete(productId);

    if (!product) {
      await interaction.update({
        content: '❌ Ürün bulunamadı veya zaten silinmiş.',
        embeds: [],
        components: [],
      });
      return;
    }

    await interaction.update({
      content: `✅ **${product.title}** ürünü veritabanından kaldırıldı.`,
      embeds: [],
      components: [],
    });
  }
}
