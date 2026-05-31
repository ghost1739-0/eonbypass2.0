import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { Command } from '../../structures/Command';
import { CommandOptions } from '../../types';
import { KeyModel } from '../../database/models/Key';
import { CustomIds } from '../../utils/constants';

export default class KeyBilgiCommand extends Command {
  public readonly options: CommandOptions = {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('keybilgi')
      .setDescription('Belirli bir anahtarın detaylarını gösterir (admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) => opt.setName('anahtar').setDescription('Anahtar değeri').setRequired(true)),
    execute: async (interaction: ChatInputCommandInteraction, _client: BotClient) => {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: 'Yönetici izni gerekli.', ephemeral: true });
        return;
      }

      const keyStr = interaction.options.getString('anahtar', true).trim();
      const key = await KeyModel.findOne({ key: keyStr }).exec();
      if (!key) {
        await interaction.reply({ content: 'Anahtar bulunamadı.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Anahtar: ${key.key}`)
        .addFields(
          { name: 'Durum', value: `${key.status}`, inline: true },
          { name: 'Ay', value: `${key.durationMonths}`, inline: true },
          { name: 'HWID', value: `${key.hwid ?? '—'}`, inline: true }
        )
        .setColor(0x57f287)
        .setTimestamp();

      const addId = `${CustomIds.KEY_ADD_MONTH}:${key.key}`;
      const remId = `${CustomIds.KEY_REMOVE_MONTH}:${key.key}`;
      const cancelId = `${CustomIds.KEY_CONFIRM_CANCEL}:${key.key}`;

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(addId).setLabel('+1 Ay').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(remId).setLabel('-1 Ay').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(cancelId).setLabel('İptal Et').setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },
  };
}
