import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { ProductModel } from '../../database/models/Product';
import { Command } from '../../structures/Command';
import { CommandOptions } from '../../types';
import { CustomIds } from '../../utils/constants';

export default class UrunleriSilCommand extends Command {
  public readonly options: CommandOptions = {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('ürünlerisil')
      .setDescription('Veritabanındaki tüm ürünleri siler (Yönetici)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    execute: async (interaction: ChatInputCommandInteraction, _client: BotClient) => {
      try {
        const count = await ProductModel.countDocuments();

        if (count === 0) {
          await interaction.reply({
            content: '❌ Silinecek ürün bulunamadı.',
            ephemeral: true,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('Tüm Ürünleri Sil')
          .setDescription(
            `**Uyarı:** Bu işlem geri alınamaz.\n\nVeritabanında **${count}** ürün var. Hepsini silmek istiyor musun?`
          )
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(CustomIds.PRODUCT_DELETE_ALL_CONFIRM)
            .setLabel('Evet, hepsini sil')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(CustomIds.PRODUCT_DELETE_ALL_CANCEL)
            .setLabel('İptal')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          embeds: [embed],
          components: [row],
          ephemeral: true,
        });
      } catch (error) {
        console.error('[UrunleriSil] execute error:', error);
        await interaction.reply({
          content: '❌ Tüm ürünler için onay ekranı oluşturulamadı.',
          ephemeral: true,
        }).catch(() => undefined);
      }
    },
  };
}
