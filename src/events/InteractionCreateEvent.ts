import { ChatInputCommandInteraction, Events, Interaction } from 'discord.js';
import { BotClient } from '../client/BotClient';
import { InteractionRouter } from '../interactions/InteractionRouter';
import { Event } from '../structures/Event';
import { EventOptions } from '../types';

let interactionRouter: InteractionRouter | null = null;

export default class InteractionCreateEvent extends Event {
  public readonly options: EventOptions = {
    name: Events.InteractionCreate,
    execute: async (interaction: unknown) => {
      const inter = interaction as Interaction;
      const client = inter.client as BotClient;

      if (!interactionRouter) {
        interactionRouter = new InteractionRouter(client);
      }

      try {
        if (inter.isChatInputCommand()) {
          await handleSlashCommand(inter, client);
          return;
        }

        await interactionRouter.route(inter);
      } catch (error) {
        console.error('[InteractionCreate] Error:', error);
        const reply = {
          content: '❌ Bir hata oluştu. Lütfen tekrar deneyin. / An error occurred.',
          ephemeral: true,
        };

        if (inter.isRepliable()) {
          if (inter.deferred || inter.replied) {
            await inter.editReply(reply).catch(() => undefined);
          } else {
            await inter.reply(reply).catch(() => undefined);
          }
        }
      }
    },
  };
}

async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  client: BotClient
): Promise<void> {
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    await interaction.reply({
      content: 'Bu komut bulunamadı.',
      ephemeral: true,
    });
    return;
  }

  if (command.adminOnly && !interaction.memberPermissions?.has('Administrator')) {
    await interaction.reply({
      content: '❌ Bu komutu kullanmak için yönetici yetkisine ihtiyacınız var.',
      ephemeral: true,
    });
    return;
  }

  await command.execute(interaction, client);
}
