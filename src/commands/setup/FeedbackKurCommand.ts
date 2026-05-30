import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { Command } from '../../structures/Command';
import { CommandOptions } from '../../types';
import { CustomIds } from '../../utils/constants';
import { buildFeedbackPanelEmbed } from '../../utils/ticketHelpers';

const panelLocks = new Set<string>();

export default class FeedbackKurCommand extends Command {
  public readonly options: CommandOptions = {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('feedback-kur')
      .setDescription('Geri bildirim panelini belirtilen kanala gönderir')
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

      const lockKey = `feedback:${textChannel.id}`;
      if (panelLocks.has(lockKey)) {
        await interaction.reply({ content: '⚠️ Bu kanalda feedback paneli zaten hazırlanıyor.', ephemeral: true });
        return;
      }

      panelLocks.add(lockKey);

      try {
        const recent = await textChannel.messages.fetch({ limit: 50 });
        const botMessages = recent.filter(
          (message) => message.author.id === _client.user?.id && message.embeds[0]?.title === 'Feedback / Geri Bildirim'
        );

        for (const message of botMessages.values()) {
          await message.delete().catch(() => undefined);
        }
      } catch {
        // ignore fetch failures and continue sending one fresh panel
      }

      try {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(CustomIds.FEEDBACK_OPEN)
            .setLabel('Submit Feedback / Geri Bildirim Gönder')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Primary)
        );

        await textChannel.send({
          embeds: [buildFeedbackPanelEmbed()],
          components: [row],
        });

        await interaction.reply({
          content: `✅ Geri bildirim paneli ${textChannel} kanalına gönderildi.`,
          ephemeral: true,
        });
      } finally {
        panelLocks.delete(lockKey);
      }
    },
  };
}
