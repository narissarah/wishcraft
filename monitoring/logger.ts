// Centralized logger for WishCraft
// Simple console-based logger with different levels

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private level: LogLevel;

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.level = envLevel === 'DEBUG' ? LogLevel.DEBUG :
                 envLevel === 'WARN' ? LogLevel.WARN :
                 envLevel === 'ERROR' ? LogLevel.ERROR :
                 LogLevel.INFO;
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (level < this.level) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    
    const logEntry = {
      timestamp,
      level: levelName,
      message,
      ...(data && { data })
    };

    if (level >= LogLevel.ERROR) {
      console.error(JSON.stringify(logEntry));
    } else if (level >= LogLevel.WARN) {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  debug(message: string, data?: any) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: any) {
    this.log(LogLevel.ERROR, message, data);
  }
}

export const logger = new Logger();