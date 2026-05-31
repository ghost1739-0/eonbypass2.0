import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { Command } from '../../structures/Command';
import { CommandOptions } from '../../types';
import { KeyModel } from '../../database/models/Key';

function generateKey() {
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    parts.push(
      Array.from({ length: 4 })
        .map(() => Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '0').charAt(2) || '0')
        .join('')
    );
  }
  return parts.join('-');
}

export default class KeyUretCommand extends Command {
  public readonly options: CommandOptions = {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('keyüret')
      .setDescription('Yeni lisans anahtarı üret (admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addIntegerOption((opt) => opt.setName('ay_sayisi').setDescription('Kaç ay geçerli').setRequired(true)),
    execute: async (interaction: ChatInputCommandInteraction, _client: BotClient) => {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: 'Yönetici izni gerekli.', ephemeral: true });
        return;
      }

      const months = interaction.options.getInteger('ay_sayisi', true);
      const keyString = generateKey();

      const key = new KeyModel({ key: keyString, durationMonths: months, status: 'unused' });
      await key.save();

      await interaction.reply({ content: `Anahtar üretildi: ${keyString}`, ephemeral: true });
    },
  };
}
