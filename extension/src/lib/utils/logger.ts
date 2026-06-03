type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  data?: unknown
  timestamp: Date
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class Logger {
  private level: LogLevel = 'info'
  private history: LogEntry[] = []
  private maxHistory = 100

  setLevel(level: LogLevel): void {
    this.level = level
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data)
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data)
  }

  getHistory(): LogEntry[] {
    return [...this.history]
  }

  clearHistory(): void {
    this.history = []
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) {
      return
    }

    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date(),
    }

    this.history.push(entry)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }

    const prefix = `[TabBrain][${level.toUpperCase()}]`
    const timestamp = entry.timestamp.toISOString()

    switch (level) {
      case 'debug':
        if (data !== undefined) {
          console.debug(`${prefix} ${timestamp} ${message}`, data)
        } else {
          console.debug(`${prefix} ${timestamp} ${message}`)
        }
        break
      case 'info':
        if (data !== undefined) {
          console.info(`${prefix} ${timestamp} ${message}`, data)
        } else {
          console.info(`${prefix} ${timestamp} ${message}`)
        }
        break
      case 'warn':
        if (data !== undefined) {
          console.warn(`${prefix} ${timestamp} ${message}`, data)
        } else {
          console.warn(`${prefix} ${timestamp} ${message}`)
        }
        break
      case 'error':
        if (data !== undefined) {
          console.error(`${prefix} ${timestamp} ${message}`, data)
        } else {
          console.error(`${prefix} ${timestamp} ${message}`)
        }
        break
    }
  }
}

export const logger = new Logger()

// Enable debug logging in development
// @ts-expect-error - process may not exist in browser
if (typeof globalThis.process !== 'undefined' && globalThis.process?.env?.NODE_ENV === 'development') {
  logger.setLevel('debug')
}
