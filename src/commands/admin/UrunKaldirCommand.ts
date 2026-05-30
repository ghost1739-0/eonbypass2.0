import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { ProductModel } from '../../database/models/Product';
import { Command } from '../../structures/Command';
import { CommandOptions } from '../../types';
import { CustomIds } from '../../utils/constants';
import { getProductPrice, getProductTitle } from '../../utils/productHelpers';

export default class UrunKaldirCommand extends Command {
  public readonly options: CommandOptions = {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('ürünkaldır')
      .setDescription('Veritabanından ürün siler (Yönetici)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    execute: async (interaction: ChatInputCommandInteraction, _client: BotClient) => {
      const products = await ProductModel.find().sort({ createdAt: -1 }).limit(25);

      if (products.length === 0) {
        await interaction.reply({
          content: '❌ Veritabanında silinecek ürün bulunamadı. / No products found in database.',
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('Ürün Kaldır / Remove Product')
        .setDescription(
          '**TR:** Silmek istediğiniz ürünü aşağıdaki menüden seçin.\n' +
            '**EN:** Select the product you want to remove from the menu below.'
        )
        .addFields(
          products.map((p, i) => ({
            name: `${i + 1}. ${getProductTitle(p)}`,
            value: `Fiyat: ${getProductPrice(p)} | ID: \`${p._id}\``,
            inline: false,
          }))
        )
        .setTimestamp();

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(CustomIds.PRODUCT_REMOVE)
        .setPlaceholder('Ürün seçin / Select a product')
        .addOptions(
          products.map((p) => ({
            label: getProductTitle(p).slice(0, 100),
            description: `Fiyat: ${getProductPrice(p)}`.slice(0, 100),
            value: p._id.toString(),
          }))
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });
    },
  };
}
