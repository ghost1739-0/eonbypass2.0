import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { CommandHandler } from '../handlers/CommandHandler';
import { EventHandler } from '../handlers/EventHandler';
import { ModmailService } from '../services/modmail/ModmailService';
import { CommandOptions } from '../types';

export class BotClient extends Client {
  public readonly commands: Collection<string, CommandOptions>;
  public readonly modmail: ModmailService;
  private readonly commandHandler: CommandHandler;
  private readonly eventHandler: EventHandler;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message, Partials.User],
    });

    this.commands = new Collection();
    this.modmail = new ModmailService(this);
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
