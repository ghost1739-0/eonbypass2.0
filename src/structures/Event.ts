import { EventOptions } from '../types';

export abstract class Event {
  public abstract readonly options: EventOptions;

  public get name() {
    return this.options.name;
  }

  public get once() {
    return this.options.once ?? false;
  }

  public get execute() {
    return this.options.execute;
  }
}
