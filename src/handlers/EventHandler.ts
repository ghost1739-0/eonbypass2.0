import fs from 'fs';
import path from 'path';
import { BotClient } from '../client/BotClient';
import { Event } from '../structures/Event';
import { isLoadableModuleFile } from '../utils/moduleLoader';

export class EventHandler {
  constructor(private readonly client: BotClient) {}

  public async loadEvents(): Promise<void> {
    const eventsPath = path.join(__dirname, '..', 'events');
    const eventFiles = fs
      .readdirSync(eventsPath)
      .filter(isLoadableModuleFile);

    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const imported = require(filePath);
      const EventClass = imported.default as new () => Event;

      if (!EventClass) {
        console.warn(`[EventHandler] Skipping ${filePath}: no default export`);
        continue;
      }

      const eventInstance = new EventClass();
      const { name, once, execute } = eventInstance.options;

      if (once) {
        this.client.once(name, (...args) => execute(...args));
      } else {
        this.client.on(name, (...args) => execute(...args));
      }

      console.log(`[EventHandler] Loaded event: ${name}${once ? ' (once)' : ''}`);
    }
  }
}
