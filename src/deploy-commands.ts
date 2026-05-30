import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { config } from './config/config';
import { Command } from './structures/Command';
import { isLoadableModuleFile } from './utils/moduleLoader';

async function deployCommands(): Promise<void> {
  const commands: ReturnType<Command['options']['data']['toJSON']>[] = [];
  const commandsPath = path.join(__dirname, 'commands');
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
      const commandInstance = new CommandClass();
      commands.push(commandInstance.options.data.toJSON());
      console.log(`[Deploy] Prepared: ${commandInstance.options.data.name}`);
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commands,
    });
    console.log(`[Deploy] Registered ${commands.length} guild commands.`);
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log(`[Deploy] Registered ${commands.length} global commands.`);
  }
}

deployCommands().catch(console.error);
