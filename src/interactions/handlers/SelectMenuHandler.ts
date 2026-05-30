import { EmbedBuilder, StringSelectMenuInteraction } from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { ProductModel } from '../../database/models/Product';
import { TicketModel } from '../../database/models/Ticket';
import { CustomIds } from '../../utils/constants';
import { createTicketChannel, resolveOpenTicket } from '../../utils/ticketHelpers';

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

      const openTicket = await resolveOpenTicket(interaction.guild, interaction.user.id, 'purchase');

      if (openTicket) {
        await interaction.update({
          content: `❌ Zaten açık bir satın alma talebiniz var: <#${openTicket.channelId}>`,
          components: [],
        });
        return;
      }

      await interaction.deferUpdate();

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const { ticketId } = await createTicketChannel(interaction.guild, member, 'purchase', { product });

      try {
        await interaction.user.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle('CFX Sense Support')
              .setDescription('**✅ Your ticket has been created!**\nOur team will respond shortly.')
              .addFields(
                { name: 'Ticket ID', value: `#${ticketId}`, inline: true },
                { name: 'Status', value: 'Open', inline: true },
                { name: 'Type', value: 'Purchase', inline: true }
              )
              .setFooter({ text: `CFX Sense • Support` })
              .setTimestamp(),
          ],
        });
      } catch {
        /* couldn't DM user, ignore */
      }

      await interaction.editReply({
        content: `✅ Ticket #${ticketId} created! Check your DMs.`,
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
