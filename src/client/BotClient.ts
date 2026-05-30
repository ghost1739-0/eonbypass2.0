import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { CommandHandler } from '../handlers/CommandHandler';
import { EventHandler } from '../handlers/EventHandler';
import { CommandOptions } from '../types';

export class BotClient extends Client {
  public readonly commands: Collection<string, CommandOptions>;
  private readonly commandHandler: CommandHandler;
  private readonly eventHandler: EventHandler;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    this.commands = new Collection();
    this.commandHandler = new CommandHandler(this);
    this.eventHandler = new EventHandler(this);
  }

  public async initialize(): Promise<void> {
    await this.commandHandler.loadCommands();
    await this.eventHandler.loadEvents();
  }

  public async start(token: string): Promise<void> {
    await this.login(token);
  }
}
