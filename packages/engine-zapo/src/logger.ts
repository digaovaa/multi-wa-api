import type { Logger } from '@multi-wa/core'
import type { LogLevel, Logger as ZapoLogger } from 'zapo-js'

type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error'

export function toZapoLogger(logger: Logger): ZapoLogger {
  const bind =
    (level: Level) =>
    (message: string, context?: Readonly<Record<string, unknown>>): void => {
      logger[level](context ?? {}, message)
    }
  return {
    level: logger.level as LogLevel,
    trace: bind('trace'),
    debug: bind('debug'),
    info: bind('info'),
    warn: bind('warn'),
    error: bind('error'),
    child: (bindings) => toZapoLogger(logger.child(bindings))
  }
}
