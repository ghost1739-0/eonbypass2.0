import { StringSelectMenuInteraction } from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { ProductModel } from '../../database/models/Product';
import { TicketModel } from '../../database/models/Ticket';
import { CustomIds } from '../../utils/constants';
import { createTicketChannel } from '../../utils/ticketHelpers';

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
    }
  }

  private async handleProductSelect(interaction: StringSelectMenuInteraction): Promise<void> {
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

    const openTicket = await TicketModel.findOne({
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      type: 'purchase',
      status: 'open',
    });

    if (openTicket) {
      await interaction.update({
        content: `❌ Zaten açık bir satın alma talebiniz var: <#${openTicket.channelId}>`,
        components: [],
      });
      return;
    }

    await interaction.deferUpdate();

    const member = await interaction.guild.members.fetch(interaction.user.id);
    let channel;
    let ticketId: string | undefined;

    try {
      const res = await createTicketChannel(interaction.guild, member, 'purchase', { product });
      channel = res.channel;
      ticketId = res.ticketId;
    } catch (err) {
      console.error('[SelectMenu] createTicketChannel error:', err);
      await interaction.followUp({
        content:
          '❌ Kanal oluşturulurken bir hata oluştu. Lütfen sunucu ayarlarını (kategori ID ve bot izinleri) kontrol edin ve tekrar deneyin.',
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.user.send({
        embeds: [
          {
            title: `${interaction.guild.name} Support`,
            description:
              '**✅ Your ticket has been created!**\nOur team will respond shortly.\n\n**TR:** Satın alma talebiniz oluşturuldu. Ekibimiz kısa süre içinde size yardımcı olacaktır.',
            color: 0x57f287,
            fields: [
              { name: 'Ticket ID', value: `#${ticketId}` },
              { name: 'Status', value: 'Open' },
              { name: 'Type', value: 'Purchase' },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch {
      /* couldn't DM user, ignore */
    }

    await interaction.followUp({
      content: `✅ Ticket #${ticketId} created! Check your DMs.`,
      ephemeral: true,
    });
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
