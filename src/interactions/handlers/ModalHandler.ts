import { ModalSubmitInteraction, EmbedBuilder } from 'discord.js';
import { TextInputStyle } from 'discord.js';
import type { TextBasedChannel } from 'discord.js';
import { BotClient } from '../../client/BotClient';
import { FeedbackModel } from '../../database/models/Feedback';
import { TicketModel } from '../../database/models/Ticket';
import { CustomIds } from '../../utils/constants';
import { createTicketChannel, resolveOpenTicket } from '../../utils/ticketHelpers';
import { config } from '../../config/config';
import { KeyModel } from '../../database/models/Key';

const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;

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
    if (customId.startsWith(`${CustomIds.MODAL_ADJUST_MONTHS}:`)) {
      await this.handleAdjustModal(interaction);
      return;
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

    const ticket = await this.client.modmail.openTicket(ticketType, interaction.user, {
      productTitle: undefined,
      productPrice: undefined,
      productDescription: `License Key: ${licenseKey}`,
    });

    await interaction.editReply({
      content: `✅ İşleminiz DM üzerinden başlatıldı, lütfen DM kutunuzu kontrol edin.\nTicket ID: #${ticket.ticketId}`,
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

    // Send feedback notification to configured channel if present.
    // Use the client to fetch the channel by ID (may be in another guild or not cached).
    try {
      const feedbackChannelId = config.feedbackChannelId;
      if (feedbackChannelId) {
        const channel = await this.client.channels.fetch(feedbackChannelId).catch(() => null);
        if (channel && 'send' in channel && typeof (channel as any).send === 'function') {
          const embed = new EmbedBuilder()
            .setColor(0xfee75c)
            .setTitle('Feedback / Geri Bildirim')
            .addFields(
              { name: 'Kullanıcı', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Lisans', value: licenseKey || '—', inline: true },
              { name: 'Feedback', value: feedback }
            )
            .setTimestamp();

          const sent = await (channel as any).send({ embeds: [embed] });
          // eslint-disable-next-line no-console
          console.log(
            `[Feedback] delivered to channel=${feedbackChannelId} user=${interaction.user.id} message=${sent?.id}`
          );
        }
      }
    } catch (err) {
      // Log failure so we can debug why messages don't appear
      // eslint-disable-next-line no-console
      console.error('[Feedback] failed to deliver notification', err);
    }
  }

  private async handleAdjustModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const parts = interaction.customId.split(':');
      const keyStr = parts[parts.length - 1];
      const deltaRaw = interaction.fields.getTextInputValue('months_delta');

      console.log('[ModalHandler] handleAdjustModal called for key=', keyStr, 'deltaRaw=', deltaRaw);

      const delta = parseInt(deltaRaw, 10);
      if (Number.isNaN(delta)) {
        await interaction.reply({ content: 'Geçersiz sayı girdiniz.', ephemeral: true });
        return;
      }

      const key = await KeyModel.findOne({ key: keyStr }).exec();
      console.log('[ModalHandler] DB findOne result for key=', keyStr, ' =>', !!key);
      if (!key) {
        await interaction.reply({ content: 'Anahtar bulunamadı.', ephemeral: true });
        return;
      }

      if (key.status === 'used' && key.expiresAt && key.activatedAt) {
        key.expiresAt = new Date(key.expiresAt.getTime() + delta * MS_PER_MONTH);
        const months = Math.max(0, Math.round((key.expiresAt.getTime() - key.activatedAt.getTime()) / MS_PER_MONTH));
        key.durationMonths = months;
      } else {
        key.durationMonths = Math.max(0, (key.durationMonths ?? 0) + delta);
        if (key.status === 'used' && key.activatedAt) {
          key.expiresAt = new Date((key.activatedAt?.getTime() ?? Date.now()) + (key.durationMonths ?? 0) * MS_PER_MONTH);
        }
      }

      if ((key.durationMonths ?? 0) <= 0 && key.status === 'used') {
        key.status = 'expired';
      }

      await key.save();
      console.log('[ModalHandler] key saved, new durationMonths=', key.durationMonths, 'expiresAt=', key.expiresAt);

      await interaction.reply({ content: `Anahtar süresi güncellendi. Yeni ay: ${key.durationMonths}`, ephemeral: true });
    } catch (err) {
      console.error('[ModalHandler] handleAdjustModal error', err);
      const msg = err instanceof Error ? err.message : 'unknown error';
      try {
        await interaction.reply({ content: `Bir hata oluştu: ${msg}`, ephemeral: true });
      } catch {
        /* ignore */
      }
    }
  }
}
