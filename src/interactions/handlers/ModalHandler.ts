import { ModalSubmitInteraction } from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { FeedbackModel } from '../../database/models/Feedback';
import { TicketModel } from '../../database/models/Ticket';
import { CustomIds } from '../../utils/constants';
import { createTicketChannel, resolveOpenTicket } from '../../utils/ticketHelpers';
import { config } from '../../config/config';

export class ModalHandler {
  constructor(private readonly client: BotClient) {}

  public async handle(interaction: ModalSubmitInteraction): Promise<void> {
    const { customId } = interaction;

    if (customId.startsWith(`${CustomIds.MODAL_LICENSE}:`)) {
      await this.handleLicenseModal(interaction);
      return;
    }

    if (customId === CustomIds.MODAL_FEEDBACK) {
      await this.handleFeedbackModal(interaction);
    }
  }

  private async handleLicenseModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: 'Geçersiz işlem.', ephemeral: true });
      return;
    }

    const ticketType = interaction.customId.split(':').pop() as 'support' | 'inquiry';
    const licenseKey = interaction.fields.getTextInputValue('license_key');

    const openTicket = await resolveOpenTicket(interaction.guild, interaction.user.id, ticketType);

    if (openTicket) {
      await interaction.reply({
        content: `❌ Zaten açık bir talebiniz var: <#${openTicket.channelId}>`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const { channel } = await createTicketChannel(interaction.guild, member, ticketType, {
      licenseKey,
    });

    await interaction.editReply({
      content: `✅ Ticket oluşturuldu: ${channel}`,
    });
  }

  private async handleFeedbackModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Geçersiz işlem.', ephemeral: true });
      return;
    }

    const licenseKey = interaction.fields.getTextInputValue('license_key');
    const feedback = interaction.fields.getTextInputValue('feedback_text');

    await FeedbackModel.create({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      licenseKey,
      feedback,
    });

    await interaction.reply({
      content:
        '✅ **EN:** Thank you for your feedback! It has been recorded.\n' +
        '**TR:** Geri bildiriminiz için teşekkürler! Kaydedildi.',
      ephemeral: true,
    });

    // Send feedback notification to configured channel if present
    try {
      const feedbackChannelId = config.feedbackChannelId;
      if (feedbackChannelId && interaction.guild) {
        const target = interaction.guild.channels.cache.get(feedbackChannelId);
        if (target && target.isTextBased()) {
          await target.send(
            `<@${interaction.user.id}> kullanıcısı "${feedback}" şeklinde değerlendirme yaptı. Lisans: ${licenseKey}`
          );
        }
      }
    } catch {
      /* ignore failures */
    }
  }
}
