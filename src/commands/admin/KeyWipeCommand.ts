import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { KeyModel } from '../../database/models/Key';
import { Command } from '../../structures/Command';
import { CommandOptions } from '../../types';

export default class KeyWipeCommand extends Command {
  public readonly options: CommandOptions = {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('keywipe')
      .setDescription('Veritabanındaki tüm key kayıtlarını siler (Yönetici)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    execute: async (interaction: ChatInputCommandInteraction, _client: BotClient) => {
      try {
        const count = await KeyModel.countDocuments();

        if (count === 0) {
          await interaction.reply({ content: '❌ Silinecek key bulunamadı.', ephemeral: true });
          return;
        }

        const result = await KeyModel.deleteMany({});

        await interaction.reply({
          content: `✅ Tüm key kayıtları silindi. Silinen kayıt sayısı: **${result.deletedCount}**`,
          ephemeral: true,
        });
      } catch (error) {
        console.error('[KeyWipe] execute error:', error);
        await interaction.reply({
          content: '❌ Key kayıtları silinirken bir hata oluştu.',
          ephemeral: true,
        }).catch(() => undefined);
      }
    },
  };
}