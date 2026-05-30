import {
  ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { Command } from '../../structures/Command';
import { CommandOptions } from '../../types';
import { buildModmailPanelEmbed, buildModmailSelectMenu } from '../../utils/modmailHelpers';

export default class ModmailPanelCommand extends Command {
  public readonly options: CommandOptions = {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('modmail-panel')
      .setDescription('DM-ticket / modmail panelini gönderir')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption((option) =>
        option
          .setName('kanal')
          .setDescription('Panelin gönderileceği kanal')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      ),
    execute: async (interaction: ChatInputCommandInteraction, _client: BotClient) => {
      const channel = interaction.options.getChannel('kanal', true);

      if (!interaction.guild) {
        await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
        return;
      }

      const textChannel = interaction.guild.channels.cache.get(channel.id);
      if (!textChannel?.isTextBased() || textChannel.isDMBased()) {
        await interaction.reply({ content: 'Geçersiz metin kanalı.', ephemeral: true });
        return;
      }

      await textChannel.send({
        embeds: [buildModmailPanelEmbed()],
        components: [buildModmailSelectMenu()],
      });

      await interaction.reply({ content: `✅ Modmail paneli ${textChannel} kanalına gönderildi.`, ephemeral: true });
    },
  };
}