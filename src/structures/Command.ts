import { CommandOptions } from '../types';

export abstract class Command {
  public abstract readonly options: CommandOptions;

  public get data() {
    return this.options.data;
  }

  public get execute() {
    return this.options.execute;
  }

  public get autocomplete() {
    return this.options.autocomplete;
  }

  public get adminOnly() {
    return this.options.adminOnly ?? false;
  }
}
