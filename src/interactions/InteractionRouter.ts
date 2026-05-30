import { Interaction } from 'discord.js';
import { BotClient } from '../client/BotClient';
import { ButtonHandler } from './handlers/ButtonHandler';
import { ModalHandler } from './handlers/ModalHandler';
import { SelectMenuHandler } from './handlers/SelectMenuHandler';

export class InteractionRouter {
  private readonly buttonHandler: ButtonHandler;
  private readonly selectMenuHandler: SelectMenuHandler;
  private readonly modalHandler: ModalHandler;

  constructor(private readonly client: BotClient) {
    this.buttonHandler = new ButtonHandler(client);
    this.selectMenuHandler = new SelectMenuHandler(client);
    this.modalHandler = new ModalHandler(client);
  }

  public async route(interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand()) return;

    if (interaction.isAutocomplete()) {
      const command = this.client.commands.get(interaction.commandName);
      if (command?.autocomplete) {
        await command.autocomplete(interaction, this.client);
      }
      return;
    }

    if (interaction.isButton()) {
      await this.buttonHandler.handle(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      await this.selectMenuHandler.handle(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await this.modalHandler.handle(interaction);
    }
  }
}
