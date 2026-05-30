import { Events, Message } from 'discord.js';
import { BotClient } from '../client/BotClient';
import { config } from '../config/config';
import { Event } from '../structures/Event';
import { EventOptions } from '../types';

export default class MessageCreateEvent extends Event {
  public readonly options: EventOptions = {
    name: Events.MessageCreate,
    execute: async (message: unknown) => {
      const msg = message as Message;
      const client = msg.client as BotClient;

      if (!msg.author || msg.author.bot) {
        return;
      }

      if (msg.partial) {
        await msg.fetch().catch(() => undefined);
      }

      if (msg.channel.isDMBased()) {
        await client.modmail.handleUserMessage(msg);
        return;
      }

      if (msg.guild?.id === config.modmailManagementGuildId) {
        await client.modmail.handleStaffMessage(msg);
      }
    },
  };
}