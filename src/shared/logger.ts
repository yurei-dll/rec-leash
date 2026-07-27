export class Logger {
  #enabled: boolean;

  constructor(enabled: boolean) {
    this.#enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    this.info(`debug logging ${enabled ? "enabled" : "disabled"}`);
  }

  debug(message: string, details?: unknown): void {
    this.#write("debug", message, details);
  }

  info(message: string, details?: unknown): void {
    this.#write("info", message, details);
  }

  warn(message: string, details?: unknown): void {
    this.#write("warn", message, details);
  }

  error(message: string, details?: unknown): void {
    this.#write("error", message, details);
  }

  #write(level: "debug" | "info" | "warn" | "error", message: string, details?: unknown): void {
    if (!this.#enabled) {
      return;
    }

    const prefix = "[rec-leash]";
    if (details === undefined) {
      console[level](`${prefix} ${message}`);
      return;
    }

    console[level](`${prefix} ${message}`, details);
  }
}
