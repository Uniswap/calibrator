export class Logger {
  private name: string
  private silent: boolean

  constructor(name: string, silent = process.env.NODE_ENV === 'test') {
    this.name = name
    this.silent = silent
  }

  error(message: string): void {
    if (!this.silent) {
      console.error(`[${this.name}] ${message}`)
    }
  }

  info(message: string): void {
    if (!this.silent) {
      console.info(`[${this.name}] ${message}`)
    }
  }

  debug(message: string): void {
    if (!this.silent) {
      console.debug(`[${this.name}] ${message}`)
    }
  }
}
