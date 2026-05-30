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
import { buildTicketPanelEmbed } from '../../utils/ticketHelpers';

const panelLocks = new Set<string>();

export default class TicketKurCommand extends Command {
  public readonly options: CommandOptions = {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('ticket-kur')
      .setDescription('Ticket ana panelini belirtilen kanala gönderir')
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

      const lockKey = `ticket:${textChannel.id}`;
      if (panelLocks.has(lockKey)) {
        await interaction.reply({ content: '⚠️ Bu kanalda ticket paneli zaten hazırlanıyor.', ephemeral: true });
        return;
      }

      panelLocks.add(lockKey);

      try {
        const recent = await textChannel.messages.fetch({ limit: 50 });
        const botMessages = recent.filter(
          (message) => message.author.id === _client.user?.id && message.embeds[0]?.title === 'Support Center / Destek Merkezi'
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
            .setCustomId(CustomIds.TICKET_PURCHASE)
            .setLabel('Purchase / Satın Alma')
            .setEmoji('🛒')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(CustomIds.TICKET_SUPPORT)
            .setLabel('Support / Teknik Destek')
            .setEmoji('🛠️')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(CustomIds.TICKET_INQUIRY)
            .setLabel('Product Inquiry / Ürün Sorgula')
            .setEmoji('ℹ️')
            .setStyle(ButtonStyle.Secondary)
        );

        await textChannel.send({
          embeds: [buildTicketPanelEmbed()],
          components: [row],
        });

        await interaction.reply({
          content: `✅ Ticket paneli ${textChannel} kanalına gönderildi.`,
          ephemeral: true,
        });
      } finally {
        panelLocks.delete(lockKey);
      }
    },
  };
}
