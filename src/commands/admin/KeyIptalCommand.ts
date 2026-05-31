import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { KeyModel } from '../../database/models/Key';
import { CustomIds } from '../../utils/constants';

export default new Command({
  data: new SlashCommandBuilder().setName('keyiptal').setDescription('Anahtar iptal et (admin)'),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('Administrator')) {
      return interaction.reply({ content: 'Yönetici izni gerekli.', ephemeral: true });
    }

    const keys = await KeyModel.find({}).limit(25).sort({ createdAt: -1 }).exec();
    if (!keys.length) return interaction.reply({ content: 'Anahtar bulunamadı.', ephemeral: true });

    const options = keys.map((k) => ({ label: `${k.key} (${k.status})`, value: k.key, description: `Ay: ${k.durationMonths}` }));
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId(CustomIds.KEY_CANCEL_SELECT).setPlaceholder('İptal edilecek anahtarı seçin').addOptions(options)
    );

    return interaction.reply({ content: 'İptal etmek istediğiniz anahtarı seçin:', components: [row], ephemeral: true });
  },
});
