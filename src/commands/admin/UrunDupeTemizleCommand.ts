import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { ProductModel } from '../../database/models/Product';
import { Command } from '../../structures/Command';
import { CommandOptions } from '../../types';

export default class UrunDupeTemizleCommand extends Command {
  public readonly options: CommandOptions = {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('ürün-temizle-dup')
      .setDescription('Aynı başlığa sahip ürünleri temizler (Yönetici)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    execute: async (interaction: ChatInputCommandInteraction, _client: BotClient) => {
      try {
        const all = await ProductModel.find().sort({ createdAt: -1 });
        const seen = new Map<string, string>();
        let removed = 0;

        for (const p of all) {
          const key = (p.title ?? '').toString().toLowerCase().trim();
          if (!key) continue;
          if (seen.has(key)) {
            await ProductModel.findByIdAndDelete(p._id);
            removed++;
          } else {
            seen.set(key, p._id.toString());
          }
        }

        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('Duble Ürünler Temizlendi')
          .setDescription(`Silinen ürün sayısı: **${removed}**`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error('[UrunDupeTemizle] error:', error);
        await interaction.reply({ content: '❌ Dupe temizleme başarısız.', ephemeral: true });
      }
    },
  };
}
