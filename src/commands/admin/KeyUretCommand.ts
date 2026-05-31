import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
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

export default new Command({
  data: new SlashCommandBuilder()
    .setName('keyüret')
    .setDescription('Yeni lisans anahtarı üret (admin)')
    .addIntegerOption((opt) => opt.setName('ay_sayisi').setDescription('Kaç ay geçerli').setRequired(true)),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('Administrator')) {
      return interaction.reply({ content: 'Yönetici izni gerekli.', ephemeral: true });
    }

    const months = interaction.options.getInteger('ay_sayisi', true);
    const keyString = generateKey();

    const key = new KeyModel({ key: keyString, durationMonths: months, status: 'unused' });
    await key.save();

    return interaction.reply({ content: `Anahtar üretildi: ${keyString}`, ephemeral: true });
  },
});
