import { StringSelectMenuInteraction } from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { ProductModel } from '../../database/models/Product';
import { CustomIds } from '../../utils/constants';

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
      await this.client.modmail.openFromPanel(interaction);
    }
  }

  private async handleProductSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    try {
      if (!interaction.guild || !interaction.member) {
        await interaction.reply({ content: 'Geçersiz işlem.', ephemeral: true });
        return;
      }

      const productId = interaction.values[0];
      const product = await ProductModel.findById(productId);

      if (!product) {
        await interaction.reply({
          content: '❌ Seçilen ürün bulunamadı. / Selected product not found.',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferUpdate();

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
