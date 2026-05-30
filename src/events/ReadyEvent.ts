import { ActivityType, Events } from 'discord.js';
import { BotClient } from '../client/BotClient';
import { Event } from '../structures/Event';
import { EventOptions } from '../types';

export default class ReadyEvent extends Event {
  public readonly options: EventOptions = {
    name: Events.ClientReady,
    once: true,
    execute: async (client: unknown) => {
      const bot = client as BotClient;
      console.log(`[Bot] Logged in as ${bot.user?.tag}`);
      bot.user?.setActivity('EonBypass 2.0', { type: ActivityType.Watching });
    },
  };
}
