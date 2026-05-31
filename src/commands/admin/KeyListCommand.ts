import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { Command } from '../../structures/Command';
import { CommandOptions } from '../../types';
import { KeyModel } from '../../database/models/Key';

export default class KeyListCommand extends Command {
  public readonly options: CommandOptions = {
    adminOnly: true,
    data: new SlashCommandBuilder().setName('keylist').setDescription('Lisans anahtarlarını listele (admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    execute: async (interaction: ChatInputCommandInteraction, _client: BotClient) => {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: 'Yönetici izni gerekli.', ephemeral: true });
        return;
      }

      const keys = await KeyModel.find({}).limit(25).sort({ createdAt: -1 }).exec();
      if (!keys.length) {
        await interaction.reply({ content: 'Anahtar bulunamadı.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder().setTitle('Lisans Anahtarları').setColor(0x57f287).setTimestamp();

      for (const k of keys) {
        const expires = k.expiresAt ? `Expires: ${k.expiresAt.toISOString().split('T')[0]}` : 'No expiry';
        embed.addFields({ name: k.key, value: `Status: ${k.status} • Months: ${k.durationMonths} • ${expires}` });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  };
}
