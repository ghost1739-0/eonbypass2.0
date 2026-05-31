import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { Command } from '../../structures/Command';
import { CommandOptions } from '../../types';
import { KeyModel } from '../../database/models/Key';
import { CustomIds } from '../../utils/constants';

export default class KeyIptalCommand extends Command {
  public readonly options: CommandOptions = {
    adminOnly: true,
    data: new SlashCommandBuilder().setName('keyiptal').setDescription('Anahtar iptal et (admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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

      const options = keys.map((k) => ({ label: `${k.key} (${k.status})`, value: k.key, description: `Ay: ${k.durationMonths}` }));
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(CustomIds.KEY_CANCEL_SELECT).setPlaceholder('İptal edilecek anahtarı seçin').addOptions(options)
      );

      await interaction.reply({ content: 'İptal etmek istediğiniz anahtarı seçin:', components: [row], ephemeral: true });
    },
  };
}
