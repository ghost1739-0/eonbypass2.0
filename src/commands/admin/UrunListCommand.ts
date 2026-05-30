import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { ProductModel } from '../../database/models/Product';
import { Command } from '../../structures/Command';
import { CommandOptions } from '../../types';

export default class UrunListCommand extends Command {
  public readonly options: CommandOptions = {
    adminOnly: false,
    data: new SlashCommandBuilder()
      .setName('ürünlist')
      .setDescription('Eklenen ürünleri listeler / List added products'),
    execute: async (interaction: ChatInputCommandInteraction, _client: BotClient) => {
      const products = await ProductModel.find().sort({ createdAt: -1 }).limit(25);

      if (products.length === 0) {
        await interaction.reply({ content: '❌ Henüz ürün yok.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('Product List / Ürün Listesi')
        .setColor(0x2b2d31)
        .setTimestamp()
        .addFields(
          products.map((p, i) => ({ name: `${i + 1}. ${p.title}`, value: `Fiyat: ${p.price} | ID: ${p._id}`, inline: false }))
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  };
}
