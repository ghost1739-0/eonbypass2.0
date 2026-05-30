import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { ProductModel } from '../../database/models/Product';
import { Command } from '../../structures/Command';
import { CommandOptions } from '../../types';

export default class UrunEkleCommand extends Command {
  public readonly options: CommandOptions = {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('ürünekle')
      .setDescription('Veritabanına yeni ürün ekler (Yönetici)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((option) =>
        option
          .setName('başlık')
          .setDescription('Ürün başlığı')
          .setRequired(true)
          .setMaxLength(100)
      )
      .addStringOption((option) =>
        option
          .setName('açıklama')
          .setDescription('Ürün açıklaması')
          .setRequired(true)
          .setMaxLength(1000)
      )
      .addStringOption((option) =>
        option
          .setName('fiyat')
          .setDescription('Ürün fiyatı')
          .setRequired(true)
          .setMaxLength(50)
      ),
    execute: async (interaction: ChatInputCommandInteraction, _client: BotClient) => {
      const title = interaction.options.getString('başlık', true);
      const description = interaction.options.getString('açıklama', true);
      const price = interaction.options.getString('fiyat', true);

      // Use an atomic upsert to avoid race conditions and duplicate creations
      const resAny = (await ProductModel.findOneAndUpdate(
        { title },
        {
          $setOnInsert: {
            title,
            description,
            price,
            createdBy: interaction.user.id,
          },
        },

        { upsert: true, returnDocument: 'after', rawResult: true }
      )) as any;

      const product = resAny.value ?? resAny;
      const created = Boolean(resAny.lastErrorObject && resAny.lastErrorObject.updatedExisting === false);

      if (!product) {
        await interaction.reply({ content: '❌ Ürün oluşturulamadı.', ephemeral: true });
        return;
      }

      if (!created) {
        await interaction.reply({
          content: '❌ Bu başlıkta bir ürün zaten mevcut. / A product with this title already exists.',
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Ürün Eklendi / Product Added')
        .addFields(
          { name: 'Başlık / Title', value: product.title },
          { name: 'Fiyat / Price', value: product.price },
          { name: 'Açıklama / Description', value: product.description },
          { name: 'ID', value: product._id.toString() }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  };
}
