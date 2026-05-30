import fs from 'fs';
import path from 'path';
import { BotClient } from '../client/BotClient';
import { Command } from '../structures/Command';
import { isLoadableModuleFile } from '../utils/moduleLoader';

export class CommandHandler {
  constructor(private readonly client: BotClient) {}

  public async loadCommands(): Promise<void> {
    const commandsPath = path.join(__dirname, '..', 'commands');
    const categories = fs
      .readdirSync(commandsPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const category of categories) {
      const categoryPath = path.join(commandsPath, category);
      const commandFiles = fs
        .readdirSync(categoryPath)
        .filter(isLoadableModuleFile);

      for (const file of commandFiles) {
        const filePath = path.join(categoryPath, file);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const imported = require(filePath);
        const CommandClass = imported.default as new () => Command;

        if (!CommandClass) {
          console.warn(`[CommandHandler] Skipping ${filePath}: no default export`);
          continue;
        }

        const commandInstance = new CommandClass();
        const { options } = commandInstance;
        const name = options.data.name;

        if (this.client.commands.has(name)) {
          console.warn(`[CommandHandler] Duplicate command name: ${name}`);
          continue;
        }

        this.client.commands.set(name, options);
        console.log(`[CommandHandler] Loaded command: ${name}`);
      }
    }
  }
}
