import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Collection,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { BotClient } from '../client/BotClient';

export type SlashCommandData =
  | SlashCommandBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandOptionsOnlyBuilder
  | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;

export interface CommandOptions {
  data: SlashCommandData;
  adminOnly?: boolean;
  execute: (interaction: ChatInputCommandInteraction, client: BotClient) => Promise<void>;
  autocomplete?: (
    interaction: AutocompleteInteraction,
    client: BotClient
  ) => Promise<void>;
}

export interface EventOptions {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => Promise<void> | void;
}

export interface IProduct {
  _id: string;
  title: string;
  description: string;
  price: string;
  createdBy: string;
  createdAt: Date;
}

export interface ITicket {
  _id: string;
  ticketId: string;
  channelId: string;
  guildId: string;
  userId: string;
  type: 'purchase' | 'support' | 'inquiry';
  productId?: string;
  licenseKey?: string;
  status: 'open' | 'closed';
  createdAt: Date;
}

export interface IFeedback {
  _id: string;
  userId: string;
  guildId: string;
  licenseKey: string;
  feedback: string;
  createdAt: Date;
}

export type ModmailCategory = 'purchase' | 'support' | 'inquiry';

export interface IModmailTicket {
  _id: string;
  ticketNumber: number;
  ticketId: string;
  userId: string;
  userTag: string;
  userAvatarUrl: string;
  guildId: string;
  channelId: string;
  category: ModmailCategory;
  status: 'open' | 'closed';
  createdAt: Date;
  closedAt?: Date | null;
}

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, CommandOptions>;
  }
}
