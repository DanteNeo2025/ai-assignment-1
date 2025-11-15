import * as winston from 'winston';

/**
 * Logger class for consistent logging across the application
 */
export class Logger {
  private logger: winston.Logger;
  private static instance: winston.Logger | null = null;

  constructor(module?: string) {
    if (!Logger.instance) {
      Logger.instance = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
          }),
          winston.format.errors({ stack: true }),
          winston.format.printf((info: any) => {
            const { timestamp, level, message, stack, module } = info;
            const moduleStr = module ? `[${module}] ` : '';
            const stackStr = stack ? `\n${stack}` : '';
            return `${timestamp} ${level.toUpperCase()}: ${moduleStr}${message}${stackStr}`;
          })
        ),
        defaultMeta: { module },
        transports: [
          // Console transport
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.printf((info: any) => {
                const { timestamp, level, message, module } = info;
                const moduleStr = module ? `[${module}] ` : '';
                return `${timestamp} ${level}: ${moduleStr}${message}`;
              })
            )
          }),
          // File transport for all logs
          new winston.transports.File({
            filename: 'logs/app.log',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            )
          }),
          // File transport for errors only
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            )
          })
        ]
      });

      // Create logs directory if it doesn't exist
      const fs = eval('require')('fs');
      if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs');
      }
    }

    this.logger = Logger.instance.child({ module });
  }

  /**
   * Log info level message
   */
  info(message: string, ...args: any[]): void {
    this.logger.info(message, ...args);
  }

  /**
   * Log debug level message
   */
  debug(message: string, ...args: any[]): void {
    this.logger.debug(message, ...args);
  }

  /**
   * Log warning level message
   */
  warn(message: string, ...args: any[]): void {
    this.logger.warn(message, ...args);
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error | any, ...args: any[]): void {
    if (error instanceof Error) {
      this.logger.error(message, { error: error.message, stack: error.stack }, ...args);
    } else if (error) {
      this.logger.error(message, { error }, ...args);
    } else {
      this.logger.error(message, ...args);
    }
  }

  /**
   * Log fatal level message
   */
  fatal(message: string, error?: Error | any, ...args: any[]): void {
    this.error(`FATAL: ${message}`, error, ...args);
  }

  /**
   * Create a child logger with additional metadata
   */
  child(metadata: Record<string, any>): Logger {
    const childLogger = new Logger();
    childLogger.logger = this.logger.child(metadata);
    return childLogger;
  }

  /**
   * Set log level
   */
  setLevel(level: string): void {
    this.logger.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): string {
    return this.logger.level;
  }
}